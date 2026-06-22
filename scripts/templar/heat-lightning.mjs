import { TEMPLAR_SLUGS } from "./constants.mjs"
import { readTemplarState } from "./state.mjs"
import { getActor } from "./actors.mjs"
import { itemMatchesSlugGroup } from "./effects.mjs"
import { actorHasLingeringBarrierEffect } from "./barrier/state.mjs"
import {
   dialogContent,
   TemplarChoiceDialog,
} from "./dialogs.mjs"
import {
   fact,
   textParagraph,
} from "./templates.mjs"
import { applyActorHealing } from "./actor-damage.mjs"
import { postTemplarMessage } from "./messages.mjs"

export async function heatLightning({ actor, confirm = true } = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null

   const ability = resolved.items?.find?.(
      (i) =>
         itemMatchesSlugGroup(i, TEMPLAR_SLUGS.heatLightning) &&
         ["action", "feat"].includes(i.type),
   )

   if (!ability) {
      ui.notifications?.warn("Heat Lightning was not detected on this actor.")
      return null
   }

   if (
      ability.system?.frequency?.value !== undefined &&
      ability.system.frequency.value <= 0
   ) {
      ui.notifications?.warn("Heat Lightning has no uses remaining.")
      return null
   }

   const state = readTemplarState(resolved)
   if (!actorHasLingeringBarrierEffect(resolved)) {
      ui.notifications?.warn(
         "Heat Lightning requires Lingering Barrier to be active.",
      )
      return null
   }

   const healing = Math.max(
      0,
      Number(state.damagedSinceLastTurn?.previousHp) || 0,
   )

   if (healing <= 0) {
      ui.notifications?.warn(
         "No Shattered Light Barrier HP was recorded for Heat Lightning.",
      )
      return null
   }

   if (confirm) {
      const choice = await TemplarChoiceDialog.prompt({
         title: "Heat Lightning",
         content: await dialogContent({
            paragraphs: [
               textParagraph(
                  "You will regain Hit Points equal to the Light Barrier HP immediately before it was Shattered.",
               ),
            ],
            facts: [
               fact("Healing", healing),
               fact(
                  "Recorded Barrier HP",
                  state.damagedSinceLastTurn.previousHp,
               ),
            ],
         }),
         buttons: [
            { id: "confirm", label: "Heal", icon: "fa-solid fa-heart" },
            { id: "cancel", label: "Cancel" },
         ],
      })
      if (choice !== "confirm") return null
   }

   if (ability.system?.frequency) {
      try {
         await ability.update({
            "system.frequency.value": Math.max(
               0,
               ability.system.frequency.value - 1,
            ),
         })
      } catch (_error) {}
   }

   await applyActorHealing(resolved, healing)
   await postTemplarMessage(
      resolved,
      "Heat Lightning",
      `Recovered ${healing} Hit Points from the shattered Light Barrier.`,
   )
   return healing
}
