import {
   TEMPLAR_ASSETS,
   TEMPLAR_SLUGS,
} from "./constants.mjs"
import {
   actorLevel,
   readTemplarState,
} from "./state.mjs"
import {
   featureDetected,
   getActor,
} from "./actors.mjs"
import { activeHoldingSlots } from "./holding/helpers.mjs"
import { slotSummaryFacts } from "./holding/views.mjs"
import {
   dialogContent,
   TemplarChoiceDialog,
} from "./dialogs.mjs"
import {
   fact,
   textParagraph,
} from "./templates.mjs"
import { playSound } from "./audio.mjs"
import { emitTemplarLight } from "./light.mjs"
import { releaseHolding } from "./holding/release.mjs"
import { counteract } from "./counteract.mjs"
import { postTemplarMessage } from "./messages.mjs"

export async function flagellation({
   actor,
   slotIndex = null,
   spendFocus = false,
   fromSpellMessage = false,
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   if (
      !featureDetected(resolved, TEMPLAR_SLUGS.flagellation, fromSpellMessage)
   ) {
      ui.notifications?.warn("Flagellation was not detected on this actor.")
      return null
   }

   const state = readTemplarState(resolved)
   const lightBarrierHardness = Math.max(0, Number(state.light?.hardness) || 0)
   const minimumHeldDamage = lightBarrierHardness * 2
   const eligibleSlots = activeHoldingSlots(state).filter(
      (candidate) => candidate.damage >= minimumHeldDamage,
   )
   let index =
      slotIndex === null || slotIndex === undefined ? null : Number(slotIndex)
   if (index === null || index === undefined) {
      if (eligibleSlots.length === 1) {
         index = eligibleSlots[0].index
      } else if (eligibleSlots.length > 1) {
         const choice = await TemplarChoiceDialog.prompt({
            title: "Flagellation",
            content: await dialogContent({
               paragraphs: [
                  textParagraph(
                     "Choose which held damage instance to release.",
                  ),
               ],
               facts: [
                  fact("Minimum Held Damage", minimumHeldDamage),
                  ...eligibleSlots.map((slot) =>
                     fact(`Barrier ${slot.index + 1}`, `${slot.damage} damage`),
                  ),
               ],
            }),
            buttons: [
               ...eligibleSlots.map((slot) => ({
                  id: String(slot.index),
                  label: `Barrier ${slot.index + 1}`,
                  icon: "fa-solid fa-shield-halved",
               })),
               { id: "cancel", label: "Cancel" },
            ],
         })
         if (choice === null || choice === "cancel") return null
         index = Number(choice)
      }
   }
   if (
      (index === null || index === undefined) &&
      activeHoldingSlots(state).length > 0 &&
      eligibleSlots.length === 0
   ) {
      ui.notifications?.warn(
         `Flagellation requires held damage of at least ${minimumHeldDamage}.`,
      )
      return null
   }
   const slot = state.holding[index]
   if (!slot?.active) {
      ui.notifications?.warn("No held damage is available for Flagellation.")
      return null
   }
   if (slot.damage < minimumHeldDamage) {
      ui.notifications?.warn(
         `Flagellation requires held damage of at least ${minimumHeldDamage}.`,
      )
      return null
   }
   const counteractRank = Math.max(1, Math.ceil(actorLevel(resolved) / 2))

   const choice = await TemplarChoiceDialog.prompt({
      title: "Flagellation",
      content: await dialogContent({
         paragraphs: [
            textParagraph(
               "Release this barrier, take the held damage, then run a counteract check.",
            ),
         ],
         facts: [
            ...slotSummaryFacts(resolved, slot),
            fact("Minimum Held Damage", minimumHeldDamage),
            fact("Counteract Rank", counteractRank),
         ],
      }),
      buttons: [
         { id: "confirm", label: "Flagellate", icon: "fa-solid fa-burst" },
         { id: "cancel", label: "Cancel" },
      ],
   })
   if (choice !== "confirm") return null
   await playSound(TEMPLAR_ASSETS.flagellationSound)
   await emitTemplarLight(resolved)
   const releasedDamage = slot.damage
   await releaseHolding({
      actor: resolved,
      slotIndex: index,
      messageTitle: "Flagellation",
      postMessage: false,
   })
   const counteractResult = await counteract({
      actor: resolved,
      title: "Flagellation Counteract",
      postRoll: true,
      postSummary: true,
      defaultCounteractLevel: counteractRank,
      fixedCounteractLevel: counteractRank,
   })
   await postTemplarMessage(
      resolved,
      "Flagellation",
      [
         `Released held damage ${releasedDamage}.`,
         counteractResult ? "Counteract check resolved." : "",
      ]
         .filter(Boolean)
         .join("<hr>"),
   )
   return true
}
