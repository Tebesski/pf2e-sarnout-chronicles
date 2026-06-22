import {
   MODULE_ID,
   RELEASED_ICON_MS,
   RELEASE_FLASH_TAIL_MS,
   RELEASE_ICON_SWAP_MS,
   TEMPLAR_ASSETS,
   TEMPLAR_SETTINGS,
   TEMPLAR_SLUGS,
} from "../constants.mjs"
import {
   actorHasSlug,
   currentCombatRound,
   currentCombatTurn,
   readTemplarState,
   writeTemplarState,
} from "../state.mjs"
import {
   createTypedDamageRoll,
   createTypedDamageRollFromGroups,
   damageGroupTraits,
   damageTypeLabel,
   getDamageRollClass,
   groupDamageInstances,
   slotDamageInstances,
} from "../damage.mjs"
import { applyActorDamage } from "../actor-damage.mjs"
import { getActor } from "../actors.mjs"
import { playSound } from "../audio.mjs"
import { postTemplarMessage } from "../messages.mjs"
import { renderTemplarTemplate } from "../templates.mjs"
import { targetActorToken } from "../tokens.mjs"
import { activeHoldingSlots } from "./helpers.mjs"

const releasingHoldingSlots = new Set()

function sleep(ms) {
   return new Promise((resolve) => setTimeout(resolve, ms))
}

function cappedDamageInstances(instances, amount) {
   let remaining = Math.max(0, Math.trunc(Number(amount) || 0))
   const capped = []
   for (const instance of instances) {
      if (remaining <= 0) break
      const total = Math.min(instance.total, remaining)
      remaining -= total
      if (total > 0) capped.push({ ...instance, total })
   }
   return capped
}

function slotReleasedDamageGroups(
   slot,
   amount = slot?.damage,
   { bypassIWR = false } = {},
) {
   const instances = cappedDamageInstances(slotDamageInstances(slot), amount)
   if (bypassIWR) {
      return [
         {
            type: "untyped",
            persistent: false,
            precision: false,
            evaluatePersistent: false,
            bypassIWR: true,
            total: instances.reduce((sum, instance) => sum + instance.total, 0),
         },
      ].filter((group) => group.total > 0)
   }
   return groupDamageInstances(instances, { bypassIWR: false })
}

async function releaseDamageFromSlot(actor, slot, amount = slot.damage) {
   const damage = Math.max(0, Math.trunc(Number(amount) || 0))
   if (damage <= 0) return null

   const usesTypedRelease =
      actorHasSlug(actor, TEMPLAR_SLUGS.defenseMaster) &&
      slot.bypassIWR === false
   if (!usesTypedRelease) {
      return applyActorDamage(actor, damage, { bypassIWR: true })
   }

   const typedRoll = await createTypedDamageRollFromGroups(
      slotReleasedDamageGroups(slot, damage, { bypassIWR: false }),
   )
   if (typedRoll)
      return applyActorDamage(actor, typedRoll, { bypassIWR: false })
   return applyActorDamage(actor, damage, { bypassIWR: false })
}

async function postReleasedDamageCard(actor, slot, amount = slot.damage) {
   const damage = Math.max(0, Math.trunc(Number(amount) || 0))
   if (damage <= 0) return null
   targetActorToken(actor)

   const usesTypedRelease =
      actorHasSlug(actor, TEMPLAR_SLUGS.defenseMaster) &&
      slot.bypassIWR === false
   const roll =
      (usesTypedRelease
         ? await createTypedDamageRollFromGroups(
              slotReleasedDamageGroups(slot, damage, { bypassIWR: false }),
           )
         : await createTypedDamageRoll(damage, "untyped")) ??
      (await new Roll(`${damage}`).evaluate())
   return roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: await renderTemplarTemplate("released-damage-flavor", {
         actorName: actor.name,
      }),
   })
}

async function postMergedReleasedDamageCard(actor, groups) {
   const activeGroups = groups.filter((group) => group.total > 0)
   if (!activeGroups.length) return null
   targetActorToken(actor)
   const formula = activeGroups
      .map((group) => `{${group.total}[${damageGroupTraits(group)}]}`)
      .join(",")
   let roll = null
   const DamageRoll = getDamageRollClass()
   try {
      roll = DamageRoll
         ? await new DamageRoll(formula).evaluate()
         : await new Roll(
              activeGroups.map((group) => group.total).join(" + "),
           ).evaluate()
   } catch (_error) {
      roll = await new Roll(
         String(activeGroups.reduce((sum, group) => sum + group.total, 0)),
      ).evaluate()
   }
   return roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: await renderTemplarTemplate("released-damage-flavor", {
         actorName: actor.name,
      }),
   })
}

function releaseModeFromRequest(dealDamage) {
   if (dealDamage === false) return "none"
   if (dealDamage === true) return "auto"
   return game.settings?.get?.(
      MODULE_ID,
      TEMPLAR_SETTINGS.autoDealReleasedBarrierDamage,
   )
      ? "auto"
      : "card"
}

function releasedDamageGroups(actor, slots) {
   const hasDefenseMaster = actorHasSlug(actor, TEMPLAR_SLUGS.defenseMaster)
   const groups = new Map()
   for (const slot of slots) {
      const total = Math.max(0, Math.trunc(Number(slot?.damage) || 0))
      if (total <= 0) continue
      const usesTypedRelease = hasDefenseMaster && slot.bypassIWR === false
      for (const entry of slotReleasedDamageGroups(slot, total, {
         bypassIWR: !usesTypedRelease,
      })) {
         const key = [
            entry.type,
            entry.persistent ? "persistent" : "",
            entry.precision ? "precision" : "",
            entry.evaluatePersistent ? "evaluatePersistent" : "",
            entry.bypassIWR ? "bypass" : "typed",
         ].join("|")
         const group = groups.get(key) ?? { ...entry, total: 0 }
         group.total += entry.total
         groups.set(key, group)
      }
   }
   return [...groups.values()]
}

function releasedDamageBreakdown(groups) {
   return groups
      .filter((group) => group.total > 0)
      .map((group) => `${group.total} ${damageTypeLabel(group.type)}`)
      .join(", ")
}

async function applyMergedReleasedDamage(actor, groups) {
   const typedGroups = []
   for (const group of groups) {
      if (group.total <= 0) continue
      if (group.bypassIWR) {
         await applyActorDamage(actor, group.total, { bypassIWR: true })
         continue
      }
      typedGroups.push(group)
   }
   if (typedGroups.length) {
      const total = typedGroups.reduce((sum, group) => sum + group.total, 0)
      const roll = await createTypedDamageRollFromGroups(typedGroups)
      await applyActorDamage(actor, roll ?? total, { bypassIWR: false })
   }
}

export async function releaseHoldingSlotsMerged(
   actor,
   slots,
   { dealDamage = null, messageTitle = "Barrier Release" } = {},
) {
   const resolved = getActor(actor)
   if (!resolved || !slots?.length) return []
   const snapshots = slots
      .filter((slot) => slot?.active)
      .map(
         (slot) =>
            foundry.utils.deepClone?.(slot) ?? JSON.parse(JSON.stringify(slot)),
      )
   if (!snapshots.length) return []

   const releaseMode = releaseModeFromRequest(dealDamage)
   const groups = releasedDamageGroups(resolved, snapshots)
   const released = []
   for (const slot of snapshots) {
      released.push(
         await releaseHolding({
            actor: resolved,
            slotIndex: slot.index,
            dealDamage: false,
            messageTitle,
            postMessage: false,
         }),
      )
   }

   if (releaseMode === "auto") {
      await applyMergedReleasedDamage(resolved, groups)
   } else if (releaseMode === "card") {
      await postMergedReleasedDamageCard(resolved, groups)
   }

   const total = groups.reduce((sum, group) => sum + group.total, 0)
   const breakdown = releasedDamageBreakdown(groups)
   await postTemplarMessage(
      resolved,
      messageTitle,
      releaseMode === "auto"
         ? `Released ${snapshots.length} held barrier${snapshots.length === 1 ? "" : "s"} and applied held damage ${total}${breakdown ? ` (${breakdown})` : ""}.`
         : releaseMode === "card"
           ? `Released ${snapshots.length} held barrier${snapshots.length === 1 ? "" : "s"} and posted one damage card for ${total}${breakdown ? ` (${breakdown})` : ""}.`
           : `Released ${snapshots.length} held barrier${snapshots.length === 1 ? "" : "s"} without dealing held damage ${total}${breakdown ? ` (${breakdown})` : ""}.`,
   )
   return released
}

export async function releaseHeldForBarrierTrait(
   actor,
   reason = "Barrier action",
) {
   if (actorHasSlug(actor, TEMPLAR_SLUGS.defenseMaster)) return []
   const state = readTemplarState(actor)
   const slots = activeHoldingSlots(state)
   return releaseHoldingSlotsMerged(actor, slots, {
      messageTitle: `Barrier Release: ${reason}`,
   })
}

export async function releaseHolding({
   actor,
   slotIndex = 0,
   dealDamage = null,
   messageTitle = "Barrier Release",
   postMessage = true,
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   const index = Number(slotIndex)
   const releaseKey = `${resolved.uuid ?? resolved.id}:${index}`
   if (releasingHoldingSlots.has(releaseKey)) return null
   releasingHoldingSlots.add(releaseKey)

   try {
      const state = readTemplarState(resolved)
      const slot = state.holding[index]
      if (!slot?.active || slot.releasing) return null

      const releasedDamage = slot.damage
      const releaseMode = releaseModeFromRequest(dealDamage)
      slot.releasing = true
      await writeTemplarState(resolved, state)

      void playSound(TEMPLAR_ASSETS.releaseSound)

      if (releaseMode === "auto" && releasedDamage > 0) {
         await releaseDamageFromSlot(resolved, slot, releasedDamage)
      } else if (releaseMode === "card" && releasedDamage > 0) {
         await postReleasedDamageCard(resolved, slot, releasedDamage)
      }

      if (postMessage) {
         await postTemplarMessage(
            resolved,
            messageTitle,
            releaseMode === "auto"
               ? `Released and applied held damage ${releasedDamage}.`
               : releaseMode === "card"
                 ? `Released held damage ${releasedDamage} and posted a damage card.`
                 : `Released held damage ${releasedDamage} without dealing it to you.`,
         )
      }

      await sleep(RELEASE_ICON_SWAP_MS)

      const fresh = readTemplarState(resolved)
      const freshSlot = fresh.holding[index]
      if (!freshSlot) return null
      freshSlot.active = false
      freshSlot.releasing = true
      freshSlot.released = true
      freshSlot.restoring = false
      freshSlot.lastReleasedDamage = releasedDamage
      freshSlot.damage = 0
      freshSlot.damageType = "untyped"
      freshSlot.damageTypes = ["untyped"]
      freshSlot.damageInstances = null
      freshSlot.rollData = null
      freshSlot.bypassIWR = true

      freshSlot.roundsSustained = 0
      freshSlot.createdRound = currentCombatRound()
      freshSlot.createdTurn = currentCombatTurn()
      freshSlot.lastSustainedRound = null
      freshSlot.lastSustainedTurn = null
      freshSlot.promptedRound = null
      freshSlot.promptedTurn = null
      freshSlot.turnDecision = null
      freshSlot.decisionRound = null
      freshSlot.decisionTurn = null

      await writeTemplarState(resolved, fresh)
      await sleep(RELEASE_FLASH_TAIL_MS)

      const settled = readTemplarState(resolved)
      const settledSlot = settled.holding[index]
      if (settledSlot?.released) {
         settledSlot.releasing = false
         await writeTemplarState(resolved, settled)
      }

      setTimeout(async () => {
         const latest = readTemplarState(resolved)
         const latestSlot = latest.holding[index]
         if (!latestSlot?.released) return
         latestSlot.released = false
         latestSlot.restoring = true
         latestSlot.lastReleasedDamage = 0
         await writeTemplarState(resolved, latest)

         setTimeout(async () => {
            const restored = readTemplarState(resolved)
            const restoredSlot = restored.holding[index]
            if (!restoredSlot?.restoring) return
            restoredSlot.restoring = false
            await writeTemplarState(resolved, restored)
         }, 550)
      }, RELEASED_ICON_MS)

      return readTemplarState(resolved)
   } finally {
      releasingHoldingSlots.delete(releaseKey)
   }
}

export async function releaseLargestHolding({ actor } = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   const state = readTemplarState(resolved)
   const largest = state.holding.reduce(
      (best, slot, index) =>
         slot.active && slot.damage > best.damage
            ? { index, damage: slot.damage }
            : best,
      { index: -1, damage: -1 },
   )
   if (largest.index < 0) {
      ui.notifications?.warn("No held damage is available to release.")
      return null
   }
   return releaseHolding({ actor: resolved, slotIndex: largest.index })
}
