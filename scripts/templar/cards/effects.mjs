import { normalizeOutcome } from "./outcomes.mjs"

export function effectPlanForOutcome(
   type,
   outcome,
   barrierShattered = false,
   saveType = null,
) {
   const normalized = normalizeOutcome(outcome)
   if (type === "light-burst") {
      return barrierShattered && normalized === "criticalFailure"
         ? [{ slug: "prone", value: 1, unit: "rounds", label: "Prone" }]
         : []
   }
   if (type === "light-gaol" || type === "blinding-blade") {
      if (saveType !== "reflex") return []
      if (normalized === "failure") {
         return [{ slug: "blinded", value: 1, unit: "rounds", label: "Blinded" }]
      }
      if (normalized === "criticalFailure") {
         return [{ slug: "blinded", value: 2, unit: "rounds", label: "Blinded" }]
      }
      return []
   }
   if (type !== "inculpation") return []
   if (normalized === "success") {
      return [{ slug: "dazzled", value: 1, unit: "rounds", label: "Dazzled" }]
   }
   if (normalized === "failure") {
      return [{ slug: "dazzled", value: 1, unit: "minutes", label: "Dazzled" }]
   }
   if (normalized === "criticalFailure") {
      return [
         { slug: "blinded", value: 1, unit: "rounds", label: "Blinded" },
         { slug: "dazzled", value: 1, unit: "minutes", label: "Dazzled" },
      ]
   }
   return []
}
