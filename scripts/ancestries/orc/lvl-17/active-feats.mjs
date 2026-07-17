import { abilityItem } from "../../hadaganian/helpers.mjs"
import {
   actorHasSlug,
   grantOrcInnateSpell,
   validateOrcActor,
   warn,
} from "../helpers.mjs"

export async function configureHeroOfOrcsOnCreate(item) {
   const actor = item?.actor
   if (!actor || item.type !== "feat") return
   const slug = item.slug ?? item.system?.slug
   if (slug !== "hero-of-orcs") return
   await grantOrcInnateSpell(actor, {
      slug: "impaling-strike",
      rank: 7,
      entryName: "Hero of Orcs Innate Spells",
      entryFlag: "heroOfOrcsEntry",
      spellFlag: "heroOfOrcsSpell",
      ability: "wis",
   })
   await grantOrcInnateSpell(actor, {
      slug: "spiritual-guardian",
      rank: 7,
      entryName: "Hero of Orcs Innate Spells",
      entryFlag: "heroOfOrcsEntry",
      spellFlag: "heroOfOrcsSpell",
      ability: "wis",
   })
}

export async function rampagingTenacityRefund({ actor } = {}) {
   const resolved = validateOrcActor(
      actor,
      ["rampaging-tenacity"],
      "Rampaging Tenacity",
   )
   if (!resolved) return null
   const item = abilityItem(resolved, ["orc-tenacity"])
   if (!item?.system?.frequency) return warn("Orc Tenacity charge tracking was not found.")
   const current = Number(item.system.frequency.value ?? 0)
   const max = Math.max(1, Number(item.system.frequency.max ?? 1) || 1)
   await item.update({ "system.frequency.value": Math.min(max, current + 1) })
   return true
}

export async function rampagingTenacityStrike({ actor } = {}) {
   const resolved = validateOrcActor(
      actor,
      ["rampaging-tenacity"],
      "Rampaging Tenacity",
   )
   if (!resolved) return null
   if (!actorHasSlug(resolved, ["orc-tenacity"])) {
      return warn("Orc Tenacity feat not found.")
   }
   await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: resolved }),
      content:
         "<p><strong>Rampaging Tenacity</strong></p><p>Make the melee Strike granted by Rampaging Tenacity. If it reduces a foe to 0 HP, use the refund helper.</p>",
   })
   return true
}
