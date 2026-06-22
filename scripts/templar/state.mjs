import {
   MODULE_ID,
   TEMPLAR_FEAT_SLUG_GROUPS,
   TEMPLAR_FLAG,
   TEMPLAR_SLUGS,
} from "./constants.mjs"

export function slugify(value) {
   return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
}

function itemSlug(item) {
   return slugify(item?.slug ?? item?.system?.slug ?? item?.name)
}

export function actorHasSlug(actor, slugs) {
   const wanted = new Set(slugs.map(slugify))
   return (
      actor?.items?.some((item) => {
         const slug = itemSlug(item)
         if (wanted.has(slug)) return true
         const cleanName = slugify(
            String(item.name ?? "").replace(/^Effect:\s*/i, ""),
         )
         return wanted.has(cleanName)
      }) ?? false
   )
}

function itemMatchesSlugs(item, slugs) {
   const wanted = new Set(slugs.map(slugify))
   const slug = itemSlug(item)
   if (wanted.has(slug)) return true
   const cleanName = slugify(
      String(item?.name ?? "").replace(/^Effect:\s*/i, ""),
   )
   return wanted.has(cleanName)
}

export function templarFeatCount(actor) {
   return TEMPLAR_FEAT_SLUG_GROUPS.reduce((count, slugs) => {
      const found = actor?.items?.some?.((item) => {
         if (item.type !== "feat") return false
         return itemMatchesSlugs(item, slugs)
      })
      return count + (found ? 1 : 0)
   }, 0)
}

export function currentCombatRound() {
   return Number(game.combat?.round ?? 0)
}

export function currentCombatTurn() {
   return Number(game.combat?.turn ?? 0)
}

export function actorLevel(actor) {
   const level = Number(
      actor?.system?.details?.level?.value ?? actor?.level ?? 1,
   )
   return Number.isFinite(level) ? Math.max(1, level) : 1
}

export function religionRank(actor) {
   const skills = actor?.system?.skills ?? {}
   const religion = skills.rel ?? skills.religion ?? {}
   const rank = Number(religion.rank ?? religion.proficiency?.rank ?? 1)
   return Number.isFinite(rank) ? Math.max(0, Math.min(4, rank)) : 1
}

export function proficiencyBonusFromRank(rank) {
   return Math.max(0, Math.min(4, Number(rank) || 0)) * 2
}

export function religionProficiencyBonus(actor) {
   return proficiencyBonusFromRank(religionRank(actor))
}

export function spellRankForActor(actor) {
   return Math.max(1, Math.ceil(actorLevel(actor) / 2))
}

export function calculateLightBarrier(actor) {
   const feats = templarFeatCount(actor)
   const hasImpervious = actorHasSlug(actor, TEMPLAR_SLUGS.imperviousBarrier)
   const max = Math.min(120, Math.max(0, feats * 10 + (hasImpervious ? 20 : 0)))
   const hardness = Math.min(
      16,
      Math.max(0, feats + 4 + (hasImpervious ? 3 : 0)),
   )

   return {
      max,
      hardness,
      feats,
      hasImpervious,
   }
}

export function calculateBrilliantShard(actor) {
   const rank = Math.max(3, spellRankForActor(actor))
   const light = calculateLightBarrier(actor)
   return {
      max: light.max,
      hardness: 5 + Math.max(0, rank - 3),
      rank,
   }
}

function emptySlot(index) {
   return {
      id: foundry.utils.randomID(),
      index,
      active: false,
      releasing: false,
      released: false,
      restoring: false,
      damage: 0,
      damageType: "untyped",
      damageTypes: ["untyped"],
      rollData: null,
      bypassIWR: true,
      lastReleasedDamage: 0,
      roundsSustained: 0,
      createdRound: currentCombatRound(),
      createdTurn: currentCombatTurn(),
      lastSustainedRound: null,
      lastSustainedTurn: null,
      promptedRound: null,
      promptedTurn: null,
      turnDecision: null,
      decisionRound: null,
      decisionTurn: null,
      label: "",
   }
}

function normalizeSlot(slot, index) {
   const normalized = {
      ...emptySlot(index),
      ...(slot ?? {}),
      index,
   }
   normalized.damage = Math.max(0, Number(normalized.damage) || 0)
   normalized.damageType =
      slugify(normalized.damageType || "untyped") || "untyped"
   normalized.damageTypes = Array.isArray(normalized.damageTypes)
      ? normalized.damageTypes.map(slugify).filter(Boolean)
      : [normalized.damageType]
   if (normalized.damageTypes.length === 0) normalized.damageTypes = ["untyped"]
   normalized.rollData =
      normalized.rollData && typeof normalized.rollData === "object"
         ? normalized.rollData
         : null
   normalized.bypassIWR = normalized.bypassIWR !== false
   normalized.lastReleasedDamage = Math.max(
      0,
      Number(normalized.lastReleasedDamage) || 0,
   )
   normalized.roundsSustained = Math.max(
      0,
      Number(normalized.roundsSustained) || 0,
   )
   normalized.createdRound = Number(normalized.createdRound) || 0
   normalized.createdTurn =
      normalized.createdTurn === null || normalized.createdTurn === undefined
         ? null
         : Number(normalized.createdTurn) || 0
   normalized.lastSustainedRound =
      normalized.lastSustainedRound === null ||
      normalized.lastSustainedRound === undefined
         ? null
         : Number(normalized.lastSustainedRound) || 0
   normalized.lastSustainedTurn =
      normalized.lastSustainedTurn === null ||
      normalized.lastSustainedTurn === undefined
         ? null
         : Number(normalized.lastSustainedTurn) || 0
   normalized.promptedRound =
      normalized.promptedRound === null ||
      normalized.promptedRound === undefined
         ? null
         : Number(normalized.promptedRound) || 0
   normalized.promptedTurn =
      normalized.promptedTurn === null || normalized.promptedTurn === undefined
         ? null
         : Number(normalized.promptedTurn) || 0
   normalized.turnDecision = ["sustain", "release"].includes(
      normalized.turnDecision,
   )
      ? normalized.turnDecision
      : null
   normalized.decisionRound =
      normalized.decisionRound === null ||
      normalized.decisionRound === undefined
         ? null
         : Number(normalized.decisionRound) || 0
   normalized.decisionTurn =
      normalized.decisionTurn === null || normalized.decisionTurn === undefined
         ? null
         : Number(normalized.decisionTurn) || 0
   normalized.label = String(normalized.label ?? "")
   normalized.active = Boolean(normalized.active)
   normalized.releasing = Boolean(normalized.releasing)
   normalized.released = Boolean(normalized.released)
   normalized.restoring = Boolean(normalized.restoring)
   return normalized
}

export function defaultTemplarState(actor) {
   const barrier = calculateLightBarrier(actor)
   return {
      version: 1,
      light: {
         value: barrier.max,
         max: barrier.max,
         hardness: barrier.hardness,
         broken: false,
         breaking: false,
         restoring: false,
         lingering: false,
         shatteredRound: null,
         shatteredTurn: null,
      },
      holding: [],
      rallying: {
         active: false,
         transitioning: false,
      },
      advent: {
         active: false,
         transitioning: false,
      },
      brilliantShard: {
         active: false,
         value: 0,
         max: 0,
         baseHardness: 0,
         hardness: 0,
         broken: false,
      },
      damagedSinceLastTurn: {
         round: null,
         turn: null,
         timestamp: null,
         previousHp: 0,
      },
      cooldowns: {},
      updatedAt: Date.now(),
   }
}

export function readTemplarState(actor) {
   const raw = foundry.utils.deepClone(
      actor?.getFlag?.(MODULE_ID, TEMPLAR_FLAG),
   )
   return normalizeTemplarState(actor, raw)
}

export function normalizeTemplarState(actor, raw = {}) {
   const base = defaultTemplarState(actor)
   const barrier = calculateLightBarrier(actor)
   const state = {
      ...base,
      ...(raw ?? {}),
      light: {
         ...base.light,
         ...((raw ?? {}).light ?? {}),
      },
      rallying: {
         ...base.rallying,
         ...((raw ?? {}).advent ?? {}),
         ...((raw ?? {}).rallying ?? {}),
      },
      advent: {
         ...base.advent,
         ...((raw ?? {}).rallying ?? {}),
         ...((raw ?? {}).advent ?? {}),
      },
      brilliantShard: {
         ...base.brilliantShard,
         ...((raw ?? {}).brilliantShard ?? {}),
      },
      damagedSinceLastTurn: {
         ...base.damagedSinceLastTurn,
         ...((raw ?? {}).damagedSinceLastTurn ?? {}),
      },
      cooldowns: {
         ...base.cooldowns,
         ...((raw ?? {}).cooldowns ?? {}),
      },
   }

   state.version = 1
   state.cooldowns = Object.fromEntries(
      Object.entries(state.cooldowns ?? {}).map(([key, value]) => [
         key,
         Math.max(0, Number(value) || 0),
      ]),
   )
   state.rallying = {
      ...state.rallying,
      ...state.advent,
   }
   state.advent = state.rallying
   const priorMax = Number(raw?.light?.max ?? 0)
   const priorValue = Number(raw?.light?.value ?? 0)
   state.light.max = barrier.max
   state.light.baseHardness = barrier.hardness
   state.light.hardness = state.advent.active
      ? Math.max(0, Math.floor(barrier.hardness / 2))
      : barrier.hardness
   state.light.value = Math.max(
      0,
      Math.min(barrier.max, Number(state.light.value) || 0),
   )
   if (priorMax > 0 && priorValue >= priorMax && barrier.max > priorMax) {
      state.light.value = barrier.max
   }
   if (state.light.breaking) {
      state.light.broken = Boolean(state.light.broken)
   } else {
      state.light.broken = state.light.value <= 0 || Boolean(state.light.broken)
   }
   if (state.light.value > 0 && !state.light.breaking) {
      state.light.broken = false
      state.light.lingering = false
   }
   state.light.lingering = Boolean(state.light.lingering && state.light.broken)
   state.light.shatteredRound =
      state.light.shatteredRound === null ||
      state.light.shatteredRound === undefined
         ? null
         : Number(state.light.shatteredRound) || 0
   state.light.shatteredTurn =
      state.light.shatteredTurn === null ||
      state.light.shatteredTurn === undefined
         ? null
         : Number(state.light.shatteredTurn) || 0

   const shard = calculateBrilliantShard(actor)
   const rawShard = (raw ?? {}).brilliantShard ?? {}
   const priorShardMax = Number(rawShard.max ?? 0)
   const priorShardValue = Number(rawShard.value ?? 0)
   state.brilliantShard.active = Boolean(state.brilliantShard.active)
   state.brilliantShard.max = state.brilliantShard.active ? shard.max : 0
   state.brilliantShard.baseHardness = state.brilliantShard.active
      ? shard.hardness
      : 0
   state.brilliantShard.hardness = state.brilliantShard.active
      ? state.advent.active
         ? Math.max(0, Math.floor(shard.hardness / 2))
         : shard.hardness
      : 0
   state.brilliantShard.value = state.brilliantShard.active
      ? Math.max(
           0,
           Math.min(shard.max, Number(state.brilliantShard.value) || shard.max),
        )
      : 0
   if (
      state.brilliantShard.active &&
      priorShardMax > 0 &&
      priorShardValue >= priorShardMax &&
      shard.max > priorShardMax
   ) {
      state.brilliantShard.value = shard.max
   }
   const shardBroken =
      state.brilliantShard.active &&
      state.brilliantShard.value <= Math.floor(state.brilliantShard.max / 2)
   state.brilliantShard.broken = shardBroken
   if (shardBroken) state.brilliantShard.active = false

   const slots = Array.isArray(raw?.holding) ? raw.holding : []
   const capacity = holdingCapacity(actor, {
      ...state,
      holding: slots.map(normalizeSlot),
   })
   state.holding = Array.from({ length: capacity }, (_entry, index) =>
      normalizeSlot(slots[index], index),
   )
   state.updatedAt = Number(state.updatedAt) || Date.now()
   return state
}

export function holdingCapacity(actor, state = readTemplarState(actor)) {
   let capacity = 0
   if (actorHasSlug(actor, TEMPLAR_SLUGS.holdingBarrier)) capacity = 1
   if (actorHasSlug(actor, TEMPLAR_SLUGS.shieldBearer)) capacity = 2
   if (actorHasSlug(actor, TEMPLAR_SLUGS.barrierJuggler)) capacity = 3

   const highestOccupied =
      state?.holding?.reduce((highest, slot, index) => {
         return slot?.active || slot?.releasing || slot?.released
            ? Math.max(highest, index + 1)
            : highest
      }, 0) ?? 0

   return Math.max(capacity, highestOccupied)
}

export function activeTemplarActor(actorLike = null) {
   if (actorLike?.documentName === "Actor") return actorLike
   if (
      actorLike?.type &&
      actorLike?.items &&
      (typeof actorLike?.setFlag === "function" ||
         typeof actorLike?.getFlag === "function")
   ) {
      return actorLike
   }
   if (actorLike?.actor?.documentName === "Actor") return actorLike.actor
   if (typeof actorLike === "string") {
      const actor = game.actors?.get(actorLike)
      if (actor) return actor
   }

   const controlled = canvas?.tokens?.controlled ?? []
   if (controlled.length > 0 && controlled[0]?.actor) return controlled[0].actor
   return game.user?.character ?? null
}

export async function writeTemplarState(actor, state) {
   if (!actor?.setFlag) return null
   const normalized = normalizeTemplarState(actor, state)
   normalized.updatedAt = Date.now()
   await actor.setFlag(MODULE_ID, TEMPLAR_FLAG, normalized)
   Hooks.callAll(`${MODULE_ID}.templarStateUpdated`, actor, normalized)
   return normalized
}

export async function unsetTemplarState(actor) {
   if (!actor?.unsetFlag) return null
   await actor.unsetFlag(MODULE_ID, TEMPLAR_FLAG)
   const state = readTemplarState(actor)
   Hooks.callAll(`${MODULE_ID}.templarStateUpdated`, actor, state)
   return state
}

export function canUseTemplarBarrier(actor) {
   return actorHasSlug(actor, TEMPLAR_SLUGS.dedication)
}
