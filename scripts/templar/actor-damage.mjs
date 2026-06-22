import { getActorToken } from "./tokens.mjs"

function clamp(value, min, max) {
   return Math.max(min, Math.min(max, value))
}

export async function applyActorDamage(
   actor,
   damage,
   { bypassIWR = false } = {},
) {
   const amount = typeof damage === "number" ? Math.trunc(damage) : damage
   if (!actor || amount === 0) return null
   const token = getActorToken(actor)
   if (typeof actor.applyDamage === "function" && token) {
      return actor.applyDamage({
         damage: amount,
         token,
         skipIWR: Boolean(bypassIWR),
         final: Boolean(bypassIWR),
      })
   }

   const value = Number(typeof amount === "number" ? amount : amount?.total)
   if (!Number.isFinite(value) || typeof actor.update !== "function")
      return null
   const hp = actor.system?.attributes?.hp
   const current = Number(hp?.value ?? 0)
   const max = Number(hp?.max ?? current)
   const next = clamp(current - value, 0, Math.max(current, max))
   return actor.update({ "system.attributes.hp.value": next })
}

export async function applyActorHealing(actor, amount) {
   const healing = Math.max(0, Math.trunc(Number(amount) || 0))
   if (healing <= 0) return null
   return applyActorDamage(actor, -healing, { bypassIWR: true })
}
