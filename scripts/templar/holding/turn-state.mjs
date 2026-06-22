import { SUSTAINED_HOLDING_SLUG } from "../constants.mjs"
import { currentCombatRound, currentCombatTurn } from "../state.mjs"
import { canSustainHoldingSlot } from "./helpers.mjs"

export function actorDialogKey(actor) {
   return actor?.uuid ?? actor?.id ?? ""
}

export function isSustainedForTurn(
   slot,
   round = currentCombatRound(),
   turn = currentCombatTurn(),
) {
   return slot?.lastSustainedRound === round && slot?.lastSustainedTurn === turn
}

export function isSustainedThisTurn(slot) {
   return isSustainedForTurn(slot)
}

export function turnDecisionForTurn(
   slot,
   round = currentCombatRound(),
   turn = currentCombatTurn(),
) {
   return slot?.decisionRound === round && slot?.decisionTurn === turn
      ? slot.turnDecision
      : null
}

export function isCoveredForTurn(
   slot,
   round = currentCombatRound(),
   turn = currentCombatTurn(),
) {
   if (slot?.createdRound === round && slot?.createdTurn === turn) return true
   return isSustainedForTurn(slot, round, turn)
}

export function needsSustainPrompt(
   actor,
   slot,
   round = currentCombatRound(),
   turn = currentCombatTurn(),
) {
   if (slot?.createdRound === round && slot?.createdTurn === turn) return false
   return (
      Boolean(slot?.active) &&
      !slot.releasing &&
      !isSustainedForTurn(slot, round, turn) &&
      canSustainHoldingSlot(actor, slot)
   )
}

export function sustainedHoldingEffect(actor) {
   return actor?.items?.find?.((item) => {
      const slug = item.slug ?? item.system?.slug
      return (
         item.type === "effect" &&
         (slug === SUSTAINED_HOLDING_SLUG ||
            item.name === "Sustained: Holding Barrier")
      )
   })
}
