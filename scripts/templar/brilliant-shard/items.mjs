import {
   MODULE_ID,
   TEMPLAR_ASSETS,
} from "../constants.mjs"
import {
   calculateBrilliantShard,
   readTemplarState,
} from "../state.mjs"
import { stateBrilliantShardIntact } from "../barrier/state.mjs"
import {
   actorItemArray,
   isBrilliantShardShieldItem,
} from "../items.mjs"
import { debugTemplar } from "../debug.mjs"

const internalBrilliantShardItemChanges = new Set()
const deletingBrilliantShardItemIds = new Set()

export function brilliantShardLoopKey(actor) {
   return `brilliant-shard:${actor?.uuid ?? actor?.id ?? "actor"}`
}

function brilliantShardItems(actor) {
   return actorItemArray(actor).filter((item) =>
      Boolean(item?.getFlag?.(MODULE_ID, "brilliantShardItem")),
   )
}

function brilliantShardShieldItems(actor) {
   return brilliantShardItems(actor).filter(isBrilliantShardShieldItem)
}

export function isInternalBrilliantShardItemChange(itemOrId) {
   const id = typeof itemOrId === "string" ? itemOrId : itemOrId?.id
   return Boolean(id && internalBrilliantShardItemChanges.has(id))
}

export async function removeBrilliantShardItem(actor) {
   const items = new Map(
      brilliantShardItems(actor)
         .filter((item) => item?.id)
         .map((item) => [item.id, item]),
   )
   for (const [id, item] of items) {
      if (deletingBrilliantShardItemIds.has(id)) continue
      const liveItem =
         actor?.items?.get?.(id) ??
         actorItemArray(actor).find((entry) => entry?.id === id)
      if (!liveItem) continue
      deletingBrilliantShardItemIds.add(id)
      internalBrilliantShardItemChanges.add(id)
      try {
         await liveItem.delete?.()
      } catch (error) {
         const message = String(error?.message ?? error ?? "")
         if (!message.includes("does not exist")) {
            debugTemplar("Brilliant Shard item deletion failed", {
               actor: actor?.name,
               item: item?.name ?? liveItem?.name,
               id,
               error,
            })
         }
      } finally {
         internalBrilliantShardItemChanges.delete(id)
         deletingBrilliantShardItemIds.delete(id)
      }
   }
}

function actorHands(actor) {
   const hands = Number(
      actor?.system?.attributes?.hands?.value ??
         actor?.system?.hands?.value ??
         actor?.system?.traits?.hands?.value,
   )
   return Number.isFinite(hands) && hands > 0 ? hands : 2
}

function actorHeldHands(actor) {
   return actorItemArray(actor).reduce((total, item) => {
      const equipped = item?.system?.equipped ?? {}
      if (
         equipped.carryType !== "held" &&
         Number(equipped.handsHeld ?? 0) <= 0
      ) {
         return total
      }
      return total + Math.max(0, Number(equipped.handsHeld ?? 0) || 0)
   }, 0)
}

export function actorFreeHands(actor) {
   return Math.max(0, actorHands(actor) - actorHeldHands(actor))
}

function brilliantShardRuneData(rank) {
   const spellRank = Math.max(3, Number(rank) || 3)
   if (spellRank >= 10) return { potency: 3, striking: 3 }
   if (spellRank >= 8) return { potency: 2, striking: 2 }
   if (spellRank >= 6) return { potency: 1, striking: 1 }
   return { potency: 0, striking: 0 }
}

function brilliantShardShieldRules(itemOrId) {
   const itemId = typeof itemOrId === "string" ? itemOrId : itemOrId?.id
   if (!itemId) return []
   const predicate = [`item:id:${itemId}`]
   return ["holy", "light"].map((trait) => ({
      key: "AdjustStrike",
      mode: "add",
      predicate,
      property: "traits",
      value: trait,
   }))
}

function brilliantShardShieldSource(actor, shard, currentHp = shard.max) {
   const hp = Math.max(0, Math.trunc(Number(currentHp) || shard.max))
   const runes = brilliantShardRuneData(shard.rank)
   return {
      name: "Brilliant Shard",
      type: "shield",
      img: TEMPLAR_ASSETS.brilliantShield,
      system: {
         description: {
            value: "<p>A conjured shield of hard light. Sarnout Chronicles routes Light Barrier automation through this shield while Brilliant Shard is active.</p>",
            gm: "",
         },
         slug: "brilliant-shard",
         rules: brilliantShardShieldRules(),
         traits: {
            rarity: "uncommon",
            value: ["holy", "integrated-1d6-b", "light"],
            otherTags: [],
            integrated: {
               damageType: "fire",
               runes: {
                  potency: runes.potency,
                  striking: runes.striking,
                  property: [],
               },
               versatile: null,
            },
         },
         publication: {
            title: "",
            authors: "",
            license: "OGL",
            remaster: false,
         },
         level: { value: shard.rank },
         quantity: 1,
         baseItem: "steel-shield",
         bulk: { value: 0 },
         hp: {
            value: hp,
            max: shard.max,
            brokenThreshold: Math.floor(shard.max / 2),
         },
         hardness: shard.hardness,
         price: { value: {} },
         equipped: {
            carryType: "held",
            invested: null,
            handsHeld: 1,
         },
         containerId: null,
         size: "med",
         material: { type: null, grade: null },
         identification: {
            status: "identified",
            unidentified: {
               name: "",
               img: "",
               data: { description: { value: "" } },
            },
         },
         acBonus: 2,
         runes: {
            reinforcing: 0,
            property: [],
         },
         specific: null,
         subitems: [],
      },
      flags: {
         [MODULE_ID]: {
            brilliantShardItem: true,
            brilliantShardShield: true,
            actorUuid: actor.uuid,
         },
      },
   }
}

export async function createOrRefreshBrilliantShardItem(
   actor,
   shard,
   currentHp = shard.max,
) {
   if (!actor?.createEmbeddedDocuments) return null
   await removeBrilliantShardItem(actor)
   const [shield] = await actor.createEmbeddedDocuments("Item", [
      brilliantShardShieldSource(actor, shard, currentHp),
   ])
   if (!shield) return null
   internalBrilliantShardItemChanges.add(shield.id)
   try {
      await shield.update?.({
         "system.rules": brilliantShardShieldRules(shield),
      })
   } finally {
      internalBrilliantShardItemChanges.delete(shield.id)
   }
   return shield
}

export async function syncBrilliantShardItem(actor) {
   const state = readTemplarState(actor)
   if (!stateBrilliantShardIntact(state)) {
      await removeBrilliantShardItem(actor)
      return null
   }
   const shard = calculateBrilliantShard(actor)
   const item = brilliantShardShieldItems(actor)[0]
   if (!item)
      return createOrRefreshBrilliantShardItem(
         actor,
         shard,
         state.brilliantShard.value,
      )
   const runes = brilliantShardRuneData(shard.rank)
   internalBrilliantShardItemChanges.add(item.id)
   try {
      return item.update?.({
         "system.hp.value": state.brilliantShard.value,
         "system.hp.max": state.brilliantShard.max,
         "system.hp.brokenThreshold": Math.floor(state.brilliantShard.max / 2),
         "system.hardness": state.brilliantShard.hardness,
         "system.level.value": shard.rank,
         "system.equipped.carryType": "held",
         "system.equipped.handsHeld": 1,
         "system.bulk.value": 0,
         "system.traits.value": ["holy", "integrated-1d6-b", "light"],
         "system.traits.integrated.damageType": "fire",
         "system.traits.integrated.runes.potency": runes.potency,
         "system.traits.integrated.runes.striking": runes.striking,
         "system.traits.integrated.runes.property": [],
         "system.traits.integrated.versatile": null,
         "system.rules": brilliantShardShieldRules(item),
         "system.subitems": [],
         img: TEMPLAR_ASSETS.brilliantShield,
      })
   } finally {
      internalBrilliantShardItemChanges.delete(item.id)
   }
}
