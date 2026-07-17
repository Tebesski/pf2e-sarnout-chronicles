import {
   MODULE_ID,
   canMutateActor,
   chat,
   conditionItem,
   createOrRefreshEffect,
   decrementCondition,
   effectSource,
   oneMinuteDuration,
   ownedOrControlledActor,
   slugify,
} from "../helpers.mjs"

const FOR_MOTHERLAND_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/hadaganian/WarlordsCry.(UITexture).png"

export async function forMotherland({ actor, silent = false } = {}) {
   const resolved = ownedOrControlledActor(actor)
   if (!resolved) return null
   const reduced = await decrementCondition(resolved, "enfeebled")
   const hadFatigue = Boolean(
      resolved.hasCondition?.("fatigued") ?? conditionItem(resolved, "fatigued"),
   )
   if (hadFatigue) {
      if (typeof resolved.decreaseCondition === "function") {
         await resolved.decreaseCondition("fatigued", { forceRemove: true }).catch(() => null)
      } else {
         await conditionItem(resolved, "fatigued")?.delete?.().catch(() => null)
      }
   }
   const effect = await createOrRefreshEffect(
      resolved,
      effectSource({
         name: "Effect: For Motherland!",
         slug: "effect-for-motherland",
         img: FOR_MOTHERLAND_ICON,
         duration: oneMinuteDuration(),
         description: "Fatigue effects are suppressed for 1 minute.",
         rules: [],
         flags: { forMotherland: { suppressedFatigue: hadFatigue } },
      }),
      { slugs: ["effect-for-motherland"] },
   )
   if (!silent) {
      await chat(
         resolved,
         `<p><strong>For Motherland!</strong>: fatigue suppressed for 1 minute${hadFatigue ? " (fatigued removed temporarily)" : ""}${reduced ? "; enfeebled reduced by 1" : ""}.</p>`,
      )
   }
   return effect
}

export async function restoreForMotherlandFatigue(item) {
   const slug = slugify(item?.slug ?? item?.system?.slug ?? item?.name)
   if (slug !== "effect-for-motherland") return
   const actor = item.actor
   if (!actor) return
   if (!canMutateActor(actor)) return
   const suppressed = item.getFlag?.(MODULE_ID, "forMotherland.suppressedFatigue")
   if (!suppressed) return
   if (actor.hasCondition?.("fatigued") || conditionItem(actor, "fatigued")) return
   if (typeof actor.increaseCondition === "function") {
      await actor.increaseCondition("fatigued").catch(() => null)
   }
}
