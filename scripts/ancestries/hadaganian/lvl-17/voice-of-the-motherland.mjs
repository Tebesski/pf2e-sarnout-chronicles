import {
   compendiumItemBySlug,
   effectSource,
   hasAbilityCharge,
   ownedOrControlledActor,
   spendAbilityCharge,
   targetActors,
   warn,
} from "../helpers.mjs"
import { createOrRefreshEffectAsGM } from "../../socket.mjs"

const VOICE_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/hadaganian/BannerEmpire.(UITexture).png"

async function zealousConvictionEffectSource(actor) {
   const effect = await compendiumItemBySlug("spell-effect-zealous-conviction", {
      packs: ["pf2e.spell-effects", "pf2e.spell-effects-srd"],
      type: "effect",
      name: "Spell Effect: Zealous Conviction",
   })
   if (effect) {
      const source = effect.toObject()
      delete source._id
      source.img = VOICE_ICON
      foundry.utils.setProperty(source, "flags.pf2e-sarnout-chronicles.voiceOfTheMotherland", true)
      return source
   }
   return effectSource({
      name: "Effect: Voice of the Motherland",
      slug: "effect-voice-of-the-motherland",
      img: VOICE_ICON,
      duration: { value: 10, unit: "minutes", expiry: "turn-start" },
      description: `${actor.name} grants the effects of a 6th-rank zealous conviction.`,
      flags: { voiceOfTheMotherland: true },
   })
}

export async function voiceOfTheMotherland({ actor } = {}) {
   const resolved = ownedOrControlledActor(actor)
   if (!resolved) return null
   if (!hasAbilityCharge(resolved, ["voice-of-the-motherland"])) {
      return warn("Voice of the Motherland has no uses remaining.")
   }
   const targets = targetActors().slice(0, 10)
   if (targets.length === 0) return warn("Target up to 10 willing creatures.")
   const source = await zealousConvictionEffectSource(resolved)
   const applied = []
   for (const target of targets) {
      const effect = await createOrRefreshEffectAsGM(target, source, {
         slugs: ["spell-effect-zealous-conviction", "effect-voice-of-the-motherland"],
      })
      if (effect) applied.push(target.name)
   }
   if (applied.length === 0) return warn("Voice of the Motherland applied to no targets.")
   if (!(await spendAbilityCharge(resolved, ["voice-of-the-motherland"], "Voice of the Motherland"))) {
      return null
   }
   return applied
}
