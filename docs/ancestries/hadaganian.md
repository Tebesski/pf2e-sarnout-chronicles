# Hadaganian

Source: https://scribe.pf2.tools/v/2ljQwst3

The module registers and auto-applies the `hadaganian` trait.

## Remember Your Duty

```json
{
  "key": "Note",
  "selector": "skill-check",
  "outcome": ["criticalFailure"],
  "title": "Remember Your Duty",
  "text": "If this critical failure directly contributes to defending the Empire, upholding its laws, or proving your loyalty, you can use Remember Your Duty to turn it into a failure. Frequency: once per hour. Trait: fortune."
}
```

```json
{
  "key": "Note",
  "selector": "saving-throw",
  "outcome": ["criticalFailure"],
  "title": "Remember Your Duty",
  "text": "If this critical failure directly contributes to defending the Empire, upholding its laws, or proving your loyalty, you can use Remember Your Duty to turn it into a failure. Frequency: once per hour. Trait: fortune."
}
```

```json
{
  "key": "Note",
  "selector": "attack-roll",
  "outcome": ["criticalFailure"],
  "title": "Remember Your Duty",
  "text": "If this critical failure directly contributes to defending the Empire, upholding its laws, or proving your loyalty, you can use Remember Your Duty to turn it into a failure. Frequency: once per hour. Trait: fortune."
}
```

## Salt Blood of Hadagan

```js
const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
await game.modules
  .get("pf2e-sarnout-chronicles")
  ?.api?.ancestries?.hadaganian?.saltBloodOfHadagan({ actor });
```

## Alchemical Combine Monotown

```json
{
  "key": "FlatModifier",
  "selector": "saving-throw",
  "type": "circumstance",
  "value": 1,
  "predicate": ["item:trait:alchemical"]
}
```

```json
{
  "key": "Resistance",
  "type": "custom",
  "label": "Alchemical Combine Monotown",
  "value": "max(1,floor(@actor.level / 2))",
  "definition": ["item:trait:alchemical"]
}
```

```json
{
  "key": "GrantItem",
  "uuid": "Compendium.pf2e.feats-srd.Item.BocFD2KV0qgUC76x",
  "flag": "additionalLoreAlchemy",
  "allowDuplicate": true
}
```

## Mining Monotown

```json
{
  "key": "Sense",
  "selector": "low-light-vision"
}
```

```json
{
  "key": "Note",
  "selector": "land-speed",
  "title": "Mining Monotown",
  "text": "Ignore difficult terrain caused by rubble, uneven stone, or earth ground."
}
```

## Steelworks Monotown

```json
{
  "key": "Resistance",
  "type": "fire",
  "value": "max(1,floor(@actor.level / 2))"
}
```

```json
{
  "key": "Note",
  "selector": "saving-throw",
  "title": "Steelworks Monotown",
  "text": "Treat environmental heat as one step less extreme."
}
```

## Mana-Working Industry Monotown

```json
{
  "key": "Note",
  "selector": "saving-throw",
  "title": "Mana-Working Industry Monotown",
  "text": "Treat environmental mana-radiation as one step less extreme."
}
```

```json
{
  "key": "GrantItem",
  "uuid": "Compendium.pf2e.feats-srd.Item.BocFD2KV0qgUC76x",
  "flag": "additionalLoreManaTech",
  "allowDuplicate": true
}
```

## Astral Shipyard Monotown

```json
{
  "key": "RollOption",
  "domain": "all",
  "option": "astral-shipyard-monotown",
  "label": "Astral Shipyard Monotown",
  "toggleable": true
}
```

```json
{
  "key": "FlatModifier",
  "selector": ["athletics", "acrobatics", "crafting"],
  "type": "circumstance",
  "value": 2,
  "predicate": [
    "astral-shipyard-monotown",
    {
      "or": ["action:force-open", "action:climb", "action:balance", "action:repair"]
    }
  ]
}
```

```json
{
  "key": "AdjustDegreeOfSuccess",
  "selector": ["athletics", "acrobatics", "crafting"],
  "adjustment": {
    "criticalFailure": "one-degree-better"
  },
  "predicate": [
    "astral-shipyard-monotown",
    {
      "or": ["action:force-open", "action:climb", "action:balance", "action:repair"]
    }
  ]
}
```

```json
{
  "key": "GrantItem",
  "uuid": "Compendium.pf2e.feats-srd.Item.BocFD2KV0qgUC76x",
  "flag": "additionalLoreAstralShips",
  "allowDuplicate": true
}
```

## Wood Industry Monotown

```json
{
  "key": "MartialProficiency",
  "slug": "wood-industry-monotown-martial-axes",
  "definition": ["item:group:axe", "item:category:martial"],
  "sameAs": "simple"
}
```

```json
{
  "key": "MartialProficiency",
  "slug": "wood-industry-monotown-advanced-axes",
  "definition": ["item:group:axe", "item:category:advanced"],
  "sameAs": "martial"
}
```

```json
{
  "key": "GrantItem",
  "uuid": "Compendium.pf2e.feats-srd.Item.BocFD2KV0qgUC76x",
  "flag": "additionalLoreForest",
  "allowDuplicate": true
}
```

## Agriculture Industry Monotown

```json
{
  "key": "FlatModifier",
  "selector": "saving-throw",
  "type": "circumstance",
  "value": 1,
  "predicate": [
    {
      "or": ["item:trait:inhaled", "item:trait:ingested"]
    }
  ]
}
```

```json
{
  "key": "GrantItem",
  "uuid": "Compendium.pf2e.feats-srd.Item.BocFD2KV0qgUC76x",
  "flag": "additionalLoreHerbalism",
  "allowDuplicate": true
}
```

```json
{
  "key": "GrantItem",
  "uuid": "Compendium.pf2e.feats-srd.Item.BocFD2KV0qgUC76x",
  "flag": "additionalLoreCooking",
  "allowDuplicate": true
}
```

Seasoned: add `GrantItem` after UUID is confirmed.

## Munitions Industry Monotown

```json
{
  "key": "RollOption",
  "domain": "skill-check",
  "option": "munitions-industry-monotown",
  "label": "Munitions Industry Monotown",
  "toggleable": true
}
```

```json
{
  "key": "FlatModifier",
  "selector": "skill-check",
  "type": "circumstance",
  "value": 2,
  "predicate": ["munitions-industry-monotown"]
}
```

```json
{
  "key": "GrantItem",
  "uuid": "Compendium.pf2e.feats-srd.Item.BocFD2KV0qgUC76x",
  "flag": "additionalLoreArtillery",
  "allowDuplicate": true
}
```

## Combat Vehicles Industry Monotown

```json
{
  "key": "RollOption",
  "domain": "skill-check",
  "option": "combat-vehicles-industry-monotown",
  "label": "Combat Vehicles Industry Monotown",
  "toggleable": true
}
```

```json
{
  "key": "FlatModifier",
  "selector": "skill-check",
  "type": "circumstance",
  "value": 2,
  "predicate": ["combat-vehicles-industry-monotown"]
}
```

```json
{
  "key": "GrantItem",
  "uuid": "Compendium.pf2e.feats-srd.Item.BocFD2KV0qgUC76x",
  "flag": "additionalLoreCombatVehicles",
  "allowDuplicate": true
}
```

## Metropolis Dweller

```json
{
  "key": "ChoiceSet",
  "flag": "metropolisSkill",
  "choices": "CONFIG.PF2E.skills",
  "prompt": "Choose a skill for Metropolis Dweller"
}
```

```json
{
  "key": "ActiveEffectLike",
  "mode": "upgrade",
  "path": "system.skills.{item|flags.pf2e.rulesSelections.metropolisSkill}.rank",
  "value": 1
}
```

```json
{
  "key": "ActiveEffectLike",
  "mode": "upgrade",
  "path": "system.skills.{item|flags.pf2e.rulesSelections.metropolisSkill}.rank",
  "value": 2,
  "predicate": [
    {
      "gte": ["self:level", 5]
    }
  ]
}
```

## Ever-Ready Citizen

```json
{
  "key": "ChoiceSet",
  "flag": "generalFeat",
  "adjustName": false,
  "choices": {
    "filter": ["item:level:1", "item:trait:general"],
    "itemType": "feat"
  },
  "prompt": "Choose a 1st-level general feat"
}
```

```json
{
  "key": "GrantItem",
  "uuid": "{item|flags.pf2e.rulesSelections.generalFeat}",
  "flag": "everReadyCitizen"
}
```

## True Child of the Empire

Manual branch: Sorcerer Dedication with Imperial bloodline, or a 1st-level Sorcerer feat if already Sorcerer.

## Free from Influence

```json
{
  "key": "ActiveEffectLike",
  "mode": "add",
  "path": "system.build.languages.max",
  "value": 1
}
```

```json
{
  "key": "ChoiceSet",
  "flag": "freeFromInfluenceSkill",
  "choices": "CONFIG.PF2E.skills",
  "prompt": "Choose a trained skill"
}
```

```json
{
  "key": "ActiveEffectLike",
  "mode": "upgrade",
  "path": "system.skills.{item|flags.pf2e.rulesSelections.freeFromInfluenceSkill}.rank",
  "value": 1
}
```

```json
{
  "key": "ChoiceSet",
  "flag": "freeFromInfluenceGeneralFeat",
  "adjustName": false,
  "choices": {
    "filter": ["item:level:1", "item:trait:general"],
    "itemType": "feat"
  },
  "prompt": "Choose a 1st-level general feat"
}
```

```json
{
  "key": "GrantItem",
  "uuid": "{item|flags.pf2e.rulesSelections.freeFromInfluenceGeneralFeat}",
  "flag": "freeFromInfluenceGeneralFeat"
}
```
