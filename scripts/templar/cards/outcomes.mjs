export function normalizeOutcome(outcome) {
   if (typeof outcome === "number") {
      return (
         {
            0: "criticalFailure",
            1: "failure",
            2: "success",
            3: "criticalSuccess",
         }[outcome] ?? "failure"
      )
   }
   return (
      {
         "critical-success": "criticalSuccess",
         criticalSuccess: "criticalSuccess",
         criticalsuccess: "criticalSuccess",
         success: "success",
         failure: "failure",
         "critical-failure": "criticalFailure",
         criticalFailure: "criticalFailure",
         criticalfailure: "criticalFailure",
      }[String(outcome ?? "").trim()] ?? "failure"
   )
}

export function outcomeClass(outcome) {
   return normalizeOutcome(outcome)
}

export function outcomeLabel(outcome) {
   return (
      {
         criticalSuccess: "Critical Success",
         success: "Success",
         failure: "Failure",
         criticalFailure: "Critical Failure",
      }[normalizeOutcome(outcome)] ?? "Failure"
   )
}

export function d20TotalFromRoll(roll) {
   const dice = Array.isArray(roll?.dice) ? roll.dice : []
   const die = dice.find((candidate) => Number(candidate?.faces) === 20)
   if (die) {
      const total = Number(die.total)
      if (Number.isFinite(total)) return total
      const result = die.results?.find?.((entry) => entry.active !== false)
      const value = Number(result?.result)
      if (Number.isFinite(value)) return value
   }
   const term = roll?.terms?.find?.(
      (candidate) => Number(candidate?.faces) === 20,
   )
   const termTotal = Number(term?.total)
   return Number.isFinite(termTotal) ? termTotal : null
}

export function outcomeFromRoll(roll, callbackOutcome = null) {
   if (typeof callbackOutcome === "number")
      return normalizeOutcome(callbackOutcome)
   if (typeof callbackOutcome === "string")
      return normalizeOutcome(callbackOutcome)
   if (callbackOutcome?.outcome)
      return normalizeOutcome(callbackOutcome.outcome)
   const callbackDos =
      callbackOutcome?.degreeOfSuccess?.value ??
      callbackOutcome?.degreeOfSuccess ??
      callbackOutcome?.degree
   if (typeof callbackDos === "string") return normalizeOutcome(callbackDos)
   if (typeof roll?.degreeOfSuccess === "string") {
      return normalizeOutcome(roll.degreeOfSuccess)
   }
   let degree =
      callbackDos ?? roll?.degreeOfSuccess?.value ?? roll?.degreeOfSuccess ?? 1
   const d20 = d20TotalFromRoll(roll)
   if (d20 === 20) degree = Math.min(3, Number(degree) + 1)
   else if (d20 === 1) degree = Math.max(0, Number(degree) - 1)
   return normalizeOutcome(Number(degree))
}
