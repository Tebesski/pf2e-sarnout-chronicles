import {
   LAST_STRONGHOLD_SOURCE_SLUG,
   LAST_STRONGHOLD_TEMP_SLUG,
   MODULE_ID,
   TEMPLAR_ASSETS,
   TEMPLAR_SLUGS,
} from "./constants.mjs"
import {
   actorHasSlug,
   readTemplarState,
   slugify,
   spellRankForActor,
} from "./state.mjs"
import {
   actorHasLingeringBarrierEffect,
   effectiveBarrier,
} from "./barrier/state.mjs"
import {
   featureDetected,
   getActor,
} from "./actors.mjs"
import { createOrRefreshEffect, linkedEffectExpired } from "./effects.mjs"
import {
   alliedTokensInEmanation,
   getActorToken,
   tokenDistanceFeet,
} from "./tokens.mjs"
import { spendFocusPoint } from "./focus.mjs"
import { playSound } from "./audio.mjs"
import { emitTemplarLight } from "./light.mjs"
import { releaseHeldForBarrierTrait } from "./holding/release.mjs"
import {
   normalizeRegionBehaviorType,
   regionEvent,
} from "./regions.mjs"

function requestBarrierPanel(actor) {
   Hooks.callAll(`${MODULE_ID}.openTemplarBarrierPanel`, actor)
}

Hooks.on("createChatMessage", async (message) => {
   const item = message.item
   if (
      item &&
      item.type === "action" &&
      item.flags?.[MODULE_ID]?.lastRedoubtAction
   ) {
      const actor = item.actor
      if (!actor) return
      const effectData = {
         name: "Effect: Last Redoubt AC",
         type: "effect",
         img: "modules/pf2e-sarnout-chronicles/assets/templar/icons/ac.png",
         system: {
            slug: "effect-last-redoubt-ac",
            duration: { value: 1, unit: "rounds", expiry: "turn-start" },
            rules: [
               {
                  key: "FlatModifier",
                  selector: "ac",
                  type: "circumstance",
                  value: 1,
               },
            ],
         },
         flags: { [MODULE_ID]: { lastRedoubtAcEffect: true } },
      }

      const existing = actor.items.find(
         (i) => i.slug === "effect-last-redoubt-ac",
      )
      if (existing) await existing.delete()
      await actor.createEmbeddedDocuments("Item", [effectData])
   }
})

function lastStrongholdSourceEffect(actor) {
   return actor?.items?.find?.((item) => {
      if (item.type !== "effect") return false
      const slug = slugify(item.slug ?? item.system?.slug ?? item.name)
      return [LAST_STRONGHOLD_SOURCE_SLUG, "effect-last-stronghold"].includes(
         slug,
      )
   })
}

function activeLastStrongholdSources() {
   return Array.from(game.actors ?? [])
      .map((actor) => ({
         actor,
         effect: lastStrongholdSourceEffect(actor),
      }))
      .filter(({ effect }) => effect && !linkedEffectExpired(effect))
}

function actorInSourceEmanation(sourceActor, targetActor, radius = 15) {
   if (sourceActor === targetActor) return true
   const sourceToken = getActorToken(sourceActor)
   const targetToken = getActorToken(targetActor)
   if (!sourceToken || !targetToken) return false
   const sourceDisposition = Number(sourceToken.disposition ?? 0)
   const targetDisposition = Number(targetToken.disposition ?? 0)
   if (
      sourceDisposition !== 0 &&
      targetDisposition !== 0 &&
      sourceDisposition !== targetDisposition
   ) {
      return false
   }
   return (
      tokenDistanceFeet(
         sourceToken.object ?? sourceToken,
         targetToken.object ?? targetToken,
      ) <= radius
   )
}

function lastStrongholdTargets(actor) {
   const targets = [
      actor,
      ...alliedTokensInEmanation(actor, 15).map((token) => token.actor),
   ].filter(Boolean)
   return [
      ...new Map(
         targets.map((target) => [target.uuid ?? target.id, target]),
      ).values(),
   ]
}

export async function createLastStrongholdSourceEffect(actor, rank) {
   const hasAdvent = actorHasSlug(actor, TEMPLAR_SLUGS.advent)
   return createOrRefreshEffect(
      actor,
      {
         name: "Effect: Last Redoubt",
         type: "effect",
         img: "modules/pf2e-sarnout-chronicles/assets/templar/icons/last-stronghold.png",
         system: {
            slug: LAST_STRONGHOLD_SOURCE_SLUG,
            duration: { value: 10, unit: "rounds", expiry: "turn-start" },
            badge: { type: "counter", value: 1 },
            description: {
               value: hasAdvent
                  ? "Sarnout Chronicles generates a 15-foot burst for Last Redoubt while this effect is active. Increase the badge value to 2 to enhance the region with Advent."
                  : "Sarnout Chronicles generates a 15-foot burst for Last Redoubt while this effect is active.",
            },
         },
         flags: {
            [MODULE_ID]: {
               lastStrongholdSource: actor.uuid,
               rank,
            },
         },
      },
      { slugs: [LAST_STRONGHOLD_SOURCE_SLUG] },
   )
}

export function checkLastRedoubtBadge(item, changes) {
   if (item.slug !== LAST_STRONGHOLD_SOURCE_SLUG) return
   const newBadge = foundry.utils.getProperty(changes, "system.badge.value")
   if (typeof newBadge !== "number") return
   const oldBadge = item.system.badge?.value ?? 1
   if (newBadge >= 2 && oldBadge < 2) {
      foundry.utils.setProperty(
         changes,
         `flags.${MODULE_ID}.adventEnhanced`,
         true,
      )
   }
}

export async function createLastRedoubtBehavior(
   region,
   actor,
   rank,
   hasAdvent,
) {
   if (!region?.createEmbeddedDocuments) return null
   const state = readTemplarState(actor)
   const active = effectiveBarrier(state) ?? { hardness: state.light.hardness }
   const adventHardness = Math.max(1, Math.floor(active.hardness / 2))

   const lightProtects = actorHasSlug(actor, TEMPLAR_SLUGS.lightProtects)
   const allProtectingLight = actorHasSlug(
      actor,
      TEMPLAR_SLUGS.allProtectingLight,
   )

   const script = `const MODULE_ID = "${MODULE_ID}";
const ownerUuid = "${actor.uuid}";
const rank = ${rank};
const hasAdvent = ${hasAdvent};
const adventHardness = ${adventHardness};
const lightProtects = ${lightProtects};
const allProtectingLight = ${allProtectingLight};

if (!event.data.token) return;
const tokenDoc = event.data.token.document ?? event.data.token;
const actor = tokenDoc.actor;
if (!actor) return;
const owner = await fromUuid(ownerUuid);
if (!owner || (owner.alliance !== actor.alliance && actor.uuid !== ownerUuid)) return;

const isOwner = actor.uuid === ownerUuid;
const isEnter = event.name === "tokenEnter";
const isExit = event.name === "tokenExit";
const isTurnStart = event.name === "tokenTurnStart";

if (isEnter || isTurnStart) {
    const existingTemps = actor.items.filter(i => i.flags?.[MODULE_ID]?.lastRedoubtTempHp);
    let needsTempHp = existingTemps.length === 0;

    if (isTurnStart) {
        if (existingTemps.length) {
            try {
                const currentIds = new Set(actor.items.map(i => i.id));
                const idsToDelete = existingTemps.map(i => i.id).filter(id => currentIds.has(id));
                if (idsToDelete.length) await actor.deleteEmbeddedDocuments("Item", idsToDelete);
            } catch (_error) {
                undefined;
            }
        }
        needsTempHp = true;
    }

    const itemsToCreate = [];

    if (needsTempHp) {
        itemsToCreate.push({
            name: "Last Redoubt Temp HP",
            type: "effect",
            img: "modules/pf2e-sarnout-chronicles/assets/templar/icons/hp.png",
            system: { slug: "effect-last-redoubt-temp-hp", rules: [{ key: "TempHP", value: rank * 2 }] },
            flags: { [MODULE_ID]: { lastRedoubtTempHp: true, source: ownerUuid } }
        });
    }

    if (!isOwner && !actor.items.some(i => i.flags?.[MODULE_ID]?.lastRedoubtAction)) {
        itemsToCreate.push({
            name: "Last Redoubt Defenses",
            type: "action",
            img: "modules/pf2e-sarnout-chronicles/assets/templar/icons/ac.png",
            system: { actionType: { value: "action" }, actions: { value: 1 }, description: { value: "Gain +1 circumstance bonus to AC until the start of your next turn." } },
            flags: { [MODULE_ID]: { lastRedoubtAction: true, source: ownerUuid } }
        });
    }

    if (!isOwner && hasAdvent && !actor.items.some(i => i.flags?.[MODULE_ID]?.lastRedoubtAdvent)) {
        const rules = [];
        if (allProtectingLight) {
            rules.push({ key: "Resistance", type: "all-damage", value: adventHardness });
        } else if (lightProtects) {
            rules.push({ key: "Resistance", type: "physical", value: adventHardness });
            rules.push({ key: "Resistance", type: "custom", label: "Light Protects", value: adventHardness, definition: [{or: ["item:trait:darkness", "item:trait:shadow", "item:trait:unholy", "origin:trait:darkness", "origin:trait:shadow", "origin:trait:unholy"]}] });
        } else {
            rules.push({ key: "Resistance", type: "physical", value: adventHardness });
        }

        itemsToCreate.push({
            name: "Effect: Last Redoubt Advent",
            type: "effect",
            img: "modules/pf2e-sarnout-chronicles/assets/templar/icons/last-stronghold.png",
            system: { slug: "effect-last-redoubt-advent", duration: { value: 1, unit: "rounds", expiry: "turn-start" }, rules: rules },
            flags: { [MODULE_ID]: { lastRedoubtAdvent: true, source: ownerUuid } }
        });
    }

    if (itemsToCreate.length) {
        try {
            await actor.createEmbeddedDocuments("Item", itemsToCreate);
        } catch (_error) {
            undefined;
        }
    }
}

if (isExit) {
    const currentIds = new Set(actor.items.map(i => i.id));
    const itemsToDelete = actor.items.filter(i => {
        const flags = i.flags?.[MODULE_ID] || {};
        return flags.lastRedoubtTempHp || flags.lastRedoubtAction || flags.lastRedoubtAcEffect || flags.lastRedoubtAdvent || i.slug === "effect-last-redoubt-temp-hp" || i.slug === "effect-last-redoubt-ac" || i.slug === "effect-last-redoubt-advent";
    }).map(i => i.id).filter(id => currentIds.has(id));
    
    if (itemsToDelete.length) {
        try {
            await actor.deleteEmbeddedDocuments("Item", itemsToDelete);
        } catch (_error) {
            undefined;
        }
    }
}`

   const behaviorData = {
      type: normalizeRegionBehaviorType("executeScript"),
      system: {
         events: [
            regionEvent("TOKEN_ENTER", "tokenEnter"),
            regionEvent("TOKEN_EXIT", "tokenExit"),
            regionEvent("TOKEN_TURN_START", "tokenTurnStart"),
         ].filter(Boolean),
         source: script,
      },
   }

   const existing = region.behaviors.contents
   if (existing.length) {
      await region.deleteEmbeddedDocuments(
         "RegionBehavior",
         existing.map((b) => b.id),
      )
   }
   return region.createEmbeddedDocuments("RegionBehavior", [behaviorData])
}

export async function lastStronghold({
   actor,
   spendFocus = true,
   fromSpellMessage = false,
} = {}) {
   const resolved = getActor(actor)
   if (!resolved) return null
   if (
      !featureDetected(resolved, TEMPLAR_SLUGS.lastStronghold, fromSpellMessage)
   ) {
      ui.notifications?.warn("Last Redoubt was not detected on this actor.")
      return null
   }
   if (!actorHasLingeringBarrierEffect(resolved)) {
      ui.notifications?.warn(
         "Last Redoubt requires Lingering Barrier to be active.",
      )
      return null
   }
   if (spendFocus && !(await spendFocusPoint(resolved))) return null
   await releaseHeldForBarrierTrait(resolved, "Last Redoubt")
   await emitTemplarLight(resolved)

   const rank = spellRankForActor(resolved)
   const effect = await createLastStrongholdSourceEffect(resolved, rank)

   const token = getActorToken(resolved)
   const center = token?.center ?? {
      x: Number(token?.x ?? 0),
      y: Number(token?.y ?? 0),
   }
   if (
      Number.isFinite(center.x) &&
      Number.isFinite(center.y) &&
      canvas?.scene
   ) {
      const gridSize =
         Number(canvas.scene.grid?.size ?? canvas.grid?.size ?? 100) || 100
      const distance = Number(canvas.scene.grid?.distance ?? 5) || 5
      const radius = 15 * (gridSize / distance)

      const [region] = await canvas.scene.createEmbeddedDocuments("Region", [
         {
            name: `Last Redoubt (${resolved.name})`,
            color: "#ffaa00",
            visibility: 2,
            highlightMode: "coverage",
            shapes: [
               {
                  type: "circle",
                  x: center.x,
                  y: center.y,
                  radius,
                  hole: false,
                  gridBased: true,
               },
            ],
            flags: {
               [MODULE_ID]: {
                  templarLastRedoubt: {
                     actor: resolved.uuid,
                     rank,
                  },
               },
            },
         },
      ])

      if (effect && region) {
         await effect.update({ [`flags.${MODULE_ID}.regionUuid`]: region.uuid })
         const badgeValue = effect.system?.badge?.value ?? 1
         const hasAdvent = badgeValue >= 2
         await createLastRedoubtBehavior(region, resolved, rank, hasAdvent)
      }
   }

   await playSound(TEMPLAR_ASSETS.lastStrongholdSound)
   requestBarrierPanel(resolved)
   return true
}

export async function executeLastRedoubtEnhancement(item, changes) {
   if (item.slug !== LAST_STRONGHOLD_SOURCE_SLUG) return
   if (
      foundry.utils.getProperty(changes, `flags.${MODULE_ID}.adventEnhanced`)
   ) {
      await spendFocusPoint(item.actor, 1)
      const regionUuid = item.flags?.[MODULE_ID]?.regionUuid
      if (regionUuid) {
         const region = await fromUuid(regionUuid)
         if (region) {
            const existing = region.behaviors.contents[0]
            if (existing) {
               const newSource = existing.system.source.replace(
                  "const hasAdvent = false;",
                  "const hasAdvent = true;",
               )
               await existing.update({ "system.source": newSource })
            }

            const state = readTemplarState(item.actor)
            const active = effectiveBarrier(state) ?? {
               hardness: state.light.hardness,
            }
            const adventHardness = Math.max(1, Math.floor(active.hardness / 2))
            const lightProtects = actorHasSlug(
               item.actor,
               TEMPLAR_SLUGS.lightProtects,
            )
            const allProtectingLight = actorHasSlug(
               item.actor,
               TEMPLAR_SLUGS.allProtectingLight,
            )

            const rules = []
            if (allProtectingLight) {
               rules.push({
                  key: "Resistance",
                  type: "all-damage",
                  value: adventHardness,
               })
            } else if (lightProtects) {
               rules.push({
                  key: "Resistance",
                  type: "physical",
                  value: adventHardness,
               })
               rules.push({
                  key: "Resistance",
                  type: "custom",
                  label: "Light Protects",
                  value: adventHardness,
                  definition: [
                     {
                        or: [
                           "item:trait:darkness",
                           "item:trait:shadow",
                           "item:trait:unholy",
                           "origin:trait:darkness",
                           "origin:trait:shadow",
                           "origin:trait:unholy",
                        ],
                     },
                  ],
               })
            } else {
               rules.push({
                  key: "Resistance",
                  type: "physical",
                  value: adventHardness,
               })
            }

            const adventEffectData = {
               name: "Effect: Last Redoubt Advent",
               type: "effect",
               img: "modules/pf2e-sarnout-chronicles/assets/templar/icons/last-stronghold.png",
               system: {
                  slug: "effect-last-redoubt-advent",
                  duration: { value: 1, unit: "rounds", expiry: "turn-start" },
                  rules: rules,
               },
               flags: {
                  [MODULE_ID]: {
                     lastRedoubtAdvent: true,
                     source: item.actor.uuid,
                  },
               },
            }

            const initialTokens = alliedTokensInEmanation(item.actor, 15)
            for (const allyToken of initialTokens) {
               const targetActor = allyToken.actor ?? allyToken.document?.actor
               if (targetActor && targetActor.uuid !== item.actor.uuid) {
                  if (
                     !targetActor.items.some(
                        (i) => i.flags?.[MODULE_ID]?.lastRedoubtAdvent,
                     )
                  ) {
                     try {
                        await targetActor.createEmbeddedDocuments("Item", [
                           adventEffectData,
                        ])
                     } catch (_error) {
                        undefined
                     }
                  }
               }
            }
         }
      }
   }
}

async function applyLastStrongholdTempHpEffect(
   target,
   sourceActor,
   rank,
   value,
) {
   const sourceKey = slugify(
      sourceActor.uuid ?? sourceActor.id ?? sourceActor.name,
   )
   const slug = `${LAST_STRONGHOLD_TEMP_SLUG}-${sourceKey}`
   return createOrRefreshEffect(
      target,
      {
         name: "Effect: Last Redoubt Temporary HP",
         type: "effect",
         img: TEMPLAR_ASSETS.fragment,
         system: {
            slug,
            duration: { value: 1, unit: "rounds", expiry: "turn-start" },
            rules: [
               {
                  key: "TempHP",
                  value,
               },
            ],
            description: {
               value: `Runtime Last Redoubt temporary Hit Points from ${sourceActor.name}.`,
            },
         },
         flags: {
            [MODULE_ID]: {
               lastStrongholdSource: sourceActor.uuid,
               rank,
            },
         },
      },
      { slugs: [slug] },
   )
}

async function applyLastStrongholdTempHpToTargets(
   sourceActor,
   { initial = false } = {},
) {
   const rank = spellRankForActor(sourceActor)
   const value = initial ? rank * 2 : rank
   const effects = []
   for (const target of lastStrongholdTargets(sourceActor)) {
      const effect = await applyLastStrongholdTempHpEffect(
         target,
         sourceActor,
         rank,
         value,
      )
      if (effect) effects.push(effect)
   }
   return effects
}
