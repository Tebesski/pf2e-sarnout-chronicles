# Hadaganian 13th-Level Ancestry Feats

Source: https://scribe.pf2.tools/v/2ljQwst3

## Imposing Rights

```json
{
  "key": "RollOption",
  "domain": "all",
  "option": "imposing-rights",
  "label": "Imposing Rights: non-Imperial sentient creature",
  "toggleable": true
}
```

```json
{
  "key": "FlatModifier",
  "selector": ["strike-damage", "perception", "deception", "diplomacy", "intimidation"],
  "type": "circumstance",
  "value": 1,
  "predicate": ["imposing-rights"]
}
```

## Heroic Gift

Manual.

## Citizen Decency

Manual.

## Bounce Back

Automatic: prompts when Dying is removed.

## Imperial Phalanx

Manual.

## Clever Adaptation

```json
{
  "key": "FlatModifier",
  "selector": "initiative",
  "type": "circumstance",
  "value": 2,
  "predicate": [
    "check:type:initiative",
    {
      "not": "perception"
    }
  ]
}
```

```json
{
  "key": "Note",
  "selector": "skill-check",
  "outcome": ["criticalSuccess"],
  "title": "Clever Adaptation",
  "text": "You can spend your reaction to perform another 1-action use of this skill or Stride half your Speed."
}
```

## Advanced Imperial Training

```json
{
  "key": "ChoiceSet",
  "flag": "advancedImperialTrainingGeneralFeat",
  "adjustName": false,
  "choices": {
    "filter": [
      "item:trait:general",
      {
        "lte": ["item:level", 7]
      }
    ],
    "itemType": "feat"
  },
  "prompt": "Choose a general feat of 7th level or lower"
}
```

```json
{
  "key": "GrantItem",
  "uuid": "{item|flags.pf2e.rulesSelections.advancedImperialTrainingGeneralFeat}",
  "flag": "advancedImperialTrainingGeneralFeat",
  "allowDuplicate": true
}
```
