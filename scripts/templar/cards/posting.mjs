import {
   MODULE_ID,
   TEMPLAR_ASSETS,
} from "../constants.mjs"
import {
   ABILITY_TRAITS,
   CARD_FLAG,
   CARD_ROLL_OPTIONS,
} from "./constants.mjs"
import { renderCard } from "./rendering.mjs"
import { uniqueTokenDocs } from "./targets.mjs"
import {
   actorClassOrSpellDC,
   lightBurstRadius,
   rollDamageFormula,
   rollDamageOnce,
} from "./damage-rolls.mjs"

function tokenDocData(tokenDocs) {
   return Object.fromEntries(
      tokenDocs.map((doc) => [
         doc.uuid,
         {
            uuid: doc.uuid,
            id: doc.id,
            name: doc.name,
            actorName: doc.actor?.name ?? doc.name,
         },
      ]),
   )
}

async function createCardMessage(actor, cardData, extraFlags = {}) {
   const content = await renderCard(cardData)
   await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
      flags: {
         [MODULE_ID]: {
            templarMessage: true,
            [CARD_FLAG]: cardData,
            ...extraFlags,
         },
      },
   })
   return true
}

export async function postLightGaolBoundaryCard({
   actor,
   target,
   saveType,
   dc,
   dice,
   title = "Light Gaol Boundary",
   icon = TEMPLAR_ASSETS.gaol,
} = {}) {
   if (!actor) return false
   const tokenDocs = uniqueTokenDocs([target])

   let rollData = null
   if (dice > 0) {
      const formula = `${dice}d6[fire],${dice}d6[spirit]`
      rollData = await rollDamageFormula(formula)
   }

   return createCardMessage(actor, {
      type: "light-gaol",
      title,
      icon,
      actorUuid: actor.uuid,
      radius: null,
      barrierShattered: false,
      dc,
      damageRoll: rollData,
      traits: ABILITY_TRAITS,
      rollOptions: CARD_ROLL_OPTIONS,
      counteract: null,
      targetTokenUuids: tokenDocs.map((doc) => doc.uuid),
      targetDocs: tokenDocData(tokenDocs),
      targetStates: {},
      saveType,
   })
}

export async function postLightBurstCard({
   actor,
   targets = [],
   barrierShattered = false,
} = {}) {
   const radius = lightBurstRadius(actor)
   return postAbilityCard({
      actor,
      targets,
      type: "light-burst",
      title: "Light Burst",
      icon: TEMPLAR_ASSETS.lightBurst,
      radius,
      barrierShattered,
      counteract: null,
   })
}

export async function postInculpationCard({ actor, target = null } = {}) {
   return postAbilityCard({
      actor,
      targets: target ? [target] : [],
      type: "inculpation",
      title: "Inculpation",
      icon: TEMPLAR_ASSETS.inculpation,
      radius: null,
      barrierShattered: false,
      counteract: null,
   })
}

export async function postBlindingBladeCard({
   actor,
   target = null,
   targets = [],
   dc = null,
   message = null,
} = {}) {
   if (!actor) return false
   const targetList = Array.isArray(targets) ? targets : Array.from(targets ?? [])
   const tokenDocs = uniqueTokenDocs(
      targetList.length ? targetList : target ? [target] : [],
   )
   const cardData = {
      type: "blinding-blade",
      title: "Blinding Blade",
      icon: TEMPLAR_ASSETS.blinding,
      actorUuid: actor.uuid,
      radius: null,
      barrierShattered: false,
      dc: dc ?? actorClassOrSpellDC(actor),
      damageRoll: null,
      traits: ABILITY_TRAITS,
      rollOptions: CARD_ROLL_OPTIONS,
      counteract: null,
      targetTokenUuids: tokenDocs.map((doc) => doc.uuid),
      targetDocs: tokenDocData(tokenDocs),
      targetStates: {},
      saveType: "reflex",
   }
   const content = await renderCard(cardData)
   if (message?.update) {
      await message.update({
         content,
         [`flags.${MODULE_ID}.templarMessage`]: true,
         [`flags.${MODULE_ID}.${CARD_FLAG}`]: cardData,
         [`flags.${MODULE_ID}.blindingBladeCardEnhanced`]: true,
      })
      return true
   }
   return createCardMessage(actor, cardData, { blindingBladeCardEnhanced: true })
}

export async function postAbilityCard({
   actor,
   targets,
   type,
   title,
   icon,
   radius,
   barrierShattered,
   counteract,
}) {
   if (!actor) return false
   const tokenDocs = uniqueTokenDocs(targets)
   const damageRoll = await rollDamageOnce(actor)
   const dc = actorClassOrSpellDC(actor)
   return createCardMessage(actor, {
      type,
      title,
      icon,
      actorUuid: actor.uuid,
      radius,
      barrierShattered: Boolean(barrierShattered),
      dc,
      damageRoll,
      traits: ABILITY_TRAITS,
      rollOptions: CARD_ROLL_OPTIONS,
      counteract,
      targetTokenUuids: tokenDocs.map((doc) => doc.uuid),
      targetDocs: tokenDocData(tokenDocs),
      targetStates: {},
   })
}
