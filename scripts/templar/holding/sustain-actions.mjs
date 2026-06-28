import { TEMPLAR_ASSETS, TEMPLAR_SLUGS } from "../constants.mjs"
import {
   actorHasSlug,
   currentCombatRound,
   currentCombatTurn,
   readTemplarState,
   religionProficiencyBonus,
   spellRankForActor,
} from "../state.mjs"
import { fact, textParagraph } from "../templates.mjs"
import { levelBasedDC } from "../scaling.mjs"
import { degreeOfSuccessFromRoll } from "../rolls.mjs"
import { playSound } from "../audio.mjs"
import { getActor } from "../actors.mjs"
import { spendFocusPoint } from "../focus.mjs"
import { dialogContent, TemplarChoiceDialog } from "../dialogs.mjs"
import { prepareProvidenceReroll } from "../providence/helpers.mjs"
import { completeProvidenceReroll as completeProvidenceRerollBase } from "../providence/actions.mjs"
import { damageLightBarrier } from "../barrier/light.mjs"
import { rollReligionCheck } from "../religion.mjs"
import { heroPointPath, spendHeroPoint } from "../hero-points.mjs"
import {
   activeHoldingSlots,
   canSustainHoldingSlot,
   holdingRoundsRemaining,
   philosophyReduction,
} from "./helpers.mjs"
import { needsSustainPrompt } from "./turn-state.mjs"
import { releaseHoldingSlotsMerged } from "./release.mjs"
import { reduceHeldDamage, slotByIndex, sustainHoldingMany } from "./state-ops.mjs"

async function completeProvidenceReroll(options = {}) {
   return completeProvidenceRerollBase({
      ...options,
      damageLightBarrier,
   })
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

export async function sustainWithJuggler(actor, slotIndex, options = {}) {
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

export async function philosophyWithJuggler(actor, slotIndex, options = {}) {
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

export async function sustainHolding({ actor, slotIndex = 0 } = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   return sustainHoldingMany(resolved, [slotIndex])
}
