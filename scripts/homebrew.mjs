export const SARNOUT_LANGUAGES = [
   { id: "elfin", label: "Elfin", rarity: "common" },
   { id: "ghibbermal", label: "Ghibbermál", rarity: "common" },
   { id: "aro-hada-dialect", label: "Aro (Hada dialect)", rarity: "common" },
   { id: "aro-kanian-dialect", label: "Aro (Kanian dialect)", rarity: "common" },
   { id: "kanian-umoyran", label: "Kanian (Umoyran)", rarity: "common" },
   { id: "kanian-foroxian", label: "Kanian (Foroxian)", rarity: "common" },
   { id: "hada-suslanger", label: "Hada (Suslanger)", rarity: "common" },
   { id: "hada-jigran", label: "Hada (Jigran)", rarity: "common" },
   { id: "hada-igsh", label: "Hada (Igsh)", rarity: "common" },
   { id: "goblinsk", label: "Goblinsk", rarity: "common" },
   { id: "orcish", label: "Orcish", rarity: "common" },
   { id: "minotaurian", label: "Minotaurian", rarity: "common" },
   { id: "koboldish", label: "Koboldish", rarity: "common" },
   { id: "harpian", label: "Harpian", rarity: "common" },
   { id: "quagish", label: "Quagish", rarity: "common" },
   { id: "morsin-code", label: "Morsin code", rarity: "uncommon" },
   { id: "fenya", label: "Fenya", rarity: "uncommon" },
   { id: "dzunic", label: "Džunic", rarity: "uncommon" },
   { id: "low-hikutic", label: "Low Hikutic", rarity: "uncommon" },
   { id: "avian", label: "Avian", rarity: "uncommon" },
   { id: "ogric-sign-system", label: "Ogric sign system", rarity: "uncommon" },
   { id: "freeborn-slang", label: "Freeborn Slang", rarity: "uncommon" },
   { id: "birchtongue", label: "Birchtongue", rarity: "uncommon" },
   { id: "mountongue", label: "Mountongue", rarity: "uncommon" },
   { id: "kelpyt", label: "Kelpyt", rarity: "uncommon" },
   { id: "hisss", label: "Hisss", rarity: "uncommon" },
   { id: "seismic-communication", label: "Seismic communication", rarity: "uncommon" },
   { id: "centauric", label: "Centauric", rarity: "rare" },
   { id: "high-hikutic", label: "High Hikutic", rarity: "rare" },
   { id: "catfey-mental", label: "Catfey (mental)", rarity: "rare" },
   { id: "snaketongue", label: "Snaketongue", rarity: "rare" },
   { id: "kalba", label: "Kalbà", rarity: "rare" },
   { id: "tongues", label: "Tongues", rarity: "secret" },
   { id: "demonic-mental", label: "Demonic (mental)", rarity: "secret" },
   { id: "draconic", label: "Draconic", rarity: "secret" },
]

const SARNOUT_TRAITS = {
   featTraits: [
      { id: "hadaganian", value: "Hadaganian" },
      { id: "templar", value: "Templar" },
      { id: "barrier", value: "Barrier" },
      { id: "caste", value: "Caste" },
   ],
   weaponTraits: [{ id: "hadaganian", value: "Hadaganian" }],
   shieldTraits: [{ id: "hadaganian", value: "Hadaganian" }],
}

const MODULE_TRAITS = {
   spellTraits: [
      { id: "templar", value: "Templar" },
      { id: "barrier", value: "Barrier" },
   ],
}

const SARNOUT_LANGUAGE_IDS = new Set(SARNOUT_LANGUAGES.map((language) => language.id))
const LANGUAGE_RARITIES = ["uncommon", "rare", "secret", "unavailable"]

function sorted(values) {
   return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
      String(a).localeCompare(String(b)),
   )
}

function getPf2eSetting(key, fallback = null) {
   try {
      return game.settings.get("pf2e", key)
   } catch (_error) {
      return fallback
   }
}

async function setPf2eSetting(key, value) {
   try {
      await game.settings.set("pf2e", key, value)
      return true
   } catch (_error) {
      return false
   }
}

function settingEntries(key) {
   const value = getPf2eSetting(`homebrew.${key}`, [])
   return Array.isArray(value) ? value : []
}

function isSystemLanguage(id) {
   const label = CONFIG.PF2E?.languages?.[id]
   return typeof label === "string" && label.startsWith("PF2E.")
}

function isLanguagePresent(id, entries = settingEntries("languages")) {
   return Boolean(CONFIG.PF2E?.languages?.[id] || entries.some((entry) => entry.id === id))
}

function languageRaritySource() {
   const value = getPf2eSetting("homebrew.languageRarities", null)
   const source = value?.toObject?.(true) ?? value?.toObject?.() ?? value ?? {}
   return {
      commonLanguage: source.commonLanguage ?? source.common ?? null,
      uncommon: Array.from(source.uncommon ?? []),
      rare: Array.from(source.rare ?? []),
      secret: Array.from(source.secret ?? []),
      unavailable: Array.from(source.unavailable ?? []),
   }
}

function runtimeRegisterTraits(entriesByKey) {
   for (const [configKey, entries] of Object.entries(entriesByKey)) {
      const config = CONFIG.PF2E?.[configKey]
      if (!config) continue
      for (const entry of entries) config[entry.id] = entry.value
   }
}

export function registerSarnoutRuntimeHomebrew() {
   runtimeRegisterTraits(MODULE_TRAITS)
}

async function mergeHomebrewEntries(key, entries) {
   const current = settingEntries(key)
   const byId = new Map(current.map((entry) => [entry.id, entry]))
   let changed = false
   for (const entry of entries) {
      const existing = byId.get(entry.id)
      if (existing?.value === entry.value) continue
      byId.set(entry.id, { ...existing, ...entry })
      changed = true
   }
   if (!changed) return false
   await setPf2eSetting(`homebrew.${key}`, Array.from(byId.values()))
   return true
}

async function removeHomebrewEntries(key, ids) {
   const current = settingEntries(key)
   const filtered = current.filter((entry) => !ids.includes(entry.id))
   if (filtered.length === current.length) return false
   await setPf2eSetting(`homebrew.${key}`, filtered)
   return true
}

async function ensureLanguageEntries() {
   const current = settingEntries("languages")
   const byId = new Map(current.map((entry) => [entry.id, entry]))
   let changed = false
   for (const language of SARNOUT_LANGUAGES) {
      if (isSystemLanguage(language.id)) continue
      const existing = byId.get(language.id)
      if (existing?.value === language.label) continue
      byId.set(language.id, { id: language.id, value: language.label })
      changed = true
   }
   if (!changed) return false
   await setPf2eSetting("homebrew.languages", Array.from(byId.values()))
   return true
}

function rarityIds(rarity) {
   return SARNOUT_LANGUAGES
      .filter((language) => language.rarity === rarity && isLanguagePresent(language.id))
      .map((language) => language.id)
}

function applySarnoutRarities(source, { moveDefaults = false } = {}) {
   const next = {
      commonLanguage: source.commonLanguage,
      uncommon: sorted(source.uncommon),
      rare: sorted(source.rare),
      secret: sorted(source.secret),
      unavailable: sorted(source.unavailable),
   }
   for (const rarity of LANGUAGE_RARITIES) {
      next[rarity] = next[rarity].filter((id) => !SARNOUT_LANGUAGE_IDS.has(id))
   }
   for (const rarity of ["uncommon", "rare", "secret"]) {
      next[rarity] = sorted([...next[rarity], ...rarityIds(rarity)])
   }
   if (moveDefaults) {
      const homebrewIds = new Set(settingEntries("languages").map((entry) => entry.id))
      const defaultIds = Object.keys(CONFIG.PF2E?.languages ?? {}).filter(
         (id) =>
            id !== "common" &&
            !SARNOUT_LANGUAGE_IDS.has(id) &&
            !homebrewIds.has(id),
      )
      for (const rarity of ["uncommon", "rare", "secret"]) {
         next[rarity] = next[rarity].filter((id) => !defaultIds.includes(id))
      }
      next.unavailable = sorted([...next.unavailable, ...defaultIds])
      if (next.commonLanguage && defaultIds.includes(next.commonLanguage)) {
         next.commonLanguage = null
      }
   }
   return next
}

async function setLanguageRarities(next) {
   await setPf2eSetting("homebrew.languageRarities", next)
   const campaignLanguages = game.pf2e?.settings?.campaign?.languages
   if (campaignLanguages?.updateSource) campaignLanguages.updateSource(next)
}

export async function ensureSarnoutHomebrew() {
   if (!game.user?.isGM) return false
   registerSarnoutRuntimeHomebrew()
   await ensureLanguageEntries()
   await mergeHomebrewEntries("featTraits", SARNOUT_TRAITS.featTraits)
   await mergeHomebrewEntries("weaponTraits", SARNOUT_TRAITS.weaponTraits)
   await mergeHomebrewEntries("shieldTraits", SARNOUT_TRAITS.shieldTraits)
   await removeHomebrewEntries("spellTraits", ["templar", "barrier"])
   await removeHomebrewEntries("actionTraits", ["templar", "barrier"])
   await setLanguageRarities(applySarnoutRarities(languageRaritySource()))
   return true
}

export async function configureSarnoutLanguages() {
   if (!game.user?.isGM) {
      ui.notifications?.warn("Only a GM can configure Sarnout languages.")
      return false
   }
   await ensureLanguageEntries()
   await setLanguageRarities(
      applySarnoutRarities(languageRaritySource(), { moveDefaults: true }),
   )
   ui.notifications?.info("Sarnout languages configured.")
   return true
}
