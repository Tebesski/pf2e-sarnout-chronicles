import {
   LINKED_TEMPLAR_EFFECTS,
} from "./constants.mjs"
import { slugify } from "./state.mjs"

const internalLinkedTemplarEffectChanges = new Set()

export function isInternalLinkedTemplarEffectChange(itemOrId) {
   const id = typeof itemOrId === "string" ? itemOrId : itemOrId?.id
   return Boolean(id && internalLinkedTemplarEffectChanges.has(id))
}

export function linkedEffectConfigFromItem(item) {
   if (item?.type !== "effect") return null
   const slug = slugify(item?.slug ?? item?.system?.slug ?? item?.name)
   const name = slugify(String(item?.name ?? "").replace(/^Effect:\s*/i, ""))
   return Object.values(LINKED_TEMPLAR_EFFECTS).find((config) => {
      const aliases = [
         config.slug,
         ...(config.legacySlugs ?? []),
         slugify(config.name),
         ...(config.legacyNames ?? []).map(slugify),
      ]
      return (
         aliases.includes(slug) ||
         name === slugify(config.name.replace(/^Effect:\s*/i, ""))
      )
   })
}

function linkedEffect(actor, config) {
   return actor?.items?.find?.((item) => {
      if (item.type !== "effect") return false
      const slug = slugify(item.slug ?? item.system?.slug ?? item.name)
      return [
         config.slug,
         ...(config.legacySlugs ?? []),
         slugify(config.name),
         ...(config.legacyNames ?? []).map(slugify),
      ].includes(slug)
   })
}

export async function setLinkedTemplarEffect(actor, config, active) {
   if (!actor?.createEmbeddedDocuments) return null
   const existing = linkedEffect(actor, config)
   if (!active) {
      if (existing?.delete) {
         internalLinkedTemplarEffectChanges.add(existing.id)
         try {
            await existing.delete()
         } catch (_error) {
         } finally {
            internalLinkedTemplarEffectChanges.delete(existing.id)
         }
      }
      return null
   }
   if (existing) return existing
   try {
      const [created] = await actor.createEmbeddedDocuments("Item", [
         {
            name: config.name,
            type: "effect",
            img: config.img,
            system: {
               slug: config.slug,
               duration: { value: 1, unit: "minutes", expiry: "turn-start" },
               rules:
                  typeof config.rules === "function"
                     ? config.rules(actor)
                     : (config.rules ?? []),
               description: { value: config.description },
            },
         },
      ])
      return created ?? null
   } catch (_error) {
      return null
   }
}
