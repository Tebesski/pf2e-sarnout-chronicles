import {
   damageContextFromRoll,
   damageFromContext,
   mergeDamageContexts,
   reduceDamageContext,
   reduceDamageContextByAmount,
   regularizedCriticalDamageContext,
   splitDamageContextForBarrier,
} from "./damage.mjs"
export {
   damageContextFromRoll,
   damageFromContext,
   mergeDamageContexts,
   reduceDamageContext,
   reduceDamageContextByAmount,
   regularizedCriticalDamageContext,
   splitDamageContextForBarrier,
} from "./damage.mjs"
import { counteract } from "./counteract.mjs"
export { counteract } from "./counteract.mjs"
import { spendFocusPoint } from "./focus.mjs"
export { spendFocusPoint } from "./focus.mjs"
import {
   brilliantShard,
   confirmBrilliantShardItemDelete,
   confirmBrilliantShardItemUpdate,
   setBrilliantShard,
   toggleBrilliantShard,
} from "./brilliant-shard/actions.mjs"
export {
   brilliantShard,
   confirmBrilliantShardItemDelete,
   confirmBrilliantShardItemUpdate,
   setBrilliantShard,
   toggleBrilliantShard,
} from "./brilliant-shard/actions.mjs"
import { cleanupLegacyGeneratedTemplarActions } from "./effects.mjs"
export { cleanupLegacyGeneratedTemplarActions } from "./effects.mjs"
import {
   canUseTemplarReaction,
   hasTemplarReactionUsed,
} from "./reactions.mjs"
export {
   canUseTemplarReaction,
   hasTemplarReactionUsed,
} from "./reactions.mjs"
import { emitTemplarLight } from "./light.mjs"
export { emitTemplarLight } from "./light.mjs"
import {
   prepareProvidenceReroll,
   providenceBonus,
} from "./providence/helpers.mjs"
export {
   prepareProvidenceReroll,
   providenceBonus,
} from "./providence/helpers.mjs"
import {
   completeProvidenceReroll as completeProvidenceRerollBase,
   divineIntervention as divineInterventionBase,
   providence as providenceBase,
} from "./providence/actions.mjs"
import {
   blindingBlade,
   lightGaol,
   postBlindingBladeUseCard,
} from "./light-gaol/actions.mjs"
import {
   releaseHolding,
   releaseLargestHolding,
} from "./holding/release.mjs"
import {
   editHeldDamage,
   openHoldingBarrierDialog,
   openHoldingTurnDecisionDialog,
   openPrevailDialog,
   promptHoldingBarrierSustainTurn,
   releaseUnsustainedHoldingBarriers,
   setHoldingTurnDecision,
   sustainHolding,
} from "./holding/actions.mjs"
export {
   editHeldDamage,
   openHoldingBarrierDialog,
   openHoldingTurnDecisionDialog,
   openPrevailDialog,
   promptHoldingBarrierSustainTurn,
   releaseUnsustainedHoldingBarriers,
   setHoldingTurnDecision,
   sustainHolding,
} from "./holding/actions.mjs"
import { holdDamage as holdDamageBase } from "./holding/hold-damage.mjs"
import {
   rollBlindingBladeSaveFromCard,
   rollLightBurstSaveFromCard,
   rollLightGaolSaveFromCard,
} from "./card-save-rolls.mjs"
export {
   rollBlindingBladeSaveFromCard,
   rollLightBurstSaveFromCard,
   rollLightGaolSaveFromCard,
} from "./card-save-rolls.mjs"
import {
   handleScorchingReprisalDamage,
   handleScorchingReprisalStrike,
   scorchingReprisal,
} from "./scorching-reprisal.mjs"
export {
   handleScorchingReprisalDamage,
   handleScorchingReprisalStrike,
   scorchingReprisal,
} from "./scorching-reprisal.mjs"
import {
   advent,
   refreshAdventResistance,
   setAdvent,
   setRallying,
   toggleAdvent,
   toggleRallying,
} from "./advent.mjs"
import {
   lightDamping as lightDampingBase,
   refraction as refractionBase,
} from "./refraction.mjs"
export { hasRefractionAvailable } from "./refraction.mjs"
import { flagellation } from "./flagellation.mjs"
export { flagellation } from "./flagellation.mjs"
import { scutumFidei as scutumFideiBase } from "./scutum-fidei.mjs"
import { prevail } from "./prevail.mjs"
export { prevail } from "./prevail.mjs"
import { heatLightning } from "./heat-lightning.mjs"
export { heatLightning } from "./heat-lightning.mjs"
import { syncLinkedTemplarEffect } from "./linked-effect-sync.mjs"
export { syncLinkedTemplarEffect } from "./linked-effect-sync.mjs"
import {
   inculpation as inculpationBase,
   lightBurst as lightBurstBase,
   lightShell,
   reactiveBarrier as reactiveBarrierBase,
} from "./barrier/reactions.mjs"
export { lightShell } from "./barrier/reactions.mjs"
import {
   chooseAsSafeAsChurchReaction,
   chooseBarrierReaction,
} from "./barrier/choices.mjs"
import {
   breakLightBarrier,
   clearExpiredLingering,
   damageLightBarrier,
   ensureTemplarState,
   finalizeBrokenBrilliantShard,
   markBarrierDestroyed,
   resetTemplarState,
} from "./barrier/light.mjs"
export {
   breakLightBarrier,
   clearExpiredLingering,
   damageLightBarrier,
   ensureTemplarState,
   resetTemplarState,
} from "./barrier/light.mjs"
import {
   repentance,
   repairLightBarrier,
   restoreLightBarrier,
   restoreLightBarrierForNight,
   setLightBarrierHp,
} from "./barrier/repair.mjs"
export {
   repentance,
   repairLightBarrier,
   restoreLightBarrier,
   restoreLightBarrierForNight,
   setLightBarrierHp,
} from "./barrier/repair.mjs"
import {
   checkLastRedoubtBadge,
   executeLastRedoubtEnhancement,
   lastStronghold,
} from "./last-redoubt.mjs"
export {
   checkLastRedoubtBadge,
   executeLastRedoubtEnhancement,
   lastStronghold,
} from "./last-redoubt.mjs"
export {
   chooseAsSafeAsChurchReaction,
   chooseBarrierReaction,
} from "./barrier/choices.mjs"

export async function reactiveBarrier(options = {}) {
   return reactiveBarrierBase({
      ...options,
      damageLightBarrier,
   })
}

export async function lightBurst(options = {}) {
   return lightBurstBase({
      ...options,
      damageLightBarrier,
   })
}

export async function inculpation(options = {}) {
   return inculpationBase({
      ...options,
      damageLightBarrier,
   })
}

export async function holdDamage(options = {}) {
   return holdDamageBase({
      ...options,
      markBarrierDestroyed,
      finalizeBrokenBrilliantShard,
   })
}

export async function completeProvidenceReroll(options = {}) {
   return completeProvidenceRerollBase({
      ...options,
      damageLightBarrier,
   })
}

export async function providence(options = {}) {
   return providenceBase({
      ...options,
      damageLightBarrier,
   })
}

export async function divineIntervention(options = {}) {
   return divineInterventionBase({
      ...options,
      damageLightBarrier,
   })
}

export async function scutumFidei(options = {}) {
   return scutumFideiBase({
      ...options,
      damageLightBarrier,
   })
}

export async function refraction(options = {}) {
   return refractionBase({
      ...options,
      completeProvidenceReroll,
   })
}

export async function lightDamping(options = {}) {
   return lightDampingBase({
      ...options,
      completeProvidenceReroll,
   })
}

export const templarActions = {
   ensureTemplarState,
   resetTemplarState,
   setLightBarrierHp,
   restoreLightBarrier,
   restoreLightBarrierForNight,
   repairLightBarrier,
   repentance,
   damageLightBarrier,
   breakLightBarrier,
   clearExpiredLingering,
   reactiveBarrier,
   lightBurst,
   lightShell,
   inculpation,
   scorchingReprisal,
   handleScorchingReprisalStrike,
   handleScorchingReprisalDamage,
   holdDamage,
   chooseBarrierReaction,
   chooseAsSafeAsChurchReaction,
   hasTemplarReactionUsed,
   damageContextFromRoll,
   splitDamageContextForBarrier,
   reduceDamageContextByAmount,
   mergeDamageContexts,
   damageFromContext,
   reduceDamageContext,
   openHoldingBarrierDialog,
   promptHoldingBarrierSustainTurn,
   releaseUnsustainedHoldingBarriers,
   setHoldingTurnDecision,
   openHoldingTurnDecisionDialog,
   openPrevailDialog,
   sustainHolding,
   editHeldDamage,
   releaseHolding,
   releaseLargestHolding,
   setBrilliantShard,
   toggleBrilliantShard,
   brilliantShard,
   confirmBrilliantShardItemDelete,
   confirmBrilliantShardItemUpdate,
   setAdvent,
   toggleAdvent,
   advent,
   refreshAdventResistance,
   setRallying,
   toggleRallying,
   syncLinkedTemplarEffect,
   cleanupLegacyGeneratedTemplarActions,
   heatLightning,
   lastStronghold,
   checkLastRedoubtBadge,
   executeLastRedoubtEnhancement,
   providence,
   prepareProvidenceReroll,
   completeProvidenceReroll,
   providenceBonus,
   divineIntervention,
   flagellation,
   scutumFidei,
   refraction,
   lightDamping,
   emitTemplarLight,
   counteract,
   rollLightBurstSaveFromCard,
   regularizedCriticalDamageContext,
   prevail,
   spendFocusPoint,
   lightGaol,
   blindingBlade,
   postBlindingBladeUseCard,
   rollLightGaolSaveFromCard,
   rollBlindingBladeSaveFromCard,
}
