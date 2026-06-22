import { format, localize } from "../i18n.mjs"
import { renderTemplarTemplate } from "../templates.mjs"
import { ABILITY_TRAITS, DAMAGE_VISUALS } from "./constants.mjs"
import { normalizeOutcome, outcomeClass, outcomeLabel } from "./outcomes.mjs"

function visualForDamageType(type) {
   return DAMAGE_VISUALS[type] ?? DAMAGE_VISUALS.untyped
}

function diceRows(instance) {
   return (instance.dice ?? []).map((die) => {
      const classes = ["roll", "die", `d${die.faces}`]
      if (die.value === 1) classes.push("min")
      if (die.value === die.faces) classes.push("max")
      return { classes: classes.join(" "), value: die.value }
   })
}

async function renderTraits(traits = []) {
   return renderTemplarTemplate("cards/traits", { traits })
}

async function renderCounteract(counteract) {
   if (!counteract) return ""
   const rank = Number(counteract.rank)
   return renderTemplarTemplate("cards/counteract", {
      label: localize(
         "PF2ESC.Templar.Cards.DarknessCounteract",
         "Darkness Counteract",
      ),
      counteract: {
         result:
            counteract.result ??
            counteract.total ??
            localize("PF2ESC.Templar.Cards.AttemptResolved", "Attempt resolved"),
         rankText: Number.isFinite(rank)
            ? format(
                 "PF2ESC.Templar.Cards.Rank",
                 { rank },
                 "(Rank {rank})",
              )
            : "",
      },
   })
}

async function renderDiceTooltip(rollData) {
   const instances = (rollData.instances ?? []).map((instance) => {
      const type = instance.type || "untyped"
      const visual = visualForDamageType(type)
      return {
         type,
         icon: visual.icon,
         formula: instance.formula,
         total: instance.total,
         dice: diceRows(instance),
      }
   })
   return renderTemplarTemplate("cards/dice-tooltip", { instances })
}

async function renderDamageBlock(rollData, statName = "Reflex") {
   if (!rollData || !rollData.instances || rollData.total === 0) return ""
   const instances = (Array.isArray(rollData?.instances)
      ? rollData.instances
      : []
   ).map((instance) => {
      const type = instance.type || "untyped"
      const visual = visualForDamageType(type)
      return {
         type,
         formula: instance.formula || rollData?.formula || "",
         icon: visual.icon,
         color: visual.color,
         total: instance.total ?? "",
      }
   })
   return renderTemplarTemplate("cards/damage-roll", {
      hasDamage: true,
      instances,
      tooltipHtml: await renderDiceTooltip(rollData),
      total: rollData?.total ?? 0,
      title: format(
         "PF2ESC.Templar.Cards.BasicDamageTitle",
         { save: statName },
         "Basic {save} Damage",
      ),
   })
}

function localizedOutcomeLabel(outcome) {
   const normalized = normalizeOutcome(outcome)
   const key =
      {
         criticalSuccess: "PF2ESC.Templar.Cards.Outcome.CriticalSuccess",
         success: "PF2ESC.Templar.Cards.Outcome.Success",
         failure: "PF2ESC.Templar.Cards.Outcome.Failure",
         criticalFailure: "PF2ESC.Templar.Cards.Outcome.CriticalFailure",
      }[normalized] ?? ""
   return key ? localize(key, outcomeLabel(outcome)) : outcomeLabel(outcome)
}

export async function saveTooltip(
   dc,
   roll = null,
   outcome = null,
   d20 = null,
   statName = "Reflex",
) {
   let diffText = ""
   if (roll) {
      const diff = Number(roll.total) - Number(dc)
      if (Number.isFinite(diff)) {
         diffText = format(
            "PF2ESC.Templar.Cards.ResultBy",
            { diff: `${diff >= 0 ? "+" : ""}${diff}` },
            "by {diff}",
         )
      }
   }
   return renderTemplarTemplate("cards/save-tooltip", {
      dcText: format(
         "PF2ESC.Templar.Cards.SavingThrowDC",
         { save: statName, dc },
         "{save} Saving Throw DC {dc}",
      ),
      hasRoll: Boolean(roll),
      resultLabel: localize("PF2ESC.Templar.Cards.Result", "Result:"),
      d20: d20 ?? "",
      outcomeLabel: localizedOutcomeLabel(outcome),
      diffText,
      rerollHint: localize(
         "PF2ESC.Templar.Cards.RerollHint",
         "Click again to reroll.",
      ),
   })
}

export async function renderDamageButtons() {
   return renderTemplarTemplate("cards/damage-buttons", {
      buttons: [
         {
            multiplier: 1,
            className: "",
            iconHtml: '<i class="fa-solid fa-heart-crack fa-fw"></i>',
            label: localize("PF2ESC.Templar.Cards.Damage", "Damage"),
         },
         {
            multiplier: 0.5,
            className: "half-damage",
            iconHtml: '<i class="fa-solid fa-heart-crack fa-fw"></i>',
            label: localize("PF2ESC.Templar.Cards.Half", "Half"),
         },
         {
            multiplier: 2,
            className: "",
            iconHtml: '<img src="systems/pf2e/icons/damage/double.svg">',
            label: localize("PF2ESC.Templar.Cards.Double", "Double"),
         },
      ],
   })
}

function lightBurstOutcomeNote(outcome, barrierShattered) {
   if (!barrierShattered) return ""
   const normalized = normalizeOutcome(outcome)
   if (normalized === "failure") {
      return localize(
         "PF2ESC.Templar.Cards.LightBurst.PushFailure",
         "Pushed 5 feet.",
      )
   }
   if (normalized === "criticalFailure") {
      return localize(
         "PF2ESC.Templar.Cards.LightBurst.PushCriticalFailure",
         "Pushed 10 feet and knocked prone.",
      )
   }
   return ""
}

function inculpationOutcomeNote(outcome) {
   const normalized = normalizeOutcome(outcome)
   if (normalized === "success") {
      return localize(
         "PF2ESC.Templar.Cards.Inculpation.Success",
         "Dazzled for 1 round.",
      )
   }
   if (normalized === "failure") {
      return localize(
         "PF2ESC.Templar.Cards.Inculpation.Failure",
         "Dazzled for 1 minute. If the creature is concealed or invisible, negate that condition for 1 round.",
      )
   }
   if (normalized === "criticalFailure") {
      return localize(
         "PF2ESC.Templar.Cards.Inculpation.CriticalFailure",
         "Blinded for 1 round, then dazzled for 1 minute. Concealed or invisible is lost for 1 minute.",
      )
   }
   return localize(
      "PF2ESC.Templar.Cards.Inculpation.NoEffect",
      "No additional effect.",
   )
}

function lightGaolOutcomeNote(outcome, saveType) {
   const normalized = normalizeOutcome(outcome)
   if (saveType === "reflex") {
      if (normalized === "failure") {
         return localize(
            "PF2ESC.Templar.Cards.LightGaol.BlindedOneRound",
            "Blinded for 1 round.",
         )
      }
      if (normalized === "criticalFailure") {
         return localize(
            "PF2ESC.Templar.Cards.LightGaol.BlindedTwoRounds",
            "Blinded for 2 rounds.",
         )
      }
      return ""
   }
   if (
      saveType === "will" &&
      (normalized === "failure" || normalized === "criticalFailure")
   ) {
      return localize(
         "PF2ESC.Templar.Cards.LightGaol.CannotMoveThroughWall",
         "You cannot move through the Light Gaol wall.",
      )
   }
   return ""
}

export async function renderOutcomeNote(
   type,
   outcome,
   barrierShattered = false,
   appliedEffects = [],
   saveType = null,
) {
   let note = ""
   if (type === "light-burst")
      note = lightBurstOutcomeNote(outcome, barrierShattered)
   else if (type === "inculpation") note = inculpationOutcomeNote(outcome)
   else if (type === "light-gaol" || type === "blinding-blade")
      note = lightGaolOutcomeNote(outcome, saveType)

   const effects = appliedEffects.join(", ")
   const appliedText = appliedEffects.length
      ? format(
           "PF2ESC.Templar.Cards.Applied",
           { effects },
           "Applied: {effects}.",
        )
      : ""
   return renderTemplarTemplate("cards/outcome-note", {
      hasContent: Boolean(note || appliedText),
      note,
      appliedText,
   })
}

async function renderTargetRow(tokenDoc, cardData) {
   const uuid = tokenDoc?.uuid ?? ""
   const state = cardData.targetStates?.[uuid] ?? {}
   const name =
      tokenDoc?.actor?.name ??
      tokenDoc?.actorName ??
      tokenDoc?.name ??
      localize("PF2ESC.Templar.Cards.Target", "Target")
   const rolled = state.rolled === true
   const outcome = normalizeOutcome(state.outcome)
   const className = outcomeClass(outcome)
   const statName = capitalizedSaveName(cardData.saveType)
   const noteHtml = rolled
      ? await renderOutcomeNote(
           cardData.type,
           outcome,
           cardData.barrierShattered,
           state.appliedEffects ?? [],
           cardData.saveType,
        )
      : ""

   return renderTemplarTemplate("cards/target-row", {
      uuid,
      name,
      rolled: rolled ? "true" : "false",
      outcomeClass: rolled ? className : "",
      criticalSuccess: rolled && className === "criticalSuccess",
      rollClass: rolled ? "reroll" : "roll",
      rollRole: rolled ? "reroll-save" : "roll-save",
      saveType: cardData.saveType ?? "reflex",
      dc: cardData.dc,
      tooltip: await saveTooltip(cardData.dc, null, null, null, statName),
      hideDie: rolled,
      degreeClass: rolled ? className : "hidden",
      total: rolled ? (state.total ?? "") : "",
      noteHtml,
      applicationHidden:
         rolled && cardData.saveType !== "will" && cardData.damageRoll
            ? ""
            : " hidden",
      applicationOutcome: rolled ? ` ${className}` : "",
      damageApplied: Boolean(state.damageApplied),
      damageButtonsHtml: await renderDamageButtons(outcome),
   })
}

function capitalizedSaveName(saveType) {
   const value = String(saveType || "reflex")
   return value.charAt(0).toUpperCase() + value.slice(1)
}

function cardSummary(cardData, statName) {
   if (cardData.type === "light-burst") {
      return format(
         "PF2ESC.Templar.Cards.LightBurst.Summary",
         { radius: cardData.radius },
         "Each enemy in a {radius}-foot emanation attempts a basic Reflex save.",
      )
   }
   if (cardData.type === "blinding-blade") {
      return localize(
         "PF2ESC.Templar.Cards.BlindingBlade.Summary",
         "After the Strike hits, the struck creature attempts a Reflex save.",
      )
   }
   if (cardData.type === "light-gaol") {
      if (cardData.saveType === "will") {
         return localize(
            "PF2ESC.Templar.Cards.LightGaol.WillSummary",
            "The triggering creature attempts a Will save.",
         )
      }
      return format(
         "PF2ESC.Templar.Cards.LightGaol.BasicSaveSummary",
         { saveType: cardData.saveType },
         "The triggering creature attempts a basic {saveType} save.",
      )
   }
   return localize(
      "PF2ESC.Templar.Cards.BasicReflexSummary",
      "The triggering creature attempts a basic Reflex save.",
   )
}

function cardDefenseText(cardData, statName) {
   if (cardData.saveType === "will") {
      return localize("PF2ESC.Templar.Cards.Will", "Will")
   }
   if (statName === "Reflex") {
      return localize("PF2ESC.Templar.Cards.BasicReflex", "basic Reflex")
   }
   return format(
      "PF2ESC.Templar.Cards.BasicSave",
      { save: statName },
      "basic {save}",
   )
}

function cardDcText(cardData) {
   return Number.isFinite(Number(cardData.dc))
      ? `DC ${cardData.dc}`
      : localize(
           "PF2ESC.Templar.Cards.ClassOrSpellDC",
           "class DC or spell DC",
        )
}

async function renderPendingTargetPrompt(cardData) {
   if (cardData.type !== "blinding-blade") {
      return renderTemplarTemplate("cards/empty-targets", {
         text: localize(
            "PF2ESC.Templar.Cards.NoTargets",
            "No targets were found.",
         ),
      })
   }
   const dc = Number(cardData.dc)
   return renderTemplarTemplate("cards/pending-target", {
      dc: cardData.dc,
      prompt: localize(
         "PF2ESC.Templar.Cards.BlindingBlade.Pending",
         "After the Strike hits, target the struck creature and roll its Reflex save.",
      ),
      saveLabel: Number.isFinite(dc)
         ? format(
              "PF2ESC.Templar.Cards.ReflexSaveDC",
              { dc },
              "Reflex Save DC {dc}",
           )
         : localize("PF2ESC.Templar.Cards.ReflexSave", "Reflex Save"),
   })
}

export async function renderCard(cardData) {
   const statName = capitalizedSaveName(cardData.saveType)
   const targetRows = cardData.targetTokenUuids.length
      ? await Promise.all(
           cardData.targetTokenUuids.map((uuid) =>
              renderTargetRow(cardData.targetDocs[uuid], cardData),
           ),
        )
      : []
   const targetsHtml = targetRows.length
      ? targetRows.join("")
      : await renderPendingTargetPrompt(cardData)
   return renderTemplarTemplate("cards/ability-card", {
      type: cardData.type,
      title: cardData.title,
      icon: cardData.icon,
      summary: cardSummary(cardData, statName),
      defenseLabel: localize("PF2ESC.Templar.Cards.Defense", "Defense"),
      defenseText: cardDefenseText(cardData, statName),
      dcText: cardDcText(cardData),
      traitsHtml: await renderTraits(cardData.traits ?? ABILITY_TRAITS),
      damageHtml: await renderDamageBlock(cardData.damageRoll, statName),
      counteractHtml: await renderCounteract(cardData.counteract),
      targetsHtml,
   })
}
