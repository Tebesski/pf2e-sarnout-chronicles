import { actorLevel } from "../state.mjs"
import { CARD_ROLL_OPTIONS } from "./constants.mjs"

function damageDiceForActor(actor) {
   return Math.max(1, Math.floor((actorLevel(actor) - 4) / 2) + 1)
}

export function lightBurstRadius(actor) {
   return actorLevel(actor) >= 12 ? 10 : 5
}

function statisticDC(statistic) {
   return Number(statistic?.dc?.value ?? statistic?.dc)
}

export function actorClassOrSpellDC(actor) {
   const candidates = [
      statisticDC(actor?.getStatistic?.("class-spell")),
      statisticDC(actor?.getStatistic?.("class-dc")),
      statisticDC(actor?.getStatistic?.("class")),
      Number(actor?.system?.attributes?.classDC?.value),
      Number(actor?.system?.attributes?.classOrSpellDC?.value),
      Number(actor?.system?.attributes?.spellDC?.value),
   ]
   const spellcasting = actor?.spellcasting?.collections
   if (typeof spellcasting?.values === "function") {
      for (const entry of spellcasting.values()) {
         candidates.push(statisticDC(entry?.statistic))
      }
   }
   const values = candidates.filter(
      (value) => Number.isFinite(value) && value > 0,
   )
   return values.length ? Math.max(...values) : null
}

function damageFormula(actor) {
   const dice = damageDiceForActor(actor)
   return `${dice}d6[fire],${dice}d6[spirit]`
}

function getDamageRollClass() {
   return (
      CONFIG?.Dice?.rolls?.find?.((cls) => cls.name === "DamageRoll") ??
      game?.pf2e?.DamageRoll ??
      globalThis.DamageRoll ??
      Roll
   )
}

function stripDamageTags(formula) {
   return String(formula ?? "").replace(/\[[^\]]+\]/g, "")
}

function plainRollFormula(formula) {
   return stripDamageTags(formula).replace(/,/g, " + ")
}

function formulaPart(formula, index) {
   return (
      String(formula ?? "")
         .split(",")
         [index]?.trim() ?? String(formula ?? "")
   )
}

function damageTypeFromFormula(formula) {
   return (
      /\[([a-z0-9-]+)(?:,[^\]]*)?\]/i.exec(String(formula ?? ""))?.[1] ?? null
   )
}

function diceResultsForInstance(instance, roll, index) {
   const diceSource =
      instance?.dice ??
      instance?.head?.dice ??
      (roll?.dice?.[index] ? [roll.dice[index]] : [])
   return Array.from(diceSource).flatMap((die) => {
      const faces = Number(die.faces) || Number(die.number) || 20
      return Array.from(die.results ?? []).map((result) => ({
         faces,
         value: Number(result.result ?? result.value ?? 0) || 0,
      }))
   })
}

export function rollDataFromRoll(roll, formula) {
   const formulaParts = String(formula ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
   const instances = Array.isArray(roll.instances)
      ? roll.instances.map((instance, index) => {
           const sourceFormula = String(
              instance.formula ??
                 instance.head?.expression ??
                 formulaPart(formula, index),
           )
           return {
              formula: stripDamageTags(sourceFormula),
              type:
                 damageTypeFromFormula(sourceFormula) ??
                 damageTypeFromFormula(formulaPart(formula, index)) ??
                 (instance.type !== "untyped" ? instance.type : null) ??
                 (instance.damageType !== "untyped"
                    ? instance.damageType
                    : null) ??
                 "untyped",
              total: Number(instance.total) || 0,
              dice: diceResultsForInstance(instance, roll, index),
           }
        })
      : []
   if (instances.length === 0) {
      for (const [index, part] of formulaParts.entries()) {
         const dice = diceResultsForInstance(null, roll, index)
         instances.push({
            formula: stripDamageTags(part),
            type: damageTypeFromFormula(part) ?? "untyped",
            total: dice.length
               ? dice.reduce((sum, die) => sum + die.value, 0)
               : 0,
            dice,
         })
      }
      if (instances.length === 0) {
         instances.push({
            formula: stripDamageTags(formula),
            type: damageTypeFromFormula(formula) ?? "untyped",
            total: Number(roll.total) || 0,
            dice: diceResultsForInstance(null, roll, 0),
         })
      }
   }
   return {
      formula,
      total: Number(roll.total) || 0,
      rollJSON:
         typeof roll.toJSON === "function"
            ? JSON.stringify(roll.toJSON())
            : null,
      instances,
   }
}

export async function rollDamageOnce(actor) {
   const formula = damageFormula(actor)
   return rollDamageFormula(formula)
}

export async function rollDamageFormula(formula) {
   const DamageRoll = getDamageRollClass()
   let roll = null
   try {
      roll = await new DamageRoll(
         formula,
         {},
         { rollOptions: CARD_ROLL_OPTIONS },
      ).evaluate({ allowInteractive: false })
   } catch (error) {
      if (DamageRoll === Roll) throw error
      return rollPlainDamageParts(formula)
   }
   const data = rollDataFromRoll(roll, formula)
   if (
      data.total > 0 &&
      data.instances.every((instance) => !Number(instance.total))
   ) {
      return rollPlainDamageParts(formula)
   }
   return data
}

export async function rollPlainDamageParts(formula) {
   const instances = []
   let total = 0
   for (const part of String(formula ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)) {
      const roll = await new Roll(plainRollFormula(part)).evaluate({
         allowInteractive: false,
      })
      const partTotal = Number(roll.total) || 0
      total += partTotal
      instances.push({
         formula: stripDamageTags(part),
         type: damageTypeFromFormula(part) ?? "untyped",
         total: partTotal,
         dice: diceResultsForInstance(null, roll, 0),
      })
   }
   return {
      formula,
      total,
      rollJSON: null,
      instances,
   }
}

export function scaleRollTotal(roll, scale, total) {
   try {
      Object.defineProperty(roll, "_total", {
         value: total,
         configurable: true,
         writable: true,
      })
   } catch (_error) {
      roll._total = total
   }
   for (const instance of roll.instances ?? []) {
      const instanceTotal = Math.max(
         0,
         Math.floor((Number(instance.total) || 0) * scale),
      )
      try {
         Object.defineProperty(instance, "_total", {
            value: instanceTotal,
            configurable: true,
            writable: true,
         })
      } catch (_error) {
         instance._total = instanceTotal
      }
   }
}

export async function damageRollFromInstances(damage, scale = 1) {
   const DamageRoll = getDamageRollClass()
   if (!DamageRoll || !Array.isArray(damage?.instances)) return null
   const parts = damage.instances
      .map((instance) => {
         const type = instance.type || "untyped"
         const total = Math.max(
            0,
            Math.floor((Number(instance.total) || 0) * scale),
         )
         return total > 0 ? `${total}[${type}]` : null
      })
      .filter(Boolean)
   if (!parts.length) return null
   try {
      return await new DamageRoll(
         parts.join(","),
         {},
         { rollOptions: CARD_ROLL_OPTIONS },
      ).evaluate({ allowInteractive: false })
   } catch (_error) {
      return null
   }
}
