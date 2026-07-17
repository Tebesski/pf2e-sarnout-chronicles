import {
   ANCESTRY_TRAIT_CONFIG_KEYS,
   ANCESTRY_TRAIT_DEFINITIONS,
} from "./constants.mjs"

const SETTINGS_BACKED_CONFIG_KEYS = new Set([
   "featTraits",
   "actionTraits",
   "weaponTraits",
   "shieldTraits",
])

function slugify(value) {
   return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
}

function itemSlug(item, changes = null) {
   return slugify(
      changes?.system?.slug ??
         changes?.name ??
         item?.slug ??
         item?.system?.slug ??
         item?.name,
   )
}

function ancestrySlug(item, changes = null) {
   return slugify(
      changes?.system?.ancestry?.slug ??
         changes?.system?.ancestry?.name ??
         changes?.system?.ancestry?.value ??
         item?.system?.ancestry?.slug ??
         item?.system?.ancestry?.name ??
         item?.system?.ancestry?.value,
   )
}

export function registerAncestryTraits() {
   for (const definition of ANCESTRY_TRAIT_DEFINITIONS) {
      if (definition.register === false) continue
      for (const configKey of ANCESTRY_TRAIT_CONFIG_KEYS) {
         if (SETTINGS_BACKED_CONFIG_KEYS.has(configKey)) continue
         const config = CONFIG.PF2E?.[configKey]
         if (config) config[definition.slug] = definition.label
      }
   }
}

function matchingAncestryTrait(item, changes = null) {
   const slug = itemSlug(item, changes)
   const ancestry = ancestrySlug(item, changes)

   return ANCESTRY_TRAIT_DEFINITIONS.find((definition) => {
      if (definition.ancestrySlugs.includes(slug)) return true
      if (definition.itemSlugs.includes(slug)) return true
      return ancestry && definition.ancestrySlugs.includes(ancestry)
   })
}

export function autoApplyAncestryTraits(item, changes = null) {
   const definition = matchingAncestryTrait(item, changes)
   if (!definition) return

   const traits = changes?.system?.traits?.value ?? item.system?.traits?.value
   if (!Array.isArray(traits)) return

   const newTraits = new Set(traits)
   newTraits.add(definition.slug)

   if (newTraits.size === traits.length) return

   const updatedArray = Array.from(newTraits)
   if (changes) {
      foundry.utils.setProperty(changes, "system.traits.value", updatedArray)
   } else {
      item.updateSource({ "system.traits.value": updatedArray })
   }
}
