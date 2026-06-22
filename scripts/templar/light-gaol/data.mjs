import { MODULE_ID, TEMPLAR_ASSETS } from "../constants.mjs"

export const LIGHT_GAOL_ACCESS_SLUG = "effect-blinding-blade-access"
export const LIGHT_GAOL_ACTION_SLUG = "blinding-blade"
export const LIGHT_GAOL_OWNER_SLUG = "effect-light-gaol"
export const LIGHT_GAOL_TARGET_SLUG = "effect-light-gaol-target"
export const LIGHT_GAOL_BLINDING_EFFECT_SLUG = "effect-blinding-blade"
export const LIGHT_GAOL_BLINDING_ICON = TEMPLAR_ASSETS.blinding

export function lightGaolConditionUuid(slug, fallbackUuid) {
   const condition = game.pf2e?.ConditionManager?.getCondition?.(slug)
   return condition?.uuid ?? condition?.sourceId ?? fallbackUuid
}

export function lightGaolAccessEffectData() {
   return {
      name: "Effect: Blinding Blade Access",
      type: "effect",
      img: LIGHT_GAOL_BLINDING_ICON,
      system: {
         slug: LIGHT_GAOL_ACCESS_SLUG,
         duration: { value: 1, unit: "minutes", expiry: "turn-start" },
         description: {
            value: "You are within or adjacent to the Light Gaol and have access to the Blinding Blade action.",
         },
      },
   }
}

export function lightGaolBlindingActionData(spellDc) {
   return {
      name: "Blinding Blade",
      type: "action",
      img: LIGHT_GAOL_BLINDING_ICON,
      system: {
         slug: LIGHT_GAOL_ACTION_SLUG,
         actionType: { value: "action" },
         actions: { value: 1 },
         traits: { value: ["concentrate", "manipulate"] },
         frequency: { max: 1, per: "round" },
         requirements: {
            value: "You are wielding a steel weapon and do not have the restricted condition.",
         },
         description: {
            value: `<p>Make a melee Strike. If you hit, target the struck creature and roll its save.</p><p><a class="content-link" data-templar-blinding-blade-save data-dc="${spellDc}"><i class="fa-solid fa-dice-d20"></i> Reflex Save</a></p><p>Failure: Blinded for 1 round. Critical Failure: Blinded for 2 rounds.</p>`,
         },
      },
      flags: {
         [MODULE_ID]: {
            lightGaolAction: true,
            automatedTemplarAction: "blindingBlade",
         },
      },
   }
}

export function lightGaolTargetEffectData() {
   const dazzledUuid = lightGaolConditionUuid(
      "dazzled",
      "Compendium.pf2e.conditionitems.Item.TkIyaNPgTZFBCCuh",
   )
   const blindedUuid = lightGaolConditionUuid(
      "blinded",
      "Compendium.pf2e.conditionitems.Item.XgEqL1kFApUbl5Z2",
   )
   return {
      name: "Effect: Light Gaol",
      type: "effect",
      img: TEMPLAR_ASSETS.gaol,
      system: {
         slug: LIGHT_GAOL_TARGET_SLUG,
         duration: { value: 1, unit: "minutes", expiry: "turn-start" },
         description: { value: "You are adjacent to a Light Gaol wall." },
         rules: [
            {
               key: "GrantItem",
               uuid: dazzledUuid,
               predicate: [{ not: "self:trait:unholy" }],
            },
            {
               key: "GrantItem",
               uuid: blindedUuid,
               predicate: ["self:trait:unholy"],
            },
         ],
      },
   }
}

export function lightGaolBlindingEffectData(durationValue) {
   const blindedUuid = lightGaolConditionUuid(
      "blinded",
      "Compendium.pf2e.conditionitems.Item.XgEqL1kFApUbl5Z2",
   )
   return {
      name: "Effect: Blinding Blade",
      type: "effect",
      img: LIGHT_GAOL_BLINDING_ICON,
      system: {
         slug: LIGHT_GAOL_BLINDING_EFFECT_SLUG,
         duration: {
            value: durationValue,
            unit: "rounds",
            expiry: "turn-start",
         },
         description: { value: "You are blinded by the Blinding Blade." },
         rules: [{ key: "GrantItem", uuid: blindedUuid }],
      },
   }
}
