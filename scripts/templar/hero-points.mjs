export function heroPointPath(actor) {
   const candidates = [
      "system.resources.heroPoints.value",
      "system.resources.hero.value",
      "system.heroPoints.value",
      "system.attributes.heroPoints.value",
   ]
   for (const path of candidates) {
      const value = Number(foundry.utils.getProperty(actor, path))
      if (Number.isFinite(value)) return path
   }
   return null
}

export async function spendHeroPoint(actor) {
   const path = heroPointPath(actor)
   const current = Number(path ? foundry.utils.getProperty(actor, path) : NaN)
   if (!path || !Number.isFinite(current) || current <= 0) return false
   await actor.update({ [path]: Math.max(0, current - 1) })
   return true
}
