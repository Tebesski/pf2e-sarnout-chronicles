import { applyTemplarReactionUsed } from "../../../templar/reactions.mjs"
import {
   MODULE_ID,
   actorEffectBySlug,
   actorHasSlug,
   actorLevel,
   chat,
   conditionItem,
   createOrRefreshEffect,
   decrementCondition,
   effectSource,
   esc,
   hasAbilityCharge,
   oneMinuteDuration,
   spendAbilityCharge,
   slugify,
} from "../helpers.mjs"

const BOUNCE_BACK_ICON =
   "modules/pf2e-sarnout-chronicles/assets/ancestries/hadaganian/BTNLightForce.png"
const EFFECT_SLUG = "effect-bounce-back"
const PROMPT_FLAG = "bounceBackPrompt"

function isDyingItem(item) {
   return slugify(item?.slug ?? item?.system?.slug ?? item?.name) === "dying"
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

function shouldPostPrompt(actor) {
   const activeOwners = Array.from(game.users ?? [])
      .filter(
         (user) =>
            user.active &&
            !user.isGM &&
            actor.testUserPermission?.(user, "OWNER"),
      )
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
   if (activeOwners.length > 0) return activeOwners[0].id === game.user?.id
   const activeGms = Array.from(game.users ?? [])
      .filter((user) => user.active && user.isGM)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
   if (activeGms.length > 0) return activeGms[0].id === game.user?.id
   return Boolean(actor.isOwner || actor.testUserPermission?.(game.user, "OWNER"))
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

async function deleteMessageForButton(control) {
   const messageId = control.closest?.(".message")?.dataset?.messageId
   const message = messageId ? game.messages?.get?.(messageId) : null
   if (!message) return
   await message.delete().catch(() => {
      control.closest?.(".message")?.remove?.()
   })
}

async function postBounceBackPrompt(actor) {
   if (!actorHasSlug(actor, ["bounce-back"])) return
   if (!hasAbilityCharge(actor, ["bounce-back"])) return
   if (actorEffectBySlug(actor, [EFFECT_SLUG])) return
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
            <img src="${BOUNCE_BACK_ICON}" alt="">
            <h3>Bounce Back</h3>
         </header>
         <div class="card-content">
            <p>You lost the dying condition.</p>
            <p>
               <button type="button" data-hadaganian-bounce-back="apply" data-actor-uuid="${esc(actor.uuid)}">
                  <i class="fa-solid fa-heart-pulse"></i> Apply
               </button>
               <button type="button" data-hadaganian-bounce-back="reaction" data-actor-uuid="${esc(actor.uuid)}">
                  <i class="fa-solid fa-person-running"></i> Apply and Stand
               </button>
               <button type="button" data-hadaganian-bounce-back="cancel">
                  <i class="fa-solid fa-xmark"></i> Cancel
               </button>
            </p>
         </div>
      </div>`,
   })
}

async function resolveUuid(uuid) {
   if (!uuid) return null
   return globalThis.fromUuidSync?.(uuid) ?? (await fromUuid(uuid).catch(() => null))
}

function canActivateActor(actor) {
   return Boolean(
      game.user?.isGM ||
         actor?.isOwner ||
         actor?.testUserPermission?.(game.user, "OWNER"),
   )
}

async function activateBounceBack(actor, { reaction = false } = {}) {
   if (!actor || !canActivateActor(actor)) return null
   if (!(await spendAbilityCharge(actor, ["bounce-back"], "Bounce Back"))) return null
   if (conditionItem(actor, "wounded")) await decrementCondition(actor, "wounded")
   const tempHp = actorLevel(actor)
   await createOrRefreshEffect(
      actor,
      effectSource({
         name: "Effect: Bounce Back",
         slug: EFFECT_SLUG,
         img: BOUNCE_BACK_ICON,
         duration: oneMinuteDuration(),
         description: `Gain ${tempHp} temporary HP for 1 minute.`,
         rules: [
            {
               key: "TempHP",
               value: tempHp,
            },
         ],
         flags: { bounceBack: { tempHp, reaction } },
      }),
      { slugs: [EFFECT_SLUG] },
   )
   let stood = false
   if (reaction) {
      if (conditionItem(actor, "prone")) {
         if (typeof actor.decreaseCondition === "function") {
            await actor.decreaseCondition("prone", { forceRemove: true }).catch(() => null)
         } else {
            await conditionItem(actor, "prone")?.delete?.().catch(() => null)
         }
         stood = true
      }
      await applyTemplarReactionUsed(actor, { description: false })
   }
   await chat(
      actor,
      `<p><strong>Bounce Back</strong>: ${esc(actor.name)} bounces back into combat, gains ${tempHp} temporary HP, and does not increase Wounded${stood ? ", then stands up" : ""}.</p>`,
   )
   return actor
}

export async function handleBounceBackDyingRemoved(item) {
   if (!isDyingItem(item)) return
   const actor = item.actor
   if (!actor || !shouldPostPrompt(actor)) return
   setTimeout(() => {
      void postBounceBackPrompt(actor)
   }, 0)
}

export async function handleBounceBackPromptButton(event) {
   const control = event.target?.closest?.("[data-hadaganian-bounce-back]")
   if (!control) return
   event.preventDefault()
   const action = control.dataset.hadaganianBounceBack
   if (action === "cancel") {
      await deleteMessageForButton(control)
      return
   }
   if (!["apply", "reaction"].includes(action)) return
   const actor = await resolveUuid(control.dataset.actorUuid)
   const result = await activateBounceBack(actor, { reaction: action === "reaction" })
   if (result) await deleteMessageForButton(control)
}
