import { MODULE_ID, TEMPLAR_SETTINGS } from "./constants.mjs"

export function debugTemplar(label, data = {}) {
   let enabled = false
   try {
      enabled = Boolean(
         game.settings?.get?.(MODULE_ID, TEMPLAR_SETTINGS.debugAutomation),
      )
   } catch (_error) {
      enabled = false
   }
   if (!enabled) return
   console.debug(`${MODULE_ID} | ${label}`, data)
}
