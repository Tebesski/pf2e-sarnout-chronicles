import {
   MODULE_ID,
   TEMPLAR_ASSETS,
   TEMPLAR_SLUGS,
} from "./constants.mjs"
import {
   actorHasSlug,
   canUseTemplarBarrier,
   readTemplarState,
   slugify,
} from "./state.mjs"
import {
   currentUserCreatedMessage,
   isAutomatedTemplarSpellSlug,
   isDamageRollMessage,
   isStrikeSpellOrEffectMessage,
   messageActionType,
   messageActionsValue,
   messageActor,
   messageActorDocument,
   messageFromElement,
   messageHasItemContext,
   messageHasLightProtectsTrait,
   messageItemIdentity,
   messageItemSlug,
   messageItemType,
   messageOutcomeDegree,
   messagePrimaryItem,
   messageSaveStatistic,
   resolveMessageIdFromLi,
} from "./chat/messages.mjs"
import {
   actorsAdjacent,
   isPlayerOrPartyActor,
   messageTargetActors,
   privateRecipientsForActor,
   sameDisposition,
   shouldRunActorTip,
} from "./chat/actors.mjs"
import { playTemplarSound } from "./chat/sounds.mjs"
import { damageContextFromRoll, templarActions } from "./api.mjs"
import { actorHasOrdinaryRaisedShield } from "./items.mjs"
import { debugTemplar } from "./debug.mjs"

let damageWrapped = false
let contextWrapped = false
let spellToMessageWrapped = false
let toolbeltProvidenceInstalled = false
let toolbeltProvidenceObserver = null
let lastToolbeltProvidenceContext = null
const automatedSpellMessages = new Set()
const automatedActionMessages = new Set()
const templarLightMessages = new Set()
const asSafeAsChurchPhysicalTips = new Set()
const toolbeltProvidenceDialogContexts = new WeakMap()
const PHYSICAL_DAMAGE_TYPES = new Set(["bludgeoning", "piercing", "slashing"])
const DAMAGE_WRAPPER_MARK = "_sscTemplarWrapped"

function blindingBladeDcFromMessage(message) {
   const content = String(message?.content ?? "")
   const dataDc = /data-dc=["']?(\d+)/i.exec(content)?.[1]
   if (dataDc) return dataDc
   const checkDc = /@Check\[[^\]]*?\bdc:(\d+)/i.exec(content)?.[1]
   if (checkDc) return checkDc
   return ""
}

function shouldHandleSharedBlindingBladeMessage(message) {
   if (currentUserCreatedMessage(message)) return true
   const activeGm = game.users?.find?.((user) => user.active && user.isGM)
   if (activeGm) return game.user?.id === activeGm.id
   return false
}

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

function damageContextIsPhysicalBarrierDamage(context) {
   const instances = Array.isArray(context?.damageInstances)
      ? context.damageInstances
      : [
           {
              type: context?.damageType,
              persistent: context?.hasPersistentDamage,
              precision: context?.hasPrecisionDamage,
           },
        ]
   return instances.some((instance) => {
      if (instance?.persistent || instance?.precision) return false
      return PHYSICAL_DAMAGE_TYPES.has(slugify(instance?.type))
   })
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

function barrierIsIntact(actor) {
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
   if (!guardianChoice) {
      return null
   }
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

function applyDamagePrototypeLabel(proto) {
   return (
      proto?.constructor?.name ??
      Object.getPrototypeOf(proto)?.constructor?.name ??
      "ActorPrototype"
   )
}

function buildTemplarApplyDamageWrapper(original) {
   const wrapper = async function sscTemplarApplyDamage(options = {}) {
      const context = contextFromDamage(options.damage)
      if (context.total <= 0)
         return original.call(this, nativeDamageFallbackOptions(this, options))
      await postAsSafeAsChurchPhysicalTipsForAlly(this, context)

      if (options?.shieldBlockRequest && !options.final) {
         debugTemplar("Templar damage block request", {
            actor: this?.name,
            actorType: this?.type,
            damageTotal: context.total,
            canUseBarrier: canUseTemplarBarrier(this),
            barrierIntact: barrierIsIntact(this),
            ordinaryRaisedShield: actorHasOrdinaryRaisedShield(this),
            originalApplyDamage: original.name || "anonymous",
         })
      }

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

function patchDamageApplication(reason = "unspecified") {
   const prototypes = findApplyDamagePrototypes()
   let installed = 0
   let active = 0

   for (const proto of prototypes) {
      const current = proto?.applyDamage
      if (typeof current !== "function") continue
      if (current[DAMAGE_WRAPPER_MARK]) {
         active += 1
         continue
      }

      proto.applyDamage = buildTemplarApplyDamageWrapper(current)
      installed += 1
      active += 1
      debugTemplar("Templar damage wrapper installed", {
         reason,
         prototype: applyDamagePrototypeLabel(proto),
         wrapped: current.name || "anonymous",
      })
   }

   damageWrapped =
      prototypes.length > 0 &&
      prototypes.every((proto) => proto?.applyDamage?.[DAMAGE_WRAPPER_MARK])

   if (prototypes.length === 0) {
      debugTemplar("Templar damage wrapper not installed", {
         reason,
         reasonDetail: "No applyDamage prototype found",
      })
   } else if (installed === 0) {
      debugTemplar("Templar damage wrapper already active", {
         reason,
         prototypes: prototypes.map(applyDamagePrototypeLabel),
         active,
      })
   }

   return damageWrapped
}

function scheduleDamageApplicationPatch(reason) {
   patchDamageApplication(reason)
   for (const delay of [100, 1000, 3000]) {
      setTimeout(() => patchDamageApplication(`${reason}+${delay}ms`), delay)
   }
}

function getControlledTemplar(messageActor = null) {
   if (messageActor && actorHasSlug(messageActor, TEMPLAR_SLUGS.providence))
      return messageActor
   const controlled = canvas?.tokens?.controlled ?? []
   const token = controlled.find((t) =>
      actorHasSlug(t.actor, TEMPLAR_SLUGS.providence),
   )
   if (token) return token.actor
   const character = game.user?.character
   if (character && actorHasSlug(character, TEMPLAR_SLUGS.providence))
      return character
   return null
}

function isFailedSavingThrowMessage(message) {
   if (!message) return false
   const context = message.flags?.pf2e?.context ?? {}
   if (context.type !== "saving-throw") return false

   const roll = message.rolls?.[0]
   const candidates = [
      roll?.degreeOfSuccess,
      roll?.options?.degreeOfSuccess,
      context.outcome,
      context.degreeOfSuccess,
   ]

   for (const candidate of candidates) {
      const num = Number(candidate)
      if (Number.isFinite(num)) return num <= 1

      const str = String(candidate ?? "").toLowerCase()
      if (str.includes("failure")) return true
      if (str.includes("success")) return false
   }
   return false
}
function canOfferProvidenceForMessage(message) {
   if (!isFailedSavingThrowMessage(message)) return false

   const messageActor =
      message?.actor ??
      message?.token?.actor ??
      game.actors?.get(message?.speaker?.actor)
   const templar = getControlledTemplar(messageActor)

   if (!templar) return false

   const focus = templar.system?.resources?.focus
   const currentFocus = Number(focus?.value ?? focus?.points ?? 0)
   if (currentFocus <= 0) return false

   const state = readTemplarState(templar)
   if (!state) return false

   const isIntact =
      (state.light?.value > 0 &&
         !state.light?.broken &&
         !state.light?.breaking) ||
      (state.brilliantShard?.active && !state.brilliantShard?.broken)

   if (!isIntact) return false

   return true
}
function allLightProtectsTemplars() {
   const actors = new Map()
   for (const token of canvas?.tokens?.placeables ?? []) {
      const actor = token.actor
      if (actor?.id) actors.set(actor.uuid ?? actor.id, actor)
   }
   for (const actor of game.actors ?? []) {
      if (actor?.id) actors.set(actor.uuid ?? actor.id, actor)
   }
   return [...actors.values()].filter((actor) => {
      return (
         actorHasSlug(actor, TEMPLAR_SLUGS.lightProtects) &&
         canUseTemplarBarrier(actor) &&
         isPlayerOrPartyActor(actor) &&
         shouldRunActorTip(actor)
      )
   })
}

function lightProtectsTipBody(templar, protectedActor, { ally = false } = {}) {
   const reactionSpent = templarActions.hasTemplarReactionUsed?.(templar)
   const barrierAvailable = barrierIsIntact(templar)
   const shellAvailable = !reactionSpent && barrierAvailable
   const reactiveAvailable = !reactionSpent && barrierAvailable
   const targetText = ally
      ? `${protectedActor.name} is adjacent to you and is being targeted by an unholy, shadow, or darkness effect.`
      : "You are being targeted by an unholy, shadow, or darkness effect."
   const shellText = shellAvailable
      ? "You can use your Light Shell against this."
      : reactionSpent
        ? "You cannot use your Light Shell, your Templar reaction is already spent."
        : "You cannot use your Light Shell, your barrier is unavailable."
   const reactiveText = reactiveAvailable
      ? "You can use Reactive Barrier if the effect deals physical damage."
      : reactionSpent
        ? "You cannot use Reactive Barrier, your Templar reaction is already spent."
        : "You cannot use Reactive Barrier, your barrier is unavailable."
   const button = shellAvailable
      ? `<p><button type="button" data-templar-light-shell data-actor-uuid="${templar.uuid}" data-target-uuid="${protectedActor.uuid ?? ""}"><i class="fa-solid fa-shield-halved"></i> Use Light Shell</button></p>`
      : ""
   return `${targetText}<hr>${shellText}<hr>${reactiveText}${button}`
}

async function postLightProtectsTip(
   templar,
   protectedActor,
   { ally = false } = {},
) {
   const reactionSpent = templarActions.hasTemplarReactionUsed?.(templar)
   if (reactionSpent || !barrierIsIntact(templar)) return
   await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: templar }),
      flags: {
         [MODULE_ID]: {
            templarMessage: true,
            templarLightProtectsTip: true,
         },
      },
      content: `<div class="pf2e chat-card item-card ssc-templar-tip-card">
         <header class="card-header flexrow">
            <img src="modules/${MODULE_ID}/assets/templar/icons/light-shell.png" alt="">
            <h3>Light Protects</h3>
         </header>
         <div class="card-content">${lightProtectsTipBody(templar, protectedActor, { ally })}</div>
      </div>`,
   })
}

function safeAsChurchTipKey(templar, ally, context) {
   const round = game.combat?.round ?? 0
   const turn = game.combat?.turn ?? 0
   const types = (context?.damageTypes ?? [context?.damageType]).join(",")
   return [
      templar.uuid ?? templar.id,
      ally.uuid ?? ally.id,
      round,
      turn,
      context?.total ?? 0,
      types,
   ].join("|")
}

function safeAsChurchPhysicalTipBody(templar, ally) {
   const canHold = actorHasSlug(templar, TEMPLAR_SLUGS.holdingBarrier)
   const canShell =
      actorHasSlug(templar, TEMPLAR_SLUGS.lightShell) ||
      actorHasSlug(templar, TEMPLAR_SLUGS.lightProtects)
   const options = [
      "Light Barrier (Reactive Barrier)",
      canHold ? "Holding Barrier" : "",
      canShell ? "Light Shell" : "",
   ]
      .filter(Boolean)
      .join(", ")
   const shellButton = canShell
      ? `<p><button type="button" data-templar-light-shell data-actor-uuid="${templar.uuid}" data-target-uuid="${ally.uuid ?? ""}"><i class="fa-solid fa-shield-halved"></i> Use Light Shell</button></p>`
      : ""
   return `${ally.name} is adjacent to you and is being hit by physical damage.<hr>You can use ${options} on that ally.${shellButton}`
}

async function postAsSafeAsChurchPhysicalTip(templar, ally, context) {
   if (!templar || !ally) return
   if (templarActions.hasTemplarReactionUsed?.(templar)) return
   if (!barrierIsIntact(templar)) return
   const key = safeAsChurchTipKey(templar, ally, context)
   if (asSafeAsChurchPhysicalTips.has(key)) return
   asSafeAsChurchPhysicalTips.add(key)
   await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: templar }),
      whisper: privateRecipientsForActor(templar),
      flags: {
         [MODULE_ID]: {
            templarMessage: true,
            templarSafeAsChurchTip: true,
         },
      },
      content: `<div class="pf2e chat-card item-card ssc-templar-tip-card">
         <header class="card-header flexrow">
            <img src="modules/${MODULE_ID}/assets/templar/icons/reactive.png" alt="">
            <h3>As Safe as Church</h3>
         </header>
         <div class="card-content">${safeAsChurchPhysicalTipBody(templar, ally)}</div>
      </div>`,
   })
}

async function postAsSafeAsChurchPhysicalTipsForAlly(ally, context) {
   if (!ally || !damageContextIsPhysicalBarrierDamage(context)) return
   if (!isPlayerOrPartyActor(ally)) return
   const candidates = new Map()
   for (const token of canvas?.tokens?.placeables ?? []) {
      if (token.actor?.id)
         candidates.set(token.actor.uuid ?? token.actor.id, token.actor)
   }
   for (const actor of game.actors ?? []) {
      if (actor?.id) candidates.set(actor.uuid ?? actor.id, actor)
   }
   for (const candidate of candidates.values()) {
      if (!actorHasSlug(candidate, TEMPLAR_SLUGS.asSafeAsChurch)) continue
      if (!canUseTemplarBarrier(candidate)) continue
      if (!isPlayerOrPartyActor(candidate)) continue
      if (!shouldRunActorTip(candidate)) continue
      if (candidate.id === ally.id) continue
      if (!sameDisposition(candidate, ally)) continue
      if (!actorsAdjacent(candidate, ally)) continue
      await postAsSafeAsChurchPhysicalTip(candidate, ally, context)
   }
}

async function automateLightProtectsTip(message) {
   if (message?.flags?.[MODULE_ID]?.templarMessage) return
   if (!messageHasLightProtectsTrait(message)) return
   if (!isStrikeSpellOrEffectMessage(message)) return
   const targets = await messageTargetActors(message)
   if (!targets.length) return
   for (const templar of allLightProtectsTemplars()) {
      for (const target of targets) {
         if (!isPlayerOrPartyActor(target)) continue
         if (target.id === templar.id) {
            await postLightProtectsTip(templar, templar)
            continue
         }
         if (
            actorHasSlug(templar, TEMPLAR_SLUGS.asSafeAsChurch) &&
            sameDisposition(templar, target) &&
            actorsAdjacent(templar, target)
         ) {
            await postLightProtectsTip(templar, target, { ally: true })
         }
      }
   }
}

function slugMatches(slug, slugs) {
   const wanted = new Set(slugs.map(slugify))
   return wanted.has(slugify(slug))
}

function isSpellUseMessage(message) {
   if (!message?.id || !currentUserCreatedMessage(message)) return false
   if (message.flags?.[MODULE_ID]?.templarMessage) return false
   if (message.rolls?.length) return false
   const slug = messageItemSlug(message)
   if (!slug) return false
   const type = messageItemType(message)
   const contextType = message?.flags?.pf2e?.context?.type
   const looksLikeSpell =
      type === "spell" || String(contextType ?? "").startsWith("spell")
   if (slugMatches(slug, TEMPLAR_SLUGS.blindingBlade) && !looksLikeSpell)
      return false
   if (isAutomatedTemplarSpellSlug(slug)) {
      return looksLikeSpell || messageHasItemContext(message)
   }
   return looksLikeSpell
}

function isBlindingBladeActionMessage(message) {
   if (!message?.id) return false
   if (message.flags?.[MODULE_ID]?.templarMessage) return false
   if (message.rolls?.length) return false
   const slug = messageItemSlug(message)
   if (!slugMatches(slug, TEMPLAR_SLUGS.blindingBlade)) return false

   const type = messageItemType(message)
   const contextType = String(message?.flags?.pf2e?.context?.type ?? "")
   const actionType = messageActionType(message)
   const primary = messagePrimaryItem(message)
   const automatedFlag =
      primary?.flags?.[MODULE_ID]?.automatedTemplarAction ??
      message?.flags?.[MODULE_ID]?.automatedTemplarAction
   const looksLikeSpell =
      type === "spell" || String(contextType ?? "").startsWith("spell")
   const isAction =
      type === "action" ||
      contextType.startsWith("action") ||
      ["action", "free", "reaction"].includes(actionType) ||
      automatedFlag === "blindingBlade" ||
      (!looksLikeSpell && messageHasItemContext(message))

   return isAction
}

function isTemplarLightUseMessage(message) {
   if (!message?.id || !currentUserCreatedMessage(message)) return false
   if (message.flags?.[MODULE_ID]?.templarMessage) return false
   if (message.rolls?.length) return false
   if (!messageHasItemContext(message)) return false

   const type = messageItemType(message)
   const contextType = String(message?.flags?.pf2e?.context?.type ?? "")
   if (type === "spell" || contextType.startsWith("spell")) return true
   if (type === "action" || contextType.startsWith("action")) return true

   const actionType = messageActionType(message)
   if (["action", "free", "reaction"].includes(actionType)) return true
   if (type === "feat" && actionType && actionType !== "passive") return true

   return type === "feat" && messageActionsValue(message) !== null
}

async function automateTemplarSpellMessage(message) {
   if (!isSpellUseMessage(message)) return
   if (automatedSpellMessages.has(message.id)) return
   const actor = messageActorDocument(message)
   if (!actor) return
   const slug = messageItemSlug(message)
   await automateTemplarSpellCast({ actor, slug, message })
}

async function automateTemplarActionMessage(message) {
   if (!isBlindingBladeActionMessage(message)) return
   const shouldHandle = shouldHandleSharedBlindingBladeMessage(message)
   if (!shouldHandle) return
   if (automatedActionMessages.has(message.id)) return
   automatedActionMessages.add(message.id)
   const actor = messageActorDocument(message)
   const dc = blindingBladeDcFromMessage(message)
   const targets = Array.from(game.user?.targets ?? [])
   await playTemplarSound(TEMPLAR_ASSETS.blindingBladeSound, 1, true)
   if (message.getFlag?.(MODULE_ID, "blindingBladeCardEnhanced")) return
   try {
      await templarActions.postBlindingBladeUseCard({
         actor,
         dc,
         message,
         targets,
      })
   } catch (_error) {
      undefined
   }
}

async function automateTemplarLightUse(message) {
   if (!isTemplarLightUseMessage(message)) return
   if (templarLightMessages.has(message.id)) return
   const actor = messageActorDocument(message)
   if (!actor || !canUseTemplarBarrier(actor)) return
   templarLightMessages.add(message.id)
   await templarActions.emitTemplarLight(actor)
}

function spellItemSlug(item) {
   return slugify(item?.slug ?? item?.system?.slug ?? item?.name)
}

async function automateTemplarSpellCast({ actor, slug, message = null } = {}) {
   if (!actor || !isAutomatedTemplarSpellSlug(slug)) return false
   if (message?.id && automatedSpellMessages.has(message.id)) return true
   const run = async (slugs, callback) => {
      if (!slugMatches(slug, slugs)) return false
      if (message?.id) automatedSpellMessages.add(message.id)
      await callback()
      return true
   }

   return (
      (await run(TEMPLAR_SLUGS.repentance, () =>
         templarActions.repentance({
            actor,
            spendFocus: false,
            fromSpellMessage: true,
         }),
      )) ||
      (await run(TEMPLAR_SLUGS.brilliantShard, () =>
         templarActions.brilliantShard({
            actor,
            spendFocus: false,
            fromSpellMessage: true,
         }),
      )) ||
      (await run(TEMPLAR_SLUGS.providence, () =>
         templarActions.providence({
            actor,
            spendFocus: false,
            fromSpellMessage: true,
         }),
      )) ||
      (await run(TEMPLAR_SLUGS.advent, () =>
         templarActions.advent({
            actor,
            spendFocus: false,
            fromSpellMessage: true,
         }),
      )) ||
      (await run(TEMPLAR_SLUGS.lastStronghold, () =>
         templarActions.lastStronghold({
            actor,
            spendFocus: false,
            fromSpellMessage: true,
         }),
      )) ||
      (await run(TEMPLAR_SLUGS.scutumFidei, () =>
         templarActions.scutumFidei({
            actor,
            spendFocus: false,
            fromSpellMessage: true,
         }),
      )) ||
      (await run(TEMPLAR_SLUGS.heatLightning, () =>
         templarActions.heatLightning({ actor, confirm: false }),
      )) ||
      (await run(TEMPLAR_SLUGS.refraction, () =>
         templarActions.refraction({ actor }),
      )) ||
      (await run(TEMPLAR_SLUGS.flagellation, () =>
         templarActions.flagellation({ actor, fromSpellMessage: true }),
      )) ||
      (await run(TEMPLAR_SLUGS.lightGaol, () =>
         templarActions.lightGaol({
            actor,
            spendFocus: false,
            fromSpellMessage: true,
         }),
      )) ||
      (await run(TEMPLAR_SLUGS.blindingBlade, () =>
         templarActions.blindingBlade({ actor, fromSpellMessage: true }),
      ))
   )
}

function patchSpellToMessage() {
   if (spellToMessageWrapped) return
   const proto = CONFIG?.PF2E?.Item?.documentClasses?.spell?.prototype
   const original = proto?.toMessage
   if (typeof original !== "function" || original._sscTemplarWrapped) return

   spellToMessageWrapped = true
   proto.toMessage = async function sscTemplarSpellToMessage(
      event,
      options = {},
   ) {
      const message = await original.call(this, event, options)
      if (message && (options?.create ?? true) !== false) {
         const actor = this.actor ?? messageActorDocument(message)
         const slug = spellItemSlug(this) || messageItemSlug(message)
         void automateTemplarSpellCast({ actor, slug, message })
      }
      return message
   }
   proto.toMessage._sscTemplarWrapped = true
}

async function automateScorchingReprisalDamageMessage(message) {
   if (!isDamageRollMessage(message)) return
   const actor = messageActorDocument(message)
   if (!actor) return
   if (!shouldRunActorTip(actor)) return
   await templarActions.handleScorchingReprisalDamage({
      actor,
      ...messageItemIdentity(message),
   })
}

function patchChatContextMenu() {
   if (contextWrapped) return
   contextWrapped = true

   const proto = CONFIG?.ui?.chat?.prototype
   const original = proto?._getEntryContextOptions

   // Patch prototype like in consequence-cards to ensure it bypasses any module conflicts
   if (typeof original === "function") {
      proto._getEntryContextOptions = function (...args) {
         const options = original.apply(this, args)
         if (!Array.isArray(options)) return options

         // The critical fix: Foundry V14 uses 'visible', V13 uses 'condition'
         const gateKey =
            (game.release?.generation ?? 13) >= 14 ? "visible" : "condition"

         const providenceOption = {
            name: "Reroll using Providence",
            icon: '<i class="fa-solid fa-sun fa-fw"></i>',
            callback: async (li) => {
               const messageId = resolveMessageIdFromLi(li)
               const message = game.messages?.get(messageId)
               const messageActor =
                  message?.actor ??
                  message?.token?.actor ??
                  game.actors?.get(message?.speaker?.actor)
               const templar = getControlledTemplar(messageActor)

               if (templar) {
                  await templarActions.providence({ actor: templar, message })
               }
            },
         }

         providenceOption[gateKey] = (li) => {
            const messageId = resolveMessageIdFromLi(li)
            const message = game.messages?.get(messageId)
            return canOfferProvidenceForMessage(message)
         }

         options.push(providenceOption)
         return options
      }
   } else {
      // Fallback to Hook approach if the UI prototype isn't ready
      Hooks.on("getChatLogEntryContext", (html, options) => {
         options.push({
            name: "Reroll using Providence",
            icon: '<i class="fa-solid fa-sun fa-fw"></i>',
            // Provide BOTH properties to ensure backwards and forwards compatibility natively
            condition: (li) => {
               const messageId = resolveMessageIdFromLi(li)
               return canOfferProvidenceForMessage(
                  game.messages?.get(messageId),
               )
            },
            visible: (li) => {
               const messageId = resolveMessageIdFromLi(li)
               return canOfferProvidenceForMessage(
                  game.messages?.get(messageId),
               )
            },
            callback: async (li) => {
               const messageId = resolveMessageIdFromLi(li)
               const message = game.messages?.get(messageId)
               const messageActor =
                  message?.actor ??
                  message?.token?.actor ??
                  game.actors?.get(message?.speaker?.actor)
               const templar = getControlledTemplar(messageActor)

               if (templar) {
                  await templarActions.providence({ actor: templar, message })
               }
            },
         })
      })
   }
}

function actorUuid(actor) {
   return actor?.uuid ?? actor?.id ?? null
}

function actorFromDocument(document) {
   return (
      document?.actor ??
      document?.parent?.actor ??
      document?.parent ??
      document ??
      null
   )
}

function actorFromUuidSync(uuid) {
   if (!uuid) return null
   const document = globalThis.fromUuidSync?.(uuid)
   const actor = actorFromDocument(document)
   return actor?.system ? actor : null
}

function collectTargetUuids(value, out = [], targetScope = false) {
   if (!value) return out
   if (typeof value === "string") {
      if (targetScope && /^(?:Scene|Actor)\./.test(value)) out.push(value)
      return out
   }
   if (Array.isArray(value)) {
      for (const entry of value) collectTargetUuids(entry, out, targetScope)
      return out
   }
   if (typeof value !== "object") return out

   for (const [key, entry] of Object.entries(value)) {
      const slug = slugify(key)
      const childTargetScope =
         targetScope ||
         slug === "targets" ||
         slug === "splashtargets" ||
         slug === "targetuuid" ||
         slug === "targetuuids"
      if (childTargetScope || (typeof entry === "object" && entry !== null)) {
         collectTargetUuids(entry, out, childTargetScope)
      }
   }
   return out
}

function toolbeltRerollActorFromButton(button, message) {
   const row = button?.closest?.(".target-row")
   const rows = Array.from(
      row?.parentElement?.querySelectorAll?.(":scope > .target-row") ?? [],
   )
   const rowIndex = rows.indexOf(row)
   const targetUuids = collectTargetUuids(message?.flags)
   const actorFromFlag = actorFromUuidSync(targetUuids[rowIndex])
   if (actorFromFlag?.system) return actorFromFlag

   const rowName = row
      ?.querySelector?.(".name")
      ?.textContent?.replace(/\s+/g, " ")
      ?.trim()
   const controlledTemplar = canvas?.tokens?.controlled?.find?.((token) =>
      actorHasSlug(token.actor, TEMPLAR_SLUGS.providence),
   )?.actor
   if (!rowName) return controlledTemplar ?? null
   const candidates = canvas?.tokens?.placeables ?? []
   const token = candidates.find((candidate) => {
      const actor = candidate.actor
      return (
         actorHasSlug(actor, TEMPLAR_SLUGS.providence) &&
         (candidate.name === rowName || actor?.name === rowName)
      )
   })
   return token?.actor ?? controlledTemplar ?? null
}

function rememberToolbeltProvidenceContext(event) {
   const button = event.target?.closest?.("[data-action='reroll-save']")
   if (!button) return
   const message = messageFromElement(button)
   const actor = toolbeltRerollActorFromButton(button, message)
   if (!actor || !actorHasSlug(actor, TEMPLAR_SLUGS.providence)) {
      lastToolbeltProvidenceContext = null
      return
   }
   lastToolbeltProvidenceContext = {
      actor,
      message,
      actorUuid: actorUuid(actor),
      messageId: message?.id ?? null,
      createdAt: Date.now(),
   }
}

function activeToolbeltProvidenceContext(maxAgeMs = 15_000) {
   const context = lastToolbeltProvidenceContext
   if (!context || Date.now() - context.createdAt > maxAgeMs) return null
   const actor = context.actor ?? actorFromUuidSync(context.actorUuid)
   const message = context.messageId
      ? game.messages?.get?.(context.messageId)
      : context.message
   if (!actor || !actorHasSlug(actor, TEMPLAR_SLUGS.providence)) return null
   return { actor, message }
}

function handleToolbeltProvidenceClick(event) {
   const button = event.target.closest(
      "button[type='submit'], button[data-action='ok'], button[data-action='apply']",
   )
   if (!button) return
   const dialog = button.closest(
      "dialog.pf2e-toolbelt.reroll, .application.dialog.reroll.pf2e-toolbelt",
   )
   if (!dialog) return
   const form = dialog.querySelector("form")
   const selected = form?.querySelector("input[name='reroll']:checked")
   if (selected?.dataset?.providence !== "true") return

   const context =
      toolbeltProvidenceDialogContexts.get(dialog) ??
      activeToolbeltProvidenceContext()
   if (!context) return

   const success = templarActions.prepareProvidenceReroll({
      actor: context.actor,
      applyBonus: true,
      spendFocus: true,
   })

   if (!success) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
   }

   void templarActions.spendFocusPoint(context.actor, 1)

   setTimeout(() => {
      void templarActions.completeProvidenceReroll({
         actor: context.actor,
         message: context.message,
         spendFocus: false,
      })
   }, 1000)
}

function injectProvidenceToolbeltDialogs() {
   if (!game.modules?.get?.("pf2e-toolbelt")?.active) return
   for (const dialog of document.querySelectorAll(
      "dialog.pf2e-toolbelt.reroll, .application.dialog.reroll.pf2e-toolbelt",
   )) {
      if (dialog.dataset.sscProvidenceInjected) continue
      const context = activeToolbeltProvidenceContext()
      if (!context) continue
      const form = dialog.querySelector("form")
      const content = dialog.querySelector(".dialog-content") ?? form
      if (!form || !content) continue

      if (dialog.querySelector("input[name='reroll'][data-providence='true']"))
         continue

      const option = document.createElement("label")
      option.classList.add("ssc-providence-reroll-option")

      const focus = context.actor?.system?.resources?.focus
      const hasFocus = Number(focus?.value ?? focus?.points ?? 0) > 0

      option.innerHTML = `
         <input type="radio" name="reroll" value="new" data-providence="true"${hasFocus ? "" : " disabled"}>
         <i class="fa-solid fa-sun"></i> Reroll using Providence
      `
      const heroOption = content
         .querySelector("input[name='reroll'][value='hero']")
         ?.closest("label")
      if (heroOption) heroOption.after(option)
      else content.prepend(option)

      dialog.addEventListener("click", handleToolbeltProvidenceClick, {
         capture: true,
      })
      toolbeltProvidenceDialogContexts.set(dialog, context)
      dialog.dataset.sscProvidenceInjected = "true"
   }
}

function installToolbeltProvidenceReroll() {
   if (toolbeltProvidenceInstalled) return
   if (!game.modules?.get?.("pf2e-toolbelt")?.active) return
   toolbeltProvidenceInstalled = true
   document.addEventListener("click", rememberToolbeltProvidenceContext, true)
   document.addEventListener(
      "contextmenu",
      rememberToolbeltProvidenceContext,
      true,
   )
   toolbeltProvidenceObserver = new MutationObserver(() =>
      injectProvidenceToolbeltDialogs(),
   )
   toolbeltProvidenceObserver.observe(document.body, {
      childList: true,
      subtree: true,
   })
}

function installTemplarChatButtonListeners() {
   if (installTemplarChatButtonListeners.installed) return
   installTemplarChatButtonListeners.installed = true
   document.addEventListener("click", (event) => {
      const lightShell = event.target.closest?.("[data-templar-light-shell]")
      if (lightShell) {
         event.preventDefault()
         void (async () => {
            const actor =
               globalThis.fromUuidSync?.(lightShell.dataset.actorUuid) ||
               (lightShell.dataset.actorUuid
                  ? await fromUuid(lightShell.dataset.actorUuid).catch(
                       () => null,
                    )
                  : null)
            const target =
               globalThis.fromUuidSync?.(lightShell.dataset.targetUuid) ||
               (lightShell.dataset.targetUuid
                  ? await fromUuid(lightShell.dataset.targetUuid).catch(
                       () => null,
                    )
                  : null)
            await templarActions.lightShell({
               actor,
               targetActor: target?.actor ?? target,
               spendFocus: false,
            })
         })()
         return
      }

      const lightBurstSave = event.target.closest?.(
         "[data-templar-light-burst-save]",
      )
      if (lightBurstSave) {
         event.preventDefault()
         const messageId =
            lightBurstSave.closest?.(".message")?.dataset?.messageId
         void templarActions.rollLightBurstSaveFromCard({
            targetUuid: lightBurstSave.dataset.targetUuid,
            messageId,
         })
         return
      }

      const lightGaolSave = event.target.closest?.(
         "[data-templar-light-gaol-save]",
      )
      if (lightGaolSave) {
         event.preventDefault()
         void templarActions.rollLightGaolSaveFromCard({
            targetUuid: lightGaolSave.dataset.targetUuid,
            dc: lightGaolSave.dataset.dc,
            saveType: lightGaolSave.dataset.templarLightGaolSave,
         })
         return
      }

      const blindingBladeSave = event.target.closest?.(
         "[data-templar-blinding-blade-save]",
      )
      if (blindingBladeSave) {
         event.preventDefault()
         const targeted = Array.from(game.user?.targets ?? [])[0]
         const targetUuid =
            blindingBladeSave.dataset.targetUuid ||
            targeted?.document?.uuid ||
            targeted?.uuid ||
            null
          void templarActions.rollBlindingBladeSaveFromCard({
             targetUuid,
             dc: blindingBladeSave.dataset.dc,
         })
         return
      }

      const pingTarget = event.target.closest?.(
         "[data-action='atw-ping-target']",
      )
      if (pingTarget) {
         event.preventDefault()
         const row = pingTarget.closest?.("[data-target-uuid]")
         const uuid = row?.dataset?.targetUuid
         void (async () => {
            const doc =
               globalThis.fromUuidSync?.(uuid) ||
               (uuid ? await fromUuid(uuid).catch(() => null) : null)
            const object = doc?.object ?? canvas?.tokens?.get?.(doc?.id)
            const center = object?.center ?? {
               x:
                  Number(doc?.x ?? 0) +
                  (Number(doc?.width ?? 1) * (canvas?.grid?.size ?? 100)) / 2,
               y:
                  Number(doc?.y ?? 0) +
                  (Number(doc?.height ?? 1) * (canvas?.grid?.size ?? 100)) / 2,
            }
            if (Number.isFinite(center.x) && Number.isFinite(center.y)) {
               await canvas?.animatePan?.({ x: center.x, y: center.y })
               canvas?.ping?.(center)
            }
         })()
      }
   })
}

export function registerTemplarChatAutomation() {
   patchChatContextMenu()
   Hooks.once("ready", () => {
      scheduleDamageApplicationPatch("ready")
      patchSpellToMessage()
      installTemplarChatButtonListeners()
      installToolbeltProvidenceReroll()
      Hooks.on("createActor", () => patchDamageApplication("createActor"))
      Hooks.on("canvasReady", () => patchDamageApplication("canvasReady"))
      Hooks.on("createChatMessage", (message) => {
         void automateTemplarLightUse(message)
         void automateTemplarSpellMessage(message)
         void automateTemplarActionMessage(message)
         void automateScorchingReprisalDamageMessage(message)
         void automateLightProtectsTip(message)
      })
      Hooks.callAll(`${MODULE_ID}.chatAutomationReady`)
   })
}
