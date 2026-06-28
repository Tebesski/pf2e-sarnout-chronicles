import { MODULE_ID } from "../constants.mjs"
import { CARD_FLAG, INSPECTOR_FLAG } from "./constants.mjs"
import {
   damageRollFromInstances,
   scaleRollTotal,
} from "./damage-rolls.mjs"
import { resolveUuid } from "./documents.mjs"

export async function gmApplyCardDamage({
   targetUuid,
   damage,
   multiplier = 1,
} = {}) {
   const token = await resolveUuid(targetUuid)
   const actor = token?.actor
   if (!actor || !damage) return false
   const tokenObject = token.object ?? canvas?.tokens?.get?.(token.id) ?? null
   const scale = Number(multiplier) || 1
   const total = Math.max(0, Math.floor((Number(damage.total) || 0) * scale))
   let roll = null
   let rebuiltTypedRoll = false
   roll = await damageRollFromInstances(damage, scale)
   rebuiltTypedRoll = Boolean(roll)
   try {
      roll ??= damage.rollJSON
         ? Roll.fromData(JSON.parse(damage.rollJSON))
         : null
   } catch (_error) {
      roll ??= null
   }
   if (roll && actor.applyDamage) {
      if (!rebuiltTypedRoll) scaleRollTotal(roll, scale, total)
      await actor.applyDamage({ damage: roll, token: tokenObject })
      return true
   }
   if (actor.applyDamage) {
      await actor.applyDamage({ damage: total, token: tokenObject })
      return true
   }
   return false
}

export async function gmApplyCardEffect({ targetUuid, effect } = {}) {
   const token = await resolveUuid(targetUuid)
   const actor = token?.actor
   if (!actor?.createEmbeddedDocuments || !effect?.slug) return false
   const condition = game.pf2e?.ConditionManager?.getCondition?.(effect.slug)
   const uuid = condition?.sourceId ?? condition?.uuid
   if (!uuid) return false
   const duration = {
      value: Number(effect.value) || 1,
      unit: effect.unit || "rounds",
      expiry: "turn-start",
   }
   const [created] = await actor.createEmbeddedDocuments("Item", [
      {
         name: `Effect: ${effect.sourceName ?? "Templar"} - ${effect.label ?? effect.slug}`,
         type: "effect",
         img: condition.img ?? "systems/pf2e/icons/default-icons/effect.svg",
         system: {
            slug: `effect-${MODULE_ID}-${effect.slug}`,
            duration,
            description: {
               value: `${effect.label ?? effect.slug} applied by ${effect.sourceName ?? "a Templar card"}.`,
            },
            rules: [
               {
                  key: "GrantItem",
                  uuid,
                  onDeleteActions: { grantee: "restrict" },
               },
            ],
         },
         flags: {
            [MODULE_ID]: {
               templarAbilityCardEffect: true,
               condition: effect.slug,
            },
         },
      },
   ])
   return Boolean(created)
}

export async function gmPersistCard({
   messageId,
   content,
   cardData,
   inspectorKey = null,
   inspectorSource = null,
   inspectorClear = false,
} = {}) {
   const message = messageId ? game.messages?.get?.(messageId) : null
   if (!message) return false
   const update = {}
   if (typeof content === "string") update.content = content
   if (cardData) update[`flags.${MODULE_ID}.${CARD_FLAG}`] = cardData
   if (inspectorKey) {
      const inspector = foundry.utils.deepClone(
         message.getFlag(MODULE_ID, INSPECTOR_FLAG) || {},
      )
      if (inspectorClear) delete inspector[inspectorKey]
      else if (inspectorSource) {
         inspector[inspectorKey] =
            typeof inspectorSource === "string"
               ? inspectorSource
               : JSON.stringify(inspectorSource)
      }
      update[`flags.${MODULE_ID}.${INSPECTOR_FLAG}`] = inspector
   }
   if (Object.keys(update).length === 0) return false
   await message.update(update)
   return true
}
