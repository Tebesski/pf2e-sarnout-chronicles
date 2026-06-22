import { MODULE_ID } from "../constants.mjs"
import { slugify } from "../state.mjs"
import {
   LIGHT_GAOL_ACCESS_SLUG,
   LIGHT_GAOL_ACTION_SLUG,
   LIGHT_GAOL_OWNER_SLUG,
   LIGHT_GAOL_TARGET_SLUG,
   lightGaolAccessEffectData,
   lightGaolBlindingActionData,
   lightGaolBlindingEffectData,
   lightGaolTargetEffectData,
} from "./data.mjs"
import { lightGaolActorOverlapsRegion } from "./regions.mjs"

const pendingLightGaolItemDeletes = new Set()
const lightGaolActorItemLocks = new Map()

export function actorItemsBySlug(actor, slug) {
   return actor?.items?.filter?.((item) => item.slug === slug) ?? []
}

export function isLightGaolItemDeletePending(id) {
   return pendingLightGaolItemDeletes.has(id)
}

function lightGaolLockSlug(slug) {
   return slug === LIGHT_GAOL_ACTION_SLUG ? LIGHT_GAOL_ACCESS_SLUG : slug
}

async function withLightGaolActorItemLock(actor, slug, operation) {
   const key = `${actor?.uuid ?? actor?.id ?? "actor"}:${lightGaolLockSlug(slug)}`
   const previous = lightGaolActorItemLocks.get(key) ?? Promise.resolve()
   const current = previous.catch(() => undefined).then(operation)
   lightGaolActorItemLocks.set(key, current)
   try {
      return await current
   } finally {
      if (lightGaolActorItemLocks.get(key) === current) {
         lightGaolActorItemLocks.delete(key)
      }
   }
}

export async function createLightGaolCondition(actor, slug, durationValue) {
   if (!actor?.createEmbeddedDocuments) return false
   if (slug === "blinded") {
      const [created] = await actor.createEmbeddedDocuments("Item", [
         lightGaolBlindingEffectData(durationValue),
      ])
      return created ?? false
   }
   return false
}

export async function deleteActorItemIds(actor, ids) {
   if (!actor?.deleteEmbeddedDocuments) return
   const uniqueIds = [...new Set(ids.filter(Boolean))]
   const deletableIds = uniqueIds.filter(
      (id) => actor.items.has(id) && !pendingLightGaolItemDeletes.has(id),
   )
   if (!deletableIds.length) return
   for (const id of deletableIds) pendingLightGaolItemDeletes.add(id)
   try {
      const stillPresent = deletableIds.filter((id) => actor.items.has(id))
      if (stillPresent.length) {
         await actor.deleteEmbeddedDocuments("Item", stillPresent)
      }
   } catch (_error) {
      undefined
   } finally {
      for (const id of deletableIds) pendingLightGaolItemDeletes.delete(id)
   }
}

export async function deleteActorItemsBySlug(actor, slugs) {
   if (!actor?.deleteEmbeddedDocuments) return
   const wanted = new Set(Array.isArray(slugs) ? slugs : [slugs])
   for (const slug of wanted) {
      await withLightGaolActorItemLock(actor, slug, async () => {
         const ids = actorItemsBySlug(actor, slug).map((item) => item.id)
         await deleteActorItemIds(actor, ids)
      })
   }
}

async function removeDuplicateActorItemsBySlug(actor, slug) {
   const items = actorItemsBySlug(actor, slug)
   if (items.length <= 1) return
   await deleteActorItemIds(actor, items.slice(1).map((item) => item.id))
}

export async function ensureLightGaolAccess(
   actor,
   spellDc,
   { onActionRefreshError = null } = {},
) {
   if (!actor?.createEmbeddedDocuments) return
   await withLightGaolActorItemLock(actor, LIGHT_GAOL_ACCESS_SLUG, async () => {
      await removeDuplicateActorItemsBySlug(actor, LIGHT_GAOL_ACCESS_SLUG)
      await removeDuplicateActorItemsBySlug(actor, LIGHT_GAOL_ACTION_SLUG)
      const creates = []
      if (!actorItemsBySlug(actor, LIGHT_GAOL_ACCESS_SLUG).length) {
         creates.push(lightGaolAccessEffectData())
      }
      const actionItems = actorItemsBySlug(actor, LIGHT_GAOL_ACTION_SLUG)
      if (!actionItems.length) {
         creates.push(lightGaolBlindingActionData(spellDc))
      } else {
         const actionData = lightGaolBlindingActionData(spellDc)
         try {
            await actionItems[0].update({
               img: actionData.img,
               "system.description.value": actionData.system.description.value,
               "system.traits.value": actionData.system.traits.value,
               "system.frequency": actionData.system.frequency,
               [`flags.${MODULE_ID}.lightGaolAction`]: true,
               [`flags.${MODULE_ID}.automatedTemplarAction`]: "blindingBlade",
            })
         } catch (error) {
            onActionRefreshError?.({
               actor: actor.name,
               actionId: actionItems[0]?.id,
               error,
            })
         }
      }
      if (creates.length) await actor.createEmbeddedDocuments("Item", creates)
   })
}

export async function ensureLightGaolTargetEffect(actor) {
   if (!actor?.createEmbeddedDocuments) return
   await withLightGaolActorItemLock(actor, LIGHT_GAOL_TARGET_SLUG, async () => {
      await removeDuplicateActorItemsBySlug(actor, LIGHT_GAOL_TARGET_SLUG)
      if (actorItemsBySlug(actor, LIGHT_GAOL_TARGET_SLUG).length) return
      await actor.createEmbeddedDocuments("Item", [lightGaolTargetEffectData()])
   })
}

export function actorHasTrait(actor, trait) {
   const slug = slugify(trait)
   if (!actor || !slug) return false
   if (actor.rollOptions?.all?.[`self:trait:${slug}`]) return true
   if (actor.traits?.has?.(slug)) return true
   return Array.from(actor.system?.traits?.value ?? []).some(
      (value) => slugify(value) === slug,
   )
}

export function actorExcludedFromLightGaolTarget(actor) {
   if (!actor) return true
   return Boolean(
      actor.getFlag?.(MODULE_ID, "isLightGaolActor") ||
         actor.rollOptions?.all?.["self:trait:construct"] ||
         actor.rollOptions?.all?.["self:trait:holy"] ||
         actor.rollOptions?.all?.["self:trait:light"] ||
         actor.rollOptions?.all?.["light-gaol-owner"] ||
         actor.type === "hazard",
   )
}

export function activeLightGaolEffects(scene) {
   const effects = []
   const seen = new Set()
   for (const token of scene?.tokens ?? []) {
      const actor = token.actor
      if (!actor) continue
      for (const effect of actor.items.filter(
         (item) => item.slug === LIGHT_GAOL_OWNER_SLUG,
      )) {
         if (seen.has(effect.uuid)) continue
         seen.add(effect.uuid)
         effects.push(effect)
      }
   }
   return effects
}

export function lightGaolAccessForActor(
   scene,
   actor,
   { fallbackSpellDc = null } = {},
) {
   for (const effect of activeLightGaolEffects(scene)) {
      const ownerActor = effect.actor
      if (!ownerActor || ownerActor.uuid !== actor?.uuid) continue
      const data = effect.getFlag?.(MODULE_ID, "lightGaolData")
      const adjacencyRegion =
         scene?.regions?.get(data?.adjacencyRegion) ??
         scene?.regions?.get(data?.region)
      if (!adjacencyRegion) continue
      if (!lightGaolActorOverlapsRegion(scene, actor, adjacencyRegion)) continue
      return {
         actor,
         spellDc: Number(data?.spellDc) || fallbackSpellDc?.(actor) || 15,
      }
   }
   return null
}

export function lightGaolTargetAppliesToActor(scene, actor) {
   if (actorExcludedFromLightGaolTarget(actor)) return false
   for (const effect of activeLightGaolEffects(scene)) {
      const ownerActor = effect.actor
      if (!ownerActor || ownerActor.uuid === actor?.uuid) continue
      const data = effect.getFlag?.(MODULE_ID, "lightGaolData")
      const adjacencyRegion =
         scene?.regions?.get(data?.adjacencyRegion) ??
         scene?.regions?.get(data?.region)
      if (
         adjacencyRegion &&
         lightGaolActorOverlapsRegion(scene, actor, adjacencyRegion)
      ) {
         return true
      }
   }
   return false
}
