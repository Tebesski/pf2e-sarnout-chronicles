import { TEMPLAR_SLUGS } from "../constants.mjs"
import {
   actorHasSlug,
   currentCombatRound,
   currentCombatTurn,
   readTemplarState,
   writeTemplarState,
} from "../state.mjs"
import { fact, textParagraph } from "../templates.mjs"
import { currentUserShouldPromptActor, featureDetected, getActor } from "../actors.mjs"
import { effectiveBarrier } from "../barrier/state.mjs"
import { dialogContent, promptNumber, TemplarChoiceDialog } from "../dialogs.mjs"
import { flagellation } from "../flagellation.mjs"
import { prevail } from "../prevail.mjs"
import {
   activeHoldingSlots,
   canSustainHoldingSlot,
} from "./helpers.mjs"
import {
   isCoveredForTurn,
   isSustainedForTurn,
   isSustainedThisTurn,
   needsSustainPrompt,
   turnDecisionForTurn,
} from "./turn-state.mjs"
import { syncSustainedHoldingEffect } from "./effects.mjs"
import {
   requestBarrierPanel,
   slotByIndex,
   updateState,
} from "./state-ops.mjs"
import {
   philosophyWithJuggler,
   sustainHolding,
   sustainWithJuggler,
} from "./sustain-actions.mjs"
export { sustainHolding } from "./sustain-actions.mjs"
import { slotSummaryFacts } from "./views.mjs"
import {
   closeHoldingTurnDialog as closeHoldingTurnDialogBase,
   openHoldingTurnDialog as openHoldingTurnDialogBase,
   refreshHoldingTurnDialog as refreshHoldingTurnDialogBase,
} from "./turn-dialog.mjs"
import {
   releaseHolding,
   releaseHoldingSlotsMerged,
} from "./release.mjs"

async function choosePrevailSlot(actor, preferredSlotIndex = null) {
   const state = readTemplarState(actor)
   if (
      preferredSlotIndex !== null &&
      preferredSlotIndex !== undefined &&
      state.holding[Number(preferredSlotIndex)]?.active
   ) {
      return Number(preferredSlotIndex)
   }

   const activeSlots = activeHoldingSlots(state)
   if (activeSlots.length === 0) {
      ui.notifications?.warn("No held damage is available for Prevail.")
      return null
   }
   if (activeSlots.length === 1) return activeSlots[0].index

   const choice = await TemplarChoiceDialog.prompt({
      title: "Prevail",
      content: await dialogContent({
         paragraphs: [
            textParagraph("Choose which held damage instance to purge."),
         ],
         facts: activeSlots.map((slot) =>
            fact(`Barrier ${slot.index + 1}`, `${slot.damage} damage`),
         ),
      }),
      buttons: [
         ...activeSlots.map((slot) => ({
            id: String(slot.index),
            label: `Barrier ${slot.index + 1}`,
            icon: "fa-solid fa-shield-halved",
         })),
         { id: "cancel", label: "Cancel" },
      ],
   })

   if (choice === null || choice === "cancel") return null
   return Number(choice)
}

async function applyPrevailRelease(actor, slotIndex) {
   return prevail({ actor, slotIndex })
}

export async function openHoldingBarrierDialog({ actor, slotIndex = 0 } = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null

   const index = Number(slotIndex)
   const { slot, state } = slotByIndex(resolved, index)
   if (!slot?.active) {
      ui.notifications?.warn("That holding barrier is empty.")
      return null
   }

   const hasPhilosophy = actorHasSlug(
      resolved,
      TEMPLAR_SLUGS.philosophyOfDefense,
   )
   const hasPrevail = actorHasSlug(resolved, TEMPLAR_SLUGS.prevail)
   const hasFlagellation = actorHasSlug(resolved, TEMPLAR_SLUGS.flagellation)

   const buttons = [
      { id: "sustain", label: "Sustain", icon: "fa-solid fa-arrows-rotate" },
   ]

   if (hasPhilosophy) {
      buttons.push({
         id: "philosophy",
         label: "Philosophy of Defense",
         icon: "fa-solid fa-book-bible",
      })
   }

   buttons.push({ id: "release", label: "Release", icon: "fa-solid fa-burst" })

   if (hasPrevail) {
      buttons.push({ id: "prevail", label: "Prevail", icon: "fa-solid fa-sun" })
   }
   if (hasFlagellation) {
      buttons.push({
         id: "flagellation",
         label: "Flagellation",
         icon: "fa-solid fa-fire-flame-curved",
      })
   }

   buttons.push({ id: "cancel", label: "Cancel" })

   const choice = await TemplarChoiceDialog.prompt({
      title: `Holding Barrier ${index + 1}`,
      content: await dialogContent({
         paragraphs: [
            textParagraph("Choose how to handle this held damage instance."),
         ],
         facts: slotSummaryFacts(resolved, slot),
      }),
      buttons,
   })

   if (choice === "sustain") return sustainWithJuggler(resolved, index)
   if (choice === "philosophy") return philosophyWithJuggler(resolved, index)
   if (choice === "release")
      return releaseHolding({ actor: resolved, slotIndex: index })
   if (choice === "prevail")
      return openPrevailDialog({ actor: resolved, slotIndex: index })
   if (choice === "flagellation")
      return flagellation({ actor: resolved, slotIndex: index })

   return null
}

function currentCombatActor(combat = game.combat) {
   return (
      combat?.combatant?.actor ??
      combat?.combatants?.get?.(combat?.current?.combatantId)?.actor ??
      combat?.turns?.[Number(combat?.turn ?? -1)]?.actor ??
      null
   )
}

function slotPromptedForTurn(slot, round, turn) {
   return slot?.promptedRound === round && slot?.promptedTurn === turn
}

async function markHoldingPromptedForTurn(actor, round, turn) {
   return updateState(actor, (state) => {
      for (const slot of state.holding) {
         if (!slot?.active || slot.releasing) continue
         const currentDecision = turnDecisionForTurn(slot, round, turn)
         if (!currentDecision) {
            slot.turnDecision = null
            slot.decisionRound = round
            slot.decisionTurn = turn
         }
         if (needsSustainPrompt(actor, slot, round, turn)) {
            slot.promptedRound = round
            slot.promptedTurn = turn
         } else {
            slot.promptedRound = null
            slot.promptedTurn = null
         }
      }
      return state
   })
}

async function clearStaleHoldingTurnDecisions(actor, round, turn) {
   return updateState(actor, (state) => {
      for (const slot of state.holding) {
         if (!slot?.active || slot.releasing) continue
         if (turnDecisionForTurn(slot, round, turn)) continue
         slot.turnDecision = null
         slot.decisionRound = round
         slot.decisionTurn = turn
         slot.promptedRound = null
         slot.promptedTurn = null
      }
      return state
   })
}

function holdingTurnDialogActions() {
   return {
      releaseHolding,
      philosophyWithJuggler,
      setHoldingTurnDecision,
      releaseUndecidedHoldingBarriers,
      markUndecidedHoldingReleaseDecisions,
   }
}

function openHoldingTurnDialog(actor, options = {}) {
   return openHoldingTurnDialogBase(
      actor,
      options,
      holdingTurnDialogActions(),
   )
}

function refreshHoldingTurnDialog(actor) {
   refreshHoldingTurnDialogBase(actor)
}

function closeHoldingTurnDialog(actor) {
   closeHoldingTurnDialogBase(actor)
}

async function markUndecidedHoldingReleaseDecisions(
   actor,
   { refresh = true } = {},
) {
   let changed = false
   const round = currentCombatRound()
   const turn = currentCombatTurn()
   const result = await updateState(actor, (state) => {
      for (const slot of state.holding) {
         if (!slot?.active || slot.releasing) continue
         if (!slotPromptedForTurn(slot, round, turn)) continue
         if (turnDecisionForTurn(slot, round, turn)) continue
         slot.turnDecision = "release"
         slot.decisionRound = round
         slot.decisionTurn = turn
         changed = true
      }
      return state
   })
   if (changed && refresh) {
      refreshHoldingTurnDialog(actor)
      requestBarrierPanel(actor)
   }
   return result
}

async function releaseUndecidedHoldingBarriers(actor, { round, turn } = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   const releaseRound = Number(round ?? currentCombatRound())
   const releaseTurn = Number(turn ?? currentCombatTurn())
   const state = readTemplarState(resolved)
   const slotsToRelease = activeHoldingSlots(state).filter((slot) => {
      return (
         slotPromptedForTurn(slot, releaseRound, releaseTurn) &&
         !turnDecisionForTurn(slot, releaseRound, releaseTurn)
      )
   })
   for (const slot of slotsToRelease) {
      await releaseHolding({
         actor: resolved,
         slotIndex: slot.index,
         messageTitle: "Holding Barrier Not Sustained",
      })
   }
   requestBarrierPanel(resolved)
   return readTemplarState(resolved)
}

async function markHoldingReleaseDecision(actor, slotIndex) {
   let sustainedCount = 0
   const result = await updateState(actor, (state) => {
      const slot = state.holding[Number(slotIndex)]
      if (!slot?.active) return state
      if (isSustainedThisTurn(slot)) {
         slot.roundsSustained = Math.max(0, slot.roundsSustained - 1)
      }
      slot.lastSustainedRound = null
      slot.lastSustainedTurn = null
      slot.turnDecision = "release"
      slot.decisionRound = currentCombatRound()
      slot.decisionTurn = currentCombatTurn()
      sustainedCount = state.holding.filter(isSustainedThisTurn).length
      return state
   })
   await syncSustainedHoldingEffect(actor, sustainedCount)
   refreshHoldingTurnDialog(actor)
   return result
}

async function clearHoldingTurnDecision(actor, slotIndex) {
   let sustainedCount = 0
   const result = await updateState(actor, (state) => {
      const slot = state.holding[Number(slotIndex)]
      if (!slot?.active) return state
      if (isSustainedThisTurn(slot)) {
         slot.roundsSustained = Math.max(0, slot.roundsSustained - 1)
      }
      slot.lastSustainedRound = null
      slot.lastSustainedTurn = null
      slot.turnDecision = null
      slot.decisionRound = currentCombatRound()
      slot.decisionTurn = currentCombatTurn()
      sustainedCount = state.holding.filter(isSustainedThisTurn).length
      return state
   })
   await syncSustainedHoldingEffect(actor, sustainedCount)
   refreshHoldingTurnDialog(actor)
   return result
}

export async function promptHoldingBarrierSustainTurn({
   actor,
   round = currentCombatRound(),
   turn = currentCombatTurn(),
   releaseOnClose = false,
} = {}) {
   const resolved = actor ?? currentCombatActor()
   if (!resolved || !currentUserShouldPromptActor(resolved)) return null
   const promptRound = Number(round)
   const promptTurn = Number(turn)

   let state = readTemplarState(resolved)
   let activeSlots = activeHoldingSlots(state)
   if (activeSlots.length === 0) return null

   const expiredSlots = activeSlots.filter((slot) => {
      if (turnDecisionForTurn(slot, promptRound, promptTurn) === "release") {
         return false
      }
      return (
         !isSustainedForTurn(slot, promptRound, promptTurn) &&
         !canSustainHoldingSlot(resolved, slot)
      )
   })
   if (expiredSlots.length > 0) {
      const expiredIndexes = new Set(expiredSlots.map((slot) => slot.index))
      await updateState(resolved, (current) => {
         for (const slot of current.holding) {
            if (
               !expiredIndexes.has(slot.index) ||
               !slot.active ||
               slot.releasing
            ) {
               continue
            }
            slot.turnDecision = "release"
            slot.decisionRound = promptRound
            slot.decisionTurn = promptTurn
            slot.promptedRound = null
            slot.promptedTurn = null
         }
         return current
      })
      state = readTemplarState(resolved)
      activeSlots = activeHoldingSlots(state)
   }

   const promptableSlots = activeSlots.filter((slot) =>
      needsSustainPrompt(resolved, slot, promptRound, promptTurn),
   )

   if (promptableSlots.length === 0) {
      await clearStaleHoldingTurnDecisions(resolved, promptRound, promptTurn)
      await syncSustainedHoldingEffect(
         resolved,
         activeSlots.filter((slot) =>
            isSustainedForTurn(slot, promptRound, promptTurn),
         ).length,
      )
      requestBarrierPanel(resolved)
      closeHoldingTurnDialog(resolved)
      return null
   }

   const allPrompted = promptableSlots.every((slot) =>
      slotPromptedForTurn(slot, promptRound, promptTurn),
   )
   const allDecided = promptableSlots.every((slot) =>
      Boolean(turnDecisionForTurn(slot, promptRound, promptTurn)),
   )
   if (allPrompted && allDecided) {
      return null
   }

   if (!allPrompted) {
      await markHoldingPromptedForTurn(resolved, promptRound, promptTurn)
      const latest = readTemplarState(resolved)
      await syncSustainedHoldingEffect(
         resolved,
         latest.holding.filter((slot) =>
            isSustainedForTurn(slot, promptRound, promptTurn),
         ).length,
      )
      requestBarrierPanel(resolved)
   }
   return openHoldingTurnDialog(resolved, {
      round: promptRound,
      turn: promptTurn,
      releaseOnClose,
   })
}

export async function releaseUnsustainedHoldingBarriers({
   actor,
   round = currentCombatRound(),
   turn = currentCombatTurn(),
} = {}) {
   const resolved = actor ?? null
   if (!resolved) return null
   if (!currentUserShouldPromptActor(resolved)) return null
   const state = readTemplarState(resolved)
   const slotsToRelease = activeHoldingSlots(state).filter((slot) => {
      if (turnDecisionForTurn(slot, round, turn) === "release") return true
      return !isCoveredForTurn(slot, round, turn)
   })
   await releaseHoldingSlotsMerged(resolved, slotsToRelease, {
      messageTitle: "Holding Barrier Not Sustained",
   })
   const latest = readTemplarState(resolved)
   const sustainedCount = latest.holding.filter((slot) =>
      isSustainedForTurn(slot, round, turn),
   ).length
   await syncSustainedHoldingEffect(resolved, sustainedCount)
   closeHoldingTurnDialog(resolved)
   return readTemplarState(resolved)
}

export async function setHoldingTurnDecision({
   actor,
   slotIndex = 0,
   decision = null,
   round = currentCombatRound(),
   turn = currentCombatTurn(),
   releaseImmediately = false,
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   const index = Number(slotIndex)
   const state = readTemplarState(resolved)
   if (!state.holding[index]?.active) return null

   if (decision === "sustain") {
      const result = await sustainWithJuggler(resolved, index, { round, turn })
      requestBarrierPanel(resolved)
      return result
   }
   if (decision === "release") {
      const result = releaseImmediately
         ? await releaseHolding({
              actor: resolved,
              slotIndex: index,
              messageTitle: "Holding Barrier Released",
           })
         : await markHoldingReleaseDecision(resolved, index)
      requestBarrierPanel(resolved)
      return result
   }
   const result = await clearHoldingTurnDecision(resolved, index)
   requestBarrierPanel(resolved)
   return result
}

export async function openHoldingTurnDecisionDialog({
   actor,
   slotIndex = 0,
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   const state = readTemplarState(resolved)
   const slot = state.holding[Number(slotIndex)]
   if (!slot?.active) return null

   const choice = await TemplarChoiceDialog.prompt({
      title: `Holding Barrier ${Number(slotIndex) + 1}`,
      content: await dialogContent({
         paragraphs: [
            textParagraph(
               "Change this holding barrier's turn decision. Release decisions resolve at the end of this turn.",
            ),
         ],
         facts: slotSummaryFacts(resolved, slot),
      }),
      buttons: [
         {
            id: "sustain",
            label: "Sustain",
            icon: "fa-solid fa-arrows-rotate",
         },
         { id: "release", label: "Release", icon: "fa-solid fa-burst" },
         { id: "clear", label: "Clear" },
         { id: "cancel", label: "Cancel" },
      ],
   })
   if (choice === "cancel" || choice === null) return null
   return setHoldingTurnDecision({
      actor: resolved,
      slotIndex,
      decision: choice === "clear" ? null : choice,
   })
}

export async function openPrevailDialog({
   actor,
   slotIndex = null,
   spendFocus = false,
   fromSpellMessage = false,
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null

   if (!featureDetected(resolved, TEMPLAR_SLUGS.prevail, fromSpellMessage)) {
      ui.notifications?.warn("Prevail was not detected on this actor.")
      return null
   }

   const index = await choosePrevailSlot(resolved, slotIndex)
   if (index === null) return null

   const state = readTemplarState(resolved)
   const slot = state.holding[index]
   if (!slot?.active) {
      ui.notifications?.warn("No held damage is available for Prevail.")
      return null
   }

   const barrier = effectiveBarrier(state) ?? { hardness: state.light.hardness }
   const baseReduction = barrier.hardness
   const choice = await TemplarChoiceDialog.prompt({
      title: "Prevail",
      content: await dialogContent({
         paragraphs: [
            textParagraph(
               "Prevail reduces this held damage by your active barrier's current Hardness, then Releases it.",
            ),
         ],
         facts: [
            fact("Held Damage", slot.damage),
            fact("Hardness Reduction", baseReduction),
            fact("Release Result", Math.max(0, slot.damage - baseReduction)),
         ],
      }),
      buttons: [
         { id: "release", label: "Release", icon: "fa-solid fa-burst" },
         { id: "cancel", label: "Cancel" },
      ],
   })

   if (choice === "release") {
      return applyPrevailRelease(resolved, index)
   }
   return null
}

export async function editHeldDamage({ actor, slotIndex = 0, damage } = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   const state = readTemplarState(resolved)
   const slot = state.holding[Number(slotIndex)]
   if (!slot?.active) return null
   const next =
      damage === undefined || damage === null
         ? await promptNumber({
              title: "Edit Held Damage",
              label: "Held damage",
              value: slot.damage,
              min: 0,
           })
         : Number(damage)
   if (next === null || !Number.isFinite(next)) return null
   slot.damage = Math.max(0, next)
   slot.damageInstances = null
   return writeTemplarState(resolved, state)
}
