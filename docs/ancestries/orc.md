# Orc

Source: https://scribe.pf2.tools/v/pc8sO8Ls

The module uses PF2e's built-in `orc` trait and auto-applies it to matching Orc features, heritages, feats, and actions. The module registers the `caste` feat trait.

## Sex

```json
{
  "key": "ChoiceSet",
  "flag": "sex",
  "adjustName": false,
  "rollOption": "orc-sex",
  "choices": [
    {
      "label": "Male",
      "value": "male"
    },
    {
      "label": "Female",
      "value": "female"
    }
  ],
  "prompt": "Choose male or female"
}
```

## Arcane Disconnection

Manual restriction: no occult or arcane magic access.

## Tusks

```json
{
  "key": "Strike",
  "label": "Tusks",
  "slug": "tusks",
  "category": "unarmed",
  "baseType": "jaws",
  "group": "brawling",
  "traits": ["finesse", "unarmed"],
  "predicate": ["orc-sex:male"],
  "damage": {
    "base": {
      "dice": 1,
      "die": "d6",
      "damageType": "piercing"
    }
  }
}
```

## Quick Metabolism

```json
{
  "key": "GrantItem",
  "uuid": "Compendium.pf2e.feats-srd.Item.N8Xz5fuW6o7GW124",
  "flag": "sscOrcFastRecovery"
}
```

```json
{
  "itemType": "condition",
  "key": "ItemAlteration",
  "mode": "downgrade",
  "predicate": [
    {
      "or": [
        "item:damage:category:energy",
        "item:damage:category:physical",
        "item:damage:type:poison"
      ]
    }
  ],
  "property": "pd-recovery-dc",
  "value": 13
}
```

Male drawback: pf2e-dailies integration adds an optional daily row that consumes the second ration when the module is active.

## Bovvers' Tradition

```json
{
  "key": "ChoiceSet",
  "flag": "bovversClassFeat",
  "adjustName": false,
  "choices": {
    "filter": ["item:level:1", "item:category:class"],
    "itemType": "feat"
  },
  "prompt": "Choose a 1st-level class feat"
}
```

```json
{
  "key": "GrantItem",
  "uuid": "{item|flags.pf2e.rulesSelections.bovversClassFeat}",
  "flag": "bovversClassFeat"
}
```

## Bloodthirsters' Tradition

```json
{
  "key": "GrantItem",
  "uuid": "Compendium.pf2e.feats-srd.Item.AfreuohzCrdqJdRt",
  "flag": "werecreatureDedication"
}
```

Automation: Werecreature Dedication can be dropped into ancestry and Ancestral Paragon feat slots; the owned copy is normalized to ancestry category during insertion.

## Berserkers' Tradition

```json
{
  "key": "RollOption",
  "domain": "all",
  "option": "berserkers-tradition"
}
```

```json
{
  "key": "ActiveEffectLike",
  "mode": "upgrade",
  "path": "system.skills.intimidation.rank",
  "value": 1
}
```

```json
{
  "key": "GrantItem",
  "uuid": "Compendium.pf2e.feats-srd.Item.ar2DUlvDK4LDcH9J",
  "flag": "quickCoercion"
}
```

```json
{
  "key": "AdjustDegreeOfSuccess",
  "selector": "intimidation",
  "adjustment": {
    "success": "one-degree-better",
    "criticalFailure": "one-degree-better"
  },
  "predicate": ["action:coerce", "target:trait:goblin"]
}
```

```json
{
  "key": "FlatModifier",
  "selector": "strike-attack-roll",
  "type": "circumstance",
  "value": 1,
  "predicate": [
    "target:trait:goblin",
    {
      "or": ["item:group:flail", "item:group:whip"]
    }
  ]
}
```

```json
{
  "key": "FlatModifier",
  "selector": "strike-damage",
  "type": "circumstance",
  "value": 1,
  "predicate": [
    "target:trait:goblin",
    {
      "or": ["item:group:flail", "item:group:whip"]
    }
  ]
}
```

Lethality mode switching is manual.

## Righteous' Tradition

```json
{
  "key": "ActiveEffectLike",
  "mode": "upgrade",
  "path": "system.skills.religion.rank",
  "value": 1
}
```

Attribute changes and divine innate cantrip are manual.

## Nomadic Tradition

```json
{
  "key": "Sense",
  "selector": "low-light-vision"
}
```

Armor sleep and Hustle benefits are manual.

## Metropolitan Orc

```json
{
  "key": "ActiveEffectLike",
  "mode": "upgrade",
  "path": "system.skills.society.rank",
  "value": 1
}
```

```json
{
  "key": "GrantItem",
  "uuid": "Compendium.pf2e.feats-srd.Item.ihN8gkHSdPG9Trte",
  "flag": "adoptedAncestry"
}
```

Attribute changes and Adopted Ancestry restriction are manual.
