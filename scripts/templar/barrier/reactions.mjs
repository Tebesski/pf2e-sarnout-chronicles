import {
   TEMPLAR_ASSETS,
   TEMPLAR_SLUGS,
} from "../constants.mjs"
import {
   actorHasSlug,
   actorLevel,
   readTemplarState,
} from "../state.mjs"
import {
   featureDetected,
   getActor,
   warnBarrierDestroyed,
} from "../actors.mjs"
import { barrierAbilityAvailable } from "./state.mjs"
import {
   applyTemplarReactionUsed,
   canUseTemplarReaction,
} from "../reactions.mjs"
import { releaseHeldForBarrierTrait } from "../holding/release.mjs"
import { emitTemplarLight } from "../light.mjs"
import { playSound } from "../audio.mjs"
import {
   applyInculpationUsed,
   applyLightBurstUsed,
   canUseBurstOrInculpation,
} from "./effects.mjs"
import { lightBurstDetails } from "../scaling.mjs"
import { enemyTokensInEmanation } from "../tokens.mjs"
import {
   postInculpationCard as postTemplarInculpationCard,
   postLightBurstCard as postTemplarLightBurstCard,
} from "../cards/light-burst-cards.mjs"
import { counteract } from "../counteract.mjs"
import { spendFocusPoint } from "../focus.mjs"
import { createLightShellEffect } from "../light-shell.mjs"
import { targetedAdjacentAllyActor } from "../as-safe.mjs"
import { promptNumber } from "../dialogs.mjs"

export async function reactiveBarrier({
   actor,
   damage,
   damageLightBarrier,
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   if (!actorHasSlug(resolved, TEMPLAR_SLUGS.dedication)) {
      ui.notifications?.warn(
         "Templar Dedication was not detected on this actor.",
      )
      return null
   }
   if (!canUseTemplarReaction(resolved)) return null
   if (!barrierAbilityAvailable(readTemplarState(resolved))) {
      warnBarrierDestroyed()
      return null
   }
   if (typeof damageLightBarrier !== "function") return null
   await releaseHeldForBarrierTrait(resolved, "Reactive Barrier")
   await emitTemplarLight(resolved)
   const result = await damageLightBarrier({
      actor: resolved,
      damage,
      applyHardness: true,
      label: "Reactive Barrier",
   })
   if (result) await applyTemplarReactionUsed(resolved)
   return result
}

export async function lightBurst({
   actor,
   damage,
   damageLightBarrier,
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   if (!actorHasSlug(resolved, TEMPLAR_SLUGS.lightBurst)) {
      ui.notifications?.warn("Light Burst was not detected on this actor.")
      return null
   }
   if (!barrierAbilityAvailable(readTemplarState(resolved))) {
      warnBarrierDestroyed()
      return null
   }
   if (!canUseTemplarReaction(resolved)) return null
   if (!canUseBurstOrInculpation(resolved, "Light Burst")) return null
   if (typeof damageLightBarrier !== "function") return null
   await playSound(TEMPLAR_ASSETS.lightBurstSound)
   await releaseHeldForBarrierTrait(resolved, "Light Burst")
   await emitTemplarLight(resolved)
   const result = await damageLightBarrier({
      actor: resolved,
      damage,
      applyHardness: true,
      label: "Light Burst",
      postMessage: false,
   })
   if (result?.actor) {
      const details = lightBurstDetails(result.actor)
      const targets = enemyTokensInEmanation(result.actor, details.radius)
      await postTemplarLightBurstCard({
         actor: result.actor,
         targets,
         barrierShattered: Boolean(result.destroyed),
      })
      await applyLightBurstUsed(result.actor)
      await applyTemplarReactionUsed(result.actor)
      const counteractDc = Math.max(1, Math.floor(actorLevel(result.actor) / 2))
      await counteract({
         actor: result.actor,
         title: "Light Burst Counteract",
         postRoll: true,
         postSummary: true,
         defaultDc: counteractDc,
         defaultTargetLevel: counteractDc,
         defaultCounteractLevel: details.counteractRank,
         fixedCounteractLevel: details.counteractRank,
      })
   }
   return result
}

export async function lightShell({
   actor,
   targetActor = null,
   spendFocus = false,
   fromSpellMessage = false,
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   if (
      !featureDetected(resolved, TEMPLAR_SLUGS.lightShell, fromSpellMessage) &&
      !featureDetected(resolved, TEMPLAR_SLUGS.lightProtects, fromSpellMessage)
   ) {
      ui.notifications?.warn("Light Shell was not detected on this actor.")
      return null
   }
   const state = readTemplarState(resolved)
   if (!barrierAbilityAvailable(state)) {
      warnBarrierDestroyed()
      return null
   }
   if (!canUseTemplarReaction(resolved)) return null
   if (spendFocus && !(await spendFocusPoint(resolved))) return null
   await playSound(TEMPLAR_ASSETS.lightShellSound)
   await releaseHeldForBarrierTrait(resolved, "Light Shell")
   await emitTemplarLight(resolved)
   const protectedActor =
      targetActor ?? targetedAdjacentAllyActor(resolved) ?? resolved
   const effect = await createLightShellEffect(protectedActor, {
      sourceActor: resolved,
   })
   if (effect) await applyTemplarReactionUsed(resolved)
   return effect
}

export async function inculpation({
   actor,
   damage,
   targetToken = null,
   spendFocus = false,
   fromSpellMessage = false,
   damageLightBarrier,
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   if (
      !featureDetected(resolved, TEMPLAR_SLUGS.inculpation, fromSpellMessage)
   ) {
      ui.notifications?.warn("Inculpation was not detected on this actor.")
      return null
   }
   if (!barrierAbilityAvailable(readTemplarState(resolved))) {
      warnBarrierDestroyed()
      return null
   }
   if (!canUseTemplarReaction(resolved)) return null
   if (!canUseBurstOrInculpation(resolved, "Inculpation")) return null
   if (typeof damageLightBarrier !== "function") return null
   const incoming =
      damage === undefined || damage === null
         ? await promptNumber({
              title: "Inculpation",
              label: "Incoming damage",
              value: 0,
              min: 0,
           })
         : Number(damage)
   if (incoming === null || !Number.isFinite(incoming)) return null
   if (spendFocus && !(await spendFocusPoint(resolved))) return null
   await playSound(TEMPLAR_ASSETS.inculpationSound)
   await releaseHeldForBarrierTrait(resolved, "Inculpation")
   await emitTemplarLight(resolved)
   const result = await damageLightBarrier({
      actor: resolved,
      damage: incoming,
      applyHardness: true,
      label: "Inculpation",
      postMessage: false,
   })
   const details = lightBurstDetails(resolved)
   await postTemplarInculpationCard({
      actor: resolved,
      target: targetToken,
   })
   await applyInculpationUsed(resolved)
   await applyTemplarReactionUsed(resolved)
   const counteractDc = Math.max(1, Math.floor(actorLevel(resolved) / 2))
   await counteract({
      actor: resolved,
      title: "Inculpation Counteract",
      postRoll: true,
      postSummary: true,
      defaultDc: counteractDc,
      defaultTargetLevel: counteractDc,
      defaultCounteractLevel: details.counteractRank,
      fixedCounteractLevel: details.counteractRank,
   })
   return result
}
