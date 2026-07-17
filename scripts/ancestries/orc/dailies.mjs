import { actorHasSlug, esc, slugify } from "../hadaganian/helpers.mjs"

const DAILIES_MODULE_ID = "pf2e-dailies"
const QUICK_METABOLISM_DAILY_KEY = "ssc-orc-quick-metabolism"
const RATIONS_UUID = "Compendium.pf2e.equipment-srd.Item.L9ZV076913otGtiB"

let registered = false

function localized(key, fallback, data = {}) {
   if (game.i18n?.has?.(key)) return game.i18n.format(key, data)
   return Object.entries(data).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, value),
      fallback,
   )
}

function hasQuickMetabolism(actor) {
   return actorHasSlug(actor, ["quick-metabolism"])
}

function findRations(actor) {
   return (
      actor?.inventory?.find?.((item) => slugify(item?.slug ?? item?.system?.slug ?? item?.name) === "rations") ??
      actor?.items?.find?.((item) => slugify(item?.slug ?? item?.system?.slug ?? item?.name) === "rations") ??
      null
   )
}

function rationRemaining(rations) {
   const uses = rations?.uses ?? rations?.system?.uses ?? {}
   const value = Number(uses.value ?? rations?.system?.uses?.value ?? 1)
   const max = Math.max(1, Number(uses.max ?? rations?.system?.uses?.max ?? 1))
   const quantity = Math.max(1, Number(rations?.quantity ?? rations?.system?.quantity ?? 1))
   return { value, max, quantity, remaining: (quantity - 1) * max + value }
}

function consumeOneRation({ rations, updateItem, deleteItem }) {
   let { value, max, quantity } = rationRemaining(rations)

   if (value > 1) {
      value -= 1
      updateItem({ _id: rations.id, "system.uses.value": value })
   } else if (quantity > 1) {
      quantity -= 1
      value = max
      updateItem({
         _id: rations.id,
         "system.quantity": quantity,
         "system.uses.value": value,
      })
   } else {
      deleteItem(rations)
      quantity = 0
      value = 0
   }

   return { value, max, quantity, remaining: Math.max(0, (quantity - 1) * max + value) }
}

function itemLink(item) {
   return `@UUID[${RATIONS_UUID}]{${esc(item?.name ?? "Rations")}}`
}

function quickMetabolismDaily() {
   return {
      key: QUICK_METABOLISM_DAILY_KEY,
      items: [],
      condition: (actor) => hasQuickMetabolism(actor),
      label: () =>
         localized(
            "PF2ESC.Orc.QuickMetabolism.Daily.Label",
            "Quick Metabolism",
         ),
      process: ({ actor, messages, updateItem, deleteItem }) => {
         const rations = findRations(actor)
         if (!rations) {
            messages.addRaw(
               localized(
                  "PF2ESC.Orc.QuickMetabolism.Daily.NoRations",
                  "Quick Metabolism found no rations to consume.",
               ),
               201,
            )
            return
         }
         const result = consumeOneRation({
            rations,
            updateItem,
            deleteItem,
         })
         messages.addRaw(
            localized(
               "PF2ESC.Orc.QuickMetabolism.Daily.Message",
               "Quick Metabolism consumes an extra {name}. {remaining} remaining.",
               { name: itemLink(rations), remaining: result.remaining },
            ),
            201,
         )
      },
   }
}

function dailiesApi() {
   const module = game.modules?.get?.(DAILIES_MODULE_ID)
   return module?.active ? module.api ?? null : null
}

export function registerOrcQuickMetabolismDailies() {
   Hooks.once("ready", () => {
      if (registered) return
      const api = dailiesApi()
      const register = api?.registerCustomDailies
      if (typeof register !== "function") return

      register([quickMetabolismDaily()])
      registered = true
   })
}
