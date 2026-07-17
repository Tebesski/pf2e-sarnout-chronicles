import {
   chat,
   esc,
   ownedOrControlledActor,
   perceptionDC,
   targetActors,
   totalFromMessage,
   warn,
} from "../helpers.mjs"

export async function displayOfVirtue({ actor, targets = null } = {}) {
   const resolved = ownedOrControlledActor(actor)
   if (!resolved) return null
   const statistic = resolved.getStatistic?.("deception") ?? resolved.skills?.dec
   if (!statistic?.roll) return warn(`${resolved.name} has no Deception statistic.`)

   const observers = targets?.length ? targets : targetActors()
   if (observers.length === 0) return warn("Target at least one hostile observer.")

   const message = await statistic.roll({
      label: "Display of Virtue",
      title: "Display of Virtue",
      extraRollOptions: ["display-of-virtue", "item:trait:hadaganian"],
   })
   if (!message) return null

   const total = totalFromMessage(message)
   const rows = observers.map((observer) => {
      const dc = perceptionDC(observer)
      const result =
         Number.isFinite(total) && Number.isFinite(dc)
            ? total >= dc + 10
               ? "critically fooled"
               : total >= dc
                 ? "fooled"
                 : "not fooled"
            : "no Perception DC"
      return `<li>${esc(observer.name)}: ${result}${Number.isFinite(dc) ? ` (DC ${dc})` : ""}</li>`
   })
   await chat(resolved, `<p><strong>Display of Virtue</strong></p><ul>${rows.join("")}</ul>`)
   return message
}
