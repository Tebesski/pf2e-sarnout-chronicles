import {
   MODULE_ID,
   TEMPLAR_SETTINGS,
   TEMPLAR_FEAT_SLUG_GROUPS,
   TEMPLAR_SLUGS,
} from "./templar/constants.mjs"
import { itemMatchesSlugGroup } from "./templar/effects.mjs"
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

Hooks.once("init", () => {
   CONFIG.PF2E.featTraits.templar = "Templar"
   CONFIG.PF2E.spellTraits.templar = "Templar"
   CONFIG.PF2E.actionTraits.templar = "Templar"
   CONFIG.PF2E.featTraits.barrier = "Barrier"
   CONFIG.PF2E.spellTraits.barrier = "Barrier"
   CONFIG.PF2E.actionTraits.barrier = "Barrier"

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
const BARRIER_TRAIT_GROUPS = [
   TEMPLAR_SLUGS.reactiveBarrier,
   TEMPLAR_SLUGS.lightBurst,
   TEMPLAR_SLUGS.lightShell,
   TEMPLAR_SLUGS.repentance,
   TEMPLAR_SLUGS.advent,
   TEMPLAR_SLUGS.providence,
   TEMPLAR_SLUGS.lastStronghold,
]

function autoApplyTemplarTraits(item, changes = null) {
   const isTemplar = TEMPLAR_FEAT_SLUG_GROUPS.some((slugs) =>
      itemMatchesSlugGroup(item, slugs),
   )
   if (!isTemplar) return

   const traits = changes?.system?.traits?.value ?? item.system?.traits?.value
   if (!Array.isArray(traits)) return

   const newTraits = new Set(traits)
   newTraits.add("templar")

   const isBarrier = BARRIER_TRAIT_GROUPS.some((slugs) =>
      itemMatchesSlugGroup(item, slugs),
   )
   if (isBarrier) newTraits.add("barrier")

   if (newTraits.size !== traits.length) {
      const updatedArray = Array.from(newTraits)
      if (changes) {
         foundry.utils.setProperty(changes, "system.traits.value", updatedArray)
      } else {
         item.updateSource({ "system.traits.value": updatedArray })
      }
   }
}

Hooks.on("preCreateItem", (item) => {
   autoApplyTemplarTraits(item)
})
Hooks.on("createItem", (item) => {
   refreshTemplarBarrierPanel(item.actor)
})
Hooks.on("preUpdateItem", (item, changes = {}, options = {}, userId = null) => {
   autoApplyTemplarTraits(item, changes)
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
})
Hooks.on("preDeleteItem", (item, options = {}, userId = null) =>
   templarActions.confirmBrilliantShardItemDelete({ item, options, userId }),
)
Hooks.on("deleteItem", (item) => {
   refreshTemplarBarrierPanel(item.actor)
   void templarActions.syncLinkedTemplarEffect({ item, deleted: true })
   scheduleAdventResistanceRefreshForItem(item)
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
