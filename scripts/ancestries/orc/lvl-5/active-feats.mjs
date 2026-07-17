import {
   MODULE_ID,
   actorHasSlug,
   actorLevel,
   chat,
   compendiumItemBySlug,
   createOrRefreshEffect,
   effectSource,
   esc,
   oneMinuteDuration,
   oneRoundDuration,
   ownedOrControlledActor,
   promptForm,
   spendAbilityCharge,
   targetActors,
   warn,
} from "../../hadaganian/helpers.mjs"
import {
   createOrRefreshEffectAsGM,
   increaseConditionAsGM,
   updateActorItemAsGM,
} from "../../socket.mjs"
import { warnMissingSpiritVessel } from "../spirit-vessel.mjs"

const DC_BY_LEVEL = new Map([
   [-1, 13],
   [0, 14],
   [1, 15],
   [2, 16],
   [3, 18],
   [4, 19],
   [5, 20],
   [6, 22],
   [7, 23],
   [8, 24],
   [9, 26],
   [10, 27],
   [11, 28],
   [12, 30],
   [13, 31],
   [14, 32],
   [15, 34],
   [16, 35],
   [17, 36],
   [18, 38],
   [19, 39],
   [20, 40],
   [21, 42],
   [22, 44],
   [23, 46],
   [24, 48],
   [25, 50],
])

const SPIRIT_WEAPON_RUNES = [
   "fearsome",
   "ghost-touch",
   "returning",
   "shifting",
   "vitalizing",
]

const SPIRIT_ARMOR_RUNES = [
   "slick",
   "shadow",
   "stanching",
   "swallow-spike",
   "dread",
   "quenching",
]

const INTIMIDATING_ENCOURAGEMENT_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/orc/Rage.(UITexture).png"
const HUNTERS_DEFENSE_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/orc/StoneSkin.(UITexture).png"
const ANCHOR_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/orc/DruidEntanglingRoots.(UITexture).png"
const BLOOD_FRENZY_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/orc/BuffMartyr01.(UITexture).png"
const VICTORIOUS_VIGOR_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/orc/FightingFury.(UITexture).png"
const ABSORB_STRENGTH_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/orc/NecromancerLifetapUpgrade.(UITexture).png"
const DEFLECTING_SPIRIT_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/orc/NecromancerGhostlyVeil.(UITexture).png"
const FLEET_SPIRIT_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/orc/RapidSpurt.(UITexture).png"
const RETRIBUTORS_EDGE_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/orc/PaladinHolyStrike.(UITexture).png"

function messageContext(message) {
   return message?.flags?.pf2e?.context ?? {}
}

function messageOptions(message) {
   const roll = message?.rolls?.[0]
   return [
      ...(Array.isArray(messageContext(message).options)
         ? messageContext(message).options
         : []),
      ...(Array.isArray(roll?.options) ? roll.options : []),
   ].map((option) => String(option ?? ""))
}

function messageDegree(message) {
   const outcome = messageContext(message).outcome
   const degree = degreeFromOutcome(outcome)
   if (degree !== null) return degree
   const value = Number(
      message?.rolls?.[0]?.options?.degreeOfSuccess ??
         messageContext(message).degreeOfSuccess,
   )
   return Number.isFinite(value) ? value : null
}

async function actorFromUuid(uuid) {
   if (!uuid) return null
   if (uuid.documentName === "Actor") return uuid
   if (uuid.actor?.documentName === "Actor") return uuid.actor
   if (typeof uuid !== "string") return null
   let document = null
   try {
      document = globalThis.fromUuidSync?.(uuid) ?? null
   } catch (_error) {}
   document ??= await fromUuid(uuid).catch(() => null)
   return document?.actor ?? document ?? null
}

async function actorFromMessage(message) {
   return (
      (await actorFromUuid(messageContext(message).actor)) ??
      game.actors?.get(message?.speaker?.actor) ??
      null
   )
}

async function targetActorFromMessage(message) {
   const context = messageContext(message)
   const candidates = [
      context.target?.actor,
      context.target?.token,
      context.target?.uuid,
      context.target,
      context.targets?.[0]?.actor,
      context.targets?.[0]?.token,
      context.targets?.[0]?.uuid,
   ].filter(Boolean)
   for (const candidate of candidates) {
      const actor = await actorFromUuid(candidate)
      if (actor?.documentName === "Actor") return actor
   }
   return null
}

function levelBasedDC(actor) {
   const level = Math.max(-1, Math.min(25, Math.trunc(actorLevel(actor))))
   const dc = DC_BY_LEVEL.get(level) ?? 14
   const pwol = Boolean(game.pf2e?.settings?.variants?.pwol?.enabled)
   return pwol ? dc - Math.max(level, 0) : dc
}

function validateActor(actor, featSlugs, label) {
   const resolved = ownedOrControlledActor(actor, "Orc")
   if (!resolved) return null
   if (!actorHasSlug(resolved, featSlugs)) {
      warn(`${label} feat not found.`)
      return null
   }
   return resolved
}

function shouldRunForActor(actor) {
   const activeGM = game.users?.some?.((user) => user.active && user.isGM)
   if (activeGM) return Boolean(game.user?.isGM)
   return Boolean(actor?.isOwner || actor?.testUserPermission?.(game.user, "OWNER"))
}

function degreeFromOutcome(outcome) {
   const value =
      outcome?.degreeOfSuccess?.value ??
      outcome?.degreeOfSuccess ??
      outcome?.dos ??
      outcome?.outcome ??
      outcome
   const numeric = Number(value)
   if (Number.isFinite(numeric)) return Math.max(0, Math.min(3, numeric))
   if (value === "criticalFailure" || value === "critical-failure") return 0
   if (value === "failure") return 1
   if (value === "success") return 2
   if (value === "criticalSuccess" || value === "critical-success") return 3
   return null
}

async function rollStatistic(
   actor,
   statistic,
   { dc, label, options = [], modifiers = [] } = {},
) {
   const stat = actor.getStatistic?.(statistic) ?? actor.skills?.[statistic]
   if (typeof stat?.roll !== "function") {
      warn(`${actor.name} does not have ${statistic}.`)
      return { message: null, degree: null }
   }

   let callbackOutcome = null
   const message = await stat.roll({
      dc: Number.isFinite(dc) ? { value: dc } : undefined,
      label,
      title: label,
      extraRollOptions: options,
      modifiers,
      callback: (_roll, outcome) => {
         callbackOutcome = outcome
      },
   })
   return { message, degree: degreeFromOutcome(callbackOutcome) }
}

function oneTarget(label) {
   const targets = targetActors()
   if (targets.length !== 1) return warn(`Target one actor for ${label}.`)
   return targets[0]
}

function optionTags(options) {
   return options
      .map(
         ({ value, label }) =>
            `<option value="${esc(value)}">${esc(label)}</option>`,
      )
      .join("")
}

function inventoryOptions(actor, types) {
   return (
      actor.items
         ?.filter?.((item) => types.includes(item.type))
         .map((item) => ({
            value: item.id,
            label: item.name,
         }))
         .sort((a, b) => a.label.localeCompare(b.label)) ?? []
   )
}

function allInventoryOptions(actor) {
   return (
      actor.items
         ?.filter?.((item) =>
            ["armor", "backpack", "consumable", "equipment", "shield", "treasure", "weapon"].includes(
               item.type,
            ),
         )
         .map((item) => ({
            value: item.id,
            label: item.name,
            type: item.type,
            primary: ["armor", "weapon"].includes(item.type),
         }))
         .sort((a, b) => {
            if (a.primary !== b.primary) return a.primary ? -1 : 1
            return a.label.localeCompare(b.label)
         }) ?? []
   )
}

function itemKind(item) {
   if (item?.type === "weapon") return "weapon"
   if (item?.type === "armor" || item?.type === "shield") return "armor"
   return "instrument"
}

function titleCaseSlug(slug) {
   return String(slug ?? "")
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
}

function spiritImbuingItemOptions(actor) {
   return allInventoryOptions(actor)
      .map(
         ({ value, label, type, primary }) =>
            `<option value="${esc(value)}" data-kind="${esc(type)}" ${primary ? "" : 'data-extra="true"'}>${esc(label)}${primary ? "" : ` (${esc(type)})`}</option>`,
      )
      .join("")
}

function spiritImbuingRuneOptions() {
   const weaponRunes = SPIRIT_WEAPON_RUNES.map(
      (rune) =>
         `<option value="${esc(rune)}" data-kind="weapon">${esc(titleCaseSlug(rune))}</option>`,
   ).join("")
   const armorRunes = SPIRIT_ARMOR_RUNES.map(
      (rune) =>
         `<option value="${esc(rune)}" data-kind="armor">${esc(titleCaseSlug(rune))}</option>`,
   ).join("")
   return `
      <option value="">No rune</option>
      <optgroup label="Weapon runes">${weaponRunes}</optgroup>
      <optgroup label="Armor runes">${armorRunes}</optgroup>
   `
}

async function getOrCreateSpiritImbuingEntry(actor) {
   const existing = actor.itemTypes?.spellcastingEntry?.find?.(
      (item) => item.getFlag?.(MODULE_ID, "orcSpiritImbuingEntry") === true,
   )
   if (existing) return existing
   const [entry] = await actor.createEmbeddedDocuments("Item", [
      {
         name: "Orc Spirit Imbuing Ritual",
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
               orcSpiritImbuingEntry: true,
            },
         },
      },
   ])
   return entry ?? null
}

async function grantSpiritImbuingSpell(actor, uuid) {
   const document = uuid ? await fromUuid(uuid).catch(() => null) : null
   if (!document || document.type !== "spell") return warn("Choose a spell UUID.")
   const entry = await getOrCreateSpiritImbuingEntry(actor)
   if (!entry) return warn("Could not create Orc Spirit Imbuing spell entry.")
   const source = document.toObject()
   delete source._id
   foundry.utils.setProperty(source, "system.location.value", entry.id)
   foundry.utils.setProperty(source, "system.location.heightenedLevel", 2)
   foundry.utils.setProperty(source, "system.location.uses", {
      value: 1,
      max: 1,
      per: "day",
   })
   foundry.utils.setProperty(source, `flags.${MODULE_ID}.orcSpiritImbuingSpell`, true)
   const [spell] = await actor.createEmbeddedDocuments("Item", [source])
   return spell ?? null
}

function heldWeaponOptions(actor) {
   return (
      actor.itemTypes?.weapon
         ?.filter?.((item) => {
            const equipped = item.system?.equipped ?? {}
            return (
               equipped.carryType === "held" ||
               Number(equipped.handsHeld ?? 0) > 0
            )
         })
         .map((item) => ({
            value: item.id,
            label: item.name,
         }))
         .sort((a, b) => a.label.localeCompare(b.label)) ?? []
   )
}

function effectOptions(actor) {
   return (
      actor.items
         ?.filter?.((item) => ["condition", "effect"].includes(item.type))
         .map((item) => ({
            value: item.id,
            label: item.name,
         }))
         .sort((a, b) => a.label.localeCompare(b.label)) ?? []
   )
}

async function applyFrightened(actor, value) {
   return increaseConditionAsGM(actor, "frightened", value)
}

function clonedRules(item) {
   return foundry.utils.deepClone(item?.system?.rules ?? [])
}

async function suppressItemRules(actor, item) {
   if (!actor || !item) return false
   const existing = item.getFlag?.(MODULE_ID, "orcIntimidatingEncouragement")
   const originalRules = existing?.originalRules ?? clonedRules(item)
   return updateActorItemAsGM(actor, item.id, {
      "system.rules": [],
      [`flags.${MODULE_ID}.orcIntimidatingEncouragement`]: {
         originalRules,
      },
   })
}

function isExpiredEffect(item) {
   return Boolean(
      item?.isExpired ||
         item?.system?.expired ||
         Number(item?.system?.duration?.remaining) === 0,
   )
}

export async function restoreIntimidatingEncouragementSuppression(
   item,
   { force = false } = {},
) {
   if (!item?.actor || !item.getFlag?.(MODULE_ID, "intimidatingEncouragement")) {
      return false
   }
   if (!force && !isExpiredEffect(item)) return false
   const effectId = item.getFlag(MODULE_ID, "suppressedEffectId")
   const suppressed = effectId ? item.actor.items?.get?.(effectId) : null
   const data = suppressed?.getFlag?.(
      MODULE_ID,
      "orcIntimidatingEncouragement",
   )
   if (!suppressed || !Array.isArray(data?.originalRules)) return false
   await updateActorItemAsGM(item.actor, suppressed.id, {
      "system.rules": data.originalRules,
      [`flags.${MODULE_ID}.-=orcIntimidatingEncouragement`]: null,
   })
   return true
}

export async function restoreRetributorsEdgeRune(
   item,
   { force = false } = {},
) {
   if (!item?.actor || !item.getFlag?.(MODULE_ID, "retributorsEdge")) {
      return false
   }
   if (!force && !isExpiredEffect(item)) return false
   const weaponId = item.getFlag(MODULE_ID, "weapon")
   const hadFlaming = item.getFlag(MODULE_ID, "hadFlaming") === true
   const weapon = weaponId ? item.actor.items?.get?.(weaponId) : null
   if (!weapon || hadFlaming) return false
   const property = Array.from(weapon.system?.runes?.property ?? [])
   await updateActorItemAsGM(item.actor, weapon.id, {
      "system.runes.property": property.filter((rune) => rune !== "flaming"),
   })
   return true
}

function isDemoralizeFailure(message) {
   if (
      !messageOptions(message).some(
         (option) =>
            option === "action:demoralize" ||
            option.startsWith("action:demoralize:"),
      )
   ) {
      return false
   }
   const degree = messageDegree(message)
   return degree === 0 || degree === 1
}

function ownerWhispers(actor) {
   const owners =
      game.users?.filter?.(
         (user) =>
            !user.isGM &&
            user.active &&
            actor.testUserPermission?.(user, "OWNER"),
      ) ?? []
   return (owners.length ? owners : game.users?.filter?.((user) => user.isGM) ?? [])
      .filter((user) => user.active)
      .map((user) => user.id)
}

function willDC(actor) {
   return Number(
      actor?.getStatistic?.("will")?.dc?.value ??
         actor?.saves?.will?.dc?.value ??
         actor?.system?.saves?.will?.dc?.value,
   )
}

function circumstanceModifier({ slug, label, value }) {
   const Modifier = game.pf2e?.Modifier
   return Modifier
      ? new Modifier({ slug, label, modifier: value, type: "circumstance" })
      : { slug, label, modifier: value, type: "circumstance" }
}

export async function handleThatsHowYouRoarDemoralizeFailure(message) {
   if (!isDemoralizeFailure(message)) return
   const target = await targetActorFromMessage(message)
   if (!target || !actorHasSlug(target, ["thats-how-you-roar"])) return
   if (!shouldRunForActor(target)) return
   const source = await actorFromMessage(message)
   const degree = messageDegree(message)
   const whisper = ownerWhispers(target)
   if (!whisper.length) return

   await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: target }),
      whisper,
      content: `
         <p><strong>That's How You Roar!</strong></p>
         <p>${esc(source?.name ?? "The enemy")} failed to Demoralize you. You can Demoralize them back as a reaction${degree === 0 ? " with a +1 circumstance bonus" : ""}.</p>
         <div class="flexrow" style="gap:0.35rem">
            <button type="button" data-ssc-orc-roar-action="demoralise" data-actor-uuid="${esc(target.uuid)}" data-source-uuid="${esc(source?.uuid ?? "")}" data-bonus="${degree === 0 ? 1 : 0}">
               <i class="fa-solid fa-face-angry"></i> Demoralise
            </button>
            <button type="button" data-ssc-orc-roar-action="cancel">
               <i class="fa-solid fa-xmark"></i> Cancel
            </button>
         </div>
      `,
   })
}

export async function handleThatsHowYouRoarPromptButton(event) {
   const button = event.target?.closest?.("[data-ssc-orc-roar-action]")
   if (!button) return
   const messageElement = button.closest?.(".chat-message")
   const message = game.messages?.get?.(messageElement?.dataset?.messageId)
   const action = button.dataset.sscOrcRoarAction
   event.preventDefault()
   event.stopPropagation()
   if (action === "cancel") {
      await message?.delete?.()
      return
   }
   if (action !== "demoralise") return
   const actor = await actorFromUuid(button.dataset.actorUuid)
   const source = await actorFromUuid(button.dataset.sourceUuid)
   if (!actor || !source) return warn("Demoralize target could not be resolved.")
   const dc = willDC(source)
   if (!Number.isFinite(dc) || dc <= 0) return warn("Target Will DC could not be read.")
   const bonus = Number(button.dataset.bonus) || 0
   await rollStatistic(actor, "intimidation", {
      dc,
      label: "Demoralize",
      options: [
         "action:demoralize",
         "item:trait:auditory",
         "item:trait:concentrate",
         "item:trait:emotion",
         "item:trait:fear",
         "item:trait:mental",
      ],
      modifiers:
         bonus > 0
            ? [
                 circumstanceModifier({
                    slug: "thats-how-you-roar",
                    label: "That's How You Roar!",
                    value: bonus,
                 }),
              ]
            : [],
   })
   await message?.delete?.()
}

export async function intimidatingEncouragement({ actor } = {}) {
   const resolved = validateActor(
      actor,
      ["intimidating-encouragement"],
      "Intimidating Encouragement",
   )
   if (!resolved) return null
   const target = oneTarget("Intimidating Encouragement")
   if (!target) return null

   const effects = effectOptions(target)
   if (!effects.length) return warn("Target has no effect to suppress.")
   const result = await promptForm({
      title: "Intimidating Encouragement",
      content: `
         <form class="standard-form">
            <div class="form-group"><label>Effect</label><div class="form-fields"><select name="effect">${optionTags(effects)}</select></div></div>
            <div class="form-group"><label>Counteract DC</label><div class="form-fields"><input type="number" name="dc" min="1" step="1" required></div></div>
         </form>
      `,
      submit: "Roll",
   })
   if (!result) return null
   const effectId = String(result.read("effect") ?? "")
   const dc = Number(result.read("dc"))
   if (!Number.isFinite(dc) || dc <= 0) return warn("Counteract DC is required.")
   const chosen = target.items?.get?.(effectId)
   if (!chosen) return warn("Choose an effect.")
   const label = chosen?.name ?? "chosen effect"

   const roll = await rollStatistic(resolved, "intimidation", {
      dc,
      label: "Intimidating Encouragement",
      options: [
         "action:intimidating-encouragement",
         "item:trait:auditory",
         "item:trait:emotion",
         "item:trait:mental",
         "item:trait:orc",
      ],
   })
   if (!roll.message || roll.degree === null) return roll.message

   if (roll.degree >= 2) {
      const critical = roll.degree === 3
      await suppressItemRules(target, chosen)
      return createOrRefreshEffectAsGM(
         target,
         effectSource({
            name: `Effect: Intimidating Encouragement (${label})`,
            img: INTIMIDATING_ENCOURAGEMENT_ICON,
            slug: `effect-intimidating-encouragement-${effectId || "effect"}`,
            duration: critical
               ? oneMinuteDuration()
               : { value: 2, unit: "rounds", expiry: "turn-start" },
            description: `${esc(label)} is suppressed by Intimidating Encouragement.`,
            flags: {
               orc: true,
               intimidatingEncouragement: true,
               suppressedEffectId: chosen.id,
            },
         }),
         { slugs: [`effect-intimidating-encouragement-${effectId || "effect"}`] },
      )
   }

   await applyFrightened(target, roll.degree === 0 ? 2 : 1)
   return roll.message
}

export async function spiritImbuingRitual({ actor } = {}) {
   const resolved = validateActor(
      actor,
      ["spirit-imbuing-ritual"],
      "Spirit Imbuing Ritual",
   )
   if (!resolved) return null

   const itemOptions = spiritImbuingItemOptions(resolved)
   if (!itemOptions) return warn("No inventory item found.")
   const result = await promptForm({
      title: "Spirit Imbuing Ritual",
      content: `
         <form class="standard-form">
            <style>
               .ssc-orc-spirit-imbuing [data-extra="true"] { display: none; }
               .ssc-orc-spirit-imbuing:has(input[name="showAll"]:checked) [data-extra="true"] { display: initial; }
            </style>
            <div class="form-group ssc-orc-spirit-imbuing">
               <label>Item</label>
               <div class="form-fields">
                  <select name="item">${itemOptions}</select>
                  <label class="checkbox" style="white-space:nowrap"><input type="checkbox" name="showAll"> Show all inventory</label>
               </div>
            </div>
            <div class="form-group"><label>Rune</label><div class="form-fields"><select name="rune">
               ${spiritImbuingRuneOptions()}
            </select></div></div>
            <div class="form-group"><label>DC</label><div class="form-fields"><input type="number" name="dc" min="1" step="1" value="${levelBasedDC(resolved)}"></div></div>
         </form>
      `,
      submit: "Roll",
      width: 480,
   })
   if (!result) return null

   const dc = Number(result.read("dc"))
   const item = resolved.items?.get?.(String(result.read("item") ?? ""))
   const kind = itemKind(item)
   const rune = String(result.read("rune") ?? "")
   if (!item) return warn("Choose an item.")
   if (!Number.isFinite(dc) || dc <= 0) return warn("DC is required.")

   const roll = await rollStatistic(resolved, "occultism", {
      dc,
      label: "Spirit Imbuing Ritual",
      options: [
         "action:spirit-imbuing-ritual",
         "item:trait:concentrate",
         "item:trait:exploration",
         "item:trait:orc",
      ],
   })
   if (!roll.message || roll.degree === null) return roll.message

   if (roll.degree === 0) {
      await chat(
         resolved,
         `<p><strong>Spirit Imbuing Ritual</strong>: critical failure. Apply a random curse manually.</p>`,
      )
      return roll.message
   }
   if (roll.degree < 2) return roll.message

   if (kind === "instrument") {
      const spellResult = await promptForm({
         title: "Spirit Imbuing Ritual",
         content: `
            <form class="standard-form">
               <div class="form-group"><label>Spell UUID</label><div class="form-fields"><input type="text" name="uuid" placeholder="Compendium.pf2e.spells-srd.Item..."></div></div>
            </form>
         `,
         submit: "Grant Spell",
      })
      if (spellResult) {
         await grantSpiritImbuingSpell(
            resolved,
            String(spellResult.read("uuid") ?? "").trim(),
         )
      }
      return roll.message
   }

   const allowed = kind === "armor" ? SPIRIT_ARMOR_RUNES : SPIRIT_WEAPON_RUNES
   if (!allowed.includes(rune)) return warn("Choose a valid rune for the item kind.")
   const current = Array.from(item.system?.runes?.property ?? [])
   if (!current.includes(rune)) {
      await item.update({ "system.runes.property": [...current, rune] })
   }
   await chat(
      resolved,
      `<p><strong>Spirit Imbuing Ritual</strong>: ${esc(item.name)} gains ${esc(rune)} until your next daily preparations.</p>`,
   )
   return roll.message
}

export async function hunterDefense({ actor } = {}) {
   const resolved = validateActor(actor, ["hunters-defense"], "Hunter's Defense")
   if (!resolved) return null

   const natureDC = Number(resolved.getStatistic?.("nature")?.dc?.value)
   const ac = Number(resolved.system?.attributes?.ac?.value)
   if (!Number.isFinite(natureDC) || !Number.isFinite(ac)) {
      return warn("Nature DC or AC could not be read.")
   }
   if (!(await spendAbilityCharge(resolved, ["hunters-defense"], "Hunter's Defense"))) {
      return null
   }
   const bonus = Math.max(0, natureDC - ac)
   return createOrRefreshEffect(
      resolved,
      effectSource({
         name: "Effect: Hunter's Defense",
         img: HUNTERS_DEFENSE_ICON,
         slug: "effect-hunters-defense",
         duration: oneRoundDuration(),
         description: `The triggering attack targets Nature DC ${natureDC}. Remove this effect after resolving that attack.`,
         rules: [
            {
               key: "FlatModifier",
               selector: "ac",
               type: "untyped",
               value: bonus,
               label: "Hunter's Defense",
            },
         ],
         flags: { orc: true, huntersDefense: true },
      }),
      { slugs: ["effect-hunters-defense"] },
   )
}

export async function naturesAnchor({ actor } = {}) {
   const resolved = validateActor(actor, ["natures-anchor"], "Nature's Anchor")
   if (!resolved) return null
   return createOrRefreshEffect(
      resolved,
      effectSource({
         name: "Effect: Nature's Anchor",
         img: ANCHOR_ICON,
         slug: "effect-natures-anchor",
         duration: { value: -1, unit: "unlimited" },
         description:
            "Until you move, you gain a +4 circumstance bonus to your Fortitude or Reflex DC against attempts to Reposition, Shove, or Trip you. This bonus also applies to saving throws against spells or effects that attempt to move you or knock you prone. If an effect forces you to move, you move only half the normal distance, as some of the effort goes to tearing loose the roots.",
         rules: [
            {
               key: "FlatModifier",
               selector: ["fortitude-dc", "reflex-dc"],
               type: "circumstance",
               value: 4,
               label: "Nature's Anchor",
            },
            {
               key: "FlatModifier",
               selector: ["fortitude", "reflex"],
               type: "circumstance",
               value: 4,
               label: "Nature's Anchor",
               predicate: [
                  {
                     or: ["inflicts:prone", "inflicts:forced-movement"],
                  },
               ],
            },
         ],
         flags: { orc: true, naturesAnchor: true },
      }),
      { slugs: ["effect-natures-anchor"] },
   )
}

export async function bloodFrenzy({ actor } = {}) {
   const resolved = validateActor(actor, ["blood-frenzy"], "Blood Frenzy")
   if (!resolved) return null
   if (!(await spendAbilityCharge(resolved, ["blood-frenzy"], "Blood Frenzy"))) {
      return null
   }
   const quickened = await compendiumItemBySlug("quickened", {
      packs: ["pf2e.conditionitems"],
      type: "condition",
   })
   return createOrRefreshEffect(
      resolved,
      effectSource({
         name: "Effect: Blood Frenzy",
         img: BLOOD_FRENZY_ICON,
         slug: "effect-blood-frenzy",
         duration: oneRoundDuration(),
         description:
            "Quickened until the end of your next turn. The extra action can be used only for a tusks/jaws Strike, an Athletics check with the attack trait, or Stride.",
         rules: quickened
            ? [
                 {
                    key: "GrantItem",
                    uuid: quickened.uuid,
                  },
              ]
            : [],
         flags: { orc: true, bloodFrenzy: true },
      }),
      { slugs: ["effect-blood-frenzy"] },
   )
}

export async function victoriousVigor({ actor } = {}) {
   const resolved = validateActor(actor, ["victorious-vigor"], "Victorious Vigor")
   if (!resolved) return null
   return createOrRefreshEffect(
      resolved,
      effectSource({
         name: "Effect: Victorious Vigor",
         img: VICTORIOUS_VIGOR_ICON,
         slug: "effect-victorious-vigor",
         duration: oneMinuteDuration(),
         description: "Temporary Hit Points from Victorious Vigor.",
         rules: [
            {
               key: "TempHP",
               value: "@actor.level",
            },
         ],
         flags: { orc: true, victoriousVigor: true },
      }),
      { slugs: ["effect-victorious-vigor"] },
   )
}

export async function infusedVesselAbsorbStrength({ actor } = {}) {
   const resolved = validateActor(actor, ["infused-vessel"], "Infused Vessel")
   if (!resolved) return null
   if (warnMissingSpiritVessel(resolved, "absorb-strength")) return null
   const target = targetActors()[0] ?? null
   const result = await promptForm({
      title: "Absorb Strength",
      content: `
         <form class="standard-form">
            <div class="form-group"><label>Creature Level</label><div class="form-fields"><input type="number" name="level" min="-1" step="1" value="${actorLevel(target ?? resolved)}"></div></div>
         </form>
      `,
      submit: "Apply",
   })
   if (!result) return null
   const level = Math.max(1, Number(result.read("level")) || 1)
   if (
      !(await spendAbilityCharge(
         resolved,
         ["absorb-strength"],
         "Absorb Strength",
      ))
   ) {
      return null
   }
   return createOrRefreshEffect(
      resolved,
      effectSource({
         name: "Effect: Absorb Strength",
         img: ABSORB_STRENGTH_ICON,
         slug: "effect-absorb-strength",
         duration: oneMinuteDuration(),
         description: "Temporary Hit Points from Absorb Strength.",
         rules: [
            {
               key: "TempHP",
               value: level,
            },
         ],
         flags: { orc: true, absorbStrength: true },
      }),
      { slugs: ["effect-absorb-strength"] },
   )
}

export async function infusedVesselDeflectingSpirit({ actor } = {}) {
   const resolved = validateActor(actor, ["infused-vessel"], "Infused Vessel")
   if (!resolved) return null
   if (warnMissingSpiritVessel(resolved, "deflecting-spirit")) return null
   if (
      !(await spendAbilityCharge(
         resolved,
         ["deflecting-spirit"],
         "Deflecting Spirit",
      ))
   ) {
      return null
   }
   return createOrRefreshEffect(
      resolved,
      effectSource({
         name: "Effect: Deflecting Spirit",
         img: DEFLECTING_SPIRIT_ICON,
         slug: "effect-deflecting-spirit",
         duration: oneRoundDuration(),
         description: "+2 circumstance bonus to AC against the triggering ranged attack.",
         rules: [
            {
               key: "FlatModifier",
               selector: "ac",
               type: "circumstance",
               value: 2,
               label: "Deflecting Spirit",
            },
         ],
         flags: { orc: true, deflectingSpirit: true },
      }),
      { slugs: ["effect-deflecting-spirit"] },
   )
}

export async function infusedVesselFleetSpirit({ actor } = {}) {
   const resolved = validateActor(actor, ["infused-vessel"], "Infused Vessel")
   if (!resolved) return null
   if (warnMissingSpiritVessel(resolved, "fleet-spirit")) return null
   if (!(await spendAbilityCharge(resolved, ["fleet-spirit"], "Fleet Spirit"))) {
      return null
   }
   return createOrRefreshEffect(
      resolved,
      effectSource({
         name: "Effect: Fleet Spirit",
         img: FLEET_SPIRIT_ICON,
         slug: "effect-fleet-spirit",
         duration: oneMinuteDuration(),
         description: "Fleet step effect from Fleet Spirit.",
         rules: [
            {
               key: "FlatModifier",
               selector: "land-speed",
               type: "status",
               value: 30,
               label: "Fleet Spirit",
            },
         ],
         flags: { orc: true, fleetSpirit: true },
      }),
      { slugs: ["effect-fleet-spirit"] },
   )
}

export async function retributorsEdge({ actor } = {}) {
   const resolved = validateActor(actor, ["retributors-edge"], "Retributor's Edge")
   if (!resolved) return null

   const weapons = heldWeaponOptions(resolved)
   if (!weapons.length) return warn("No held weapon found.")
   const result = await promptForm({
      title: "Retributor's Edge",
      content: `
         <form class="standard-form">
            <div class="form-group"><label>Weapon</label><div class="form-fields"><select name="weapon">${optionTags(weapons)}</select></div></div>
         </form>
      `,
      submit: "Apply",
   })
   if (!result) return null
   const weapon = resolved.items?.get?.(String(result.read("weapon") ?? ""))
   if (!weapon) return warn("Choose a weapon.")
   if (
      !(await spendAbilityCharge(
         resolved,
         ["retributors-edge"],
         "Retributor's Edge",
      ))
   ) {
      return null
   }

   const property = Array.from(weapon.system?.runes?.property ?? [])
   const hadFlaming = property.includes("flaming")
   if (!hadFlaming) {
      await updateActorItemAsGM(resolved, weapon.id, {
         "system.runes.property": [...property, "flaming"],
      })
   }
   return createOrRefreshEffect(
      resolved,
      effectSource({
         name: `Effect: Retributor's Edge (${weapon.name})`,
         img: RETRIBUTORS_EDGE_ICON,
         slug: `effect-retributors-edge-${weapon.id}`,
         duration: oneMinuteDuration(),
         description: `${esc(weapon.name)} gains the flaming property rune from Retributor's Edge.`,
         rules: [],
         flags: {
            orc: true,
            retributorsEdge: true,
            weapon: weapon.id,
            hadFlaming,
         },
      }),
      { slugs: [`effect-retributors-edge-${weapon.id}`] },
   )
}
