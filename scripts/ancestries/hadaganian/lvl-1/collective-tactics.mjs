import {
   MODULE_ID,
   chat,
   effectSource,
   esc,
   ownedOrControlledActor,
   promptForm,
   skillOptionTags,
   targetActors,
   warn,
} from "../helpers.mjs"
import {
   createOrRefreshEffectAsGM,
   deleteEffectsAsGM,
} from "../../socket.mjs"

const FOLLOW_THE_EXPERT_UUID =
   "Compendium.pf2e.other-effects.Item.VCSpuc3Tf3XWMkd3"
const COLLECTIVE_TACTICS_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/hadaganian/EliteAstral.(UITexture).png"
const EFFECT_SLUG = "effect-collective-tactics-follow-the-expert"

function skillLabel(slug) {
   const label = CONFIG.PF2E?.skills?.[slug]
   if (typeof label === "string") return game.i18n.localize(label)
   if (label?.label) return game.i18n.localize(label.label)
   return String(label ?? slug ?? "Skill")
}

function uniqueActors(values = []) {
   const actors = new Map()
   for (const value of values) {
      const actor = value?.actor ?? value
      if (actor?.documentName !== "Actor") continue
      actors.set(actor.uuid ?? actor.id, actor)
   }
   return Array.from(actors.values())
}

async function collectiveTacticsChoice() {
   const result = await promptForm({
      title: "Collective Tactics",
      width: 420,
      submit: "Apply",
      content: `
         <form class="standard-form">
            <div class="form-group">
               <label>Skill</label>
               <div class="form-fields"><select name="skill">${skillOptionTags()}</select></div>
            </div>
            <div class="form-group">
               <label>Leader</label>
               <div class="form-fields">
                  <select name="bonus">
                     <option value="3">Expert +3</option>
                     <option value="5">Master +5</option>
                     <option value="6">Legendary +6</option>
                  </select>
               </div>
            </div>
         </form>
      `,
   })
   if (!result) return null
   const skill = String(result.read("skill") ?? "")
   const bonus = Number(result.read("bonus") ?? 0)
   if (!skill || !Number.isFinite(bonus) || bonus <= 0) return null
   return { skill, bonus }
}

function collectiveTacticsEffectSource(sourceActor, { skill, bonus }) {
   return effectSource({
      name: `Effect: Collective Tactics (${skillLabel(skill)}) +${bonus}`,
      slug: EFFECT_SLUG,
      img: COLLECTIVE_TACTICS_ICON,
      duration: { value: -1, unit: "unlimited" },
      description: `<p>Modified @UUID[${FOLLOW_THE_EXPERT_UUID}]{Follow the Expert} from <strong>${esc(sourceActor.name)}</strong>.</p><p>+${bonus} circumstance bonus to ${esc(skillLabel(skill))}.</p>`,
      rules: [
         {
            key: "FlatModifier",
            selector: skill,
            slug: "collective-tactics",
            type: "circumstance",
            value: bonus,
         },
      ],
      flags: {
         collectiveTactics: {
            source: sourceActor.uuid,
            skill,
            bonus,
         },
      },
   })
}

export async function collectiveTactics({ actor, targets = null } = {}) {
   const resolved = ownedOrControlledActor(actor)
   if (!resolved) return null
   const recipients = uniqueActors(targets?.length ? targets : targetActors())
   if (recipients.length === 0) {
      return warn("Target at least one ally to receive Collective Tactics.")
   }

   const choice = await collectiveTacticsChoice()
   if (!choice) return null
   const source = collectiveTacticsEffectSource(resolved, choice)

   const applied = []
   for (const target of recipients) {
      await deleteEffectsAsGM(target, [EFFECT_SLUG, "effect-collective-tactics"])
      const effect = await createOrRefreshEffectAsGM(
         target,
         foundry.utils.deepClone(source),
         { slugs: [EFFECT_SLUG] },
      )
      if (effect) applied.push(target.name)
   }

   await chat(
      resolved,
      `<p><strong>Collective Tactics</strong>: ${esc(skillLabel(choice.skill))} +${choice.bonus} applied to ${applied.map(esc).join(", ") || "no allies"}.</p>`,
   )
   return applied
}
