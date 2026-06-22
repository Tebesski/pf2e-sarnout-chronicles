import { TEMPLAR_SLUGS } from "./constants.mjs"
import { actorHasSlug, slugify } from "./state.mjs"

const PHYSICAL_DAMAGE_TYPES = new Set(["bludgeoning", "piercing", "slashing"])

export function getDamageRollClass() {
   return CONFIG?.Dice?.rolls?.find?.(
      (rollClass) => rollClass.name === "DamageRoll",
   )
}

export function primaryDamageType(damageTypes = []) {
   return damageTypes.find((type) => type && type !== "untyped") ?? "untyped"
}

export function damageTypeLabel(type) {
   const key = CONFIG?.PF2E?.damageTypes?.[type]
   return key ? (game.i18n?.localize?.(key) ?? type) : type
}

export function damageContextHasExcludedBarrierDamage(context) {
   return Boolean(context?.hasPersistentDamage || context?.hasPrecisionDamage)
}

function damageInstancesFromContext(context) {
   const existing = Array.isArray(context?.damageInstances)
      ? context.damageInstances
      : []
   if (existing.length) {
      return existing
         .map((instance) => ({
            total: Math.max(0, Math.trunc(Number(instance?.total) || 0)),
            type: slugify(instance?.type ?? "untyped") || "untyped",
            formula: String(instance?.formula ?? ""),
            persistent: Boolean(instance?.persistent),
            precision: Boolean(instance?.precision),
            evaluatePersistent: Boolean(instance?.evaluatePersistent),
         }))
         .filter((instance) => {
            return (
               instance.total > 0 ||
               (instance.persistent &&
                  !instance.evaluatePersistent &&
                  instance.formula)
            )
         })
   }
   const total = Math.max(0, Math.trunc(Number(context?.total) || 0))
   if (total <= 0) return []
   return [
      {
         total,
         type: slugify(context?.damageType ?? "untyped") || "untyped",
         formula: "",
         persistent: Boolean(context?.hasPersistentDamage),
         precision: Boolean(context?.hasPrecisionDamage),
         evaluatePersistent: false,
      },
   ]
}

function contextFromDamageInstances(base, damageInstances) {
   const instances = damageInstances
      .map((instance) => ({
         total: Math.max(0, Math.trunc(Number(instance?.total) || 0)),
         type: slugify(instance?.type ?? "untyped") || "untyped",
         formula: String(instance?.formula ?? ""),
         persistent: Boolean(instance?.persistent),
         precision: Boolean(instance?.precision),
         evaluatePersistent: Boolean(instance?.evaluatePersistent),
      }))
      .filter((instance) => {
         return (
            instance.total > 0 ||
            (instance.persistent &&
               !instance.evaluatePersistent &&
               instance.formula)
         )
      })
   const damageTypes = [...new Set(instances.map((instance) => instance.type))]
   return {
      ...base,
      roll: null,
      rollData: null,
      total: instances.reduce((sum, instance) => sum + instance.total, 0),
      damageType: primaryDamageType(damageTypes),
      damageTypes: damageTypes.length ? damageTypes : ["untyped"],
      damageInstances: instances,
      hasPersistentDamage: instances.some((instance) => instance.persistent),
      hasPrecisionDamage: instances.some((instance) => instance.precision),
   }
}

export function canUsePhysicalBarrierAgainstDamage(
   actor,
   context,
   { assumePhysical = false } = {},
) {
   return damageInstancesFromContext(context).some((instance) => {
      if (instance.persistent || instance.precision) return false
      if (assumePhysical || PHYSICAL_DAMAGE_TYPES.has(slugify(instance.type)))
         return true
      const traits = context?.traits ?? new Set()
      const hasLightProtectsTrait =
         traits.has("darkness") || traits.has("shadow") || traits.has("unholy")
      return (
         hasLightProtectsTrait &&
         actorHasSlug(actor, TEMPLAR_SLUGS.lightProtects)
      )
   })
}

export function canUseReactiveOrHoldingAgainstDamage(
   actor,
   context,
   { assumePhysical = false } = {},
) {
   return (
      splitDamageContextForBarrier(actor, context, { allowAllProtecting: true })
         .barrier.total > 0 ||
      (assumePhysical && !damageContextHasExcludedBarrierDamage(context))
   )
}

function rollDamageTypes(roll) {
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

function rollHasPersistentDamage(roll) {
   return Array.from(roll?.instances ?? []).some((instance) => {
      return instanceHasPersistentDamage(instance)
   })
}

function rollHasPrecisionDamage(roll) {
   return Array.from(roll?.instances ?? []).some((instance) => {
      return instanceHasPrecisionDamage(instance)
   })
}

function damageInstancesFromRoll(roll) {
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

function reduceDamageInstances(instances, reduction) {
   let remainingReduction = Math.max(0, Math.trunc(Number(reduction) || 0))
   const next = []
   for (const instance of damageInstancesFromContext({
      damageInstances: instances,
   })) {
      const prevented = Math.min(instance.total, remainingReduction)
      remainingReduction -= prevented
      const total = instance.total - prevented
      if (total > 0) next.push({ ...instance, total })
   }
   return next
}

function damageInstanceEligibleForBarrier(
   actor,
   instance,
   context,
   { allowAllProtecting = true } = {},
) {
   if (instance.persistent || instance.precision) return false
   if (PHYSICAL_DAMAGE_TYPES.has(slugify(instance.type))) return true
   const traits = context?.traits ?? new Set()
   const isProtectedTrait =
      traits.has("darkness") || traits.has("shadow") || traits.has("unholy")
   if (isProtectedTrait && actorHasSlug(actor, TEMPLAR_SLUGS.lightProtects))
      return true
   return Boolean(
      allowAllProtecting &&
         actorHasSlug(actor, TEMPLAR_SLUGS.allProtectingLight),
   )
}

export function splitDamageContextForBarrier(
   actor,
   context,
   { allowAllProtecting = true } = {},
) {
   const instances = damageInstancesFromContext(context)
   const eligible = []
   const passthrough = []
   for (const instance of instances) {
      if (
         damageInstanceEligibleForBarrier(actor, instance, context, {
            allowAllProtecting,
         })
      ) {
         eligible.push(instance)
      } else {
         passthrough.push(instance)
      }
   }
   return {
      barrier: contextFromDamageInstances(context, eligible),
      passthrough: contextFromDamageInstances(context, passthrough),
   }
}

export function reduceDamageContextByAmount(context, reduction) {
   return contextFromDamageInstances(
      context,
      reduceDamageInstances(damageInstancesFromContext(context), reduction),
   )
}

export function mergeDamageContexts(contexts = []) {
   const instances = contexts.flatMap((context) =>
      damageInstancesFromContext(context),
   )
   return contextFromDamageInstances(contexts.find(Boolean) ?? {}, instances)
}

export function damageGroupTraits(group) {
   return [group.type || "untyped", group.persistent ? "persistent" : ""]
      .filter(Boolean)
      .join(",")
}

export function groupDamageInstances(instances, { bypassIWR = false } = {}) {
   const groups = new Map()
   for (const instance of damageInstancesFromContext({
      damageInstances: instances,
   })) {
      const key = [
         instance.type,
         instance.persistent ? "persistent" : "",
         instance.precision ? "precision" : "",
         instance.evaluatePersistent ? "evaluatePersistent" : "",
         bypassIWR ? "bypass" : "typed",
      ].join("|")
      const group = groups.get(key) ?? {
         type: instance.type,
         persistent: instance.persistent,
         precision: instance.precision,
         evaluatePersistent: instance.evaluatePersistent,
         bypassIWR,
         total: 0,
      }
      group.total += instance.total
      groups.set(key, group)
   }
   return [...groups.values()]
}

function rollDataFromDamageRoll(roll) {
   try {
      return typeof roll?.toJSON === "function" ? roll.toJSON() : null
   } catch (_error) {
      return null
   }
}

function damageTotalFromRoll(roll, fallback = 0) {
   const total = Number(roll?.total ?? fallback)
   return Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0
}

function damageRollIsCritical(roll) {
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

export function damageContextFromRoll(
   roll,
   { multiplier = 1, addend = 0 } = {},
) {
   const baseTotal = damageTotalFromRoll(roll)
   const fallbackTotal = Math.max(
      0,
      Math.trunc(baseTotal * Number(multiplier || 1) + Number(addend || 0)),
   )
   const alteredRoll =
      multiplier === 1 && addend === 0
         ? roll
         : typeof roll?.alter === "function"
           ? roll.alter(multiplier, addend)
           : null
   const total = damageTotalFromRoll(alteredRoll ?? roll, fallbackTotal)
   const activeRoll = alteredRoll ?? roll
   const damageTypes = rollDamageTypes(activeRoll)
   const damageInstances = damageInstancesFromRoll(activeRoll)

   const rollOptions = [
      ...(activeRoll?.options?.options ?? []),
      ...(activeRoll?.options?.traits ?? []),
      ...(activeRoll?.terms?.flatMap((t) => t.options?.traits ?? []) ?? []),
      ...(activeRoll?.options?.context?.options ?? []),
      ...(activeRoll?.options?.context?.traits ?? []),
   ]

   const message =
      game.messages.contents.findLast((m) => m.rolls.includes(activeRoll)) ??
      game.messages.contents.findLast(
         (m) =>
            m.isDamageRoll &&
            m.rolls.some(
               (r) =>
                  r.total === activeRoll.total &&
                  r._formula === activeRoll._formula,
            ),
      )

   if (message) {
      const flagTraits = message.getFlag("pf2e", "context.traits") ?? []
      rollOptions.push(
         ...flagTraits.map((t) => (typeof t === "string" ? t : t.name)),
      )
      const flagOptions = message.getFlag("pf2e", "context.options") ?? []
      rollOptions.push(
         ...flagOptions
            .filter((o) => o.includes("trait:"))
            .map((o) => o.split(":").pop()),
      )
   }

   const traits = new Set(
      rollOptions
         .filter((o) => typeof o === "string")
         .map((o) => o.split(":").pop())
         .map(slugify),
   )

   return {
      roll: activeRoll ?? null,
      rollData: rollDataFromDamageRoll(activeRoll),
      total,
      damageType: primaryDamageType(damageTypes),
      damageTypes,
      damageInstances,
      hasPersistentDamage: rollHasPersistentDamage(activeRoll),
      hasPrecisionDamage: rollHasPrecisionDamage(activeRoll),
      isCritical: damageRollIsCritical(activeRoll),
      degreeOfSuccess:
         activeRoll?.options?.degreeOfSuccess ?? roll?.options?.degreeOfSuccess,
      critRule: activeRoll?.options?.critRule ?? roll?.options?.critRule,
      traits,
   }
}

export function regularizedCriticalDamageContext(context) {
   let roll = null
   if (typeof context?.roll?.alter === "function") {
      try {
         roll = context.roll.alter(0.5, 0)
      } catch (_error) {
         roll = null
      }
   }
   if (roll) {
      return {
         ...damageContextFromRoll(roll),
         regularizedCritical: true,
      }
   }
   const damageInstances = damageInstancesFromContext(context)
      .map((instance) => ({
         ...instance,
         total: Math.max(0, Math.floor(instance.total / 2)),
      }))
      .filter((instance) => instance.total > 0)
   const next = contextFromDamageInstances(context, damageInstances)
   return {
      ...next,
      regularizedCritical: true,
   }
}

export async function createTypedDamageRoll(amount, damageType = "untyped") {
   const DamageRoll = getDamageRollClass()
   const value = Math.max(0, Math.trunc(Number(amount) || 0))
   if (!DamageRoll || value <= 0) return null
   try {
      const roll = new DamageRoll(`{${value}[${damageType || "untyped"}]}`)
      await roll.evaluate()
      return roll
   } catch (_error) {
      return null
   }
}

export async function createTypedDamageRollFromGroups(groups) {
   const activeGroups = groups.filter((group) => Number(group?.total) > 0)
   if (!activeGroups.length) return null
   const DamageRoll = getDamageRollClass()
   if (!DamageRoll) return null
   const formula = activeGroups
      .map((group) => {
         const total = Math.max(0, Math.trunc(Number(group.total) || 0))
         if (group.precision)
            return `${total}[precision][${group.type || "untyped"}]`
         return `${total}[${damageGroupTraits(group)}]`
      })
      .join(",")
   try {
      const roll = new DamageRoll(formula)
      await roll.evaluate()
      return roll
   } catch (_error) {
      return null
   }
}

function damageRollFormulaPartFromInstance(instance) {
   const type = slugify(instance?.type ?? "untyped") || "untyped"
   const total = Math.max(0, Math.trunc(Number(instance?.total) || 0))
   if (instance?.persistent) {
      const expression = instance.evaluatePersistent
         ? String(total)
         : String(instance.formula ?? "").trim()
      return expression ? `(${expression})[persistent,${type}]` : null
   }
   if (total <= 0) return null
   return instance?.precision
      ? `${total}[precision][${type}]`
      : `${total}[${type}]`
}

async function createDamageRollFromInstances(instances, context = {}) {
   const activeInstances = damageInstancesFromContext({
      damageInstances: instances,
   })
   if (!activeInstances.length) return null
   const DamageRoll = getDamageRollClass()
   if (!DamageRoll) return null
   const formula = activeInstances
      .map((instance) => damageRollFormulaPartFromInstance(instance))
      .filter(Boolean)
      .join(",")
   if (!formula) return null
   const persistentInstances = activeInstances.filter(
      (instance) => instance.persistent,
   )
   const evaluatePersistent =
      persistentInstances.length > 0 &&
      persistentInstances.every((instance) => instance.evaluatePersistent)
   try {
      const rollOptions = { evaluatePersistent }
      if (context?.degreeOfSuccess !== undefined) {
         rollOptions.degreeOfSuccess = context.degreeOfSuccess
      }
      if (context?.critRule) rollOptions.critRule = context.critRule
      const roll = new DamageRoll(formula, {}, rollOptions)
      await roll.evaluate()
      return roll
   } catch (_error) {
      return null
   }
}

export async function damageFromContext(context) {
   const instances = damageInstancesFromContext(context)
   if (!instances.length) return 0
   const roll = await createDamageRollFromInstances(instances, context)
   return roll ?? instances.reduce((sum, instance) => sum + instance.total, 0)
}

export function reduceDamageContext(context, reduction) {
   const amount = Math.max(0, Number(reduction) || 0)
   if (amount <= 0) return context.roll ?? context.total
   if (typeof context.roll?.alter === "function") {
      try {
         return context.roll.alter(1, -amount)
      } catch (_error) {
         undefined
      }
   }
   return Math.max(0, context.total - amount)
}

export function slotDamageInstances(slot) {
   if (Array.isArray(slot?.damageInstances) && slot.damageInstances.length) {
      return damageInstancesFromContext({
         damageInstances: slot.damageInstances,
      })
   }
   const total = Math.max(0, Math.trunc(Number(slot?.damage) || 0))
   if (total <= 0) return []
   return [
      {
         total,
         type:
            slugify(
               slot?.damageType ?? primaryDamageType(slot?.damageTypes ?? []),
            ) || "untyped",
         formula: "",
         persistent: false,
         precision: false,
         evaluatePersistent: false,
      },
   ]
}
