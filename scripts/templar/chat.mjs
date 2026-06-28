import {
   MODULE_ID,
   TEMPLAR_ASSETS,
   TEMPLAR_SLUGS,
} from "./constants.mjs"
import {
   canUseTemplarBarrier,
   slugify,
} from "./state.mjs"
import {
   patchDamageApplication,
   scheduleDamageApplicationPatch,
} from "./chat/damage-application.mjs"
import {
   currentUserCreatedMessage,
   isAutomatedTemplarSpellSlug,
   isDamageRollMessage,
   messageActionType,
   messageActionsValue,
   messageActor,
   messageActorDocument,
   messageHasItemContext,
   messageItemIdentity,
   messageItemSlug,
   messageItemType,
   messageOutcomeDegree,
   messagePrimaryItem,
   messageSaveStatistic,
} from "./chat/messages.mjs"
import { shouldRunActorTip } from "./chat/actors.mjs"
import {
   automateLightProtectsTip,
   blindingBladeDcFromMessage,
   postAsSafeAsChurchPhysicalTipsForAlly,
   shouldHandleSharedBlindingBladeMessage,
} from "./chat/light-protects.mjs"
import { installTemplarChatButtonListeners } from "./chat/buttons.mjs"
import { installProvidenceChatAutomation } from "./chat/providence.mjs"
import { playTemplarSound } from "./chat/sounds.mjs"
import { templarActions } from "./api.mjs"

let spellToMessageWrapped = false
const automatedSpellMessages = new Set()
const automatedActionMessages = new Set()
const templarLightMessages = new Set()
function slugMatches(slug, slugs) {
   const wanted = new Set(slugs.map(slugify))
   return wanted.has(slugify(slug))
}

function isSpellUseMessage(message) {
   if (!message?.id || !currentUserCreatedMessage(message)) return false
   if (message.flags?.[MODULE_ID]?.templarMessage) return false
   if (message.rolls?.length) return false
   const slug = messageItemSlug(message)
   if (!slug) return false
   const type = messageItemType(message)
   const contextType = message?.flags?.pf2e?.context?.type
   const looksLikeSpell =
      type === "spell" || String(contextType ?? "").startsWith("spell")
   if (slugMatches(slug, TEMPLAR_SLUGS.blindingBlade) && !looksLikeSpell)
      return false
   if (isAutomatedTemplarSpellSlug(slug)) {
      return looksLikeSpell || messageHasItemContext(message)
   }
   return looksLikeSpell
}

function isBlindingBladeActionMessage(message) {
   if (!message?.id) return false
   if (message.flags?.[MODULE_ID]?.templarMessage) return false
   if (message.rolls?.length) return false
   const slug = messageItemSlug(message)
   if (!slugMatches(slug, TEMPLAR_SLUGS.blindingBlade)) return false

   const type = messageItemType(message)
   const contextType = String(message?.flags?.pf2e?.context?.type ?? "")
   const actionType = messageActionType(message)
   const primary = messagePrimaryItem(message)
   const automatedFlag =
      primary?.flags?.[MODULE_ID]?.automatedTemplarAction ??
      message?.flags?.[MODULE_ID]?.automatedTemplarAction
   const looksLikeSpell =
      type === "spell" || String(contextType ?? "").startsWith("spell")
   const isAction =
      type === "action" ||
      contextType.startsWith("action") ||
      ["action", "free", "reaction"].includes(actionType) ||
      automatedFlag === "blindingBlade" ||
      (!looksLikeSpell && messageHasItemContext(message))

   return isAction
}

function isTemplarLightUseMessage(message) {
   if (!message?.id || !currentUserCreatedMessage(message)) return false
   if (message.flags?.[MODULE_ID]?.templarMessage) return false
   if (message.rolls?.length) return false
   if (!messageHasItemContext(message)) return false

   const type = messageItemType(message)
   const contextType = String(message?.flags?.pf2e?.context?.type ?? "")
   if (type === "spell" || contextType.startsWith("spell")) return true
   if (type === "action" || contextType.startsWith("action")) return true

   const actionType = messageActionType(message)
   if (["action", "free", "reaction"].includes(actionType)) return true
   if (type === "feat" && actionType && actionType !== "passive") return true

   return type === "feat" && messageActionsValue(message) !== null
}

async function automateTemplarSpellMessage(message) {
   if (!isSpellUseMessage(message)) return
   if (automatedSpellMessages.has(message.id)) return
   const actor = messageActorDocument(message)
   if (!actor) return
   const slug = messageItemSlug(message)
   await automateTemplarSpellCast({ actor, slug, message })
}

async function automateTemplarActionMessage(message) {
   if (!isBlindingBladeActionMessage(message)) return
   const shouldHandle = shouldHandleSharedBlindingBladeMessage(message)
   if (!shouldHandle) return
   if (automatedActionMessages.has(message.id)) return
   automatedActionMessages.add(message.id)
   const actor = messageActorDocument(message)
   const dc = blindingBladeDcFromMessage(message)
   const targets = Array.from(game.user?.targets ?? [])
   await playTemplarSound(TEMPLAR_ASSETS.blindingBladeSound, 1, true)
   if (message.getFlag?.(MODULE_ID, "blindingBladeCardEnhanced")) return
   try {
      await templarActions.postBlindingBladeUseCard({
         actor,
         dc,
         message,
         targets,
      })
   } catch (_error) {
      undefined
   }
}

async function automateTemplarLightUse(message) {
   if (!isTemplarLightUseMessage(message)) return
   if (templarLightMessages.has(message.id)) return
   const actor = messageActorDocument(message)
   if (!actor || !canUseTemplarBarrier(actor)) return
   templarLightMessages.add(message.id)
   await templarActions.emitTemplarLight(actor)
}

function spellItemSlug(item) {
   return slugify(item?.slug ?? item?.system?.slug ?? item?.name)
}

async function automateTemplarSpellCast({ actor, slug, message = null } = {}) {
   if (!actor || !isAutomatedTemplarSpellSlug(slug)) return false
   if (message?.id && automatedSpellMessages.has(message.id)) return true
   const run = async (slugs, callback) => {
      if (!slugMatches(slug, slugs)) return false
      if (message?.id) automatedSpellMessages.add(message.id)
      await callback()
      return true
   }

   return (
      (await run(TEMPLAR_SLUGS.repentance, () =>
         templarActions.repentance({
            actor,
            spendFocus: false,
            fromSpellMessage: true,
         }),
      )) ||
      (await run(TEMPLAR_SLUGS.brilliantShard, () =>
         templarActions.brilliantShard({
            actor,
            spendFocus: false,
            fromSpellMessage: true,
         }),
      )) ||
      (await run(TEMPLAR_SLUGS.providence, () =>
         templarActions.providence({
            actor,
            spendFocus: false,
            fromSpellMessage: true,
         }),
      )) ||
      (await run(TEMPLAR_SLUGS.advent, () =>
         templarActions.advent({
            actor,
            spendFocus: false,
            fromSpellMessage: true,
         }),
      )) ||
      (await run(TEMPLAR_SLUGS.lastStronghold, () =>
         templarActions.lastStronghold({
            actor,
            spendFocus: false,
            fromSpellMessage: true,
         }),
      )) ||
      (await run(TEMPLAR_SLUGS.scutumFidei, () =>
         templarActions.scutumFidei({
            actor,
            spendFocus: false,
            fromSpellMessage: true,
         }),
      )) ||
      (await run(TEMPLAR_SLUGS.heatLightning, () =>
         templarActions.heatLightning({ actor, confirm: false }),
      )) ||
      (await run(TEMPLAR_SLUGS.refraction, () =>
         templarActions.refraction({ actor }),
      )) ||
      (await run(TEMPLAR_SLUGS.flagellation, () =>
         templarActions.flagellation({ actor, fromSpellMessage: true }),
      )) ||
      (await run(TEMPLAR_SLUGS.lightGaol, () =>
         templarActions.lightGaol({
            actor,
            spendFocus: false,
            fromSpellMessage: true,
         }),
      )) ||
      (await run(TEMPLAR_SLUGS.blindingBlade, () =>
         templarActions.blindingBlade({ actor, fromSpellMessage: true }),
      ))
   )
}

function patchSpellToMessage() {
   if (spellToMessageWrapped) return
   const proto = CONFIG?.PF2E?.Item?.documentClasses?.spell?.prototype
   const original = proto?.toMessage
   if (typeof original !== "function" || original._sscTemplarWrapped) return

   spellToMessageWrapped = true
   proto.toMessage = async function sscTemplarSpellToMessage(
      event,
      options = {},
   ) {
      const message = await original.call(this, event, options)
      if (message && (options?.create ?? true) !== false) {
         const actor = this.actor ?? messageActorDocument(message)
         const slug = spellItemSlug(this) || messageItemSlug(message)
         void automateTemplarSpellCast({ actor, slug, message })
      }
      return message
   }
   proto.toMessage._sscTemplarWrapped = true
}

async function automateScorchingReprisalDamageMessage(message) {
   if (!isDamageRollMessage(message)) return
   const actor = messageActorDocument(message)
   if (!actor) return
   if (!shouldRunActorTip(actor)) return
   await templarActions.handleScorchingReprisalDamage({
      actor,
      ...messageItemIdentity(message),
   })
}

export function registerTemplarChatAutomation() {
   Hooks.once("ready", () => {
      const damageApplicationHooks = {
         postAsSafeAsChurchPhysicalTipsForAlly,
      }
      scheduleDamageApplicationPatch(damageApplicationHooks)
      patchSpellToMessage()
      installTemplarChatButtonListeners()
      installProvidenceChatAutomation()
      Hooks.on("createActor", () =>
         patchDamageApplication(damageApplicationHooks),
      )
      Hooks.on("canvasReady", () =>
         patchDamageApplication(damageApplicationHooks),
      )
      Hooks.on("createChatMessage", (message) => {
         void automateTemplarLightUse(message)
         void automateTemplarSpellMessage(message)
         void automateTemplarActionMessage(message)
         void automateScorchingReprisalDamageMessage(message)
         void automateLightProtectsTip(message)
      })
      Hooks.callAll(`${MODULE_ID}.chatAutomationReady`)
   })
}
