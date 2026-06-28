import {
   LINGERING_BARRIER_SLUG,
   LINKED_TEMPLAR_EFFECTS,
   MODULE_ID,
   TEMPLAR_ASSETS,
   TEMPLAR_SLUGS,
} from "../constants.mjs"
import {
   actorHasSlug,
   calculateLightBarrier,
   readTemplarState,
   slugify,
   writeTemplarState,
} from "../state.mjs"
import {
   degreeLabel,
   degreeOfSuccessFromRoll,
} from "../rolls.mjs"
import { levelBasedDC } from "../scaling.mjs"
import { playSound } from "../audio.mjs"
import { featureDetected, getActor } from "../actors.mjs"
import { spendFocusPoint } from "../focus.mjs"
import { actorItemArray } from "../items.mjs"
import {
   removeBrilliantShardItem,
   syncBrilliantShardItem,
} from "../brilliant-shard/items.mjs"
import { removeBrilliantShardEffect } from "../brilliant-shard/actions.mjs"
import {
   actorEffectBySlug,
   deleteEffectsBySlugs,
} from "../effects.mjs"
import { setLinkedTemplarEffect } from "../linked-effects.mjs"
import {
   brilliantShardBrokenThreshold,
   stateBrilliantShardIntact,
} from "./state.mjs"
import { promptNumber } from "../dialogs.mjs"
import { postTemplarMessage } from "../messages.mjs"
import { emitTemplarLight } from "../light.mjs"
import { releaseHeldForBarrierTrait } from "../holding/release.mjs"
import { syncSustainedHoldingEffect } from "../holding/effects.mjs"
import {
   repairHealingForDegree,
   rollReligionCheck,
} from "../religion.mjs"
import { removeAdventResistanceEffects } from "../advent.mjs"

function clamp(value, min, max) {
   return Math.max(min, Math.min(max, value))
}

function sleep(ms) {
   return new Promise((resolve) => setTimeout(resolve, ms))
}

function requestBarrierPanel(actor) {
   Hooks.callAll(`${MODULE_ID}.openTemplarBarrierPanel`, actor)
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
