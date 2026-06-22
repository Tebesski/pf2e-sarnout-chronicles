import {
   LINGERING_BARRIER_SLUG,
   LINKED_TEMPLAR_EFFECTS,
   MODULE_ID,
   RELEASE_FLASH_TAIL_MS,
   RELEASE_ICON_SWAP_MS,
   SUSTAINED_HOLDING_SLUG,
   TEMPLAR_ASSETS,
   TEMPLAR_SLUGS,
} from "./constants.mjs"
import {
   actorHasSlug,
   actorLevel,
   calculateLightBarrier,
   currentCombatRound,
   currentCombatTurn,
   readTemplarState,
   slugify,
   spellRankForActor,
   unsetTemplarState,
   writeTemplarState,
} from "./state.mjs"
import {
   fact,
   textParagraph,
} from "./templates.mjs"
import {
   canUsePhysicalBarrierAgainstDamage,
   canUseReactiveOrHoldingAgainstDamage,
   damageContextFromRoll,
   damageFromContext,
   damageTypeLabel,
   mergeDamageContexts,
   reduceDamageContext,
   reduceDamageContextByAmount,
   regularizedCriticalDamageContext,
   splitDamageContextForBarrier,
} from "./damage.mjs"
export {
   damageContextFromRoll,
   damageFromContext,
   mergeDamageContexts,
   reduceDamageContext,
   reduceDamageContextByAmount,
   regularizedCriticalDamageContext,
   splitDamageContextForBarrier,
} from "./damage.mjs"
import {
   levelBasedDC,
   lightBurstDetails,
   templarClassOrSpellDC,
} from "./scaling.mjs"
import {
   degreeLabel,
   degreeOfSuccessFromRoll,
   lightBurstDamageFormula,
   rollTemplarDamageFormula,
} from "./rolls.mjs"
import { counteract } from "./counteract.mjs"
export { counteract } from "./counteract.mjs"
import {
   playRandomSound,
   playSound,
   stopLoopSound,
} from "./audio.mjs"
import {
   currentUserShouldPromptActor,
   featureDetected,
   getActor,
   warnBarrierDestroyed,
} from "./actors.mjs"
import { spendFocusPoint } from "./focus.mjs"
export { spendFocusPoint } from "./focus.mjs"
import {
   actorHasOrdinaryRaisedShield,
   actorItemArray,
} from "./items.mjs"
import {
   brilliantShardLoopKey,
   removeBrilliantShardItem,
   syncBrilliantShardItem,
} from "./brilliant-shard/items.mjs"
import {
   brilliantShard,
   confirmBrilliantShardItemDelete,
   confirmBrilliantShardItemUpdate,
   removeBrilliantShardEffect,
   setBrilliantShard,
   toggleBrilliantShard,
} from "./brilliant-shard/actions.mjs"
export {
   brilliantShard,
   confirmBrilliantShardItemDelete,
   confirmBrilliantShardItemUpdate,
   setBrilliantShard,
   toggleBrilliantShard,
} from "./brilliant-shard/actions.mjs"
import {
   actorEffectBySlug,
   cleanupLegacyGeneratedTemplarActions,
   deleteEffectsBySlugs,
} from "./effects.mjs"
export { cleanupLegacyGeneratedTemplarActions } from "./effects.mjs"
import { setLinkedTemplarEffect } from "./linked-effects.mjs"
import {
   applyTemplarReactionUsed,
   canUseTemplarReaction,
   hasTemplarReactionUsed,
   warnReactionUsed,
} from "./reactions.mjs"
export {
   canUseTemplarReaction,
   hasTemplarReactionUsed,
} from "./reactions.mjs"
import {
   actorHasLingeringBarrierEffect,
   barrierAbilityAvailable,
   brilliantShardBrokenThreshold,
   effectiveBarrier,
   lightBarrierIntact,
   stateBrilliantShardIntact,
   stateLightBarrierIntact,
   stateLightBarrierLingering,
} from "./barrier/state.mjs"
import {
   dialogContent,
   promptNumber,
   TemplarChoiceDialog,
   TemplarSelectDialog,
} from "./dialogs.mjs"
import { postTemplarMessage } from "./messages.mjs"
import { emitTemplarLight } from "./light.mjs"
export { emitTemplarLight } from "./light.mjs"
import {
   prepareProvidenceReroll,
   providenceBonus,
} from "./providence/helpers.mjs"
export {
   prepareProvidenceReroll,
   providenceBonus,
} from "./providence/helpers.mjs"
import {
   completeProvidenceReroll as completeProvidenceRerollBase,
   divineIntervention as divineInterventionBase,
   providence as providenceBase,
} from "./providence/actions.mjs"
import {
   blindingBlade,
   lightGaol,
   postBlindingBladeUseCard,
} from "./light-gaol/actions.mjs"
import {
   activeHoldingSlots,
   canSustainHoldingSlot,
   charismaModifier,
   holdingMaxSustainRounds,
   holdingRoundsRemaining,
   holdingSustainCount,
   philosophyReduction,
} from "./holding/helpers.mjs"
import {
   isCoveredForTurn,
   isSustainedForTurn,
   isSustainedThisTurn,
   needsSustainPrompt,
   sustainedHoldingEffect,
   turnDecisionForTurn,
} from "./holding/turn-state.mjs"
import {
   slotSummaryFacts,
   slotSummaryHTML,
} from "./holding/views.mjs"
import {
   closeHoldingTurnDialog as closeHoldingTurnDialogBase,
   openHoldingTurnDialog as openHoldingTurnDialogBase,
   refreshHoldingTurnDialog as refreshHoldingTurnDialogBase,
} from "./holding/turn-dialog.mjs"
import {
   releaseHeldForBarrierTrait,
   releaseHolding,
   releaseHoldingSlotsMerged,
   releaseLargestHolding,
} from "./holding/release.mjs"
import { holdDamage as holdDamageBase } from "./holding/hold-damage.mjs"
import {
   rollBlindingBladeSaveFromCard,
   rollLightBurstSaveFromCard,
   rollLightGaolSaveFromCard,
} from "./card-save-rolls.mjs"
export {
   rollBlindingBladeSaveFromCard,
   rollLightBurstSaveFromCard,
   rollLightGaolSaveFromCard,
} from "./card-save-rolls.mjs"
import {
   handleScorchingReprisalDamage,
   handleScorchingReprisalStrike,
   scorchingReprisal,
} from "./scorching-reprisal.mjs"
export {
   handleScorchingReprisalDamage,
   handleScorchingReprisalStrike,
   scorchingReprisal,
} from "./scorching-reprisal.mjs"
import {
   advent,
   refreshAdventResistance,
   removeAdventResistanceEffects,
   setAdvent,
   setRallying,
   toggleAdvent,
   toggleRallying,
} from "./advent.mjs"
import {
   hasRefractionAvailable,
   lightDamping as lightDampingBase,
   refraction as refractionBase,
} from "./refraction.mjs"
export { hasRefractionAvailable } from "./refraction.mjs"
import { flagellation } from "./flagellation.mjs"
export { flagellation } from "./flagellation.mjs"
import { scutumFidei as scutumFideiBase } from "./scutum-fidei.mjs"
import { prevail } from "./prevail.mjs"
export { prevail } from "./prevail.mjs"
import { heatLightning } from "./heat-lightning.mjs"
export { heatLightning } from "./heat-lightning.mjs"
import { syncLinkedTemplarEffect } from "./linked-effect-sync.mjs"
export { syncLinkedTemplarEffect } from "./linked-effect-sync.mjs"
import {
   inculpation as inculpationBase,
   lightBurst as lightBurstBase,
   lightShell,
   reactiveBarrier as reactiveBarrierBase,
} from "./barrier/reactions.mjs"
export { lightShell } from "./barrier/reactions.mjs"
import {
   applyBarrierDamagedEffect,
   applyLingeringBarrierEffect,
   burstOrInculpationLockoutLabel,
} from "./barrier/effects.mjs"
import { applyEffectiveBarrierDamageToState } from "./barrier/damage-state.mjs"
import {
   repairHealingForDegree,
   rollReligionCheck,
} from "./religion.mjs"
import {
   checkLastRedoubtBadge,
   executeLastRedoubtEnhancement,
   lastStronghold,
} from "./last-redoubt.mjs"
export {
   checkLastRedoubtBadge,
   executeLastRedoubtEnhancement,
   lastStronghold,
} from "./last-redoubt.mjs"
import {
   heroPointPath,
   spendHeroPoint,
} from "./hero-points.mjs"
import { adjacentAsSafeTemplars } from "./as-safe.mjs"

function clamp(value, min, max) {
   return Math.max(min, Math.min(max, value))
}

function sleep(ms) {
   return new Promise((resolve) => setTimeout(resolve, ms))
}

function requestBarrierPanel(actor) {
   Hooks.callAll(`${MODULE_ID}.openTemplarBarrierPanel`, actor)
}

async function updateState(actor, updater) {
   const current = readTemplarState(actor)
   const next = (await updater(current)) ?? current
   return writeTemplarState(actor, next)
}

function slotByIndex(actor, slotIndex) {
   const state = readTemplarState(actor)
   const index = Number(slotIndex)
   return { state, slot: state.holding[index] ?? null, index }
}

function dcText(dc) {
   return Number.isFinite(dc)
      ? `DC ${dc} (class DC or spell DC, whichever is higher)`
      : "your class DC or spell DC, whichever is higher"
}

async function syncSustainedHoldingEffect(actor, value) {
   const count = Math.max(0, Math.trunc(Number(value) || 0))
   if (!actor?.createEmbeddedDocuments) return null
   const effect = sustainedHoldingEffect(actor)
   if (count <= 0) {
      if (effect?.delete) await effect.delete()
      return null
   }

   const update = {
      "system.badge": { type: "counter", value: count },
      "system.duration.value": 1,
      "system.duration.unit": "rounds",
      "system.duration.expiry": "turn-start",
   }
   if (effect?.update) return effect.update(update)

   try {
      const [created] = await actor.createEmbeddedDocuments("Item", [
         {
            name: "Sustained: Holding Barrier",
            type: "effect",
            img: TEMPLAR_ASSETS.holding,
            system: {
               slug: SUSTAINED_HOLDING_SLUG,
               badge: { type: "counter", value: count },
               duration: { value: 1, unit: "rounds", expiry: "turn-start" },
               description: {
                  value: "Tracks how many holding barrier instances were Sustained this turn.",
               },
            },
         },
      ])
      return created ?? null
   } catch (_error) {
      return null
   }
}

function clearBarrierSlot(slot) {
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

async function reduceHeldDamage(actor, slotIndex, amount) {
   const reduction = Math.max(0, Number(amount) || 0)
   return updateState(actor, (state) => {
      const slot = state.holding[Number(slotIndex)]
      if (!slot?.active) return state
      slot.damage = Math.max(0, slot.damage - reduction)
      if (slot.damage <= 0) clearBarrierSlot(slot)
      return state
   })
}

async function sustainHoldingMany(
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
   refreshHoldingTurnDialog(actor)
   return result
}

async function chooseJugglerCompanion(actor, slotIndex) {
   const state = readTemplarState(actor)
   const round = currentCombatRound()
   const turn = currentCombatTurn()
   const others = activeHoldingSlots(state).filter(
      (slot) =>
         slot.index !== slotIndex &&
         needsSustainPrompt(actor, slot, round, turn),
   )
   if (others.length === 0) return undefined
   if (others.length === 1) return others[0].index

   const buttons = others.map((slot) => ({
      id: String(slot.index),
      label: `Barrier ${slot.index + 1}: ${slot.damage} damage`,
      icon: "fa-solid fa-shield-halved",
   }))
   const choice = await TemplarChoiceDialog.prompt({
      title: "Barrier Juggler",
      content: await dialogContent({
         paragraphs: [
            textParagraph(
               `Choose one held instance to Sustain alongside Barrier ${slotIndex + 1}.`,
            ),
         ],
         facts: others.map((slot) =>
            fact(
               `Barrier ${slot.index + 1}`,
               `${slot.damage} damage, ${holdingRoundsRemaining(actor, slot)} rounds left`,
            ),
         ),
      }),
      buttons: [
         ...buttons,
         { id: "none", label: "None" },
         { id: "cancel", label: "Cancel" },
      ],
   })

   if (choice === null || choice === "cancel") return null
   if (choice === "none") return undefined
   return Number(choice)
}

async function sustainWithJuggler(actor, slotIndex, options = {}) {
   const state = readTemplarState(actor)
   const primary = state.holding[Number(slotIndex)]
   if (!primary?.active || !canSustainHoldingSlot(actor, primary)) {
      ui.notifications?.warn(
         "That holding barrier has reached its Sustain limit.",
      )
      return null
   }

   const indexes = [Number(slotIndex)]
   if (actorHasSlug(actor, TEMPLAR_SLUGS.barrierJuggler)) {
      const companion = await chooseJugglerCompanion(actor, Number(slotIndex))
      if (companion === null) return null
      if (companion !== undefined) indexes.push(companion)
   }
   return sustainHoldingMany(actor, indexes, options)
}

async function applyPhilosophyReduction(
   actor,
   slotIndexes,
   options = {},
   previousRoll = null,
) {
   const indexes = Array.isArray(slotIndexes) ? slotIndexes : [slotIndexes]
   const dc = levelBasedDC(actor)

   let roll = previousRoll
   if (!roll) {
      await playSound(TEMPLAR_ASSETS.philosophyOfDefenseSound)
      roll = await rollReligionCheck(actor, "Philosophy of Defense", dc)
      if (!roll) return null
   }

   const degree = degreeOfSuccessFromRoll(roll, dc)
   if (degree === null) {
      ui.notifications?.warn(
         "Philosophy of Defense could not read the Religion check result.",
      )
      return null
   }

   if (degree >= 2) {
      const reduction = philosophyReduction(actor)
      for (const index of indexes) {
         await reduceHeldDamage(actor, index, reduction)
      }
      return sustainHoldingMany(actor, indexes, options)
   }

   const path = heroPointPath(actor)
   const heroPoints = Number(path ? foundry.utils.getProperty(actor, path) : 0)
   const canProvidence = prepareProvidenceReroll({
      actor,
      spendFocus: false,
      applyBonus: false,
   })

   const buttons = [
      {
         id: "hero",
         label: "Reroll (Hero Point)",
         icon: "fa-solid fa-hospital-symbol",
         disabled: heroPoints <= 0,
      },
   ]

   if (canProvidence) {
      buttons.push({
         id: "providence",
         label: "Reroll (Providence)",
         icon: "fa-solid fa-sun",
      })
   }

   buttons.push({ id: "release", label: "Release", icon: "fa-solid fa-burst" })

   const choice = await TemplarChoiceDialog.prompt({
      title: "Philosophy of Defense Failed",
      content: await dialogContent({
         paragraphs: [
            textParagraph(
               "The Religion check failed. Choose whether to reroll or Release the barriers.",
            ),
         ],
         facts: [fact("Hero Points", heroPoints)],
      }),
      buttons,
   })

   if (choice === "hero") {
      if (!(await spendHeroPoint(actor))) return null
      const reroll = await rollReligionCheck(
         actor,
         "Philosophy of Defense (Hero Point)",
         dc,
      )
      return applyPhilosophyReduction(actor, indexes, options, reroll)
   }

   if (choice === "providence") {
      if (
         !prepareProvidenceReroll({ actor, spendFocus: true, applyBonus: true })
      )
         return null
      await spendFocusPoint(actor, 1)
      const reroll = await rollReligionCheck(
         actor,
         "Philosophy of Defense (Divine Reroll)",
         dc,
      )
      await completeProvidenceReroll({
         actor,
         spendFocus: false,
         message: null,
         applyReaction: false,
      })
      return applyPhilosophyReduction(actor, indexes, options, reroll)
   }

   const state = readTemplarState(actor)
   const slots = indexes
      .map((index) => state.holding[index])
      .filter((slot) => slot?.active)
   return releaseHoldingSlotsMerged(actor, slots, {
      messageTitle: "Philosophy of Defense Failed",
   })
}

async function philosophyWithJuggler(actor, slotIndex, options = {}) {
   const state = readTemplarState(actor)
   const primary = state.holding[Number(slotIndex)]
   if (!primary?.active || !canSustainHoldingSlot(actor, primary)) {
      ui.notifications?.warn(
         "That holding barrier has reached its Sustain limit.",
      )
      return null
   }

   const indexes = [Number(slotIndex)]
   if (actorHasSlug(actor, TEMPLAR_SLUGS.barrierJuggler)) {
      const companion = await chooseJugglerCompanion(actor, Number(slotIndex))
      if (companion === null) return null
      if (companion !== undefined) indexes.push(companion)
   }
   return applyPhilosophyReduction(actor, indexes, options)
}

async function openPhilosophySustainDialog(actor, slotIndex) {
   const { slot } = slotByIndex(actor, slotIndex)
   if (!slot?.active) return null
   const reduction = philosophyReduction(actor)
   const choice = await TemplarChoiceDialog.prompt({
      title: "Philosophy of Defense",
      content: await dialogContent({
         paragraphs: [
            textParagraph(
               "You can Sustain normally, or attempt Religion against your level-based DC to bleed energy from the barrier.",
            ),
            textParagraph(
               `Reduction uses the higher of your holding barrier rank (${spellRankForActor(actor)}) or Religion proficiency bonus (${religionProficiencyBonus(actor)}): ${reduction}.`,
            ),
         ],
         facts: slotSummaryFacts(actor, slot, { includeReduction: true }),
      }),
      buttons: [
         { id: "sustain", label: "Sustain", icon: "fa-solid fa-arrows-rotate" },
         {
            id: "reduce",
            label: "Reduce Damage",
            icon: "fa-solid fa-hand-holding-droplet",
         },
         { id: "cancel", label: "Cancel" },
      ],
   })

   if (choice === "sustain") return sustainWithJuggler(actor, Number(slotIndex))
   if (choice === "reduce")
      return applyPhilosophyReduction(actor, Number(slotIndex))
   return null
}

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

function holdingIndicator(state) {
   return state.holding
      .map((slot) => (slot.active || slot.releasing ? "F" : "E"))
      .join(" / ")
}

function damageContextFacts(context) {
   const types = (context.damageTypes ?? ["untyped"])
      .map(damageTypeLabel)
      .join(", ")
   return [fact("Incoming Damage", context.total), fact("Damage Type", types)]
}

async function damageContextSummary(context) {
   return dialogContent({ facts: damageContextFacts(context) })
}

async function reactionPreview(actor, action, context) {
   const state = readTemplarState(actor)
   const barrier = effectiveBarrier(state) ?? {
      name: "Light Barrier",
      value: state.light.value,
      max: state.light.max,
      hardness: state.light.hardness,
   }
   const hardness = barrier.hardness
   const barrierDamage = Math.max(0, context.total - hardness)
   const nextBarrier = Math.max(0, barrier.value - barrierDamage)
   const burst = lightBurstDetails(actor)
   const focus = Number(actor.system?.resources?.focus?.value ?? 0)

   if (action === "shieldBlock") {
      const shield = actor.attributes?.shield
      return dialogContent({
         paragraphs: [
            textParagraph(
               "Your raised shield handles this damage with PF2e's normal Shield Block automation.",
            ),
         ],
         facts: [
            fact("Shield", shield?.name ?? "Raised Shield"),
            fact("Hardness", shield?.hardness ?? 0),
         ],
      })
   }

   if (action === "holdingBarrier") {
      const hasDefenseMaster = actorHasSlug(actor, TEMPLAR_SLUGS.defenseMaster)
      return dialogContent({
         paragraphs: [
            textParagraph(
               "Holding Barrier prevents this damage. Your active barrier loses HP after Hardness, then stores the full unreduced damage if it survives.",
            ),
            textParagraph(
               hasDefenseMaster
                  ? "Because you have Defense Master, the held damage keeps its actual damage type for Barrier Release."
                  : "Without Defense Master, Barrier Release is stored as untyped damage that bypasses immunities, weaknesses, and resistances.",
            ),
         ],
         facts: [
            ...damageContextFacts(context),
            fact("Active Barrier", barrier.name),
            fact("Barrier Damage", barrierDamage),
            fact("Barrier After", `${nextBarrier} / ${barrier.max}`),
            fact("Stored Damage", context.total),
         ],
      })
   }

   if (action === "lightBurst") {
      return dialogContent({
         paragraphs: [
            textParagraph(
               "You take the triggering damage normally. Your Light Barrier also takes it, applying Hardness, then erupts.",
            ),
         ],
         facts: [
            fact("Active Barrier", barrier.name),
            fact("Barrier Damage", barrierDamage),
            fact("Barrier After", `${nextBarrier} / ${barrier.max}`),
            fact("Area", `${burst.radius}-foot emanation`),
            fact(
               "Burst Damage",
               `${burst.dice}d6 fire + ${burst.dice}d6 spirit`,
            ),
            fact("Save", `Basic Reflex vs ${dcText(burst.dc)}`),
            fact("Darkness Counteract", `Rank ${burst.counteractRank}`),
         ],
      })
   }

   if (action === "inculpation") {
      return dialogContent({
         paragraphs: [
            textParagraph(
               "Inculpation functions as Light Burst against only the triggering creature, then applies its dazzled/blinded rider by Reflex save result.",
            ),
         ],
         facts: [
            fact("Focus Points", focus),
            fact("Active Barrier", barrier.name),
            fact("Barrier Damage", barrierDamage),
            fact("Barrier After", `${nextBarrier} / ${barrier.max}`),
            fact(
               "Target Damage",
               `${burst.dice}d6 fire + ${burst.dice}d6 spirit`,
            ),
         ],
      })
   }

   return dialogContent({
      paragraphs: [
         textParagraph(
            "Reactive Barrier interposes your Light Barrier. The barrier and you each take the remaining damage after Hardness.",
         ),
      ],
      facts: [
         fact("Active Barrier", barrier.name),
         fact("Hardness", hardness),
         fact("Barrier Damage", barrierDamage),
         fact("Actor Damage", barrierDamage),
         fact("Barrier After", `${nextBarrier} / ${barrier.max}`),
      ],
   })
}

async function barrierReactionOptions(
   actor,
   context,
   { allowShieldBlock = false, guardian = false } = {},
) {
   const state = readTemplarState(actor)
   const available = barrierAbilityAvailable(state)
   const reactionAvailable = canUseTemplarReaction(actor, { notify: false })
   const canUsePhysicalBarrier = canUsePhysicalBarrierAgainstDamage(
      actor,
      context,
   )
   const canUseReactiveHolding = canUseReactiveOrHoldingAgainstDamage(
      actor,
      context,
   )
   const canHoldOrReplace = state.holding.some(
      (slot) =>
         (!slot.active && !slot.releasing && !slot.released) ||
         (slot.active && !slot.releasing),
   )
   const options = []

   if (allowShieldBlock && !guardian && actorHasOrdinaryRaisedShield(actor)) {
      options.push({
         id: "shieldBlock",
         label: "Shield Block",
         preview: await reactionPreview(actor, "shieldBlock", context),
      })
   }

   if (available && reactionAvailable && canUseReactiveHolding) {
      options.push({
         id: "reactiveBarrier",
         label: "Reactive Barrier",
         preview: await reactionPreview(actor, "reactiveBarrier", context),
      })
   }

   if (
      !guardian &&
      available &&
      reactionAvailable &&
      canUseReactiveHolding &&
      actorHasSlug(actor, TEMPLAR_SLUGS.holdingBarrier)
   ) {
      options.push({
         id: "holdingBarrier",
         label: `Holding Barrier [${holdingIndicator(state)}]`,
         disabled: !canHoldOrReplace,
         preview: await reactionPreview(actor, "holdingBarrier", context),
      })
   }

   if (
      !guardian &&
      available &&
      reactionAvailable &&
      canUsePhysicalBarrier &&
      actorHasSlug(actor, TEMPLAR_SLUGS.lightBurst)
   ) {
      const used = burstOrInculpationLockoutLabel(actor)
      options.push({
         id: "lightBurst",
         label: used ? `Light Burst (${used})` : "Light Burst",
         disabled: Boolean(used),
         preview: await reactionPreview(actor, "lightBurst", context),
      })
   }

   if (
      !guardian &&
      available &&
      reactionAvailable &&
      canUsePhysicalBarrier &&
      actorHasSlug(actor, TEMPLAR_SLUGS.inculpation)
   ) {
      const used = burstOrInculpationLockoutLabel(actor)
      options.push({
         id: "inculpation",
         label: used ? `Inculpation (${used})` : "Inculpation",
         disabled: Boolean(used),
         preview: await reactionPreview(actor, "inculpation", context),
      })
   }

   return options
}

export async function chooseBarrierReaction({
   actor,
   damageContext,
   allowShieldBlock = false,
   guardian = false,
   title = "Templar Barrier",
} = {}) {
   const resolved = getActor(actor)
   if (!resolved || !damageContext) return null
   const options = await barrierReactionOptions(resolved, damageContext, {
      allowShieldBlock,
      guardian,
   })
   const enabled = options.filter((option) => !option.disabled)
   const canRefract =
      !guardian && damageContext.isCritical && hasRefractionAvailable(resolved)

   if (enabled.length === 0 && !canRefract) {
      const isEligible =
         canUsePhysicalBarrierAgainstDamage(resolved, damageContext) ||
         canUseReactiveOrHoldingAgainstDamage(resolved, damageContext)
      if (isEligible && !canUseTemplarReaction(resolved, { notify: false })) {
         warnReactionUsed(resolved)
      }
      return null
   }

   const hasOptionalBarrier =
      actorHasSlug(resolved, TEMPLAR_SLUGS.holdingBarrier) ||
      actorHasSlug(resolved, TEMPLAR_SLUGS.lightBurst) ||
      actorHasSlug(resolved, TEMPLAR_SLUGS.inculpation)
   if (
      !allowShieldBlock &&
      !hasOptionalBarrier &&
      enabled.length === 1 &&
      !canRefract
   ) {
      return enabled[0].id
   }

   requestBarrierPanel(resolved)
   return TemplarSelectDialog.prompt({
      title,
      label: "Reaction",
      intro: await dialogContent({
         paragraphs: [
            textParagraph(
               "Choose how your defenses answer the incoming damage.",
            ),
         ],
         facts: damageContextFacts(damageContext),
      }),
      options,
      actionButtons: canRefract
         ? [
              {
                 id: "refraction",
                 label: "Refraction",
                 icon: "fa-solid fa-shield-cat",
              },
           ]
         : [],
      confirmLabel: "Use",
   })
}

export async function chooseAsSafeAsChurchReaction({
   ally,
   damageContext,
   protectedToken = null,
   assumePhysical = false,
} = {}) {
   const protectedActor = getActor(ally)
   if (!protectedActor || !damageContext) return null
   const candidates = adjacentAsSafeTemplars(protectedActor, damageContext, {
      protectedToken,
      assumePhysical,
   })
   if (candidates.length === 0) return null

   let templar = candidates[0]
   if (candidates.length > 1) {
      const choice = await TemplarSelectDialog.prompt({
         title: "As Safe as Church",
         label: "Templar",
         intro: await dialogContent({
            paragraphs: [
               textParagraph(
                  `${protectedActor.name} is adjacent to multiple Templars who can intercept this damage.`,
               ),
            ],
            facts: damageContextFacts(damageContext),
         }),
         options: candidates.map((candidate) => ({
            id: candidate.uuid ?? candidate.id,
            label: candidate.name,
            preview: "",
         })),
         confirmLabel: "Choose",
      })
      if (!choice) return null
      templar =
         candidates.find((candidate) =>
            [candidate.uuid, candidate.id].includes(choice),
         ) ?? null
      if (!templar) return null
   }

   const reaction = await chooseBarrierReaction({
      actor: templar,
      damageContext,
      guardian: true,
      title: "As Safe as Church",
   })
   if (!reaction) return null
   return { templar, reaction }
}

async function markBarrierDestroyed(actor, state) {
   state.light.value = 0
   state.light.breaking = true
   state.light.broken = false
   state.light.lingering = true
   state.light.shatteredRound = currentCombatRound()
   state.light.shatteredTurn = currentCombatTurn()
   state.rallying.active = false
   state.advent.active = false
   await writeTemplarState(actor, state)
   const sounds = TEMPLAR_ASSETS.breakSounds
   await playSound(sounds[Math.floor(Math.random() * sounds.length)])
   await sleep(RELEASE_ICON_SWAP_MS)
   const fresh = readTemplarState(actor)
   fresh.light.value = 0
   fresh.light.broken = true
   fresh.light.lingering = true
   fresh.light.shatteredRound = state.light.shatteredRound
   fresh.light.shatteredTurn = state.light.shatteredTurn
   fresh.rallying.active = false
   fresh.advent.active = false
   fresh.light.breaking = true
   await writeTemplarState(actor, fresh)
   await sleep(RELEASE_FLASH_TAIL_MS)
   const settled = readTemplarState(actor)
   settled.light.value = 0
   settled.light.breaking = false
   settled.light.broken = true
   settled.light.lingering = true
   settled.light.shatteredRound = state.light.shatteredRound
   settled.light.shatteredTurn = state.light.shatteredTurn
   settled.rallying.active = false
   settled.advent.active = false
   const result = await writeTemplarState(actor, settled)
   await setLinkedTemplarEffect(actor, LINKED_TEMPLAR_EFFECTS.advent, false)
   await removeAdventResistanceEffects(actor)
   await applyLingeringBarrierEffect(
      actor,
      Number(state.damagedSinceLastTurn?.previousHp) ||
         Number(state.light.max) ||
         0,
   )
   await releaseHoldingBarriersAfterLightDestroyed(actor)
   return result
}

async function releaseHoldingBarriersAfterLightDestroyed(actor) {
   const state = readTemplarState(actor)
   if (stateBrilliantShardIntact(state)) return []
   const slots = activeHoldingSlots(state)
   return releaseHoldingSlotsMerged(actor, slots, {
      messageTitle: "Light Barrier Shattered",
   })
}

async function finalizeBrokenBrilliantShard(actor, result) {
   stopLoopSound(brilliantShardLoopKey(actor))
   await playRandomSound(TEMPLAR_ASSETS.breakSounds)
   const state = readTemplarState(actor)
   state.brilliantShard.active = false
   state.brilliantShard.broken = true
   state.light.value = 0
   state.light.broken = true
   state.light.breaking = false
   state.light.lingering = true
   state.light.shatteredRound = currentCombatRound()
   state.light.shatteredTurn = currentCombatTurn()
   await writeTemplarState(actor, state)
   await removeBrilliantShardEffect(actor)
   await applyLingeringBarrierEffect(
      actor,
      Number(result?.previousHp ?? state.damagedSinceLastTurn?.previousHp) || 0,
   )
   requestBarrierPanel(actor)
}

export async function ensureTemplarState({ actor } = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   return writeTemplarState(resolved, readTemplarState(resolved))
}

export async function resetTemplarState({ actor } = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   return unsetTemplarState(resolved)
}

export async function setLightBarrierHp({ actor, value } = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   const current = readTemplarState(resolved)
   const max = calculateLightBarrier(resolved).max
   const nextValue =
      value === undefined || value === null
         ? await promptNumber({
              title: "Set Light Barrier HP",
              label: "Current HP",
              value: current.light.value,
              min: 0,
           })
         : Number(value)
   if (nextValue === null || !Number.isFinite(nextValue)) return null

   const wasBroken = current.light.value <= 0 || current.light.broken
   current.light.value = clamp(nextValue, 0, max)
   current.light.broken = current.light.value <= 0
   current.light.breaking = false
   if (current.light.value > 0) {
      current.light.lingering = false
      current.light.shatteredRound = null
      current.light.shatteredTurn = null
      await deleteEffectsBySlugs(resolved, [
         LINGERING_BARRIER_SLUG,
         "lingering-barrier",
      ])
   }
   current.light.restoring = wasBroken && current.light.value > 0
   await writeTemplarState(resolved, current)

   if (current.light.restoring) {
      await sleep(850)
      const fresh = readTemplarState(resolved)
      fresh.light.restoring = false
      await writeTemplarState(resolved, fresh)
   }
   return readTemplarState(resolved)
}

export async function restoreLightBarrier({ actor } = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   return setLightBarrierHp({
      actor: resolved,
      value: calculateLightBarrier(resolved).max,
   })
}

export async function restoreLightBarrierForNight({ actor } = {}) {
   const resolved = getActor(actor)
   if (!resolved || !actorHasSlug(resolved, TEMPLAR_SLUGS.dedication))
      return null
   const barrier = calculateLightBarrier(resolved)
   const state = readTemplarState(resolved)
   state.light.value = barrier.max
   state.light.max = barrier.max
   state.light.hardness = barrier.hardness
   state.light.baseHardness = barrier.hardness
   state.light.broken = false
   state.light.breaking = false
   state.light.restoring = false
   state.light.lingering = false
   state.light.shatteredRound = null
   state.light.shatteredTurn = null
   state.holding = []
   state.rallying.active = false
   state.rallying.transitioning = false
   state.advent.active = false
   state.advent.transitioning = false
   state.brilliantShard.active = false
   state.brilliantShard.value = 0
   state.brilliantShard.max = 0
   state.brilliantShard.baseHardness = 0
   state.brilliantShard.hardness = 0
   state.brilliantShard.broken = false
   state.damagedSinceLastTurn = {
      round: null,
      turn: null,
      timestamp: null,
      previousHp: 0,
   }
   state.repairLockedUntil = 0
   state.cooldowns = {}
   const result = await writeTemplarState(resolved, state)
   await setLinkedTemplarEffect(
      resolved,
      LINKED_TEMPLAR_EFFECTS.brilliantShard,
      false,
   )
   await removeBrilliantShardItem(resolved)
   await setLinkedTemplarEffect(resolved, LINKED_TEMPLAR_EFFECTS.advent, false)
   await removeAdventResistanceEffects(resolved)
   await syncSustainedHoldingEffect(resolved, 0)
   return result
}

export async function repairLightBarrier({ actor, amount } = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   const current = readTemplarState(resolved)
   const remainingLockMs = Math.max(
      0,
      Number(current.repairLockedUntil ?? 0) - Date.now(),
   )
   if (actorEffectBySlug(resolved, ["effect-last-redoubt-restriction"])) {
      ui.notifications?.warn(
         "Last Redoubt Restriction prevents repairing your Light Barrier.",
      )
      return null
   }
   const repairsShard = stateBrilliantShardIntact(current)
   const max = repairsShard
      ? current.brilliantShard.max
      : calculateLightBarrier(resolved).max
   const currentValue = repairsShard
      ? current.brilliantShard.value
      : current.light.value
   const repairAmount =
      amount === undefined || amount === null
         ? await promptNumber({
              title: repairsShard
                 ? "Repair Brilliant Shard"
                 : "Repair Light Barrier",
              label: "HP restored",
              value: Math.max(1, max - currentValue),
              min: 0,
           })
         : Number(amount)
   if (repairAmount === null || !Number.isFinite(repairAmount)) return null
   if (repairsShard) {
      current.brilliantShard.value = clamp(currentValue + repairAmount, 0, max)
      current.brilliantShard.broken =
         current.brilliantShard.value <= brilliantShardBrokenThreshold(current)
      current.brilliantShard.active = !current.brilliantShard.broken
      const result = await writeTemplarState(resolved, current)
      if (!result.brilliantShard.active)
         await removeBrilliantShardEffect(resolved)
      else await syncBrilliantShardItem(resolved)
      return result
   }
   return setLightBarrierHp({
      actor: resolved,
      value: current.light.value + repairAmount,
   })
}

async function applyBarrierHealing(actor, amount) {
   const state = readTemplarState(actor)
   const repairsShard = stateBrilliantShardIntact(state)
   const targetName = repairsShard ? "Brilliant Shard" : "Light Barrier"
   const max = repairsShard
      ? Number(state.brilliantShard.max)
      : calculateLightBarrier(actor).max
   const before = repairsShard
      ? Number(state.brilliantShard.value)
      : Number(state.light.value)
   const healing = Math.max(0, Math.trunc(Number(amount) || 0))
   const after = clamp(before + healing, 0, max)
   const healed = Math.max(0, after - before)

   if (repairsShard) {
      state.brilliantShard.value = after
      state.brilliantShard.broken =
         after <= brilliantShardBrokenThreshold(state)
      state.brilliantShard.active = !state.brilliantShard.broken
      const result = await writeTemplarState(actor, state)
      if (!result.brilliantShard.active) await removeBrilliantShardEffect(actor)
      else await syncBrilliantShardItem(actor)
      requestBarrierPanel(actor)
      return { result, targetName, before, healed, after, max }
   }

   const result = await setLightBarrierHp({ actor, value: after })
   requestBarrierPanel(actor)
   return { result, targetName, before, healed, after, max }
}

export async function repentance({
   actor,
   amount,
   spendFocus = true,
   fromSpellMessage = false,
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   if (!featureDetected(resolved, TEMPLAR_SLUGS.repentance, fromSpellMessage)) {
      ui.notifications?.warn("Repentance was not detected on this actor.")
      return null
   }

   const symbols = actorItemArray(resolved).filter((item) => {
      const slug = slugify(item.slug ?? item.system?.slug ?? item.name)
      return (
         slug === "religious-symbol-silver" ||
         slug === "religious-symbol-wooden"
      )
   })

   if (!symbols.length) {
      ui.notifications?.warn(
         "Repentance requires a silver or wooden religious symbol.",
      )
      return null
   }

   const state = readTemplarState(resolved)
   const remainingLockMs = Math.max(
      0,
      Number(state.repairLockedUntil ?? 0) - Date.now(),
   )
   if (remainingLockMs > 0) {
      ui.notifications?.warn(
         `Last Redoubt prevents repairing your Light Barrier for ${Math.ceil(remainingLockMs / 60000)} more minute(s).`,
      )
      return null
   }
   if (spendFocus && !(await spendFocusPoint(resolved))) return null
   await playSound(TEMPLAR_ASSETS.repentanceSound)
   await releaseHeldForBarrierTrait(resolved, "Repentance")
   await emitTemplarLight(resolved)

   const wearingSilver = symbols.some((item) => {
      const slug = slugify(item.slug ?? item.system?.slug ?? item.name)
      const isWorn =
         item.isEquipped ||
         item.system?.equipped?.carryType === "worn" ||
         item.system?.equipped?.carryType === "held"
      return slug === "religious-symbol-silver" && isWorn
   })

   const modifiers = []
   if (wearingSilver && game.pf2e?.Modifier) {
      modifiers.push(
         new game.pf2e.Modifier({
            slug: "silver-symbol",
            label: "Silver Symbol",
            modifier: 1,
            type: "item",
         }),
      )
   }

   const dc = levelBasedDC(resolved)
   const roll = await rollReligionCheck(resolved, "Repentance", dc, {
      extraRollOptions: ["action:repentance", "templar:repentance"],
      skipDialog: false,
      modifiers,
   })

   if (!roll) return null
   const degree = degreeOfSuccessFromRoll(roll, dc)
   if (degree === null) {
      ui.notifications?.warn(
         "Repentance could not read the Religion check result.",
      )
      return null
   }

   const healing =
      amount === undefined || amount === null
         ? repairHealingForDegree(resolved, degree)
         : Number(amount)
   const repair = await applyBarrierHealing(resolved, healing)
   if (!repair) return null

   await postTemplarMessage(
      resolved,
      "Repentance",
      `${degreeLabel(degree)}. ${repair.targetName}: ${repair.before}/${repair.max} -> ${repair.after}/${repair.max} (+${repair.healed} HP).`,
   )
   return repair.result
}

export async function damageLightBarrier({
   actor,
   damage,
   applyHardness = true,
   label = "Light Barrier",
   postMessage = true,
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   const state = readTemplarState(resolved)
   if (!barrierAbilityAvailable(state)) {
      warnBarrierDestroyed()
      return null
   }
   const barrier = effectiveBarrier(state)
   requestBarrierPanel(resolved)
   const incoming =
      damage === undefined || damage === null
         ? await promptNumber({
              title: "Incoming damage = 0",
              titleForValue: (value) =>
                 `Incoming damage = ${Math.max(
                    0,
                    Math.trunc(Number(value) || 0) -
                       (applyHardness ? (barrier?.hardness ?? 0) : 0),
                 )}`,
              label: "Incoming damage",
              value: 0,
              min: 0,
           })
         : Number(damage)
   if (incoming === null || !Number.isFinite(incoming)) return null

   const result = applyEffectiveBarrierDamageToState(state, incoming, {
      applyHardness,
   })
   if (!result) {
      warnBarrierDestroyed()
      return null
   }

   if (result.barrierDamage > 0)
      await playRandomSound(TEMPLAR_ASSETS.shatterSounds)

   if (result.targetKey === "light" && result.destroyed) {
      await markBarrierDestroyed(resolved, state)
   } else {
      await writeTemplarState(resolved, state)
      if (result.targetKey === "brilliantShard" && result.destroyed) {
         await finalizeBrokenBrilliantShard(resolved, result)
      } else if (result.targetKey === "brilliantShard") {
         await syncBrilliantShardItem(resolved)
      }
   }
   if (!result.destroyed) await applyBarrierDamagedEffect(resolved, result)

   if (postMessage) {
      await postTemplarMessage(
         resolved,
         label,
         `${barrier?.name ?? result.targetName} took incoming damage ${result.incoming}. Barrier damage ${result.barrierDamage}. Hardness absorbed ${result.prevented}.`,
      )
      if (result.targetKey === "brilliantShard" && result.destroyed) {
         await postTemplarMessage(
            resolved,
            "Brilliant Shard",
            "The Brilliant Shard became Broken and shattered into Lingering fragments.",
         )
      }
   }

   return {
      actor: resolved,
      ...result,
   }
}

export async function breakLightBarrier({ actor } = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   const state = readTemplarState(resolved)
   if (state.light.value <= 0) return writeTemplarState(resolved, state)
   state.damagedSinceLastTurn = {
      round: currentCombatRound(),
      turn: currentCombatTurn(),
      timestamp: Date.now(),
      previousHp: state.light.value,
   }
   requestBarrierPanel(resolved)
   await applyBarrierDamagedEffect(resolved, {
      barrierDamage: state.light.value,
   })
   return markBarrierDestroyed(resolved, state)
}

export async function clearExpiredLingering({
   actor,
   round = currentCombatRound(),
   turn = currentCombatTurn(),
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   const state = readTemplarState(resolved)
   if (!stateLightBarrierLingering(state)) return state
   const shatteredThisTurn =
      state.light.shatteredRound === round && state.light.shatteredTurn === turn
   if (shatteredThisTurn) return state

   state.light.lingering = false
   await writeTemplarState(resolved, state)
   await postTemplarMessage(
      resolved,
      "Light Barrier",
      "Lingering fragments fade. The Shattered Light Barrier is no longer Lingering.",
   )
   return readTemplarState(resolved)
}

export async function reactiveBarrier(options = {}) {
   return reactiveBarrierBase({
      ...options,
      damageLightBarrier,
   })
}

export async function lightBurst(options = {}) {
   return lightBurstBase({
      ...options,
      damageLightBarrier,
   })
}

export async function inculpation(options = {}) {
   return inculpationBase({
      ...options,
      damageLightBarrier,
   })
}

export async function holdDamage(options = {}) {
   return holdDamageBase({
      ...options,
      markBarrierDestroyed,
      finalizeBrokenBrilliantShard,
   })
}

export async function sustainHolding({ actor, slotIndex = 0 } = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   return sustainHoldingMany(resolved, [slotIndex])
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

export async function completeProvidenceReroll(options = {}) {
   return completeProvidenceRerollBase({
      ...options,
      damageLightBarrier,
   })
}

export async function providence(options = {}) {
   return providenceBase({
      ...options,
      damageLightBarrier,
   })
}

export async function divineIntervention(options = {}) {
   return divineInterventionBase({
      ...options,
      damageLightBarrier,
   })
}

export async function scutumFidei(options = {}) {
   return scutumFideiBase({
      ...options,
      damageLightBarrier,
   })
}

export async function refraction(options = {}) {
   return refractionBase({
      ...options,
      completeProvidenceReroll,
   })
}

export async function lightDamping(options = {}) {
   return lightDampingBase({
      ...options,
      completeProvidenceReroll,
   })
}

export const templarActions = {
   ensureTemplarState,
   resetTemplarState,
   setLightBarrierHp,
   restoreLightBarrier,
   restoreLightBarrierForNight,
   repairLightBarrier,
   repentance,
   damageLightBarrier,
   breakLightBarrier,
   clearExpiredLingering,
   reactiveBarrier,
   lightBurst,
   lightShell,
   inculpation,
   scorchingReprisal,
   handleScorchingReprisalStrike,
   handleScorchingReprisalDamage,
   holdDamage,
   chooseBarrierReaction,
   chooseAsSafeAsChurchReaction,
   hasTemplarReactionUsed,
   damageContextFromRoll,
   splitDamageContextForBarrier,
   reduceDamageContextByAmount,
   mergeDamageContexts,
   damageFromContext,
   reduceDamageContext,
   openHoldingBarrierDialog,
   promptHoldingBarrierSustainTurn,
   releaseUnsustainedHoldingBarriers,
   setHoldingTurnDecision,
   openHoldingTurnDecisionDialog,
   openPrevailDialog,
   sustainHolding,
   editHeldDamage,
   releaseHolding,
   releaseLargestHolding,
   setBrilliantShard,
   toggleBrilliantShard,
   brilliantShard,
   confirmBrilliantShardItemDelete,
   confirmBrilliantShardItemUpdate,
   setAdvent,
   toggleAdvent,
   advent,
   refreshAdventResistance,
   setRallying,
   toggleRallying,
   syncLinkedTemplarEffect,
   cleanupLegacyGeneratedTemplarActions,
   heatLightning,
   lastStronghold,
   checkLastRedoubtBadge,
   executeLastRedoubtEnhancement,
   providence,
   prepareProvidenceReroll,
   completeProvidenceReroll,
   providenceBonus,
   divineIntervention,
   flagellation,
   scutumFidei,
   refraction,
   lightDamping,
   emitTemplarLight,
   counteract,
   rollLightBurstSaveFromCard,
   regularizedCriticalDamageContext,
   prevail,
   spendFocusPoint,
   lightGaol,
   blindingBlade,
   postBlindingBladeUseCard,
   rollLightGaolSaveFromCard,
   rollBlindingBladeSaveFromCard,
}
