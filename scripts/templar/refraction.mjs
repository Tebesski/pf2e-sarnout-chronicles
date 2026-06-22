import {
   MODULE_ID,
   TEMPLAR_ASSETS,
   TEMPLAR_SLUGS,
} from "./constants.mjs"
import { actorHasSlug } from "./state.mjs"
import { getActor } from "./actors.mjs"
import {
   actorEffectBySlug,
   createOrRefreshEffect,
   itemMatchesSlugGroup,
} from "./effects.mjs"
import {
   dialogContent,
   TemplarChoiceDialog,
} from "./dialogs.mjs"
import {
   fact,
   textParagraph,
} from "./templates.mjs"
import {
   heroPointPath,
   spendHeroPoint,
} from "./hero-points.mjs"
import { prepareProvidenceReroll } from "./providence/helpers.mjs"
import { spendFocusPoint } from "./focus.mjs"
import { playSound } from "./audio.mjs"

export function hasRefractionAvailable(actor) {
   if (!actorHasSlug(actor, TEMPLAR_SLUGS.refraction)) return false
   if (actorEffectBySlug(actor, ["effect-refraction-used"])) return false
   const ability = actor.items?.find?.(
      (i) =>
         itemMatchesSlugGroup(i, TEMPLAR_SLUGS.refraction) &&
         ["action", "feat"].includes(i.type),
   )
   if (ability?.system?.frequency && ability.system.frequency.value < 1)
      return false
   return true
}

async function rollRefractionFlatCheck(actor, { completeProvidenceReroll } = {}) {
   const roll = await new Roll("1d20").evaluate()
   await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: "Refraction DC 15 flat check",
      flags: { [MODULE_ID]: { templarMessage: true } },
   })
   if (roll.total >= 15) return true

   const path = heroPointPath(actor)
   const heroPoints = Number(path ? foundry.utils.getProperty(actor, path) : 0)
   const canProvidence = prepareProvidenceReroll({
      actor,
      spendFocus: false,
      applyBonus: false,
   })

   if (heroPoints <= 0 && !canProvidence) return false

   const buttons = []
   if (heroPoints > 0) {
      buttons.push({
         id: "hero",
         label: "Reroll (Hero Point)",
         icon: "fa-solid fa-hospital-symbol",
      })
   }
   if (canProvidence) {
      buttons.push({
         id: "providence",
         label: "Reroll (Providence)",
         icon: "fa-solid fa-sun",
      })
   }
   buttons.push({ id: "keep", label: "Keep Failure" })

   const choice = await TemplarChoiceDialog.prompt({
      title: "Refraction",
      content: await dialogContent({
         paragraphs: [
            textParagraph(
               "The DC 15 flat check failed. Choose whether to reroll or keep the failure.",
            ),
         ],
         facts: [fact("Hero Points", heroPoints)],
      }),
      buttons,
   })

   if (choice === "hero") {
      if (!(await spendHeroPoint(actor))) return false
      const reroll = await new Roll("1d20").evaluate()
      await reroll.toMessage({
         speaker: ChatMessage.getSpeaker({ actor }),
         flavor: "Refraction DC 15 flat check (Hero Point reroll)",
         flags: { [MODULE_ID]: { templarMessage: true } },
      })
      return reroll.total >= 15
   }

   if (choice === "providence") {
      if (
         !prepareProvidenceReroll({
            actor,
            spendFocus: true,
            applyBonus: false,
         })
      )
         return false
      if (typeof completeProvidenceReroll !== "function") return false
      await spendFocusPoint(actor, 1)
      const reroll = await new Roll("1d20").evaluate()
      await reroll.toMessage({
         speaker: ChatMessage.getSpeaker({ actor }),
         flavor: "Refraction DC 15 flat check (Divine Reroll)",
         flags: { [MODULE_ID]: { templarMessage: true } },
      })
      await completeProvidenceReroll({
         actor,
         spendFocus: false,
         message: null,
         applyReaction: false,
      })
      return reroll.total >= 15
   }

   return false
}

export async function refraction({
   actor,
   completeProvidenceReroll,
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   if (!hasRefractionAvailable(resolved)) {
      ui.notifications?.warn("Refraction is not available.")
      return null
   }
   await playSound(TEMPLAR_ASSETS.refractionInSound)
   const success = await rollRefractionFlatCheck(resolved, {
      completeProvidenceReroll,
   })
   if (success) await playSound(TEMPLAR_ASSETS.refractionOutSound)

   const ability = resolved.items?.find?.(
      (i) =>
         itemMatchesSlugGroup(i, TEMPLAR_SLUGS.refraction) &&
         ["action", "feat"].includes(i.type),
   )
   if (ability?.system?.frequency) {
      try {
         await ability.update({
            "system.frequency.value": Math.max(
               0,
               ability.system.frequency.value - 1,
            ),
         })
      } catch (_error) {}
   }

   await createOrRefreshEffect(
      resolved,
      {
         name: "Refraction Used",
         type: "effect",
         img: TEMPLAR_ASSETS.refraction,
         system: {
            slug: "effect-refraction-used",
            duration: { value: 1, unit: "hours", expiry: "turn-start" },
            description: { value: "Tracks the cooldown of Refraction." },
         },
      },
      { slugs: ["effect-refraction-used"] },
   )

   return success
}

export async function lightDamping(options = {}) {
   return refraction(options)
}
