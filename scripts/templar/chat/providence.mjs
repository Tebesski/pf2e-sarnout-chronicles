import { TEMPLAR_SLUGS } from "../constants.mjs"
import { actorHasSlug, slugify } from "../state.mjs"
import { templarActions } from "../api.mjs"
import {
   messageFromElement,
   resolveMessageIdFromLi,
} from "./messages.mjs"
import {
   canOfferProvidenceForMessage,
   getControlledTemplar,
} from "./light-protects.mjs"

let contextWrapped = false
let toolbeltProvidenceInstalled = false
let toolbeltProvidenceObserver = null
let lastToolbeltProvidenceContext = null
const toolbeltProvidenceDialogContexts = new WeakMap()

function actorUuid(actor) {
   return actor?.uuid ?? actor?.id ?? null
}

function actorFromDocument(document) {
   return (
      document?.actor ??
      document?.parent?.actor ??
      document?.parent ??
      document ??
      null
   )
}

function actorFromUuidSync(uuid) {
   if (!uuid) return null
   const document = globalThis.fromUuidSync?.(uuid)
   const actor = actorFromDocument(document)
   return actor?.system ? actor : null
}

function collectTargetUuids(value, out = [], targetScope = false) {
   if (!value) return out
   if (typeof value === "string") {
      if (targetScope && /^(?:Scene|Actor)\./.test(value)) out.push(value)
      return out
   }
   if (Array.isArray(value)) {
      for (const entry of value) collectTargetUuids(entry, out, targetScope)
      return out
   }
   if (typeof value !== "object") return out

   for (const [key, entry] of Object.entries(value)) {
      const slug = slugify(key)
      const childTargetScope =
         targetScope ||
         slug === "targets" ||
         slug === "splashtargets" ||
         slug === "targetuuid" ||
         slug === "targetuuids"
      if (childTargetScope || (typeof entry === "object" && entry !== null)) {
         collectTargetUuids(entry, out, childTargetScope)
      }
   }
   return out
}

function toolbeltRerollActorFromButton(button, message) {
   const row = button?.closest?.(".target-row")
   const rows = Array.from(
      row?.parentElement?.querySelectorAll?.(":scope > .target-row") ?? [],
   )
   const rowIndex = rows.indexOf(row)
   const targetUuids = collectTargetUuids(message?.flags)
   const actorFromFlag = actorFromUuidSync(targetUuids[rowIndex])
   if (actorFromFlag?.system) return actorFromFlag

   const rowName = row
      ?.querySelector?.(".name")
      ?.textContent?.replace(/\s+/g, " ")
      ?.trim()
   const controlledTemplar = canvas?.tokens?.controlled?.find?.((token) =>
      actorHasSlug(token.actor, TEMPLAR_SLUGS.providence),
   )?.actor
   if (!rowName) return controlledTemplar ?? null
   const candidates = canvas?.tokens?.placeables ?? []
   const token = candidates.find((candidate) => {
      const actor = candidate.actor
      return (
         actorHasSlug(actor, TEMPLAR_SLUGS.providence) &&
         (candidate.name === rowName || actor?.name === rowName)
      )
   })
   return token?.actor ?? controlledTemplar ?? null
}

function rememberToolbeltProvidenceContext(event) {
   const button = event.target?.closest?.("[data-action='reroll-save']")
   if (!button) return
   const message = messageFromElement(button)
   const actor = toolbeltRerollActorFromButton(button, message)
   if (!actor || !actorHasSlug(actor, TEMPLAR_SLUGS.providence)) {
      lastToolbeltProvidenceContext = null
      return
   }
   lastToolbeltProvidenceContext = {
      actor,
      message,
      actorUuid: actorUuid(actor),
      messageId: message?.id ?? null,
      createdAt: Date.now(),
   }
}

function activeToolbeltProvidenceContext(maxAgeMs = 15_000) {
   const context = lastToolbeltProvidenceContext
   if (!context || Date.now() - context.createdAt > maxAgeMs) return null
   const actor = context.actor ?? actorFromUuidSync(context.actorUuid)
   const message = context.messageId
      ? game.messages?.get?.(context.messageId)
      : context.message
   if (!actor || !actorHasSlug(actor, TEMPLAR_SLUGS.providence)) return null
   return { actor, message }
}

function handleToolbeltProvidenceClick(event) {
   const button = event.target.closest(
      "button[type='submit'], button[data-action='ok'], button[data-action='apply']",
   )
   if (!button) return
   const dialog = button.closest(
      "dialog.pf2e-toolbelt.reroll, .application.dialog.reroll.pf2e-toolbelt",
   )
   if (!dialog) return
   const form = dialog.querySelector("form")
   const selected = form?.querySelector("input[name='reroll']:checked")
   if (selected?.dataset?.providence !== "true") return

   const context =
      toolbeltProvidenceDialogContexts.get(dialog) ??
      activeToolbeltProvidenceContext()
   if (!context) return

   const success = templarActions.prepareProvidenceReroll({
      actor: context.actor,
      applyBonus: true,
      spendFocus: true,
   })

   if (!success) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
   }

   void templarActions.spendFocusPoint(context.actor, 1)

   setTimeout(() => {
      void templarActions.completeProvidenceReroll({
         actor: context.actor,
         message: context.message,
         spendFocus: false,
      })
   }, 1000)
}

function injectProvidenceToolbeltDialogs() {
   if (!game.modules?.get?.("pf2e-toolbelt")?.active) return
   for (const dialog of document.querySelectorAll(
      "dialog.pf2e-toolbelt.reroll, .application.dialog.reroll.pf2e-toolbelt",
   )) {
      if (dialog.dataset.sscProvidenceInjected) continue
      const context = activeToolbeltProvidenceContext()
      if (!context) continue
      const form = dialog.querySelector("form")
      const content = dialog.querySelector(".dialog-content") ?? form
      if (!form || !content) continue

      if (dialog.querySelector("input[name='reroll'][data-providence='true']"))
         continue

      const option = document.createElement("label")
      option.classList.add("ssc-providence-reroll-option")

      const focus = context.actor?.system?.resources?.focus
      const hasFocus = Number(focus?.value ?? focus?.points ?? 0) > 0

      option.innerHTML = `
         <input type="radio" name="reroll" value="new" data-providence="true"${hasFocus ? "" : " disabled"}>
         <i class="fa-solid fa-sun"></i> Reroll using Providence
      `
      const heroOption = content
         .querySelector("input[name='reroll'][value='hero']")
         ?.closest("label")
      if (heroOption) heroOption.after(option)
      else content.prepend(option)

      dialog.addEventListener("click", handleToolbeltProvidenceClick, {
         capture: true,
      })
      toolbeltProvidenceDialogContexts.set(dialog, context)
      dialog.dataset.sscProvidenceInjected = "true"
   }
}

function installToolbeltProvidenceReroll() {
   if (toolbeltProvidenceInstalled) return
   if (!game.modules?.get?.("pf2e-toolbelt")?.active) return
   toolbeltProvidenceInstalled = true
   document.addEventListener("click", rememberToolbeltProvidenceContext, true)
   document.addEventListener(
      "contextmenu",
      rememberToolbeltProvidenceContext,
      true,
   )
   toolbeltProvidenceObserver = new MutationObserver(() =>
      injectProvidenceToolbeltDialogs(),
   )
   toolbeltProvidenceObserver.observe(document.body, {
      childList: true,
      subtree: true,
   })
}

function useProvidenceForMessage(message) {
   const messageActor =
      message?.actor ??
      message?.token?.actor ??
      game.actors?.get(message?.speaker?.actor)
   const templar = getControlledTemplar(messageActor)

   if (templar) {
      void templarActions.providence({ actor: templar, message })
   }
}

function providenceContextOption(gateKey) {
   const option = {
      name: "Reroll using Providence",
      icon: '<i class="fa-solid fa-sun fa-fw"></i>',
      callback: (li) => {
         const messageId = resolveMessageIdFromLi(li)
         useProvidenceForMessage(game.messages?.get(messageId))
      },
   }

   option[gateKey] = (li) => {
      const messageId = resolveMessageIdFromLi(li)
      const message = game.messages?.get(messageId)
      return canOfferProvidenceForMessage(message)
   }

   return option
}

function patchChatContextMenu() {
   if (contextWrapped) return
   contextWrapped = true

   const proto = CONFIG?.ui?.chat?.prototype
   const original = proto?._getEntryContextOptions

   if (typeof original === "function") {
      proto._getEntryContextOptions = function (...args) {
         const options = original.apply(this, args)
         if (!Array.isArray(options)) return options
         const gateKey =
            (game.release?.generation ?? 13) >= 14 ? "visible" : "condition"
         options.push(providenceContextOption(gateKey))
         return options
      }
      return
   }

   Hooks.on("getChatLogEntryContext", (_html, options) => {
      options.push({
         ...providenceContextOption("condition"),
         visible: (li) => {
            const messageId = resolveMessageIdFromLi(li)
            return canOfferProvidenceForMessage(game.messages?.get(messageId))
         },
      })
   })
}

export function installProvidenceChatAutomation() {
   patchChatContextMenu()
   installToolbeltProvidenceReroll()
}
