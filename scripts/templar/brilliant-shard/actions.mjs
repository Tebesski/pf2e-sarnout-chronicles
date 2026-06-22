import {
   LINGERING_BARRIER_SLUG,
   LINKED_TEMPLAR_EFFECTS,
   MODULE_ID,
   TEMPLAR_ASSETS,
   TEMPLAR_SLUGS,
} from "../constants.mjs"
import {
   calculateBrilliantShard,
   readTemplarState,
   writeTemplarState,
} from "../state.mjs"
import {
   actorFreeHands,
   brilliantShardLoopKey,
   createOrRefreshBrilliantShardItem,
   removeBrilliantShardItem,
} from "./items.mjs"
import {
   confirmBrilliantShardItemDelete as confirmBrilliantShardItemDeleteBase,
   confirmBrilliantShardItemUpdate as confirmBrilliantShardItemUpdateBase,
} from "./confirmation.mjs"
import { deleteEffectsBySlugs } from "../effects.mjs"
import { setLinkedTemplarEffect } from "../linked-effects.mjs"
import {
   actorHasLingeringBarrierEffect,
   stateBrilliantShardIntact,
   stateLightBarrierLingering,
} from "../barrier/state.mjs"
import {
   playLoopSound,
   playSound,
   stopLoopSound,
} from "../audio.mjs"
import {
   featureDetected,
   getActor,
} from "../actors.mjs"
import { spendFocusPoint } from "../focus.mjs"

function requestBarrierPanel(actor) {
   Hooks.callAll(`${MODULE_ID}.openTemplarBarrierPanel`, actor)
}

async function updateState(actor, updater) {
   const current = readTemplarState(actor)
   const next = (await updater(current)) ?? current
   return writeTemplarState(actor, next)
}

export async function removeBrilliantShardEffect(actor) {
   stopLoopSound(brilliantShardLoopKey(actor))
   await setLinkedTemplarEffect(
      actor,
      LINKED_TEMPLAR_EFFECTS.brilliantShard,
      false,
   )
   await removeBrilliantShardItem(actor)
}

export function confirmBrilliantShardItemDelete({ item } = {}) {
   return confirmBrilliantShardItemDeleteBase({
      item,
      dismiss: (actor) => setBrilliantShard({ actor, active: false }),
   })
}

export function confirmBrilliantShardItemUpdate({ item, changes = {} } = {}) {
   return confirmBrilliantShardItemUpdateBase({
      item,
      changes,
      dismiss: (actor) => setBrilliantShard({ actor, active: false }),
   })
}

export async function setBrilliantShard({ actor, active = true } = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   const shard = calculateBrilliantShard(resolved)
   if (active) await removeBrilliantShardItem(resolved)
   const result = await updateState(resolved, (state) => {
      state.brilliantShard.active = Boolean(active)
      state.brilliantShard.max = active ? shard.max : 0
      state.brilliantShard.baseHardness = active ? shard.hardness : 0
      state.brilliantShard.hardness = active
         ? state.advent?.active
            ? Math.max(0, Math.floor(shard.hardness / 2))
            : shard.hardness
         : 0
      state.brilliantShard.value = active ? shard.max : 0
      state.brilliantShard.broken = false
      if (active) {
         state.light.lingering = false
         state.light.shatteredRound = null
         state.light.shatteredTurn = null
      }
      return state
   })
   await setLinkedTemplarEffect(
      resolved,
      LINKED_TEMPLAR_EFFECTS.brilliantShard,
      Boolean(active),
   )
   if (active) {
      await deleteEffectsBySlugs(resolved, [
         LINGERING_BARRIER_SLUG,
         "lingering-barrier",
      ])
      await createOrRefreshBrilliantShardItem(
         resolved,
         shard,
         result.brilliantShard.value,
      )
      await playLoopSound(
         brilliantShardLoopKey(resolved),
         TEMPLAR_ASSETS.brilliantShardLoopSound,
      )
   } else {
      stopLoopSound(brilliantShardLoopKey(resolved))
      await removeBrilliantShardItem(resolved)
   }
   requestBarrierPanel(resolved)
   return result
}

export async function toggleBrilliantShard({ actor } = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   const active = !readTemplarState(resolved).brilliantShard.active
   return setBrilliantShard({ actor: resolved, active })
}

export async function brilliantShard({
   actor,
   spendFocus = true,
   fromSpellMessage = false,
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   if (
      !featureDetected(resolved, TEMPLAR_SLUGS.brilliantShard, fromSpellMessage)
   ) {
      ui.notifications?.warn("Brilliant Shard was not detected on this actor.")
      return null
   }
   const state = readTemplarState(resolved)
   if (stateBrilliantShardIntact(state)) {
      ui.notifications?.warn("Brilliant Shard is already active.")
      return null
   }
   if (
      !stateLightBarrierLingering(state) &&
      !actorHasLingeringBarrierEffect(resolved)
   ) {
      ui.notifications?.warn(
         "Brilliant Shard requires Lingering Barrier to be active.",
      )
      return null
   }
   if (actorFreeHands(resolved) < 1) {
      ui.notifications?.warn("Brilliant Shard requires one free hand.")
      return null
   }
   if (spendFocus && !(await spendFocusPoint(resolved))) return null
   await playSound(TEMPLAR_ASSETS.brilliantShardSound)
   return setBrilliantShard({ actor: resolved, active: true })
}
