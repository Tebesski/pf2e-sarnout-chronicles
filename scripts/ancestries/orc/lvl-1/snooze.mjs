import {
   MODULE_ID,
   actorHasSlug,
   abilityChargeValue,
   createOrRefreshEffect,
   ownedOrControlledActor,
   spendAbilityCharge,
   warn,
} from "../../hadaganian/helpers.mjs"

const SNOOZE_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/orc/NecromancerSleepingDropsy.(UITexture).png"

export async function snooze({ actor } = {}) {
   const resolved = ownedOrControlledActor(actor, "Orc")
   if (!resolved) return null
   if (!actorHasSlug(resolved, "snooze")) return warn("Snooze feat not found.")
   if (
      abilityChargeValue(resolved, ["snooze"]).hasFrequency &&
      !(await spendAbilityCharge(resolved, ["snooze"], "Snooze"))
   ) {
      return null
   }

   return createOrRefreshEffect(resolved, {
      name: "Effect: Snooze",
      type: "effect",
      img: SNOOZE_ICON,
      system: {
         slug: "effect-snooze",
         duration: { value: 1, unit: "hours", expiry: "turn-start" },
         description: {
            value: "<p>Temporary Hit Points from Snooze.</p>",
         },
         rules: [
            {
               key: "TempHP",
               value: "@actor.level",
            },
         ],
      },
      flags: {
         [MODULE_ID]: {
            orc: true,
            snooze: true,
         },
      },
   })
}
