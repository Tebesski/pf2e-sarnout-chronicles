import { slugify } from "../state.mjs"

export function rollDamageTypes(roll) {
   const types = roll?.instances
      ?.filter?.((instance) => !instance.persistent)
      ?.map?.((instance) => instance.type)
      ?.filter?.(Boolean)
   return [...new Set((types?.length ? types : ["untyped"]).map(slugify))]
}

function instanceDamageType(instance) {
   return (
      slugify(
         instance?.type ??
            instance?.damageType ??
            instance?.head?.type ??
            instance?.head?.damageType ??
            "untyped",
      ) || "untyped"
   )
}

function instanceDamageFormula(instance) {
   return String(
      instance?.head?.term?.expression ??
         instance?.head?.expression ??
         instance?.head?.formula ??
         instance?.formula ??
         "",
   )
}

function instanceComponentTotal(instance, component) {
   try {
      if (typeof instance?.componentTotal !== "function") return 0
      const total = Number(instance.componentTotal(component))
      return Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0
   } catch (_error) {
      return 0
   }
}

function valueHasDamageKeyword(value, keyword, seen = new Set()) {
   if (Array.isArray(value))
      return value.some((entry) => valueHasDamageKeyword(entry, keyword, seen))
   if (value && typeof value === "object") {
      if (seen.has(value)) return false
      seen.add(value)
      return Object.entries(value).some(([key, entry]) => {
         return (
            String(key ?? "")
               .toLowerCase()
               .includes(keyword) || valueHasDamageKeyword(entry, keyword, seen)
         )
      })
   }
   return String(value ?? "")
      .toLowerCase()
      .includes(keyword)
}

function instanceHasPersistentDamage(instance) {
   return Boolean(
      instance?.persistent ||
         valueHasDamageKeyword(instance?.category, "persistent") ||
         valueHasDamageKeyword(instance?.damageCategory, "persistent") ||
         valueHasDamageKeyword(instance?.traits, "persistent") ||
         valueHasDamageKeyword(instanceDamageFormula(instance), "persistent"),
   )
}

function instanceHasPrecisionDamage(instance) {
   return Boolean(
      instanceComponentTotal(instance, "precision") > 0 ||
         instance?.precision ||
         valueHasDamageKeyword(instance?.category, "precision") ||
         valueHasDamageKeyword(instance?.damageCategory, "precision") ||
         valueHasDamageKeyword(instance?.traits, "precision") ||
         valueHasDamageKeyword(instance?.modifiers, "precision") ||
         valueHasDamageKeyword(instanceDamageFormula(instance), "precision"),
   )
}

export function rollHasPersistentDamage(roll) {
   return Array.from(roll?.instances ?? []).some((instance) => {
      return instanceHasPersistentDamage(instance)
   })
}

export function rollHasPrecisionDamage(roll) {
   return Array.from(roll?.instances ?? []).some((instance) => {
      return instanceHasPrecisionDamage(instance)
   })
}

export function damageInstancesFromRoll(roll) {
   const instances = Array.from(roll?.instances ?? [])
      .flatMap((instance) => {
         const persistent = instanceHasPersistentDamage(instance)
         const evaluatePersistent = Boolean(
            instance?.options?.evaluatePersistent,
         )
         const formula = instanceDamageFormula(instance)
         const total =
            persistent && !evaluatePersistent
               ? 0
               : Math.max(0, Math.trunc(Number(instance?.total) || 0))
         const type = instanceDamageType(instance)
         const precisionTotal = persistent
            ? 0
            : Math.min(total, instanceComponentTotal(instance, "precision"))
         const baseTotal = Math.max(0, total - precisionTotal)
         const splitInstances = []
         if (baseTotal > 0 || (persistent && !evaluatePersistent && formula)) {
            splitInstances.push({
               total: baseTotal,
               type,
               formula,
               persistent,
               precision: false,
               evaluatePersistent,
            })
         }
         if (precisionTotal > 0) {
            splitInstances.push({
               total: precisionTotal,
               type,
               formula: "",
               persistent: false,
               precision: true,
               evaluatePersistent: false,
            })
         }
         return splitInstances
      })
      .filter(
         (instance) =>
            instance.total > 0 ||
            (instance.persistent &&
               !instance.evaluatePersistent &&
               instance.formula),
      )
   if (instances.length) return instances
   const total = Math.max(0, Math.trunc(Number(roll?.total) || 0))
   return total > 0
      ? [
           {
              total,
              type: "untyped",
              formula: "",
              persistent: false,
              precision: false,
              evaluatePersistent: false,
           },
        ]
      : []
}

export function rollDataFromDamageRoll(roll) {
   try {
      return typeof roll?.toJSON === "function" ? roll.toJSON() : null
   } catch (_error) {
      return null
   }
}

export function damageTotalFromRoll(roll, fallback = 0) {
   const total = Number(roll?.total ?? fallback)
   return Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0
}

export function damageRollIsCritical(roll) {
   const context = roll?.options?.context ?? roll?.flags?.pf2e?.context ?? {}
   const candidates = [
      roll?.options?.degreeOfSuccess,
      context?.outcome,
      context?.degreeOfSuccess,
      roll?.options?.isCritical,
      roll?.isCritical,
   ]
   return candidates.some((value) => {
      if (value === true) return true
      if (value === 3) return true
      return ["criticalSuccess", "critical-success", "critical"].includes(
         String(value ?? ""),
      )
   })
}
