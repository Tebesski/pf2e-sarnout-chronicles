import {
   normalizeOutcome,
   outcomeClass,
   outcomeLabel,
} from "./outcomes.mjs"
import {
   renderDamageButtons,
   renderOutcomeNote,
   saveTooltip,
} from "./rendering.mjs"

export async function renderSaveResult(control, row, roll, outcome, d20, data) {
   const normalized = normalizeOutcome(outcome)
   const className = outcomeClass(normalized)
   if (row) {
      row.dataset.rolled = "true"
      row.dataset.outcome = className
      row.classList.toggle(
         "crit-success-row",
         className === "criticalSuccess",
      )
   }
   const degree = control.querySelector(".degree")
   if (degree) {
      degree.textContent = String(roll.total ?? "")
      degree.classList.remove(
         "hidden",
         "critical-success",
         "success",
         "failure",
         "critical-failure",
         "criticalSuccess",
         "criticalFailure",
      )
      degree.classList.add("show", className)
      degree.dataset.tooltip = outcomeLabel(normalized)
      degree.title = outcomeLabel(normalized)
   }
   control.classList.remove("roll")
   control.classList.add("reroll")
   control.dataset.sscTemplarCardRole = "reroll-save"
   control.dataset.tooltip = await saveTooltip(data.dc, roll, normalized, d20)
   control.querySelector(".die")?.classList.add("hidden")
   const note = row?.querySelector(".ssc-templar-card-target-note")
   if (note) {
      const noteHtml = await renderOutcomeNote(
         data.type,
         normalized,
         data.barrierShattered,
         [],
         data.saveType,
      )
      note.innerHTML = noteHtml
      note.classList.toggle("hidden", !noteHtml)
   }
   const application = row?.querySelector(".ssc-templar-card-application")
   if (application) {
      application.classList.remove(
         "hidden",
         "applied",
         "criticalSuccess",
         "success",
         "failure",
         "criticalFailure",
         "critical-success",
         "critical-failure",
      )
      if (data.saveType === "will") {
         application.classList.add("hidden")
      } else {
         application.classList.add(className)
         application.innerHTML = await renderDamageButtons(normalized)
      }
   }
}
