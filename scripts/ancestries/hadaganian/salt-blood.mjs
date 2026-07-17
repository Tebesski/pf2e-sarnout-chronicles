import { MODULE_ID } from "../../templar/constants.mjs"

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

function localize(key, fallback = "") {
   const value = game.i18n?.localize?.(key)
   return value && value !== key ? value : fallback || key
}

function format(key, data = {}, fallback = "") {
   const value = game.i18n?.format?.(key, data)
   if (value && value !== key) return value
   return fallback.replace(/\{([^}]+)\}/g, (_match, name) => data[name] ?? "")
}

function actorLevel(actor) {
   return Number(actor?.level ?? actor?.system?.details?.level?.value ?? 0) || 0
}

function levelBasedDC(actor) {
   const level = Math.max(-1, Math.min(25, Math.trunc(actorLevel(actor))))
   const dc = DC_BY_LEVEL.get(level) ?? 14
   const pwol = Boolean(game.pf2e?.settings?.variants?.pwol?.enabled)
   return pwol ? dc - Math.max(level, 0) : dc
}

function hardLevelBasedDC(actor) {
   return levelBasedDC(actor) + 5
}

function resolveActor(actor) {
   if (actor?.documentName === "Actor") return actor
   if (actor?.actor) return actor.actor
   return (
      canvas?.tokens?.controlled?.[0]?.actor ??
      game.user?.character ??
      null
   )
}

function clamp(value, min, max) {
   return Math.max(min, Math.min(max, value))
}

function naturalD20(roll) {
   const candidates = [
      roll?.dice?.[0]?.total,
      roll?.dice?.[0]?.results?.[0]?.result,
      roll?.terms?.[0]?.results?.[0]?.result,
   ]
   return candidates
      .map((value) => Number(value))
      .find((value) => Number.isFinite(value))
}

function degreeFromOutcome(outcome) {
   const value =
      outcome?.degreeOfSuccess?.value ??
      outcome?.degreeOfSuccess ??
      outcome?.dos ??
      outcome?.outcome ??
      outcome
   const numeric = Number(value)
   if (Number.isFinite(numeric)) return clamp(Math.trunc(numeric), 0, 3)

   const text = String(value ?? "")
   if (["criticalFailure", "critical-failure", "critical failure"].includes(text))
      return 0
   if (text === "failure") return 1
   if (text === "success") return 2
   if (["criticalSuccess", "critical-success", "critical success"].includes(text))
      return 3
   return null
}

function degreeFromRoll(message, dc) {
   const roll = message?.rolls?.[0] ?? (message instanceof Roll ? message : null)
   const outcome = degreeFromOutcome(message?.flags?.pf2e?.context?.outcome)
   if (outcome !== null) return outcome

   const rollDegree = Number(
      roll?.degreeOfSuccess ?? roll?.options?.degreeOfSuccess,
   )
   if (Number.isFinite(rollDegree)) return clamp(Math.trunc(rollDegree), 0, 3)

   const total = Number(roll?.total)
   if (!Number.isFinite(total)) return null

   let degree =
      total >= dc + 10 ? 3 : total >= dc ? 2 : total <= dc - 10 ? 0 : 1
   const natural = naturalD20(roll)
   if (natural === 20) degree += 1
   if (natural === 1) degree -= 1
   return clamp(degree, 0, 3)
}

function degreeLabel(degree) {
   return [
      localize("PF2ESC.Cards.Outcome.CriticalFailure", "Critical Failure"),
      localize("PF2ESC.Cards.Outcome.Failure", "Failure"),
      localize("PF2ESC.Cards.Outcome.Success", "Success"),
      localize("PF2ESC.Cards.Outcome.CriticalSuccess", "Critical Success"),
   ][clamp(Math.trunc(Number(degree) || 0), 0, 3)]
}

function conditionRule(slug) {
   const condition = game.pf2e?.ConditionManager?.getCondition?.(slug)
   const uuid = condition?.sourceId ?? condition?.uuid
   if (!uuid) return null
   return {
      key: "GrantItem",
      uuid,
      onDeleteActions: { grantee: "restrict" },
   }
}

async function createOrRefreshEffect(actor, source, slugs) {
   const wanted = new Set(slugs)
   const existing = actor.items?.find?.((item) => {
      if (item.type !== "effect") return false
      return wanted.has(item.slug ?? item.system?.slug)
   })

   if (existing) {
      await existing.update({
         name: source.name,
         img: source.img,
         "system.slug": source.system.slug,
         "system.duration": source.system.duration,
         "system.description": source.system.description,
         "system.rules": source.system.rules,
         flags: source.flags,
      })
      return existing
   }

   const [created] = await actor.createEmbeddedDocuments("Item", [source])
   return created ?? null
}

function saltBloodEffectData({ name, slug, description, hours, rules }) {
   return {
      name,
      type: "effect",
      img: "systems/pf2e/icons/default-icons/effect.svg",
      system: {
         slug,
         duration: {
            value: hours,
            unit: "hours",
            expiry: "turn-start",
         },
         description: { value: description },
         rules: rules.filter(Boolean),
      },
      flags: {
         [MODULE_ID]: {
            hadaganian: true,
            saltBloodOfHadagan: true,
         },
      },
   }
}

async function applySaltBloodOutcome(actor, degree) {
   if (degree === 3) return localize(
      "PF2ESC.Hadaganian.SaltBlood.Result.CriticalSuccess",
      "No effect applied.",
   )

   const enfeebled = conditionRule("enfeebled")
   const sickened = conditionRule("sickened")

   if (degree === 2) {
      await createOrRefreshEffect(
         actor,
         saltBloodEffectData({
            name: localize(
               "PF2ESC.Hadaganian.SaltBlood.Effect.Success.Name",
               "Effect: Salt Blood of Hadagan - Strain",
            ),
            slug: "effect-salt-blood-of-hadagan-strain",
            description: localize(
               "PF2ESC.Hadaganian.SaltBlood.Effect.Success.Description",
               "You overcame the strain, but are Enfeebled for 2 hours.",
            ),
            hours: 2,
            rules: [enfeebled],
         }),
         ["effect-salt-blood-of-hadagan-strain"],
      )
      return localize(
         "PF2ESC.Hadaganian.SaltBlood.Result.Success",
         "Enfeebled for 2 hours.",
      )
   }

   if (degree === 1) {
      await createOrRefreshEffect(
         actor,
         saltBloodEffectData({
            name: localize(
               "PF2ESC.Hadaganian.SaltBlood.Effect.Failure.Name",
               "Effect: Salt Blood of Hadagan - Loyalty",
            ),
            slug: "effect-salt-blood-of-hadagan-loyalty",
            description: localize(
               "PF2ESC.Hadaganian.SaltBlood.Effect.Failure.Description",
               "You are Enfeebled until the end of the day and cannot try to go against the Motherland for 24 hours.",
            ),
            hours: 24,
            rules: [enfeebled],
         }),
         ["effect-salt-blood-of-hadagan-loyalty"],
      )
      return localize(
         "PF2ESC.Hadaganian.SaltBlood.Result.Failure",
         "Enfeebled until the end of the day; cannot try again for 24 hours.",
      )
   }

   await createOrRefreshEffect(
      actor,
      saltBloodEffectData({
         name: localize(
            "PF2ESC.Hadaganian.SaltBlood.Effect.CriticalFailure.Name",
            "Effect: Salt Blood of Hadagan - Submission",
         ),
         slug: "effect-salt-blood-of-hadagan-submission",
         description: localize(
            "PF2ESC.Hadaganian.SaltBlood.Effect.CriticalFailure.Description",
            "You are Enfeebled until the end of the day, Sickened, and cannot try to go against the Motherland for 48 hours.",
         ),
         hours: 48,
         rules: [enfeebled, sickened],
      }),
      ["effect-salt-blood-of-hadagan-submission"],
   )
   return localize(
      "PF2ESC.Hadaganian.SaltBlood.Result.CriticalFailure",
      "Enfeebled, Sickened, and cannot try again for 48 hours.",
   )
}

export async function saltBloodOfHadagan({ actor } = {}) {
   const resolved = resolveActor(actor)
   if (!resolved) {
      ui.notifications?.warn(
         localize(
            "PF2ESC.Hadaganian.SaltBlood.NoActor",
            "Select a Hadaganian actor first.",
         ),
      )
      return null
   }

   const save = resolved.saves?.will ?? resolved.getStatistic?.("will")
   if (typeof save?.roll !== "function") {
      ui.notifications?.warn(
         format(
            "PF2ESC.Hadaganian.SaltBlood.NoWill",
            { actor: resolved.name },
            "{actor} does not have a Will save statistic.",
         ),
      )
      return null
   }

   const dc = hardLevelBasedDC(resolved)
   let callbackOutcome = null
   const message = await save.roll({
      dc: { value: dc },
      label: localize(
         "PF2ESC.Hadaganian.SaltBlood.RollTitle",
         "Salt Blood of Hadagan Will Save",
      ),
      title: localize(
         "PF2ESC.Hadaganian.SaltBlood.RollTitle",
         "Salt Blood of Hadagan Will Save",
      ),
      extraRollOptions: [
         "salt-blood-of-hadagan",
         "item:trait:fortune",
         "item:trait:hadaganian",
         "self:trait:hadaganian",
      ],
      callback: (_roll, outcome) => {
         callbackOutcome = outcome
      },
   })

   if (!message) return null

   const degree =
      degreeFromOutcome(callbackOutcome) ?? degreeFromRoll(message, dc)
   if (degree === null) return message

   const effectText = await applySaltBloodOutcome(resolved, degree)
   await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: resolved }),
      content: `<p><strong>${localize(
         "PF2ESC.Hadaganian.SaltBlood.Name",
         "Salt Blood of Hadagan",
      )}</strong>: ${degreeLabel(degree)}. ${effectText}</p>`,
   })
   return message
}
