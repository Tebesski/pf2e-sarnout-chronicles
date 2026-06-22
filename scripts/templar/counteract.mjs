import { MODULE_ID } from "./constants.mjs"
import { getActor } from "./actors.mjs"
import { debugTemplar } from "./debug.mjs"
import { degreeLabel, degreeOfSuccessFromRoll } from "./rolls.mjs"
import { spellRankForActor } from "./state.mjs"
import { renderTemplarTemplate } from "./templates.mjs"

function escapeHtml(value) {
   return foundry.utils.escapeHTML?.(String(value ?? "")) ?? String(value ?? "")
}

function counteractSpellcastingEntries(actor) {
   return (
      actor?.itemTypes?.spellcastingEntry ?? actor?.spellcasting?.contents ?? []
   )
}

function counteractEntryModifiers(entry) {
   return (
      entry?.statistic?.check?.modifiers ??
      entry?.statistic?.modifiers ??
      entry?.check?.modifiers ??
      []
   )
}

function modifierValue(modifier) {
   if (!modifier || modifier.enabled === false || modifier.ignored === true)
      return 0
   const value = Number(modifier.modifier ?? modifier.value ?? 0)
   return Number.isFinite(value) ? value : 0
}

function counteractModifierTotal(modifiers = []) {
   const CheckModifier = game.pf2e?.CheckModifier
   if (typeof CheckModifier === "function") {
      try {
         const check = new CheckModifier("Counteract Check", { modifiers })
         const total = Number(
            check.totalModifier ?? check.modifier ?? check.total ?? check.value,
         )
         if (Number.isFinite(total)) return total
      } catch (error) {
         debugTemplar("PF2e CheckModifier counteract total failed", { error })
      }
   }
   return modifiers.reduce((sum, modifier) => sum + modifierValue(modifier), 0)
}

function signedFormulaBonus(bonus) {
   const value = Math.trunc(Number(bonus) || 0)
   if (value > 0) return ` + ${value}`
   if (value < 0) return ` - ${Math.abs(value)}`
   return ""
}

function counteractSucceeds(degree, counteractLevel, targetLevel) {
   const difference =
      Math.trunc(Number(targetLevel) || 0) -
      Math.trunc(Number(counteractLevel) || 0)
   if (difference >= 4) return false
   if (difference >= 2) return degree === 3
   if (difference >= 0) return degree >= 2
   return degree > 0
}

function counteractSpellcastingOptions(actor) {
   const entries = counteractSpellcastingEntries(actor)
   return entries.map((entry, index) => ({
      id: index,
      label: entry?.name ?? entry?.label ?? `Spellcasting ${index + 1}`,
   }))
}

function dialogSubmittedField(event, button, form, name) {
   const selector = `[name='${name}']`
   const element =
      form?.querySelector?.(selector) ??
      button?.form?.elements?.[name] ??
      event?.currentTarget?.form?.elements?.[name] ??
      event?.target?.closest?.("form")?.elements?.[name] ??
      event?.currentTarget?.closest?.("form")?.elements?.[name]
   if (element) return element.value

   if (typeof form?.get === "function") return form.get(name)
   if (form?.object && name in form.object) return form.object[name]
   if (form && name in form) return form[name]
   return undefined
}

function bindCounteractDialog(element) {
   const root = element?.querySelector?.(".ssc-counteract-dialog") ?? element
   const dcInput = root?.querySelector?.("input[name='dc']")
   if (!dcInput) return
   const dialog = root.closest?.(".application, .dialog, form") ?? document
   const counteractButtons = () =>
      Array.from(
         dialog.querySelectorAll?.(
            "button[data-action='counteract'], button[value='counteract'], button[data-button='counteract']",
         ) ?? [],
      )
   const update = () => {
      const hasDc = String(dcInput.value ?? "").trim().length > 0
      for (const button of counteractButtons()) button.disabled = !hasDc
   }
   dcInput.addEventListener("input", update)
   update()
   setTimeout(update, 0)
}

export async function promptCounteractOptions(
   actor,
   {
      title = "Counteract",
      defaultDc = "",
      defaultCounteractLevel = spellRankForActor(actor),
      defaultTargetLevel = spellRankForActor(actor),
   } = {},
) {
   const entries = counteractSpellcastingEntries(actor)
   if (entries.length === 0) {
      ui.notifications?.warn(
         "Actor has no spellcasting entry for counteracting.",
      )
      return null
   }
   const content = await renderTemplarTemplate("counteract-dialog", {
      defaultDc: defaultDc ?? "",
      defaultCounteractLevel: defaultCounteractLevel ?? "",
      defaultTargetLevel: defaultTargetLevel ?? "",
      spellcastingOptions: counteractSpellcastingOptions(actor),
   })
   const DialogV2 = foundry.applications.api.DialogV2
   if (!DialogV2?.wait) {
      ui.notifications?.warn("Foundry DialogV2 is unavailable.")
      return null
   }
   const result = await DialogV2.wait({
      window: { title },
      content,
      buttons: [
         {
            action: "counteract",
            label: "Counteract",
            icon: "fa-solid fa-wand-sparkles",
            callback: (event, button, form) => {
               const read = (name) =>
                  dialogSubmittedField(event, button, form, name)
               return {
                  dc: Number(read("dc")),
                  counteractLevel: Number(read("counteractLevel")),
                  targetLevel: Number(read("targetLevel")),
                  spellcastingIndex: Number(read("spellcasting")),
               }
            },
         },
         {
            action: "cancel",
            label: "Cancel",
            callback: () => null,
         },
      ],
      default: "counteract",
      position: { width: 460 },
      render: (_event, dialog) =>
         bindCounteractDialog(dialog?.element ?? dialog),
   }).catch(() => null)

   if (!result) return null
   if (
      !Number.isFinite(result.dc) ||
      result.dc <= 0 ||
      !Number.isFinite(result.counteractLevel) ||
      result.counteractLevel < 0 ||
      !Number.isFinite(result.targetLevel) ||
      result.targetLevel < 0
   ) {
      ui.notifications?.warn(
         "Counteract requires a DC, counteract level, and target level.",
      )
      return null
   }
   if (!entries[Math.trunc(result.spellcastingIndex)]) {
      ui.notifications?.warn("Choose a spellcasting entry.")
      return null
   }
   return {
      ...result,
      dc: Math.trunc(result.dc),
      counteractLevel: Math.trunc(result.counteractLevel),
      targetLevel: Math.trunc(result.targetLevel),
      spellcastingIndex: Math.trunc(result.spellcastingIndex),
   }
}

function actorCounteractRollOptions(actor) {
   let fromActor = []
   for (const args of [[["all", "counteract"]], ["all"], []]) {
      try {
         const result = actor?.getRollOptions?.(...args)
         if (Array.isArray(result)) {
            fromActor = result
            break
         }
      } catch (_error) {
         undefined
      }
   }
   return [
      ...new Set([
         ...(Array.isArray(fromActor) ? fromActor : []),
         "counteract",
      ]),
   ]
}

export function degreeFromCheckRoll(roll, dc) {
   const candidates = [
      roll?.degreeOfSuccess,
      roll?.options?.degreeOfSuccess,
      roll?.flags?.pf2e?.context?.degreeOfSuccess,
      roll?.flags?.pf2e?.context?.outcome,
      roll?.options?.outcome,
   ]
   for (const candidate of candidates) {
      if (typeof candidate === "object" && candidate !== null) {
         const value = Number(
            candidate.value ?? candidate.degree ?? candidate.total,
         )
         if (Number.isFinite(value)) return value
      }
      const value = Number(candidate)
      if (Number.isFinite(value)) return value
      const text = String(candidate ?? "")
      if (
         ["criticalSuccess", "critical-success", "critical success"].includes(
            text,
         )
      )
         return 3
      if (["success"].includes(text)) return 2
      if (["failure"].includes(text)) return 1
      if (
         ["criticalFailure", "critical-failure", "critical failure"].includes(
            text,
         )
      )
         return 0
   }
   return degreeOfSuccessFromRoll(roll, dc) ?? 0
}

export async function rollCounteract(
   actor,
   options,
   { postRoll = true } = {},
) {
   const entries = counteractSpellcastingEntries(actor)
   const entry = entries[options.spellcastingIndex]
   const modifiers = counteractEntryModifiers(entry)
   const bonus = counteractModifierTotal(modifiers)
   const formula = `1d20${signedFormulaBonus(bonus)}`
   let roll = null
   let messagePosted = false
   let attemptedPf2eCheck = false

   const Check = game.pf2e?.Check
   const CheckModifier = game.pf2e?.CheckModifier
   if (
      postRoll &&
      typeof Check?.roll === "function" &&
      typeof CheckModifier === "function"
   ) {
      try {
         attemptedPf2eCheck = true
         const check = new CheckModifier("Counteract Check", { modifiers })
         roll = await Check.roll(check, {
            actor,
            type: "counteract-check",
            dc: { value: options.dc },
            domains: ["all", "counteract"],
            options: actorCounteractRollOptions(actor),
            rollMode: game.settings?.get?.("core", "rollMode"),
            skipDialog: false,
            title: "Counteract Check",
            flavor: `<h4 class="action"><strong>Counteract Check</strong></h4>`,
         })
         messagePosted = Boolean(roll)
      } catch (error) {
         attemptedPf2eCheck = false
         debugTemplar("PF2e counteract check failed; falling back to Roll", {
            actor: actor?.name,
            error,
         })
      }
   }

   if (!roll && attemptedPf2eCheck) return null
   if (!roll) roll = await new Roll(formula).evaluate()
   const degree = degreeFromCheckRoll(roll, options.dc)
   const success = counteractSucceeds(
      degree,
      options.counteractLevel,
      options.targetLevel,
   )
   return {
      roll,
      total: Number(roll.total) || 0,
      formula,
      bonus,
      dc: options.dc,
      degree,
      degreeLabel: degreeLabel(degree),
      success,
      messagePosted,
      counteractLevel: options.counteractLevel,
      targetLevel: options.targetLevel,
      source: entry?.name ?? "Spellcasting",
   }
}

export async function postCounteractOutcomeMessage(result) {
   if (!result) return null
   return ChatMessage.create({
      speaker: { alias: "Gamemaster" },
      content: result.success ? "Counteract succeed" : "Counteract fail",
      flags: {
         [MODULE_ID]: {
            templarMessage: true,
            counteractOutcome: true,
         },
      },
   })
}

export async function counteract({
   actor,
   title = "Counteract",
   postRoll = true,
   postSummary = true,
   defaultDc = "",
   defaultCounteractLevel = null,
   defaultTargetLevel = null,
   fixedCounteractLevel = null,
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   const options = await promptCounteractOptions(resolved, {
      title,
      defaultDc,
      defaultCounteractLevel:
         defaultCounteractLevel ?? spellRankForActor(resolved),
      defaultTargetLevel: defaultTargetLevel ?? spellRankForActor(resolved),
   })
   if (!options) return null
   if (fixedCounteractLevel !== null && fixedCounteractLevel !== undefined) {
      options.counteractLevel = Math.max(
         0,
         Math.trunc(Number(fixedCounteractLevel) || 0),
      )
   }

   const result = await rollCounteract(resolved, options, { postRoll })
   if (!result) return null
   if (postRoll) {
      if (!result.messagePosted) {
         await result.roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: resolved }),
            flavor: `<h4 class="action"><strong>Counteract Check</strong></h4><div class="target-dc-result" data-tooltip-class="pf2e" data-tooltip-direction="UP"><div class="target-dc" data-visibility="gm"><span data-visibility="gm" data-whose="opposer">DC ${escapeHtml(result.dc)}</span></div><div class="result degree-of-success">Result: <span>${escapeHtml(result.degreeLabel)}</span></div></div>`,
         })
      }
   } else {
      try {
         await game.dice3d?.showForRoll?.(result.roll, game.user, true)
      } catch (_error) {
         undefined
      }
   }
   if (postSummary) {
      await postCounteractOutcomeMessage(result)
   }
   return result
}
