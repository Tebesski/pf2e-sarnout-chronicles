import {
   MODULE_ID,
   TEMPLAR_ASSETS,
} from "../constants.mjs"
import {
   currentCombatRound,
   currentCombatTurn,
   readTemplarState,
   slugify,
   writeTemplarState,
} from "../state.mjs"
import {
   getActor,
   warnBarrierDestroyed,
} from "../actors.mjs"
import { barrierAbilityAvailable } from "../barrier/state.mjs"
import {
   applyTemplarReactionUsed,
   canUseTemplarReaction,
} from "../reactions.mjs"
import { promptNumber } from "../dialogs.mjs"
import { releaseHolding } from "./release.mjs"
import { emitTemplarLight } from "../light.mjs"
import { applyEffectiveBarrierDamageToState } from "../barrier/damage-state.mjs"
import { primaryDamageType } from "../damage.mjs"
import { applyBarrierDamagedEffect } from "../barrier/effects.mjs"
import { playRandomSound } from "../audio.mjs"
import { postTemplarMessage } from "../messages.mjs"

function requestBarrierPanel(actor) {
   Hooks.callAll(`${MODULE_ID}.openTemplarBarrierPanel`, actor)
}

async function updateState(actor, updater) {
   const current = readTemplarState(actor)
   const next = (await updater(current)) ?? current
   return writeTemplarState(actor, next)
}

export async function holdDamage({
   actor,
   damage,
   slotIndex = null,
   label = "",
   damageType = "untyped",
   damageTypes = null,
   damageInstances = null,
   rollData = null,
   bypassIWR = true,
   markBarrierDestroyed,
   finalizeBrokenBrilliantShard,
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   const current = readTemplarState(resolved)
   if (!barrierAbilityAvailable(current)) {
      warnBarrierDestroyed()
      return null
   }
   if (!canUseTemplarReaction(resolved)) return null
   const held =
      damage === undefined || damage === null
         ? await promptNumber({
              title: "Holding Barrier",
              label: "Damage to hold",
              value: 1,
              min: 1,
           })
         : Number(damage)
   if (held === null || !Number.isFinite(held)) return null
   const fullHeldDamage = Math.max(0, Math.trunc(held))
   if (fullHeldDamage <= 0) {
      ui.notifications?.warn("Holding Barrier requires positive damage to hold.")
      return null
   }

   let targetIndex =
      slotIndex === null || slotIndex === undefined
         ? current.holding.findIndex(
              (slot) => !slot.active && !slot.releasing && !slot.released,
           )
         : Number(slotIndex)
   const targetSlot = current.holding[targetIndex]
   if (!targetSlot && targetIndex < 0) {
      const replacementIndex = current.holding.findIndex(
         (slot) => slot.active && !slot.releasing,
      )
      if (replacementIndex >= 0) {
         await releaseHolding({
            actor: resolved,
            slotIndex: replacementIndex,
            messageTitle: "Holding Barrier Replaced",
         })
         targetIndex = replacementIndex
      }
   } else if (targetSlot?.active && !targetSlot.releasing) {
      await releaseHolding({
         actor: resolved,
         slotIndex: targetIndex,
         messageTitle: "Holding Barrier Replaced",
      })
   }

   const latestBeforeBarrier = readTemplarState(resolved)
   if (!latestBeforeBarrier.holding[targetIndex]) {
      ui.notifications?.warn("That holding barrier slot is not available.")
      return null
   }

   requestBarrierPanel(resolved)
   await emitTemplarLight(resolved)
   let heldDamage = false
   let barrierResult = null
   const result = await updateState(resolved, (state) => {
      const index = targetIndex
      if (index < 0) {
         ui.notifications?.warn("No empty holding barrier slot is available.")
         return state
      }
      if (!state.holding[index]) {
         ui.notifications?.warn("That holding barrier slot is not available.")
         return state
      }

      if (!barrierAbilityAvailable(state)) {
         warnBarrierDestroyed()
         return state
      }

      barrierResult = applyEffectiveBarrierDamageToState(
         state,
         fullHeldDamage,
         {
            applyHardness: true,
         },
      )
      if (!barrierResult) return state
      if (barrierResult.destroyed) return state

      state.holding[index] = {
         ...state.holding[index],
         active: true,
         releasing: false,
         released: false,
         restoring: false,
         damage: fullHeldDamage,
         damageType: primaryDamageType(damageTypes ?? [damageType]),
         damageTypes: damageTypes?.length
            ? damageTypes
            : [damageType || "untyped"],
         damageInstances: Array.isArray(damageInstances)
            ? damageInstances
                 .map((instance) => ({
                    total: Math.max(
                       0,
                       Math.trunc(Number(instance?.total) || 0),
                    ),
                    type: slugify(instance?.type ?? "untyped") || "untyped",
                    formula: String(instance?.formula ?? ""),
                    persistent: Boolean(instance?.persistent),
                    precision: Boolean(instance?.precision),
                    evaluatePersistent: Boolean(instance?.evaluatePersistent),
                 }))
                 .filter((instance) => instance.total > 0)
            : null,
         rollData,
         bypassIWR: Boolean(bypassIWR),
         lastReleasedDamage: 0,
         roundsSustained: 0,
         createdRound: currentCombatRound(),
         createdTurn: currentCombatTurn(),
         lastSustainedRound: null,
         lastSustainedTurn: null,
         promptedRound: null,
         promptedTurn: null,
         turnDecision: null,
         decisionRound: null,
         decisionTurn: null,
         label: String(label ?? ""),
      }
      heldDamage = true
      return state
   })

   if (!barrierResult) return null
   if (barrierResult.barrierDamage > 0) {
      await playRandomSound(TEMPLAR_ASSETS.shatterSounds)
      await applyBarrierDamagedEffect(resolved, barrierResult)
   }
   if (barrierResult.targetKey === "light" && barrierResult.destroyed) {
      if (typeof markBarrierDestroyed !== "function") return null
      await markBarrierDestroyed(resolved, readTemplarState(resolved))
      await applyTemplarReactionUsed(resolved)
      await postTemplarMessage(
         resolved,
         label || "Holding Barrier",
         `Your Light Barrier absorbed ${fullHeldDamage} damage and was Shattered. No damage was held.`,
      )
      return readTemplarState(resolved)
   }
   if (
      barrierResult.targetKey === "brilliantShard" &&
      barrierResult.destroyed
   ) {
      if (typeof finalizeBrokenBrilliantShard !== "function") return null
      await finalizeBrokenBrilliantShard(resolved, barrierResult)
      await applyTemplarReactionUsed(resolved)
      await postTemplarMessage(
         resolved,
         label || "Holding Barrier",
         `Your Brilliant Shard absorbed ${fullHeldDamage} damage and became Broken. No damage was held.`,
      )
      return readTemplarState(resolved)
   }

   if (heldDamage && fullHeldDamage > 0 && barrierResult.barrierDamage <= 0) {
      await playRandomSound(TEMPLAR_ASSETS.shatterSounds)
   }
   if (heldDamage) requestBarrierPanel(resolved)
   if (heldDamage) {
      await postTemplarMessage(
         resolved,
         label || "Holding Barrier",
         `${barrierResult.targetName} took ${barrierResult.barrierDamage} damage after Hardness ${barrierResult.hardness}. Holding Barrier stored ${fullHeldDamage} damage.`,
      )
   }
   if (barrierResult) await applyTemplarReactionUsed(resolved)
   return result
}
