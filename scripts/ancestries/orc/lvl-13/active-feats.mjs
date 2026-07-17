import {
   abilityItem,
   MODULE_ID,
   createOrRefreshEffect,
   deleteEffectsBySlugs,
   hasAbilityCharge,
   oneMinuteDuration,
   spendAbilityCharge,
   targetActors,
} from "../../hadaganian/helpers.mjs"
import {
   actorHasSlug,
   actorLevel,
   actorFromMessage,
   activeGMOrOwner,
   conditionValue,
   effectSource,
   isStrikeMessage,
   messageDegree,
   ownerWhispers,
   validateOrcActor,
   warn,
} from "../helpers.mjs"
import { warnMissingSpiritVessel } from "../spirit-vessel.mjs"

const BLOOD_CALLS_SLUG = "effect-blood-calls-to-blood"
const refreshLocks = new Set()

export async function righteousFury({ actor } = {}) {
   const resolved = validateOrcActor(
      actor,
      ["righteous-fury"],
      "Righteous Fury",
   )
   if (!resolved) return null
   if (!(await spendAbilityCharge(resolved, ["righteous-fury"], "Righteous Fury"))) {
      return null
   }
   const rank = actorLevel(resolved) >= 17 ? 6 : 3
   const value = rank >= 6 ? 2 : 1
   return createOrRefreshEffect(
      resolved,
      effectSource({
         name: `Effect: Righteous Fury (Heroism ${rank})`,
         slug: "effect-righteous-fury",
         duration: oneMinuteDuration(),
         description: `Heroism ${rank} from Righteous Fury.`,
         rules: [
            {
               key: "FlatModifier",
               selector: [
                  "attack-roll",
                  "perception",
                  "saving-throw",
                  "skill-check",
               ],
               type: "status",
               value,
               label: "Righteous Fury",
            },
         ],
         flags: { orc: true, righteousFury: true },
      }),
      { slugs: ["effect-righteous-fury"] },
   )
}

export async function majorVesselCloakOfPoison({ actor } = {}) {
   const resolved = validateOrcActor(actor, ["major-vessel"], "Major Vessel")
   if (!resolved) return null
   if (warnMissingSpiritVessel(resolved, "cloak-of-poison")) return null
   if (!(await spendAbilityCharge(resolved, ["cloak-of-poison"], "Cloak of Poison"))) {
      return null
   }
   return createOrRefreshEffect(
      resolved,
      effectSource({
         name: "Effect: Cloak of Poison",
         slug: "effect-cloak-of-poison",
         duration: oneMinuteDuration(),
         description:
            "Creatures that touch you or damage you with an unarmed attack or melee weapon without reach take 3d6 poison damage.",
         rules: [],
         flags: { orc: true, cloakOfPoison: true },
      }),
      { slugs: ["effect-cloak-of-poison"] },
   )
}

export async function overcomeShamePenalty({ actor } = {}) {
   const resolved = validateOrcActor(actor, ["overcome-shame"], "Overcome Shame")
   if (!resolved) return null
   return createOrRefreshEffect(
      resolved,
      effectSource({
         name: "Effect: Overcome Shame",
         slug: "effect-overcome-shame-penalty",
         duration: { value: 1, unit: "rounds", expiry: "turn-start" },
         description:
            "You missed the second Strike from Overcome Shame and are off-guard and clumsy 1 until the end of your next turn.",
         rules: [
            {
               key: "GrantItem",
               uuid: "Compendium.pf2e.conditionitems.Item.AJh5ex99aV6VTggg",
            },
            {
               key: "GrantItem",
               uuid: "Compendium.pf2e.conditionitems.Item.i3OJZU2nk64Df3xm",
            },
         ],
         flags: { orc: true, overcomeShame: true },
      }),
      { slugs: ["effect-overcome-shame-penalty"] },
   )
}

export async function overcomeShame({ actor } = {}) {
   const resolved = validateOrcActor(actor, ["overcome-shame"], "Overcome Shame")
   if (!resolved) return null
   if (!(await spendAbilityCharge(resolved, ["overcome-shame"], "Overcome Shame"))) {
      return null
   }
   await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: resolved }),
      content:
         "<p><strong>Overcome Shame</strong></p><p>Make the triggering Strike again. Roll twice and keep the higher result.</p>",
   })
   return true
}

export async function handleOvercomeShameCriticalFailure(message) {
   if (!isStrikeMessage(message)) return
   if (messageDegree(message) !== 0) return
   const actor = await actorFromMessage(message)
   if (!actor || !actorHasSlug(actor, ["overcome-shame"])) return
   if (!hasAbilityCharge(actor, ["overcome-shame"])) return
   const whisper = ownerWhispers(actor)
   if (!whisper.length) return
   await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      whisper,
      content:
         "<p><strong>Overcome Shame</strong></p><p>You critically failed a Strike. You can use Overcome Shame to Strike again, rolling twice and keeping the higher result.</p>",
   })
}

export async function refreshBloodCallsToBlood(actor) {
   if (!actor?.uuid) return null
   if (!activeGMOrOwner(actor)) return null
   const key = actor.uuid
   if (refreshLocks.has(key)) return null
   refreshLocks.add(key)
   try {
      if (!actorHasSlug(actor, ["blood-calls-to-blood"])) {
         await deleteEffectsBySlugs(actor, [BLOOD_CALLS_SLUG])
         return null
      }
      const wounded = conditionValue(actor, "wounded")
      const doomed = conditionValue(actor, "doomed")
      const value = Math.min(6, 2 * (wounded + doomed))
      if (value <= 0) {
         await deleteEffectsBySlugs(actor, [BLOOD_CALLS_SLUG])
         return null
      }
      return createOrRefreshEffect(
         actor,
         effectSource({
            name: `Effect: Blood Calls to Blood +${value}`,
            slug: BLOOD_CALLS_SLUG,
            duration: { value: -1, unit: "unlimited" },
            description: `+${value} circumstance bonus to melee Strike damage.`,
            rules: [
               {
                  key: "FlatModifier",
                  selector: "strike-damage",
                  type: "circumstance",
                  value,
                  predicate: ["item:melee"],
                  label: "Blood Calls to Blood",
               },
            ],
            flags: { orc: true, bloodCallsToBlood: true },
         }),
         { slugs: [BLOOD_CALLS_SLUG] },
      )
   } finally {
      refreshLocks.delete(key)
   }
}

export async function configureIncredibleTenacityOnCreate(item) {
   const actor = item?.actor
   if (!actor || item.type !== "feat") return
   const slug = item.slug ?? item.system?.slug
   if (slug !== "incredible-tenacity") return
   await refreshOrcTenacityFrequency(actor)
}

export async function refreshOrcTenacityFrequency(actor) {
   if (!actorHasSlug(actor, ["incredible-tenacity"])) return null
   const item = abilityItem(actor, ["orc-tenacity"])
   if (!item) return null
   if (item.system?.frequency?.per === "PT1H") return item
   await item.update({
      "system.frequency.max": 1,
      "system.frequency.per": "PT1H",
   })
   return item
}

export function ferociousBeasts({ actor } = {}) {
   const resolved = validateOrcActor(actor, ["ferocious-beasts"], "Ferocious Beasts")
   if (!resolved) return null
   const targets = targetActors()
   if (!targets.length) return warn("Target companion, pet, familiar, or bonded animal actors.")
   const grantsUndying = actorHasSlug(resolved, ["undying-tenacity"])
   return Promise.all(
      targets.map(async (target) => {
         try {
            if (!actorHasSlug(target, ["orc-tenacity"])) {
               await target.createEmbeddedDocuments("Item", [
                  {
                     name: "Orc Tenacity",
                     type: "action",
                     img: "systems/pf2e/icons/default-icons/action.svg",
                     system: {
                        slug: "orc-tenacity",
                        actionType: { value: "reaction" },
                        actions: { value: null },
                        frequency: { value: 1, max: 1, per: "day" },
                        traits: { value: ["orc"] },
                        description: {
                           value:
                              "<p>Granted by Ferocious Beasts. Use the Orc Tenacity reaction when reduced to 0 HP.</p>",
                           gm: "",
                        },
                     },
                     flags: {
                        [MODULE_ID]: {
                           orc: true,
                           ferociousBeasts: true,
                        },
                     },
                  },
               ])
            }
            if (grantsUndying) {
               await createOrRefreshEffect(
                  target,
                  effectSource({
                     name: "Effect: Ferocious Beasts Undying Tenacity",
                     slug: "undying-tenacity",
                     duration: { value: -1, unit: "unlimited" },
                     description:
                        "This creature benefits from the owner's Undying Tenacity when it uses Orc Tenacity.",
                     rules: [],
                     flags: { orc: true, ferociousBeasts: true },
                  }),
                  { slugs: ["undying-tenacity"] },
               )
            }
            return target
         } catch (_error) {
            warn(`Could not update ${target?.name ?? "target"}.`)
            return null
         }
      }),
   )
}
