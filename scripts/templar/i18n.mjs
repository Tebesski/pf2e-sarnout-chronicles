export function localize(key, fallback = "") {
   const value = game.i18n?.localize?.(key)
   if (value && value !== key) return value
   return fallback || key
}

export function format(key, data = {}, fallback = "") {
   const value = game.i18n?.format?.(key, data)
   if (value && value !== key) return value
   return fallback.replace(/\{([^}]+)\}/g, (_match, name) => data[name] ?? "")
}
