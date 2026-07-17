import { MODULE_ID } from "../templar/constants.mjs"
import {
   createOrRefreshEffect,
   deleteEffectsBySlugs,
} from "../templar/effects.mjs"

const SOCKET_GLOBAL = "__pf2eSarnoutChroniclesAncestrySocket"

async function resolveActor(uuid) {
   const document =
      globalThis.fromUuidSync?.(uuid) ?? (await fromUuid(uuid).catch(() => null))
   return document?.actor ?? document ?? null
}

async function gmCreateOrRefreshActorEffect({
   actorUuid,
   effect,
   slugs = [],
} = {}) {
   const actor = await resolveActor(actorUuid)
   if (!actor?.createEmbeddedDocuments || !effect) return false
   return Boolean(await createOrRefreshEffect(actor, effect, { slugs }))
}

async function gmDeleteActorEffects({ actorUuid, slugs = [] } = {}) {
   const actor = await resolveActor(actorUuid)
   if (!actor || !slugs.length) return false
   await deleteEffectsBySlugs(actor, slugs)
   return true
}

async function gmIncreaseActorCondition({
   actorUuid,
   slug,
   value = 1,
} = {}) {
   const actor = await resolveActor(actorUuid)
   if (!actor || !slug) return false
   const amount = Math.max(1, Number(value) || 1)
   if (typeof actor.increaseCondition === "function") {
      await actor.increaseCondition(slug, { value: amount }).catch(async () => {
         await actor.increaseCondition(slug).catch(() => null)
      })
      const condition = actor.items?.find?.((item) => item.slug === slug)
      if (condition && amount > 1) {
         await condition
            .update({
               "system.value.value": amount,
               "system.badge.value": amount,
            })
            .catch(() => null)
      }
      return true
   }
   return false
}

async function gmUpdateActorItem({ actorUuid, itemId, updates = {} } = {}) {
   const actor = await resolveActor(actorUuid)
   const item = actor?.items?.get?.(itemId)
   if (!item || !updates || typeof updates !== "object") return false
   await item.update(updates)
   return true
}

function registerSocketNow() {
   if (globalThis[SOCKET_GLOBAL]) return globalThis[SOCKET_GLOBAL]
   if (typeof globalThis.socketlib?.registerModule !== "function") return null
   let socket = null
   try {
      socket = globalThis.socketlib.registerModule(MODULE_ID)
   } catch (_error) {
      return null
   }
   if (typeof socket?.register !== "function") return null
   socket.register("createOrRefreshAncestryEffect", gmCreateOrRefreshActorEffect)
   socket.register("deleteAncestryEffects", gmDeleteActorEffects)
   socket.register("increaseAncestryCondition", gmIncreaseActorCondition)
   socket.register("updateAncestryActorItem", gmUpdateActorItem)
   globalThis[SOCKET_GLOBAL] = socket
   return socket
}

export function registerAncestrySocket() {
   Hooks.once("socketlib.ready", () => registerSocketNow())
   Hooks.once("ready", () => registerSocketNow())
}

export async function createOrRefreshEffectAsGM(actor, effect, options = {}) {
   if (!actor?.uuid || !effect) return false
   if (game.user?.isGM) {
      return gmCreateOrRefreshActorEffect({
         actorUuid: actor.uuid,
         effect,
         slugs: options.slugs ?? [],
      })
   }
   const socket = globalThis[SOCKET_GLOBAL] ?? registerSocketNow()
   if (!socket?.executeAsGM) {
      ui.notifications?.warn("A GM or socketlib is required to apply this effect.")
      return false
   }
   return Boolean(
      await socket.executeAsGM("createOrRefreshAncestryEffect", {
         actorUuid: actor.uuid,
         effect,
         slugs: options.slugs ?? [],
      }),
   )
}

export async function deleteEffectsAsGM(actor, slugs = []) {
   if (!actor?.uuid || !slugs.length) return false
   if (game.user?.isGM) {
      return gmDeleteActorEffects({ actorUuid: actor.uuid, slugs })
   }
   const socket = globalThis[SOCKET_GLOBAL] ?? registerSocketNow()
   if (!socket?.executeAsGM) {
      ui.notifications?.warn("A GM or socketlib is required to remove this effect.")
      return false
   }
   return Boolean(
      await socket.executeAsGM("deleteAncestryEffects", {
         actorUuid: actor.uuid,
         slugs,
      }),
   )
}

export async function increaseConditionAsGM(actor, slug, value = 1) {
   if (!actor?.uuid || !slug) return false
   if (game.user?.isGM) {
      return gmIncreaseActorCondition({ actorUuid: actor.uuid, slug, value })
   }
   const socket = globalThis[SOCKET_GLOBAL] ?? registerSocketNow()
   if (!socket?.executeAsGM) {
      ui.notifications?.warn("A GM or socketlib is required to apply this condition.")
      return false
   }
   return Boolean(
      await socket.executeAsGM("increaseAncestryCondition", {
         actorUuid: actor.uuid,
         slug,
         value,
      }),
   )
}

export async function updateActorItemAsGM(actor, itemId, updates = {}) {
   if (!actor?.uuid || !itemId || !updates || typeof updates !== "object") {
      return false
   }
   if (game.user?.isGM) {
      return gmUpdateActorItem({ actorUuid: actor.uuid, itemId, updates })
   }
   const socket = globalThis[SOCKET_GLOBAL] ?? registerSocketNow()
   if (!socket?.executeAsGM) {
      ui.notifications?.warn("A GM or socketlib is required to update this item.")
      return false
   }
   return Boolean(
      await socket.executeAsGM("updateAncestryActorItem", {
         actorUuid: actor.uuid,
         itemId,
         updates,
      }),
   )
}
