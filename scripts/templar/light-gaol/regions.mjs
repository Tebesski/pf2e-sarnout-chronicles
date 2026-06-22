import { MODULE_ID } from "../constants.mjs"

export function lightGaolShapeRect(region) {
   const shape = region?.shapes?.[0]
   if (!shape) return null
   const x = Number(shape.x)
   const y = Number(shape.y)
   const width = Number(shape.width)
   const height = Number(shape.height)
   if (![x, y, width, height].every(Number.isFinite)) return null
   return { x, y, width, height }
}

export function lightGaolTokenRect(tokenDoc) {
   const gridSize = Number(tokenDoc?.parent?.grid?.size) || 100
   const width = Number(tokenDoc?.width) || 1
   const height = Number(tokenDoc?.height) || 1
   return {
      x: Number(tokenDoc?.x) || 0,
      y: Number(tokenDoc?.y) || 0,
      width: width * gridSize,
      height: height * gridSize,
   }
}

export function lightGaolTokenInsideRect(tokenDoc, rect) {
   if (!rect) return false
   const tokenRect = lightGaolTokenRect(tokenDoc)
   return (
      tokenRect.x < rect.x + rect.width &&
      tokenRect.x + tokenRect.width > rect.x &&
      tokenRect.y < rect.y + rect.height &&
      tokenRect.y + tokenRect.height > rect.y
   )
}

export function lightGaolTokensInRegion(scene, region) {
   const tokens = region?.tokens
   if (tokens && typeof tokens[Symbol.iterator] === "function") {
      return Array.from(tokens).filter((token) => token?.actor)
   }
   const rect = lightGaolShapeRect(region)
   const byId = new Map()
   if (rect) {
      for (const token of scene?.tokens ?? []) {
         if (!token?.actor) continue
         if (!lightGaolTokenInsideRect(token, rect)) continue
         byId.set(token.id ?? token.uuid, token)
      }
   }
   return Array.from(byId.values())
}

export function lightGaolActorTokens(scene, actor) {
   return Array.from(scene?.tokens ?? []).filter(
      (token) => token.actor?.uuid === actor?.uuid,
   )
}

export function lightGaolActorOverlapsRegion(scene, actor, region) {
   const actorTokens = lightGaolActorTokens(scene, actor)
   const regionTokens = region?.tokens
   if (regionTokens && typeof regionTokens[Symbol.iterator] === "function") {
      const ids = new Set(actorTokens.map((token) => token.id))
      for (const token of regionTokens) {
         if (ids.has(token.id)) return true
      }
   }
   const rect = lightGaolShapeRect(region)
   if (!rect) return false
   return actorTokens.some((token) => lightGaolTokenInsideRect(token, rect))
}

export function lightGaolChangedBoundaryRegions(tokenDoc, operation) {
   const scene = tokenDoc?.parent
   if (!scene) return []
   const priorIds = new Set(operation?._priorRegions?.[tokenDoc.id] ?? [])
   const currentIds = new Set(
      Array.from(tokenDoc.regions ?? []).map((region) => region.id),
   )
   const changed = []
   for (const id of priorIds) {
      if (!currentIds.has(id)) changed.push({ id, eventName: "tokenExit" })
   }
   for (const id of currentIds) {
      if (!priorIds.has(id)) changed.push({ id, eventName: "tokenEnter" })
   }
   return changed
      .map(({ id, eventName }) => ({
         region: scene.regions.get(id),
         eventName,
      }))
      .filter(({ region }) => region?.flags?.[MODULE_ID]?.lightGaolRegion)
}

export function lightGaolAdjacencyScriptSource() {
   return `
      const moduleId = "${MODULE_ID}";
      const targetScene = scene ?? region?.parent ?? canvas?.scene;
      const token = event?.data?.token;
      Hooks.callAll(moduleId + ".lightGaolAdjacencyChanged", {
         sceneId: targetScene?.id ?? null,
         regionUuid: region?.uuid ?? null,
         tokenUuid: token?.uuid ?? null,
         eventName: event?.name ?? null
      });
   `
}

export function lightGaolBoundaryScriptSource() {
   return `
      const moduleId = "${MODULE_ID}";
      const targetScene = scene ?? region?.parent ?? canvas?.scene;
      const token = event?.data?.token;
      Hooks.callAll(moduleId + ".lightGaolBoundaryCrossed", {
         sceneId: targetScene?.id ?? null,
         regionUuid: region?.uuid ?? null,
         ownerUuid: region?.flags?.[moduleId]?.ownerUuid ?? null,
         targetUuid: token?.uuid ?? null,
         eventName: event?.name ?? null
      });
   `
}

export function bringLightGaolRegionToFront(
   scene,
   regionId,
   adjacencyRegionId,
   retry = true,
) {
   const regionObject = scene?.regions?.get(regionId)?.object
   const adjacencyObject = scene?.regions?.get(adjacencyRegionId)?.object
   if (!regionObject) {
      if (retry) {
         setTimeout(
            () =>
               bringLightGaolRegionToFront(
                  scene,
                  regionId,
                  adjacencyRegionId,
                  false,
               ),
            0,
         )
      }
      return
   }
   const base = 0
   try {
      if (adjacencyObject) adjacencyObject.zIndex = base
      regionObject.zIndex = Math.max(100, Number(regionObject.zIndex) || 0)
      const objects = regionObject.layer?.objects ?? regionObject.parent
      objects?.sortChildren?.()
      if (
         objects?.children?.includes?.(regionObject) &&
         typeof objects.setChildIndex === "function"
      ) {
         objects.setChildIndex(regionObject, objects.children.length - 1)
      }
      const highlights = regionObject.layer?._highlights
      const regionHighlight = highlights?.children?.find(
         (child) => child.region === regionObject,
      )
      const adjacencyHighlight = highlights?.children?.find(
         (child) => child.region === adjacencyObject,
      )
      if (adjacencyHighlight) adjacencyHighlight.zIndex = base
      if (regionHighlight) {
         regionHighlight.zIndex = regionObject.zIndex
         highlights?.sortChildren?.()
         if (typeof highlights?.setChildIndex === "function") {
            highlights.setChildIndex(
               regionHighlight,
               highlights.children.length - 1,
            )
         }
      }
   } catch (_error) {
      undefined
   }
}

export function pairedLightGaolRegionIds(scene, regionDoc) {
   const ownerUuid = regionDoc?.flags?.[MODULE_ID]?.ownerUuid
   if (!scene || !ownerUuid) return null
   const boundary = scene.regions.find(
      (region) =>
         region.flags?.[MODULE_ID]?.lightGaolRegion &&
         region.flags?.[MODULE_ID]?.ownerUuid === ownerUuid,
   )
   const adjacency = scene.regions.find(
      (region) =>
         region.flags?.[MODULE_ID]?.isLightGaolAdjacency &&
         region.flags?.[MODULE_ID]?.ownerUuid === ownerUuid,
   )
   if (!boundary || !adjacency) return null
   return { boundaryId: boundary.id, adjacencyId: adjacency.id }
}

export function reinforceLightGaolRegionStack(regionObject) {
   const ids = pairedLightGaolRegionIds(
      regionObject?.document?.parent,
      regionObject?.document,
   )
   if (!ids) return
   bringLightGaolRegionToFront(
      regionObject.document.parent,
      ids.boundaryId,
      ids.adjacencyId,
      false,
   )
}
