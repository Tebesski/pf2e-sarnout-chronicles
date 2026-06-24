import { MODULE_ID, TEMPLAR_SETTINGS } from "./templar/constants.mjs"
import {
   openTemplarBarrierPanel,
   refreshTemplarBarrierPanel,
   toggleTemplarBarrierPanel,
} from "./templar/panel.mjs"
import { registerTemplarControls } from "./templar/controls.mjs"
import { templarActions } from "./templar/api.mjs"
import { registerTemplarChatAutomation } from "./templar/chat.mjs"
import {
   LightBurstCardManager,
   postBlindingBladeCard,
   postInculpationCard,
   postLightBurstCard,
} from "./templar/cards/light-burst-cards.mjs"
import { evaluateRetributorsOath } from "./templar/retributor.mjs"

Hooks.once("init", () => {
   game.settings.register(
      MODULE_ID,
      TEMPLAR_SETTINGS.autoDealReleasedBarrierDamage,
      {
         name: "Automatically deal released Holding Barrier damage",
         hint: "When enabled, Barrier Release directly applies the released damage to the Templar. When disabled, it posts a damage card and targets the Templar token.",
         scope: "world",
         config: true,
         type: Boolean,
         default: false,
      },
   )
   game.settings.register(MODULE_ID, TEMPLAR_SETTINGS.debugAutomation, {
      name: "Debug Templar automation",
      hint: "Logs detailed Templar automation decisions to the browser console.",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
   })

   registerTemplarControls()
   registerTemplarChatAutomation()
   LightBurstCardManager.initHooks()

   const module = game.modules.get(MODULE_ID)
   if (module) {
      module.api = {
         templar: {
            ...templarActions,
            postBlindingBladeCard,
            postLightBurstCard,
            postInculpationCard,
            openPanel: openTemplarBarrierPanel,
            togglePanel: toggleTemplarBarrierPanel,
         },
      }
   }
})

Hooks.on(`${MODULE_ID}.openTemplarBarrierPanel`, (actor) => {
   openTemplarBarrierPanel(actor)
})
Hooks.on(`${MODULE_ID}.templarStateUpdated`, (actor) => {
   refreshTemplarBarrierPanel(actor)
})
Hooks.on("controlToken", () => refreshTemplarBarrierPanel())
Hooks.on("updateToken", (token) => {
   refreshTemplarBarrierPanel(token.actor)
   scheduleAdventResistanceRefresh()
})
Hooks.on("updateActor", (actor) => {
   refreshTemplarBarrierPanel(actor)
})
Hooks.on("createItem", (item) => {
   refreshTemplarBarrierPanel(item.actor)
   if (item.actor) evaluateRetributorsOath(item.actor)
})
Hooks.on("preUpdateItem", (item, changes = {}, options = {}, userId = null) => {
   templarActions.confirmBrilliantShardItemUpdate({
      item,
      changes,
      options,
      userId,
   })
   templarActions.checkLastRedoubtBadge(item, changes)
})
Hooks.on("updateItem", (item, changes) => {
   refreshTemplarBarrierPanel(item.actor)
   void templarActions.syncLinkedTemplarEffect({ item })
   void templarActions.executeLastRedoubtEnhancement(item, changes)
   scheduleAdventResistanceRefreshForItem(item)
   if (item.actor) evaluateRetributorsOath(item.actor)
})
Hooks.on("preDeleteItem", (item, options = {}, userId = null) =>
   templarActions.confirmBrilliantShardItemDelete({ item, options, userId }),
)
Hooks.on("deleteItem", (item) => {
   refreshTemplarBarrierPanel(item.actor)
   void templarActions.syncLinkedTemplarEffect({ item, deleted: true })
   scheduleAdventResistanceRefreshForItem(item)
   if (item.actor) evaluateRetributorsOath(item.actor)
})
Hooks.on("combatRound", () => refreshTemplarBarrierPanel())

let previousTemplarTurn = null
let templarCombatTurnQueue = Promise.resolve()
let adventResistanceRefreshQueued = false

function shouldRunActorAutomation(actor) {
   const activeGM = game.users?.some?.((user) => user.active && user.isGM)
   if (activeGM) return Boolean(game.user?.isGM)
   return Boolean(
      actor?.isOwner || actor?.testUserPermission?.(game.user, "OWNER"),
   )
}

function scheduleAdventResistanceRefresh() {
   if (!game.user?.isGM || adventResistanceRefreshQueued) return
   adventResistanceRefreshQueued = true
   setTimeout(() => {
      adventResistanceRefreshQueued = false
      void templarActions.refreshAdventResistance()
   }, 250)
}

function scheduleAdventResistanceRefreshForItem(item) {
   const slug = String(item?.slug ?? item?.system?.slug ?? item?.name ?? "")
      .trim()
      .toLowerCase()
   if (
      item?.getFlag?.(MODULE_ID, "adventSource") ||
      slug.includes("effect-advent-resistance")
   ) {
      return
   }
   scheduleAdventResistanceRefresh()
}

function currentCombatActor(combat = game.combat) {
   return (
      combat?.combatant?.actor ??
      combat?.combatants?.get?.(combat?.current?.combatantId)?.actor ??
      combat?.turns?.[Number(combat?.turn ?? -1)]?.actor ??
      null
   )
}

async function handleTemplarCombatTurn(
   combat = game.combat,
   { skipPreviousRelease = false } = {},
) {
   const actor = currentCombatActor(combat)
   const nextKey = `${combat?.id ?? "combat"}:${Number(combat?.round ?? 0)}:${Number(combat?.turn ?? 0)}:${actor?.id ?? "none"}`
   if (previousTemplarTurn?.key === nextKey) {
      refreshTemplarBarrierPanel()
      return
   }

   if (!skipPreviousRelease && previousTemplarTurn?.actorId) {
      const actor =
         globalThis.fromUuidSync?.(previousTemplarTurn.actorUuid) ??
         game.actors?.get(previousTemplarTurn.actorId)
      if (actor) {
         await templarActions.releaseUnsustainedHoldingBarriers({
            actor,
            round: previousTemplarTurn.round,
            turn: previousTemplarTurn.turn,
         })
         await templarActions.clearExpiredLingering({
            actor,
            round: previousTemplarTurn.round,
            turn: previousTemplarTurn.turn,
         })
      }
   }

   previousTemplarTurn = actor
      ? {
           actorId: actor.id,
           actorUuid: actor.uuid,
           round: Number(combat.round ?? 0),
           turn: Number(combat.turn ?? 0),
           key: nextKey,
        }
      : null
   refreshTemplarBarrierPanel()
   refreshTemplarBarrierPanel()
   if (actor && shouldRunActorAutomation(actor)) {
      await templarActions.promptHoldingBarrierSustainTurn({
         actor,
         round: Number(combat.round ?? 0),
         turn: Number(combat.turn ?? 0),
         releaseOnClose: false,
      })
   }
   scheduleAdventResistanceRefresh()
}

function scheduleTemplarCombatTurn(combat = game.combat, options = {}) {
   templarCombatTurnQueue = templarCombatTurnQueue
      .catch(() => null)
      .then(() => handleTemplarCombatTurn(combat, options))
   void templarCombatTurnQueue
}

Hooks.on("combatStart", (combat) => {
   previousTemplarTurn = null
   scheduleTemplarCombatTurn(combat)
})
Hooks.on("combatTurn", (combat) => {
   scheduleTemplarCombatTurn(combat)
})
Hooks.on("combatTurnChange", (combat) => {
   scheduleTemplarCombatTurn(combat)
})
Hooks.on("updateCombat", (combat, changed = {}) => {
   if (
      !("turn" in changed) &&
      !("round" in changed) &&
      !("active" in changed) &&
      !("started" in changed)
   ) {
      return
   }
   scheduleTemplarCombatTurn(combat)
})
Hooks.once("ready", () => {
   for (const actor of game.actors ?? []) {
      if (shouldRunActorAutomation(actor)) {
         void templarActions.cleanupLegacyGeneratedTemplarActions({ actor })
      }
   }
   if (game.combat?.started || game.combat?.active) {
      scheduleTemplarCombatTurn(game.combat, { skipPreviousRelease: true })
   }
})
Hooks.on("pf2e.restForTheNight", (actor) => {
   if (!shouldRunActorAutomation(actor)) return
   void templarActions.restoreLightBarrierForNight({ actor })
})
Hooks.on("deleteCombat", () => {
   previousTemplarTurn = null
   refreshTemplarBarrierPanel()
})
