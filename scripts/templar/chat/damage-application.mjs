import { TEMPLAR_SLUGS } from "../constants.mjs"
import {
   actorHasSlug,
   canUseTemplarBarrier,
   readTemplarState,
} from "../state.mjs"
import { damageContextFromRoll, templarActions } from "../api.mjs"
import { actorHasOrdinaryRaisedShield } from "../items.mjs"

const DAMAGE_WRAPPER_MARK = "_sscTemplarWrapped"

function contextFromDamage(damage) {
   if (typeof damage === "number") {
      return {
         roll: null,
         rollData: null,
         total: Math.max(0, Math.trunc(damage)),
         damageType: "untyped",
         damageTypes: ["untyped"],
         damageInstances: [
            {
               total: Math.max(0, Math.trunc(damage)),
               type: "untyped",
               formula: "",
               persistent: false,
               precision: false,
               evaluatePersistent: false,
            },
         ].filter((instance) => instance.total > 0),
         hasPersistentDamage: false,
         hasPrecisionDamage: false,
         traits: new Set(),
      }
   }
   return damageContextFromRoll(damage)
}

function resolveTokenLike(value) {
   if (!value) return null
   if (value.documentName === "Token" && value.actor)
      return value.object ?? value
   if (value.actor && (value.document || value.object || value.center))
      return value
   if (value.document?.actor) return value.document.object ?? value.document
   if (value.object?.actor) return value.object
   if (typeof value === "string") {
      const fromUuidDocument = globalThis.fromUuidSync?.(value)
      if (fromUuidDocument?.actor)
         return fromUuidDocument.object ?? fromUuidDocument
      const id = value.split(".").filter(Boolean).at(-1)
      return (
         canvas?.tokens?.get?.(id) ??
         canvas?.scene?.tokens?.get?.(id)?.object ??
         canvas?.scene?.tokens?.get?.(id) ??
         null
      )
   }
   return null
}

function actorTokenFromReference(reference) {
   const document =
      typeof reference === "string"
         ? (globalThis.fromUuidSync?.(reference) ??
           game.actors?.get?.(reference))
         : reference
   const actor = document?.actor ?? document
   return (
      actor?.getActiveTokens?.(true, true)?.[0] ??
      actor?.getActiveTokens?.(false, true)?.[0] ??
      null
   )
}

function actorTokenDocuments(actor) {
   const active = actor?.getActiveTokens?.(true, true) ?? []
   const inactive = actor?.getActiveTokens?.(false, true) ?? []
   const token = actor?.token ? [actor.token] : []
   return [...active, ...inactive, ...token]
      .map((entry) => entry?.document ?? entry)
      .filter(Boolean)
}

function tokenReferenceMatchesActor(
   reference,
   actor,
   tokens = actorTokenDocuments(actor),
) {
   if (!reference || !actor) return false
   const value =
      typeof reference === "string"
         ? reference
         : (reference.uuid ?? reference.id)
   const token = resolveTokenLike(reference)
   if (token?.actor?.id === actor.id) return true
   if (typeof value !== "string") return false
   return tokens.some((doc) => value === doc.uuid || value === doc.id)
}

function recentDamageMessageForActor(actor) {
   const tokens = actorTokenDocuments(actor)
   const messages = Array.from(game.messages?.contents ?? []).reverse()
   return messages.find((message) => {
      if (Date.now() - Number(message.timestamp ?? 0) > 300000) return false
      const context = message.flags?.pf2e?.context ?? {}
      if (context.type && context.type !== "damage-roll") return false
      const target = context.target ?? message.flags?.pf2e?.target ?? {}
      if (
         target.actor === actor.uuid ||
         target.actor === actor.id ||
         target.actorUuid === actor.uuid
      )
         return true
      return tokenReferenceMatchesActor(
         target.token ?? target.tokenUuid,
         actor,
         tokens,
      )
   })
}

function damageMessageSourceToken(message, actor) {
   const context = message?.flags?.pf2e?.context ?? {}
   const origin = context.origin ?? {}
   const candidates = [origin.token, origin.tokenUuid, message?.speaker?.token]
   for (const candidate of candidates) {
      const token = resolveTokenLike(candidate)
      if (token?.actor && token.actor.id !== actor?.id) return token
   }

   const actorCandidates = [
      origin.actor,
      origin.actorUuid,
      message?.speaker?.actor,
   ]
   for (const candidate of actorCandidates) {
      const token = actorTokenFromReference(candidate)
      if (token?.actor && token.actor.id !== actor?.id) return token
   }
   return null
}

function damageSourceToken(actor, options = {}, context = {}) {
   const roll = context?.roll
   const rollContext =
      roll?.options?.context ?? roll?.flags?.pf2e?.context ?? {}
   const origin =
      rollContext.origin ?? roll?.options?.origin ?? roll?.origin ?? {}
   const speaker = roll?.options?.speaker ?? roll?.speaker ?? {}
   const candidates = [
      options.sourceToken,
      options.attackerToken,
      options.originToken,
      context.sourceToken,
      context.attackerToken,
      origin.token,
      origin.tokenUuid,
      rollContext.token,
      rollContext.tokenUuid,
      speaker.token,
   ]

   for (const candidate of candidates) {
      const token = resolveTokenLike(candidate)
      if (token?.actor && token.actor.id !== actor?.id) return token
   }

   const actorCandidates = [
      origin.actor,
      origin.actorUuid,
      rollContext.actor,
      rollContext.actorUuid,
      roll?.actor,
      roll?.options?.actor,
      roll?.item?.actor,
   ]
   for (const candidate of actorCandidates) {
      const token = actorTokenFromReference(candidate)
      if (token?.actor && token.actor.id !== actor?.id) return token
   }
   return damageMessageSourceToken(recentDamageMessageForActor(actor), actor)
}

export function barrierIsIntact(actor) {
   const state = readTemplarState(actor)
   return (
      (state.light.value > 0 && !state.light.broken && !state.light.breaking) ||
      state.brilliantShard?.active
   )
}

function shouldOfferTemplarBlock(actor, options) {
   if (!options?.shieldBlockRequest || options.final) return false
   if (!canUseTemplarBarrier(actor)) return false
   return barrierIsIntact(actor)
}

async function damageForContext(context) {
   const hasDamageInstances =
      Array.isArray(context?.damageInstances) &&
      context.damageInstances.length > 0
   if (!context || (context.total <= 0 && !hasDamageInstances)) return 0
   return templarActions.damageFromContext
      ? await templarActions.damageFromContext(context)
      : context.total
}

function nativeDamageFallbackOptions(actor, options) {
   if (!options?.shieldBlockRequest) return options
   if (actorHasOrdinaryRaisedShield(actor)) return options
   return {
      ...options,
      shieldBlockRequest: false,
   }
}

async function applyContextDamage(
   original,
   actor,
   options,
   context,
   breakdown = [],
) {
   const hasDamageInstances =
      Array.isArray(context?.damageInstances) &&
      context.damageInstances.length > 0
   if (!context || (context.total <= 0 && !hasDamageInstances)) return actor
   return original.call(actor, {
      ...options,
      damage: await damageForContext(context),
      shieldBlockRequest: false,
      breakdown: [...(options.breakdown ?? []), ...breakdown],
   })
}

async function applyReactiveBarrier(original, actor, options, context) {
   const split = templarActions.splitDamageContextForBarrier(actor, context, {
      allowAllProtecting: true,
   })
   if (!split.barrier?.total)
      return original.call(actor, nativeDamageFallbackOptions(actor, options))
   const result = await templarActions.reactiveBarrier({
      actor,
      damage: split.barrier.total,
   })
   if (!result)
      return original.call(actor, nativeDamageFallbackOptions(actor, options))
   const remainingEligible = templarActions.reduceDamageContextByAmount
      ? templarActions.reduceDamageContextByAmount(
           split.barrier,
           result.prevented ?? 0,
        )
      : {
           ...split.barrier,
           total: Math.max(0, split.barrier.total - (result.prevented ?? 0)),
        }
   const remaining = templarActions.mergeDamageContexts
      ? templarActions.mergeDamageContexts([
           remainingEligible,
           split.passthrough,
        ])
      : remainingEligible
   return applyContextDamage(original, actor, options, remaining, [
      `Reactive Barrier Hardness -${result.prevented ?? 0}`,
   ])
}

async function applyRefractionReactiveBarrier(
   original,
   actor,
   options,
   context,
) {
   const refractionSucceeded = await templarActions.refraction({ actor })
   const nextContext = refractionSucceeded
      ? templarActions.regularizedCriticalDamageContext(context)
      : context
   return applyReactiveBarrier(original, actor, options, nextContext)
}

async function applyHoldingBarrier(actor, context) {
   const split = templarActions.splitDamageContextForBarrier(actor, context, {
      allowAllProtecting: true,
   })
   if (!split.barrier?.total) return null
   const hasDefenseMaster = actorHasSlug(actor, TEMPLAR_SLUGS.defenseMaster)
   const result = await templarActions.holdDamage({
      actor,
      damage: split.barrier.total,
      damageType: hasDefenseMaster ? split.barrier.damageType : "untyped",
      damageTypes: hasDefenseMaster ? split.barrier.damageTypes : ["untyped"],
      damageInstances: hasDefenseMaster ? split.barrier.damageInstances : null,
      rollData: hasDefenseMaster ? split.barrier.rollData : null,
      bypassIWR: !hasDefenseMaster,
      label: "Holding Barrier",
   })
   return result ? split.passthrough : null
}

async function applyLightBurst(original, actor, options, context) {
   const split = templarActions.splitDamageContextForBarrier(actor, context, {
      allowAllProtecting: false,
   })
   if (!split.barrier?.total)
      return original.call(actor, nativeDamageFallbackOptions(actor, options))
   const result = await templarActions.lightBurst({
      actor,
      damage: split.barrier.total,
   })
   if (!result)
      return original.call(actor, nativeDamageFallbackOptions(actor, options))
   return original.call(actor, {
      ...options,
      shieldBlockRequest: false,
   })
}

async function applyInculpation(original, actor, options, context) {
   const split = templarActions.splitDamageContextForBarrier(actor, context, {
      allowAllProtecting: false,
   })
   if (!split.barrier?.total)
      return original.call(actor, nativeDamageFallbackOptions(actor, options))
   const result = await templarActions.inculpation({
      actor,
      damage: split.barrier.total,
      targetToken: damageSourceToken(actor, options, context),
   })
   if (!result)
      return original.call(actor, nativeDamageFallbackOptions(actor, options))
   return original.call(actor, {
      ...options,
      shieldBlockRequest: false,
   })
}

async function applyGuardianReactiveBarrier(
   original,
   ally,
   options,
   context,
   guardian,
) {
   const split = templarActions.splitDamageContextForBarrier(
      guardian,
      context,
      {
         allowAllProtecting: true,
      },
   )
   if (!split.barrier?.total)
      return original.call(ally, nativeDamageFallbackOptions(ally, options))
   const result = await templarActions.reactiveBarrier({
      actor: guardian,
      damage: split.barrier.total,
   })
   if (!result)
      return original.call(ally, nativeDamageFallbackOptions(ally, options))
   const remainingEligible = templarActions.reduceDamageContextByAmount
      ? templarActions.reduceDamageContextByAmount(
           split.barrier,
           result.prevented ?? 0,
        )
      : {
           ...split.barrier,
           total: Math.max(0, split.barrier.total - (result.prevented ?? 0)),
        }
   const remaining = templarActions.mergeDamageContexts
      ? templarActions.mergeDamageContexts([
           remainingEligible,
           split.passthrough,
        ])
      : remainingEligible
   return applyContextDamage(original, ally, options, remaining, [
      `As Safe as Church (${guardian.name}) -${result.prevented ?? 0}`,
   ])
}

async function applyGuardianHoldingBarrier(
   original,
   ally,
   options,
   context,
   guardian,
) {
   const split = templarActions.splitDamageContextForBarrier(
      guardian,
      context,
      {
         allowAllProtecting: true,
      },
   )
   if (!split.barrier?.total)
      return original.call(ally, nativeDamageFallbackOptions(ally, options))
   const hasDefenseMaster = actorHasSlug(guardian, TEMPLAR_SLUGS.defenseMaster)
   const result = await templarActions.holdDamage({
      actor: guardian,
      damage: split.barrier.total,
      damageType: hasDefenseMaster ? split.barrier.damageType : "untyped",
      damageTypes: hasDefenseMaster ? split.barrier.damageTypes : ["untyped"],
      damageInstances: hasDefenseMaster ? split.barrier.damageInstances : null,
      rollData: hasDefenseMaster ? split.barrier.rollData : null,
      bypassIWR: !hasDefenseMaster,
      label: `Holding Barrier for ${ally.name}`,
   })
   if (!result)
      return original.call(ally, nativeDamageFallbackOptions(ally, options))
   return applyContextDamage(original, ally, options, split.passthrough)
}

async function applyAsSafeAsChurch(original, ally, options, context) {
   const guardianChoice = await templarActions.chooseAsSafeAsChurchReaction({
      ally,
      damageContext: context,
      protectedToken: options?.token ?? null,
      assumePhysical: Boolean(options?.shieldBlockRequest),
   })
   if (!guardianChoice) return null
   if (guardianChoice.reaction === "reactiveBarrier") {
      return applyGuardianReactiveBarrier(
         original,
         ally,
         options,
         context,
         guardianChoice.templar,
      )
   }
   if (guardianChoice.reaction === "holdingBarrier") {
      return applyGuardianHoldingBarrier(
         original,
         ally,
         options,
         context,
         guardianChoice.templar,
      )
   }
   return null
}

function findApplyDamageOwnerPrototype(seed) {
   let proto = seed
   while (proto) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, "applyDamage")
      if (typeof descriptor?.value === "function") return proto
      proto = Object.getPrototypeOf(proto)
   }
   return null
}

function findApplyDamagePrototypes() {
   const seeds = []
   const actors = Array.isArray(game.actors?.contents)
      ? game.actors.contents
      : Array.from(game.actors ?? [])
   for (const candidate of actors) {
      const actor = Array.isArray(candidate) ? candidate[1] : candidate
      if (typeof actor?.applyDamage === "function") {
         seeds.push(Object.getPrototypeOf(actor))
      }
   }
   if (CONFIG?.Actor?.documentClass?.prototype) {
      seeds.push(CONFIG.Actor.documentClass.prototype)
   }

   const prototypes = new Set()
   for (const seed of seeds) {
      const owner = findApplyDamageOwnerPrototype(seed)
      if (owner) prototypes.add(owner)
   }
   return [...prototypes]
}

function buildTemplarApplyDamageWrapper(original, hooks) {
   const wrapper = async function sscTemplarApplyDamage(options = {}) {
      const context = contextFromDamage(options.damage)
      if (context.total <= 0)
         return original.call(this, nativeDamageFallbackOptions(this, options))
      await hooks?.postAsSafeAsChurchPhysicalTipsForAlly?.(this, context)

      if (!shouldOfferTemplarBlock(this, options)) {
         if (options?.shieldBlockRequest && !options.final) {
            const protectedByTemplar = await applyAsSafeAsChurch(
               original,
               this,
               options,
               context,
            )
            if (protectedByTemplar) return protectedByTemplar
            if (!actorHasOrdinaryRaisedShield(this)) {
               return original.call(this, {
                  ...options,
                  shieldBlockRequest: false,
               })
            }
         }
         return original.call(this, nativeDamageFallbackOptions(this, options))
      }

      const choice = await templarActions.chooseBarrierReaction({
         actor: this,
         damageContext: context,
         allowShieldBlock: actorHasOrdinaryRaisedShield(this),
      })

      if (!choice) {
         return original.call(this, {
            ...options,
            shieldBlockRequest: actorHasOrdinaryRaisedShield(this)
               ? options.shieldBlockRequest
               : false,
         })
      }
      if (choice === "shieldBlock") return original.call(this, options)
      if (choice === "reactiveBarrier") {
         return applyReactiveBarrier(original, this, options, context)
      }
      if (choice === "refraction") {
         return applyRefractionReactiveBarrier(original, this, options, context)
      }
      if (choice === "holdingBarrier") {
         const passthrough = await applyHoldingBarrier(this, context)
         if (!passthrough)
            return original.call(
               this,
               nativeDamageFallbackOptions(this, options),
            )
         return applyContextDamage(original, this, options, passthrough)
      }
      if (choice === "lightBurst") {
         return applyLightBurst(original, this, options, context)
      }
      if (choice === "inculpation") {
         return applyInculpation(original, this, options, context)
      }
      return this
   }
   wrapper[DAMAGE_WRAPPER_MARK] = true
   wrapper._sscTemplarOriginal = original
   return wrapper
}

export function patchDamageApplication(hooks = {}) {
   const prototypes = findApplyDamagePrototypes()

   for (const proto of prototypes) {
      const current = proto?.applyDamage
      if (typeof current !== "function") continue
      if (current[DAMAGE_WRAPPER_MARK]) continue

      proto.applyDamage = buildTemplarApplyDamageWrapper(current, hooks)
   }

   return (
      prototypes.length > 0 &&
      prototypes.every((proto) => proto?.applyDamage?.[DAMAGE_WRAPPER_MARK])
   )
}

export function scheduleDamageApplicationPatch(hooks = {}) {
   patchDamageApplication(hooks)
   for (const delay of [100, 1000, 3000]) {
      setTimeout(() => patchDamageApplication(hooks), delay)
   }
}
