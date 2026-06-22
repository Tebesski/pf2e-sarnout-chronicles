import {
   BARRIER_DAMAGED_SLUG,
   LINGERING_BARRIER_SLUG,
} from "../constants.mjs"
import { actorEffectBySlug } from "../effects.mjs"
import { readTemplarState } from "../state.mjs"

export function lightBarrierIntact(actor) {
   const state = readTemplarState(actor)
   return state.light.value > 0 && !state.light.broken && !state.light.breaking
}

export function stateLightBarrierIntact(state) {
   return state.light.value > 0 && !state.light.broken && !state.light.breaking
}

export function brilliantShardBrokenThreshold(state) {
   return Math.floor(Math.max(0, Number(state?.brilliantShard?.max) || 0) / 2)
}

export function stateBrilliantShardIntact(state) {
   return Boolean(
      state.brilliantShard?.active &&
         state.brilliantShard.value > brilliantShardBrokenThreshold(state) &&
         !state.brilliantShard.broken,
   )
}

export function stateLightBarrierLingering(state) {
   return Boolean(state.light.broken && state.light.lingering)
}

export function actorHasLingeringBarrierEffect(actor) {
   return Boolean(
      actorEffectBySlug(actor, [LINGERING_BARRIER_SLUG, "lingering-barrier"]),
   )
}

export function actorHasBarrierDamagedEffect(actor) {
   return Boolean(
      actorEffectBySlug(actor, [BARRIER_DAMAGED_SLUG, "barrier-was-damaged"]),
   )
}

export function actorHasBarrierDamagedOrLingeringEffect(actor) {
   return (
      actorHasBarrierDamagedEffect(actor) ||
      actorHasLingeringBarrierEffect(actor)
   )
}

export function hasBarrierAlternative(state) {
   return stateBrilliantShardIntact(state)
}

export function barrierAbilityAvailable(state) {
   return stateLightBarrierIntact(state) || hasBarrierAlternative(state)
}

export function effectiveBarrier(state) {
   if (stateBrilliantShardIntact(state)) {
      return {
         key: "brilliantShard",
         name: "Brilliant Shard",
         value: state.brilliantShard.value,
         max: state.brilliantShard.max,
         hardness: state.brilliantShard.hardness,
      }
   }
   if (stateLightBarrierIntact(state)) {
      return {
         key: "light",
         name: "Light Barrier",
         value: state.light.value,
         max: state.light.max,
         hardness: state.light.hardness,
      }
   }
   return null
}
