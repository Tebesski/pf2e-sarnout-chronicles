import { TEMPLAR_SLUGS } from "../constants.mjs"
import {
   actorHasSlug,
   currentCombatRound,
   currentCombatTurn,
   readTemplarState,
} from "../state.mjs"
import { fact } from "../templates.mjs"
import { dialogContent } from "../dialogs.mjs"
import { damageTypeLabel } from "../damage.mjs"
import {
   activeHoldingSlots,
   canSustainHoldingSlot,
   holdingMaxSustainRounds,
   holdingRoundsRemaining,
   holdingSustainCount,
   philosophyReduction,
} from "./helpers.mjs"
import { needsSustainPrompt, turnDecisionForTurn } from "./turn-state.mjs"

export function turnDecisionView(
   slot,
   round = currentCombatRound(),
   turn = currentCombatTurn(),
) {
   const decision = turnDecisionForTurn(slot, round, turn)
   return {
      decisionLabel:
         decision === "sustain"
            ? "Sustain selected"
            : decision === "release"
              ? "Release selected"
              : "",
      decisionClass:
         decision === "sustain"
            ? "is-sustain"
            : decision === "release"
              ? "is-release"
              : "",
   }
}

export function holdingTurnSlotViews(
   actor,
   { round = currentCombatRound(), turn = currentCombatTurn() } = {},
) {
   const state = readTemplarState(actor)
   const hasPhilosophy = actorHasSlug(actor, TEMPLAR_SLUGS.philosophyOfDefense)

   return activeHoldingSlots(state)
      .filter((slot) => needsSustainPrompt(actor, slot, round, turn))
      .map((slot) => ({
         index: slot.index,
         displayIndex: slot.index + 1,
         damage: slot.damage,
         roundsSustained: holdingSustainCount(slot),
         maxRounds: holdingMaxSustainRounds(actor),
         canSustain: canSustainHoldingSlot(actor, slot),
         hasPhilosophy,
         ...turnDecisionView(slot, round, turn),
      }))
}

export function slotSummaryFacts(
   actor,
   slot,
   { includeReduction = false } = {},
) {
   const maxRounds = holdingMaxSustainRounds(actor)
   const remaining = holdingRoundsRemaining(actor, slot)
   const reduction = philosophyReduction(actor)
   const typeLabel = (slot.damageTypes ?? [slot.damageType ?? "untyped"])
      .map(damageTypeLabel)
      .join(", ")
   const facts = [
      fact("Held Damage", slot.damage),
      fact("Damage Type", typeLabel),
      fact("Sustained", `${holdingSustainCount(slot)} rounds`),
      fact("Remaining", `${remaining} of ${maxRounds} rounds`),
   ]
   if (includeReduction) {
      facts.push(
         fact("Reduction", reduction),
         fact("Resulting Damage", Math.max(0, slot.damage - reduction)),
      )
   }
   return facts
}

export async function slotSummaryHTML(
   actor,
   slot,
   { includeReduction = false } = {},
) {
   return dialogContent({
      facts: slotSummaryFacts(actor, slot, { includeReduction }),
   })
}
