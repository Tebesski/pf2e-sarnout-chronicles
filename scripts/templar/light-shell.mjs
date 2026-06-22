import { TEMPLAR_ASSETS } from "./constants.mjs"
import { slugify, spellRankForActor } from "./state.mjs"

export async function createLightShellEffect(
   target,
   { sourceActor = target } = {},
) {
   const bonus = spellRankForActor(sourceActor) >= 6 ? 2 : 1
   const existing = target.items?.find?.((item) => {
      const slug = slugify(item.slug ?? item.system?.slug ?? item.name)
      return item.type === "effect" && slug === "effect-light-shell"
   })
   if (existing?.delete) await existing.delete()
   const traitPredicate = [
      {
         or: [
            "item:trait:unholy",
            "item:trait:shadow",
            "item:trait:darkness",
            "origin:trait:unholy",
            "origin:trait:shadow",
            "origin:trait:darkness",
         ],
      },
      {
         or: [
            "item:type:weapon",
            "item:type:melee",
            "item:type:spell",
            "item:type:effect",
            "origin:type:weapon",
            "origin:type:melee",
            "origin:type:spell",
            "origin:type:effect",
         ],
      },
   ]
   const [effect] = await target.createEmbeddedDocuments("Item", [
      {
         name: `Effect: Light Shell (+${bonus})`,
         type: "effect",
         img: TEMPLAR_ASSETS.lightShell,
         system: {
            slug: "effect-light-shell",
            duration: { value: 1, unit: "rounds", expiry: "turn-start" },
            rules: [
               {
                  key: "FlatModifier",
                  selector: "ac",
                  type: "status",
                  value: bonus,
                  label: "Light Shell",
                  predicate: traitPredicate,
               },
               {
                  key: "FlatModifier",
                  selector: "saving-throw",
                  type: "status",
                  value: bonus,
                  label: "Light Shell",
                  predicate: traitPredicate,
               },
            ],
            description: {
               value: `+${bonus} status bonus to AC and +${bonus} status bonus against effects and attacks with unholy, shadow or darkness trait.`,
            },
         },
      },
   ])
   return effect ?? null
}
