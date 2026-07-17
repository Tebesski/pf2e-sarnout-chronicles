import {
   MODULE_ID,
   actorEffectBySlug,
   actorHasSlug,
   canMutateActor,
   createOrRefreshEffect,
   effectSource,
   esc,
   oneMinuteDuration,
   slugify,
} from "../helpers.mjs"

const BONUS_SLUG_PREFIX = "effect-exemplar-imperial"
const BONUS_MODIFIER_SLUG = "exemplar-imperial"
const IMMUNITY_SLUG = "effect-exemplar-imperial-immunity"
const LEGACY_COOLDOWN_SLUG = "effect-exemplar-imperial-cooldown"
const ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/hadaganian/StandardEmpire.(UITexture).png"
const SAVE_SELECTORS = ["fortitude", "reflex", "will"]
const SAVE_LABELS = {
   fortitude: "Fortitude Save",
   reflex: "Reflex Save",
   will: "Will Save",
}

function context(message) {
   return message?.flags?.pf2e?.context ?? {}
}

function domains(message) {
   const value = context(message).domains
   return Array.isArray(value) ? value.map(slugify).filter(Boolean) : []
}

function rollOptions(message) {
   const roll = message?.rolls?.[0]
   const options = [
      ...(Array.isArray(context(message).options) ? context(message).options : []),
      ...(Array.isArray(roll?.options) ? roll.options : []),
   ]
   return options.map(slugify).filter(Boolean)
}

function skillSlug(message) {
   const skills = new Set(Object.keys(CONFIG.PF2E?.skills ?? {}).map(slugify))
   return (
      domains(message).find((domain) => skills.has(domain)) ??
      rollOptions(message)
         .map((option) => /^skill-([a-z0-9-]+)$/.exec(option)?.[1])
         .find((value) => value && skills.has(value)) ??
      null
   )
}

function saveSlug(message) {
   return (
      domains(message).find((domain) => SAVE_SELECTORS.includes(domain)) ??
      rollOptions(message)
         .map((option) => /^save-([a-z0-9-]+)$/.exec(option)?.[1])
         .find((value) => SAVE_SELECTORS.includes(value)) ??
      null
   )
}

function localizedSkill(slug) {
   const label = CONFIG.PF2E?.skills?.[slug]
   if (typeof label === "string") return game.i18n.localize(label)
   if (label?.label) return game.i18n.localize(label.label)
   return String(label ?? "Skill Check")
}

function rollKind(message) {
   const type = slugify(context(message).type)
   const domainSet = new Set(domains(message))

   if (type === "attack-roll" || domainSet.has("attack-roll")) {
      return {
         key: "attack-roll",
         selector: "attack-roll",
         label: "Attack Roll",
      }
   }

   if (type === "skill-check" || domainSet.has("skill-check")) {
      const skill = skillSlug(message)
      return {
         key: skill ? `skill-${skill}` : "skill-check",
         selector: skill ?? "skill-check",
         label: skill ? localizedSkill(skill) : "Skill Check",
      }
   }

   if (type === "saving-throw" || domainSet.has("saving-throw")) {
      const save = saveSlug(message)
      return {
         key: save ? `save-${save}` : "saving-throw",
         selector: save ?? "saving-throw",
         label: save ? SAVE_LABELS[save] : "Saving Throw",
      }
   }

   return null
}

function isCriticalSuccess(message) {
   const outcome = context(message).outcome
   if (outcome === "criticalSuccess") return true
   const degree = Number(
      message?.rolls?.[0]?.options?.degreeOfSuccess ??
         context(message).degreeOfSuccess,
   )
   return degree === 3
}

async function actorFromMessage(message) {
   const actorUuid = context(message).actor
   return (
      (actorUuid ? await fromUuid(actorUuid).catch(() => null) : null) ??
      game.actors?.get(message?.speaker?.actor) ??
      null
   )
}

function tokenFromMessage(message, actor) {
   const sceneId = message?.speaker?.scene
   const tokenId = message?.speaker?.token
   const scene = sceneId ? game.scenes?.get(sceneId) : canvas?.scene
   const tokenDocument = scene?.tokens?.get?.(tokenId)
   return (
      tokenDocument?.object ??
      actor?.getActiveTokens?.()?.find((token) => token.scene === canvas.scene) ??
      actor?.getActiveTokens?.()?.[0] ??
      null
   )
}

function pointForToken(token) {
   return token?.center ?? {
      x:
         Number(token?.document?.x ?? token?.x ?? 0) +
         (Number(token?.document?.width ?? token?.w ?? 1) *
            (canvas?.grid?.size ?? 100)) /
            2,
      y:
         Number(token?.document?.y ?? token?.y ?? 0) +
         (Number(token?.document?.height ?? token?.h ?? 1) *
            (canvas?.grid?.size ?? 100)) /
            2,
   }
}

function tokenSamplePoints(token) {
   const center = pointForToken(token)
   const bounds = token?.bounds
   if (!bounds) return [center]

   const inset = Math.max(2, (canvas?.grid?.size ?? 100) * 0.05)
   const left = Number(bounds.left) + inset
   const right = Number(bounds.right) - inset
   const top = Number(bounds.top) + inset
   const bottom = Number(bounds.bottom) - inset

   const points = [
      center,
      { x: left, y: top },
      { x: right, y: top },
      { x: left, y: bottom },
      { x: right, y: bottom },
   ]

   return points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
}

function wallBlocksSight(from, to) {
   const backend = CONFIG.Canvas?.polygonBackends?.sight
   if (backend?.testCollision) {
      try {
         return Boolean(
            backend.testCollision(from, to, { mode: "any", type: "sight" }),
         )
      } catch (_error) {}
      try {
         return Boolean(backend.testCollision(new Ray(from, to), "sight"))
      } catch (_error) {}
   }

   if (canvas?.walls?.checkCollision) {
      try {
         return Boolean(
            canvas.walls.checkCollision(new Ray(from, to), {
               mode: "any",
               type: "sight",
            }),
         )
      } catch (_error) {}
   }

   if (canvas?.walls?.testCollision) {
      try {
         return Boolean(
            canvas.walls.testCollision(from, to, {
               mode: "any",
               type: "sight",
            }),
         )
      } catch (_error) {}
   }

   return false
}

function tokenCanSeeSource(allyToken, sourceToken) {
   if (!allyToken || !sourceToken) return false
   const allyPoints = tokenSamplePoints(allyToken)
   const sourcePoints = tokenSamplePoints(sourceToken)
   return allyPoints.some((allyPoint) =>
      sourcePoints.some(
         (sourcePoint) => !wallBlocksSight(allyPoint, sourcePoint),
      ),
   )
}

function sameAlliance(sourceActor, targetActor, sourceToken, targetToken) {
   const sourceAlliance = sourceActor?.system?.details?.alliance
   const targetAlliance = targetActor?.system?.details?.alliance
   if (sourceAlliance && targetAlliance) return sourceAlliance === targetAlliance

   const hostile = CONST.TOKEN_DISPOSITIONS?.HOSTILE ?? -1
   const sourceDisposition = sourceToken?.document?.disposition
   const targetDisposition = targetToken?.document?.disposition
   if (targetDisposition === hostile) return false
   if (Number.isFinite(sourceDisposition) && Number.isFinite(targetDisposition)) {
      return sourceDisposition === targetDisposition && sourceDisposition !== hostile
   }
   return sourceActor?.type === "character" && targetActor?.type === "character"
}

function actorHasDeafCondition(actor) {
   return actorHasSlug(actor, ["deaf", "deafened"])
}

function actorHasImmunity(actor) {
   return Boolean(
      actorEffectBySlug(actor, [IMMUNITY_SLUG, LEGACY_COOLDOWN_SLUG]),
   )
}

function actorHasPendingBonus(actor) {
   return Boolean(
      actor.items?.some?.((item) => {
         if (item.type !== "effect") return false
         if (
            item?.isExpired ||
            item?.system?.expired ||
            item?.system?.duration?.expired ||
            item?.system?.duration?.remaining === 0
         ) {
            return false
         }
         return Boolean(item.getFlag?.(MODULE_ID, "exemplarImperial"))
      }),
   )
}

function promptUsersForActor(actor) {
   const users = Array.from(game.users ?? [])
   return users
      .filter(
         (user) =>
            user.active &&
            !user.isGM &&
            actor.testUserPermission?.(user, "OWNER"),
      )
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

function shouldPromptThisClient(actor) {
   return promptUsersForActor(actor)[0]?.id === game.user?.id
}

function eligibleAllyActors(sourceActor, sourceToken) {
   if (!sourceToken) return []
   const actors = new Map()
   for (const token of canvas?.tokens?.placeables ?? []) {
      const actor = token.actor
      if (!actor || actor.id === sourceActor.id) continue
      if (actor.type !== "character") continue
      if (!sameAlliance(sourceActor, actor, sourceToken, token)) continue
      if (actorHasDeafCondition(actor)) continue
      if (actorHasImmunity(actor)) continue
      if (actorHasPendingBonus(actor)) continue
      if (!tokenCanSeeSource(token, sourceToken)) continue
      actors.set(actor.uuid ?? actor.id, actor)
   }
   return Array.from(actors.values())
}

function bonusSlug(kind) {
   return `${BONUS_SLUG_PREFIX}-${kind.key}`
}

function bonusEffect(kind, sourceActor) {
   return effectSource({
      name: `Effect: Exemplar Imperial - ${kind.label}`,
      slug: bonusSlug(kind),
      img: ICON,
      duration: oneMinuteDuration(),
      description: `+1 circumstance bonus to the next ${kind.label.toLowerCase()} inspired by ${sourceActor.name}.`,
      rules: [
         {
            key: "FlatModifier",
            selector: kind.selector,
            slug: BONUS_MODIFIER_SLUG,
            type: "circumstance",
            value: 1,
         },
      ],
      flags: {
         exemplarImperial: {
            kind: kind.key,
            selector: kind.selector,
            source: sourceActor.uuid,
         },
      },
   })
}

function immunityEffect(sourceActor) {
   return effectSource({
      name: "Effect: Exemplar Imperial Immunity",
      slug: IMMUNITY_SLUG,
      img: ICON,
      duration: { value: 1, unit: "hours", expiry: "turn-start" },
      description: `Cannot benefit from Exemplar Imperial again for 1 hour after using ${sourceActor.name}'s inspiration.`,
      rules: [],
      flags: { exemplarImperialImmunity: true },
   })
}

async function promptExemplarImperialBenefit(sourceActor, ally, kind) {
   if (!shouldPromptThisClient(ally)) return
   const DialogV2 = foundry.applications.api.DialogV2
   if (!DialogV2?.wait) return
   const accepted = await DialogV2.wait({
      window: { title: "Exemplar Imperial" },
      content: `
         <form class="standard-form ssc-hadaganian-exemplar-dialog">
            <p><strong>${esc(sourceActor.name)}</strong> critically succeeded.</p>
            <p>Take <strong>+1 circumstance</strong> to your next ${esc(kind.label.toLowerCase())}?</p>
         </form>
      `,
      position: { width: 360 },
      buttons: [
         {
            action: "accept",
            label: "Accept",
            icon: "fa-solid fa-flag",
            callback: () => true,
         },
         {
            action: "decline",
            label: "Decline",
            icon: "fa-solid fa-xmark",
            callback: () => false,
         },
      ],
      default: "accept",
   }).catch(() => false)
   if (!accepted) return
   if (actorHasImmunity(ally) || actorHasPendingBonus(ally)) return
   await createOrRefreshEffect(ally, bonusEffect(kind, sourceActor), {
      slugs: [bonusSlug(kind)],
   })
}

async function promptExemplarImperialBenefits(sourceActor, message, kind) {
   if (!actorHasSlug(sourceActor, ["exemplar-imperial"])) return
   const sourceToken = tokenFromMessage(message, sourceActor)
   for (const ally of eligibleAllyActors(sourceActor, sourceToken)) {
      await promptExemplarImperialBenefit(sourceActor, ally, kind)
   }
}

function exemplarImperialModifierWasUsed(message) {
   const modifiers = message?.flags?.pf2e?.modifiers
   if (!Array.isArray(modifiers)) return true
   const modifier = modifiers.find((mod) => {
      const slug = slugify(mod?.slug)
      const label = slugify(mod?.label)
      return (
         slug === BONUS_MODIFIER_SLUG ||
         slug.startsWith(BONUS_MODIFIER_SLUG) ||
         label.includes(BONUS_MODIFIER_SLUG)
      )
   })
   if (!modifier) return false
   return modifier.enabled !== false && modifier.ignored !== true
}

async function consumeExemplarImperialBonus(actor, message, kind) {
   const effect = actorEffectBySlug(actor, [bonusSlug(kind)])
   if (!effect) return
   if (!exemplarImperialModifierWasUsed(message)) return
   const sourceUuid = effect.getFlag?.(MODULE_ID, "exemplarImperial.source")
   const sourceActor = sourceUuid ? await fromUuid(sourceUuid).catch(() => null) : actor
   await effect.delete().catch(() => null)
   await createOrRefreshEffect(actor, immunityEffect(sourceActor ?? actor), {
      slugs: [IMMUNITY_SLUG, LEGACY_COOLDOWN_SLUG],
   })
}

export async function handleExemplarImperialRoll(message) {
   const actor = await actorFromMessage(message)
   const kind = rollKind(message)
   if (!actor || !kind) return

   if (canMutateActor(actor)) {
      await consumeExemplarImperialBonus(actor, message, kind)
   }

   if (!isCriticalSuccess(message)) return
   await promptExemplarImperialBenefits(actor, message, kind)
}
