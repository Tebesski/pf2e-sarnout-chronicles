import {
   currentCombatRound,
   currentCombatTurn,
} from "../state.mjs"
import {
   brilliantShardBrokenThreshold,
   effectiveBarrier,
} from "./state.mjs"

function clamp(value, min, max) {
   return Math.max(min, Math.min(max, value))
}

function applyLightBarrierDamageToState(
   state,
   incomingDamage,
   { applyHardness = true } = {},
) {
   const incoming = Math.max(0, Math.trunc(Number(incomingDamage) || 0))
   const hardness = state.light.hardness
   const barrierDamage = Math.max(0, incoming - (applyHardness ? hardness : 0))
   const previousHp = state.light.value
   const nextHp = clamp(previousHp - barrierDamage, 0, state.light.max)
   state.light.value = nextHp
   state.light.broken = nextHp <= 0
   state.damagedSinceLastTurn = {
      round: currentCombatRound(),
      turn: currentCombatTurn(),
      timestamp: Date.now(),
      previousHp,
   }

   return {
      incoming,
      hardness,
      barrierDamage,
      prevented: applyHardness ? Math.min(incoming, hardness) : 0,
      previousHp,
      currentHp: nextHp,
      destroyed: nextHp <= 0 && previousHp > 0,
   }
}

function applyBrilliantShardDamageToState(
   state,
   incomingDamage,
   { applyHardness = true } = {},
) {
   const incoming = Math.max(0, Math.trunc(Number(incomingDamage) || 0))
   const hardness = state.brilliantShard.hardness
   const barrierDamage = Math.max(0, incoming - (applyHardness ? hardness : 0))
   const previousHp = state.brilliantShard.value
   const nextHp = clamp(previousHp - barrierDamage, 0, state.brilliantShard.max)
   const brokenThreshold = brilliantShardBrokenThreshold(state)
   const wasBroken = previousHp <= brokenThreshold
   const isBroken = nextHp <= brokenThreshold
   state.brilliantShard.value = nextHp
   state.brilliantShard.broken = isBroken
   if (isBroken) {
      state.brilliantShard.active = false
      state.light.value = 0
      state.light.broken = true
      state.light.breaking = false
      state.light.lingering = true
      state.light.shatteredRound = currentCombatRound()
      state.light.shatteredTurn = currentCombatTurn()
   }
   state.damagedSinceLastTurn = {
      round: currentCombatRound(),
      turn: currentCombatTurn(),
      timestamp: Date.now(),
      previousHp,
   }

   return {
      targetKey: "brilliantShard",
      targetName: "Brilliant Shard",
      incoming,
      hardness,
      barrierDamage,
      prevented: applyHardness ? Math.min(incoming, hardness) : 0,
      previousHp,
      currentHp: nextHp,
      brokenThreshold,
      destroyed: isBroken && !wasBroken,
   }
}

export function applyEffectiveBarrierDamageToState(
   state,
   incomingDamage,
   { applyHardness = true } = {},
) {
   const barrier = effectiveBarrier(state)
   if (!barrier) return null
   if (barrier.key === "brilliantShard") {
      return applyBrilliantShardDamageToState(state, incomingDamage, {
         applyHardness,
      })
   }
   return {
      targetKey: "light",
      targetName: "Light Barrier",
      ...applyLightBarrierDamageToState(state, incomingDamage, {
         applyHardness,
      }),
   }
}
