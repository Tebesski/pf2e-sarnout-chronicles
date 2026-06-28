import { MODULE_ID } from "../constants.mjs"
import {
   currentCombatRound,
   currentCombatTurn,
   readTemplarState,
   writeTemplarState,
} from "../state.mjs"
import {
   canSustainHoldingSlot,
   holdingMaxSustainRounds,
   holdingSustainCount,
} from "./helpers.mjs"
import { isSustainedForTurn } from "./turn-state.mjs"
import { syncSustainedHoldingEffect } from "./effects.mjs"
import { refreshHoldingTurnDialog as refreshHoldingTurnDialogBase } from "./turn-dialog.mjs"

export function requestBarrierPanel(actor) {
   Hooks.callAll(`${MODULE_ID}.openTemplarBarrierPanel`, actor)
}

export async function updateState(actor, updater) {
   const current = readTemplarState(actor)
   const next = (await updater(current)) ?? current
   return writeTemplarState(actor, next)
}

export function slotByIndex(actor, slotIndex) {
   const state = readTemplarState(actor)
   const index = Number(slotIndex)
   return { state, slot: state.holding[index] ?? null, index }
}

export function clearBarrierSlot(slot) {
   slot.active = false
   slot.releasing = false
   slot.released = false
   slot.restoring = false
   slot.lastReleasedDamage = 0
   slot.damage = 0
   slot.damageType = "untyped"
   slot.damageTypes = ["untyped"]
   slot.damageInstances = null
   slot.rollData = null
   slot.bypassIWR = true
   slot.roundsSustained = 0
   slot.createdRound = currentCombatRound()
   slot.createdTurn = currentCombatTurn()
   slot.lastSustainedRound = null
   slot.lastSustainedTurn = null
   slot.promptedRound = null
   slot.promptedTurn = null
   slot.turnDecision = null
   slot.decisionRound = null
   slot.decisionTurn = null
   return slot
}

export async function reduceHeldDamage(actor, slotIndex, amount) {
   const reduction = Math.max(0, Number(amount) || 0)
   return updateState(actor, (state) => {
      const slot = state.holding[Number(slotIndex)]
      if (!slot?.active) return state
      slot.damage = Math.max(0, slot.damage - reduction)
      if (slot.damage <= 0) clearBarrierSlot(slot)
      return state
   })
}

export async function sustainHoldingMany(
   actor,
   slotIndexes,
   { round = currentCombatRound(), turn = currentCombatTurn() } = {},
) {
   const indexes = [...new Set(slotIndexes.map((index) => Number(index)))]
   let sustainedCount = 0
   const result = await updateState(actor, (state) => {
      for (const index of indexes) {
         const slot = state.holding[index]
         if (!slot?.active) continue
         if (!canSustainHoldingSlot(actor, slot)) continue
         if (!isSustainedForTurn(slot, round, turn)) {
            slot.roundsSustained = Math.min(
               holdingMaxSustainRounds(actor),
               holdingSustainCount(slot) + 1,
            )
         }
         slot.lastSustainedRound = round
         slot.lastSustainedTurn = turn
         slot.turnDecision = "sustain"
         slot.decisionRound = round
         slot.decisionTurn = turn
      }
      sustainedCount = state.holding.filter((slot) =>
         isSustainedForTurn(slot, round, turn),
      ).length
      return state
   })
   await syncSustainedHoldingEffect(actor, sustainedCount)
   refreshHoldingTurnDialogBase(actor)
   return result
}
