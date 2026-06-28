import {
   MODULE_ID,
   TEMPLAR_SLUGS,
} from "../constants.mjs"
import { actorHasSlug } from "../state.mjs"
import {
   CARD_FLAG,
   INSPECTOR_FLAG,
} from "./constants.mjs"
import { normalizeOutcome } from "./outcomes.mjs"
import { resolveUuid } from "./documents.mjs"

export function liElement(li) {
   if (!li) return null
   if (li instanceof HTMLElement) return li
   if (li[0] instanceof HTMLElement) return li[0]
   if (li.element instanceof HTMLElement) return li.element
   return null
}

export function liMessageId(li) {
   const element = liElement(li)
   return (
      element?.dataset?.messageId ||
      element?.closest?.("[data-message-id]")?.dataset?.messageId ||
      null
   )
}

export function inspectorContextForLi(manager, li) {
   if (!manager._inspectorContext) return null
   const id = liMessageId(li)
   if (id && id !== manager._inspectorContext.messageId) return null
   return manager._inspectorContext
}

export function rerollContextForLi(manager, li) {
   if (!manager._rerollContext) return null
   const id = liMessageId(li)
   if (id && id !== manager._rerollContext.messageId) return null
   return manager._rerollContext
}

export function cardElementFor(messageId) {
   if (!messageId || typeof document === "undefined") return null
   const escape = globalThis.CSS?.escape || ((value) => String(value))
   return document.querySelector(
      `[data-message-id="${escape(messageId)}"] .ssc-templar-ability-card`,
   )
}

export function rerollRowForContext(ctx) {
   const card = cardElementFor(ctx?.messageId)
   if (!card || !ctx?.targetUuid) return null
   const escape = globalThis.CSS?.escape || ((value) => String(value))
   return card.querySelector(
      `.target-row[data-target-uuid="${escape(ctx.targetUuid)}"]`,
   )
}

export function saveControlForRow(row) {
   return (
      row?.querySelector?.("[data-ssc-templar-card-action='roll-save']") ??
      null
   )
}

export function targetActorSync(targetUuid) {
   return globalThis.fromUuidSync?.(targetUuid)?.actor ?? null
}

export function ownsTargetSync(targetUuid) {
   if (game.user?.isGM) return true
   const actor = targetActorSync(targetUuid)
   return Boolean(actor?.testUserPermission?.(game.user, "OWNER"))
}

export function heroPointActor(actor) {
   return actor?.isOfType?.("familiar") ? actor.master : actor
}

export function heroPointPath(actor) {
   const source = heroPointActor(actor)
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

export function hasHeroPoint(actor) {
   const source = heroPointActor(actor)
   const path = heroPointPath(source)
   const current = Number(path ? foundry.utils.getProperty(source, path) : NaN)
   if (path && Number.isFinite(current) && current > 0) return true
   ui.notifications?.warn(`${source?.name ?? "This actor"} has no Hero Points.`)
   return false
}

export async function spendHeroPoint(actor) {
   const source = heroPointActor(actor)
   const path = heroPointPath(source)
   const current = Number(path ? foundry.utils.getProperty(source, path) : NaN)
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

export function canHeroPointReroll(manager, li) {
   const ctx = rerollContextForLi(manager, li)
   if (!ctx?.targetUuid) return false
   const message = game.messages?.get?.(ctx.messageId)
   if (!message?.getFlag?.(MODULE_ID, CARD_FLAG)) return false
   const row = rerollRowForContext(ctx)
   if (!row || row.dataset.rolled !== "true") return false
   if (!saveControlForRow(row)) return false
   if (!ownsTargetSync(ctx.targetUuid)) return false
   const actor = heroPointActor(targetActorSync(ctx.targetUuid))
   if (!actor?.isOfType?.("character")) return false
   const path = heroPointPath(actor)
   const value = Number(path ? foundry.utils.getProperty(actor, path) : NaN)
   return Number.isFinite(value) && value > 0
}

export async function heroPointReroll(manager, li) {
   const ctx = rerollContextForLi(manager, li) || manager._rerollContext
   if (!ctx?.targetUuid) return false
   const card = cardElementFor(ctx.messageId)
   const row = rerollRowForContext(ctx)
   const control = saveControlForRow(row)
   if (!card || !row || !control) return false
   if (!ownsTargetSync(ctx.targetUuid)) {
      ui.notifications?.warn("Only the target's owner or a GM can reroll this save.")
      return false
   }
   return manager._rollSave(control, card, ctx.targetUuid, {
      isReroll: true,
      heroPoint: true,
   })
}

export function templarApi() {
   return game.modules?.get?.(MODULE_ID)?.api?.templar ?? {}
}

export function canProvidenceReroll(manager, li) {
   const ctx = rerollContextForLi(manager, li)
   if (!ctx?.targetUuid) return false
   const message = game.messages?.get?.(ctx.messageId)
   if (!message?.getFlag?.(MODULE_ID, CARD_FLAG)) return false
   const row = rerollRowForContext(ctx)
   if (!row || row.dataset.rolled !== "true") return false
   if (!saveControlForRow(row)) return false
   if (!row.dataset.outcome) return false
   const outcome = normalizeOutcome(row.dataset.outcome)
   if (!["failure", "criticalFailure"].includes(outcome)) return false
   if (!ownsTargetSync(ctx.targetUuid)) return false
   const actor = targetActorSync(ctx.targetUuid)
   return Boolean(actor && actorHasSlug(actor, TEMPLAR_SLUGS.providence))
}

export async function providenceReroll(manager, li) {
   const ctx = rerollContextForLi(manager, li) || manager._rerollContext
   if (!ctx?.targetUuid) return false
   const card = cardElementFor(ctx.messageId)
   const row = rerollRowForContext(ctx)
   const control = saveControlForRow(row)
   const actor = await resolveUuid(ctx.targetUuid)
      .then((token) => token?.actor)
      .catch(() => null)
   if (!card || !row || !control || !actor) return false
   if (!ownsTargetSync(ctx.targetUuid)) {
      ui.notifications?.warn("Only the target's owner or a GM can reroll this save.")
      return false
   }
   const api = templarApi()
   if (
      !api.prepareProvidenceReroll?.({
         actor,
         spendFocus: true,
         applyBonus: false,
      })
   ) {
      return false
   }
   const rerolled = await manager._rollSave(control, card, ctx.targetUuid, {
      isReroll: true,
      providence: true,
   })
   if (!rerolled) return false
   await api.completeProvidenceReroll?.({
      actor,
      message: manager._cardMessage(card),
      spendFocus: true,
   })
   return true
}

export function storedInspectorKey(message, ctx) {
   const store = message?.getFlag?.(MODULE_ID, INSPECTOR_FLAG) || {}
   if (ctx?.key && store[ctx.key]) return ctx.key
   const keys = Object.keys(store).filter((key) => store[key])
   return keys.length === 1 ? keys[0] : null
}

export function hasStoredInspector(manager, li) {
   if (!game.user?.isGM) return false
   const ctx = inspectorContextForLi(manager, li)
   if (!ctx) return false
   const message = game.messages?.get?.(ctx.messageId)
   if (!message?.getFlag?.(MODULE_ID, CARD_FLAG)) return false
   return Boolean(storedInspectorKey(message, ctx))
}

export async function openStoredInspector(manager, li) {
   const ctx = inspectorContextForLi(manager, li) || manager._inspectorContext
   const message = ctx ? game.messages?.get?.(ctx.messageId) : null
   const key = storedInspectorKey(message, ctx)
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
      ui.notifications?.warn("Could not open the Roll Inspector for this result.")
   }
   return false
}
