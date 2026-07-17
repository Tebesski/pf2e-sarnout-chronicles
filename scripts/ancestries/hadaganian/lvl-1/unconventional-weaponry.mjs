import {
   MODULE_ID,
   esc,
   ownedOrControlledActor,
   promptForm,
   slugify,
   warn,
} from "../helpers.mjs"

function itemSlug(item) {
   return slugify(item?.slug ?? item?.system?.slug ?? item?.name)
}

function isUnconventionalWeaponry(item) {
   return item?.type === "feat" && itemSlug(item) === "unconventional-weaponry"
}

function referencesBase(rule, baseSlug) {
   if (!baseSlug) return false
   return JSON.stringify(rule ?? {}).includes(`item:base:${baseSlug}`)
}

function isModuleRule(rule, previousBaseSlug) {
   const ruleSlug = slugify(rule?.slug)
   const serialized = JSON.stringify(rule ?? {})
   return (
      ruleSlug.startsWith("unconventional-weaponry-") ||
      referencesBase(rule, previousBaseSlug) ||
      (rule?.key === "CriticalSpecialization" &&
         serialized.includes("item:base:"))
   )
}

function rulesForBase(baseSlug) {
   return [
      {
         key: "MartialProficiency",
         slug: `unconventional-weaponry-${baseSlug}-martial`,
         definition: [`item:base:${baseSlug}`, "item:category:martial"],
         sameAs: "simple",
      },
      {
         key: "MartialProficiency",
         slug: `unconventional-weaponry-${baseSlug}-advanced`,
         definition: [`item:base:${baseSlug}`, "item:category:advanced"],
         sameAs: "martial",
      },
      {
         key: "CriticalSpecialization",
         predicate: [{ gte: ["self:level", 5] }, `item:base:${baseSlug}`],
      },
   ]
}

async function promptBaseName(defaultValue = "") {
   const result = await promptForm({
      title: "Unconventional Weaponry",
      content: `
         <form class="standard-form">
            <div class="form-group"><label>Item Base Name</label><div class="form-fields"><input type="text" name="baseName" value="${esc(defaultValue)}" placeholder="bastard sword"></div></div>
         </form>
      `,
      submit: "Apply",
   })
   if (!result) return null
   return String(result.read("baseName") ?? "").trim()
}

export async function configureUnconventionalWeaponryItem(
   item,
   { force = false } = {},
) {
   if (!isUnconventionalWeaponry(item)) return null
   if (!item.actor) return null
   const existing = item.getFlag?.(MODULE_ID, "unconventionalWeaponry")
   if (existing?.baseSlug && !force) return item

   const baseName = await promptBaseName(existing?.baseName ?? "")
   const baseSlug = slugify(baseName)
   if (!baseSlug) return warn("Item base name is required.")

   const previousBaseSlug = existing?.baseSlug
   const existingRules = Array.isArray(item.system?.rules)
      ? item.system.rules
      : []
   const preservedRules = existingRules.filter(
      (rule) => !isModuleRule(rule, previousBaseSlug),
   )
   const nextRules = [...preservedRules, ...rulesForBase(baseSlug)]

   await item.update({ "system.rules": nextRules })
   await item.setFlag(MODULE_ID, "unconventionalWeaponry", {
      baseName,
      baseSlug,
   })
   return item
}

export async function configureUnconventionalWeaponryOnCreate(item) {
   return configureUnconventionalWeaponryItem(item)
}

export async function unconventionalWeaponry({ actor, item } = {}) {
   const feat =
      item ??
      ownedOrControlledActor(actor)?.items?.find?.((candidate) =>
         isUnconventionalWeaponry(candidate),
      )
   if (!feat) return warn("Unconventional Weaponry feat not found.")
   return configureUnconventionalWeaponryItem(feat, { force: true })
}
