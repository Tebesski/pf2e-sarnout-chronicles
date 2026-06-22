export async function spendFocusPoint(actor, cost = 1) {
   if (!hasFocusPoint(actor, cost)) return false
   const focus = actor?.system?.resources?.focus
   const current = Number(focus?.value ?? 0)

   if (typeof actor.update === "function") {
      await actor.update({ "system.resources.focus.value": current - cost })
   } else if (typeof actor.updateResource === "function") {
      await actor.updateResource("focus", current - cost)
   }
   return true
}

export function hasFocusPoint(actor, cost = 1, { notify = true } = {}) {
   const focus = actor?.system?.resources?.focus
   const current = Number(focus?.value ?? 0)
   if (!Number.isFinite(current) || current < cost) {
      if (notify) ui.notifications?.warn("Not enough Focus Points.")
      return false
   }
   return true
}
