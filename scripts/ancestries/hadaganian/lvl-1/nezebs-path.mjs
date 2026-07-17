import {
   MODULE_ID,
   actorEffectBySlug,
   actorLevel,
   chat,
   createOrRefreshEffect,
   deleteEffectsBySlugs,
   deleteHadaganianInnateEntry,
   effectSource,
   esc,
   grantInnateSpell,
   info,
   ownedOrControlledActor,
   promptForm,
   warn,
} from "../helpers.mjs"

const NEZEB_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/hadaganian/SymbolAdventuresEmpire.(UITexture).png"
const FATHERS_PRIDE_ENTRY_FLAG = "fathersPrideInnateEntry"
const FATHERS_PRIDE_SPELL_FLAG = "fathersPrideGrantedSpell"
const SPELL_PACKS = ["pf2e.spells-srd", "pf2e.spells"]

const FATHER_PRIDE_SPELLS = {
   first: [
      { name: "Scorching Blast" },
      { name: "Fear the Sun" },
      { name: "Unseasonable Squall" },
      { name: "Aerial Form", note: "Bird only" },
      { name: "Show the Way", note: "heightened to 6th", rank: 6 },
   ],
   second: [
      { name: "Create Water" },
      { name: "Augury" },
      { name: "Cozy Cabin" },
      { name: "Soothing Spring" },
      { name: "Healing Well" },
   ],
   third: [
      { name: "Bane" },
      { name: "Feast of Ashes" },
      { name: "Cup of Dust" },
      { name: "Read Omens" },
      { name: "Wave of Despair" },
   ],
   fourth: [
      { name: "Bless" },
      { name: "Share Life" },
      { name: "Life Pact" },
      { name: "Unfettered Movement" },
      { name: "Rallying Banner" },
   ],
   fifth: [
      { name: "Sanctuary" },
      { name: "Dream Message" },
      { name: "Ring of Truth" },
      { name: "Honeyed Words" },
      { name: "Truespeech" },
   ],
}

const GREAT_FEAT_LABELS = {
   first: "First Feat",
   second: "Second Feat",
   third: "Third Feat",
   fourth: "Fourth Feat",
   fifth: "Fifth Feat",
}

function fulfilledSlug(greatFeat) {
   return `effect-nezebs-${greatFeat}-feat-fulfilled`
}

function declaredEffect(actor) {
   return actorEffectBySlug(actor, ["effect-nezebs-feat-declared"])
}

function fulfilledEffect(actor, greatFeat) {
   const specific = actorEffectBySlug(actor, [fulfilledSlug(greatFeat)])
   if (specific) return specific

   const legacy = actorEffectBySlug(actor, ["effect-nezebs-feat-fulfilled"])
   return legacy?.getFlag?.(MODULE_ID, "nezebsPath.fulfilled") === greatFeat
      ? legacy
      : null
}

function normalizeName(value) {
   return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
}

function spellRank(document, indexEntry, fallback = null) {
   const value = Number(
      fallback ??
         document?.system?.level?.value ??
         document?.system?.rank?.value ??
         indexEntry?.system?.level?.value ??
         indexEntry?.system?.rank?.value,
   )
   return Number.isFinite(value) ? value : 0
}

function unlockedFatherPrideSpells(actor, greatFeat) {
   const tier = Math.min(4, Math.floor(Math.max(0, actorLevel(actor) - 1) / 4))
   return (FATHER_PRIDE_SPELLS[greatFeat] ?? []).slice(0, tier + 1)
}

function spellPacks() {
   return SPELL_PACKS.map((id) => game.packs?.get(id)).filter(Boolean)
}

async function spellIndex(pack) {
   try {
      return await pack.getIndex({
         fields: ["name", "system.level.value", "system.rank.value"],
      })
   } catch (_error) {
      return pack.index ?? []
   }
}

function uuidForIndexEntry(pack, entry) {
   return entry.uuid ?? `Compendium.${pack.collection}.Item.${entry._id}`
}

async function resolveSpellChoices(spells) {
   const wanted = new Map(
      spells.map((spell, index) => [normalizeName(spell.name), { ...spell, index }]),
   )
   const found = new Map()

   for (const pack of spellPacks()) {
      const index = await spellIndex(pack)
      for (const entry of index) {
         const wantedSpell = wanted.get(normalizeName(entry.name))
         if (!wantedSpell || found.has(normalizeName(wantedSpell.name))) continue
         const uuid = uuidForIndexEntry(pack, entry)
         const document = await fromUuid(uuid).catch(() => null)
         found.set(normalizeName(wantedSpell.name), {
            name: document?.name ?? entry.name,
            sourceName: wantedSpell.name,
            uuid,
            rank: spellRank(document, entry, wantedSpell.rank),
            heightenedRank: wantedSpell.rank ?? null,
            note: wantedSpell.note ?? "",
            index: wantedSpell.index,
         })
      }
   }

   return Array.from(found.values()).sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank
      return a.index - b.index
   })
}

function spellOptionsByRank(choices) {
   const groups = new Map()
   for (const choice of choices) {
      const rank = Number(choice.rank) || 0
      if (!groups.has(rank)) groups.set(rank, [])
      groups.get(rank).push(choice)
   }
   return Array.from(groups.entries())
      .sort(([a], [b]) => a - b)
      .map(([rank, spells]) => {
         const options = spells
            .map((spell) => {
               const note = spell.note ? ` (${spell.note})` : ""
               return `<option value="${esc(spell.uuid)}" data-rank="${rank}" data-heightened-rank="${spell.heightenedRank ?? ""}">${esc(spell.name)}${esc(note)}</option>`
            })
            .join("")
         return `<optgroup label="Rank ${rank}">${options}</optgroup>`
      })
      .join("")
}

async function chooseFatherPrideSpell(actor, greatFeat, spells) {
   const choices = await resolveSpellChoices(spells)
   if (choices.length === 0) {
      return warn("No Father's Pride spells were found in the PF2e spell compendium.")
   }
   const missing = spells
      .filter(
         (spell) =>
            !choices.some(
               (choice) => normalizeName(choice.sourceName) === normalizeName(spell.name),
            ),
      )
      .map((spell) => spell.name)

   const result = await promptForm({
      title: "Father's Pride Spell",
      content: `
         <form class="standard-form">
            <div class="form-group"><label>Great Feat</label><div class="form-fields"><strong>${esc(GREAT_FEAT_LABELS[greatFeat])}</strong></div></div>
            <hr>
            <div class="form-group"><label>Spell</label><div class="form-fields"><select name="spellUuid">${spellOptionsByRank(choices)}</select></div></div>
            ${missing.length ? `<p class="hint">Not found: ${esc(missing.join(", "))}</p>` : ""}
         </form>
      `,
      submit: "Grant Spell",
      width: 500,
   })
   if (!result) return null

   const uuid = String(result.read("spellUuid") ?? "")
   const choice = choices.find((spell) => spell.uuid === uuid)
   if (!choice) return warn("Choose a Father's Pride spell.")

   return grantInnateSpell(actor, {
      uuid,
      tradition: "divine",
      rank: choice.heightenedRank,
      oncePerDay: true,
      entryFlag: FATHERS_PRIDE_ENTRY_FLAG,
      entryName: "Father's Pride",
      spellFlag: FATHERS_PRIDE_SPELL_FLAG,
   })
}

function declaredEffectSource(greatFeat) {
   return effectSource({
      name: "Effect: Feat Declared",
      slug: "effect-nezebs-feat-declared",
      img: NEZEB_ICON,
      duration: { value: -1, unit: "unlimited" },
      description: `Declared Great Feat: ${GREAT_FEAT_LABELS[greatFeat]}.`,
      rules: [],
      flags: { nezebsPath: { current: greatFeat } },
   })
}

function fathersPrideEffectSource(greatFeat, spells) {
   return effectSource({
      name: "Effect: Father's Pride",
      slug: "effect-fathers-pride",
      img: NEZEB_ICON,
      duration: { value: 2, unit: "days", expiry: "turn-start" },
      description: `Available spells: ${spells.map((spell) => spell.name).join(", ")}. Cast one as a divine innate spell within 2 days.`,
      rules: [],
      flags: { fathersPride: { greatFeat, spells } },
   })
}

function fulfilledEffectSource(greatFeat) {
   return effectSource({
      name: `Effect: Nezeb's Feat Fulfilled - ${GREAT_FEAT_LABELS[greatFeat]}`,
      slug: fulfilledSlug(greatFeat),
      img: NEZEB_ICON,
      duration: { value: 5, unit: "days", expiry: "turn-start" },
      description: `${GREAT_FEAT_LABELS[greatFeat]} cannot be declared again for 5 days.`,
      rules: [],
      flags: { nezebsPath: { fulfilled: greatFeat } },
   })
}

async function declareNezebFeat(actor, greatFeat) {
   const data = actor.getFlag(MODULE_ID, "hadaganian.nezebsPath") ?? {}
   if (declaredEffect(actor)) {
      return warn("A Great Feat is already declared. Fulfill or clear it first.")
   }
   if (fulfilledEffect(actor, greatFeat)) {
      return warn(`${GREAT_FEAT_LABELS[greatFeat]} cannot be chosen again yet.`)
   }

   await createOrRefreshEffect(actor, declaredEffectSource(greatFeat), {
      slugs: ["effect-nezebs-feat-declared"],
   })
   await actor.setFlag(MODULE_ID, "hadaganian.nezebsPath", {
      ...data,
      current: greatFeat,
   })
   await chat(actor, `<p><strong>Nezeb's Path</strong>: declared ${GREAT_FEAT_LABELS[greatFeat]}.</p>`)
   return greatFeat
}

async function fulfillNezebFeat(actor) {
   const data = actor.getFlag(MODULE_ID, "hadaganian.nezebsPath") ?? {}
   const activeDeclared = declaredEffect(actor)
   const greatFeat =
      activeDeclared?.getFlag?.(MODULE_ID, "nezebsPath.current") ?? null
   if (!greatFeat) return warn("Declare a Great Feat before fulfilling it.")

   const spells = unlockedFatherPrideSpells(actor, greatFeat)
   const fatherPride = await createOrRefreshEffect(
      actor,
      fathersPrideEffectSource(greatFeat, spells),
      { slugs: ["effect-fathers-pride"] },
   )
   await createOrRefreshEffect(actor, fulfilledEffectSource(greatFeat), {
      slugs: [fulfilledSlug(greatFeat)],
   })
   await deleteEffectsBySlugs(actor, ["effect-nezebs-feat-declared"])

   await actor.setFlag(MODULE_ID, "hadaganian.nezebsPath", {
      ...data,
      current: null,
   })
   await chat(
      actor,
      `<p><strong>Father's Pride</strong>: choose one available divine innate spell.</p><p>${spells.map((spell) => spell.name).join(", ")}</p>`,
   )
   const grant = await chooseFatherPrideSpell(actor, greatFeat, spells)
   return grant ?? fatherPride
}

async function clearCurrentFeat(actor, { notify = true } = {}) {
   await deleteEffectsBySlugs(actor, [
      "effect-nezebs-feat-declared",
      "effect-fathers-pride",
   ])
   await deleteHadaganianInnateEntry(actor, {
      entryFlag: FATHERS_PRIDE_ENTRY_FLAG,
      spellFlag: FATHERS_PRIDE_SPELL_FLAG,
   })
   await actor.unsetFlag(MODULE_ID, "hadaganian.nezebsPath").catch(() => null)
   if (notify) info("Current Nezeb's Path feat cleared.")
   return null
}

function isFathersPrideEffect(item) {
   if (item?.type !== "effect") return false
   const slug = String(item.system?.slug ?? item.slug ?? item.name ?? "")
      .trim()
      .toLowerCase()
      .replace(/^effect:\s*/i, "")
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
   return slug === "effect-fathers-pride" || slug === "fathers-pride"
}

function effectIsExpired(item) {
   return Boolean(
      item?.isExpired ||
         item?.system?.expired ||
         item?.system?.duration?.expired ||
         item?.system?.duration?.remaining === 0,
   )
}

export async function clearNezebPathOnFathersPrideExpired(item) {
   if (!isFathersPrideEffect(item)) return
   const actor = item.actor
   if (!actor) return
   await clearCurrentFeat(actor, { notify: false })
}

export async function clearNezebPathOnFathersPrideUpdate(item) {
   if (!isFathersPrideEffect(item) || !effectIsExpired(item)) return
   await clearNezebPathOnFathersPrideExpired(item)
}

async function promptNezebAction() {
   return promptForm({
      title: "Nezeb's Path",
      content: `
         <form class="standard-form">
            <div class="form-group">
               <label>Action</label>
               <div class="form-fields">
                  <select name="action">
                     <option value="declare">Declare Great Feat</option>
                     <option value="fulfill">Fulfill Current Feat</option>
                     <option value="clear">Clear Current Feat</option>
                  </select>
               </div>
            </div>
         </form>
      `,
      submit: "Continue",
   })
}

async function promptGreatFeat() {
   return promptForm({
      title: "Declare Great Feat",
      content: `
         <form class="standard-form">
            <div class="form-group">
               <label>Great Feat</label>
               <div class="form-fields">
                  <select name="greatFeat">
                     ${Object.entries(GREAT_FEAT_LABELS).map(([slug, label]) => `<option value="${slug}">${label}</option>`).join("")}
                  </select>
               </div>
            </div>
         </form>
      `,
      submit: "Declare",
   })
}

export async function nezebsPath({ actor } = {}) {
   const resolved = ownedOrControlledActor(actor)
   if (!resolved) return null
   const result = await promptNezebAction()
   if (!result) return null
   const action = String(result.read("action") ?? "declare")
   if (action === "fulfill") return fulfillNezebFeat(resolved)
   if (action === "clear") return clearCurrentFeat(resolved)

   const featResult = await promptGreatFeat()
   if (!featResult) return null
   const greatFeat = String(featResult.read("greatFeat") ?? "first")
   return declareNezebFeat(resolved, greatFeat)
}
