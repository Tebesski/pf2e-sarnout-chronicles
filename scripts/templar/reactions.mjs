import { MODULE_ID, TEMPLAR_REACTION_USED_SLUG } from "./constants.mjs"
import { createOrRefreshEffect } from "./effects.mjs"
import { debugTemplar } from "./debug.mjs"
import { slugify } from "./state.mjs"

function activeEncounterRunning() {
   return Boolean(game.combat?.started || game.combat?.active)
}

function templarReactionUsedEffects(actor) {
   return (
      actor?.items?.filter?.((item) => {
         if (item.type !== "effect") return false
         const slug = slugify(item.slug ?? item.system?.slug ?? item.name)
         return (
            slug === TEMPLAR_REACTION_USED_SLUG ||
            slug === "reaction-used" ||
            item.name === "Reaction Used"
         )
      }) ?? []
   )
}

export function hasTemplarReactionUsed(actor) {
   const effects = templarReactionUsedEffects(actor)
   if (!effects.length) return false
   if (!activeEncounterRunning()) {
      debugTemplar("Ignoring Reaction Used outside encounter", {
         actor: actor?.name,
         effects: effects.map((effect) => effect.name),
      })
      return false
   }
   return true
}

export function warnReactionUsed(actor) {
   ui.notifications?.warn(
      `${actor?.name ?? "This actor"} has already used a Templar reaction.`,
   )
}

export function canUseTemplarReaction(actor, { notify = false } = {}) {
   if (!hasTemplarReactionUsed(actor)) return true
   if (notify) warnReactionUsed(actor)
   return false
}

export async function applyTemplarReactionUsed(actor) {
   if (!actor?.createEmbeddedDocuments) return null
   return createOrRefreshEffect(
      actor,
      {
         name: "Reaction Used",
         type: "effect",
         img: "systems/pf2e/icons/actions/Reaction.webp",
         system: {
            slug: TEMPLAR_REACTION_USED_SLUG,
            duration: { value: 1, unit: "rounds", expiry: "turn-start" },
            description: {
               value: "This actor has used a Templar reaction. Sarnout Chronicles blocks further Templar reactions while this effect is active.",
            },
         },
         flags: {
            [MODULE_ID]: {
               templarReactionUsed: true,
            },
         },
      },
      { slugs: [TEMPLAR_REACTION_USED_SLUG, "reaction-used"] },
   )
}
