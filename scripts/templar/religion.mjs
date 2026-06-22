import { levelBasedDC } from "./scaling.mjs"
import { religionProficiencyBonus } from "./state.mjs"

function clamp(value, min, max) {
   return Math.max(min, Math.min(max, value))
}

export async function rollReligionCheck(
   actor,
   title,
   dc = levelBasedDC(actor),
   { extraRollOptions = [], skipDialog = undefined, modifiers = [] } = {},
) {
   const statistic =
      actor?.getStatistic?.("religion") ??
      actor?.getStatistic?.("rel") ??
      actor?.skills?.religion ??
      actor?.skills?.rel

   const rollOptions = {
      dc: { value: dc },
      label: title,
      title,
      flavor: title,
      extraRollOptions: [
         ...new Set([
            "action:templar-barrier",
            "action:religion",
            ...extraRollOptions,
         ]),
      ],
   }
   if (skipDialog !== undefined) rollOptions.skipDialog = skipDialog
   if (modifiers?.length) rollOptions.modifiers = modifiers

   if (typeof statistic?.roll === "function") return statistic.roll(rollOptions)
   if (typeof statistic?.check?.roll === "function") {
      return statistic.check.roll(rollOptions)
   }

   ui.notifications?.warn("Could not find a Religion statistic on this actor.")
   return null
}

export function repairHealingForDegree(actor, degree) {
   const rank = clamp(Math.trunc(religionProficiencyBonus(actor) / 2), 0, 4)
   const success = 5 + rank * 5
   if (degree >= 3) return success * 2
   if (degree >= 2) return success
   return 0
}
