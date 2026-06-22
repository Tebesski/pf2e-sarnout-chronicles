import {
   currentCombatRound,
   currentCombatTurn,
   readTemplarState,
} from "../state.mjs"
import { renderTemplarTemplate } from "../templates.mjs"
import { activeHoldingSlots } from "./helpers.mjs"
import {
   actorDialogKey,
   needsSustainPrompt,
   turnDecisionForTurn,
} from "./turn-state.mjs"
import { holdingTurnSlotViews } from "./views.mjs"

const ApplicationV2 = foundry.applications.api.ApplicationV2
const holdingTurnDialogs = new Map()

class TemplarHoldingTurnDialog extends ApplicationV2 {
   constructor(
      { actor, round, turn, releaseOnClose = false, actions = {} } = {},
      options = {},
   ) {
      super(options)
      this.actorId = actor?.id ?? null
      this.actorUuid = actor?.uuid ?? null
      this.actorRef = actor ?? null
      this.round = Number(round ?? currentCombatRound())
      this.turn = Number(turn ?? currentCombatTurn())
      this.releaseOnClose = Boolean(releaseOnClose)
      this.actions = actions
   }

   static DEFAULT_OPTIONS = {
      id: "pf2e-sarnout-holding-turn-dialog",
      tag: "section",
      classes: ["pf2e-sarnout-turn-dialog"],
      window: {
         title: "Holding Barrier",
         icon: "fa-solid fa-shield-halved",
         positioned: true,
      },
      position: {
         width: 360,
         height: "auto",
      },
   }

   get actor() {
      if (this.actorUuid) {
         const actor = globalThis.fromUuidSync?.(this.actorUuid)
         if (actor) return actor
      }
      return this.actorRef ?? game.actors?.get(this.actorId) ?? null
   }

   async _renderHTML() {
      return renderTemplarTemplate("holding-turn-dialog", {
         slots: this.actor
            ? holdingTurnSlotViews(this.actor, {
                 round: this.round,
                 turn: this.turn,
              })
            : [],
      })
   }

   _replaceHTML(html, content) {
      if (typeof html === "string") content.innerHTML = html
      else content.replaceChildren(html)
      for (const button of content.querySelectorAll(
         "[data-action][data-slot-index]",
      )) {
         button.addEventListener("click", (event) => {
            event.preventDefault()
            const slotIndex = Number(button.dataset.slotIndex)
            const action = button.dataset.action
            void this.#handleAction(action, slotIndex)
         })
      }
   }

   async #handleAction(action, slotIndex) {
      const result =
         action === "release" && this.releaseOnClose
            ? await this.actions.releaseHolding?.({
                 actor: this.actor,
                 slotIndex,
                 messageTitle: "Holding Barrier Released",
              })
            : action === "philosophy"
              ? await this.actions.philosophyWithJuggler?.(
                   this.actor,
                   slotIndex,
                   {
                      round: this.round,
                      turn: this.turn,
                   },
                )
              : await this.actions.setHoldingTurnDecision?.({
                   actor: this.actor,
                   slotIndex,
                   decision: action === "sustain" ? "sustain" : "release",
                   round: this.round,
                   turn: this.turn,
                   releaseImmediately: this.releaseOnClose,
                })
      if (!result) return
      const state = readTemplarState(this.actor)
      const remaining = activeHoldingSlots(state).filter((slot) => {
         return (
            needsSustainPrompt(this.actor, slot, this.round, this.turn) &&
            !turnDecisionForTurn(slot, this.round, this.turn)
         )
      })
      if (remaining.length > 0) {
         this.render({ force: true })
      } else {
         await this.close({ skipDecision: true })
      }
   }

   async close(options = {}) {
      const key = actorDialogKey(this.actor)
      if (!options.skipDecision && this.actor) {
         if (this.releaseOnClose) {
            await this.actions.releaseUndecidedHoldingBarriers?.(this.actor, {
               round: this.round,
               turn: this.turn,
            })
         } else {
            await this.actions.markUndecidedHoldingReleaseDecisions?.(
               this.actor,
               {
                  refresh: true,
               },
            )
         }
      }
      if (key && holdingTurnDialogs.get(key) === this)
         holdingTurnDialogs.delete(key)
      return super.close(options)
   }
}

export function openHoldingTurnDialog(actor, options = {}, actions = {}) {
   if (!actor) return null
   const key = actorDialogKey(actor)
   const existing = holdingTurnDialogs.get(key)
   if (existing) {
      existing.actorRef = actor
      existing.actorId = actor.id ?? existing.actorId
      existing.actorUuid = actor.uuid ?? existing.actorUuid
      existing.round = Number(options.round ?? existing.round)
      existing.turn = Number(options.turn ?? existing.turn)
      existing.releaseOnClose = Boolean(options.releaseOnClose)
      existing.actions = actions
      existing.render({ force: true })
      return existing
   }
   const dialog = new TemplarHoldingTurnDialog({
      actor,
      ...options,
      actions,
   })
   holdingTurnDialogs.set(key, dialog)
   dialog.render({ force: true })
   return dialog
}

export function refreshHoldingTurnDialog(actor) {
   const key = actorDialogKey(actor)
   const dialog = holdingTurnDialogs.get(key)
   if (dialog) dialog.render({ force: true })
}

export function closeHoldingTurnDialog(actor) {
   const key = actorDialogKey(actor)
   const dialog = holdingTurnDialogs.get(key)
   if (dialog) void dialog.close({ skipDecision: true })
}
