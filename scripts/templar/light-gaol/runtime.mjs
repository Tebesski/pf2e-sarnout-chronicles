import { MODULE_ID } from "../constants.mjs"
import { lightGaolFortitudeDice, templarClassOrSpellDC } from "../scaling.mjs"
import { normalizeRegionBehaviorType, regionEvent } from "../regions.mjs"
import { postLightGaolBoundaryCard as postTemplarLightGaolBoundaryCard } from "../cards/light-burst-cards.mjs"
import {
   LIGHT_GAOL_ACCESS_SLUG,
   LIGHT_GAOL_ACTION_SLUG,
   LIGHT_GAOL_OWNER_SLUG,
   LIGHT_GAOL_TARGET_SLUG,
} from "./data.mjs"
import {
   activeLightGaolEffects,
   actorExcludedFromLightGaolTarget,
   actorHasTrait,
   deleteActorItemIds,
   deleteActorItemsBySlug,
   ensureLightGaolAccess as ensureLightGaolAccessBase,
   ensureLightGaolTargetEffect,
   isLightGaolItemDeletePending,
   lightGaolAccessForActor,
   lightGaolTargetAppliesToActor,
} from "./effects.mjs"
import {
   bringLightGaolRegionToFront,
   lightGaolAdjacencyScriptSource,
   lightGaolBoundaryScriptSource,
   lightGaolChangedBoundaryRegions,
   lightGaolTokensInRegion,
   reinforceLightGaolRegionStack,
} from "./regions.mjs"

let lightGaolReconcileQueue = Promise.resolve()
const lightGaolBoundaryCardThrottle = new Map()

async function cleanupLightGaolElement(id, type) {
   const scene = canvas.scene
   if (!scene) return
   let targetData = null
   let effectItem = null
   for (const actor of game.actors) {
      const effect = actor.items.find((i) => i.slug === "effect-light-gaol")
      if (effect && effect.flags?.[MODULE_ID]?.lightGaolData) {
         const data = effect.flags[MODULE_ID].lightGaolData
         if (
            data.walls.includes(id) ||
            data.tokens.includes(id) ||
            data.actors.includes(id)
         ) {
            targetData = foundry.utils.deepClone(data)
            effectItem = effect
            break
         }
      }
   }
   if (!targetData) return

   let idx = -1
   if (type === "Wall") idx = targetData.walls.indexOf(id)
   if (type === "Token") idx = targetData.tokens.indexOf(id)
   if (type === "Actor") idx = targetData.actors.indexOf(id)

   if (idx === -1) return
   const wId = targetData.walls[idx]
   const tId = targetData.tokens[idx]
   const aId = targetData.actors[idx]

   targetData.walls.splice(idx, 1)
   targetData.tokens.splice(idx, 1)
   targetData.actors.splice(idx, 1)
   try {
      await effectItem.update({
         [`flags.${MODULE_ID}.lightGaolData`]: targetData,
      })
   } catch (_error) {
      undefined
   }

   if (wId && scene.walls.has(wId)) {
      try {
         await scene.deleteEmbeddedDocuments("Wall", [wId])
      } catch (_error) {
         undefined
      }
   }
   if (tId && scene.tokens.has(tId)) {
      try {
         await scene.deleteEmbeddedDocuments("Token", [tId])
      } catch (_error) {
         undefined
      }
   }
   if (aId && game.actors.has(aId)) {
      try {
         await game.actors.get(aId).delete()
      } catch (_error) {
         undefined
      }
   }
}

export async function ensureLightGaolAccess(actor, spellDc) {
   return ensureLightGaolAccessBase(actor, spellDc)
}

async function syncLightGaolActorEffects(actor, scene = canvas?.scene) {
   const canApply = game.user?.isActiveGM ?? game.user?.isGM
   if (!scene || !actor || !canApply) return false
   const access = lightGaolAccessForActor(scene, actor, {
      fallbackSpellDc: templarClassOrSpellDC,
   })
   if (access) {
      await ensureLightGaolAccess(actor, access.spellDc)
   } else {
      await deleteActorItemsBySlug(actor, [
         LIGHT_GAOL_ACCESS_SLUG,
         LIGHT_GAOL_ACTION_SLUG,
      ])
   }

   if (lightGaolTargetAppliesToActor(scene, actor)) {
      await ensureLightGaolTargetEffect(actor)
   } else {
      await deleteActorItemsBySlug(actor, LIGHT_GAOL_TARGET_SLUG)
   }
   return true
}

function queueLightGaolBoundaryCardsForMove(tokenDoc, operation) {
   for (const { region, eventName } of lightGaolChangedBoundaryRegions(
      tokenDoc,
      operation,
   )) {
      Hooks.callAll(`${MODULE_ID}.lightGaolBoundaryCrossed`, {
         sceneId: tokenDoc.parent?.id ?? null,
         regionUuid: region.uuid,
         ownerUuid: region.flags?.[MODULE_ID]?.ownerUuid ?? null,
         targetUuid: tokenDoc.uuid,
         eventName,
      })
   }
}

async function reconcileLightGaolAuras(scene = canvas?.scene) {
   const canApply = game.user?.isActiveGM ?? game.user?.isGM
   if (!scene || !canApply) return false
   const accessByActor = new Map()
   const targetActors = new Map()
   const sceneActors = new Map()

   for (const token of scene.tokens ?? []) {
      if (token.actor) sceneActors.set(token.actor.uuid, token.actor)
   }

   for (const effect of activeLightGaolEffects(scene)) {
      const data = effect.getFlag?.(MODULE_ID, "lightGaolData")
      const ownerActor = effect.actor
      if (!data || !ownerActor) continue
      await repairLightGaolRegionScripts(scene, data)
      const adjacencyRegion =
         scene.regions.get(data.adjacencyRegion) ?? scene.regions.get(data.region)
      if (!adjacencyRegion) continue
      const spellDc =
         Number(data.spellDc) || templarClassOrSpellDC(ownerActor) || 15

      for (const token of lightGaolTokensInRegion(scene, adjacencyRegion)) {
         const actor = token.actor
         if (!actor) continue
         if (actor.uuid === ownerActor.uuid) {
            accessByActor.set(actor.uuid, { actor, spellDc })
         } else if (!actorExcludedFromLightGaolTarget(actor)) {
            targetActors.set(actor.uuid, actor)
         }
      }
   }

   for (const [uuid, actor] of sceneActors) {
      if (accessByActor.has(uuid)) {
         await ensureLightGaolAccess(actor, accessByActor.get(uuid).spellDc)
      } else {
         await deleteActorItemsBySlug(actor, [
            LIGHT_GAOL_ACCESS_SLUG,
            LIGHT_GAOL_ACTION_SLUG,
         ])
      }

      if (targetActors.has(uuid)) {
         await ensureLightGaolTargetEffect(actor)
      } else {
         await deleteActorItemsBySlug(actor, LIGHT_GAOL_TARGET_SLUG)
      }
   }

   return true
}

export function queueLightGaolAuraReconcile(scene = canvas?.scene) {
   lightGaolReconcileQueue = lightGaolReconcileQueue
      .catch(() => undefined)
      .then(() => reconcileLightGaolAuras(scene))
   return lightGaolReconcileQueue
}

async function ensureLightGaolRegionScript(region, source, events) {
   if (!region?.updateEmbeddedDocuments) return
   const behavior = region.behaviors?.find?.((candidate) =>
      String(candidate.type ?? "").endsWith("executeScript"),
   )
   if (!behavior) {
      try {
         await region.createEmbeddedDocuments("RegionBehavior", [
            {
               type: normalizeRegionBehaviorType("executeScript"),
               system: { events, source },
            },
         ])
      } catch (_error) {
         undefined
      }
      return
   }
   const existingEvents = Array.from(behavior.system?.events ?? [])
   const sameEvents =
      existingEvents.length === events.length &&
      events.every((eventName) => existingEvents.includes(eventName))
   if (behavior.system?.source === source && sameEvents) return
   try {
      await region.updateEmbeddedDocuments("RegionBehavior", [
         {
            _id: behavior.id,
            "system.events": events,
            "system.source": source,
         },
      ])
   } catch (_error) {
      undefined
   }
}

async function repairLightGaolRegionScripts(scene, data) {
   const canApply = game.user?.isActiveGM ?? game.user?.isGM
   if (!scene || !data || !canApply) return
   const adjacencyRegion = scene.regions.get(data.adjacencyRegion)
   const boundaryRegion = scene.regions.get(data.region)
   await ensureLightGaolRegionScript(
      adjacencyRegion,
      lightGaolAdjacencyScriptSource(),
      [
         regionEvent("TOKEN_ENTER", "tokenEnter"),
         regionEvent("TOKEN_EXIT", "tokenExit"),
         regionEvent("TOKEN_MOVE_IN", "tokenMoveIn"),
         regionEvent("TOKEN_MOVE_OUT", "tokenMoveOut"),
      ],
   )
   await ensureLightGaolRegionScript(
      boundaryRegion,
      lightGaolBoundaryScriptSource(),
      [
         regionEvent("TOKEN_ENTER", "tokenEnter"),
         regionEvent("TOKEN_EXIT", "tokenExit"),
      ],
   )
}

Hooks.on("deleteWall", (wall) => {
   if (wall.flags?.[MODULE_ID]?.isLightGaolWall)
      cleanupLightGaolElement(wall.id, "Wall")
})

Hooks.on("deleteToken", (token) => {
   if (token.flags?.[MODULE_ID]?.isLightGaolToken)
      cleanupLightGaolElement(token.id, "Token")
})

Hooks.on("deleteActor", (actor) => {
   if (actor.flags?.[MODULE_ID]?.isLightGaolActor)
      cleanupLightGaolElement(actor.id, "Actor")
})

Hooks.on("updateActor", (actor, changes) => {
   if (actor.type !== "hazard" || !actor.flags?.[MODULE_ID]?.isLightGaolActor)
      return
   const hp = foundry.utils.getProperty(changes, "system.attributes.hp.value")
   if (hp !== undefined && hp <= 0) {
      cleanupLightGaolElement(actor.id, "Actor")
   }
})

Hooks.on("preUpdateRegion", (region, changes, options, userId) => {
   if (
      game.user.id !== userId ||
      options.sscIsSyncing ||
      !changes.shapes?.length
   )
      return

   const oldShape = region.shapes[0]
   const newShape = changes.shapes[0]
   if (!oldShape || !newShape) return

   const dx = (newShape.x !== undefined ? newShape.x : oldShape.x) - oldShape.x
   const dy = (newShape.y !== undefined ? newShape.y : oldShape.y) - oldShape.y

   if (dx !== 0 || dy !== 0) {
      options.sscDx = dx
      options.sscDy = dy
   }
})

Hooks.on("drawRegion", (regionObject) => {
   reinforceLightGaolRegionStack(regionObject)
})

Hooks.on("refreshRegion", (regionObject) => {
   reinforceLightGaolRegionStack(regionObject)
})

Hooks.on("updateRegion", async (region, changes, options, userId) => {
   if (
      game.user.id !== userId ||
      options.sscIsSyncing ||
      (!options.sscDx && !options.sscDy)
   )
      return

   const ownerUuid = region.flags?.[MODULE_ID]?.ownerUuid
   if (!ownerUuid) return

   const owner = await fromUuid(ownerUuid)
   const actor = owner?.actor ?? owner
   const effect = actor?.items?.find((i) => i.slug === "effect-light-gaol")
   const data = effect?.flags?.[MODULE_ID]?.lightGaolData
   if (!data) return

   const dx = options.sscDx || 0
   const dy = options.sscDy || 0
   const scene = region.parent
   const updates = {
      Region: [],
      AmbientLight: [],
      AmbientSound: [],
      Token: [],
      Wall: [],
   }

   const addRegion = (id) => {
      if (id && id !== region.id && scene.regions.has(id)) {
         const target = scene.regions.get(id)
         updates.Region.push({
            _id: id,
            shapes: [
               {
                  ...target.shapes[0],
                  x: target.shapes[0].x + dx,
                  y: target.shapes[0].y + dy,
               },
            ],
         })
      }
   }

   addRegion(data.region)
   addRegion(data.adjacencyRegion)

   if (data.light && scene.lights.has(data.light)) {
      const target = scene.lights.get(data.light)
      updates.AmbientLight.push({
         _id: data.light,
         x: target.x + dx,
         y: target.y + dy,
      })
   }

   if (data.sound && scene.sounds?.has?.(data.sound)) {
      const target = scene.sounds.get(data.sound)
      updates.AmbientSound.push({
         _id: data.sound,
         x: target.x + dx,
         y: target.y + dy,
      })
   }

   for (const tId of data.tokens ?? []) {
      if (scene.tokens.has(tId)) {
         const target = scene.tokens.get(tId)
         updates.Token.push({ _id: tId, x: target.x + dx, y: target.y + dy })
      }
   }

   for (const wId of data.walls ?? []) {
      if (scene.walls.has(wId)) {
         const target = scene.walls.get(wId)
         updates.Wall.push({
            _id: wId,
            c: [
               target.c[0] + dx,
               target.c[1] + dy,
               target.c[2] + dx,
               target.c[3] + dy,
            ],
         })
      }
   }

   for (const [type, arr] of Object.entries(updates)) {
      if (arr.length)
         await scene.updateEmbeddedDocuments(type, arr, { sscIsSyncing: true })
   }
   bringLightGaolRegionToFront(scene, data.region, data.adjacencyRegion)
   await queueLightGaolAuraReconcile(scene)
})

Hooks.on("updateToken", async (tokenDoc, changes) => {
   if (changes.x !== undefined || changes.y !== undefined) {
      void syncLightGaolActorEffects(tokenDoc.actor, tokenDoc.parent)
   }
})

Hooks.on("moveToken", (tokenDoc, _movement, operation) => {
   void syncLightGaolActorEffects(tokenDoc.actor, tokenDoc.parent)
   queueLightGaolBoundaryCardsForMove(tokenDoc, operation)
})

Hooks.on("createToken", (tokenDoc) => {
   void syncLightGaolActorEffects(tokenDoc.actor, tokenDoc.parent)
})

Hooks.on(`${MODULE_ID}.refreshLightGaolAuras`, (scene) => {
   void queueLightGaolAuraReconcile(scene)
})

Hooks.on("refreshLightGaolAuras", (scene) => {
   void queueLightGaolAuraReconcile(scene)
})

Hooks.on(`${MODULE_ID}.lightGaolAdjacencyChanged`, async (data) => {
   const tokenDoc =
      globalThis.fromUuidSync?.(data?.tokenUuid) ||
      (data?.tokenUuid ? await fromUuid(data.tokenUuid).catch(() => null) : null)
   const token = tokenDoc?.documentName === "Token" ? tokenDoc : null
   if (!token?.actor) return
   await syncLightGaolActorEffects(token.actor, token.parent ?? canvas?.scene)
   setTimeout(() => {
      void syncLightGaolActorEffects(token.actor, token.parent ?? canvas?.scene)
   }, 0)
})

Hooks.on(`${MODULE_ID}.lightGaolBoundaryCrossed`, async (data) => {
   const throttleKey = `${data?.regionUuid ?? ""}:${data?.targetUuid ?? ""}`
   const now = Date.now()
   const last = lightGaolBoundaryCardThrottle.get(throttleKey) ?? 0
   if (now - last < 300) return
   lightGaolBoundaryCardThrottle.set(throttleKey, now)
   const ownerUuid = data.actorUuid ?? data.ownerUuid
   const actorDoc =
      globalThis.fromUuidSync?.(ownerUuid) ||
      (ownerUuid ? await fromUuid(ownerUuid).catch(() => null) : null)
   const targetDoc =
      globalThis.fromUuidSync?.(data.targetUuid) ||
      (data.targetUuid ? await fromUuid(data.targetUuid).catch(() => null) : null)
   const actor = actorDoc?.actor ?? actorDoc
   const target =
      targetDoc?.documentName === "Token" ? targetDoc : targetDoc?.token ?? targetDoc
   if (!actor || !target?.actor) return
   const dataEffect = actor.items?.find(
      (item) => item.slug === LIGHT_GAOL_OWNER_SLUG,
   )
   const gaolData = dataEffect?.getFlag?.(MODULE_ID, "lightGaolData")
   const dc = data.dc ?? gaolData?.spellDc ?? templarClassOrSpellDC(actor) ?? 15
   const saveType = data.saveType ?? "will"
   await postTemplarLightGaolBoundaryCard({
      actor,
      target,
      saveType,
      dc,
      dice: data.dice ?? 0,
   })
   if (saveType === "will" && actorHasTrait(target.actor, "unholy")) {
      await postTemplarLightGaolBoundaryCard({
         actor,
         target,
         saveType: "fortitude",
         dc,
         dice: data.dice ?? lightGaolFortitudeDice(actor),
      })
   }
})

Hooks.on("deleteItem", async (item) => {
   if (item.slug === "effect-blinding-blade-access") {
      const actionIds =
         item.actor?.items
            .filter(
               (i) =>
                  i.slug === "blinding-blade" &&
                  !isLightGaolItemDeletePending(i.id),
            )
            .map((i) => i.id) ?? []
      await deleteActorItemIds(item.actor, actionIds)
      return
   }

   if (item.type !== "effect" || item.slug !== "effect-light-gaol") return
   const data = item.flags?.[MODULE_ID]?.lightGaolData
   if (!data) return

   const actor = item.actor
   const accessIds = actor.items
      .filter((i) => i.slug === "effect-blinding-blade-access")
      .map((i) => i.id)
   await deleteActorItemIds(actor, accessIds)

   const scene = canvas?.scene
   if (scene) {
      if (data.region && scene.regions.has(data.region)) {
         try {
            await scene.deleteEmbeddedDocuments("Region", [data.region])
         } catch (_error) {
            undefined
         }
      }
      if (data.adjacencyRegion && scene.regions.has(data.adjacencyRegion)) {
         try {
            await scene.deleteEmbeddedDocuments("Region", [
               data.adjacencyRegion,
            ])
         } catch (_error) {
            undefined
         }
      }
      if (data.light && scene.lights.has(data.light)) {
         try {
            await scene.deleteEmbeddedDocuments("AmbientLight", [data.light])
         } catch (_error) {
            undefined
         }
      }
      if (data.sound && scene.sounds?.has?.(data.sound)) {
         try {
            await scene.deleteEmbeddedDocuments("AmbientSound", [data.sound])
         } catch (_error) {
            undefined
         }
      }
      const validWalls = data.walls.filter((id) => scene.walls.has(id))
      if (validWalls.length) {
         try {
            await scene.deleteEmbeddedDocuments("Wall", validWalls)
         } catch (_error) {
            undefined
         }
      }
      const validTokens = data.tokens.filter((id) => scene.tokens.has(id))
      if (validTokens.length) {
         try {
            await scene.deleteEmbeddedDocuments("Token", validTokens)
         } catch (_error) {
            undefined
         }
      }

      for (const t of scene.tokens) {
         if (!t.actor) continue
         const stuckEffects = t.actor.items
            .filter((i) => i.slug === "effect-light-gaol-target")
            .map((i) => i.id)
         await deleteActorItemIds(t.actor, stuckEffects)
      }
      await queueLightGaolAuraReconcile(scene)
   }

   for (const actorId of data.actors ?? []) {
      if (game.actors.has(actorId)) {
         try {
            await game.actors.get(actorId).delete()
         } catch (_error) {
            undefined
         }
      }
   }
})
