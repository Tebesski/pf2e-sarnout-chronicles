import {
   MODULE_ID,
   actorHasSlug,
   actorLevel,
   canMutateActor,
   chat,
   createOrRefreshEffect,
   actorEffectBySlug,
   effectSource,
   esc,
   hasAbilityCharge,
   oneMinuteDuration,
   ownedOrControlledActor,
   spendAbilityCharge,
   warn,
} from "../helpers.mjs"
import { forMotherland } from "../lvl-5/for-motherland.mjs"

const CITIZENS_PERSEVERANCE_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/hadaganian/TriumphOfSpirit.(UITexture).png"
const EFFECT_SLUG = "effect-citizens-perseverance"
const TEMP_HP_FLAG = "citizensPerseveranceTempHP"
const PROMPT_FLAG = "citizensPerseverancePrompt"

function citizensPerseveranceHasCharge(actor) {
   return hasAbilityCharge(actor, ["citizens-perseverance"])
}

async function spendCitizensPerseveranceCharge(actor) {
   return spendAbilityCharge(actor, ["citizens-perseverance"], "Citizen's Perseverance")
}

function hpValues(actor, changes = {}) {
   const hp = actor.system?.attributes?.hp
   const current = Number(hp?.value ?? 0)
   const max = Number(hp?.max ?? 0)
   const nextCurrent = Number(
      foundry.utils.getProperty(changes, "system.attributes.hp.value") ??
         current,
   )
   const nextMax = Number(
      foundry.utils.getProperty(changes, "system.attributes.hp.max") ?? max,
   )
   return { current, max, nextCurrent, nextMax }
}

function isBelowQuarter(current, max) {
   return Number.isFinite(current) && Number.isFinite(max) && current < max / 4
}

function activePromptMessage(actor) {
   return (
      game.messages?.find?.(
         (message) =>
            message.getFlag?.(MODULE_ID, `${PROMPT_FLAG}.actorUuid`) ===
            actor.uuid,
      ) ?? null
   )
}

function privateRecipientsForActor(actor) {
   const owners =
      game.users?.filter?.(
         (user) =>
            !user.isGM &&
            actor.testUserPermission?.(user, "OWNER"),
      ) ?? []
   const recipients = owners.length
      ? owners
      : game.users?.filter?.((user) => user.isGM) ?? []
   return recipients.map((user) => user.id)
}

function shouldPostPromptForActor(actor, userId = null) {
   const users = Array.from(game.users ?? [])
   const activeOwners = users
      .filter(
         (user) =>
            user.active &&
            !user.isGM &&
            actor.testUserPermission?.(user, "OWNER"),
      )
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
   if (activeOwners.length > 0) return activeOwners[0].id === game.user?.id

   const activeGms = users
      .filter((user) => user.active && user.isGM)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
   if (activeGms.length > 0) return activeGms[0].id === game.user?.id

   if (userId && game.user?.id !== userId) return false
   return Boolean(actor.isOwner || actor.testUserPermission?.(game.user, "OWNER"))
}

export async function citizensPerseverance({ actor, spendCharge = true } = {}) {
   const resolved = ownedOrControlledActor(actor)
   if (!resolved) return null
   if (actorEffectBySlug(resolved, [EFFECT_SLUG])) {
      return warn("Citizen's Perseverance is already active.")
   }
   if (!citizensPerseveranceHasCharge(resolved)) {
      return warn("Citizen's Perseverance has no uses remaining.")
   }
   const hp = resolved.system?.attributes?.hp
   const current = Number(hp?.value ?? 0)
   const max = Number(hp?.max ?? 0)
   if (!Number.isFinite(current) || !Number.isFinite(max) || current >= max / 4) {
      return warn("Citizen's Perseverance requires less than one-quarter HP.")
   }
   if (spendCharge && !(await spendCitizensPerseveranceCharge(resolved))) {
      return null
   }

   const granted = actorLevel(resolved)
   const rules = [
      {
         key: "TempHP",
         value: granted,
      },
      {
         key: "FlatModifier",
         selector: "will",
         type: "circumstance",
         value: 1,
         predicate: ["item:trait:fear"],
      },
      {
         key: "FlatModifier",
         selector: "will-dc",
         type: "circumstance",
         value: 2,
         predicate: ["action:demoralize"],
      },
   ]
   if (actorHasSlug(resolved, ["steel-of-the-people"])) {
      rules.push(
         {
            key: "FlatModifier",
            selector: "strike-damage",
            type: "status",
            value: "@weapon.system.damage.dice",
            label: "Steel of the People",
         },
         {
            key: "FlatModifier",
            selector: "spell-damage",
            type: "status",
            value: "@item.level",
            label: "Steel of the People",
         },
      )
   }
   const effect = await createOrRefreshEffect(
      resolved,
      effectSource({
         name: "Effect: Citizen's Perseverance",
         slug: EFFECT_SLUG,
         img: CITIZENS_PERSEVERANCE_ICON,
         duration: oneMinuteDuration(),
         rules,
         flags: {
            [TEMP_HP_FLAG]: {
               granted,
               remaining: granted,
            },
         },
      }),
      { slugs: [EFFECT_SLUG] },
   )
   if (actorHasSlug(resolved, ["for-motherland"])) {
      await forMotherland({ actor: resolved, silent: true })
   }
   await chat(
      resolved,
      `<p><strong>Citizen's Perseverance</strong>: gained ${actorLevel(resolved)} temporary HP for 1 minute.</p>`,
   )
   return effect
}

async function postCitizensPerseverancePrompt(actor) {
   if (!actorHasSlug(actor, ["citizens-perseverance"])) return
   if (actorEffectBySlug(actor, [EFFECT_SLUG])) return
   if (!citizensPerseveranceHasCharge(actor)) return
   const hp = actor.system?.attributes?.hp
   if (!isBelowQuarter(Number(hp?.value ?? 0), Number(hp?.max ?? 0))) return
   if (activePromptMessage(actor)) return

   const whisper = privateRecipientsForActor(actor)
   if (whisper.length === 0) return
   await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      whisper,
      flags: {
         [MODULE_ID]: {
            [PROMPT_FLAG]: {
               actorUuid: actor.uuid,
            },
         },
      },
      content: `<div class="pf2e chat-card item-card ssc-hadaganian-tip-card">
         <header class="card-header flexrow">
            <img src="${CITIZENS_PERSEVERANCE_ICON}" alt="">
            <h3>Citizen's Perseverance</h3>
         </header>
         <div class="card-content">
            <p>You've reached less than one-quarter of your HP.</p>
            <p>You can benefit from the Citizen's Perseverance feat.</p>
            <p>
               <button type="button" data-hadaganian-citizens-perseverance="apply" data-actor-uuid="${esc(actor.uuid)}">
                  <i class="fa-solid fa-shield-heart"></i> Apply
               </button>
               <button type="button" data-hadaganian-citizens-perseverance="cancel">
                  <i class="fa-solid fa-xmark"></i> Cancel
               </button>
            </p>
         </div>
      </div>`,
   })
}

export function promptCitizensPerseveranceOnLowHp(
   actor,
   changes = {},
   _options = {},
   userId = null,
   { requireCrossing = false } = {},
) {
   if (!shouldPostPromptForActor(actor, userId)) return
   if (!actorHasSlug(actor, ["citizens-perseverance"])) return
   if (actorEffectBySlug(actor, [EFFECT_SLUG])) return
   if (!citizensPerseveranceHasCharge(actor)) return
   if (!foundry.utils.hasProperty(changes, "system.attributes.hp.value")) return

   const { current, max, nextCurrent, nextMax } = hpValues(actor, changes)
   if (requireCrossing && isBelowQuarter(current, max)) return
   if (!isBelowQuarter(nextCurrent, nextMax)) return

   setTimeout(() => {
      void postCitizensPerseverancePrompt(actor)
   }, 0)
}

async function resolveUuid(uuid) {
   if (!uuid) return null
   return globalThis.fromUuidSync?.(uuid) ?? (await fromUuid(uuid).catch(() => null))
}

async function deleteMessageForButton(control) {
   const messageId = control.closest?.(".message")?.dataset?.messageId
   const message = messageId ? game.messages?.get?.(messageId) : null
   if (!message) return
   await message.delete().catch(() => {
      control.closest?.(".message")?.remove?.()
   })
}

export async function handleCitizensPerseverancePromptButton(event) {
   const control = event.target?.closest?.(
      "[data-hadaganian-citizens-perseverance]",
   )
   if (!control) return
   event.preventDefault()
   const action = control.dataset.hadaganianCitizensPerseverance
   if (action === "cancel") {
      await deleteMessageForButton(control)
      return
   }
   if (action !== "apply") return

   const actor = await resolveUuid(control.dataset.actorUuid)
   const result = await citizensPerseverance({ actor })
   if (result) await deleteMessageForButton(control)
}

export function trackCitizensPerseveranceTempHp(
   actor,
   changes = {},
   _options = {},
   userId = null,
) {
   if (userId && game.user?.id !== userId) return
   if (!canMutateActor(actor)) return
   if (
      !foundry.utils.hasProperty(changes, "system.attributes.hp.temp")
   ) {
      return
   }

   const oldTemp = Number(actor.system?.attributes?.hp?.temp ?? 0)
   const newTemp = Number(
      foundry.utils.getProperty(changes, "system.attributes.hp.temp") ?? 0,
   )
   const loss = oldTemp - newTemp
   if (!Number.isFinite(loss) || loss <= 0) return

   setTimeout(() => {
      void updateCitizensPerseveranceRemaining(actor, loss)
   }, 0)
}

async function updateCitizensPerseveranceRemaining(actor, loss) {
   const effect = actorEffectBySlug(actor, [EFFECT_SLUG])
   if (!effect) return
   const data = effect.getFlag?.(MODULE_ID, TEMP_HP_FLAG) ?? {}
   const granted = Number(data.granted ?? actorLevel(actor))
   const previousRemaining = Number(data.remaining ?? granted)
   const remaining = Math.max(0, previousRemaining - loss)
   if (remaining <= 0) {
      await effect.delete().catch(() => null)
      return
   }
   await effect
      .setFlag(MODULE_ID, TEMP_HP_FLAG, {
         granted,
         remaining,
      })
      .catch(() => null)
}
