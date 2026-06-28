import { MODULE_ID } from "../constants.mjs"
import {
   CARD_FLAG,
   CARD_ROLL_OPTIONS,
   SOCKET_GLOBAL,
} from "./constants.mjs"
import {
   d20TotalFromRoll,
   outcomeFromRoll,
} from "./outcomes.mjs"
import {
   renderCard,
   renderOutcomeNote,
} from "./rendering.mjs"
import { uniqueTokenDocs } from "./targets.mjs"
import { effectPlanForOutcome } from "./effects.mjs"
import {
   gmApplyCardDamage as applyCardDamageAsGM,
   gmApplyCardEffect as applyCardEffectAsGM,
   gmPersistCard as persistCardAsGM,
} from "./gm-actions.mjs"
import {
   installAbilityCardContextMenu,
   installAbilityCardListeners,
   registerAbilityCardSocket,
} from "./interactions.mjs"
import {
   canHeroPointReroll,
   canProvidenceReroll,
   cardElementFor,
   hasHeroPoint,
   hasStoredInspector,
   heroPointActor,
   heroPointPath,
   heroPointReroll,
   inspectorContextForLi,
   liElement,
   liMessageId,
   openStoredInspector,
   ownsTargetSync,
   providenceReroll,
   rerollContextForLi,
   rerollRowForContext,
   saveControlForRow,
   spendHeroPoint,
   storedInspectorKey,
   targetActorSync,
   templarApi,
} from "./rerolls.mjs"
import { resolveUuid } from "./documents.mjs"
import {
   postBlindingBladeCard as postBlindingBladeCardMessage,
   postInculpationCard as postInculpationCardMessage,
   postLightBurstCard as postLightBurstCardMessage,
   postLightGaolBoundaryCard as postLightGaolBoundaryCardMessage,
} from "./posting.mjs"
import { renderSaveResult } from "./save-rendering.mjs"

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
      icon,
   } = {}) {
      return postLightGaolBoundaryCardMessage({
         actor,
         target,
         saveType,
         dc,
         dice,
         title,
         icon,
      })
   }

   static async postLightBurstCard({
      actor,
      targets = [],
      barrierShattered = false,
      counteract = null,
   } = {}) {
      return postLightBurstCardMessage({
         actor,
         targets,
         barrierShattered,
         counteract,
      })
   }

   static async postInculpationCard({
      actor,
      target = null,
      counteract = null,
   } = {}) {
      return postInculpationCardMessage({
         actor,
         target,
         counteract,
      })
   }

   static async postBlindingBladeCard({
      actor,
      target = null,
      targets = [],
      dc = null,
      message = null,
   } = {}) {
      return postBlindingBladeCardMessage({
         actor,
         target,
         targets,
         dc,
         message,
      })
   }

   static _registerSocket() {
      return registerAbilityCardSocket(this)
   }

   static _installListeners() {
      installAbilityCardListeners(this)
   }

   static _installContextMenu() {
      installAbilityCardContextMenu(this)
   }

   static async _handleClick(control, card) {
      const action = control.dataset.sscTemplarCardAction
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
      if (!actor || typeof saveStat?.roll !== "function") {
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
         return false
      }
      if (heroPoint && !(await this._spendHeroPoint(actor))) return false
      await this._presentRoll(roll)
      const outcome = outcomeFromRoll(roll, callbackOutcome)
      const d20 = d20TotalFromRoll(roll)
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
      await renderSaveResult(control, row, roll, outcome, d20, data)
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

   static async _applyOutcomeEffects({ targetUuid, data, outcome } = {}) {
      const plans = effectPlanForOutcome(
         data.type,
         outcome,
         data.barrierShattered,
         data.saveType,
      )
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
      if (game.user?.isGM) {
         if (handler === "applyTemplarAbilityCardDamage")
            return this.gmApplyCardDamage(payload)
         if (handler === "applyTemplarAbilityCardEffect")
            return this.gmApplyCardEffect(payload)
         return this.gmPersistCard(payload)
      }
      const socket = globalThis[SOCKET_GLOBAL] ?? this._registerSocket()
      if (!socket) {
         ui.notifications?.warn(
            "Socketlib is unavailable; a GM must apply this card result.",
         )
         return false
      }
      return socket.executeAsGM(handler, payload)
   }

   static async gmApplyCardDamage({ targetUuid, damage, multiplier = 1 } = {}) {
      return applyCardDamageAsGM({ targetUuid, damage, multiplier })
   }

   static async gmApplyCardEffect({ targetUuid, effect } = {}) {
      return applyCardEffectAsGM({ targetUuid, effect })
   }

   static async gmPersistCard({
      messageId,
      content,
      cardData,
      inspectorKey = null,
      inspectorSource = null,
      inspectorClear = false,
   } = {}) {
      return persistCardAsGM({
         messageId,
         content,
         cardData,
         inspectorKey,
         inspectorSource,
         inspectorClear,
      })
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
      return liElement(li)
   }

   static _liMessageId(li) {
      return liMessageId(li)
   }

   static _inspectorContextForLi(li) {
      return inspectorContextForLi(this, li)
   }

   static _rerollContextForLi(li) {
      return rerollContextForLi(this, li)
   }

   static _cardElementFor(messageId) {
      return cardElementFor(messageId)
   }

   static _rerollRowForContext(ctx) {
      return rerollRowForContext(ctx)
   }

   static _saveControlForRow(row) {
      return saveControlForRow(row)
   }

   static _targetActorSync(targetUuid) {
      return targetActorSync(targetUuid)
   }

   static _ownsTargetSync(targetUuid) {
      return ownsTargetSync(targetUuid)
   }

   static _heroPointActor(actor) {
      return heroPointActor(actor)
   }

   static _heroPointPath(actor) {
      return heroPointPath(actor)
   }

   static _hasHeroPoint(actor) {
      return hasHeroPoint(actor)
   }

   static async _spendHeroPoint(actor) {
      return spendHeroPoint(actor)
   }

   static _canHeroPointReroll(li) {
      return canHeroPointReroll(this, li)
   }

   static async _heroPointReroll(li) {
      return heroPointReroll(this, li)
   }

   static _templarApi() {
      return templarApi()
   }

   static _canProvidenceReroll(li) {
      return canProvidenceReroll(this, li)
   }

   static async _providenceReroll(li) {
      return providenceReroll(this, li)
   }

   static _storedInspectorKey(message, ctx) {
      return storedInspectorKey(message, ctx)
   }

   static _hasStoredInspector(li) {
      return hasStoredInspector(this, li)
   }

   static async _openStoredInspector(li) {
      return openStoredInspector(this, li)
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
