import { MODULE_ID } from "./constants.mjs"
import { degreeFromCheckRoll } from "./counteract.mjs"
import { createLightGaolCondition } from "./light-gaol/effects.mjs"

function clamp(value, min, max) {
   return Math.max(min, Math.min(max, value))
}

async function actorFromUuid(uuid) {
   const doc =
      globalThis.fromUuidSync?.(uuid) ||
      (uuid ? await fromUuid(uuid).catch(() => null) : null)
   return doc?.actor ?? (doc?.documentName === "Actor" ? doc : null)
}

export async function rollLightBurstSaveFromCard({
   targetUuid,
   messageId,
} = {}) {
   const message = messageId ? game.messages?.get?.(messageId) : null
   const data = message?.getFlag?.(MODULE_ID, "lightBurstCard") ?? {}
   const token =
      globalThis.fromUuidSync?.(targetUuid) ||
      (targetUuid ? await fromUuid(targetUuid).catch(() => null) : null)
   const actor = token?.actor
   if (!actor) {
      ui.notifications?.warn("Light Burst target was not found.")
      return null
   }
   const dc = Number(data.dc)
   const reflex = actor.saves?.reflex ?? actor.getStatistic?.("reflex")
   if (typeof reflex?.roll !== "function") {
      ui.notifications?.warn(
         `${actor.name} does not have a Reflex save statistic.`,
      )
      return null
   }
   return reflex.roll({
      dc: Number.isFinite(dc) && dc > 0 ? { value: dc } : undefined,
      label: `${data.title ?? "Light Burst"} Reflex Save`,
      title: `${data.title ?? "Light Burst"} Reflex Save`,
      extraRollOptions: [
         "damaging-effect",
         "light-burst",
         "item:trait:holy",
         "item:trait:light",
         "origin:trait:holy",
         "origin:trait:light",
      ],
   })
}

export async function rollBlindingBladeSaveFromCard({ targetUuid, dc } = {}) {
   const targeted =
      !targetUuid && game.user?.targets?.size
         ? Array.from(game.user.targets)[0]
         : null
   targetUuid ??= targeted?.document?.uuid ?? targeted?.uuid ?? null
   const actor = await actorFromUuid(targetUuid)

   if (!actor) {
      ui.notifications?.warn("Blinding Blade target was not found.")
      return null
   }

   const dcValue = Number(dc)
   const saveStat = actor.saves?.reflex ?? actor.getStatistic?.("reflex")
   if (typeof saveStat?.roll !== "function") {
      ui.notifications?.warn(
         `${actor.name} does not have a Reflex save statistic.`,
      )
      return null
   }

   let callbackOutcome = null

   const message = await saveStat.roll({
      dc:
         Number.isFinite(dcValue) && dcValue > 0
            ? { value: dcValue }
            : undefined,
      label: "Blinding Blade Reflex Save",
      title: "Blinding Blade Reflex Save",
      extraRollOptions: [
         "item:trait:holy",
         "item:trait:light",
         "origin:trait:holy",
         "origin:trait:light",
      ],
      callback: (_roll, outcome) => {
         callbackOutcome = outcome
      },
   })

   if (!message) return null

   let degree = null
   const roll = message.rolls?.[0] ?? (message instanceof Roll ? message : null)
   const rawOutcome =
      callbackOutcome?.degreeOfSuccess?.value ??
      callbackOutcome?.degreeOfSuccess ??
      callbackOutcome?.dos ??
      callbackOutcome?.outcome ??
      callbackOutcome ??
      message.flags?.pf2e?.context?.outcome ??
      roll?.degreeOfSuccess

   const numericOutcome = Number(rawOutcome)
   const textOutcome = String(rawOutcome ?? "")
   if (Number.isFinite(numericOutcome)) degree = clamp(numericOutcome, 0, 3)
   else if (
      ["criticalFailure", "critical-failure", "critical failure"].includes(
         textOutcome,
      )
   )
      degree = 0
   else if (textOutcome === "failure") degree = 1
   else if (textOutcome === "success") degree = 2
   else if (
      ["criticalSuccess", "critical-success", "critical success"].includes(
         textOutcome,
      )
   )
      degree = 3

   if (degree === null && roll) {
      degree = degreeFromCheckRoll(roll, dcValue)
   }

   if (degree === 0 || degree === 1) {
      const durationValue = degree === 0 ? 2 : 1
      await createLightGaolCondition(actor, "blinded", durationValue)
   }

   return message
}

export async function rollLightGaolSaveFromCard({
   targetUuid,
   dc,
   saveType,
} = {}) {
   const actor = await actorFromUuid(targetUuid)

   if (!actor) {
      ui.notifications?.warn("Light Gaol target was not found.")
      return null
   }
   const dcValue = Number(dc)
   const saveStat = actor.saves?.[saveType] ?? actor.getStatistic?.(saveType)
   if (typeof saveStat?.roll !== "function") {
      ui.notifications?.warn(
         `${actor.name} does not have a ${saveType} save statistic.`,
      )
      return null
   }
   const saveLabel = saveType.charAt(0).toUpperCase() + saveType.slice(1)
   return saveStat.roll({
      dc:
         Number.isFinite(dcValue) && dcValue > 0
            ? { value: dcValue }
            : undefined,
      label: `Light Gaol ${saveLabel} Save`,
      title: `Light Gaol ${saveLabel} Save`,
      extraRollOptions: [
         "damaging-effect",
         "light-gaol",
         "item:trait:holy",
         "item:trait:light",
         "origin:trait:holy",
         "origin:trait:light",
      ],
   })
}
