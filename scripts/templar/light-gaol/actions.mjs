import {
   TEMPLAR_ASSETS,
   TEMPLAR_SLUGS,
} from "../constants.mjs"
import {
   calculateLightBarrier,
   readTemplarState,
   spellRankForActor,
} from "../state.mjs"
import { featureDetected, getActor } from "../actors.mjs"
import { spendFocusPoint } from "../focus.mjs"
import { playSound } from "../audio.mjs"
import { emitTemplarLight } from "../light.mjs"
import { createOrRefreshEffect } from "../effects.mjs"
import { getActorToken } from "../tokens.mjs"
import { templarClassOrSpellDC } from "../scaling.mjs"
import { normalizeRegionBehaviorType, regionEvent } from "../regions.mjs"
import {
   dialogContent,
   TemplarSelectDialog,
} from "../dialogs.mjs"
import { textParagraph } from "../templates.mjs"
import { activeHoldingSlots } from "../holding/helpers.mjs"
import { releaseHolding } from "../holding/release.mjs"
import { postBlindingBladeCard as postTemplarBlindingBladeCard } from "../cards/light-burst-cards.mjs"
import {
   lightGaolAdjacencyRegionData,
   lightGaolAmbientLightData,
   lightGaolAmbientSoundData,
   lightGaolBoundaryRegionData,
   lightGaolCreatedIds,
   lightGaolGeometry,
   lightGaolOwnerEffectData,
   lightGaolWallActorData,
   lightGaolWallData,
   lightGaolWallSegments,
   lightGaolWallTokenData,
} from "./creation.mjs"
import {
   actorExcludedFromLightGaolTarget,
   ensureLightGaolTargetEffect,
} from "./effects.mjs"
import {
   bringLightGaolRegionToFront,
   lightGaolAdjacencyScriptSource,
   lightGaolBoundaryScriptSource,
} from "./regions.mjs"
import {
   ensureLightGaolAccess,
   queueLightGaolAuraReconcile,
} from "./runtime.mjs"

export async function lightGaol({
   actor,
   spendFocus = true,
   fromSpellMessage = false,
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   if (!featureDetected(resolved, TEMPLAR_SLUGS.lightGaol, fromSpellMessage)) {
      ui.notifications?.warn("Light Gaol was not detected on this actor.")
      return null
   }

   const state = readTemplarState(resolved)
   const activeSlots = activeHoldingSlots(state)
   if (activeSlots.length === 0) {
      ui.notifications?.warn(
         "Light Gaol requires at least one active Holding Barrier.",
      )
      return null
   }

   const choice = await TemplarSelectDialog.prompt({
      title: "Light Gaol",
      label: "Release Barrier",
      intro: await dialogContent({
         paragraphs: [
            textParagraph(
               "Choose a Holding Barrier to release. Its damage forms the HP of the Light Gaol walls.",
            ),
         ],
      }),
      options: activeSlots.map((slot) => ({
         id: String(slot.index),
         label: `Barrier ${slot.index + 1}: ${slot.damage} damage`,
      })),
      confirmLabel: "Cast",
   })

   if (!choice) return null
   const slotIndex = Number(choice)
   const slot = state.holding[slotIndex]
   const wallHp = slot.damage

   if (spendFocus && !(await spendFocusPoint(resolved))) return null

   await playSound(TEMPLAR_ASSETS.lightGaolStartSound, 1)
   await releaseHolding({
      actor: resolved,
      slotIndex,
      dealDamage: false,
      messageTitle: "Light Gaol Cast",
      postMessage: false,
   })
   await emitTemplarLight(resolved)

   const token = getActorToken(resolved)
   const scene = canvas?.scene
   if (!token || !scene) return null

   const gridSize = scene.grid.size
   const geometry = lightGaolGeometry(token, gridSize)
   const { originX, originY, squarePx, centerX, centerY, adjacency } = geometry
   const createdIds = lightGaolCreatedIds()

   const adjacencyScript = lightGaolAdjacencyScriptSource()
   const [adjRegion] = await scene.createEmbeddedDocuments("Region", [
      lightGaolAdjacencyRegionData({
         adjacency,
         ownerUuid: resolved.uuid,
         behaviorType: normalizeRegionBehaviorType("executeScript"),
         events: [
            regionEvent("TOKEN_ENTER", "tokenEnter"),
            regionEvent("TOKEN_EXIT", "tokenExit"),
            regionEvent("TOKEN_MOVE_IN", "tokenMoveIn"),
            regionEvent("TOKEN_MOVE_OUT", "tokenMoveOut"),
         ],
         source: adjacencyScript,
      }),
   ])
   createdIds.adjacencyRegion = adjRegion.id

   const boundaryScript = lightGaolBoundaryScriptSource()
   const [region] = await scene.createEmbeddedDocuments("Region", [
      lightGaolBoundaryRegionData({
         actorName: resolved.name,
         originX,
         originY,
         squarePx,
         ownerUuid: resolved.uuid,
         behaviorType: normalizeRegionBehaviorType("executeScript"),
         events: [
            regionEvent("TOKEN_ENTER", "tokenEnter"),
            regionEvent("TOKEN_EXIT", "tokenExit"),
         ],
         source: boundaryScript,
      }),
   ])
   createdIds.region = region.id

   const [light] = await scene.createEmbeddedDocuments("AmbientLight", [
      lightGaolAmbientLightData({ x: centerX, y: centerY }),
   ])
   createdIds.light = light.id

   const [sound] = await scene.createEmbeddedDocuments("AmbientSound", [
      lightGaolAmbientSoundData({
         actorName: resolved.name,
         x: centerX,
         y: centerY,
         ownerUuid: resolved.uuid,
      }),
   ])
   createdIds.sound = sound.id

   const wallSegments = lightGaolWallSegments(geometry)
   const hardness = calculateLightBarrier(resolved).hardness
   const level = spellRankForActor(resolved)
   for (const seg of wallSegments) {
      const [wall] = await scene.createEmbeddedDocuments("Wall", [
         lightGaolWallData(seg),
      ])

      const [wallActor] = await Actor.createDocuments([
         lightGaolWallActorData({
            wallHp,
            hardness,
            level,
            alliance: resolved.alliance,
            wallId: wall.id,
            ownerUuid: resolved.uuid,
         }),
      ])

      const [wallToken] = await scene.createEmbeddedDocuments("Token", [
         lightGaolWallTokenData({
            segment: seg,
            actorId: wallActor.id,
            wallId: wall.id,
            ownerUuid: resolved.uuid,
            originX,
            originY,
            squarePx,
            gridSize,
         }),
      ])

      createdIds.walls.push(wall.id)
      createdIds.actors.push(wallActor.id)
      createdIds.tokens.push(wallToken.id)
   }

   const spellDc = templarClassOrSpellDC(resolved) ?? 15
   createdIds.spellDc = spellDc
   await ensureLightGaolAccess(resolved, spellDc)
   for (const t of scene.tokens) {
      const isInside =
         t.x >= adjacency.x &&
         t.x < adjacency.x + adjacency.width &&
         t.y >= adjacency.y &&
         t.y < adjacency.y + adjacency.height
      if (!isInside || !t.actor) continue
      if (t.actor.uuid === resolved.uuid) {
         await ensureLightGaolAccess(t.actor, spellDc)
      } else if (!actorExcludedFromLightGaolTarget(t.actor)) {
         await ensureLightGaolTargetEffect(t.actor)
      }
   }

   await createOrRefreshEffect(resolved, lightGaolOwnerEffectData(createdIds))

   bringLightGaolRegionToFront(
      scene,
      createdIds.region,
      createdIds.adjacencyRegion,
   )
   await queueLightGaolAuraReconcile(scene)

   return true
}

export async function postBlindingBladeUseCard({
   actor,
   target = null,
   targets = [],
   dc = null,
   message = null,
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return false
   return postTemplarBlindingBladeCard({
      actor: resolved,
      target,
      targets,
      dc,
      message,
   })
}

export async function blindingBlade({ actor } = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null

   const dc = templarClassOrSpellDC(resolved) ?? 15
   const target = Array.from(game.user?.targets ?? [])[0]
   if (!target) {
      ui.notifications?.warn("Blinding Blade requires one targeted creature.")
      return null
   }

   await playSound(TEMPLAR_ASSETS.blindingBladeSound, 1)
   await postTemplarBlindingBladeCard({
      actor: resolved,
      target,
      dc,
   })

   return true
}
