import { MODULE_ID, TEMPLAR_SLUGS } from "../constants.mjs"
import {
   actorHasSlug,
   canUseTemplarBarrier,
   readTemplarState,
   slugify,
} from "../state.mjs"
import { templarActions } from "../api.mjs"
import { barrierIsIntact } from "./damage-application.mjs"
import {
   currentUserCreatedMessage,
   isStrikeSpellOrEffectMessage,
   messageHasLightProtectsTrait,
} from "./messages.mjs"
import {
   actorsAdjacent,
   isPlayerOrPartyActor,
   messageTargetActors,
   privateRecipientsForActor,
   sameDisposition,
   shouldRunActorTip,
} from "./actors.mjs"

const PHYSICAL_DAMAGE_TYPES = new Set(["bludgeoning", "piercing", "slashing"])

export function blindingBladeDcFromMessage(message) {
   const content = String(message?.content ?? "")
   const dataDc = /data-dc=["']?(\d+)/i.exec(content)?.[1]
   if (dataDc) return dataDc
   const checkDc = /@Check\[[^\]]*?\bdc:(\d+)/i.exec(content)?.[1]
   if (checkDc) return checkDc
   return ""
}

export function shouldHandleSharedBlindingBladeMessage(message) {
   if (currentUserCreatedMessage(message)) return true
   const activeGm = game.users?.find?.((user) => user.active && user.isGM)
   if (activeGm) return game.user?.id === activeGm.id
   return false
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

export function getControlledTemplar(messageActor = null) {
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
export function canOfferProvidenceForMessage(message) {
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

export async function postAsSafeAsChurchPhysicalTipsForAlly(ally, context) {
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

export async function automateLightProtectsTip(message) {
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
