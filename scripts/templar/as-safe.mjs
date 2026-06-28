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
import { canUseReactiveOrHoldingAgainstDamage } from "./damage.mjs"
import { barrierAbilityAvailable } from "./barrier/state.mjs"
import { canUseTemplarReaction } from "./reactions.mjs"
import { currentUserShouldPromptActor } from "./actors.mjs"

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
   if (!canvas?.ready) return []
   const explicitTokenDocument = protectedToken?.document ?? protectedToken
   const allyTokens = explicitTokenDocument
      ? [explicitTokenDocument]
      : actorTokenDocuments(ally)
   const allyObjects = allyTokens
      .map(
         (token) => token?.object ?? canvas?.tokens?.get?.(token?.id) ?? token,
      )
      .filter(Boolean)
   if (!allyObjects.length) return []
   const allyToken = allyTokens[0]
   const allyDisposition = Number(
      allyToken?.disposition ?? allyObjects[0]?.document?.disposition ?? 0,
   )

   const candidates = []
   const seen = new Set()
   for (const token of canvas.tokens?.placeables ?? []) {
      const actor = token.actor
      if (!actor) continue
      if (actor.id === ally?.id) continue
      if (!actorHasSlug(actor, TEMPLAR_SLUGS.asSafeAsChurch)) continue
      if (!actorHasSlug(actor, TEMPLAR_SLUGS.dedication)) continue
      if (!canUseTemplarReaction(actor, { notify: false })) continue
      if (!barrierAbilityAvailable(readTemplarState(actor))) continue
      if (
         !canUseReactiveOrHoldingAgainstDamage(actor, context, {
            assumePhysical,
         })
      ) {
         continue
      }
      if (!currentUserShouldPromptActor(actor)) continue
      const disposition = Number(token.document?.disposition ?? 0)
      if (
         allyDisposition !== 0 &&
         disposition !== 0 &&
         disposition !== allyDisposition
      ) {
         continue
      }
      const distance = Math.min(
         ...allyObjects.map((allyObject) =>
            tokenEdgeDistanceFeet(allyObject, token),
         ),
      )
      if (distance > 5) continue
      const key = actor.uuid ?? actor.id
      if (!seen.has(key)) {
         seen.add(key)
         candidates.push(actor)
      }
   }
   return candidates
}
