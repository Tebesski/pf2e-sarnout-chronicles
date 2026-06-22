import {
   currentUserCreatedMessage,
   idFromUuid,
} from "./messages.mjs"
import { tokenEdgeDistanceFeet } from "../tokens.mjs"

export function shouldRunActorTip(actor) {
   const activeGM = game.users?.some?.((user) => user.active && user.isGM)
   if (activeGM) return Boolean(game.user?.isGM)
   return Boolean(
      actor?.isOwner || actor?.testUserPermission?.(game.user, "OWNER"),
   )
}

function hasNonGmOwner(actor) {
   return Boolean(
      game.users?.some?.((user) => {
         return !user.isGM && actor?.testUserPermission?.(user, "OWNER")
      }),
   )
}

export function isPlayerOrPartyActor(actor) {
   if (!actor) return false
   const alliance = actor.system?.details?.alliance
   if (alliance) return alliance === "party"
   return actor.type === "character" || hasNonGmOwner(actor)
}

export function actorTokens(actor) {
   return (
      actor?.getActiveTokens?.(true, true) ?? actor?.getActiveTokens?.() ?? []
   )
}

export function actorsAdjacent(first, second) {
   const firstTokens = actorTokens(first)
   const secondTokens = actorTokens(second)
   return firstTokens.some((origin) =>
      secondTokens.some((target) => tokenEdgeDistanceFeet(origin, target) <= 5),
   )
}

export function sameDisposition(first, second) {
   const firstToken = actorTokens(first)[0]
   const secondToken = actorTokens(second)[0]
   const firstDisposition = Number(firstToken?.document?.disposition ?? 0)
   const secondDisposition = Number(secondToken?.document?.disposition ?? 0)
   return (
      firstDisposition === 0 ||
      secondDisposition === 0 ||
      firstDisposition === secondDisposition
   )
}

export function currentTargetActors() {
   return [
      ...new Map(
         Array.from(game.user?.targets ?? [])
            .map((token) => token?.actor)
            .filter(Boolean)
            .map((actor) => [actor.uuid ?? actor.id, actor]),
      ).values(),
   ]
}

export function targetActorFromCandidate(candidate) {
   if (!candidate) return null
   if (candidate.actor) return candidate.actor
   if (candidate.document?.actor) return candidate.document.actor
   if (candidate.token?.actor) return candidate.token.actor
   if (candidate.object?.actor) return candidate.object.actor

   const uuid =
      typeof candidate === "string"
         ? candidate
         : (candidate.uuid ??
           candidate.actorUuid ??
           candidate.actorUUID ??
           candidate.tokenUuid ??
           candidate.tokenUUID ??
           candidate.document?.uuid ??
           candidate.token?.uuid ??
           "")
   if (uuid) {
      const doc = globalThis.fromUuidSync?.(uuid)
      if (doc?.actor) return doc.actor
      if (doc?.type === "character" || doc?.type === "npc") return doc
      const id = idFromUuid(uuid)
      const actor = game.actors?.get?.(id)
      if (actor) return actor
      return canvas?.tokens?.get?.(id)?.actor ?? null
   }

   const id =
      candidate.id ??
      candidate.actorId ??
      candidate.actorID ??
      candidate.tokenId ??
      candidate.tokenID
   if (!id) return null
   return game.actors?.get?.(id) ?? canvas?.tokens?.get?.(id)?.actor ?? null
}

export async function messageTargetActors(message) {
   const pf2e = message?.flags?.pf2e ?? {}
   const context = pf2e.context ?? {}
   const candidates = [
      context.target,
      context.targets,
      context.targetActor,
      context.targetActors,
      context.targetToken,
      context.targetTokens,
      pf2e.target,
      pf2e.targets,
   ].flat(Infinity)

   const actors = new Map()
   for (const candidate of candidates) {
      let actor = targetActorFromCandidate(candidate)
      if (!actor) {
         const uuid = typeof candidate === "string" ? candidate : ""
         if (uuid && typeof fromUuid === "function") {
            const doc = await fromUuid(uuid).catch(() => null)
            actor = doc?.actor ?? doc
         }
      }
      if (actor?.id) actors.set(actor.uuid ?? actor.id, actor)
   }
   if (actors.size > 0) return [...actors.values()]

   return currentUserCreatedMessage(message) ? currentTargetActors() : []
}

export function privateRecipientsForActor(actor) {
   const recipients = (game.users?.contents ?? game.users ?? [])
      .filter((user) => {
         return user?.isGM || actor?.testUserPermission?.(user, "OWNER")
      })
      .map((user) => user.id)
      .filter(Boolean)
   return recipients.length ? recipients : [game.user?.id].filter(Boolean)
}
