import { TEMPLAR_SLUGS } from "../constants.mjs"
import { actorHasSlug, actorLevel } from "../state.mjs"

export function holdingMaxRounds(actor) {
   return actorHasSlug(actor, TEMPLAR_SLUGS.philosophyOfDefense) ? 10 : 2
}

export function holdingMaxSustainRounds(actor) {
   return Math.max(0, holdingMaxRounds(actor) - 1)
}

export function holdingSustainCount(slot) {
   return Math.max(0, Number(slot?.roundsSustained) || 0)
}

export function holdingRoundsRemaining(actor, slot) {
   return Math.max(
      0,
      holdingMaxSustainRounds(actor) - holdingSustainCount(slot),
   )
}

export function canSustainHoldingSlot(actor, slot) {
   return holdingRoundsRemaining(actor, slot) > 0
}

export function philosophyReduction(actor) {
   return Math.max(1, Math.floor(actorLevel(actor) / 2))
}

export function charismaModifier(actor) {
   const modifier = Number(actor?.system?.abilities?.cha?.mod ?? 0)
   return Number.isFinite(modifier) ? modifier : 0
}

export function activeHoldingSlots(state) {
   return state.holding
      .map((slot, index) => ({ ...slot, index }))
      .filter((slot) => slot.active && !slot.releasing)
}
