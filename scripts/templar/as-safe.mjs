import { TEMPLAR_SLUGS } from "./constants.mjs"
import {
   actorHasSlug,
   readTemplarState,
} from "./state.mjs"
import {
   actorTokenDocuments,
   getActorToken,
   tokenEdgeDistanceFeet,
} from "./tokens.mjs"
import {
   canUseReactiveOrHoldingAgainstDamage,
   damageContextHasExcludedBarrierDamage,
} from "./damage.mjs"
import { barrierAbilityAvailable } from "./barrier/state.mjs"
import { canUseTemplarReaction } from "./reactions.mjs"
import { currentUserShouldPromptActor } from "./actors.mjs"
import { debugTemplar } from "./debug.mjs"

export function targetedAdjacentAllyActor(actor) {
   if (!canvas?.ready || !actorHasSlug(actor, TEMPLAR_SLUGS.asSafeAsChurch)) {
      return null
   }
   const targets = Array.from(game.user?.targets ?? [])
   if (targets.length !== 1) return null
   const target = targets[0]
   const targetActor = target?.actor
   if (!targetActor || targetActor.id === actor.id) return null
   const origin = getActorToken(actor)
   const originObject = origin?.object ?? canvas?.tokens?.get?.(origin?.id)
   if (!originObject) return null
   const originDisposition = Number(
      origin?.disposition ?? originObject.document?.disposition ?? 0,
   )
   const targetDisposition = Number(target.document?.disposition ?? 0)
   if (
      originDisposition !== 0 &&
      targetDisposition !== 0 &&
      originDisposition !== targetDisposition
   ) {
      return null
   }
   return tokenEdgeDistanceFeet(originObject, target) <= 5 ? targetActor : null
}

export function adjacentAsSafeTemplars(
   ally,
   context,
   { protectedToken = null, assumePhysical = false } = {},
) {
   const debug = {
      ally: ally?.name,
      total: context?.total,
      damageTypes: context?.damageTypes ?? [context?.damageType],
      assumePhysical,
      canvasReady: Boolean(canvas?.ready),
      candidates: [],
   }
   if (!canvas?.ready) {
      debug.reason = "canvas-not-ready"
      debugTemplar("As Safe as Church candidates", debug)
      return []
   }
   const explicitTokenDocument = protectedToken?.document ?? protectedToken
   const allyTokens = explicitTokenDocument
      ? [explicitTokenDocument]
      : actorTokenDocuments(ally)
   const allyObjects = allyTokens
      .map(
         (token) => token?.object ?? canvas?.tokens?.get?.(token?.id) ?? token,
      )
      .filter(Boolean)
   if (!allyObjects.length) {
      debug.reason = "ally-token-not-found"
      debugTemplar("As Safe as Church candidates", debug)
      return []
   }
   const allyToken = allyTokens[0]
   const allyDisposition = Number(
      allyToken?.disposition ?? allyObjects[0]?.document?.disposition ?? 0,
   )

   const candidates = []
   const seen = new Set()
   for (const token of canvas.tokens?.placeables ?? []) {
      const actor = token.actor
      const entry = {
         token: token.name ?? token.document?.name,
         actor: actor?.name,
      }
      if (!actor) {
         entry.reason = "no-actor"
         debug.candidates.push(entry)
         continue
      }
      if (actor.id === ally?.id) {
         entry.reason = "same-actor-as-ally"
         debug.candidates.push(entry)
         continue
      }
      if (!actorHasSlug(actor, TEMPLAR_SLUGS.asSafeAsChurch)) {
         entry.reason = "missing-as-safe-as-church"
         debug.candidates.push(entry)
         continue
      }
      if (!actorHasSlug(actor, TEMPLAR_SLUGS.dedication)) {
         entry.reason = "missing-templar-dedication"
         debug.candidates.push(entry)
         continue
      }
      if (!canUseTemplarReaction(actor, { notify: false })) {
         entry.reason = "reaction-used"
         debug.candidates.push(entry)
         continue
      }
      if (!barrierAbilityAvailable(readTemplarState(actor))) {
         entry.reason = "barrier-unavailable"
         debug.candidates.push(entry)
         continue
      }
      if (
         !canUseReactiveOrHoldingAgainstDamage(actor, context, {
            assumePhysical,
         })
      ) {
         entry.reason = damageContextHasExcludedBarrierDamage(context)
            ? "persistent-or-precision-damage"
            : "damage-type-not-supported"
         entry.damageTypes = context?.damageTypes ?? [context?.damageType]
         debug.candidates.push(entry)
         continue
      }
      if (!currentUserShouldPromptActor(actor)) {
         entry.reason = "current-user-cannot-prompt-actor"
         debug.candidates.push(entry)
         continue
      }
      const disposition = Number(token.document?.disposition ?? 0)
      if (
         allyDisposition !== 0 &&
         disposition !== 0 &&
         disposition !== allyDisposition
      ) {
         entry.reason = "different-disposition"
         entry.allyDisposition = allyDisposition
         entry.disposition = disposition
         debug.candidates.push(entry)
         continue
      }
      const distance = Math.min(
         ...allyObjects.map((allyObject) =>
            tokenEdgeDistanceFeet(allyObject, token),
         ),
      )
      entry.distance = distance
      if (distance > 5) {
         entry.reason = "not-adjacent"
         debug.candidates.push(entry)
         continue
      }
      entry.reason = "eligible"
      debug.candidates.push(entry)
      const key = actor.uuid ?? actor.id
      if (!seen.has(key)) {
         seen.add(key)
         candidates.push(actor)
      }
   }
   debug.eligible = candidates.map((candidate) => candidate.name)
   debugTemplar("As Safe as Church candidates", debug)
   return candidates
}
