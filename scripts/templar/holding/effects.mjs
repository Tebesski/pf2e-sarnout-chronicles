import {
   SUSTAINED_HOLDING_SLUG,
   TEMPLAR_ASSETS,
} from "../constants.mjs"
import { localize } from "../i18n.mjs"
import { sustainedHoldingEffect } from "./turn-state.mjs"

export async function syncSustainedHoldingEffect(actor, value) {
   const count = Math.max(0, Math.trunc(Number(value) || 0))
   if (!actor?.createEmbeddedDocuments) return null
   const effect = sustainedHoldingEffect(actor)
   if (count <= 0) {
      if (effect?.delete) await effect.delete()
      return null
   }

   const update = {
      "system.badge": { type: "counter", value: count },
      "system.duration.value": 1,
      "system.duration.unit": "rounds",
      "system.duration.expiry": "turn-start",
   }
   if (effect?.update) return effect.update(update)

   try {
      const [created] = await actor.createEmbeddedDocuments("Item", [
         {
            name: localize(
               "PF2ESC.Templar.Holding.SustainedEffect.Name",
               "Sustained: Holding Barrier",
            ),
            type: "effect",
            img: TEMPLAR_ASSETS.holding,
            system: {
               slug: SUSTAINED_HOLDING_SLUG,
               badge: { type: "counter", value: count },
               duration: { value: 1, unit: "rounds", expiry: "turn-start" },
               description: {
                  value: localize(
                     "PF2ESC.Templar.Holding.SustainedEffect.Description",
                     "Tracks how many holding barrier instances were Sustained this turn.",
                  ),
               },
            },
         },
      ])
      return created ?? null
   } catch (_error) {
      return null
   }
}
