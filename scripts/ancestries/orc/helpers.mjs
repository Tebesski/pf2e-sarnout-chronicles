import {
   MODULE_ID,
   actorHasSlug,
   actorLevel,
   compendiumItemBySlug,
   effectSource,
   esc,
   ownedOrControlledActor,
   promptForm,
   targetActors,
   warn,
} from "../hadaganian/helpers.mjs"

export { MODULE_ID, actorHasSlug, actorLevel, effectSource, esc, promptForm, warn }

export function validateOrcActor(actor, featSlugs, label) {
   const resolved = ownedOrControlledActor(actor, "Orc")
   if (!resolved) return null
   if (!actorHasSlug(resolved, featSlugs)) {
      warn(`${label} feat not found.`)
      return null
   }
   return resolved
}

export function oneTarget(label) {
   const targets = targetActors()
   if (targets.length !== 1) return warn(`Target one actor for ${label}.`)
   return targets[0]
}

export function optionTags(options) {
   return options
      .map(
         ({ value, label }) =>
            `<option value="${esc(value)}">${esc(label)}</option>`,
      )
      .join("")
}

export function conditionValue(actor, slug) {
   const condition = actor?.items?.find?.((item) => item.slug === slug)
   return Math.max(
      0,
      Number(
         condition?.system?.value?.value ??
            condition?.system?.badge?.value ??
            0,
      ) || 0,
   )
}

export function activeGMOrOwner(actor) {
   const activeGM = game.users?.some?.((user) => user.active && user.isGM)
   if (activeGM) return Boolean(game.user?.isGM)
   return Boolean(actor?.isOwner || actor?.testUserPermission?.(game.user, "OWNER"))
}

export function ownerWhispers(actor) {
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

export function messageContext(message) {
   return message?.flags?.pf2e?.context ?? {}
}

export function messageOptions(message) {
   const roll = message?.rolls?.[0]
   return [
      ...(Array.isArray(messageContext(message).options)
         ? messageContext(message).options
         : []),
      ...(Array.isArray(roll?.options) ? roll.options : []),
   ].map((option) => String(option ?? ""))
}

export function messageDegree(message) {
   const context = messageContext(message)
   const outcome = context.outcome
   if (outcome === "criticalFailure") return 0
   if (outcome === "failure") return 1
   if (outcome === "success") return 2
   if (outcome === "criticalSuccess") return 3
   const value = Number(
      message?.rolls?.[0]?.options?.degreeOfSuccess ??
         context.degreeOfSuccess,
   )
   return Number.isFinite(value) ? value : null
}

export async function actorFromMessage(message) {
   const uuid = messageContext(message).actor
   const document =
      typeof uuid === "string" ? await fromUuid(uuid).catch(() => null) : null
   return document?.actor ?? document ?? game.actors?.get(message?.speaker?.actor) ?? null
}

export function isInitiativeMessage(message) {
   const options = messageOptions(message)
   const context = messageContext(message)
   const domains = Array.isArray(context.domains) ? context.domains : []
   return (
      options.includes("check:type:initiative") ||
      options.includes("initiative") ||
      domains.includes("initiative") ||
      String(context.type ?? "").includes("initiative")
   )
}

export function isStrikeMessage(message) {
   const options = messageOptions(message)
   const context = messageContext(message)
   return (
      options.some((option) => option === "action:strike" || option.startsWith("action:strike:")) ||
      String(context.type ?? "").includes("attack-roll")
   )
}

export async function grantOrcInnateSpell(
   actor,
   {
      slug,
      rank,
      per = "day",
      entryName = "Orc Innate Spells",
      entryFlag = "orcInnateEntry",
      spellFlag = "orcGrantedSpell",
      ability = "wis",
   } = {},
) {
   const spell = await compendiumItemBySlug(slug, {
      packs: ["pf2e.spells-srd", "pf2e.spells"],
      type: "spell",
   })
   if (!spell) return warn(`Spell not found: ${slug}.`)
   let entry = actor.itemTypes?.spellcastingEntry?.find?.(
      (item) => item.getFlag?.(MODULE_ID, entryFlag) === true,
   )
   if (!entry) {
      ;[entry] = await actor.createEmbeddedDocuments("Item", [
         {
            name: entryName,
            type: "spellcastingEntry",
            system: {
               ability: { value: ability },
               spelldc: { value: 0, dc: 0 },
               tradition: { value: "primal" },
               prepared: { value: "innate" },
            },
            flags: {
               [MODULE_ID]: {
                  orc: true,
                  [entryFlag]: true,
               },
            },
         },
      ])
   }
   const existing = actor.items?.find?.(
      (item) =>
         item.type === "spell" &&
         item.getFlag?.(MODULE_ID, `${spellFlag}.${slug}`),
   )
   if (existing) return existing
   const source = spell.toObject()
   delete source._id
   foundry.utils.setProperty(source, "system.location.value", entry.id)
   if (Number.isFinite(Number(rank))) {
      foundry.utils.setProperty(source, "system.location.heightenedLevel", Number(rank))
   }
   foundry.utils.setProperty(source, "system.location.uses", {
      value: 1,
      max: 1,
      per,
   })
   foundry.utils.setProperty(
      source,
      `flags.${MODULE_ID}.${spellFlag}.${slug}`,
      true,
   )
   const [created] = await actor.createEmbeddedDocuments("Item", [source])
   return created ?? null
}
