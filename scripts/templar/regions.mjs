export function normalizeRegionBehaviorType(type) {
   const models = globalThis.CONFIG?.RegionBehavior?.dataModels
   if (!models) return type
   if (type in models) return type
   for (const prefix of ["core.", "pf2e."]) {
      const candidate = `${prefix}${type}`
      if (candidate in models) return candidate
   }
   return (
      Object.keys(models).find(
         (key) => key === type || key.endsWith(`.${type}`),
      ) ?? type
   )
}

export function regionEvent(...keys) {
   const events = globalThis.CONST?.REGION_EVENTS ?? {}
   for (const key of keys) {
      if (events[key]) return events[key]
      if (events[key?.toUpperCase?.()]) return events[key.toUpperCase()]
   }
   return keys.find(Boolean)
}
