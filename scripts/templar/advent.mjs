import {
   LINKED_TEMPLAR_EFFECTS,
   MODULE_ID,
   RALLYING_ANIMATION_MS,
   TEMPLAR_ASSETS,
   TEMPLAR_SLUGS,
} from "./constants.mjs"
import {
   actorHasSlug,
   readTemplarState,
   slugify,
   writeTemplarState,
} from "./state.mjs"
import {
   barrierAbilityAvailable,
   effectiveBarrier,
} from "./barrier/state.mjs"
import { alliedTokensInEmanation } from "./tokens.mjs"
import {
   featureDetected,
   getActor,
   warnBarrierDestroyed,
} from "./actors.mjs"
import { spendFocusPoint } from "./focus.mjs"
import { playSound } from "./audio.mjs"
import { emitTemplarLight } from "./light.mjs"
import { postTemplarMessage } from "./messages.mjs"
import { setLinkedTemplarEffect } from "./linked-effects.mjs"
import { syncBrilliantShardItem } from "./brilliant-shard/items.mjs"
import { releaseHeldForBarrierTrait } from "./holding/release.mjs"

function sleep(ms) {
   return new Promise((resolve) => setTimeout(resolve, ms))
}

function requestBarrierPanel(actor) {
   Hooks.callAll(`${MODULE_ID}.openTemplarBarrierPanel`, actor)
}

function adventResistanceEffectSlug(sourceActor) {
   return `effect-advent-resistance-${sourceActor.id ?? sourceActor.uuid ?? "source"}`
}

export function adventResistanceValue(actor) {
   const state = readTemplarState(actor)
   const active = effectiveBarrier(state)
   const baseHardness =
      active?.key === "brilliantShard"
         ? Number(
              state.brilliantShard.baseHardness ??
                 state.brilliantShard.hardness,
           )
         : Number(state.light.baseHardness ?? state.light.hardness)
   return Math.max(1, Math.floor(baseHardness / 2))
}

export async function removeAdventResistanceEffects(actor) {
   const sourceUuid = actor?.uuid
   const removals = []
   for (const target of game.actors ?? []) {
      const items =
         target.items?.filter?.((item) => {
            const flag = item.getFlag?.(MODULE_ID, "adventSource")
            const slug = slugify(item.slug ?? item.system?.slug ?? item.name)
            return (
               flag === sourceUuid ||
               slug === adventResistanceEffectSlug(actor) ||
               slug === "effect-advent-resistance"
            )
         }) ?? []
      for (const item of items) removals.push(item.delete?.())
   }
   return Promise.all(removals)
}

export async function applyAdventResistanceEffects(actor) {
   if (!canvas?.ready) return []
   const value = adventResistanceValue(actor)
   const lightProtects = actorHasSlug(actor, TEMPLAR_SLUGS.lightProtects)
   const allProtectingLight = actorHasSlug(
      actor,
      TEMPLAR_SLUGS.allProtectingLight,
   )

   const rules = []
   if (allProtectingLight) {
      rules.push({ key: "Resistance", type: "all-damage", value })
   } else if (lightProtects) {
      rules.push({ key: "Resistance", type: "physical", value })
      rules.push({
         key: "Resistance",
         type: "custom",
         label: "Light Protects",
         value,
         definition: [
            {
               or: [
                  "item:trait:darkness",
                  "item:trait:shadow",
                  "item:trait:unholy",
                  "origin:trait:darkness",
                  "origin:trait:shadow",
                  "origin:trait:unholy",
               ],
            },
         ],
      })
   } else {
      rules.push({ key: "Resistance", type: "physical", value })
   }

   const inRange = new Set()
   const effects = []
   for (const token of alliedTokensInEmanation(actor, 15)) {
      const target = token.actor
      if (!target?.createEmbeddedDocuments) continue
      inRange.add(target.uuid ?? target.id)
      const slug = adventResistanceEffectSlug(actor)
      const existing = target.items?.find?.((item) => {
         if (item.type !== "effect") return false
         return (
            item.getFlag?.(MODULE_ID, "adventSource") === actor.uuid ||
            slugify(item.slug ?? item.system?.slug ?? item.name) === slug
         )
      })
      const data = {
         name: "Effect: Advent Resistance",
         type: "effect",
         img: TEMPLAR_ASSETS.advent,
         system: {
            slug,
            duration: { value: 1, unit: "minutes", expiry: "turn-start" },
            rules,
            description: {
               value: `Advent grants resistance ${value} to damage from ${actor.name}.`,
            },
         },
         flags: {
            [MODULE_ID]: {
               adventSource: actor.uuid,
            },
         },
      }
      if (existing?.update) {
         await existing.update({
            img: data.img,
            "system.duration": data.system.duration,
            "system.rules": data.system.rules,
            "system.description": data.system.description,
         })
         effects.push(existing)
      } else {
         const [effect] = await target.createEmbeddedDocuments("Item", [data])
         if (effect) effects.push(effect)
      }
   }

   for (const target of game.actors ?? []) {
      const key = target.uuid ?? target.id
      if (inRange.has(key)) continue
      const items =
         target.items?.filter?.((item) => {
            const flag = item.getFlag?.(MODULE_ID, "adventSource")
            return flag === actor.uuid
         }) ?? []
      for (const item of items) await item.delete?.()
   }
   return effects
}

export async function refreshAdventResistance({ actor = null } = {}) {
   const actors = actor
      ? [getActor(actor)].filter(Boolean)
      : Array.from(game.actors ?? []).filter((candidate) => {
           try {
              return readTemplarState(candidate).advent?.active
           } catch (_error) {
              return false
           }
        })

   const results = []
   for (const candidate of actors) {
      const state = readTemplarState(candidate)
      if (!state.advent?.active) {
         results.push(await removeAdventResistanceEffects(candidate))
         continue
      }
      if (!barrierAbilityAvailable(state)) {
         results.push(await setAdvent({ actor: candidate, active: false }))
         continue
      }
      results.push(await applyAdventResistanceEffects(candidate))
   }
   return results
}

export async function setAdvent({ actor, active = true } = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   requestBarrierPanel(resolved)
   const state = readTemplarState(resolved)

   if (!active) {
      state.rallying.active = false
      state.rallying.transitioning = false
      state.advent.active = false
      state.advent.transitioning = false
      const result = await writeTemplarState(resolved, state)
      await setLinkedTemplarEffect(
         resolved,
         LINKED_TEMPLAR_EFFECTS.advent,
         false,
      )
      await removeAdventResistanceEffects(resolved)
      await syncBrilliantShardItem(resolved)
      return result
   }

   if (!barrierAbilityAvailable(state)) {
      warnBarrierDestroyed()
      return null
   }

   state.rallying.transitioning = true
   state.advent.transitioning = true
   await writeTemplarState(resolved, state)
   await playSound(TEMPLAR_ASSETS.adventSound)
   await sleep(RALLYING_ANIMATION_MS)
   const fresh = readTemplarState(resolved)
   fresh.rallying.transitioning = false
   fresh.rallying.active = true
   fresh.advent.transitioning = false
   fresh.advent.active = true
   const result = await writeTemplarState(resolved, fresh)
   await setLinkedTemplarEffect(resolved, LINKED_TEMPLAR_EFFECTS.advent, true)
   await syncBrilliantShardItem(resolved)
   const effects = await applyAdventResistanceEffects(resolved)
   await postTemplarMessage(
      resolved,
      "Advent",
      `Applied Advent resistance ${adventResistanceValue(resolved)} to ${effects.length} allied token${effects.length === 1 ? "" : "s"} in the 15-foot emanation. Your active barrier's Hardness is halved while Advent is active.`,
   )
   return result
}

export async function toggleAdvent({ actor } = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   const active = !readTemplarState(resolved).advent.active
   return setAdvent({ actor: resolved, active })
}

export async function setRallying(options = {}) {
   return setAdvent(options)
}

export async function toggleRallying(options = {}) {
   return toggleAdvent(options)
}

export async function advent({
   actor,
   spendFocus = true,
   fromSpellMessage = false,
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   if (!featureDetected(resolved, TEMPLAR_SLUGS.advent, fromSpellMessage)) {
      ui.notifications?.warn("Advent was not detected on this actor.")
      return null
   }
   if (!barrierAbilityAvailable(readTemplarState(resolved))) {
      warnBarrierDestroyed()
      return null
   }
   if (spendFocus && !(await spendFocusPoint(resolved))) return null
   await releaseHeldForBarrierTrait(resolved, "Advent")
   await emitTemplarLight(resolved)
   return setAdvent({ actor: resolved, active: true })
}
