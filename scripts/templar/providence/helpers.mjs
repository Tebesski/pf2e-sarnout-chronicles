import { TEMPLAR_SLUGS } from "../constants.mjs"
import {
   actorLevel,
   readTemplarState,
   spellRankForActor,
} from "../state.mjs"
import { barrierAbilityAvailable } from "../barrier/state.mjs"
import { featureDetected, getActor } from "../actors.mjs"
import { hasFocusPoint } from "../focus.mjs"
import { canUseTemplarReaction } from "../reactions.mjs"
import { promptNumber } from "../dialogs.mjs"

function firstPositiveNumber(values) {
   return values
      .map((value) => Number(value))
      .find((value) => Number.isFinite(value) && value > 0)
}

function documentActor(document) {
   return document?.actor ?? document?.parent?.actor ?? document?.parent ?? null
}

async function resolveUuid(uuid) {
   if (!uuid) return null
   const sync = globalThis.fromUuidSync?.(uuid)
   if (sync) return sync
   if (typeof fromUuid !== "function") return null
   return fromUuid(uuid).catch(() => null)
}

async function providenceOriginActor(message) {
   const context = message?.flags?.pf2e?.context ?? {}
   const origin = context.origin ?? {}
   const uuids = [
      origin.actor,
      origin.actorUuid,
      origin.token,
      origin.tokenUuid,
      origin.uuid,
      message?.flags?.pf2e?.origin?.actor,
      message?.flags?.pf2e?.origin?.actorUuid,
      message?.flags?.pf2e?.origin?.token,
      message?.flags?.pf2e?.origin?.uuid,
      message?.item?.actor?.uuid,
   ]

   for (const uuid of uuids) {
      const document = await resolveUuid(uuid)
      const actor = documentActor(document)
      if (actor?.system) return actor
   }
   return documentActor(message?.item) ?? null
}

export async function providenceDamageInfo(message, actor) {
   const candidates = [
      message?.item?.system?.level?.value,
      message?.item?.system?.rank?.value,
      message?.item?.system?.level,
      message?.item?.system?.rank,
      message?.item?.level,
      message?.flags?.pf2e?.context?.origin?.level,
      message?.flags?.pf2e?.context?.origin?.spellRank,
      message?.flags?.pf2e?.context?.origin?.rank,
      message?.flags?.pf2e?.context?.item?.level,
      message?.flags?.pf2e?.context?.item?.rank,
   ]
   const effectLevel = firstPositiveNumber(candidates)
   const originActor = await providenceOriginActor(message)
   const creatureLevel = originActor ? actorLevel(originActor) : null

   const defaultLevel = effectLevel
      ? Math.trunc(effectLevel)
      : creatureLevel
        ? Math.trunc(creatureLevel)
        : spellRankForActor(actor)

   const enteredLevel = await promptNumber({
      title: "Providence",
      label: "Triggering effect level or creature level",
      value: defaultLevel,
      min: 1,
   })

   if (enteredLevel === null || !Number.isFinite(enteredLevel)) return null
   const level = Math.trunc(enteredLevel)

   return {
      damage: Math.max(2, level * 2),
      level,
      source: "Entered level",
   }
}

export function providenceBonus(actor) {
   const skills = actor?.system?.skills ?? {}
   const rank = Number(skills.rel?.rank ?? skills.religion?.rank ?? 0)
   if (rank >= 4) return 2
   if (rank >= 3) return 1
   return 0
}

function applyProvidenceBonusOnce(bonus) {
   if (bonus <= 0) return
   Hooks.once("pf2e.preReroll", (...args) => {
      const params = args.find(
         (a) =>
            a &&
            typeof a === "object" &&
            !Array.isArray(a) &&
            !(a instanceof Roll) &&
            !a.documentName,
      )
      if (params) {
         if (!Array.isArray(params.modifiers)) {
            params.modifiers = []
         }
         const Modifier = game.pf2e?.Modifier
         if (Modifier) {
            params.modifiers.push(
               new Modifier({
                  slug: "providence",
                  label: "Providence",
                  modifier: bonus,
                  type: "circumstance",
               }),
            )
         }
      }
   })
}

export function prepareProvidenceReroll({
   actor,
   spendFocus = true,
   fromSpellMessage = false,
   applyBonus = true,
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return false
   if (!featureDetected(resolved, TEMPLAR_SLUGS.providence, fromSpellMessage)) {
      ui.notifications?.warn("Providence was not detected on this actor.")
      return false
   }
   const state = readTemplarState(resolved)
   if (!barrierAbilityAvailable(state)) {
      ui.notifications?.warn("Your Light Barrier is Shattered.")
      return false
   }
   if (!canUseTemplarReaction(resolved)) return false
   if (spendFocus && !hasFocusPoint(resolved)) return false
   if (applyBonus) applyProvidenceBonusOnce(providenceBonus(resolved))
   return true
}
