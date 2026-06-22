import {
   TEMPLAR_ASSETS,
   TEMPLAR_SLUGS,
} from "./constants.mjs"
import {
   actorHasSlug,
   readTemplarState,
} from "./state.mjs"
import {
   featureDetected,
   getActor,
   warnBarrierDestroyed,
} from "./actors.mjs"
import { barrierAbilityAvailable } from "./barrier/state.mjs"
import {
   applyTemplarReactionUsed,
   canUseTemplarReaction,
} from "./reactions.mjs"
import { scutumFideiRank } from "./scaling.mjs"
import {
   postCounteractOutcomeMessage,
   promptCounteractOptions,
   rollCounteract,
} from "./counteract.mjs"
import { spendFocusPoint } from "./focus.mjs"
import { playSound } from "./audio.mjs"
import { emitTemplarLight } from "./light.mjs"
import { postTemplarMessage } from "./messages.mjs"

export async function scutumFidei({
   actor,
   spendFocus = true,
   fromSpellMessage = false,
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
   if (
      !featureDetected(resolved, TEMPLAR_SLUGS.scutumFidei, fromSpellMessage)
   ) {
      ui.notifications?.warn("Scutum Fidei was not detected on this actor.")
      return null
   }
   const state = readTemplarState(resolved)
   if (!barrierAbilityAvailable(state)) {
      warnBarrierDestroyed()
      return null
   }
   if (!canUseTemplarReaction(resolved)) return null
   if (typeof damageLightBarrier !== "function") return null

   const rank = scutumFideiRank(resolved)
   const options = await promptCounteractOptions(resolved, {
      title: "Scutum Fidei Counteract",
      defaultCounteractLevel: rank,
      defaultTargetLevel: rank,
   })
   if (!options) return null

   if (spendFocus && !(await spendFocusPoint(resolved))) return null
   await playSound(TEMPLAR_ASSETS.scutumFideiSound)
   await emitTemplarLight(resolved)
   const barrierResult = await damageLightBarrier({
      actor: resolved,
      damage: options.dc,
      applyHardness: true,
      label: "Scutum Fidei",
   })
   if (!barrierResult) return null
   await applyTemplarReactionUsed(resolved)

   const counteractResult = await rollCounteract(
      resolved,
      {
         ...options,
         counteractLevel: rank,
      },
      { postRoll: true },
   )
   if (counteractResult) await postCounteractOutcomeMessage(counteractResult)

   await postTemplarMessage(
      resolved,
      "Scutum Fidei",
      [
         `${barrierResult.targetName} took incoming damage ${barrierResult.incoming}. Barrier damage ${barrierResult.barrierDamage}. Hardness absorbed ${barrierResult.prevented}.`,
         counteractResult
            ? counteractResult.success
               ? "The triggering spell is counteracted and reflected back at its caster. The reflected spell affects only the original caster."
               : "The triggering spell is not counteracted."
            : "Counteract roll was not completed.",
      ].join("<hr>"),
   )
   return { barrier: barrierResult, counteract: counteractResult }
}
