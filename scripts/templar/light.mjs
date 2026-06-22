import {
   TEMPLAR_ASSETS,
   TEMPLAR_LIGHT_SLUG,
} from "./constants.mjs"
import { readTemplarState } from "./state.mjs"
import { barrierAbilityAvailable } from "./barrier/state.mjs"
import { createOrRefreshEffect } from "./effects.mjs"

export async function emitTemplarLight(actor) {
   if (!actor?.createEmbeddedDocuments) return null
   const state = readTemplarState(actor)
   if (!barrierAbilityAvailable(state)) return null
   return createOrRefreshEffect(
      actor,
      {
         name: "Effect: Templar Light",
         type: "effect",
         img: TEMPLAR_ASSETS.light,
         system: {
            slug: TEMPLAR_LIGHT_SLUG,
            duration: { value: 1, unit: "rounds", expiry: "turn-end" },
            rules: [
               {
                  key: "TokenLight",
                  value: {
                     bright: 20,
                     dim: 40,
                     color: "#f4d26a",
                     alpha: 0.35,
                     animation: {
                        type: "sunburst",
                        speed: 1,
                        intensity: 2,
                     },
                  },
               },
            ],
            description: {
               value: "Runtime effect created by Sarnout Chronicles when a Templar barrier ability emits light.",
            },
         },
      },
      { slugs: [TEMPLAR_LIGHT_SLUG] },
   )
}
