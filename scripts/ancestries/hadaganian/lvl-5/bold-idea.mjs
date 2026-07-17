import {
   MODULE_ID,
   actorEffectBySlug,
   canMutateActor,
   createOrRefreshEffect,
   deleteEffectsBySlugs,
   effectSource,
   oneRoundDuration,
   ownedOrControlledActor,
   spendAbilityCharge,
   warn,
} from "../helpers.mjs"

const BOLD_IDEA_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/hadaganian/PsionicPsiAura.chn.(UITexture).png"

export async function boldIdea({ actor } = {}) {
   const resolved = ownedOrControlledActor(actor)
   if (!resolved) return null
   if (actorEffectBySlug(resolved, ["effect-bold-idea"])) {
      return warn("Bold Idea is already active.")
   }
   if (!(await spendAbilityCharge(resolved, ["bold-idea"], "Bold Idea"))) {
      return null
   }
   await resolved.unsetFlag(MODULE_ID, "hadaganian.boldIdea").catch(() => null)

   return createOrRefreshEffect(
      resolved,
      effectSource({
         name: "Effect: Bold Idea",
         slug: "effect-bold-idea",
         img: BOLD_IDEA_ICON,
         duration: oneRoundDuration(),
         description: "Your next skill check upgrades success to critical success and downgrades failure to critical failure.",
         rules: [
            {
               key: "AdjustDegreeOfSuccess",
               selector: "skill-check",
               adjustment: {
                  success: "to-critical-success",
                  failure: "to-critical-failure",
               },
            },
         ],
      }),
      { slugs: ["effect-bold-idea"] },
   )
}

export async function removeBoldIdeaAfterSkillRoll(message) {
   const actorUuid = message?.flags?.pf2e?.context?.actor
   const actor =
      (actorUuid ? await fromUuid(actorUuid).catch(() => null) : null) ??
      game.actors?.get(message?.speaker?.actor)
   if (!actor) return
   if (!canMutateActor(actor)) return
   const context = message?.flags?.pf2e?.context ?? {}
   const type = String(context.type ?? context.domains?.[0] ?? "")
   const domains = Array.isArray(context.domains) ? context.domains : []
   if (type !== "skill-check" && !domains.includes("skill-check")) return
   const effect = actorEffectBySlug(actor, ["effect-bold-idea"])
   if (!effect) return
   await deleteEffectsBySlugs(actor, ["effect-bold-idea"])
}
