import { MODULE_ID, TEMPLAR_SLUGS } from "../constants.mjs"
import { actorHasSlug, readTemplarState } from "../state.mjs"
import { fact, textParagraph } from "../templates.mjs"
import {
   canUsePhysicalBarrierAgainstDamage,
   canUseReactiveOrHoldingAgainstDamage,
   damageTypeLabel,
} from "../damage.mjs"
import { lightBurstDetails } from "../scaling.mjs"
import { getActor } from "../actors.mjs"
import {
   canUseTemplarReaction,
   warnReactionUsed,
} from "../reactions.mjs"
import {
   barrierAbilityAvailable,
   effectiveBarrier,
} from "./state.mjs"
import {
   dialogContent,
   TemplarSelectDialog,
} from "../dialogs.mjs"
import { format, localize } from "../i18n.mjs"
import { actorHasOrdinaryRaisedShield } from "../items.mjs"
import { hasRefractionAvailable } from "../refraction.mjs"
import { burstOrInculpationLockoutLabel } from "./effects.mjs"
import { adjacentAsSafeTemplars } from "../as-safe.mjs"

function requestBarrierPanel(actor) {
   Hooks.callAll(`${MODULE_ID}.openTemplarBarrierPanel`, actor)
}

function dcText(dc) {
   return Number.isFinite(dc)
      ? format(
           "PF2ESC.Templar.Choices.DCClassOrSpell",
           { dc },
           "DC {dc} (class DC or spell DC, whichever is higher)",
        )
      : localize(
           "PF2ESC.Templar.Choices.ClassOrSpellDC",
           "your class DC or spell DC, whichever is higher",
        )
}

function holdingIndicator(state) {
   return state.holding
      .map((slot) => (slot.active || slot.releasing ? "F" : "E"))
      .join(" / ")
}

function damageContextFacts(context) {
   const types = (context.damageTypes ?? ["untyped"])
      .map(damageTypeLabel)
      .join(", ")
   return [
      fact(localize("PF2ESC.Templar.Choices.IncomingDamage", "Incoming Damage"), context.total),
      fact(localize("PF2ESC.Templar.Choices.DamageType", "Damage Type"), types),
   ]
}

async function reactionPreview(actor, action, context) {
   const state = readTemplarState(actor)
   const barrier = effectiveBarrier(state) ?? {
      name: localize("PF2ESC.Templar.Choices.LightBarrier", "Light Barrier"),
      value: state.light.value,
      max: state.light.max,
      hardness: state.light.hardness,
   }
   const hardness = barrier.hardness
   const barrierDamage = Math.max(0, context.total - hardness)
   const nextBarrier = Math.max(0, barrier.value - barrierDamage)
   const burst = lightBurstDetails(actor)
   const focus = Number(actor.system?.resources?.focus?.value ?? 0)

   if (action === "shieldBlock") {
      const shield = actor.attributes?.shield
      return dialogContent({
         paragraphs: [
            textParagraph(
               localize(
                  "PF2ESC.Templar.Choices.ShieldBlockPreview",
                  "Your raised shield handles this damage with PF2e's normal Shield Block automation.",
               ),
            ),
         ],
         facts: [
            fact(localize("PF2ESC.Templar.Choices.Shield", "Shield"), shield?.name ?? localize("PF2ESC.Templar.Choices.RaisedShield", "Raised Shield")),
            fact(localize("PF2ESC.Templar.Choices.Hardness", "Hardness"), shield?.hardness ?? 0),
         ],
      })
   }

   if (action === "holdingBarrier") {
      const hasDefenseMaster = actorHasSlug(actor, TEMPLAR_SLUGS.defenseMaster)
      return dialogContent({
         paragraphs: [
            textParagraph(
               localize(
                  "PF2ESC.Templar.Choices.HoldingPreview",
                  "Holding Barrier prevents this damage. Your active barrier loses HP after Hardness, then stores the full unreduced damage if it survives.",
               ),
            ),
            textParagraph(
               hasDefenseMaster
                  ? localize(
                       "PF2ESC.Templar.Choices.HoldingDefenseMaster",
                       "Because you have Defense Master, the held damage keeps its actual damage type for Barrier Release.",
                    )
                  : localize(
                       "PF2ESC.Templar.Choices.HoldingNoDefenseMaster",
                       "Without Defense Master, Barrier Release is stored as untyped damage that bypasses immunities, weaknesses, and resistances.",
                    ),
            ),
         ],
         facts: [
            ...damageContextFacts(context),
            fact(localize("PF2ESC.Templar.Choices.ActiveBarrier", "Active Barrier"), barrier.name),
            fact(localize("PF2ESC.Templar.Choices.BarrierDamage", "Barrier Damage"), barrierDamage),
            fact(localize("PF2ESC.Templar.Choices.BarrierAfter", "Barrier After"), `${nextBarrier} / ${barrier.max}`),
            fact(localize("PF2ESC.Templar.Choices.StoredDamage", "Stored Damage"), context.total),
         ],
      })
   }

   if (action === "lightBurst") {
      return dialogContent({
         paragraphs: [
            textParagraph(
               localize(
                  "PF2ESC.Templar.Choices.LightBurstPreview",
                  "You take the triggering damage normally. Your Light Barrier also takes it, applying Hardness, then erupts.",
               ),
            ),
         ],
         facts: [
            fact(localize("PF2ESC.Templar.Choices.ActiveBarrier", "Active Barrier"), barrier.name),
            fact(localize("PF2ESC.Templar.Choices.BarrierDamage", "Barrier Damage"), barrierDamage),
            fact(localize("PF2ESC.Templar.Choices.BarrierAfter", "Barrier After"), `${nextBarrier} / ${barrier.max}`),
            fact(localize("PF2ESC.Templar.Choices.Area", "Area"), format("PF2ESC.Templar.Choices.FootEmanation", { radius: burst.radius }, "{radius}-foot emanation")),
            fact(
               localize("PF2ESC.Templar.Choices.BurstDamage", "Burst Damage"),
               format(
                  "PF2ESC.Templar.Choices.FireSpiritDamage",
                  { dice: burst.dice },
                  "{dice}d6 fire + {dice}d6 spirit",
               ),
            ),
            fact(localize("PF2ESC.Templar.Choices.Save", "Save"), format("PF2ESC.Templar.Choices.BasicReflexVs", { dc: dcText(burst.dc) }, "Basic Reflex vs {dc}")),
            fact(localize("PF2ESC.Templar.Choices.DarknessCounteract", "Darkness Counteract"), format("PF2ESC.Templar.Choices.Rank", { rank: burst.counteractRank }, "Rank {rank}")),
         ],
      })
   }

   if (action === "inculpation") {
      return dialogContent({
         paragraphs: [
            textParagraph(
               localize(
                  "PF2ESC.Templar.Choices.InculpationPreview",
                  "Inculpation functions as Light Burst against only the triggering creature, then applies its dazzled/blinded rider by Reflex save result.",
               ),
            ),
         ],
         facts: [
            fact(localize("PF2ESC.Templar.Choices.FocusPoints", "Focus Points"), focus),
            fact(localize("PF2ESC.Templar.Choices.ActiveBarrier", "Active Barrier"), barrier.name),
            fact(localize("PF2ESC.Templar.Choices.BarrierDamage", "Barrier Damage"), barrierDamage),
            fact(localize("PF2ESC.Templar.Choices.BarrierAfter", "Barrier After"), `${nextBarrier} / ${barrier.max}`),
            fact(
               localize("PF2ESC.Templar.Choices.TargetDamage", "Target Damage"),
               format(
                  "PF2ESC.Templar.Choices.FireSpiritDamage",
                  { dice: burst.dice },
                  "{dice}d6 fire + {dice}d6 spirit",
               ),
            ),
         ],
      })
   }

   return dialogContent({
      paragraphs: [
         textParagraph(
            localize(
               "PF2ESC.Templar.Choices.ReactivePreview",
               "Reactive Barrier interposes your Light Barrier. The barrier and you each take the remaining damage after Hardness.",
            ),
         ),
      ],
      facts: [
         fact(localize("PF2ESC.Templar.Choices.ActiveBarrier", "Active Barrier"), barrier.name),
         fact(localize("PF2ESC.Templar.Choices.Hardness", "Hardness"), hardness),
         fact(localize("PF2ESC.Templar.Choices.BarrierDamage", "Barrier Damage"), barrierDamage),
         fact(localize("PF2ESC.Templar.Choices.ActorDamage", "Actor Damage"), barrierDamage),
         fact(localize("PF2ESC.Templar.Choices.BarrierAfter", "Barrier After"), `${nextBarrier} / ${barrier.max}`),
      ],
   })
}

async function barrierReactionOptions(
   actor,
   context,
   { allowShieldBlock = false, guardian = false } = {},
) {
   const state = readTemplarState(actor)
   const available = barrierAbilityAvailable(state)
   const reactionAvailable = canUseTemplarReaction(actor, { notify: false })
   const canUsePhysicalBarrier = canUsePhysicalBarrierAgainstDamage(
      actor,
      context,
   )
   const canUseReactiveHolding = canUseReactiveOrHoldingAgainstDamage(
      actor,
      context,
   )
   const canHoldOrReplace = state.holding.some(
      (slot) =>
         (!slot.active && !slot.releasing && !slot.released) ||
         (slot.active && !slot.releasing),
   )
   const options = []

   if (allowShieldBlock && !guardian && actorHasOrdinaryRaisedShield(actor)) {
      options.push({
         id: "shieldBlock",
         label: localize("PF2ESC.Templar.Choices.ShieldBlock", "Shield Block"),
         preview: await reactionPreview(actor, "shieldBlock", context),
      })
   }

   if (available && reactionAvailable && canUseReactiveHolding) {
      options.push({
         id: "reactiveBarrier",
         label: localize(
            "PF2ESC.Templar.Choices.ReactiveBarrier",
            "Reactive Barrier",
         ),
         preview: await reactionPreview(actor, "reactiveBarrier", context),
      })
   }

   if (
      !guardian &&
      available &&
      reactionAvailable &&
      canUseReactiveHolding &&
      actorHasSlug(actor, TEMPLAR_SLUGS.holdingBarrier)
   ) {
      options.push({
         id: "holdingBarrier",
         label: format(
            "PF2ESC.Templar.Choices.HoldingBarrierState",
            { state: holdingIndicator(state) },
            "Holding Barrier [{state}]",
         ),
         disabled: !canHoldOrReplace,
         preview: await reactionPreview(actor, "holdingBarrier", context),
      })
   }

   if (
      !guardian &&
      available &&
      reactionAvailable &&
      canUsePhysicalBarrier &&
      actorHasSlug(actor, TEMPLAR_SLUGS.lightBurst)
   ) {
      const used = burstOrInculpationLockoutLabel(actor)
      options.push({
         id: "lightBurst",
         label: used
            ? format(
                 "PF2ESC.Templar.Choices.LightBurstUsed",
                 { used },
                 "Light Burst ({used})",
              )
            : localize("PF2ESC.Templar.Choices.LightBurst", "Light Burst"),
         disabled: Boolean(used),
         preview: await reactionPreview(actor, "lightBurst", context),
      })
   }

   if (
      !guardian &&
      available &&
      reactionAvailable &&
      canUsePhysicalBarrier &&
      actorHasSlug(actor, TEMPLAR_SLUGS.inculpation)
   ) {
      const used = burstOrInculpationLockoutLabel(actor)
      options.push({
         id: "inculpation",
         label: used
            ? format(
                 "PF2ESC.Templar.Choices.InculpationUsed",
                 { used },
                 "Inculpation ({used})",
              )
            : localize("PF2ESC.Templar.Choices.Inculpation", "Inculpation"),
         disabled: Boolean(used),
         preview: await reactionPreview(actor, "inculpation", context),
      })
   }

   return options
}

export async function chooseBarrierReaction({
   actor,
   damageContext,
   allowShieldBlock = false,
   guardian = false,
   title = localize("PF2ESC.Templar.Choices.TemplarBarrier", "Templar Barrier"),
} = {}) {
   const resolved = getActor(actor)
   if (!resolved || !damageContext) return null
   const options = await barrierReactionOptions(resolved, damageContext, {
      allowShieldBlock,
      guardian,
   })
   const enabled = options.filter((option) => !option.disabled)
   const canRefract =
      !guardian && damageContext.isCritical && hasRefractionAvailable(resolved)

   if (enabled.length === 0 && !canRefract) {
      const isEligible =
         canUsePhysicalBarrierAgainstDamage(resolved, damageContext) ||
         canUseReactiveOrHoldingAgainstDamage(resolved, damageContext)
      if (isEligible && !canUseTemplarReaction(resolved, { notify: false })) {
         warnReactionUsed(resolved)
      }
      return null
   }

   const hasOptionalBarrier =
      actorHasSlug(resolved, TEMPLAR_SLUGS.holdingBarrier) ||
      actorHasSlug(resolved, TEMPLAR_SLUGS.lightBurst) ||
      actorHasSlug(resolved, TEMPLAR_SLUGS.inculpation)
   if (
      !allowShieldBlock &&
      !hasOptionalBarrier &&
      enabled.length === 1 &&
      !canRefract
   ) {
      return enabled[0].id
   }

   requestBarrierPanel(resolved)
   return TemplarSelectDialog.prompt({
      title,
      label: localize("PF2ESC.Templar.Choices.Reaction", "Reaction"),
      intro: await dialogContent({
         paragraphs: [
            textParagraph(
               localize(
                  "PF2ESC.Templar.Choices.ChooseReaction",
                  "Choose how your defenses answer the incoming damage.",
               ),
            ),
         ],
         facts: damageContextFacts(damageContext),
      }),
      options,
      actionButtons: canRefract
         ? [
              {
                 id: "refraction",
                 label: localize(
                    "PF2ESC.Templar.Choices.Refraction",
                    "Refraction",
                 ),
                 icon: "fa-solid fa-shield-cat",
              },
           ]
         : [],
      confirmLabel: localize("PF2ESC.Templar.Choices.Use", "Use"),
   })
}

export async function chooseAsSafeAsChurchReaction({
   ally,
   damageContext,
   protectedToken = null,
   assumePhysical = false,
} = {}) {
   const protectedActor = getActor(ally)
   if (!protectedActor || !damageContext) return null
   const candidates = adjacentAsSafeTemplars(protectedActor, damageContext, {
      protectedToken,
      assumePhysical,
   })
   if (candidates.length === 0) return null

   let templar = candidates[0]
   if (candidates.length > 1) {
      const choice = await TemplarSelectDialog.prompt({
         title: localize(
            "PF2ESC.Templar.Choices.AsSafeAsChurch",
            "As Safe as Church",
         ),
         label: localize("PF2ESC.Templar.Choices.Templar", "Templar"),
         intro: await dialogContent({
            paragraphs: [
               textParagraph(
                  format(
                     "PF2ESC.Templar.Choices.MultipleTemplars",
                     { actor: protectedActor.name },
                     "{actor} is adjacent to multiple Templars who can intercept this damage.",
                  ),
               ),
            ],
            facts: damageContextFacts(damageContext),
         }),
         options: candidates.map((candidate) => ({
            id: candidate.uuid ?? candidate.id,
            label: candidate.name,
            preview: "",
         })),
         confirmLabel: localize("PF2ESC.Templar.Choices.Choose", "Choose"),
      })
      if (!choice) return null
      templar =
         candidates.find((candidate) =>
            [candidate.uuid, candidate.id].includes(choice),
         ) ?? null
      if (!templar) return null
   }

   const reaction = await chooseBarrierReaction({
      actor: templar,
      damageContext,
      guardian: true,
      title: localize(
         "PF2ESC.Templar.Choices.AsSafeAsChurch",
         "As Safe as Church",
      ),
   })
   if (!reaction) return null
   return { templar, reaction }
}
