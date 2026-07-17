import {
   MODULE_ID,
   actorLevel,
   compendiumItemBySlug,
   esc,
   promptForm,
   slugify,
   warn,
} from "../hadaganian/helpers.mjs"

export const SPIRIT_VESSEL_SLUG = "spirit-vessel"
const SPIRITUAL_HEALTH_SLUG = "spiritual-health"
const VESSEL_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/orc/ArtifactUnity.(UITexture).png"
const SPIRITUAL_HEALTH_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/orc/DruidNaturalRegeneration.tr.(UITexture).png"
const ABSORB_STRENGTH_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/orc/NecromancerLifetapUpgrade.(UITexture).png"
const DEFLECTING_SPIRIT_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/orc/NecromancerGhostlyVeil.(UITexture).png"
const FLEET_SPIRIT_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/orc/RapidSpurt.(UITexture).png"

const BOONS = [
   {
      slug: SPIRITUAL_HEALTH_SLUG,
      label: "Spiritual Health",
      level: 0,
      actionType: "passive",
      actions: null,
      img: SPIRITUAL_HEALTH_ICON,
      description:
         "The spirit vessel guides your body away from impurities. You gain a +1 circumstance bonus to saving throws against diseases and poisons, and if you roll a success against such an effect, you get a critical success instead.",
   },
   {
      slug: "absorb-strength",
      label: "Absorb Strength",
      level: 5,
      img: ABSORB_STRENGTH_ICON,
      actionType: "free",
      actions: null,
      frequency: { value: 1, max: 1, per: "PT10M" },
      description:
         "Trigger: you are adjacent to a corpse that died within the last minute. Gain temporary Hit Points equal to the enemy's level for 1 minute.",
   },
   {
      slug: "deflecting-spirit",
      label: "Deflecting Spirit",
      level: 5,
      img: DEFLECTING_SPIRIT_ICON,
      actionType: "reaction",
      actions: null,
      frequency: { value: 1, max: 1, per: "PT1H" },
      description:
         "Trigger: you are targeted by a ranged attack you are aware of. Gain +2 circumstance bonus to AC against the triggering attack.",
   },
   {
      slug: "fleet-spirit",
      label: "Fleet Spirit",
      level: 5,
      img: FLEET_SPIRIT_ICON,
      actionType: "action",
      actions: 1,
      frequency: { value: 1, max: 1, per: "day" },
      description: "Cast fleet step as a primal innate spell once per day.",
   },
   {
      slug: "spiritual-rejuvenation",
      label: "Spiritual Rejuvenation",
      level: 9,
      actionType: "action",
      actions: 2,
      frequency: { value: 1, max: 1, per: "PT1H" },
      description:
         "Cast heal as an innate primal spell to restore Hit Points. The rank is 4, increasing by 1 at 13th and 17th levels.",
      spell: { slug: "heal", rank: (actor) => (actorLevel(actor) >= 17 ? 6 : actorLevel(actor) >= 13 ? 5 : 4), per: "PT1H" },
   },
   {
      slug: "soil-of-earth",
      label: "Soil of Earth",
      level: 9,
      actionType: "passive",
      actions: null,
      description:
         "Cast create food as a 4th-rank primal innate spell and create water as a 1st-rank primal innate spell once per day each.",
      spells: [
         { slug: "create-food", rank: 4, per: "day" },
         { slug: "create-water", rank: 1, per: "day" },
      ],
   },
   {
      slug: "spirits-wisdom",
      label: "Spirit's Wisdom",
      level: 9,
      actionType: "passive",
      actions: null,
      description: "Cast read omens as a primal innate spell once per day.",
      spell: { slug: "read-omens", rank: 4, per: "day" },
   },
   {
      slug: "vengeful-spirit",
      label: "Vengeful Spirit",
      level: 9,
      actionType: "passive",
      actions: null,
      description:
         "Cast blood vendetta as a 4th-rank primal innate spell once per day using Wisdom.",
      spell: { slug: "blood-vendetta", rank: 4, per: "day" },
   },
   {
      slug: "cloak-of-poison",
      label: "Cloak of Poison",
      level: 13,
      actionType: "action",
      actions: 2,
      frequency: { value: 1, max: 1, per: "day" },
      description:
         "For 1 minute, creatures that touch you or damage you with an unarmed attack or melee weapon without reach take 3d6 poison damage.",
   },
   {
      slug: "spirits-breath",
      label: "Spirit's Breath",
      level: 13,
      actionType: "passive",
      actions: null,
      description: "Cast breath of life as a 6th-rank primal innate spell once per day.",
      spell: { slug: "breath-of-life", rank: 6, per: "day" },
   },
   {
      slug: "sheltering-spirit",
      label: "Sheltering Spirit",
      level: 13,
      actionType: "passive",
      actions: null,
      description: "Cast vital beacon as a 6th-rank primal innate spell once per day.",
      spell: { slug: "vital-beacon", rank: 6, per: "day" },
   },
   {
      slug: "spiritual-regrowth",
      label: "Spiritual Regrowth",
      level: 17,
      actionType: "passive",
      actions: null,
      description: "Cast regenerate as a 7th-rank primal innate spell once per day.",
      spell: { slug: "regenerate", rank: 7, per: "day" },
   },
]

const UPGRADE_SLUGS = new Map([
   ["infused-vessel", 5],
   ["greater-vessel", 9],
   ["major-vessel", 13],
   ["legendary-vessel", 17],
])
const ACTION_TO_API = new Map([
   ["absorb-strength", "infusedVesselAbsorbStrength"],
   ["deflecting-spirit", "infusedVesselDeflectingSpirit"],
   ["fleet-spirit", "infusedVesselFleetSpirit"],
   ["cloak-of-poison", "majorVesselCloakOfPoison"],
])

function itemSlug(item) {
   return slugify(item?.slug ?? item?.system?.slug ?? item?.name)
}

function optionTags(options) {
   return options
      .map(
         ({ value, label }) =>
            `<option value="${esc(value)}">${esc(label)}</option>`,
      )
      .join("")
}

function spiritVesselItem(actor) {
   return (
      actor?.items?.find?.(
         (item) =>
            item.type === "equipment" &&
            itemSlug(item) === SPIRIT_VESSEL_SLUG &&
            item.getFlag?.(MODULE_ID, "spiritVessel.item") === true,
      ) ??
      actor?.items?.find?.(
         (item) => item.type === "equipment" && itemSlug(item) === SPIRIT_VESSEL_SLUG,
      ) ??
      null
   )
}

function spiritVesselBoons(item) {
   return Array.from(item?.getFlag?.(MODULE_ID, "spiritVessel.boons") ?? [])
      .map(slugify)
      .filter(Boolean)
}

function vesselDescription(boons = []) {
   const known = new Set(boons.map(slugify))
   const labels = BOONS.filter((boon) => known.has(boon.slug)).map(
      (boon) => boon.label,
   )
   const list =
      labels.length > 0
         ? `<ul>${labels.map((label) => `<li>${esc(label)}</li>`).join("")}</ul>`
         : "<p>No boons selected.</p>"
   return `<h4>Current Boons</h4>${list}`
}

function spiritVesselSource(boons = []) {
   return {
      name: "Spirit Vessel",
      type: "equipment",
      img: VESSEL_ICON,
      system: {
         slug: SPIRIT_VESSEL_SLUG,
         description: { value: vesselDescription(boons), gm: "" },
         traits: { value: ["orc"], rarity: "unique", otherTags: [] },
         quantity: 1,
         bulk: { value: 0 },
         equipped: { carryType: "worn", invested: null, handsHeld: 0 },
         usage: { value: "worn" },
         rules: [
            {
               key: "AdjustDegreeOfSuccess",
               selector: "saving-throw",
               adjustment: { success: "one-degree-better" },
               predicate: [
                  {
                     or: ["origin:trait:disease", "origin:trait:poison"],
                  },
               ],
            },
         ],
      },
      flags: {
         [MODULE_ID]: {
            orc: true,
            spiritVessel: {
               item: true,
               boons,
            },
         },
      },
   }
}

function actionSource({
   name,
   slug,
   img,
   actionType = "action",
   actions = 1,
   frequency = null,
   description,
}) {
   const system = {
      slug,
      actionType: { value: actionType },
      actions: { value: actions },
      traits: { value: ["orc", "primal"] },
      description: {
         value: `<p>${esc(description)}</p>`,
         gm: "",
      },
   }
   if (frequency) system.frequency = frequency
   return {
      name,
      type: "action",
      img,
      system,
      flags: {
         [MODULE_ID]: {
            orc: true,
            spiritVessel: {
               action: slug,
            },
         },
      },
   }
}

function spiritualHealthSource() {
   const boon = BOONS.find((candidate) => candidate.slug === SPIRITUAL_HEALTH_SLUG)
   return actionSource({
      name: "Spiritual Health",
      slug: SPIRITUAL_HEALTH_SLUG,
      img: SPIRITUAL_HEALTH_ICON,
      actionType: "passive",
      actions: null,
      frequency: null,
      description: boon?.description ?? "",
   })
}

function boonActionSource(boon) {
   return actionSource({
      name: boon.label,
      slug: boon.slug,
      img: boon.img ?? VESSEL_ICON,
      actionType: boon.actionType,
      actions: boon.actions,
      frequency: boon.frequency,
      description: boon.description,
   })
}

async function getOrCreateSpiritVesselSpellEntry(actor) {
   const existing = actor.itemTypes?.spellcastingEntry?.find?.(
      (item) => item.getFlag?.(MODULE_ID, "spiritVessel.spellEntry") === true,
   )
   if (existing) return existing
   const [entry] = await actor.createEmbeddedDocuments("Item", [
      {
         name: "Spirit Vessel Innate Spells",
         type: "spellcastingEntry",
         system: {
            ability: { value: "wis" },
            spelldc: { value: 0, dc: 0 },
            tradition: { value: "primal" },
            prepared: { value: "innate" },
         },
         flags: {
            [MODULE_ID]: {
               orc: true,
               spiritVessel: { spellEntry: true },
            },
         },
      },
   ])
   return entry ?? null
}

async function grantSpiritVesselSpell(actor, spellData) {
   if (!spellData?.slug) return null
   const rank =
      typeof spellData.rank === "function"
         ? Number(spellData.rank(actor))
         : Number(spellData.rank)
   const spell = await compendiumItemBySlug(spellData.slug, {
      packs: ["pf2e.spells-srd", "pf2e.spells"],
      type: "spell",
   })
   if (!spell) {
      warn(`Spirit Vessel spell not found: ${spellData.slug}.`)
      return null
   }
   const entry = await getOrCreateSpiritVesselSpellEntry(actor)
   if (!entry) return null
   const existing = actor.items?.find?.(
      (item) =>
         item.type === "spell" &&
         item.getFlag?.(MODULE_ID, "spiritVessel.spellSlug") === spellData.slug,
   )
   if (existing) return existing
   const source = spell.toObject()
   delete source._id
   foundry.utils.setProperty(source, "system.location.value", entry.id)
   if (Number.isFinite(rank)) {
      foundry.utils.setProperty(source, "system.location.heightenedLevel", rank)
   }
   foundry.utils.setProperty(source, "system.location.uses", {
      value: 1,
      max: 1,
      per: spellData.per ?? "day",
   })
   foundry.utils.setProperty(
      source,
      `flags.${MODULE_ID}.spiritVessel.spellSlug`,
      spellData.slug,
   )
   const [created] = await actor.createEmbeddedDocuments("Item", [source])
   return created ?? null
}

async function ensureItem(actor, source, slug) {
   const existing = actor.items?.find?.(
      (item) =>
         item.type === source.type &&
         itemSlug(item) === slug &&
         item.getFlag?.(MODULE_ID, "spiritVessel.generated") !== false,
   )
   if (existing) {
      const updates = {}
      if (source.img && existing.img !== source.img) updates.img = source.img
      if (
         source.system?.description?.value &&
         existing.system?.description?.value !== source.system.description.value
      ) {
         updates["system.description.value"] = source.system.description.value
      }
      if (source.system?.frequency) {
         updates["system.frequency"] = source.system.frequency
      }
      if (Object.keys(updates).length > 0) await existing.update(updates)
      return existing
   }
   const [created] = await actor.createEmbeddedDocuments("Item", [
      foundry.utils.mergeObject(source, {
         flags: {
            [MODULE_ID]: {
               spiritVessel: {
                  generated: true,
               },
            },
         },
      }),
   ])
   return created ?? null
}

async function updateVesselBoons(vessel, boons) {
   const unique = [...new Set(boons.map(slugify).filter(Boolean))]
   await vessel.update({
      "system.description.value": vesselDescription(unique),
      [`flags.${MODULE_ID}.spiritVessel.boons`]: unique,
   })
}

async function ensureSpiritVessel(actor) {
   let vessel = spiritVesselItem(actor)
   if (!vessel) {
      vessel = await ensureItem(
         actor,
         spiritVesselSource([SPIRITUAL_HEALTH_SLUG]),
         SPIRIT_VESSEL_SLUG,
      )
   } else {
      const updates = {}
      if (vessel.system?.traits?.rarity !== "unique") {
         updates["system.traits.rarity"] = "unique"
      }
      if (vessel.system?.equipped?.carryType !== "worn") {
         updates["system.equipped.carryType"] = "worn"
      }
      if (vessel.system?.usage?.value !== "worn") {
         updates["system.usage.value"] = "worn"
      }
      if (Object.keys(updates).length > 0) await vessel.update(updates)
      const currentBoons = spiritVesselBoons(vessel)
      const repairedBoons = currentBoons.includes(SPIRITUAL_HEALTH_SLUG)
         ? currentBoons
         : [SPIRITUAL_HEALTH_SLUG, ...currentBoons]
      if (
         repairedBoons.length !== currentBoons.length ||
         vessel.system?.description?.value !== vesselDescription(repairedBoons)
      ) {
         await updateVesselBoons(vessel, repairedBoons)
      }
   }
   await ensureItem(actor, spiritualHealthSource(), SPIRITUAL_HEALTH_SLUG)
   for (const slug of spiritVesselBoons(vessel)) {
      const boon = BOONS.find((candidate) => candidate.slug === slug)
      if (boon && !boon.spell && !boon.spells) {
         await ensureItem(actor, boonActionSource(boon), boon.slug)
      }
   }
   return vessel
}

function eligibleBoons(vessel, level) {
   const chosen = new Set(spiritVesselBoons(vessel))
   return BOONS.filter((boon) => boon.level <= level && !chosen.has(boon.slug))
}

async function promptForBoon(actor, feat, maxLevel = 5) {
   const vessel = await ensureSpiritVessel(actor)
   if (!vessel) return null
   const level = Number(maxLevel || feat?.system?.level?.value || 5) || 5
   const boons = eligibleBoons(vessel, level)
   if (!boons.length) {
      warn("No eligible Spirit Vessel boons remain.")
      return null
   }

   const result = await promptForm({
      title: "Spirit Vessel Boon",
      content: `
         <form class="standard-form">
            <div class="form-group"><label>Boon</label><div class="form-fields"><select name="boon">${optionTags(
               boons.map((boon) => ({ value: boon.slug, label: boon.label })),
            )}</select></div></div>
         </form>
      `,
      submit: "Choose",
   })
   if (!result) return null
   const slug = slugify(result.read("boon"))
   const boon = BOONS.find((candidate) => candidate.slug === slug)
   if (!boon) return null

   const chosen = [...spiritVesselBoons(vessel), boon.slug]
   await updateVesselBoons(vessel, chosen)
   if (boon.spell) await grantSpiritVesselSpell(actor, boon.spell)
   for (const spell of boon.spells ?? []) {
      await grantSpiritVesselSpell(actor, spell)
   }
   if (!boon.spell && !boon.spells) {
      await ensureItem(actor, boonActionSource(boon), boon.slug)
   }
   return boon
}

export function hasUsableSpiritVessel(actor, boonSlug = null) {
   const vessel = spiritVesselItem(actor)
   if (!vessel) return false
   const carryType = vessel.system?.equipped?.carryType
   if (carryType === "dropped") return false
   if (!boonSlug) return true
   return spiritVesselBoons(vessel).includes(slugify(boonSlug))
}

export function warnMissingSpiritVessel(actor, boonSlug = null) {
   if (hasUsableSpiritVessel(actor, boonSlug)) return false
   warn(
      boonSlug
         ? "Your Spirit Vessel is missing, dropped, or does not have this boon."
         : "Your Spirit Vessel is missing or dropped.",
   )
   return true
}

export async function configureSpiritVesselOnCreate(item) {
   const actor = item?.actor
   if (!actor || item.type !== "feat") return
   const slug = itemSlug(item)
   if (slug === SPIRIT_VESSEL_SLUG) {
      await ensureSpiritVessel(actor)
   } else if (UPGRADE_SLUGS.has(slug)) {
      await promptForBoon(actor, item, UPGRADE_SLUGS.get(slug))
   }
}

export function registerSpiritVesselMaintenance() {
   Hooks.once("ready", () => {
      for (const actor of game.actors ?? []) {
         if (actor.type !== "character") continue
         if (spiritVesselItem(actor)) void ensureSpiritVessel(actor)
      }
   })
}

function messageItem(message) {
   const pf2e = message?.flags?.pf2e ?? {}
   const context = pf2e.context ?? {}
   return (
      message?.item ??
      context.item ??
      context.origin ??
      pf2e.origin ??
      pf2e.item ??
      null
   )
}

function actorFromMessage(message) {
   return game.actors?.get(message?.speaker?.actor) ?? null
}

export async function handleSpiritVesselActionMessage(message) {
   const item = messageItem(message)
   const slug = itemSlug(item)
   const apiName = ACTION_TO_API.get(slug)
   if (!apiName) return
   const actor = actorFromMessage(message)
   if (!actor) return
   const api = game.modules?.get?.(MODULE_ID)?.api?.ancestries?.orc
   const fn = api?.[apiName]
   if (typeof fn === "function") await fn({ actor })
}
