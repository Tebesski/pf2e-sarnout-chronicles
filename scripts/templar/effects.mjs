import {
   GENERATED_TEMPLAR_ACTION_FLAG,
   LEGACY_GENERATED_ACTION_DESCRIPTION_SNIPPETS,
   LEGACY_GENERATED_ACTION_SLUGS,
   MODULE_ID,
} from "./constants.mjs"
import { getActor } from "./actors.mjs"
import { slugify } from "./state.mjs"

const effectCreationLocks = new Map()

export async function createOrRefreshEffect(
   actor,
   data,
   { slugs = [] } = {},
) {
   if (!actor?.createEmbeddedDocuments) return null

   const primarySlug = slugify(
      data?.system?.slug ?? data?.name ?? slugs[0] ?? "effect",
   )
   const lockKey = `${actor.id}-${primarySlug}`

   const currentPromise = effectCreationLocks.get(lockKey) ?? Promise.resolve()
   const nextPromise = currentPromise
      .then(async () => {
         const wanted = new Set(
            [data?.system?.slug, data?.name, ...slugs]
               .filter(Boolean)
               .map(slugify),
         )
         const existing =
            actor.items?.filter?.((item) => {
               if (item.type !== "effect") return false
               const slug = slugify(item.slug ?? item.system?.slug ?? item.name)
               const cleanName = slugify(
                  String(item.name ?? "").replace(/^Effect:\s*/i, ""),
               )
               return wanted.has(slug) || wanted.has(cleanName)
            }) ?? []

         if (existing.length > 0) {
            const effect = existing[0]
            const updateData = { name: data.name, img: data.img }
            if (data.system?.slug) updateData["system.slug"] = data.system.slug
            if (data.system?.duration)
               updateData["system.duration"] = data.system.duration
            if (data.system?.rules)
               updateData["system.rules"] = data.system.rules
            if (data.system?.description)
               updateData["system.description"] = data.system.description
            if (data.system?.badge)
               updateData["system.badge"] = data.system.badge
            if (data.flags) updateData.flags = data.flags

            try {
               await effect.update(updateData)
            } catch (_error) {}

            const duplicates = existing.slice(1)
            for (const dup of duplicates) {
               try {
                  if (actor.items.has(dup.id)) await dup.delete()
               } catch (_error) {}
            }
            return effect
         }

         try {
            const [effect] = await actor.createEmbeddedDocuments("Item", [data])
            return effect ?? null
         } catch (_error) {
            return null
         }
      })
      .catch((_error) => {
         return null
      })

   effectCreationLocks.set(lockKey, nextPromise)

   try {
      return await nextPromise
   } finally {
      if (effectCreationLocks.get(lockKey) === nextPromise) {
         effectCreationLocks.delete(lockKey)
      }
   }
}

export function itemMatchesSlugGroup(item, slugs) {
   const wanted = new Set(slugs.map(slugify))
   const slug = slugify(item?.slug ?? item?.system?.slug ?? item?.name)
   const cleanName = slugify(
      String(item?.name ?? "").replace(/^Effect:\s*/i, ""),
   )
   return wanted.has(slug) || wanted.has(cleanName)
}

export function linkedEffectExpired(item) {
   return Boolean(
      item?.isExpired ||
         item?.system?.expired ||
         item?.system?.duration?.expired ||
         item?.system?.duration?.remaining === 0,
   )
}

export function actorEffectBySlug(actor, slugs) {
   const wanted = new Set(slugs.map(slugify))
   return (
      actor?.items?.find?.((item) => {
         if (item.type !== "effect") return false
         if (linkedEffectExpired(item)) return false
         const slug = slugify(item.slug ?? item.system?.slug ?? item.name)
         const cleanName = slugify(
            String(item.name ?? "").replace(/^Effect:\s*/i, ""),
         )
         return wanted.has(slug) || wanted.has(cleanName)
      }) ?? null
   )
}

function generatedActionFlag(item) {
   return item?.getFlag?.(MODULE_ID, GENERATED_TEMPLAR_ACTION_FLAG) ?? null
}

function isLegacyGeneratedTemplarAction(item) {
   if (item?.type !== "action") return false
   if (generatedActionFlag(item)) return true
   if (!itemMatchesSlugGroup(item, LEGACY_GENERATED_ACTION_SLUGS)) return false

   const description = String(item.system?.description?.value ?? "")
   return LEGACY_GENERATED_ACTION_DESCRIPTION_SNIPPETS.some((snippet) =>
      description.includes(snippet),
   )
}

export async function cleanupLegacyGeneratedTemplarActions({ actor } = {}) {
   const resolved = getActor(actor)
   if (!resolved?.items) return []

   const removed = []
   for (const item of resolved.items.filter?.(isLegacyGeneratedTemplarAction) ??
      []) {
      await item.delete?.()
      removed.push(item)
   }
   return removed
}

export async function deleteEffectsBySlugs(actor, slugs) {
   const wanted = new Set(slugs.map(slugify))
   const effects =
      actor?.items?.filter?.((item) => {
         if (item.type !== "effect") return false
         const slug = slugify(item.slug ?? item.system?.slug ?? item.name)
         const cleanName = slugify(
            String(item.name ?? "").replace(/^Effect:\s*/i, ""),
         )
         return wanted.has(slug) || wanted.has(cleanName)
      }) ?? []

   for (const effect of effects) {
      try {
         if (actor.items.has(effect.id)) await effect.delete()
      } catch (_error) {}
   }
   return effects
}
