import {
   LINKED_TEMPLAR_EFFECTS,
   MODULE_ID,
   RELEASE_FLASH_TAIL_MS,
   RELEASE_ICON_SWAP_MS,
   TEMPLAR_ASSETS,
} from "../constants.mjs"
import {
   currentCombatRound,
   currentCombatTurn,
   readTemplarState,
   unsetTemplarState,
   writeTemplarState,
} from "../state.mjs"
import {
   playRandomSound,
   playSound,
   stopLoopSound,
} from "../audio.mjs"
import {
   getActor,
   warnBarrierDestroyed,
} from "../actors.mjs"
import {
   brilliantShardLoopKey,
   syncBrilliantShardItem,
} from "../brilliant-shard/items.mjs"
import { removeBrilliantShardEffect } from "../brilliant-shard/actions.mjs"
import { setLinkedTemplarEffect } from "../linked-effects.mjs"
import {
   barrierAbilityAvailable,
   effectiveBarrier,
   stateBrilliantShardIntact,
   stateLightBarrierLingering,
} from "./state.mjs"
import { promptNumber } from "../dialogs.mjs"
import { postTemplarMessage } from "../messages.mjs"
import { activeHoldingSlots } from "../holding/helpers.mjs"
import { releaseHoldingSlotsMerged } from "../holding/release.mjs"
import {
   applyBarrierDamagedEffect,
   applyLingeringBarrierEffect,
} from "./effects.mjs"
import { applyEffectiveBarrierDamageToState } from "./damage-state.mjs"
import { removeAdventResistanceEffects } from "../advent.mjs"

function sleep(ms) {
   return new Promise((resolve) => setTimeout(resolve, ms))
}

function requestBarrierPanel(actor) {
   Hooks.callAll(`${MODULE_ID}.openTemplarBarrierPanel`, actor)
}

export async function markBarrierDestroyed(actor, state) {
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

export async function finalizeBrokenBrilliantShard(actor, result) {
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
