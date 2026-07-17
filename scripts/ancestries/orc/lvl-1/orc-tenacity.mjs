import {
   MODULE_ID,
   actorHasSlug,
   actorLevel,
   canMutateActor,
   conditionItem,
   createOrRefreshEffect,
   effectSource,
   hasAbilityCharge,
   oneMinuteDuration,
   ownedOrControlledActor,
   spendAbilityCharge,
   warn,
} from "../../hadaganian/helpers.mjs"

const DOWNED_CONDITIONS = ["dying", "unconscious", "prone"]
const pendingPrompts = new Set()

function hpValue(actor) {
   return Number(actor?.system?.attributes?.hp?.value ?? 0)
}

function changedHpValue(changes) {
   const value = foundry.utils.getProperty(changes, "system.attributes.hp.value")
   const numeric = Number(value)
   return Number.isFinite(numeric) ? numeric : null
}

function hasActivePlayerOwner(actor) {
   return game.users?.some?.(
      (user) =>
         user.active &&
         !user.isGM &&
         actor.testUserPermission?.(user, "OWNER"),
   )
}

function shouldPromptHere(actor) {
   if (game.user?.isGM) return !hasActivePlayerOwner(actor)
   return Boolean(actor?.testUserPermission?.(game.user, "OWNER"))
}

function ownerWhispers(actor) {
   const owners =
      game.users?.filter?.(
         (user) =>
            !user.isGM &&
            user.active &&
            actor.testUserPermission?.(user, "OWNER"),
      ) ?? []
   return (owners.length ? owners : game.users?.filter?.((user) => user.isGM) ?? [])
      .filter((user) => user.active)
      .map((user) => user.id)
}

async function clearDownedConditions(actor) {
   for (const slug of DOWNED_CONDITIONS) {
      const item = conditionItem(actor, slug)
      if (item) await item.delete().catch(() => null)
   }
}

async function applyWoundedOne(actor) {
   const wounded = conditionItem(actor, "wounded")
   if (!wounded && typeof actor.increaseCondition === "function") {
      await actor.increaseCondition("wounded").catch(() => null)
      return
   }
   const value = Number(
      wounded?.system?.value?.value ?? wounded?.system?.badge?.value ?? 0,
   )
   if (wounded && value < 1) {
      await wounded
         .update({
            "system.value.value": 1,
            "system.badge.value": 1,
         })
         .catch(() => null)
   }
}

async function applyUndyingTenacity(actor) {
   if (!actorHasSlug(actor, "undying-tenacity")) return null
   return createOrRefreshEffect(
      actor,
      effectSource({
         name: "Effect: Undying Tenacity",
         slug: "effect-undying-tenacity",
         duration: oneMinuteDuration(),
         description: "Temporary Hit Points from Undying Tenacity.",
         rules: [{ key: "TempHP", value: actorLevel(actor) }],
         flags: { orc: true, undyingTenacity: true },
      }),
      { slugs: ["effect-undying-tenacity"] },
   )
}

async function postRampagingTenacityReminder(actor) {
   if (!actorHasSlug(actor, "rampaging-tenacity")) return null
   await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      whisper: ownerWhispers(actor),
      content:
         "<p><strong>Rampaging Tenacity</strong></p><p>You can make a melee Strike. If that Strike reduces a foe to 0 HP, refund this Orc Tenacity use.</p>",
   })
}

async function promptOrcTenacity(actor) {
   const key = actor.uuid ?? actor.id
   if (!key || pendingPrompts.has(key)) return null
   pendingPrompts.add(key)
   try {
      const DialogV2 = foundry.applications.api.DialogV2
      if (!DialogV2?.wait) return null
      const use = await DialogV2.wait({
         window: { title: "Orc Tenacity" },
         content: `<p>${actor.name} was reduced to 0 HP. Use Orc Tenacity?</p>`,
         buttons: [
            {
               action: "yes",
               label: "Use",
               callback: () => true,
            },
            {
               action: "no",
               label: "Cancel",
               callback: () => false,
            },
         ],
         default: "yes",
      }).catch(() => false)
      if (!use) return null
      if (!(await spendAbilityCharge(actor, ["orc-tenacity"], "Orc Tenacity"))) {
         return null
      }
      await actor.setFlag(MODULE_ID, "orcTenacity.activatedAt", Date.now())
      if (hpValue(actor) <= 0) {
         await actor.update({ "system.attributes.hp.value": 1 }).catch(() => null)
      }
      await clearDownedConditions(actor)
      await applyWoundedOne(actor)
      await applyUndyingTenacity(actor)
      await postRampagingTenacityReminder(actor)
      setTimeout(() => {
         void clearDownedConditions(actor)
      }, 500)
      return true
   } finally {
      pendingPrompts.delete(key)
   }
}

function recentlyActivated(actor) {
   const timestamp = Number(actor?.getFlag?.(MODULE_ID, "orcTenacity.activatedAt"))
   return Number.isFinite(timestamp) && Date.now() - timestamp < 5000
}

export async function orcTenacity({ actor } = {}) {
   const resolved = ownedOrControlledActor(actor, "Orc")
   if (!resolved) return null
   if (!actorHasSlug(resolved, "orc-tenacity")) {
      return warn("Orc Tenacity feat not found.")
   }
   if (!(await spendAbilityCharge(resolved, ["orc-tenacity"], "Orc Tenacity"))) {
      return null
   }

   const hp = Number(resolved.system?.attributes?.hp?.value ?? 0)
   if (hp <= 0) await resolved.update({ "system.attributes.hp.value": 1 })
   await clearDownedConditions(resolved)
   await applyWoundedOne(resolved)
   await applyUndyingTenacity(resolved)
   await postRampagingTenacityReminder(resolved)
   return true
}

export async function promptOrcTenacityOnLowHp(actor, changes = {}) {
   const newHp = changedHpValue(changes)
   if (newHp === null || newHp > 0) return
   if (!actorHasSlug(actor, "orc-tenacity")) return
   if (!hasAbilityCharge(actor, ["orc-tenacity"])) return
   if (!shouldPromptHere(actor)) return
   await promptOrcTenacity(actor)
}

export async function removeDownedConditionAfterOrcTenacity(item) {
   const actor = item?.actor
   if (!actor || !canMutateActor(actor)) return
   if (!DOWNED_CONDITIONS.includes(item.slug)) return
   if (!recentlyActivated(actor)) return
   await item.delete().catch(() => null)
}
