import { readTemplarState } from "../state.mjs"
import {
   isBrilliantShardShieldItem,
} from "../items.mjs"
import { isInternalBrilliantShardItemChange } from "./items.mjs"
import { fact, textParagraph } from "../templates.mjs"
import {
   dialogContent,
   TemplarChoiceDialog,
} from "../dialogs.mjs"

const pendingBrilliantShardItemConfirmations = new Set()

function propertyFromUpdate(changes, path, fallback) {
   const value = foundry.utils.getProperty?.(changes, path)
   return value === undefined ? fallback : value
}

function physicalItemHeld(item) {
   const equipped = item?.system?.equipped ?? {}
   return equipped.carryType === "held" || Number(equipped.handsHeld ?? 0) > 0
}

function updateStopsHoldingItem(item, changes) {
   if (!physicalItemHeld(item)) return false
   const carryType = propertyFromUpdate(
      changes,
      "system.equipped.carryType",
      item?.system?.equipped?.carryType,
   )
   const handsHeld = propertyFromUpdate(
      changes,
      "system.equipped.handsHeld",
      item?.system?.equipped?.handsHeld,
   )
   return carryType !== "held" || Number(handsHeld ?? 0) <= 0
}

function shouldPromptBrilliantShardInventoryChange(item) {
   if (!isBrilliantShardShieldItem(item)) return false
   if (isInternalBrilliantShardItemChange(item)) return false
   const actor = item.actor
   if (!actor) return false
   return Boolean(readTemplarState(actor).brilliantShard?.active)
}

async function promptBrilliantShardDismissal(item, reason, dismiss) {
   const actor = item?.actor
   if (!actor || typeof dismiss !== "function") return false
   const key = `${actor.uuid ?? actor.id}:brilliant-shard-dismissal`
   if (pendingBrilliantShardItemConfirmations.has(key)) return false
   pendingBrilliantShardItemConfirmations.add(key)
   try {
      const choice = await TemplarChoiceDialog.prompt({
         title: "Dismiss Brilliant Shard?",
         content: await dialogContent({
            paragraphs: [
               textParagraph(reason),
               textParagraph(
                  "Confirming removes the Brilliant Shard effect and its generated shield. Canceling keeps the shard active.",
               ),
            ],
            facts: [
               fact("Item", item.name ?? "Brilliant Shard"),
               fact("Actor", actor.name ?? "Templar"),
            ],
         }),
         buttons: [
            { id: "confirm", label: "Confirm", icon: "fa-solid fa-check" },
            { id: "cancel", label: "Cancel" },
         ],
      })
      if (choice !== "confirm") return false
      await dismiss(actor)
      return true
   } finally {
      pendingBrilliantShardItemConfirmations.delete(key)
   }
}

export function confirmBrilliantShardItemDelete({ item, dismiss } = {}) {
   if (!shouldPromptBrilliantShardInventoryChange(item)) return true
   void promptBrilliantShardDismissal(
      item,
      "Removing this generated shield will stop the Brilliant Shard effect.",
      dismiss,
   )
   return false
}

export function confirmBrilliantShardItemUpdate({
   item,
   changes = {},
   dismiss,
} = {}) {
   if (!shouldPromptBrilliantShardInventoryChange(item)) return true
   if (!updateStopsHoldingItem(item, changes)) return true
   void promptBrilliantShardDismissal(
      item,
      "Stopping holding this generated shield will stop the Brilliant Shard effect.",
      dismiss,
   )
   return false
}
