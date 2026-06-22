import {
   BARRIER_DAMAGED_SLUG,
   INCULPATION_USED_SLUG,
   LIGHT_BURST_USED_SLUG,
   LINGERING_BARRIER_SLUG,
   MODULE_ID,
   TEMPLAR_ASSETS,
} from "../constants.mjs"
import {
   actorEffectBySlug,
   createOrRefreshEffect,
   deleteEffectsBySlugs,
} from "../effects.mjs"

function burstOrInculpationUsedEffect(actor) {
   return actorEffectBySlug(actor, [
      LIGHT_BURST_USED_SLUG,
      "light-burst-used",
      INCULPATION_USED_SLUG,
      "inculpation-used",
   ])
}

export function burstOrInculpationLockoutLabel(actor) {
   const effect = burstOrInculpationUsedEffect(actor)
   if (!effect) return null
   return (
      String(effect.name ?? "")
         .replace(/^Effect:\s*/i, "")
         .trim() || "Templar light reaction lockout"
   )
}

export function canUseBurstOrInculpation(actor, label) {
   const used = burstOrInculpationLockoutLabel(actor)
   if (!used) return true
   ui.notifications?.warn(`${label} is not ready while ${used} is active.`)
   return false
}

export async function applyLightBurstUsed(actor) {
   return createOrRefreshEffect(
      actor,
      {
         name: "Light Burst Used",
         type: "effect",
         img: TEMPLAR_ASSETS.lightBurst,
         system: {
            slug: LIGHT_BURST_USED_SLUG,
            duration: { value: 1, unit: "minutes", expiry: "turn-start" },
            description: {
               value: "Light Burst and Inculpation are unavailable while this runtime lockout effect remains active.",
            },
         },
      },
      { slugs: [LIGHT_BURST_USED_SLUG, "light-burst-used"] },
   )
}

export async function applyInculpationUsed(actor) {
   return createOrRefreshEffect(
      actor,
      {
         name: "Inculpation Used",
         type: "effect",
         img: TEMPLAR_ASSETS.inculpation,
         system: {
            slug: INCULPATION_USED_SLUG,
            duration: { value: 1, unit: "minutes", expiry: "turn-start" },
            description: {
               value: "Inculpation and Light Burst are unavailable while this runtime lockout effect remains active.",
            },
         },
      },
      { slugs: [INCULPATION_USED_SLUG, "inculpation-used"] },
   )
}

export async function applyBarrierDamagedEffect(actor, result) {
   if (!result || result.barrierDamage <= 0) return null
   return createOrRefreshEffect(
      actor,
      {
         name: "Barrier was damaged",
         type: "effect",
         img: TEMPLAR_ASSETS.prevail,
         system: {
            slug: BARRIER_DAMAGED_SLUG,
            duration: { value: 1, unit: "rounds", expiry: "turn-start" },
            description: {
               value: "The Templar's active barrier took damage during the previous round.",
            },
         },
      },
      { slugs: [BARRIER_DAMAGED_SLUG, "barrier-was-damaged"] },
   )
}

export async function applyLingeringBarrierEffect(actor, hp) {
   const value = Math.max(0, Math.trunc(Number(hp) || 0))
   await deleteEffectsBySlugs(actor, [
      BARRIER_DAMAGED_SLUG,
      "barrier-was-damaged",
   ])
   return createOrRefreshEffect(
      actor,
      {
         name: `Lingering Barrier: ${value} HP`,
         type: "effect",
         img: TEMPLAR_ASSETS.lingering,
         system: {
            slug: LINGERING_BARRIER_SLUG,
            badge: { type: "counter", value },
            duration: { value: 1, unit: "rounds", expiry: "turn-start" },
            description: {
               value: "The Light Barrier is Shattered but its fragments are Lingering until the end of the Templar's next turn.",
            },
         },
         flags: {
            [MODULE_ID]: {
               lingeringBarrierHp: value,
            },
         },
      },
      { slugs: [LINGERING_BARRIER_SLUG, "lingering-barrier"] },
   )
}
