import { TEMPLAR_ASSETS } from "./constants.mjs"
import {
   readTemplarState,
   writeTemplarState,
} from "./state.mjs"
import { getActor } from "./actors.mjs"
import { effectiveBarrier } from "./barrier/state.mjs"
import { playSound } from "./audio.mjs"
import { releaseHolding } from "./holding/release.mjs"

export async function prevail({ actor, slotIndex = 0 } = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   const state = readTemplarState(resolved)
   const slot = state.holding[Number(slotIndex)]
   if (!slot?.active) return null
   const barrier = effectiveBarrier(state) ?? { hardness: state.light.hardness }
   const reduction = Math.max(0, Number(barrier.hardness) || 0)
   slot.damage = Math.max(0, slot.damage - reduction)
   await writeTemplarState(resolved, state)
   await playSound(TEMPLAR_ASSETS.prevailReleaseSound)
   return releaseHolding({ actor: resolved, slotIndex })
}
