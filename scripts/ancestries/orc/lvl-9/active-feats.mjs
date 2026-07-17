import {
   createOrRefreshEffect,
   hasAbilityCharge,
   oneMinuteDuration,
   spendAbilityCharge,
} from "../../hadaganian/helpers.mjs"
import { createOrRefreshEffectAsGM } from "../../socket.mjs"
import {
   activeGMOrOwner,
   actorFromMessage,
   actorHasSlug,
   actorLevel,
   effectSource,
   esc,
   grantOrcInnateSpell,
   isInitiativeMessage,
   messageDegree,
   messageOptions,
   oneTarget,
   optionTags,
   ownerWhispers,
   promptForm,
   validateOrcActor,
   warn,
} from "../helpers.mjs"

function durationRounds(rounds) {
   return { value: rounds, unit: "rounds", expiry: "turn-start" }
}

function skillLabel(skill) {
   const label = CONFIG.PF2E?.skills?.[skill] ?? skill
   return game.i18n?.localize?.(label) ?? label
}

export async function fierceCompetitor({ actor } = {}) {
   const resolved = validateOrcActor(actor, ["fierce-competitor"], "Fierce Competitor")
   if (!resolved) return null
   const target = oneTarget("Fierce Competitor")
   if (!target) return null
   const result = await promptForm({
      title: "Fierce Competitor",
      content: `
         <form class="standard-form">
            <div class="form-group"><label>Skill</label><div class="form-fields"><select name="skill">
               ${optionTags([
                  { value: "acrobatics", label: skillLabel("acrobatics") },
                  { value: "athletics", label: skillLabel("athletics") },
               ])}
            </select></div></div>
         </form>
      `,
      submit: "Apply",
   })
   if (!result) return null
   const skill = String(result.read("skill") ?? "")
   if (!skill) return null
   if (!(await spendAbilityCharge(resolved, ["fierce-competitor"], "Fierce Competitor"))) {
      return null
   }
   const data = effectSource({
      name: `Effect: Fierce Competitor (${skillLabel(skill)})`,
      slug: `effect-fierce-competitor-${skill}`,
      duration: oneMinuteDuration(),
      description: `+2 circumstance bonus to ${esc(skillLabel(skill))} for the declared competition.`,
      rules: [
         {
            key: "FlatModifier",
            selector: skill,
            type: "circumstance",
            value: 2,
            label: "Fierce Competitor",
         },
      ],
      flags: { orc: true, fierceCompetitor: true, skill },
   })
   await createOrRefreshEffect(resolved, data, { slugs: [`effect-fierce-competitor-${skill}`] })
   await createOrRefreshEffectAsGM(target, data, {
      slugs: [`effect-fierce-competitor-${skill}`],
   })
   return true
}

export async function fierceCompetitorVictory({ actor } = {}) {
   const resolved = validateOrcActor(actor, ["fierce-competitor"], "Fierce Competitor")
   if (!resolved) return null
   return createOrRefreshEffect(
      resolved,
      effectSource({
         name: "Effect: Fierce Competitor Victory",
         slug: "effect-fierce-competitor-victory",
         duration: { value: 1, unit: "hours", expiry: "turn-start" },
         description: "+2 status bonus to saving throws against Intimidation checks.",
         rules: [
            {
               key: "FlatModifier",
               selector: "saving-throw",
               type: "status",
               value: 2,
               predicate: ["action:intimidation"],
            },
         ],
         flags: { orc: true, fierceCompetitorVictory: true },
      }),
      { slugs: ["effect-fierce-competitor-victory"] },
   )
}

export async function stubbornDefiance({ actor } = {}) {
   const resolved = validateOrcActor(actor, ["stubborn-defiance"], "Stubborn Defiance")
   if (!resolved) return null
   if (!(await spendAbilityCharge(resolved, ["stubborn-defiance"], "Stubborn Defiance"))) {
      return null
   }
   await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: resolved }),
      content:
         "<p><strong>I Defy You!</strong></p><p>Reroll the triggering save against the controlled effect and keep the second result.</p>",
   })
   return true
}

export async function orcWays({ actor } = {}) {
   const resolved = validateOrcActor(actor, ["orc-ways"], "Orc Ways")
   if (!resolved) return null
   const result = await promptForm({
      title: "Orc Ways",
      content: `
         <form class="standard-form">
            <div class="form-group"><label>DC</label><div class="form-fields"><input type="number" name="dc" min="1" step="1"></div></div>
            <div class="form-group"><label>Lore Skill</label><div class="form-fields"><input type="text" name="skill" value="orc-lore"></div></div>
         </form>
      `,
      submit: "Roll",
   })
   if (!result) return null
   const dc = Number(result.read("dc"))
   const skill = String(result.read("skill") ?? "orc-lore")
   const statistic = resolved.getStatistic?.(skill)
   if (typeof statistic?.roll !== "function") return warn(`${skill} was not found.`)
   if (!(await spendAbilityCharge(resolved, ["orc-ways"], "Orc Ways"))) return null
   return statistic.roll({
      dc: Number.isFinite(dc) && dc > 0 ? { value: dc } : undefined,
      label: "Orc Ways",
      title: "Orc Ways",
      extraRollOptions: ["orc-ways", "item:trait:orc"],
   })
}

export async function prideInArms({ actor } = {}) {
   const resolved = validateOrcActor(actor, ["pride-in-arms"], "Pride in Arms")
   if (!resolved) return null
   const target = oneTarget("Pride in Arms")
   if (!target) return null
   if (!(await spendAbilityCharge(resolved, ["pride-in-arms"], "Pride in Arms"))) {
      return null
   }
   return createOrRefreshEffectAsGM(
      target,
      effectSource({
         name: "Effect: Pride in Arms",
         slug: "effect-pride-in-arms",
         duration: durationRounds(1),
         description: "Temporary Hit Points from Pride in Arms.",
         rules: [{ key: "TempHP", value: actorLevel(target) }],
         flags: { orc: true, prideInArms: true },
      }),
      { slugs: ["effect-pride-in-arms"] },
   )
}

export async function handleEagerCombatantInitiative(message) {
   if (!isInitiativeMessage(message)) return
   const actor = await actorFromMessage(message)
   if (!actor || !actorHasSlug(actor, ["eager-combatant"])) return
   if (!activeGMOrOwner(actor)) return
   const whisper = ownerWhispers(actor)
   if (!whisper.length) return
   await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      whisper,
      content: `<p><strong>Eager Combatant</strong></p><p>You rolled initiative. You can Stride or Leap in a straight line directly toward an enemy.</p>`,
   })
}

export async function handleStubbornDefianceSaveFailure(message) {
   const degree = messageDegree(message)
   if (degree !== 0 && degree !== 1) return
   const options = messageOptions(message)
   if (!options.some((option) => option === "inflicts:controlled" || option.includes("controlled"))) return
   const actor = await actorFromMessage(message)
   if (!actor || !actorHasSlug(actor, ["stubborn-defiance"])) return
   if (!hasAbilityCharge(actor, ["stubborn-defiance"])) return
   if (!activeGMOrOwner(actor)) return
   const whisper = ownerWhispers(actor)
   if (!whisper.length) return
   await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      whisper,
      content: `<p><strong>I Defy You!</strong></p><p>You failed a save against an effect that would make you controlled. You can use Stubborn Defiance to reroll and keep the second result.</p>`,
   })
}

export async function configureClanSecretsOnCreate(item) {
   const actor = item?.actor
   if (!actor || item.type !== "feat") return
   const slug = item.slug ?? item.system?.slug
   if (slug !== "clan-secrets") return
   await grantOrcInnateSpell(actor, {
      slug: "show-the-way",
      rank: actorLevel(actor) >= 13 ? 6 : 3,
      entryName: "Clan Secrets Innate Spells",
      entryFlag: "clanSecretsEntry",
      spellFlag: "clanSecretsSpell",
      ability: "wis",
   })
}
