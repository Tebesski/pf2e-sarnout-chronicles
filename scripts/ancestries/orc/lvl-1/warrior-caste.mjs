import { MODULE_ID, actorHasSlug, esc } from "../../hadaganian/helpers.mjs"

const TIP_FLAG = "orcWarriorCasteInitiativeTip"

function context(message) {
   return message?.flags?.pf2e?.context ?? {}
}

function messageOptions(message) {
   const roll = message?.rolls?.[0]
   return [
      ...(Array.isArray(context(message).options) ? context(message).options : []),
      ...(Array.isArray(context(message).domains) ? context(message).domains : []),
      ...(Array.isArray(roll?.options) ? roll.options : []),
   ].map((option) => String(option ?? ""))
}

function isInitiativeRoll(message) {
   const rollContext = context(message)
   if (rollContext.type === "initiative") return true
   if (rollContext.rollerType === "initiative") return true
   if (rollContext.domains?.includes?.("initiative")) return true

   const options = messageOptions(message)
   if (
      options.some(
         (option) =>
            option === "initiative" ||
            option === "check:type:initiative" ||
            option.startsWith("initiative:"),
      )
   ) {
      return true
   }

   const fallbackText = [
      rollContext.title,
      rollContext.label,
      message?.flavor,
   ].join(" ")
   return /\binitiative\b/i.test(fallbackText)
}

async function actorFromMessage(message) {
   const rollContext = context(message)
   const actorUuid = rollContext.actor ?? rollContext.actorUuid
   const actorFromUuid = actorUuid
      ? await fromUuid(actorUuid).catch(() => null)
      : null
   if (actorFromUuid?.documentName === "Actor") return actorFromUuid

   const sceneId = message?.speaker?.scene
   const tokenId = message?.speaker?.token
   const scene = sceneId ? game.scenes?.get(sceneId) : canvas?.scene
   const token = tokenId ? scene?.tokens?.get?.(tokenId) : null
   return token?.actor ?? game.actors?.get(message?.speaker?.actor) ?? null
}

function sortedActiveUsers(predicate) {
   return Array.from(game.users ?? [])
      .filter((user) => user.active && predicate(user))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

function shouldPostForActor(actor) {
   const activeGms = sortedActiveUsers((user) => user.isGM)
   if (activeGms.length > 0) return activeGms[0].id === game.user?.id

   const activeOwners = sortedActiveUsers(
      (user) => !user.isGM && actor.testUserPermission?.(user, "OWNER"),
   )
   if (activeOwners.length > 0) return activeOwners[0].id === game.user?.id

   return Boolean(
      actor?.isOwner || actor?.testUserPermission?.(game.user, "OWNER"),
   )
}

function privateRecipientsForActor(actor) {
   const owners =
      game.users?.filter?.(
         (user) =>
            !user.isGM &&
            actor.testUserPermission?.(user, "OWNER"),
      ) ?? []
   const fallbackGms = game.users?.filter?.((user) => user.isGM) ?? []
   const recipients = owners.length > 0 ? owners : fallbackGms
   return recipients.map((user) => user.id).filter(Boolean)
}

function localize(key, fallback) {
   const translated = game.i18n?.localize?.(key)
   return translated && translated !== key ? translated : fallback
}

export async function handleWarriorCasteInitiative(message) {
   if (!isInitiativeRoll(message)) return

   const actor = await actorFromMessage(message)
   if (!actor || !actorHasSlug(actor, ["warrior-caste"])) return
   if (!shouldPostForActor(actor)) return

   const whisper = privateRecipientsForActor(actor)
   if (whisper.length === 0) return

   const title = localize("PF2ESC.Orc.WarriorCaste.Title", "Warrior Caste")
   const body = localize(
      "PF2ESC.Orc.WarriorCaste.InitiativeTip",
      "You rolled initiative. You can use Always Ready to Interact and draw a weapon.",
   )

   await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      whisper,
      flags: {
         [MODULE_ID]: {
            [TIP_FLAG]: {
               actorUuid: actor.uuid,
               sourceMessageId: message.id,
            },
         },
      },
      content: `<div class="pf2e chat-card item-card">
         <header class="card-header flexrow">
            <h3>${esc(title)}</h3>
         </header>
         <div class="card-content">
            <p>${esc(body)}</p>
         </div>
      </div>`,
   })
}
