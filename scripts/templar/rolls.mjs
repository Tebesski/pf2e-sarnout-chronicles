import { getDamageRollClass } from "./damage.mjs"

function clamp(value, min, max) {
   return Math.max(min, Math.min(max, value))
}

function degreeFromOutcome(outcome) {
   if (outcome === "criticalFailure") return 0
   if (outcome === "failure") return 1
   if (outcome === "success") return 2
   if (outcome === "criticalSuccess") return 3
   return null
}

function rollObject(result) {
   if (Array.isArray(result)) return result[0]
   return result?.rolls?.[0] ?? result
}

function naturalD20(roll) {
   const candidates = [
      roll?.dice?.[0]?.total,
      roll?.dice?.[0]?.results?.[0]?.result,
      roll?.terms?.[0]?.results?.[0]?.result,
   ]
   return candidates
      .map((value) => Number(value))
      .find((value) => Number.isFinite(value))
}

export function degreeOfSuccessFromRoll(result, dc) {
   const contextOutcome = degreeFromOutcome(
      result?.flags?.pf2e?.context?.outcome,
   )
   if (contextOutcome !== null) return contextOutcome
   const roll = rollObject(result)
   const rollDegree = Number(
      roll?.degreeOfSuccess ?? roll?.options?.degreeOfSuccess,
   )
   if (Number.isFinite(rollDegree)) return clamp(Math.trunc(rollDegree), 0, 3)

   const total = Number(roll?.total)
   if (!Number.isFinite(total)) return null
   let degree =
      total >= dc + 10 ? 3 : total >= dc ? 2 : total <= dc - 10 ? 0 : 1
   const natural = naturalD20(roll)
   if (natural === 20) degree += 1
   if (natural === 1) degree -= 1
   return clamp(degree, 0, 3)
}

export function degreeLabel(degree) {
   return ["Critical Failure", "Failure", "Success", "Critical Success"][
      clamp(Math.trunc(Number(degree) || 0), 0, 3)
   ]
}

export function lightBurstDamageFormula(details) {
   return `${details.dice}d6[fire],${details.dice}d6[spirit]`
}

export async function rollTemplarDamageFormula(formula, rollOptions = []) {
   if (!formula) return null
   try {
      const DamageRoll = getDamageRollClass() ?? Roll
      let roll = null
      let plainInstances = null
      try {
         roll = await new DamageRoll(formula, {}, { rollOptions }).evaluate({
            allowInteractive: false,
         })
      } catch (_error) {
         plainInstances = []
         let plainTotal = 0
         for (const part of String(formula)
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)) {
            const partRoll = await new Roll(
               String(part).replace(/\[[^\]]+\]/g, ""),
            ).evaluate({ allowInteractive: false })
            plainTotal += Number(partRoll.total) || 0
            plainInstances.push({
               formula: String(part).replace(/\[.*?\]/g, ""),
               type:
                  /\[([a-z0-9-]+)(?:,[^\]]*)?\]/i.exec(String(part))?.[1] ??
                  "untyped",
               total: partRoll.total,
            })
         }
         roll = { total: plainTotal }
      }
      const formulaParts = String(formula)
         .split(",")
         .map((value) => value.trim())
         .filter(Boolean)
      const instances =
         plainInstances ??
         (roll.instances
            ? roll.instances.map((instance, index) => {
                 const sourceFormula =
                    instance.formula ??
                    instance.head?.expression ??
                    String(formula).split(",")[index] ??
                    ""
                 return {
                    formula: String(sourceFormula).replace(/\[.*?\]/g, ""),
                    type:
                       /\[([a-z0-9-]+)(?:,[^\]]*)?\]/i.exec(
                          String(sourceFormula),
                       )?.[1] ??
                       (instance.type !== "untyped" ? instance.type : null) ??
                       "untyped",
                    total: instance.total,
                 }
              })
            : formulaParts.length
              ? formulaParts.map((part, index) => {
                   const die = roll.dice?.[index]
                   const diceTotal = Array.from(die?.results ?? []).reduce(
                      (sum, result) =>
                         sum + (Number(result.result ?? result.value) || 0),
                      0,
                   )
                   return {
                      formula: String(part).replace(/\[.*?\]/g, ""),
                      type:
                         /\[([a-z0-9-]+)(?:,[^\]]*)?\]/i.exec(
                            String(part),
                         )?.[1] ?? "untyped",
                      total:
                         diceTotal ||
                         (formulaParts.length === 1 ? roll.total : 0),
                   }
                })
              : [
                   {
                      formula: String(formula).replace(/\[.*?\]/g, ""),
                      type:
                         /\[([a-z0-9-]+)(?:,[^\]]*)?\]/i.exec(
                            String(formula),
                         )?.[1] ?? "untyped",
                      total: roll.total,
                   },
                ])
      return {
         total: roll.total,
         formula,
         rollJSON: plainInstances
            ? null
            : typeof roll.toJSON === "function"
              ? JSON.stringify(roll.toJSON())
              : null,
         instances,
      }
   } catch (_error) {
      const fallbackParts = String(formula)
         .split(",")
         .map((value) => value.trim())
         .filter(Boolean)
      return {
         total: formula,
         formula,
         rollJSON: null,
         instances: fallbackParts.length
            ? fallbackParts.map((part) => ({
                 formula: String(part).replace(/\[.*?\]/g, ""),
                 type:
                    /\[([a-z0-9-]+)(?:,[^\]]*)?\]/i.exec(String(part))?.[1] ??
                    "untyped",
                 total: part,
              }))
            : [
                 {
                    formula: String(formula).replace(/\[.*?\]/g, ""),
                    type:
                       /\[([a-z0-9-]+)(?:,[^\]]*)?\]/i.exec(
                          String(formula),
                       )?.[1] ?? "untyped",
                    total: formula,
                 },
              ],
      }
   }
}
