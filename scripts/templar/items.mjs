import { MODULE_ID } from "./constants.mjs"
import { actorHasSlug } from "./state.mjs"

export function actorItemArray(actor) {
   if (Array.isArray(actor?.items)) return actor.items
   if (Array.isArray(actor?.items?.contents)) return actor.items.contents
   return Array.from(actor?.items ?? [])
}

export function actorHasRaisedShield(actor) {
   return Boolean(
      actor?.attributes?.shield?.raised ||
      actorHasSlug(actor, ["effect-raise-a-shield"]),
   )
}

export function isBrilliantShardShieldItem(item) {
   return Boolean(
      item?.type === "shield" &&
         item?.getFlag?.(MODULE_ID, "brilliantShardItem") &&
         item?.getFlag?.(MODULE_ID, "brilliantShardShield") !== false,
   )
}

export function actorRaisedShieldItem(actor) {
   const itemId = actor?.attributes?.shield?.itemId
   if (!itemId) return null
   return (
      actor?.items?.get?.(itemId) ??
      actorItemArray(actor).find((item) => item.id === itemId)
   )
}

export function actorRaisedShieldIsBrilliantShard(actor) {
   return Boolean(
      actor?.attributes?.shield?.raised &&
         isBrilliantShardShieldItem(actorRaisedShieldItem(actor)),
   )
}

export function actorHasOrdinaryRaisedShield(actor) {
   const raisedShield = actorRaisedShieldItem(actor)
   return Boolean(
      raisedShield &&
         actorHasRaisedShield(actor) &&
         !isBrilliantShardShieldItem(raisedShield),
   )
}
