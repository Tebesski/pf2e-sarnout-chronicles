import { MODULE_ID } from "../../templar/constants.mjs"
import {
   actorEffectBySlug,
   createOrRefreshEffect,
   deleteEffectsBySlugs,
} from "../../templar/effects.mjs"
import { actorHasSlug, actorLevel, slugify } from "../../templar/state.mjs"

export {
   actorEffectBySlug,
   actorHasSlug,
   actorLevel,
   createOrRefreshEffect,
   deleteEffectsBySlugs,
   MODULE_ID,
   slugify,
}

export function warn(message) {
   ui.notifications?.warn(message)
   return null
}

export function info(message) {
   ui.notifications?.info(message)
}

export function resolveActor(actor) {
   if (actor?.documentName === "Actor") return actor
   if (actor?.actor?.documentName === "Actor") return actor.actor
   return canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null
}

export function ownedOrControlledActor(actor, label = "Hadaganian") {
   const resolved = resolveActor(actor)
   if (!resolved) return warn(`Select a ${label} actor first.`)
   return resolved
}

export function canMutateActor(actor) {
   const activeGM = game.users?.some?.((user) => user.active && user.isGM)
   if (activeGM) return Boolean(game.user?.isGM)
   return Boolean(actor?.isOwner || actor?.testUserPermission?.(game.user, "OWNER"))
}

export function targetActors() {
   return Array.from(game.user?.targets ?? [])
      .map((token) => token.actor)
      .filter(Boolean)
}

export function actorToken(actor) {
   return (
      actor?.getActiveTokens?.()?.find?.((token) => token.scene === canvas?.scene) ??
      actor?.getActiveTokens?.()?.[0] ??
      null
   )
}

export function tokenDistance(first, second) {
   if (!first || !second) return Infinity
   if (typeof first.distanceTo === "function") return first.distanceTo(second)
   if (typeof canvas?.grid?.measurePath === "function") {
      const a = first.center ?? { x: first.x, y: first.y }
      const b = second.center ?? { x: second.x, y: second.y }
      return canvas.grid.measurePath([a, b])?.distance ?? Infinity
   }
   return Infinity
}

function itemMatchesSlug(item, slugs) {
   const wanted = new Set([slugs].flat().map(slugify))
   const slug = slugify(item?.slug ?? item?.system?.slug ?? item?.name)
   const cleanName = slugify(
      String(item?.name ?? "").replace(/^Effect:\s*/i, ""),
   )
   return wanted.has(slug) || wanted.has(cleanName)
}

export function abilityItem(actor, slugs) {
   const matches =
      actor?.items?.filter?.(
         (item) =>
            ["action", "feat"].includes(item.type) &&
            itemMatchesSlug(item, slugs),
      ) ?? []
   return (
      matches.find((item) => item.system?.frequency?.value !== undefined) ??
      matches.find((item) => item.type === "action") ??
      matches[0] ??
      null
   )
}

export function abilityChargeValue(actor, slugs) {
   const item = abilityItem(actor, slugs)
   if (!item) return { item: null, value: 0, hasFrequency: false }
   const frequency = item.system?.frequency
   if (!frequency || frequency.value === undefined) {
      return { item, value: 0, hasFrequency: false }
   }
   return {
      item,
      value: Number(frequency.value ?? 0),
      hasFrequency: true,
   }
}

export function hasAbilityCharge(actor, slugs) {
   const { value, hasFrequency } = abilityChargeValue(actor, slugs)
   return hasFrequency && Number.isFinite(value) && value > 0
}

export async function spendAbilityCharge(actor, slugs, label = "Ability") {
   const { item, value, hasFrequency } = abilityChargeValue(actor, slugs)
   if (!item) return warn(`${label} ability was not found.`)
   if (!hasFrequency) return warn(`${label} has no tracked uses.`)
   if (!Number.isFinite(value) || value <= 0) {
      return warn(`${label} has no uses remaining.`)
   }
   await item.update({ "system.frequency.value": Math.max(0, value - 1) })
   return true
}

export function esc(value) {
   const text = String(value ?? "")
   return (
      foundry.utils.escapeHTML?.(text) ??
      text.replace(/[&<>"']/g, (char) => {
         return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
         }[char]
      })
   )
}

function dialogField(event, button, form, name) {
   const selector = `[name='${name}']`
   const formElement =
      form instanceof HTMLFormElement
         ? form
         : button?.form ??
           event?.currentTarget?.form ??
           event?.target?.closest?.("form") ??
           event?.currentTarget?.closest?.("form") ??
           null
   const formData =
      formElement instanceof HTMLFormElement
         ? new foundry.applications.ux.FormDataExtended(formElement, {
              disabled: true,
              readonly: true,
           }).object
         : null
   if (formData && name in formData) return formData[name]
   const element =
      form?.querySelector?.(selector) ??
      formElement?.querySelector?.(selector) ??
      button?.form?.elements?.[name] ??
      event?.currentTarget?.form?.elements?.[name] ??
      event?.target?.closest?.("form")?.elements?.[name] ??
      event?.currentTarget?.closest?.("form")?.elements?.[name]
   if (element?.type === "checkbox") return element.checked
   if (element) return element.value
   if (typeof form?.get === "function") return form.get(name)
   if (form?.object && name in form.object) return form.object[name]
   if (form && name in form) return form[name]
   return undefined
}

export async function promptForm({
   title,
   content,
   width = 420,
   submit = "Use",
}) {
   const DialogV2 = foundry.applications.api.DialogV2
   if (!DialogV2?.wait) return warn("Foundry DialogV2 is unavailable.")
   return DialogV2.wait({
      window: { title },
      content,
      buttons: [
         {
            action: "submit",
            label: submit,
            callback: (event, button, form) => {
               const read = (name) => dialogField(event, button, form, name)
               return { read }
            },
         },
         {
            action: "cancel",
            label: "Cancel",
            callback: () => null,
         },
      ],
      default: "submit",
      position: { width },
   }).catch(() => null)
}

export function chat(actor, content) {
   return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
   })
}

export function optionTags(values) {
   return values
      .map((value) => `<option value="${esc(value)}">${esc(value)}</option>`)
      .join("")
}

export function skillOptionTags() {
   return Object.entries(CONFIG.PF2E?.skills ?? {})
      .map(([slug, label]) => ({
         slug,
         label:
            typeof label === "string"
               ? game.i18n?.localize?.(label) ?? label
               : game.i18n?.localize?.(label?.label ?? "") ??
                 label?.label ??
                 slug,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(
         ({ slug, label }) =>
            `<option value="${esc(slug)}">${esc(label)}</option>`,
      )
      .join("")
}

export function oneMinuteDuration() {
   return { value: 1, unit: "minutes", expiry: "turn-start" }
}

export function oneRoundDuration() {
   return { value: 1, unit: "rounds", expiry: "turn-start" }
}

export function effectSource({
   name,
   slug,
   img,
   duration,
   description = "",
   rules = [],
   flags = {},
}) {
   return {
      name,
      type: "effect",
      img: img || "systems/pf2e/icons/default-icons/effect.svg",
      system: {
         slug,
         duration,
         description: { value: description },
         rules,
      },
      flags: {
         [MODULE_ID]: {
            hadaganian: true,
            ...flags,
         },
      },
   }
}

export function totalFromMessage(message) {
   return Number(
      message?.rolls?.[0]?.total ?? message?.roll?.total ?? message?.total,
   )
}

export function perceptionDC(actor) {
   return Number(
      actor?.getStatistic?.("perception")?.dc?.value ??
         actor?.perception?.dc?.value ??
         actor?.system?.perception?.dc?.value,
   )
}

export function heroPointsPath(actor) {
   return [
      "system.resources.heroPoints.value",
      "system.heroPoints.value",
      "system.attributes.heroPoints.value",
   ].find((path) => Number.isFinite(Number(foundry.utils.getProperty(actor, path))))
}

export function heroPoints(actor) {
   const path = heroPointsPath(actor)
   return Number(path ? foundry.utils.getProperty(actor, path) : 0)
}

export async function setHeroPoints(actor, value) {
   const path = heroPointsPath(actor)
   if (!path) return false
   await actor.update({ [path]: Math.max(0, Number(value) || 0) })
   return true
}

export async function compendiumItemBySlug(
   slug,
   {
      packs = ["pf2e.spells-srd", "pf2e.spells"],
      type = null,
      name = null,
   } = {},
) {
   const wantedSlug = slugify(slug)
   const wantedName = slugify(name ?? slug)
   for (const packId of packs) {
      const pack = game.packs?.get?.(packId)
      if (!pack) continue
      const index = await pack.getIndex({
         fields: ["name", "type", "system.slug"],
      })
      const entry = index.find((candidate) => {
         if (type && candidate.type !== type) return false
         const candidateSlug = slugify(candidate.system?.slug ?? candidate.name)
         return candidateSlug === wantedSlug || candidateSlug === wantedName
      })
      if (!entry) continue
      return pack.getDocument(entry._id)
   }
   return null
}

export function conditionItem(actor, slug) {
   const wanted = slugify(slug)
   return actor.items?.find?.((item) => {
      if (!["condition", "effect"].includes(item.type)) return false
      return slugify(item.slug ?? item.system?.slug ?? item.name) === wanted
   })
}

export async function decrementCondition(actor, slug) {
   const item = conditionItem(actor, slug)
   if (!item) return false
   const value = Number(
      item.system?.value?.value ?? item.system?.badge?.value ?? 1,
   )
   if (Number.isFinite(value) && value > 1) {
      await item
         .update({
            "system.value.value": value - 1,
            "system.badge.value": value - 1,
         })
         .catch(() => null)
   } else {
      await item.delete().catch(() => null)
   }
   return true
}

async function getOrCreateHadaganianInnateEntry(
   actor,
   tradition = "arcane",
   {
      entryFlag = "hadaganianInnateEntry",
      entryName = "Hadaganian Innate Spells",
   } = {},
) {
   const existing = actor.itemTypes?.spellcastingEntry?.find?.(
      (item) => item.getFlag?.(MODULE_ID, entryFlag) === true,
   )
   if (existing) return existing

   const [entry] = await actor.createEmbeddedDocuments("Item", [
      {
         name: entryName,
         type: "spellcastingEntry",
         system: {
            ability: { value: "cha" },
            spelldc: { value: 0, dc: 0 },
            tradition: { value: tradition },
            prepared: { value: "innate" },
         },
         flags: {
            [MODULE_ID]: {
               [entryFlag]: true,
               hadaganian: true,
            },
         },
      },
   ])
   return entry ?? null
}

export async function grantInnateSpell(
   actor,
   {
      uuid,
      tradition = "arcane",
      rank = null,
      oncePerDay = false,
      entryFlag = "hadaganianInnateEntry",
      entryName = "Hadaganian Innate Spells",
      spellFlag = "hadaganianGrantedSpell",
      mutateSource = null,
   } = {},
) {
   if (!uuid) return warn("Spell UUID is required.")
   const document = await fromUuid(uuid).catch(() => null)
   if (!document) return warn(`Spell not found: ${uuid}`)
   if (document.type !== "spell") return warn("The UUID must point to a spell item.")

   const entry = await getOrCreateHadaganianInnateEntry(actor, tradition, {
      entryFlag,
      entryName,
   })
   if (!entry) return warn("Could not create Hadaganian innate spellcasting entry.")

   const source = document.toObject()
   delete source._id
   if (typeof mutateSource === "function") mutateSource(source)
   foundry.utils.setProperty(source, "system.location.value", entry.id)
   if (rank !== null && Number.isFinite(Number(rank))) {
      foundry.utils.setProperty(
         source,
         "system.location.heightenedLevel",
         Number(rank),
      )
   }
   if (oncePerDay) {
      foundry.utils.setProperty(source, "system.location.uses", {
         value: 1,
         max: 1,
         per: "day",
      })
   }
   foundry.utils.setProperty(
      source,
      `flags.${MODULE_ID}.${spellFlag}`,
      true,
   )

   const [spell] = await actor.createEmbeddedDocuments("Item", [source])
   if (spell) {
      await chat(
         actor,
         `<p><strong>${esc(spell.name)}</strong> was added to Hadaganian innate spells.</p>`,
      )
   }
   return spell ?? null
}

export async function deleteHadaganianInnateEntry(
   actor,
   {
      entryFlag = "hadaganianInnateEntry",
      spellFlag = "hadaganianGrantedSpell",
   } = {},
) {
   const ids =
      actor.items
         ?.filter?.((item) => {
            return (
               item.getFlag?.(MODULE_ID, entryFlag) === true ||
               item.getFlag?.(MODULE_ID, spellFlag) === true
            )
         })
         .map((item) => item.id) ?? []
   if (ids.length > 0) await actor.deleteEmbeddedDocuments("Item", ids)
   return ids
}

export async function promptSpellGrant(
   actor,
   {
      title,
      cantrip = false,
      oncePerDay = false,
      defaultTradition = "arcane",
      defaultRank = "",
   } = {},
) {
   const result = await promptForm({
      title,
      content: `
         <form class="standard-form">
            <div class="form-group"><label>Spell UUID</label><div class="form-fields"><input type="text" name="uuid" placeholder="Compendium.pf2e.spells-srd.Item..."></div></div>
            <div class="form-group"><label>Tradition</label><div class="form-fields"><select name="tradition">
               ${optionTags(["arcane", "divine", "occult", "primal"]).replace(
                  `value="${defaultTradition}"`,
                  `value="${defaultTradition}" selected`,
               )}
            </select></div></div>
            <div class="form-group"><label>Spell Rank</label><div class="form-fields"><input type="number" name="rank" min="0" max="10" value="${esc(defaultRank)}" placeholder="${cantrip ? "0" : "1"}"></div></div>
         </form>
      `,
      submit: "Grant Spell",
   })
   if (!result) return null
   const uuid = String(result.read("uuid") ?? "").trim()
   const tradition = String(result.read("tradition") ?? defaultTradition)
   const rankValue = String(result.read("rank") ?? "").trim()
   const rank = rankValue === "" ? (cantrip ? 0 : null) : Number(rankValue)
   return grantInnateSpell(actor, { uuid, tradition, rank, oncePerDay })
}
