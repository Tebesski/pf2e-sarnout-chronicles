import { slugify } from "./state.mjs"

export function getActorToken(actor) {
   const linked = actor?.getActiveTokens?.(true, true)?.[0]
   const unlinked = actor?.getActiveTokens?.(false, true)?.[0]
   return (
      linked?.document ??
      linked ??
      unlinked?.document ??
      unlinked ??
      canvas?.tokens?.controlled?.find?.(
         (token) => token.actor?.id === actor?.id,
      )?.document ??
      null
   )
}

export function actorTokenDocuments(actor) {
   const active = actor?.getActiveTokens?.(true, true) ?? []
   const inactive = actor?.getActiveTokens?.(false, true) ?? []
   const controlled =
      canvas?.tokens?.controlled
         ?.filter?.((token) => token.actor?.id === actor?.id)
         ?.map?.((token) => token.document) ?? []
   return [
      ...new Set(
         [...active, ...inactive]
            .map((token) => token.document ?? token)
            .concat(controlled)
            .filter(Boolean),
      ),
   ]
}

export function tokenCenter(tokenDocument) {
   const document = tokenDocument?.document ?? tokenDocument
   const token = tokenDocument?.object ?? tokenDocument
   const gridSize = Number(canvas?.grid?.size ?? 100)
   return (
      token?.center ?? {
         x:
            Number(document?.x ?? token?.x ?? 0) +
            (Number(document?.width ?? 1) * gridSize) / 2,
         y:
            Number(document?.y ?? token?.y ?? 0) +
            (Number(document?.height ?? 1) * gridSize) / 2,
      }
   )
}

export function tokenDistanceFeet(origin, target) {
   const from = tokenCenter(origin)
   const to = tokenCenter(target)
   if (!Number.isFinite(from.x) || !Number.isFinite(to.x)) return Infinity
   if (typeof canvas?.grid?.measurePath === "function") {
      try {
         return canvas.grid.measurePath([from, to])?.distance ?? Infinity
      } catch (_error) {
         undefined
      }
   }
   const pixels = Math.hypot(to.x - from.x, to.y - from.y)
   const gridSize = Number(canvas?.grid?.size ?? 100)
   const distance = Number(canvas?.scene?.grid?.distance ?? 5)
   return gridSize > 0 ? (pixels / gridSize) * distance : Infinity
}

export function tokenEdgeDistanceFeet(origin, target) {
   const originDocument = origin?.document ?? origin
   const targetDocument = target?.document ?? target
   const gridSize = Number(
      canvas?.grid?.size ?? canvas?.scene?.grid?.size ?? 100,
   )
   const gridDistance = Number(canvas?.scene?.grid?.distance ?? 5)
   if (!Number.isFinite(gridSize) || gridSize <= 0) {
      return tokenDistanceFeet(origin, target)
   }

   const originX = Number(originDocument?.x ?? origin?.x)
   const originY = Number(originDocument?.y ?? origin?.y)
   const targetX = Number(targetDocument?.x ?? target?.x)
   const targetY = Number(targetDocument?.y ?? target?.y)
   if (
      ![originX, originY, targetX, targetY].every((value) =>
         Number.isFinite(value),
      )
   ) {
      return tokenDistanceFeet(origin, target)
   }

   const originWidth = Math.max(
      1,
      Number(originDocument?.width ?? origin?.w ?? 1),
   )
   const originHeight = Math.max(
      1,
      Number(originDocument?.height ?? origin?.h ?? 1),
   )
   const targetWidth = Math.max(
      1,
      Number(targetDocument?.width ?? target?.w ?? 1),
   )
   const targetHeight = Math.max(
      1,
      Number(targetDocument?.height ?? target?.h ?? 1),
   )
   const originRight = originX + originWidth * gridSize
   const originBottom = originY + originHeight * gridSize
   const targetRight = targetX + targetWidth * gridSize
   const targetBottom = targetY + targetHeight * gridSize
   const gapX = Math.max(
      0,
      Math.max(targetX - originRight, originX - targetRight),
   )
   const gapY = Math.max(
      0,
      Math.max(targetY - originBottom, originY - targetBottom),
   )
   const gridSpaces = Math.max(gapX, gapY) / gridSize
   return gridSpaces * gridDistance
}

function tokenDocument(tokenLike) {
   return (
      tokenLike?.document ?? tokenLike?.object?.document ?? tokenLike ?? null
   )
}

function tokenObject(tokenLike) {
   const document = tokenDocument(tokenLike)
   return (
      tokenLike?.object ??
      document?.object ??
      canvas?.tokens?.get?.(document?.id ?? tokenLike?.id) ??
      tokenLike ??
      null
   )
}

function allCanvasTokens() {
   const placeables = canvas?.tokens?.placeables ?? []
   const documents =
      canvas?.scene?.tokens?.contents ?? canvas?.scene?.tokens ?? []
   const seen = new Set()
   return [...placeables, ...documents].filter((token) => {
      const document = tokenDocument(token)
      const key = document?.uuid ?? document?.id ?? token?.id
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
   })
}

function actorAlliance(actor) {
   return slugify(
      actor?.system?.details?.alliance ??
         actor?.alliance ??
         actor?.system?.alliance ??
         "",
   )
}

function tokensAreEnemies(originToken, targetToken) {
   const originDocument = tokenDocument(originToken)
   const targetDocument = tokenDocument(targetToken)
   const originActor = originToken?.actor ?? originDocument?.actor
   const targetActor = targetToken?.actor ?? targetDocument?.actor
   if (!originActor || !targetActor || originActor.id === targetActor.id)
      return false

   const originAlliance = actorAlliance(originActor)
   const targetAlliance = actorAlliance(targetActor)
   if (originAlliance && targetAlliance)
      return originAlliance !== targetAlliance
   if (originActor.type === "character" && targetActor.type !== "character")
      return true
   if (originActor.type !== "character" && targetActor.type === "character")
      return true

   const originDisposition = Number(
      originDocument?.disposition ?? originToken?.document?.disposition ?? 0,
   )
   const targetDisposition = Number(
      targetDocument?.disposition ?? targetToken?.document?.disposition ?? 0,
   )
   if (originDisposition !== 0 && targetDisposition !== 0) {
      return originDisposition !== targetDisposition
   }
   return false
}

export function enemyTokensInEmanation(actor, radius) {
   if (!canvas?.ready) return []
   const origin = getActorToken(actor)
   const originObject = origin?.object ?? canvas?.tokens?.get?.(origin?.id)
   if (!originObject) return []
   return allCanvasTokens().filter((token) => {
      const targetObject = tokenObject(token)
      const targetActor = token?.actor ?? tokenDocument(token)?.actor
      if (!targetObject || !targetActor || targetActor.id === actor.id)
         return false
      if (!tokensAreEnemies(originObject, targetObject)) return false
      return tokenEdgeDistanceFeet(originObject, targetObject) <= radius + 0.01
   })
}

export function alliedTokensInEmanation(actor, radius = 15) {
   const origin = getActorToken(actor)
   const originObject = origin?.object ?? canvas?.tokens?.get?.(origin?.id)
   if (!originObject) return []
   const disposition = Number(
      origin?.disposition ?? originObject.document?.disposition ?? 0,
   )
   return (canvas?.tokens?.placeables ?? []).filter((token) => {
      if (!token.actor || token.actor === actor) return false
      const tokenDisposition = Number(token.document?.disposition ?? 0)
      if (disposition !== 0 && tokenDisposition !== disposition) return false
      return tokenDistanceFeet(originObject, token) <= radius
   })
}

export function targetActorToken(actor) {
   const token = getActorToken(actor)
   const object = token?.object ?? canvas?.tokens?.get?.(token?.id)
   if (!object) return
   if (token?.id && typeof game.user?.updateTokenTargets === "function") {
      game.user.updateTokenTargets([token.id])
      return
   }
   if (typeof object.setTarget !== "function") return
   object.setTarget(true, {
      user: game.user,
      releaseOthers: true,
      groupSelection: false,
   })
}
