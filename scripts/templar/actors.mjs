import { activeTemplarActor, actorHasSlug } from "./state.mjs"

export function warnBarrierDestroyed() {
   ui.notifications?.warn("Your Light Barrier is Shattered.")
}

export function getActor(actorLike) {
   const actor = activeTemplarActor(actorLike)
   if (!actor)
      ui.notifications?.warn("Select a token or assign a character first.")
   return actor
}

export function featureDetected(actor, slugs, fromSpellMessage = false) {
   return Boolean(fromSpellMessage || actorHasSlug(actor, slugs))
}

export function currentUserShouldPromptActor(actor) {
   if (!actor) return false
   if (game.user?.isGM) return true
   return Boolean(
      actor.isOwner || actor.testUserPermission?.(game.user, "OWNER"),
   )
}
