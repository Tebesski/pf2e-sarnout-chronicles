import {
   MODULE_ID,
   TEMPLAR_ASSETS,
   TEMPLAR_SLUGS,
} from "../constants.mjs"
import { actorHasSlug } from "../state.mjs"
import {
   ABILITY_TRAITS,
   CARD_ACTION,
   CARD_FLAG,
   CARD_ROLL_OPTIONS,
   INSPECTOR_FLAG,
   SOCKET_GLOBAL,
} from "./constants.mjs"
import {
   d20TotalFromRoll,
   normalizeOutcome,
   outcomeClass,
   outcomeFromRoll,
   outcomeLabel,
} from "./outcomes.mjs"
import {
   renderCard,
   renderDamageButtons,
   renderOutcomeNote,
   saveTooltip,
} from "./rendering.mjs"
import { uniqueTokenDocs } from "./targets.mjs"
import {
   actorClassOrSpellDC,
   damageRollFromInstances,
   lightBurstRadius,
   rollDamageFormula,
   rollDamageOnce,
   scaleRollTotal,
} from "./damage-rolls.mjs"
import { effectPlanForOutcome } from "./effects.mjs"
import { resolveUuid } from "./documents.mjs"

function debugCard(label, data = {}) {
   void label
   void data
}

function isBlindingBladeCardData(data = {}) {
   return (
      data?.title === "Blinding Blade" ||
      (data?.type === "light-gaol" && data?.saveType === "reflex")
   )
}

function logBlindingBladeCard(label, data = {}) {
   void label
   void data
}

export class LightBurstCardManager {
   static initHooks() {
      this._installListeners()
      this._installContextMenu()
      Hooks.once("socketlib.ready", () => this._registerSocket())
      Hooks.once("ready", () => {
         this._registerSocket()
         this._installListeners()
         this._installContextMenu()
      })
   }

   static async postLightGaolBoundaryCard({
      actor,
      target,
      saveType,
      dc,
      dice,
      title = "Light Gaol Boundary",
      icon = TEMPLAR_ASSETS.gaol,
   } = {}) {
      if (!actor) return false
      const tokenDocs = uniqueTokenDocs([target])
      debugCard("post Light Gaol card", {
         actor: actor.name,
         target: target?.actor?.name ?? target?.name,
         saveType,
         dc,
         dice,
         title,
         tokenUuids: tokenDocs.map((doc) => doc.uuid),
      })
      if (title === "Blinding Blade") {
         logBlindingBladeCard("post requested", {
            actor: actor.name,
            target: target?.actor?.name ?? target?.name,
            saveType,
            dc,
            dice,
            tokenUuids: tokenDocs.map((doc) => doc.uuid),
         })
      }

      let rollData = null
      if (dice > 0) {
         const formula = `${dice}d6[fire],${dice}d6[spirit]`
         rollData = await rollDamageFormula(formula)
      }

      const targetDocs = Object.fromEntries(
         tokenDocs.map((doc) => [
            doc.uuid,
            {
               uuid: doc.uuid,
               id: doc.id,
               name: doc.name,
               actorName: doc.actor?.name ?? doc.name,
            },
         ]),
      )

      const cardData = {
         type: "light-gaol",
         title,
         icon,
         actorUuid: actor.uuid,
         radius: null,
         barrierShattered: false,
         dc,
         damageRoll: rollData,
         traits: ABILITY_TRAITS,
         rollOptions: CARD_ROLL_OPTIONS,
         counteract: null,
         targetTokenUuids: tokenDocs.map((doc) => doc.uuid),
         targetDocs,
         targetStates: {},
         saveType,
      }
      const content = await renderCard(cardData)
      await ChatMessage.create({
         speaker: ChatMessage.getSpeaker({ actor }),
         content,
         flags: {
            [MODULE_ID]: {
               templarMessage: true,
               [CARD_FLAG]: cardData,
            },
         },
      })
      return true
   }

   static async postLightBurstCard({
      actor,
      targets = [],
      barrierShattered = false,
      counteract = null,
   } = {}) {
      const radius = lightBurstRadius(actor)
      return this._postAbilityCard({
         actor,
         targets,
         type: "light-burst",
         title: "Light Burst",
         icon: TEMPLAR_ASSETS.lightBurst,
         radius,
         barrierShattered,
         counteract: null,
      })
   }

   static async postInculpationCard({
      actor,
      target = null,
      counteract = null,
   } = {}) {
      return this._postAbilityCard({
         actor,
         targets: target ? [target] : [],
         type: "inculpation",
         title: "Inculpation",
         icon: TEMPLAR_ASSETS.inculpation,
         radius: null,
         barrierShattered: false,
         counteract: null,
      })
   }

   static async postBlindingBladeCard({
      actor,
      target = null,
      targets = [],
      dc = null,
      message = null,
   } = {}) {
      if (!actor) return false
      const targetList = Array.isArray(targets)
         ? targets
         : Array.from(targets ?? [])
      const targetDocs = uniqueTokenDocs(
         targetList.length ? targetList : target ? [target] : [],
      )
      const targetDocData = Object.fromEntries(
         targetDocs.map((doc) => [
            doc.uuid,
            {
               uuid: doc.uuid,
               id: doc.id,
               name: doc.name,
               actorName: doc.actor?.name ?? doc.name,
            },
         ]),
      )
      const cardData = {
         type: "blinding-blade",
         title: "Blinding Blade",
         icon: TEMPLAR_ASSETS.blinding,
         actorUuid: actor.uuid,
         radius: null,
         barrierShattered: false,
         dc: dc ?? actorClassOrSpellDC(actor),
         damageRoll: null,
         traits: ABILITY_TRAITS,
         rollOptions: CARD_ROLL_OPTIONS,
         counteract: null,
         targetTokenUuids: targetDocs.map((doc) => doc.uuid),
         targetDocs: targetDocData,
         targetStates: {},
         saveType: "reflex",
      }
      const content = await renderCard(cardData)
      if (message?.update) {
         await message.update({
            content,
            [`flags.${MODULE_ID}.templarMessage`]: true,
            [`flags.${MODULE_ID}.${CARD_FLAG}`]: cardData,
            [`flags.${MODULE_ID}.blindingBladeCardEnhanced`]: true,
         })
         return true
      }
      await ChatMessage.create({
         speaker: ChatMessage.getSpeaker({ actor }),
         content,
         flags: {
            [MODULE_ID]: {
               templarMessage: true,
               [CARD_FLAG]: cardData,
               blindingBladeCardEnhanced: true,
            },
         },
      })
      return true
   }

   static async _postAbilityCard({
      actor,
      targets,
      type,
      title,
      icon,
      radius,
      barrierShattered,
      counteract,
   }) {
      if (!actor) return false
      const tokenDocs = uniqueTokenDocs(targets)
      const damageRoll = await rollDamageOnce(actor)
      const dc = actorClassOrSpellDC(actor)
      const targetDocs = Object.fromEntries(
         tokenDocs.map((doc) => [
            doc.uuid,
            {
               uuid: doc.uuid,
               id: doc.id,
               name: doc.name,
               actorName: doc.actor?.name ?? doc.name,
            },
         ]),
      )
      const cardData = {
         type,
         title,
         icon,
         actorUuid: actor.uuid,
         radius,
         barrierShattered: Boolean(barrierShattered),
         dc,
         damageRoll,
         traits: ABILITY_TRAITS,
         rollOptions: CARD_ROLL_OPTIONS,
         counteract,
         targetTokenUuids: tokenDocs.map((doc) => doc.uuid),
         targetDocs,
         targetStates: {},
      }
      const content = await renderCard(cardData)
      await ChatMessage.create({
         speaker: ChatMessage.getSpeaker({ actor }),
         content,
         flags: {
            [MODULE_ID]: {
               templarMessage: true,
               [CARD_FLAG]: cardData,
            },
         },
      })
      return true
   }

   static _registerSocket() {
      if (globalThis[SOCKET_GLOBAL]) return globalThis[SOCKET_GLOBAL]
      if (typeof globalThis.socketlib?.registerModule !== "function")
         return null
      let socket = null
      try {
         socket = globalThis.socketlib.registerModule(MODULE_ID)
      } catch (_error) {
         return null
      }
      if (typeof socket?.register !== "function") return null
      socket.register("applyTemplarAbilityCardDamage", (payload = {}) =>
         this.gmApplyCardDamage(payload),
      )
      socket.register("applyTemplarAbilityCardEffect", (payload = {}) =>
         this.gmApplyCardEffect(payload),
      )
      socket.register("persistTemplarAbilityCard", (payload = {}) =>
         this.gmPersistCard(payload),
      )
      globalThis[SOCKET_GLOBAL] = socket
      return socket
   }

   static _installListeners() {
      if (this._listenersInstalled) return
      this._listenersInstalled = true
      document.addEventListener(
         "click",
         (event) => {
            const target =
               event.target instanceof Element
                  ? event.target
                  : event.target?.parentElement
            const control = target?.closest?.(`[${CARD_ACTION}]`)
            if (!control) return
            const card = control.closest(".ssc-templar-ability-card")
            if (!card) return
            event.preventDefault()
            event.stopImmediatePropagation()
            debugCard("click", {
               action: control.dataset.sscTemplarCardAction,
               messageId: card.closest(".message")?.dataset?.messageId,
            })
            void this._handleClick(control, card).catch(() => {
               ui.notifications?.warn(
                  "The Templar special card action failed.",
               )
            })
         },
         true,
      )
      document.addEventListener(
         "contextmenu",
         (event) => {
            this._inspectorContext = null
            this._rerollContext = null
            const target =
               event.target instanceof Element
                  ? event.target
                  : event.target?.parentElement
            const row = target?.closest?.(
               ".ssc-templar-ability-card .target-row",
            )
            if (!row) return
            const messageId =
               row.closest("[data-message-id]")?.dataset?.messageId
            if (!messageId) return
            this._inspectorContext = {
               messageId,
               key: this._inspectorKey(row.dataset.targetUuid),
            }
            if (row.dataset.rolled !== "true") return
            this._rerollContext = {
               messageId,
               targetUuid: row.dataset.targetUuid || null,
            }
         },
         true,
      )
   }

   static _installContextMenu() {
      if (this._contextMenuInstalled) return
      const proto = CONFIG?.ui?.chat?.prototype
      const original = proto?._getEntryContextOptions
      if (typeof original !== "function") return
      const manager = this
      this._contextMenuInstalled = true
      proto._getEntryContextOptions = function (...args) {
         const options = original.apply(this, args)
         if (!Array.isArray(options)) return options
         const gateKey =
            (game.release?.generation ?? 13) >= 14 ? "visible" : "condition"
         const inspect = {
            name: "PF2E.ChatRollDetails.Select",
            icon: '<i class="fa-solid fa-magnifying-glass"></i>',
            callback: (li) => manager._openStoredInspector(li),
         }
         inspect[gateKey] = (li) => manager._hasStoredInspector(li)
         const heroPoint = {
            name: "PF2E.RerollMenu.HeroPoint",
            icon: '<i class="fa-solid fa-hospital-symbol"></i>',
            callback: async (li) => manager._heroPointReroll(li),
         }
         heroPoint[gateKey] = (li) => manager._canHeroPointReroll(li)
         const providence = {
            name: "Reroll using Providence",
            icon: '<i class="fa-solid fa-sun"></i>',
            callback: async (li) => manager._providenceReroll(li),
         }
         providence[gateKey] = (li) => manager._canProvidenceReroll(li)
         options.push(inspect, heroPoint, providence)
         return options
      }
   }

   static async _handleClick(control, card) {
      const action = control.dataset.sscTemplarCardAction
      const cardData = this._cardData(card)
      if (isBlindingBladeCardData(cardData)) {
         logBlindingBladeCard("click", {
            action,
            messageId: this._cardMessage(card)?.id,
            targetUuid: control.closest("[data-target-uuid]")?.dataset
               ?.targetUuid,
         })
      }
      if (action === "expand-roll") {
         control.closest(".dice-roll")?.classList.toggle("expanded")
         return
      }
      if (action === "capture-target-save") {
         await this._captureTargetAndRollSave(control, card)
         return
      }
      const row = control.closest("[data-target-uuid]")
      const targetUuid = row?.dataset.targetUuid
      if (!targetUuid) {
         debugCard("missing target uuid", { action })
         ui.notifications?.warn(
            "This Templar card row is missing its target token.",
         )
         return
      }
      if (action === "roll-save") {
         await this._rollSave(control, card, targetUuid, {
            isReroll: row?.dataset.rolled === "true",
         })
         return
      }
      if (action === "apply-damage") {
         await this._applyDamageFromButton(control, card, targetUuid)
         return
      }
      debugCard("unknown action", { action, targetUuid })
   }

   static async _captureTargetAndRollSave(control, card) {
      const message = this._cardMessage(card)
      const data = message?.getFlag?.(MODULE_ID, CARD_FLAG)
      if (!message || !data) {
         ui.notifications?.warn(
            "This Templar card is missing its saved card data.",
         )
         return false
      }
      const selected = Array.from(game.user?.targets ?? [])
      const [doc] = uniqueTokenDocs(selected)
      if (!doc) {
         ui.notifications?.warn("Target the struck creature first.")
         return false
      }

      data.targetTokenUuids = [doc.uuid]
      data.targetDocs = {
         [doc.uuid]: {
            uuid: doc.uuid,
            id: doc.id,
            name: doc.name,
            actorName: doc.actor?.name ?? doc.name,
         },
      }
      data.targetStates = {}

      const template = document.createElement("template")
      template.innerHTML = (await renderCard(data)).trim()
      const replacement = template.content.firstElementChild
      if (!replacement) return false
      card.replaceWith(replacement)
      await this._persistCard(replacement, { cardData: data })

      const activeCard = this._cardElementFor(message.id) ?? replacement
      const activeRow = Array.from(
         activeCard.querySelectorAll("[data-target-uuid]"),
      ).find((row) => row.dataset.targetUuid === doc.uuid)
      const rollControl = activeRow?.querySelector(
         "[data-ssc-templar-card-action='roll-save']",
      )
      if (!rollControl) {
         ui.notifications?.warn(
            "The Blinding Blade card could not find the new save row.",
         )
         return false
      }
      return this._rollSave(rollControl, activeCard, doc.uuid)
   }

   static _cardMessage(card) {
      const messageId = card?.closest(".message")?.dataset.messageId
      return messageId ? (game.messages?.get?.(messageId) ?? null) : null
   }

   static _cardData(card) {
      return this._cardMessage(card)?.getFlag?.(MODULE_ID, CARD_FLAG) ?? null
   }

   static async _rollSave(
      control,
      card,
      targetUuid,
      { isReroll = false, heroPoint = false, providence = false } = {},
   ) {
      const message = this._cardMessage(card)
      const data = message?.getFlag?.(MODULE_ID, CARD_FLAG)
      if (!message || !data) {
         debugCard("missing card data", {
            hasMessage: Boolean(message),
            targetUuid,
         })
         ui.notifications?.warn(
            "This Templar card is missing its saved card data.",
         )
         return false
      }
      const token = await resolveUuid(targetUuid)
      const actor = token?.actor
      const statName = data.saveType ?? "reflex"
      const saveStat =
         actor?.saves?.[statName] ?? actor?.getStatistic?.(statName)
      if (isBlindingBladeCardData(data)) {
         logBlindingBladeCard("roll setup", {
            messageId: message.id,
            targetUuid,
            token: token?.name,
            actor: actor?.name,
            statName,
            dc: data.dc,
            hasSaveRoll: typeof saveStat?.roll === "function",
            isReroll,
            heroPoint,
            providence,
         })
      }
      if (!actor || typeof saveStat?.roll !== "function") {
         debugCard("missing save", {
            targetUuid,
            token: token?.name,
            actor: actor?.name,
            actorType: actor?.type,
         })
         ui.notifications?.warn(
            `The target does not have a ${statName} save statistic.`,
         )
         return false
      }
      if (heroPoint && !this._hasHeroPoint(actor)) return false

      let callbackOutcome = null
      let inspectorSource = null
      const modifiers = []
      const providenceBonus = providence
         ? Number(this._templarApi()?.providenceBonus?.(actor) ?? 0)
         : 0
      if (providenceBonus > 0) {
         const Modifier = game.pf2e?.Modifier
         modifiers.push(
            Modifier
               ? new Modifier({
                    slug: "providence",
                    label: "Providence",
                    modifier: providenceBonus,
                    type: "circumstance",
                 })
               : {
                    slug: "providence",
                    label: "Providence",
                    modifier: providenceBonus,
                    type: "circumstance",
                 },
         )
      }
      debugCard(`rolling ${statName}`, {
         targetUuid,
         actor: actor.name,
         dc: data.dc,
         isReroll,
         heroPoint,
         providence,
      })
      const roll = await saveStat.roll({
         dc: Number.isFinite(Number(data.dc))
            ? { value: Number(data.dc) }
            : undefined,
         createMessage: false,
         extraRollOptions: [
            ...new Set([...(data.rollOptions ?? []), ...CARD_ROLL_OPTIONS]),
         ],
         modifiers,
         callback: (_roll, outcome, rollMessage) => {
            callbackOutcome = outcome
            inspectorSource = this._captureInspectorSource(rollMessage)
         },
      })
      if (!roll) {
         debugCard("roll cancelled or unavailable", {
            targetUuid,
            actor: actor.name,
         })
         if (isBlindingBladeCardData(data)) {
            logBlindingBladeCard("roll returned no result", {
               targetUuid,
               actor: actor.name,
            })
         }
         return false
      }
      if (heroPoint && !(await this._spendHeroPoint(actor))) return false
      await this._presentRoll(roll)
      const outcome = outcomeFromRoll(roll, callbackOutcome)
      const d20 = d20TotalFromRoll(roll)
      debugCard("save rolled", {
         type: data.type,
         title: data.title,
         saveType: statName,
         targetUuid,
         actor: actor.name,
         total: roll.total,
         d20,
         outcome,
      })
      if (isBlindingBladeCardData(data)) {
         logBlindingBladeCard("save rolled", {
            targetUuid,
            actor: actor.name,
            total: roll.total,
            d20,
            callbackOutcome,
            outcome,
         })
      }
      const row = control.closest(".target-row")
      data.targetStates = foundry.utils.deepClone(data.targetStates ?? {})
      data.targetStates[targetUuid] = {
         ...(data.targetStates[targetUuid] ?? {}),
         rolled: true,
         outcome,
         total: Number(roll.total) || 0,
         d20,
         rerolled: Boolean(isReroll),
         heroPoint: Boolean(heroPoint),
         providence: Boolean(providence),
         providenceBonus,
         damageApplied: false,
         appliedEffects: [],
      }
      await this._renderSaveResult(control, row, roll, outcome, d20, data)
      const appliedEffects = await this._applyOutcomeEffects({
         targetUuid,
         data,
         outcome,
      })
      data.targetStates[targetUuid].appliedEffects = appliedEffects
      const note = row?.querySelector(".ssc-templar-card-target-note")
      if (note) {
         const noteHtml = await renderOutcomeNote(
            data.type,
            outcome,
            data.barrierShattered,
            appliedEffects,
            data.saveType,
         )
         note.innerHTML = noteHtml
         note.classList.toggle("hidden", !noteHtml)
      }
      await this._persistCard(card, {
         cardData: data,
         inspectorKey: this._inspectorKey(targetUuid),
         inspectorSource,
         inspectorClear: isReroll && !inspectorSource,
      })
      return true
   }

   static async _renderSaveResult(control, row, roll, outcome, d20, data) {
      const normalized = normalizeOutcome(outcome)
      const className = outcomeClass(normalized)
      if (row) {
         row.dataset.rolled = "true"
         row.dataset.outcome = className
         row.classList.toggle(
            "crit-success-row",
            className === "criticalSuccess",
         )
      }
      const degree = control.querySelector(".degree")
      if (degree) {
         degree.textContent = String(roll.total ?? "")
         degree.classList.remove(
            "hidden",
            "critical-success",
            "success",
            "failure",
            "critical-failure",
            "criticalSuccess",
            "criticalFailure",
         )
         degree.classList.add("show", className)
         degree.dataset.tooltip = outcomeLabel(normalized)
         degree.title = outcomeLabel(normalized)
      }
      control.classList.remove("roll")
      control.classList.add("reroll")
      control.dataset.sscTemplarCardRole = "reroll-save"
      control.dataset.tooltip = await saveTooltip(data.dc, roll, normalized, d20)
      control.querySelector(".die")?.classList.add("hidden")
      const note = row?.querySelector(".ssc-templar-card-target-note")
      if (note) {
         const noteHtml = await renderOutcomeNote(
            data.type,
            normalized,
            data.barrierShattered,
            [],
            data.saveType,
         )
         note.innerHTML = noteHtml
         note.classList.toggle("hidden", !noteHtml)
      }
      const application = row?.querySelector(".ssc-templar-card-application")
      if (application) {
         application.classList.remove(
            "hidden",
            "applied",
            "criticalSuccess",
            "success",
            "failure",
            "criticalFailure",
            "critical-success",
            "critical-failure",
         )
         if (data.saveType === "will") {
            application.classList.add("hidden")
         } else {
            application.classList.add(className)
            application.innerHTML = await renderDamageButtons(normalized)
         }
      }
   }

   static async _applyOutcomeEffects({ targetUuid, data, outcome } = {}) {
      const plans = effectPlanForOutcome(
         data.type,
         outcome,
         data.barrierShattered,
         data.saveType,
      )
      debugCard("outcome effect plans", {
         type: data.type,
         title: data.title,
         saveType: data.saveType,
         targetUuid,
         outcome,
         plans,
      })
      if (isBlindingBladeCardData(data)) {
         logBlindingBladeCard("outcome effect plans", {
            targetUuid,
            outcome,
            saveType: data.saveType,
            plans,
         })
      }
      const applied = []
      for (const plan of plans) {
         const success = await this._routeCardAction(
            "applyTemplarAbilityCardEffect",
            {
               targetUuid,
               effect: {
                  ...plan,
                  sourceName: data.title,
               },
            },
         )
         debugCard("outcome effect routed", {
            targetUuid,
            plan,
            success,
         })
         if (isBlindingBladeCardData(data)) {
            logBlindingBladeCard("outcome effect routed", {
               targetUuid,
               plan,
               success,
            })
         }
         if (success) applied.push(plan.label ?? plan.slug)
      }
      return applied
   }

   static async _applyDamageFromButton(control, card, targetUuid) {
      const data = this._cardData(card)
      if (!data?.damageRoll) return false
      const multiplier = Number(control.dataset.multiplier || 1)
      const success = await this._routeCardAction(
         "applyTemplarAbilityCardDamage",
         {
            targetUuid,
            damage: data.damageRoll,
            multiplier,
         },
      )
      if (!success) return false
      control.classList.add("applied")
      const row = control.closest(".target-row")
      const application = control.closest(".ssc-templar-card-application")
      application?.classList.add("applied")
      row?.classList.add("applied")
      data.targetStates = foundry.utils.deepClone(data.targetStates ?? {})
      data.targetStates[targetUuid] = {
         ...(data.targetStates[targetUuid] ?? {}),
         damageApplied: true,
         damageMultiplier: multiplier,
      }
      await this._persistCard(card, { cardData: data })
      return true
   }

   static async _routeCardAction(handler, payload) {
      const isBlindingBlade =
         payload?.effect?.sourceName === "Blinding Blade" ||
         payload?.effect?.slug === "blinded"
      if (game.user?.isGM) {
         if (isBlindingBlade) {
            logBlindingBladeCard("route direct GM", {
               handler,
               payload,
            })
         }
         if (handler === "applyTemplarAbilityCardDamage")
            return this.gmApplyCardDamage(payload)
         if (handler === "applyTemplarAbilityCardEffect")
            return this.gmApplyCardEffect(payload)
         return this.gmPersistCard(payload)
      }
      const socket = globalThis[SOCKET_GLOBAL] ?? this._registerSocket()
      if (!socket) {
         if (isBlindingBlade) {
            logBlindingBladeCard("route failed: no socket", {
               handler,
               payload,
            })
         }
         ui.notifications?.warn(
            "Socketlib is unavailable; a GM must apply this card result.",
         )
         return false
      }
      if (isBlindingBlade) {
         logBlindingBladeCard("route socket GM", {
            handler,
            payload,
         })
      }
      return socket.executeAsGM(handler, payload)
   }

   static async gmApplyCardDamage({ targetUuid, damage, multiplier = 1 } = {}) {
      const token = await resolveUuid(targetUuid)
      const actor = token?.actor
      if (!actor || !damage) return false
      const tokenObject =
         token.object ?? canvas?.tokens?.get?.(token.id) ?? null
      const scale = Number(multiplier) || 1
      const total = Math.max(0, Math.floor((Number(damage.total) || 0) * scale))
      let roll = null
      let rebuiltTypedRoll = false
      roll = await damageRollFromInstances(damage, scale)
      rebuiltTypedRoll = Boolean(roll)
      try {
         roll ??= damage.rollJSON
            ? Roll.fromData(JSON.parse(damage.rollJSON))
            : null
      } catch (_error) {
         roll ??= null
      }
      if (roll && actor.applyDamage) {
         if (!rebuiltTypedRoll) scaleRollTotal(roll, scale, total)
         await actor.applyDamage({ damage: roll, token: tokenObject })
         return true
      }
      if (actor.applyDamage) {
         await actor.applyDamage({ damage: total, token: tokenObject })
         return true
      }
      return false
   }

   static async gmApplyCardEffect({ targetUuid, effect } = {}) {
      const token = await resolveUuid(targetUuid)
      const actor = token?.actor
      debugCard("GM apply card effect requested", {
         targetUuid,
         token: token?.name,
         actor: actor?.name,
         effect,
      })
      if (effect?.sourceName === "Blinding Blade" || effect?.slug === "blinded") {
         logBlindingBladeCard("GM apply effect requested", {
            targetUuid,
            token: token?.name,
            actor: actor?.name,
            effect,
         })
      }
      if (!actor?.createEmbeddedDocuments || !effect?.slug) return false
      const condition = game.pf2e?.ConditionManager?.getCondition?.(effect.slug)
      const uuid = condition?.sourceId ?? condition?.uuid
      if (!uuid) {
         debugCard("GM apply card effect missing condition uuid", {
            targetUuid,
            slug: effect.slug,
         })
         if (
            effect?.sourceName === "Blinding Blade" ||
            effect?.slug === "blinded"
         ) {
            logBlindingBladeCard("GM apply effect missing condition uuid", {
               targetUuid,
               slug: effect.slug,
            })
         }
         return false
      }
      const duration = {
         value: Number(effect.value) || 1,
         unit: effect.unit || "rounds",
         expiry: "turn-start",
      }
      const [created] = await actor.createEmbeddedDocuments("Item", [
         {
            name: `Effect: ${effect.sourceName ?? "Templar"} - ${effect.label ?? effect.slug}`,
            type: "effect",
            img: condition.img ?? "systems/pf2e/icons/default-icons/effect.svg",
            system: {
               slug: `effect-${MODULE_ID}-${effect.slug}`,
               duration,
               description: {
                  value: `${effect.label ?? effect.slug} applied by ${effect.sourceName ?? "a Templar card"}.`,
               },
               rules: [
                  {
                     key: "GrantItem",
                     uuid,
                     onDeleteActions: { grantee: "restrict" },
                  },
               ],
            },
            flags: {
               [MODULE_ID]: {
                  templarAbilityCardEffect: true,
                  condition: effect.slug,
               },
            },
         },
      ])
      debugCard("GM apply card effect created", {
         targetUuid,
         actor: actor.name,
         createdId: created?.id,
         createdUuid: created?.uuid,
         condition: effect.slug,
         duration,
      })
      if (effect?.sourceName === "Blinding Blade" || effect?.slug === "blinded") {
         logBlindingBladeCard("GM apply effect created", {
            targetUuid,
            actor: actor.name,
            createdId: created?.id,
            createdUuid: created?.uuid,
            condition: effect.slug,
            duration,
         })
      }
      return Boolean(created)
   }

   static async gmPersistCard({
      messageId,
      content,
      cardData,
      inspectorKey = null,
      inspectorSource = null,
      inspectorClear = false,
   } = {}) {
      const message = messageId ? game.messages?.get?.(messageId) : null
      if (!message) return false
      const update = {}
      if (typeof content === "string") update.content = content
      if (cardData) update[`flags.${MODULE_ID}.${CARD_FLAG}`] = cardData
      if (inspectorKey) {
         const inspector = foundry.utils.deepClone(
            message.getFlag(MODULE_ID, INSPECTOR_FLAG) || {},
         )
         if (inspectorClear) delete inspector[inspectorKey]
         else if (inspectorSource) {
            inspector[inspectorKey] =
               typeof inspectorSource === "string"
                  ? inspectorSource
                  : JSON.stringify(inspectorSource)
         }
         update[`flags.${MODULE_ID}.${INSPECTOR_FLAG}`] = inspector
      }
      if (Object.keys(update).length === 0) return false
      await message.update(update)
      return true
   }

   static async _persistCard(
      card,
      {
         cardData = null,
         inspectorKey = null,
         inspectorSource = null,
         inspectorClear = false,
      } = {},
   ) {
      const messageId = card?.closest(".message")?.dataset.messageId
      if (!messageId || !card) return false
      const payload = {
         messageId,
         content: card.outerHTML,
         cardData,
         inspectorKey,
         inspectorSource,
         inspectorClear,
      }
      if (game.user?.isGM) return this.gmPersistCard(payload).catch(() => false)
      const socket = globalThis[SOCKET_GLOBAL] ?? this._registerSocket()
      if (socket) {
         await socket
            .executeAsGM("persistTemplarAbilityCard", payload)
            .catch(() => false)
         return true
      }
      const message = game.messages?.get?.(messageId)
      await message?.update?.({ content: card.outerHTML }).catch(() => false)
      return true
   }

   static _captureInspectorSource(message) {
      try {
         if (!message) return null
         const source = message.toObject?.() ?? message
         const pf2e = message.flags?.pf2e ?? source.flags?.pf2e
         if (!pf2e?.context) return null
         return {
            type: source.type ?? message.type ?? "base",
            author: game.user?.id ?? null,
            speaker: source.speaker ?? message.speaker ?? {},
            flags: { pf2e: foundry.utils.deepClone(pf2e) },
         }
      } catch (_error) {
         return null
      }
   }

   static _inspectorKey(targetUuid) {
      return String(targetUuid || "").replace(/[.\s]+/g, "_")
   }

   static _liElement(li) {
      if (!li) return null
      if (li instanceof HTMLElement) return li
      if (li[0] instanceof HTMLElement) return li[0]
      if (li.element instanceof HTMLElement) return li.element
      return null
   }

   static _liMessageId(li) {
      const element = this._liElement(li)
      return (
         element?.dataset?.messageId ||
         element?.closest?.("[data-message-id]")?.dataset?.messageId ||
         null
      )
   }

   static _inspectorContextForLi(li) {
      if (!this._inspectorContext) return null
      const id = this._liMessageId(li)
      if (id && id !== this._inspectorContext.messageId) return null
      return this._inspectorContext
   }

   static _rerollContextForLi(li) {
      if (!this._rerollContext) return null
      const id = this._liMessageId(li)
      if (id && id !== this._rerollContext.messageId) return null
      return this._rerollContext
   }

   static _cardElementFor(messageId) {
      if (!messageId || typeof document === "undefined") return null
      const escape = globalThis.CSS?.escape || ((value) => String(value))
      return document.querySelector(
         `[data-message-id="${escape(messageId)}"] .ssc-templar-ability-card`,
      )
   }

   static _rerollRowForContext(ctx) {
      const card = this._cardElementFor(ctx?.messageId)
      if (!card || !ctx?.targetUuid) return null
      const escape = globalThis.CSS?.escape || ((value) => String(value))
      return card.querySelector(
         `.target-row[data-target-uuid="${escape(ctx.targetUuid)}"]`,
      )
   }

   static _saveControlForRow(row) {
      return (
         row?.querySelector?.("[data-ssc-templar-card-action='roll-save']") ??
         null
      )
   }

   static _targetActorSync(targetUuid) {
      return globalThis.fromUuidSync?.(targetUuid)?.actor ?? null
   }

   static _ownsTargetSync(targetUuid) {
      if (game.user?.isGM) return true
      const actor = this._targetActorSync(targetUuid)
      return Boolean(actor?.testUserPermission?.(game.user, "OWNER"))
   }

   static _heroPointActor(actor) {
      return actor?.isOfType?.("familiar") ? actor.master : actor
   }

   static _heroPointPath(actor) {
      const source = this._heroPointActor(actor)
      const candidates = [
         "system.resources.heroPoints.value",
         "system.resources.hero.value",
         "system.heroPoints.value",
         "system.attributes.heroPoints.value",
      ]
      for (const path of candidates) {
         const value = Number(foundry.utils.getProperty(source, path))
         if (Number.isFinite(value)) return path
      }
      return null
   }

   static _hasHeroPoint(actor) {
      const source = this._heroPointActor(actor)
      const path = this._heroPointPath(source)
      const current = Number(
         path ? foundry.utils.getProperty(source, path) : NaN,
      )
      if (path && Number.isFinite(current) && current > 0) return true
      ui.notifications?.warn(
         `${source?.name ?? "This actor"} has no Hero Points.`,
      )
      return false
   }

   static async _spendHeroPoint(actor) {
      const source = this._heroPointActor(actor)
      const path = this._heroPointPath(source)
      const current = Number(
         path ? foundry.utils.getProperty(source, path) : NaN,
      )
      if (!path || !Number.isFinite(current) || current <= 0) {
         ui.notifications?.warn(
            `${source?.name ?? "This actor"} has no Hero Points.`,
         )
         return false
      }
      try {
         await source.update({ [path]: Math.max(0, current - 1) })
         return true
      } catch (_error) {
         ui.notifications?.warn("Could not spend a Hero Point for this actor.")
         return false
      }
   }

   static _canHeroPointReroll(li) {
      const ctx = this._rerollContextForLi(li)
      if (!ctx?.targetUuid) return false
      const message = game.messages?.get?.(ctx.messageId)
      if (!message?.getFlag?.(MODULE_ID, CARD_FLAG)) return false
      const row = this._rerollRowForContext(ctx)
      if (!row || row.dataset.rolled !== "true") return false
      if (!this._saveControlForRow(row)) return false
      if (!this._ownsTargetSync(ctx.targetUuid)) return false
      const actor = this._heroPointActor(this._targetActorSync(ctx.targetUuid))
      if (!actor?.isOfType?.("character")) return false
      const path = this._heroPointPath(actor)
      const value = Number(path ? foundry.utils.getProperty(actor, path) : NaN)
      return Number.isFinite(value) && value > 0
   }

   static async _heroPointReroll(li) {
      const ctx = this._rerollContextForLi(li) || this._rerollContext
      if (!ctx?.targetUuid) return false
      const card = this._cardElementFor(ctx.messageId)
      const row = this._rerollRowForContext(ctx)
      const control = this._saveControlForRow(row)
      if (!card || !row || !control) return false
      if (!this._ownsTargetSync(ctx.targetUuid)) {
         ui.notifications?.warn(
            "Only the target's owner or a GM can reroll this save.",
         )
         return false
      }
      return this._rollSave(control, card, ctx.targetUuid, {
         isReroll: true,
         heroPoint: true,
      })
   }

   static _templarApi() {
      return game.modules?.get?.(MODULE_ID)?.api?.templar ?? {}
   }

   static _canProvidenceReroll(li) {
      const ctx = this._rerollContextForLi(li)
      if (!ctx?.targetUuid) return false
      const message = game.messages?.get?.(ctx.messageId)
      if (!message?.getFlag?.(MODULE_ID, CARD_FLAG)) return false
      const row = this._rerollRowForContext(ctx)
      if (!row || row.dataset.rolled !== "true") return false
      if (!this._saveControlForRow(row)) return false
      if (!row.dataset.outcome) return false
      const outcome = normalizeOutcome(row.dataset.outcome)
      if (!["failure", "criticalFailure"].includes(outcome)) return false
      if (!this._ownsTargetSync(ctx.targetUuid)) return false
      const actor = this._targetActorSync(ctx.targetUuid)
      return Boolean(actor && actorHasSlug(actor, TEMPLAR_SLUGS.providence))
   }

   static async _providenceReroll(li) {
      const ctx = this._rerollContextForLi(li) || this._rerollContext
      if (!ctx?.targetUuid) return false
      const card = this._cardElementFor(ctx.messageId)
      const row = this._rerollRowForContext(ctx)
      const control = this._saveControlForRow(row)
      const actor = await resolveUuid(ctx.targetUuid)
         .then((token) => token?.actor)
         .catch(() => null)
      if (!card || !row || !control || !actor) return false
      if (!this._ownsTargetSync(ctx.targetUuid)) {
         ui.notifications?.warn(
            "Only the target's owner or a GM can reroll this save.",
         )
         return false
      }
      const api = this._templarApi()
      if (
         !api.prepareProvidenceReroll?.({
            actor,
            spendFocus: true,
            applyBonus: false,
         })
      ) {
         return false
      }
      const rerolled = await this._rollSave(control, card, ctx.targetUuid, {
         isReroll: true,
         providence: true,
      })
      if (!rerolled) return false
      await api.completeProvidenceReroll?.({
         actor,
         message: this._cardMessage(card),
         spendFocus: true,
      })
      return true
   }

   static _storedInspectorKey(message, ctx) {
      const store = message?.getFlag?.(MODULE_ID, INSPECTOR_FLAG) || {}
      if (ctx?.key && store[ctx.key]) return ctx.key
      const keys = Object.keys(store).filter((key) => store[key])
      return keys.length === 1 ? keys[0] : null
   }

   static _hasStoredInspector(li) {
      if (!game.user?.isGM) return false
      const ctx = this._inspectorContextForLi(li)
      if (!ctx) return false
      const message = game.messages?.get?.(ctx.messageId)
      if (!message?.getFlag?.(MODULE_ID, CARD_FLAG)) return false
      return Boolean(this._storedInspectorKey(message, ctx))
   }

   static async _openStoredInspector(li) {
      const ctx = this._inspectorContextForLi(li) || this._inspectorContext
      const message = ctx ? game.messages?.get?.(ctx.messageId) : null
      const key = this._storedInspectorKey(message, ctx)
      if (!message || !key) return false
      const store = message.getFlag(MODULE_ID, INSPECTOR_FLAG) || {}
      let source = store[key]
      try {
         source = typeof source === "string" ? JSON.parse(source) : source
      } catch (_error) {
         return false
      }
      try {
         const Msg = ChatMessage.implementation ?? ChatMessage
         delete source._id
         const temp = new Msg(source)
         if (typeof temp.showDetails === "function") {
            await temp.showDetails()
            return true
         }
      } catch (_error) {
         ui.notifications?.warn(
            "Could not open the Roll Inspector for this result.",
         )
      }
      return false
   }

   static async _presentRoll(roll) {
      try {
         await game.dice3d?.showForRoll?.(roll, game.user, true)
      } catch (_error) {
         undefined
      }
      try {
         if (CONFIG.sounds?.dice) {
            foundry.audio?.AudioHelper?.play?.(
               { src: CONFIG.sounds.dice, volume: 0.8 },
               true,
            )
         }
      } catch (_error) {
         undefined
      }
   }
}

export function postLightBurstCard(options = {}) {
   return LightBurstCardManager.postLightBurstCard(options)
}

export function postInculpationCard(options = {}) {
   return LightBurstCardManager.postInculpationCard(options)
}

export function postLightGaolBoundaryCard(options = {}) {
   return LightBurstCardManager.postLightGaolBoundaryCard(options)
}

export function postBlindingBladeCard(options = {}) {
   return LightBurstCardManager.postBlindingBladeCard(options)
}
