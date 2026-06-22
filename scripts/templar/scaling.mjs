import { actorLevel, spellRankForActor } from "./state.mjs"

const DC_BY_LEVEL = new Map([
   [-1, 13],
   [0, 14],
   [1, 15],
   [2, 16],
   [3, 18],
   [4, 19],
   [5, 20],
   [6, 22],
   [7, 23],
   [8, 24],
   [9, 26],
   [10, 27],
   [11, 28],
   [12, 30],
   [13, 31],
   [14, 32],
   [15, 34],
   [16, 35],
   [17, 36],
   [18, 38],
   [19, 39],
   [20, 40],
   [21, 42],
   [22, 44],
   [23, 46],
   [24, 48],
   [25, 50],
])

export function levelBasedDC(actor) {
   const level = Math.max(-1, Math.min(25, Math.trunc(actorLevel(actor))))
   const dc = DC_BY_LEVEL.get(level) ?? 14
   const pwol = Boolean(game.pf2e?.settings?.variants?.pwol?.enabled)
   return pwol ? dc - Math.max(level, 0) : dc
}

export function templarClassOrSpellDC(actor) {
   const statistic = actor?.getStatistic?.("class-spell")
   const statisticDC = Number(statistic?.dc?.value)
   if (Number.isFinite(statisticDC) && statisticDC > 0) return statisticDC

   const values = [
      actor?.system?.attributes?.classOrSpellDC?.value,
      actor?.system?.attributes?.classDC?.value,
      actor?.system?.attributes?.spellDC?.value,
   ]
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > 0)
   return values.length ? Math.max(...values) : null
}

export function lightBurstDice(actor) {
   return Math.max(1, Math.floor((actorLevel(actor) - 2) / 2))
}

export function lightGaolFortitudeDice(actor) {
   return Math.max(1, lightBurstDice(actor) - 1)
}

export function lightBurstRadius(actor) {
   return actorLevel(actor) >= 12 ? 10 : 5
}

export function lightBurstCounteractRank(actor) {
   return Math.max(1, Math.ceil(actorLevel(actor) / 2))
}

export function scutumFideiRank(actor) {
   return Math.max(8, spellRankForActor(actor))
}

export function lightBurstDetails(actor) {
   return {
      dice: lightBurstDice(actor),
      radius: lightBurstRadius(actor),
      counteractRank: lightBurstCounteractRank(actor),
      dc: templarClassOrSpellDC(actor),
   }
}
