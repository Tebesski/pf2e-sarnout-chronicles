import {
   MODULE_ID,
   actorEffectBySlug,
   canMutateActor,
   createOrRefreshEffect,
   deleteEffectsBySlugs,
   effectSource,
   esc,
   oneRoundDuration,
   ownedOrControlledActor,
   promptForm,
   slugify,
   spendAbilityCharge,
   warn,
} from "../helpers.mjs"

const EFFECT_SLUG = "effect-hadaganian-resourcefulness"
const RESOURCEFULNESS_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/hadaganian/Concentration.(UITexture).png"

function skillLabel(slug, data) {
   const config = CONFIG.PF2E?.skills?.[slug]
   if (typeof config === "string") return game.i18n?.localize?.(config) ?? config
   if (typeof config?.label === "string") return game.i18n?.localize?.(config.label) ?? config.label
   return data?.label ?? slug
}

function untrainedSkillOptions(actor) {
   return Object.entries(actor.system?.skills ?? {})
      .filter(([, data]) => Number(data?.rank ?? 0) === 0)
      .map(([slug, data]) => ({ slug, label: skillLabel(slug, data) }))
      .sort((a, b) => a.label.localeCompare(b.label))
}

function selectedSkillFromMessage(message) {
   const context = message?.flags?.pf2e?.context ?? {}
   const domains = Array.isArray(context.domains) ? context.domains : []
   const options = [
      ...(Array.isArray(context.options) ? context.options : []),
      ...(Array.isArray(message?.rolls?.[0]?.options) ? message.rolls[0].options : []),
   ].map((option) => String(option ?? ""))
   const values = [
      context.slug,
      context.statistic,
      context.skill,
      context.domains?.[0],
      ...domains,
   ].map((value) => slugify(value))
   for (const option of options) {
      if (option.startsWith("skill:")) values.push(slugify(option.split(":").at(-1)))
   }
   return values.filter(Boolean)
}

export async function hadaganianResourcefulness({ actor } = {}) {
   const resolved = ownedOrControlledActor(actor)
   if (!resolved) return null
   if (actorEffectBySlug(resolved, [EFFECT_SLUG])) {
      return warn("Hadaganian Resourcefulness is already active.")
   }
   const skills = untrainedSkillOptions(resolved)
   if (skills.length === 0) return warn("No untrained skills are available.")

   const result = await promptForm({
      title: "Hadaganian Resourcefulness",
      content: `
         <form class="standard-form">
            <div class="form-group"><label>Skill</label><div class="form-fields"><select name="skill">
               ${skills.map(({ slug, label }) => `<option value="${esc(slug)}">${esc(label)}</option>`).join("")}
            </select></div></div>
         </form>
      `,
      submit: "Apply",
   })
   if (!result) return null
   const skill = String(result.read("skill") ?? "").trim()
   if (!skill) return null
   const label = skills.find((entry) => entry.slug === skill)?.label ?? skill
   if (
      !(await spendAbilityCharge(
         resolved,
         ["hadaganian-resourcefulness"],
         "Hadaganian Resourcefulness",
      ))
   ) {
      return null
   }

   const effect = await createOrRefreshEffect(
      resolved,
      effectSource({
         name: `Effect: Hadaganian Resourcefulness (${label})`,
         slug: EFFECT_SLUG,
         img: RESOURCEFULNESS_ICON,
         duration: oneRoundDuration(),
         description: `+4 circumstance bonus to your next untrained ${label} check.`,
         rules: [
            {
               key: "FlatModifier",
               selector: skill,
               type: "circumstance",
               value: 4,
            },
         ],
         flags: { hadaganianResourcefulness: { skill } },
      }),
      { slugs: [EFFECT_SLUG] },
   )
   return effect
}

export async function removeHadaganianResourcefulnessAfterRoll(message) {
   const context = message?.flags?.pf2e?.context ?? {}
   const domains = Array.isArray(context.domains) ? context.domains : []
   if (context.type !== "skill-check" && !domains.includes("skill-check")) return
   const actorUuid = context.actor
   const actor =
      (actorUuid ? await fromUuid(actorUuid).catch(() => null) : null) ??
      game.actors?.get(message?.speaker?.actor)
   if (!actor || !canMutateActor(actor)) return
   const effect = actorEffectBySlug(actor, [EFFECT_SLUG])
   if (!effect) return
   const skill = slugify(effect.getFlag?.(MODULE_ID, "hadaganianResourcefulness.skill"))
   if (!skill || !selectedSkillFromMessage(message).includes(skill)) return
   await deleteEffectsBySlugs(actor, [EFFECT_SLUG])
}
