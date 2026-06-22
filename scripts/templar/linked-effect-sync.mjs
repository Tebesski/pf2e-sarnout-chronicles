import {
   LAST_STRONGHOLD_SOURCE_SLUG,
   LINKED_TEMPLAR_EFFECTS,
   MODULE_ID,
   TEMPLAR_ASSETS,
   TEMPLAR_SLUGS,
} from "./constants.mjs"
import { slugify } from "./state.mjs"
import {
   createOrRefreshEffect,
   itemMatchesSlugGroup,
   linkedEffectExpired,
} from "./effects.mjs"
import {
   isInternalLinkedTemplarEffectChange,
   linkedEffectConfigFromItem,
} from "./linked-effects.mjs"
import { setBrilliantShard } from "./brilliant-shard/actions.mjs"
import { setAdvent } from "./advent.mjs"

export async function syncLinkedTemplarEffect({
   item,
   deleted = false,
} = {}) {
   if (isInternalLinkedTemplarEffectChange(item)) return null
   const actor = item?.actor ?? item?.parent ?? null
   const slug = slugify(item?.slug ?? item?.system?.slug ?? item?.name)

   if (
      deleted &&
      item?.type === "effect" &&
      slug === "effect-refraction-used"
   ) {
      const ability = actor?.items?.find?.(
         (i) =>
            itemMatchesSlugGroup(i, TEMPLAR_SLUGS.refraction) &&
            ["action", "feat"].includes(i.type),
      )
      if (ability?.system?.frequency) {
         try {
            await ability.update({
               "system.frequency.value": Math.min(
                  ability.system.frequency.max,
                  ability.system.frequency.value + 1,
               ),
            })
         } catch (_error) {}
      }
   }

   if (
      deleted &&
      item?.type === "effect" &&
      slug === LAST_STRONGHOLD_SOURCE_SLUG
   ) {
      const regionUuid = item.flags?.[MODULE_ID]?.regionUuid
      if (regionUuid) {
         const region = await fromUuid(regionUuid)
         if (region) await region.delete()
      }
      await createOrRefreshEffect(actor, {
         name: "Last Redoubt Restriction",
         type: "effect",
         img: TEMPLAR_ASSETS.fragment,
         system: {
            slug: "effect-last-redoubt-restriction",
            duration: { value: 1, unit: "hours", expiry: "turn-start" },
            description: {
               value: "You cannot repair your Light Barrier for 1 hour.",
            },
         },
      })
   }

   const config = linkedEffectConfigFromItem(item)
   if (!actor || !config) return null
   if (!deleted && !linkedEffectExpired(item)) return null

   if (config === LINKED_TEMPLAR_EFFECTS.brilliantShard) {
      return setBrilliantShard({ actor, active: false })
   }
   if (config === LINKED_TEMPLAR_EFFECTS.advent) {
      return setAdvent({ actor, active: false })
   }
   return null
}
