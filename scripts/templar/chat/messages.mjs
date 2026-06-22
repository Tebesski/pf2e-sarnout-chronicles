import { MODULE_ID, TEMPLAR_SLUGS } from "../constants.mjs"
import { slugify } from "../state.mjs"

const TEMPLAR_AUTOMATED_SPELL_SLUG_GROUPS = [
   TEMPLAR_SLUGS.repentance,
   TEMPLAR_SLUGS.brilliantShard,
   TEMPLAR_SLUGS.providence,
   TEMPLAR_SLUGS.advent,
   TEMPLAR_SLUGS.lastStronghold,
   TEMPLAR_SLUGS.scutumFidei,
   TEMPLAR_SLUGS.heatLightning,
   TEMPLAR_SLUGS.refraction,
   TEMPLAR_SLUGS.flagellation,
   TEMPLAR_SLUGS.lightGaol,
   TEMPLAR_SLUGS.blindingBlade,
]
const TEMPLAR_AUTOMATED_SPELL_SLUGS = new Set(
   TEMPLAR_AUTOMATED_SPELL_SLUG_GROUPS.flat().map(slugify),
)

export function messageActor(li) {
   const message = game.messages?.get?.(li.dataset.messageId)
   return messageActorDocument(message)
}

export function messageActorDocument(message) {
   const speaker = message?.speaker ?? {}
   return (
      message?.actor ??
      message?.speakerActor ??
      game.actors?.get?.(speaker.actor) ??
      canvas?.tokens?.get?.(speaker.token)?.actor ??
      null
   )
}

export function messageFromElement(element) {
   const messageId = element?.closest?.(".message")?.dataset?.messageId
   return messageId ? (game.messages?.get?.(messageId) ?? null) : null
}

export function outcomeDegree(value) {
   if (value === null || value === undefined) return null
   const numeric = Number(value)
   if (Number.isFinite(numeric)) {
      return Math.max(0, Math.min(3, Math.trunc(numeric)))
   }
   const slug = slugify(String(value))
   if (slug === "critical-failure" || slug === "criticalfailure") return 0
   if (slug === "failure") return 1
   if (slug === "success") return 2
   if (slug === "critical-success" || slug === "criticalsuccess") return 3
   return null
}

export function messageSaveStatistic(message) {
   const context = message?.flags?.pf2e?.context ?? {}
   const roll = message?.rolls?.at?.(0)
   const candidates = [
      context.statistic,
      context.modifier,
      ...(context.domains ?? []),
      roll?.options?.statistic,
      ...(roll?.options?.domains ?? []),
   ]
      .filter(Boolean)
      .map(slugify)

   for (const candidate of candidates) {
      if (candidate.includes("fortitude")) return "fortitude"
      if (candidate.includes("reflex")) return "reflex"
      if (candidate.includes("will")) return "will"
   }
   return ""
}

export function messageOutcomeDegree(message) {
   const context = message?.flags?.pf2e?.context ?? {}
   const roll = message?.rolls?.at?.(0)
   return (
      [
         context.outcome,
         context.unadjustedOutcome,
         roll?.degreeOfSuccess,
         roll?.options?.degreeOfSuccess,
      ]
         .map(outcomeDegree)
         .find((degree) => degree !== null) ?? null
   )
}

export function resolveMessageIdFromLi(li) {
   let element = null
   if (li instanceof HTMLElement) element = li
   else if (li?.[0] instanceof HTMLElement) element = li[0]
   else if (li?.element instanceof HTMLElement) element = li.element

   return (
      element?.dataset?.messageId ??
      element?.closest?.("[data-message-id]")?.dataset?.messageId ??
      null
   )
}

export function messageUserId(message) {
   return typeof message?.user === "string"
      ? message.user
      : (message?.user?.id ?? message?.userId ?? message?._source?.user)
}

export function currentUserCreatedMessage(message) {
   return messageUserId(message) === game.user?.id
}

export function messageItemSlug(message) {
   const pf2e = message?.flags?.pf2e ?? {}
   const context = pf2e.context ?? {}
   const origin = pf2e.origin ?? {}
   const castingItem = pf2e.casting?.item ?? pf2e.cast?.item ?? {}
   const spell = pf2e.spell ?? context.spell ?? {}
   const itemFlag = pf2e.item ?? {}
   const candidates = [
      message?.item?.slug,
      message?.item?.system?.slug,
      context?.item?.slug,
      context?.item?.system?.slug,
      context?.origin?.slug,
      context?.origin?.system?.slug,
      origin?.slug,
      origin?.system?.slug,
      castingItem?.slug,
      castingItem?.system?.slug,
      spell?.slug,
      spell?.system?.slug,
      itemFlag?.slug,
      itemFlag?.system?.slug,
      context?.item?.name,
      context?.origin?.name,
      origin?.name,
      castingItem?.name,
      spell?.name,
      itemFlag?.name,
      message?.item?.name,
   ]
   const fromData = slugify(candidates.find((candidate) => candidate) ?? "")
   const fromContent = messageContentTemplarSlug(message)
   if (fromContent && !isAutomatedTemplarSpellSlug(fromData)) return fromContent
   return fromData || fromContent
}

export function messageItemType(message) {
   const pf2e = message?.flags?.pf2e ?? {}
   const context = pf2e.context ?? {}
   const origin = pf2e.origin ?? {}
   return (
      message?.item?.type ??
      origin?.type ??
      context?.item?.type ??
      context?.origin?.type ??
      pf2e.casting?.item?.type ??
      pf2e.cast?.item?.type ??
      pf2e.spell?.type ??
      context?.spell?.type ??
      pf2e.item?.type ??
      ""
   )
}

export function messagePrimaryItem(message) {
   const pf2e = message?.flags?.pf2e ?? {}
   const context = pf2e.context ?? {}
   return (
      message?.item ??
      context.item ??
      context.origin ??
      pf2e.origin ??
      pf2e.casting?.item ??
      pf2e.cast?.item ??
      pf2e.spell ??
      context.spell ??
      pf2e.item ??
      null
   )
}

export function messageActionType(message) {
   const item = messagePrimaryItem(message)
   const actionType =
      item?.system?.actionType?.value ??
      item?.actionType?.value ??
      item?.system?.actionType ??
      item?.actionType ??
      ""
   return slugify(actionType)
}

export function messageActionsValue(message) {
   const item = messagePrimaryItem(message)
   const value = item?.system?.actions?.value ?? item?.actions?.value ?? null
   return value === undefined ? null : value
}

export function messageHasItemContext(message) {
   const pf2e = message?.flags?.pf2e ?? {}
   const context = pf2e.context ?? {}
   return Boolean(
      message?.item ||
         pf2e.origin ||
         context.item ||
         context.origin ||
         pf2e.casting?.item ||
         pf2e.cast?.item ||
         pf2e.spell ||
         context.spell ||
         pf2e.item,
   )
}

export function messageContentTemplarSlug(message) {
   const text = String(message?.content ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
   const contentSlug = slugify(text)
   if (!contentSlug) return ""
   return (
      [...TEMPLAR_AUTOMATED_SPELL_SLUGS].find((slug) =>
         contentSlug.includes(slug),
      ) ?? ""
   )
}

export function idFromUuid(uuid) {
   if (typeof uuid !== "string") return ""
   return uuid.split(".").filter(Boolean).at(-1) ?? ""
}

export function messageOptionStrings(message) {
   const pf2e = message?.flags?.pf2e ?? {}
   const context = pf2e.context ?? {}
   const fromRolls =
      message?.rolls?.flatMap?.((roll) => [
         roll?.options?.options,
         roll?.options?.domains,
         roll?.options?.traits,
         roll?.options?.context?.options,
      ]) ?? []
   return [
      context.options,
      context.rollOptions,
      context.domains,
      context.traits,
      pf2e.options,
      pf2e.rollOptions,
      ...fromRolls,
   ]
      .flat(Infinity)
      .filter((value) => typeof value === "string")
}

export function optionValue(options, prefixes) {
   for (const option of options) {
      for (const prefix of prefixes) {
         if (option.startsWith(prefix)) return option.slice(prefix.length)
      }
   }
   return ""
}

export function meaningfulObject(value) {
   if (!value || typeof value !== "object") return null
   return Object.keys(value).length ? value : null
}

export function messageItemIdentity(message) {
   const pf2e = message?.flags?.pf2e ?? {}
   const context = pf2e.context ?? {}
   const origin = pf2e.origin ?? {}
   const item =
      meaningfulObject(message?.item) ??
      meaningfulObject(context.item) ??
      meaningfulObject(context.origin) ??
      meaningfulObject(origin) ??
      meaningfulObject(pf2e.casting?.item) ??
      meaningfulObject(pf2e.cast?.item) ??
      meaningfulObject(pf2e.spell) ??
      meaningfulObject(context.spell) ??
      meaningfulObject(pf2e.item) ??
      null
   const options = messageOptionStrings(message)
   const itemUuid =
      [
         item?.uuid,
         origin?.uuid,
         context?.origin?.uuid,
         context?.item?.uuid,
         optionValue(options, ["item:uuid:", "origin:uuid:"]),
      ].find((value) => value) ?? ""
   const optionItemId = optionValue(options, ["item:id:", "item:id="])
   const itemSlug =
      item?.slug ??
      item?.system?.slug ??
      origin?.slug ??
      origin?.system?.slug ??
      context?.origin?.slug ??
      context?.origin?.system?.slug ??
      context?.item?.slug ??
      context?.item?.system?.slug ??
      optionValue(options, ["item:slug:"]) ??
      ""
   const itemName =
      item?.name ??
      origin?.name ??
      context?.origin?.name ??
      context?.item?.name ??
      ""
   const itemId =
      [
         item?.id,
         origin?.id,
         context?.origin?.id,
         context?.item?.id,
         optionItemId,
         idFromUuid(itemUuid),
      ].find((value) => value) ?? ""
   return {
      itemId,
      itemUuid,
      itemName,
      itemSlug,
      options,
   }
}

export function isDamageRollMessage(message) {
   if (!message?.id) return false
   if (!message.rolls?.length) return false
   const context = message.flags?.pf2e?.context ?? {}
   const contextType = String(context.type ?? "")
   const domains = context.domains ?? []
   const hasDamageRoll = message.rolls.some((roll) => {
      return (
         roll?.constructor?.name === "DamageRoll" ||
         roll?.class === "DamageRoll" ||
         String(roll?.options?.type ?? "").includes("damage")
      )
   })
   return Boolean(
      hasDamageRoll ||
         contextType.includes("damage") ||
         domains.includes("damage-roll") ||
         domains.includes("strike-damage") ||
         domains.includes("weapon-damage") ||
         domains.some((domain) => String(domain).endsWith("-damage")),
   )
}

export function messageTraits(message) {
   const pf2e = message?.flags?.pf2e ?? {}
   const context = pf2e.context ?? {}
   const origin = pf2e.origin ?? context.origin ?? {}
   const item = message?.item ?? context.item ?? pf2e.item ?? pf2e.spell ?? {}
   const castingItem = pf2e.casting?.item ?? pf2e.cast?.item ?? {}
   const spell = pf2e.spell ?? context.spell ?? {}
   const values = [
      item?.system?.traits?.value,
      item?.traits,
      origin?.traits,
      origin?.system?.traits?.value,
      context?.item?.system?.traits?.value,
      context?.origin?.system?.traits?.value,
      castingItem?.system?.traits?.value,
      castingItem?.traits,
      spell?.system?.traits?.value,
      spell?.traits,
      context?.traits,
   ].flat(Infinity)
   return new Set(
      values
         .map(
            (value) =>
               String(value ?? "")
                  .split(":")
                  .filter(Boolean)
                  .at(-1) ?? "",
         )
         .map(slugify)
         .filter(Boolean),
   )
}

export function messageHasLightProtectsTrait(message) {
   const traits = messageTraits(message)
   return ["unholy", "shadow", "darkness"].some((trait) => traits.has(trait))
}

export function isStrikeSpellOrEffectMessage(message) {
   const type = messageItemType(message)
   const contextType = String(message?.flags?.pf2e?.context?.type ?? "")
   const domains = message?.flags?.pf2e?.context?.domains ?? []
   return Boolean(
      ["weapon", "melee", "spell", "effect", "action"].includes(type) ||
         contextType.includes("attack") ||
         contextType.includes("spell") ||
         contextType.includes("effect") ||
         domains.includes("strike-attack-roll") ||
         domains.some((domain) => String(domain).endsWith("-attack-roll")),
   )
}

export function isAutomatedTemplarSpellSlug(slug) {
   return TEMPLAR_AUTOMATED_SPELL_SLUGS.has(slugify(slug))
}
