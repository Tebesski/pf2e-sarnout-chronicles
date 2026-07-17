import {
   actorEffectBySlug,
   actorHasSlug,
   canMutateActor,
   createOrRefreshEffect,
   deleteEffectsBySlugs,
   effectSource,
} from "../helpers.mjs"
import { tokenEdgeDistanceFeet } from "../../../templar/tokens.mjs"

const EFFECT_SLUG = "effect-imperial-formation"
const IMPERIAL_FORMATION_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/hadaganian/FlagEmpire.(UITexture).png"

function tokenDocument(token) {
   return token?.document ?? token?.object?.document ?? token ?? null
}

function tokenActor(token) {
   return token?.actor ?? tokenDocument(token)?.actor ?? null
}

function tokenDisposition(token) {
   const document = tokenDocument(token)
   return Number(document?.disposition ?? token?.document?.disposition)
}

function tokenId(token) {
   const document = tokenDocument(token)
   return document?.id ?? token?.id ?? null
}

function tokenSceneId(token) {
   const document = tokenDocument(token)
   return document?.parent?.id ?? document?.scene?.id ?? token?.scene?.id ?? null
}

function tokenKey(token) {
   const id = tokenId(token)
   const sceneId = tokenSceneId(token) ?? canvas?.scene?.id ?? ""
   return id ? `${sceneId}:${id}` : null
}

function tokenWithChanges(token, changes = {}) {
   const document = tokenDocument(token)
   if (!document) return null
   return {
      id: document.id ?? token?.id,
      uuid: document.uuid ?? token?.uuid,
      parent: document.parent ?? document.scene ?? canvas?.scene,
      scene: document.scene ?? document.parent ?? canvas?.scene,
      actor: tokenActor(token),
      x: Number(changes.x ?? document.x ?? token?.x ?? 0),
      y: Number(changes.y ?? document.y ?? token?.y ?? 0),
      width: Number(changes.width ?? document.width ?? token?.width ?? 1),
      height: Number(changes.height ?? document.height ?? token?.height ?? 1),
      disposition: Number(
         changes.disposition ?? document.disposition ?? token?.disposition ?? 0,
      ),
   }
}

function sameSide(first, second) {
   const firstActor = tokenActor(first)
   const secondActor = tokenActor(second)
   const firstAlliance = firstActor?.system?.details?.alliance
   const secondAlliance = secondActor?.system?.details?.alliance
   if (firstAlliance && secondAlliance) return firstAlliance === secondAlliance
   const hostile = CONST.TOKEN_DISPOSITIONS?.HOSTILE ?? -1
   const firstDisposition = tokenDisposition(first)
   const secondDisposition = tokenDisposition(second)
   if (secondDisposition === hostile) return false
   if (Number.isFinite(firstDisposition) && Number.isFinite(secondDisposition)) {
      return firstDisposition === secondDisposition && firstDisposition !== hostile
   }
   return firstActor?.type === "character" && secondActor?.type === "character"
}

function adjacentAllies(token, combatantTokens) {
   const actor = tokenActor(token)
   return combatantTokens.filter((candidate) => {
      const candidateActor = tokenActor(candidate)
      if (!candidateActor || !actor) return false
      if (tokenId(candidate) === tokenId(token)) return false
      if (candidateActor.id === actor.id) return false
      if (!sameSide(token, candidate)) return false
      return tokenEdgeDistanceFeet(token, candidate) <= 0.01
   })
}

function activeEncounter() {
   const combat = game.combat
   if (!combat?.started) return null
   const combatSceneId = combat.scene?.id ?? combat.sceneId ?? combat._source?.scene
   if (combatSceneId && canvas?.scene?.id && combatSceneId !== canvas.scene.id) {
      return null
   }
   return combat
}

function combatantTokenDocument(combatant, tokenOverrides = new Map()) {
   const tokenId = combatant?.tokenId ?? combatant?.token?.id
   const scene = combatant?.scene ?? combatant?.token?.parent ?? canvas?.scene
   const sceneId = scene?.id ?? canvas?.scene?.id ?? ""
   const override = tokenId ? tokenOverrides.get(`${sceneId}:${tokenId}`) : null
   if (override) return override
   return (
      (tokenId ? scene?.tokens?.get?.(tokenId) : null) ??
      combatant?.token ??
      combatant?.tokenDocument ??
      null
   )
}

function activeCombatantTokens(tokenOverrides = new Map()) {
   const combat = activeEncounter()
   if (!combat) return []
   const tokens = []
   const seen = new Set()
   for (const combatant of combat.combatants ?? []) {
      const token = combatantTokenDocument(combatant, tokenOverrides)
      if (!tokenActor(token)) continue
      if (canvas?.scene?.id && tokenSceneId(token) && tokenSceneId(token) !== canvas.scene.id) {
         continue
      }
      const id = tokenId(token)
      if (!id || seen.has(id)) continue
      seen.add(id)
      tokens.push(token)
   }
   return tokens
}

function actorsWithImperialFormationState() {
   return Array.from(game.actors ?? []).filter(
      (actor) =>
         actorHasSlug(actor, ["imperial-formation"]) ||
         actorEffectBySlug(actor, [EFFECT_SLUG]),
   )
}

async function refreshActor(
   actor,
   tokens,
   combatantTokens,
   { forceInactive = false } = {},
) {
   if (!actor) return
   if (!canMutateActor(actor)) return
   if (!actorHasSlug(actor, ["imperial-formation"])) {
      if (actorEffectBySlug(actor, [EFFECT_SLUG])) {
         await deleteEffectsBySlugs(actor, [EFFECT_SLUG])
      }
      return
   }
   const active =
      !forceInactive &&
      activeEncounter() &&
      tokens.some((token) => adjacentAllies(token, combatantTokens).length >= 2)
   if (!active) {
      await deleteEffectsBySlugs(actor, [EFFECT_SLUG])
      return
   }
   await createOrRefreshEffect(
      actor,
      effectSource({
         name: "Effect: Imperial Formation",
         slug: EFFECT_SLUG,
         img: IMPERIAL_FORMATION_ICON,
         duration: { value: -1, unit: "unlimited" },
         description: "+1 circumstance bonus to AC and Reflex while adjacent to at least two allies.",
         rules: [
            {
               key: "FlatModifier",
               selector: "ac",
               type: "circumstance",
               value: 1,
            },
            {
               key: "FlatModifier",
               selector: "reflex",
               type: "circumstance",
               value: 1,
            },
         ],
      }),
      { slugs: [EFFECT_SLUG] },
   )
}

let queued = false
const pendingActors = new Map()
const pendingTokenOverrides = new Map()
let pendingForceInactive = false

function normalizeActors(actors) {
   return [actors].flat().filter((actor) => actor?.documentName === "Actor")
}

export function refreshImperialFormationAutomation(
   extraActors = [],
   { delay = 50, forceInactive = false, tokenUpdates = [] } = {},
) {
   for (const actor of normalizeActors(extraActors)) {
      pendingActors.set(actor.uuid ?? actor.id, actor)
   }
   for (const update of [tokenUpdates].flat()) {
      const token = update?.token ?? update
      const override = tokenWithChanges(token, update?.changes ?? {})
      const key = tokenKey(override ?? token)
      if (key && override) pendingTokenOverrides.set(key, override)
   }
   pendingForceInactive ||= forceInactive
   if (queued) return
   queued = true
   setTimeout(() => {
      queued = false
      const shouldForceInactive = pendingForceInactive
      pendingForceInactive = false
      const tokenOverrides = new Map(pendingTokenOverrides)
      pendingTokenOverrides.clear()
      const tokensByActor = new Map()
      for (const actor of actorsWithImperialFormationState()) {
         tokensByActor.set(actor.uuid ?? actor.id, { actor, tokens: [] })
      }
      for (const actor of pendingActors.values()) {
         tokensByActor.set(actor.uuid ?? actor.id, { actor, tokens: [] })
      }
      pendingActors.clear()
      const combatantTokens = activeCombatantTokens(tokenOverrides)
      for (const token of combatantTokens) {
         const actor = tokenActor(token)
         if (!actor) continue
         const key = actor.uuid ?? actor.id
         const entry = tokensByActor.get(key) ?? { actor, tokens: [] }
         entry.tokens.push(token)
         tokensByActor.set(key, entry)
      }
      for (const entry of tokensByActor.values()) {
         void refreshActor(entry.actor, entry.tokens, combatantTokens, {
            forceInactive: shouldForceInactive,
         })
      }
   }, delay)
}
