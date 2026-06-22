import { TEMPLAR_ASSETS, TEMPLAR_SLUGS } from "./constants.mjs"
import { templarActions } from "./api.mjs"
import {
   activeTemplarActor,
   actorHasSlug,
   canUseTemplarBarrier,
   currentCombatRound,
   currentCombatTurn,
   readTemplarState,
} from "./state.mjs"
import { renderTemplarTemplate } from "./templates.mjs"

const ApplicationV2 = foundry.applications.api.ApplicationV2

let panel = null
let refreshQueued = false
let queuedRefreshActor = null

function activePanelActor(actorLike = null) {
   if (actorLike) return activeTemplarActor(actorLike)
   const controlled = canvas?.tokens?.controlled ?? []
   if (controlled.length > 0 && controlled[0]?.actor) return controlled[0].actor
   const targets = Array.from(game.user?.targets ?? [])
   if (targets.length === 1 && targets[0]?.actor) return targets[0].actor
   return game.user?.character ?? null
}

function lightImage(state) {
   if (brilliantShardShown(state)) return TEMPLAR_ASSETS.brilliantShield
   if (state.light.broken) return TEMPLAR_ASSETS.broken
   if (state.light.breaking) return TEMPLAR_ASSETS.barrier
   if (state.rallying.active) return TEMPLAR_ASSETS.fragment
   return TEMPLAR_ASSETS.barrier
}

function brilliantShardShown(state) {
   const shard = state.brilliantShard ?? {}
   const threshold = Math.floor(Math.max(0, Number(shard.max) || 0) / 2)
   return Boolean(
      shard.active && !shard.broken && Number(shard.value) > threshold,
   )
}

function holdingMaxRounds(actor) {
   return actorHasSlug(actor, TEMPLAR_SLUGS.philosophyOfDefense) ? 10 : 2
}

function holdingMaxSustainRounds(actor) {
   return Math.max(0, holdingMaxRounds(actor) - 1)
}

function holdingSustainCount(slot) {
   return Math.max(0, Number(slot?.roundsSustained) || 0)
}

function turnDecisionForCurrentTurn(slot) {
   return slot?.decisionRound === currentCombatRound() &&
      slot?.decisionTurn === currentCombatTurn()
      ? slot.turnDecision
      : null
}

function slotTooltipLines(actor, slot) {
   if (slot.released) {
      return [`Released Damage ${slot.lastReleasedDamage}`]
   }
   if (!slot.active) return ["Empty holding barrier"]
   const lines = [`Held Damage ${slot.damage}`]
   if (actorHasSlug(actor, TEMPLAR_SLUGS.defenseMaster)) {
      lines.push(
         `Type: ${(slot.damageTypes ?? [slot.damageType ?? "untyped"]).join(", ")}`,
      )
   }
   lines.push(
      `Sustained ${holdingSustainCount(slot)} / ${holdingMaxSustainRounds(actor)}`,
   )
   return lines
}

function slotImage(slot) {
   return slot.released ? TEMPLAR_ASSETS.released : TEMPLAR_ASSETS.holding
}

function slotTransitionImage(slot) {
   return slot.restoring ? TEMPLAR_ASSETS.released : ""
}

function holdingSlotView(actor, slot) {
   const turnDecision = turnDecisionForCurrentTurn(slot)
   const classes = [
      "ssc-holding-slot",
      slot.active ? "is-active" : "",
      slot.releasing ? "is-releasing" : "",
      slot.released ? "is-released" : "",
      slot.restoring ? "is-restoring" : "",
   ]
      .filter(Boolean)
      .join(" ")

   return {
      index: slot.index,
      classes,
      tooltipLines: slotTooltipLines(actor, slot),
      image: slotImage(slot),
      transitionImage: slotTransitionImage(slot),
      hasDamage: Boolean(slot.active),
      damage: slot.damage,
      decisionBadge:
         turnDecision === "sustain"
            ? "S"
            : turnDecision === "release"
              ? "R"
              : "",
      decisionClass:
         turnDecision === "sustain"
            ? "is-sustain"
            : turnDecision === "release"
              ? "is-release"
              : "",
      decisionTooltip:
         turnDecision === "sustain"
            ? "Sustained for this turn"
            : turnDecision === "release"
              ? "Release at turn end"
              : "",
   }
}

async function renderPanel(actor) {
   if (!actor) {
      return renderTemplarTemplate("panel", {
         empty: true,
         emptyMessage: "Select a token or assign a player character.",
      })
   }

   const state = readTemplarState(actor)
   const hasDedication = canUseTemplarBarrier(actor)
   const hasHolding = actorHasSlug(actor, TEMPLAR_SLUGS.holdingBarrier)
   const showsBrilliantShard = brilliantShardShown(state)
   const lightClasses = [
      "ssc-light-token",
      showsBrilliantShard ? "is-brilliant" : "",
      state.light.breaking ? "is-breaking" : "",
      state.light.broken ? "is-broken" : "",
      state.light.restoring ? "is-restoring" : "",
      state.rallying.transitioning ? "is-rallying" : "",
      state.rallying.active ? "is-fragment" : "",
   ]
      .filter(Boolean)
      .join(" ")

   const lightValue = showsBrilliantShard
      ? state.brilliantShard.value
      : state.light.value
   const lightMax = showsBrilliantShard
      ? state.brilliantShard.max
      : state.light.max
   const lightHardness = showsBrilliantShard
      ? state.brilliantShard.hardness
      : state.light.hardness
   const lightTooltipLines = showsBrilliantShard
      ? [
           `Brilliant Shard HP ${state.brilliantShard.value} / ${state.brilliantShard.max}`,
           `Brilliant Shard Hardness ${state.brilliantShard.hardness}`,
        ]
      : [
           `HP ${state.light.value} / ${state.light.max}`,
           `Hardness ${state.light.hardness}`,
        ]
   if (
      !showsBrilliantShard &&
      state.advent?.active &&
      state.light.baseHardness !== undefined
   ) {
      lightTooltipLines.push(
         `Advent: base Hardness ${state.light.baseHardness}`,
      )
   }
   if (!showsBrilliantShard && state.light.broken) {
      lightTooltipLines.push(
         state.light.lingering ? "Shattered, Lingering" : "Shattered",
      )
   }

   return renderTemplarTemplate("panel", {
      actorId: actor.id,
      empty: false,
      hasDedication,
      dedicationWarning: "Templar Dedication not detected on this actor.",
      noSlotsMessage: hasHolding
         ? "No slots available."
         : "Holding Barrier not detected.",
      light: {
         value: lightValue,
         max: lightMax,
         hardness: lightHardness,
         classes: lightClasses,
         tooltipLines: lightTooltipLines,
         image: lightImage(state),
      },
      holding: state.holding.map((slot) => holdingSlotView(actor, slot)),
   })
}

export class TemplarBarrierPanel extends ApplicationV2 {
   constructor(options = {}) {
      super(options)
      this.actorId = options.actorId ?? null
      this.actorUuid = options.actorUuid ?? null
      this.actorRef = options.actor ?? null
   }

   static DEFAULT_OPTIONS = {
      id: "pf2e-sarnout-templar-barrier",
      tag: "aside",
      classes: ["pf2e-sarnout-templar-window"],
      window: {
         frame: false,
         positioned: true,
      },
      position: {
         width: 410,
         height: "auto",
         left: 140,
         top: 120,
      },
   }

   get actor() {
      if (this.actorUuid) {
         const actor = globalThis.fromUuidSync?.(this.actorUuid)
         if (actor) return actor
      }
      return (
         this.actorRef ?? game.actors?.get(this.actorId) ?? activeTemplarActor()
      )
   }

   async _renderHTML() {
      return renderPanel(this.actor)
   }

   async refresh(actor = null) {
      if (actor) {
         const current = this.actor
         const sameStoredActor =
            actor.uuid === this.actorUuid ||
            (!this.actorUuid && actor.id === this.actorId)
         const sameCurrentActor = actor.uuid && actor.uuid === current?.uuid
         if (!current || sameStoredActor || sameCurrentActor) {
            this.actorId = actor.id ?? this.actorId
            this.actorUuid = actor.uuid ?? this.actorUuid
            this.actorRef = actor
         }
      }

      const element = this.element
      const content =
         element?.querySelector?.(".window-content") ??
         element?.querySelector?.(".ssc-templar-panel")?.parentElement ??
         element
      if (!content) return this.render({ force: true })

      const html = await renderPanel(this.actor)
      this._replaceHTML(html, content)
      return this
   }

   async close(options = {}) {
      const element = this.element
      if (element && !options.force) {
         element.classList.add("ssc-closing")
         element.style.pointerEvents = "none"
         await new Promise((resolve) => setTimeout(resolve, 140))
      }
      if (panel === this) panel = null
      return super.close(options)
   }

   _replaceHTML(html, content) {
      if (typeof html === "string") content.innerHTML = html
      else content.replaceChildren(html)
      this.#activateListeners(content)
   }

   #activateListeners(content) {
      for (const element of content.querySelectorAll("[data-action]")) {
         element.addEventListener("click", (event) => this.#onAction(event))
      }
      content
         .querySelector("[data-light-barrier]")
         ?.addEventListener("click", (event) => {
            event.preventDefault()
            templarActions.repairLightBarrier({ actor: this.actor })
         })
      content
         .querySelector("[data-light-barrier]")
         ?.addEventListener("contextmenu", (event) => {
            event.preventDefault()
            templarActions.damageLightBarrier({ actor: this.actor })
         })
      for (const slot of content.querySelectorAll(".ssc-holding-slot")) {
         slot
            .querySelector(".ssc-slot-decision")
            ?.addEventListener("click", (event) => {
               event.preventDefault()
               event.stopPropagation()
            })
         slot
            .querySelector(".ssc-slot-decision")
            ?.addEventListener("contextmenu", (event) => {
               event.preventDefault()
               event.stopPropagation()
               const slotIndex = Number(event.currentTarget.dataset.slotIndex)
               templarActions.openHoldingTurnDecisionDialog({
                  actor: this.actor,
                  slotIndex,
               })
            })
         slot.addEventListener("click", (event) => {
            event.preventDefault()
            const slotIndex = Number(slot.dataset.slotIndex)
            templarActions.openHoldingBarrierDialog({
               actor: this.actor,
               slotIndex,
            })
         })
         slot.addEventListener("contextmenu", (event) => {
            event.preventDefault()
            const slotIndex = Number(slot.dataset.slotIndex)
            const state = readTemplarState(this.actor)
            const heldSlot = state.holding[slotIndex]
            if (heldSlot?.active) {
               templarActions.editHeldDamage({ actor: this.actor, slotIndex })
            } else {
               templarActions.holdDamage({ actor: this.actor, slotIndex })
            }
         })
      }
      this.#activateDrag(content)
   }

   #activateDrag(content) {
      const handle = content.querySelector("[data-drag-handle]")
      const element = this.element
      if (!handle || !element) return

      handle.addEventListener("pointerdown", (event) => {
         if (
            event.button !== 0 ||
            event.target.closest(
               "button, [data-light-barrier], .ssc-holding-slot",
            )
         ) {
            return
         }
         event.preventDefault()
         const rect = element.getBoundingClientRect()
         const start = {
            x: event.clientX,
            y: event.clientY,
            left: rect.left,
            top: rect.top,
         }

         const move = (moveEvent) => {
            const left = start.left + moveEvent.clientX - start.x
            const top = start.top + moveEvent.clientY - start.y
            if (typeof this.setPosition === "function") {
               this.setPosition({ left, top })
            } else {
               element.style.left = `${left}px`
               element.style.top = `${top}px`
            }
         }
         const up = () => {
            document.removeEventListener("pointermove", move)
            document.removeEventListener("pointerup", up)
         }
         document.addEventListener("pointermove", move)
         document.addEventListener("pointerup", up, { once: true })
      })
   }

   async #onAction(event) {
      event.preventDefault()
      event.stopPropagation()
      const action = event.currentTarget.dataset.action

      if (action === "close") return this.close()
   }
}

export function openTemplarBarrierPanel(actorLike = null) {
   const actor = activePanelActor(actorLike)
   if (!actor) {
      ui.notifications?.warn("Select a token with Templar Dedication first.")
      return null
   }
   if (!canUseTemplarBarrier(actor)) {
      ui.notifications?.warn(
         "The selected actor does not have Templar Dedication.",
      )
      return null
   }
   if (!panel) {
      panel = new TemplarBarrierPanel({
         actor,
         actorId: actor?.id ?? null,
         actorUuid: actor?.uuid ?? null,
      })
   }
   if (actor) {
      panel.actorId = actor.id
      panel.actorUuid = actor.uuid ?? null
      panel.actorRef = actor
   }
   return panel.render({ force: true })
}

export function toggleTemplarBarrierPanel(actorLike = null) {
   if (panel?.rendered || panel?.element) return panel.close()
   return openTemplarBarrierPanel(actorLike)
}

function panelMatchesActor(actor) {
   if (!actor || !panel) return true
   const current = panel.actor
   if (actor === current) return true
   const panelKeys = new Set(
      [
         panel.actorId,
         panel.actorUuid,
         current?.id,
         current?.uuid,
         current?.token?.id,
         current?.token?.uuid,
      ].filter(Boolean),
   )
   return [actor.id, actor.uuid, actor.token?.id, actor.token?.uuid].some(
      (key) => panelKeys.has(key),
   )
}

export function refreshTemplarBarrierPanel(actor = null) {
   if (!panel?.rendered && !panel?.element) return
   if (!panelMatchesActor(actor)) return
   queuedRefreshActor = actor ?? queuedRefreshActor
   if (refreshQueued) return
   refreshQueued = true
   const schedule =
      globalThis.requestAnimationFrame ??
      ((callback) => setTimeout(callback, 16))
   schedule(() => {
      refreshQueued = false
      const actorToRefresh = queuedRefreshActor
      queuedRefreshActor = null
      if (!panel?.rendered && !panel?.element) return
      if (!panelMatchesActor(actorToRefresh)) return
      void panel.refresh(actorToRefresh)
   })
}
