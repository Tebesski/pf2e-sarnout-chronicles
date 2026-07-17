import { actorHasSlug, esc } from "../helpers.mjs"

const HELPING_HAND_RANGE = 30

function context(message) {
   return message?.flags?.pf2e?.context ?? {}
}

function messageOptions(message) {
   const roll = message?.rolls?.[0]
   return [
      ...(Array.isArray(context(message).options) ? context(message).options : []),
      ...(Array.isArray(roll?.options) ? roll.options : []),
   ].map((option) => String(option ?? ""))
}

function isAidRoll(message) {
   return messageOptions(message).some(
      (option) => option === "action:aid" || option.startsWith("action:aid:"),
   )
}

function degree(message) {
   const outcome = context(message).outcome
   if (outcome === "criticalFailure") return 0
   if (outcome === "failure") return 1
   if (outcome === "success") return 2
   if (outcome === "criticalSuccess") return 3
   const value = Number(
      message?.rolls?.[0]?.options?.degreeOfSuccess ??
         context(message).degreeOfSuccess,
   )
   return Number.isFinite(value) ? value : null
}

function isAidFailure(message) {
   return isAidRoll(message) && degree(message) === 1
}

async function actorFromMessage(message) {
   const actorUuid = context(message).actor
   return (
      (actorUuid ? await fromUuid(actorUuid).catch(() => null) : null) ??
      game.actors?.get(message?.speaker?.actor) ??
      null
   )
}

function tokenFromMessage(message, actor) {
   const sceneId = message?.speaker?.scene
   const tokenId = message?.speaker?.token
   const scene = sceneId ? game.scenes?.get(sceneId) : canvas?.scene
   const tokenDocument = scene?.tokens?.get?.(tokenId)
   return (
      tokenDocument?.object ??
      actor?.getActiveTokens?.()?.find((token) => token.scene === canvas.scene) ??
      actor?.getActiveTokens?.()?.[0] ??
      null
   )
}

function shouldRunAutomation(actor) {
   const activeGM = game.users?.some?.((user) => user.active && user.isGM)
   if (activeGM) return Boolean(game.user?.isGM)
   return Boolean(actor?.isOwner || actor?.testUserPermission?.(game.user, "OWNER"))
}

function sameAlliance(sourceActor, targetActor, sourceToken, targetToken) {
   const sourceAlliance = sourceActor?.system?.details?.alliance
   const targetAlliance = targetActor?.system?.details?.alliance
   if (sourceAlliance && targetAlliance) return sourceAlliance === targetAlliance

   const hostile = CONST.TOKEN_DISPOSITIONS?.HOSTILE ?? -1
   const sourceDisposition = sourceToken?.document?.disposition
   const targetDisposition = targetToken?.document?.disposition
   if (targetDisposition === hostile) return false
   if (Number.isFinite(sourceDisposition) && Number.isFinite(targetDisposition)) {
      return sourceDisposition === targetDisposition && sourceDisposition !== hostile
   }
   return sourceActor?.type === "character" && targetActor?.type === "character"
}

function tokenDistance(first, second) {
   if (!first || !second) return Infinity
   if (typeof first.distanceTo === "function") return first.distanceTo(second)
   if (typeof canvas?.grid?.measurePath === "function") {
      const a = first.center ?? { x: first.x, y: first.y }
      const b = second.center ?? { x: second.x, y: second.y }
      return canvas.grid.measurePath([a, b])?.distance ?? Infinity
   }
   return Infinity
}

function helperOwners(actor) {
   const users =
      game.users?.filter?.(
         (user) =>
            !user.isGM &&
            actor.testUserPermission?.(user, "OWNER"),
      ) ?? []
   return users.length > 0 ? users : game.users?.filter?.((user) => user.isGM) ?? []
}

function helperTokensFor(aidActor, aidToken) {
   const helpers = new Map()
   for (const token of canvas?.tokens?.placeables ?? []) {
      const actor = token.actor
      if (!actor || actor.id === aidActor.id) continue
      if (!actorHasSlug(actor, ["helping-hand"])) continue
      if (!sameAlliance(aidActor, actor, aidToken, token)) continue
      if (tokenDistance(aidToken, token) > HELPING_HAND_RANGE) continue
      helpers.set(actor.uuid ?? actor.id, { actor, token })
   }
   return Array.from(helpers.values())
}

async function whisperHelpingHandTip({ helper, aidActor, distance }) {
   const owners = helperOwners(helper.actor)
   if (owners.length === 0) return
   const whisper = owners.map((user) => user.id)
   await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: helper.actor }),
      whisper,
      content: `
         <p><strong>Helping Hand</strong></p>
         <p>${esc(aidActor.name)} failed an Aid check within ${Math.round(distance)} feet of you.</p>
         <p>You can use Helping Hand to attempt the same type of check or attack roll and replace that failed Aid result.</p>
      `,
   })
}

export async function handleHelpingHandAidFailure(message) {
   if (!isAidFailure(message)) return
   const aidActor = await actorFromMessage(message)
   if (!aidActor || !shouldRunAutomation(aidActor)) return
   const aidToken = tokenFromMessage(message, aidActor)
   if (!aidToken) return

   for (const helper of helperTokensFor(aidActor, aidToken)) {
      await whisperHelpingHandTip({
         helper,
         aidActor,
         distance: tokenDistance(aidToken, helper.token),
      })
   }
}

export const helpingHand = handleHelpingHandAidFailure
