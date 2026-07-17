import {
   MODULE_ID,
   actorHasSlug,
   createOrRefreshEffect,
   esc,
   ownedOrControlledActor,
   promptForm,
   skillOptionTags,
   spendAbilityCharge,
   warn,
} from "../../hadaganian/helpers.mjs"

const COMPETITIVE_SPIRIT_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/orc/ThePowerAstral.(UITexture).png"

function skillLabel(skill) {
   const label = CONFIG.PF2E?.skills?.[skill] ?? skill
   const key = typeof label === "string" ? label : label?.label
   return typeof key === "string" && key.includes(".")
      ? game.i18n?.localize?.(key) ?? key
      : key ?? skill
}

export async function competitiveSpirit({ actor } = {}) {
   const resolved = ownedOrControlledActor(actor, "Orc")
   if (!resolved) return null
   if (!actorHasSlug(resolved, "competitive-spirit")) {
      return warn("Competitive Spirit feat not found.")
   }

   const result = await promptForm({
      title: "Competitive Spirit",
      content: `
         <form class="standard-form">
            <div class="form-group"><label>Skill</label><div class="form-fields"><select name="skill">${skillOptionTags()}</select></div></div>
         </form>
      `,
      submit: "Apply",
   })
   if (!result) return null
   const skill = String(result.read("skill") ?? "").trim()
   if (!skill) return null
   if (!(await spendAbilityCharge(resolved, ["competitive-spirit"], "Competitive Spirit"))) {
      return null
   }

   return createOrRefreshEffect(resolved, {
      name: `Effect: Competitive Spirit (${skillLabel(skill)})`,
      type: "effect",
      img: COMPETITIVE_SPIRIT_ICON,
      system: {
         slug: `effect-competitive-spirit-${skill}`,
         duration: { value: 2, unit: "rounds", expiry: "turn-end" },
         description: {
            value: `<p>Gain +2 circumstance bonus to ${esc(skillLabel(skill))} for the matching action or activity from Competitive Spirit.</p>`,
         },
         rules: [
            {
               key: "FlatModifier",
               selector: skill,
               type: "circumstance",
               value: 2,
            },
         ],
      },
      flags: {
         [MODULE_ID]: {
            orc: true,
            competitiveSpirit: true,
            skill,
         },
      },
   })
}
