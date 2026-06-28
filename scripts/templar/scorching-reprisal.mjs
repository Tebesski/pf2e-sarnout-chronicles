import {
   MODULE_ID,
   SCORCHING_REPRISAL_EFFECT_SLUG,
   TEMPLAR_ASSETS,
   TEMPLAR_SLUGS,
} from "./constants.mjs"
import {
   activeTemplarActor,
   actorHasSlug,
   readTemplarState,
   slugify,
} from "./state.mjs"
import { fact, optionPreview, textParagraph } from "./templates.mjs"
import { damageTypeLabel } from "./damage.mjs"
import { counteract } from "./counteract.mjs"
import { playSound } from "./audio.mjs"
import { getActor } from "./actors.mjs"
import { actorItemArray } from "./items.mjs"
import { createOrRefreshEffect } from "./effects.mjs"
import {
   actorHasBarrierDamagedOrLingeringEffect,
   effectiveBarrier,
} from "./barrier/state.mjs"
import {
   dialogContent,
   TemplarChoiceDialog,
   TemplarSelectDialog,
} from "./dialogs.mjs"
import { postTemplarMessage } from "./messages.mjs"
import { emitTemplarLight } from "./light.mjs"

function scorchingReprisalEffects(actor) {
   return (
      actor?.items?.filter?.((item) => {
         if (item.type !== "effect") return false
         return Boolean(item.getFlag?.(MODULE_ID, "scorchingReprisal"))
      }) ?? []
   )
}

function effectScorchingData(effect) {
   return effect?.getFlag?.(MODULE_ID, "scorchingReprisal") ?? null
}

function optionIncludesWeapon(options = [], data = {}) {
   const weaponId = String(data.weaponId ?? "")
   const weaponUuid = String(data.weaponUuid ?? "")
   const weaponSlug = slugify(data.weaponSlug ?? data.weaponName ?? "")
   return options.some((option) => {
      const text = String(option ?? "")
      return (
         (weaponId && text === `item:id:${weaponId}`) ||
         (weaponUuid && text === `item:uuid:${weaponUuid}`) ||
         (weaponUuid && text === `origin:uuid:${weaponUuid}`) ||
         (weaponSlug && text === `item:slug:${weaponSlug}`)
      )
   })
}

function optionsContainItemIdentity(options = []) {
   return options.some((option) => {
      const text = String(option ?? "")
      return (
         text.startsWith("item:id:") ||
         text.startsWith("item:id=") ||
         text.startsWith("item:uuid:") ||
         text.startsWith("origin:uuid:") ||
         text.startsWith("item:slug:")
      )
   })
}

function optionsLookLikeStrikeDamage(options = []) {
   return options.some((option) => {
      const text = String(option ?? "")
      return (
         text === "strike-damage" ||
         text === "weapon-damage" ||
         text.endsWith("-strike-damage") ||
         text.endsWith("-weapon-damage")
      )
   })
}

function scorchingEffectMatchesStrike(
   effect,
   {
      itemId = "",
      itemUuid = "",
      itemName = "",
      itemSlug = "",
      options = [],
   } = {},
) {
   const data = effectScorchingData(effect)
   if (!data) return false
   const normalizedName = slugify(itemName)
   const normalizedSlug = slugify(itemSlug)
   return Boolean(
      (itemId && data.weaponId === itemId) ||
      (itemUuid && data.weaponUuid === itemUuid) ||
      (normalizedName && slugify(data.weaponName) === normalizedName) ||
      (normalizedSlug &&
         slugify(data.weaponSlug ?? data.weaponName) === normalizedSlug) ||
      optionIncludesWeapon(options, data),
   )
}

async function deleteScorchingReprisalEffects(actor) {
   for (const effect of scorchingReprisalEffects(actor)) {
      await effect.delete?.()
   }
}

function strikeItemDamageLabel(item) {
   const damage = item?.system?.damage ?? item?.baseDamage
   if (!damage) return "Strike damage"
   const dice = Number(damage.dice ?? 0)
   const die = damage.die ?? ""
   const modifier = Number(damage.modifier ?? 0)
   const base =
      dice && die ? `${dice}${die}` : modifier ? String(modifier) : "Strike"
   const mod = modifier && dice && die ? ` + ${modifier}` : ""
   const type = damageTypeLabel(damage.damageType ?? damage.type ?? "untyped")
   return `${base}${mod} ${type}`.trim()
}

function isWieldedItem(item) {
   const equipped = item?.system?.equipped ?? {}
   return Boolean(
      item?.isEquipped ||
      equipped.carryType === "held" ||
      Number(equipped.handsHeld ?? 0) > 0 ||
      equipped.inSlot,
   )
}

function isMeleeStrikeItem(item, action = null) {
   if (!item) return false
   if (action?.isMelee || item.isMelee) return true
   if (item.type === "melee") return true
   if (item.type !== "weapon") return false
   return item.system?.range === null || item.system?.range === undefined
}

function scorchingStrikeChoices(actor) {
   const choices = new Map()
   const addChoice = async (item, action = null) => {
      if (!item?.id || choices.has(item.id)) return
      if (!isMeleeStrikeItem(item, action)) return
      const facts = [
         fact("Strike", action?.label ?? item.name),
         fact("Damage", strikeItemDamageLabel(item)),
         fact("Item", item.name),
      ]
      const hands = Number(item.system?.equipped?.handsHeld ?? 0)
      if (hands > 0) facts.push(fact("Hands", hands))
      choices.set(item.id, {
         id: item.id,
         label: action?.label ?? item.name,
         item,
         action,
         preview: optionPreview(await dialogContent({ facts })),
      })
   }

   return (async () => {
      for (const action of actor?.system?.actions ?? []) {
         if (action?.type !== "strike" || action.ready === false) continue
         await addChoice(action.item, action)
      }

      for (const item of actorItemArray(actor)) {
         if (!["weapon", "melee"].includes(item.type)) continue
         if (!isWieldedItem(item)) continue
         await addChoice(item)
      }

      return [...choices.values()]
   })()
}

async function createScorchingReprisalEffect(
   actor,
   weapon,
   actionCount,
   bonus,
) {
   await deleteScorchingReprisalEffects(actor)
   const weaponName = weapon?.name ?? "Strike"
   const weaponId = weapon?.id ?? ""
   const weaponUuid = weapon?.uuid ?? ""
   const weaponSlug =
      weapon?.slug ?? weapon?.system?.slug ?? slugify(weaponName)
   const weaponPredicates = [
      weaponId ? `item:id:${weaponId}` : null,
      weaponSlug ? `item:slug:${weaponSlug}` : null,
      weaponUuid ? `origin:uuid:${weaponUuid}` : null,
   ].filter(Boolean)
   const weaponPredicate =
      weaponPredicates.length > 1
         ? [{ or: weaponPredicates }]
         : weaponPredicates
   const ruleBase = {
      key: "FlatModifier",
      selector: ["strike-damage"],
      type: "untyped",
      value: bonus,
      predicate: weaponPredicate,
      label: "Scorching Reprisal",
   }
   const strikeTraits = ["flourish", "concentrate", "holy", "light"]
   return createOrRefreshEffect(
      actor,
      {
         name: `Scorching Reprisal: ${weaponName}`,
         type: "effect",
         img: weapon?.img ?? TEMPLAR_ASSETS.fragment,
         system: {
            slug: `${SCORCHING_REPRISAL_EFFECT_SLUG}-${slugify(weaponId || weaponName)}`,
            duration: { value: 1, unit: "rounds", expiry: "turn-end" },
            rules: [
               ...strikeTraits.map((trait) => ({
                  key: "AdjustStrike",
                  mode: "add",
                  predicate: weaponPredicate,
                  property: "traits",
                  value: trait,
               })),
               {
                  ...ruleBase,
                  slug: "scorching-reprisal-fire",
                  damageType: "fire",
                  traits: ["holy", "light"],
               },
               {
                  ...ruleBase,
                  slug: "scorching-reprisal-spirit",
                  damageType: "spirit",
                  traits: ["holy", "light"],
               },
            ],
            description: {
               value: `Your next Strike with ${weaponName} deals +${bonus} fire damage and +${bonus} spirit damage. The effect removes itself after that Strike's damage roll.`,
            },
         },
         flags: {
            [MODULE_ID]: {
               scorchingReprisal: {
                  weaponId,
                  weaponUuid,
                  weaponName,
                  weaponSlug,
                  actions: actionCount,
                  bonus,
                  counteract: actionCount === 3,
                  counteractUsed: false,
               },
            },
         },
      },
      {
         slugs: [
            `${SCORCHING_REPRISAL_EFFECT_SLUG}-${slugify(weaponId || weaponName)}`,
         ],
      },
   )
}

async function rollScorchingReprisalStrike(actor, weaponChoice) {
   const action = weaponChoice?.action
   const item = weaponChoice?.item
   const event =
      typeof MouseEvent === "function"
         ? new MouseEvent("click", { bubbles: true, cancelable: true })
         : null
   const variant = action?.variants?.[0]
   const candidates = [
      { roll: variant?.roll, thisArg: variant },
      { roll: action?.roll, thisArg: action },
      { roll: action?.attack, thisArg: action },
      { roll: item?.roll, thisArg: item },
   ].filter((candidate) => typeof candidate.roll === "function")

   for (const { roll, thisArg } of candidates) {
      try {
         return await roll.call(thisArg, { event })
      } catch (firstError) {
         try {
            return await roll.call(thisArg)
         } catch (_secondError) {
            void firstError
         }
      }
   }

   ui.notifications?.warn(
      "The selected Strike could not be rolled automatically. Roll it from the sheet.",
   )
   return null
}

export async function scorchingReprisal({ actor, actions = null } = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   if (!actorHasSlug(resolved, TEMPLAR_SLUGS.scorchingReprisal)) {
      ui.notifications?.warn(
         "Scorching Reprisal was not detected on this actor.",
      )
      return null
   }
   const state = readTemplarState(resolved)
   if (!actorHasBarrierDamagedOrLingeringEffect(resolved)) {
      ui.notifications?.warn(
         "Scorching Reprisal requires Barrier was damaged or Lingering Barrier to be active.",
      )
      return null
   }
   const barrier = effectiveBarrier(state) ?? {
      name: "Lingering Light Barrier",
      hardness: state.light.hardness,
   }
   const choices = await scorchingStrikeChoices(resolved)
   if (choices.length === 0) {
      ui.notifications?.warn(
         "Scorching Reprisal requires a ready melee Strike from a wielded weapon or shield.",
      )
      return null
   }

   const weaponChoiceId = await TemplarSelectDialog.prompt({
      title: "Scorching Reprisal",
      label: "Strike",
      intro: await dialogContent({
         paragraphs: [
            textParagraph(
               "Choose the wielded Strike that will carry your barrier's scorching light.",
            ),
         ],
         facts: [
            fact("Active Barrier", barrier.name),
            fact("Current Hardness", barrier.hardness),
         ],
      }),
      options: choices,
      confirmLabel: "Choose",
   })
   if (!weaponChoiceId) return null
   const weaponChoice = choices.find((choice) => choice.id === weaponChoiceId)
   const weapon = weaponChoice?.item
   if (!weapon) return null

   let actionCount = Number(actions)
   if (![1, 2, 3].includes(actionCount)) {
      const choice = await TemplarChoiceDialog.prompt({
         title: "Scorching Reprisal",
         content: await dialogContent({
            paragraphs: [
               textParagraph(
                  `Choose how many actions you spent. Your next Strike with ${weapon.name} receives the listed fire and spirit damage.`,
               ),
            ],
            facts: [
               fact("Strike", weaponChoice.label),
               fact(
                  "1 Action",
                  `+${Math.floor(barrier.hardness / 2)} fire, +${Math.floor(barrier.hardness / 2)} spirit`,
               ),
               fact(
                  "2 Actions",
                  `+${barrier.hardness} fire, +${barrier.hardness} spirit`,
               ),
               fact(
                  "3 Actions",
                  `+${barrier.hardness} fire, +${barrier.hardness} spirit, counteract on hit`,
               ),
            ],
         }),
         buttons: [
            {
               id: "1",
               label: "",
               ariaLabel: "1 Action",
               glyph: "1",
               glyphOnly: true,
            },
            {
               id: "2",
               label: "",
               ariaLabel: "2 Actions",
               glyph: "2",
               glyphOnly: true,
            },
            {
               id: "3",
               label: "",
               ariaLabel: "3 Actions",
               glyph: "3",
               glyphOnly: true,
            },
            { id: "cancel", label: "Cancel" },
         ],
      })
      if (!choice || choice === "cancel") return null
      actionCount = Number(choice)
   }

   const bonus =
      actionCount === 1 ? Math.floor(barrier.hardness / 2) : barrier.hardness
   const effect = await createScorchingReprisalEffect(
      resolved,
      weapon,
      actionCount,
      bonus,
   )
   await emitTemplarLight(resolved)
   await playSound(TEMPLAR_ASSETS.scorchingReprisalSound)
   await postTemplarMessage(
      resolved,
      "Scorching Reprisal",
      `Scorching Reprisal is primed on ${weapon.name}. Your next matching Strike damage roll gains +${bonus} fire damage and +${bonus} spirit damage.`,
   )
   await rollScorchingReprisalStrike(resolved, weaponChoice)

   return { actions: actionCount, bonus, weapon, effect }
}

export async function handleScorchingReprisalStrike({
   actor,
   itemId = "",
   itemUuid = "",
   itemName = "",
   outcome = null,
} = {}) {
   const resolved = actor ? activeTemplarActor(actor) : null
   if (!resolved || !outcome) return null
   const effect = scorchingReprisalEffects(resolved).find((candidate) =>
      scorchingEffectMatchesStrike(candidate, { itemId, itemUuid, itemName }),
   )
   if (!effect) return null

   return { matched: true, consumed: false, outcome }
}

export async function handleScorchingReprisalDamage({
   actor,
   itemId = "",
   itemUuid = "",
   itemName = "",
   itemSlug = "",
   options = [],
} = {}) {
   const resolved = actor ? activeTemplarActor(actor) : null
   if (!resolved) return null
   const effects = scorchingReprisalEffects(resolved)
   const explicitIdentity = Boolean(
      itemId ||
      itemUuid ||
      itemName ||
      itemSlug ||
      optionsContainItemIdentity(options),
   )
   const fallbackToSingleEffect =
      !explicitIdentity || optionsLookLikeStrikeDamage(options)
   const effect =
      effects.find((candidate) =>
         scorchingEffectMatchesStrike(candidate, {
            itemId,
            itemUuid,
            itemName,
            itemSlug,
            options,
         }),
      ) ??
      (fallbackToSingleEffect && effects.length === 1 ? effects[0] : null) ??
      (effects.length === 1 ? effects[0] : null)
   if (!effect) return null

   const data = effectScorchingData(effect)
   let counteractResult = null
   try {
      if (data?.counteract && !data.counteractUsed) {
         await effect.setFlag?.(MODULE_ID, "scorchingReprisal", {
            ...data,
            counteractUsed: true,
         })
         counteractResult = await counteract({
            actor: resolved,
            title: "Scorching Reprisal Counteract",
            postSummary: true,
         })
      }
   } catch (_error) {
      ui.notifications?.error("Scorching Reprisal counteract failed.")
   } finally {
      await effect.delete?.()
   }
   return { consumed: true, counteract: counteractResult }
}
