import { MODULE_ID } from "../constants.mjs"
import {
   CARD_ACTION,
   CARD_FLAG,
   SOCKET_GLOBAL,
} from "./constants.mjs"

export function registerAbilityCardSocket(manager) {
   if (globalThis[SOCKET_GLOBAL]) return globalThis[SOCKET_GLOBAL]
   if (typeof globalThis.socketlib?.registerModule !== "function") return null
   let socket = null
   try {
      socket = globalThis.socketlib.registerModule(MODULE_ID)
   } catch (_error) {
      return null
   }
   if (typeof socket?.register !== "function") return null
   socket.register("applyTemplarAbilityCardDamage", (payload = {}) =>
      manager.gmApplyCardDamage(payload),
   )
   socket.register("applyTemplarAbilityCardEffect", (payload = {}) =>
      manager.gmApplyCardEffect(payload),
   )
   socket.register("persistTemplarAbilityCard", (payload = {}) =>
      manager.gmPersistCard(payload),
   )
   globalThis[SOCKET_GLOBAL] = socket
   return socket
}

export function installAbilityCardListeners(manager) {
   if (manager._listenersInstalled) return
   manager._listenersInstalled = true
   document.addEventListener(
      "click",
      (event) => {
         const target =
            event.target instanceof Element
               ? event.target
               : event.target?.parentElement
         const control = target?.closest?.(`[${CARD_ACTION}]`)
         if (!control) return
         const card = control.closest(".ssc-templar-ability-card")
         if (!card) return
         event.preventDefault()
         event.stopImmediatePropagation()
         void manager._handleClick(control, card).catch(() => {
            ui.notifications?.warn("The Templar special card action failed.")
         })
      },
      true,
   )
   document.addEventListener(
      "contextmenu",
      (event) => {
         manager._inspectorContext = null
         manager._rerollContext = null
         const target =
            event.target instanceof Element
               ? event.target
               : event.target?.parentElement
         const row = target?.closest?.(
            ".ssc-templar-ability-card .target-row",
         )
         if (!row) return
         const messageId =
            row.closest("[data-message-id]")?.dataset?.messageId
         if (!messageId) return
         manager._inspectorContext = {
            messageId,
            key: manager._inspectorKey(row.dataset.targetUuid),
         }
         if (row.dataset.rolled !== "true") return
         manager._rerollContext = {
            messageId,
            targetUuid: row.dataset.targetUuid || null,
         }
      },
      true,
   )
}

export function installAbilityCardContextMenu(manager) {
   if (manager._contextMenuInstalled) return
   const proto = CONFIG?.ui?.chat?.prototype
   const original = proto?._getEntryContextOptions
   if (typeof original !== "function") return
   manager._contextMenuInstalled = true
   proto._getEntryContextOptions = function (...args) {
      const options = original.apply(this, args)
      if (!Array.isArray(options)) return options
      const gateKey =
         (game.release?.generation ?? 13) >= 14 ? "visible" : "condition"
      const inspect = {
         name: "PF2E.ChatRollDetails.Select",
         icon: '<i class="fa-solid fa-magnifying-glass"></i>',
         callback: (li) => manager._openStoredInspector(li),
      }
      inspect[gateKey] = (li) => manager._hasStoredInspector(li)
      const heroPoint = {
         name: "PF2E.RerollMenu.HeroPoint",
         icon: '<i class="fa-solid fa-hospital-symbol"></i>',
         callback: async (li) => manager._heroPointReroll(li),
      }
      heroPoint[gateKey] = (li) => manager._canHeroPointReroll(li)
      const providence = {
         name: "Reroll using Providence",
         icon: '<i class="fa-solid fa-sun"></i>',
         callback: async (li) => manager._providenceReroll(li),
      }
      providence[gateKey] = (li) => manager._canProvidenceReroll(li)
      options.push(inspect, heroPoint, providence)
      return options
   }
}
