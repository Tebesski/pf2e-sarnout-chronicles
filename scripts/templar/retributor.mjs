import { MODULE_ID, TEMPLAR_LIGHT_SLUG, TEMPLAR_SLUGS } from "./constants.mjs"
import { createOrRefreshEffect } from "./effects.mjs"
import { actorHasSlug } from "./state.mjs"

export async function evaluateRetributorsOath(actor) {
   if (!actor?.createEmbeddedDocuments) return null

   const hasOath = actorHasSlug(actor, TEMPLAR_SLUGS.retributorsOath)
   if (!hasOath) return null

   const hasLight = actor.items.some((i) => i.slug === TEMPLAR_LIGHT_SLUG)
   const hasRage = actor.items.some(
      (i) => i.type === "effect" && i.name.toLowerCase().includes("rage"),
   )

   const effectSlug = "effect-retributors-oath"
   const existingEffect = actor.items.find((i) => i.slug === effectSlug)

   if (hasLight && hasRage) {
      if (existingEffect) return null
      return createOrRefreshEffect(actor, {
         name: "Effect: Retributor's Oath",
         type: "effect",
         img: `modules/${MODULE_ID}/assets/templar/icons/retributor.png`,
         system: {
            slug: effectSlug,
            rules: [
               {
                  key: "Resistance",
                  type: "fire",
                  value: "max(1,floor(@actor.level/2))",
               },
               {
                  key: "Resistance",
                  type: "spirit",
                  value: "max(1,floor(@actor.level/2))",
               },
            ],
         },
      })
   }

   if (existingEffect) {
      return existingEffect.delete()
   }

   return null
}
