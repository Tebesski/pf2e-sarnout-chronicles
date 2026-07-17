import {
   configureUnconventionalWeaponryOnCreate,
   clearNezebPathOnFathersPrideExpired,
   clearNezebPathOnFathersPrideUpdate,
   handleBounceBackDyingRemoved,
   handleBounceBackPromptButton,
   handleExemplarImperialRoll,
   handleCitizensPerseverancePromptButton,
   handleHelpingHandAidFailure,
   promptCitizensPerseveranceOnLowHp,
   refreshImperialFormationAutomation,
   removeBoldIdeaAfterSkillRoll,
   removeHadaganianResourcefulnessAfterRoll,
   restoreForMotherlandFatigue,
   trackCitizensPerseveranceTempHp,
} from "./hadaganian/feats.mjs"
import { handleWarriorCasteInitiative } from "./orc/lvl-1/warrior-caste.mjs"
import {
   handleThatsHowYouRoarDemoralizeFailure,
   handleThatsHowYouRoarPromptButton,
   restoreIntimidatingEncouragementSuppression,
   restoreRetributorsEdgeRune,
} from "./orc/lvl-5/active-feats.mjs"
import {
   configureClanSecretsOnCreate,
   handleEagerCombatantInitiative,
   handleStubbornDefianceSaveFailure,
} from "./orc/lvl-9/active-feats.mjs"
import {
   configureIncredibleTenacityOnCreate,
   handleOvercomeShameCriticalFailure,
   refreshBloodCallsToBlood,
   refreshOrcTenacityFrequency,
} from "./orc/lvl-13/active-feats.mjs"
import { configureHeroOfOrcsOnCreate } from "./orc/lvl-17/active-feats.mjs"
import {
   configureSpiritVesselOnCreate,
   handleSpiritVesselActionMessage,
} from "./orc/spirit-vessel.mjs"
import {
   promptOrcTenacityOnLowHp,
   removeDownedConditionAfterOrcTenacity,
} from "./orc/lvl-1/orc-tenacity.mjs"

let registered = false

export function registerAncestryChatAutomation() {
   if (registered) return
   registered = true
   Hooks.on("createChatMessage", (message) => {
      void handleHelpingHandAidFailure(message)
      void handleExemplarImperialRoll(message)
      void removeBoldIdeaAfterSkillRoll(message)
      void removeHadaganianResourcefulnessAfterRoll(message)
      void handleWarriorCasteInitiative(message)
      void handleEagerCombatantInitiative(message)
      void handleThatsHowYouRoarDemoralizeFailure(message)
      void handleStubbornDefianceSaveFailure(message)
      void handleOvercomeShameCriticalFailure(message)
      void handleSpiritVesselActionMessage(message)
   })
   Hooks.on("createItem", (item, _options, userId) => {
      void removeDownedConditionAfterOrcTenacity(item)
      if (userId !== game.user?.id) return
      void configureUnconventionalWeaponryOnCreate(item)
      void configureSpiritVesselOnCreate(item)
      void configureClanSecretsOnCreate(item)
      void configureIncredibleTenacityOnCreate(item)
      void configureHeroOfOrcsOnCreate(item)
      void refreshBloodCallsToBlood(item.actor)
      refreshImperialFormationAutomation()
   })
   Hooks.on("createToken", () =>
      refreshImperialFormationAutomation([], { delay: 0 }),
   )
   Hooks.on("updateToken", (token, changes = {}) =>
      refreshImperialFormationAutomation([], {
         delay: 0,
         tokenUpdates: [{ token, changes }],
      }),
   )
   Hooks.on("deleteToken", () =>
      refreshImperialFormationAutomation([], { delay: 0 }),
   )
   Hooks.on("canvasReady", () => refreshImperialFormationAutomation())
   Hooks.on("createCombatant", () =>
      refreshImperialFormationAutomation([], { delay: 0 }),
   )
   Hooks.on("updateCombatant", () =>
      refreshImperialFormationAutomation([], { delay: 0 }),
   )
   Hooks.on("deleteCombatant", () =>
      refreshImperialFormationAutomation([], { delay: 0 }),
   )
   Hooks.on("combatStart", () => {
      refreshImperialFormationAutomation([], { delay: 0 })
   })
   Hooks.on("deleteCombat", () => {
      refreshImperialFormationAutomation(Array.from(game.actors ?? []), {
         delay: 0,
         forceInactive: true,
      })
   })
   Hooks.on("updateCombat", (combat, changes = {}) => {
      if ("started" in changes || "active" in changes) {
         refreshImperialFormationAutomation(Array.from(game.actors ?? []), {
            delay: 0,
         })
      }
   })
   Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
      trackCitizensPerseveranceTempHp(actor, changes, options, userId)
   })
   Hooks.on("updateActor", (actor, changes, options, userId) => {
      promptCitizensPerseveranceOnLowHp(actor, changes, options, userId)
      void promptOrcTenacityOnLowHp(actor, changes, options, userId)
      void refreshOrcTenacityFrequency(actor)
      void refreshBloodCallsToBlood(actor)
      refreshImperialFormationAutomation(actor)
   })
   Hooks.on("deleteItem", (item) => {
      refreshImperialFormationAutomation()
      void refreshBloodCallsToBlood(item.actor)
      void clearNezebPathOnFathersPrideExpired(item)
      void handleBounceBackDyingRemoved(item)
      void restoreForMotherlandFatigue(item)
      void restoreIntimidatingEncouragementSuppression(item, { force: true })
      void restoreRetributorsEdgeRune(item, { force: true })
   })
   Hooks.on("updateItem", (item) => {
      refreshImperialFormationAutomation()
      void refreshBloodCallsToBlood(item.actor)
      void clearNezebPathOnFathersPrideUpdate(item)
      void restoreIntimidatingEncouragementSuppression(item)
      void restoreRetributorsEdgeRune(item)
   })
   document.addEventListener("click", (event) => {
      void handleCitizensPerseverancePromptButton(event)
      void handleBounceBackPromptButton(event)
      void handleThatsHowYouRoarPromptButton(event)
   })
}
