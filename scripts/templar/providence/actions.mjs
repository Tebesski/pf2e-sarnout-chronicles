import {
   barrierAbilityAvailable,
   effectiveBarrier,
} from "../barrier/state.mjs"
import { getActor } from "../actors.mjs"
import { readTemplarState } from "../state.mjs"
import {
   prepareProvidenceReroll,
   providenceBonus,
   providenceDamageInfo,
} from "./helpers.mjs"
import {
   dialogContent,
   TemplarChoiceDialog,
} from "../dialogs.mjs"
import {
   fact,
   textParagraph,
} from "../templates.mjs"
import { spendFocusPoint } from "../focus.mjs"
import { emitTemplarLight } from "../light.mjs"
import {
   applyTemplarReactionUsed,
   canUseTemplarReaction,
} from "../reactions.mjs"
import { postTemplarMessage } from "../messages.mjs"

export async function completeProvidenceReroll({
   actor,
   message,
   spendFocus = true,
   applyReaction = true,
   damageLightBarrier,
} = {}) {
   const resolved = getActor(actor ?? message?.actor ?? message?.speakerActor)
   if (!resolved) return null
   const state = readTemplarState(resolved)
   if (!barrierAbilityAvailable(state)) {
      ui.notifications?.warn("Your Light Barrier is Shattered.")
      return null
   }
   if (applyReaction && !canUseTemplarReaction(resolved)) return null
   if (typeof damageLightBarrier !== "function") return null
   const barrier = effectiveBarrier(state)
   const damageInfo = await providenceDamageInfo(message, resolved)
   if (!damageInfo) return null
   const { damage } = damageInfo
   const bonus = providenceBonus(resolved)
   const after = Math.max(0, (barrier?.value ?? state.light.value) - damage)
   const choice = await TemplarChoiceDialog.prompt({
      title: "Providence",
      content: await dialogContent({
         paragraphs: [
            textParagraph(
               "The reroll is complete. Apply Providence's backlash to your active barrier without Hardness.",
            ),
         ],
         facts: [
            fact("Active Barrier", barrier?.name ?? "Light Barrier"),
            fact("Trigger Level", `${damageInfo.level} (${damageInfo.source})`),
            fact("Barrier Damage", damage),
            fact(
               "Barrier After",
               `${after} / ${barrier?.max ?? state.light.max}`,
            ),
            fact("Reroll Bonus", bonus ? `+${bonus} circumstance` : "None"),
         ],
      }),
      buttons: [
         {
            id: "confirm",
            label: "Damage Barrier",
            icon: "fa-solid fa-shield-halved",
         },
         { id: "cancel", label: "Cancel" },
      ],
   })
   if (choice !== "confirm") return null

   if (spendFocus && !(await spendFocusPoint(resolved))) return null
   await emitTemplarLight(resolved)
   await damageLightBarrier({
      actor: resolved,
      damage,
      applyHardness: false,
      label: "Providence",
   })
   if (applyReaction) await applyTemplarReactionUsed(resolved)
   return true
}

export async function providence({
   actor,
   message,
   spendFocus = true,
   fromSpellMessage = false,
   damageLightBarrier,
} = {}) {
   const resolved = getActor(actor ?? message?.actor ?? message?.speakerActor)
   if (!resolved) return null
   const canRerollMessage = Boolean(
      message && game.pf2e?.Check?.rerollFromMessage,
   )

   if (
      !prepareProvidenceReroll({
         actor: resolved,
         spendFocus,
         fromSpellMessage,
         applyBonus: canRerollMessage,
      })
   ) {
      return null
   }

   if (spendFocus && !(await spendFocusPoint(resolved))) return null

   if (canRerollMessage) {
      try {
         const tokenDoc =
            resolved.getActiveTokens(true, true)[0] ??
            resolved.getActiveTokens(false, true)[0]
         if (tokenDoc?.object?.control)
            tokenDoc.object.control({ releaseOthers: true })

         await game.pf2e.Check.rerollFromMessage(message, {
            heroPoint: false,
            keep: "new",
         })
      } catch (_error) {
         ui.notifications?.error(
            "Providence could not reroll this saving throw.",
         )
         return null
      }
   } else {
      const bonus = providenceBonus(resolved)
      await postTemplarMessage(
         resolved,
         "Providence",
         `Reroll the triggering saving throw${bonus ? ` with a +${bonus} circumstance bonus` : ""}.`,
      )
   }
   return completeProvidenceReroll({
      actor: resolved,
      message,
      spendFocus: false,
      damageLightBarrier,
   })
}

export async function divineIntervention(options = {}) {
   return providence(options)
}
