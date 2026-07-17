# Hadaganian 5th-Level Ancestry Feats

Source: https://scribe.pf2.tools/v/2ljQwst3

## Bold Idea

```js
game.modules.get("pf2e-sarnout-chronicles").api.ancestries.hadaganian.boldIdea()
```

## Common Cause

```json
{
  "key": "RollOption",
  "domain": "all",
  "option": "common-cause",
  "label": "Common Cause: aiding an Imperial citizen",
  "toggleable": true
}
```

```json
{
  "key": "FlatModifier",
  "selector": "skill-check",
  "type": "circumstance",
  "value": 4,
  "predicate": ["common-cause", "action:aid"]
}
```

```json
{
  "key": "FlatModifier",
  "selector": "attack-roll",
  "type": "circumstance",
  "value": 4,
  "predicate": ["common-cause", "action:aid"]
}
```

```json
{
  "key": "AdjustDegreeOfSuccess",
  "selector": "skill-check",
  "adjustment": {
    "criticalFailure": "to-failure"
  },
  "predicate": ["common-cause", "action:aid"]
}
```

```json
{
  "key": "AdjustDegreeOfSuccess",
  "selector": "attack-roll",
  "adjustment": {
    "criticalFailure": "to-failure"
  },
  "predicate": ["common-cause", "action:aid"]
}
```

## Cooperative Nature

```json
{
  "key": "FlatModifier",
  "selector": "skill-check",
  "type": "circumstance",
  "value": 4,
  "predicate": ["action:aid"]
}
```

```json
{
  "key": "FlatModifier",
  "selector": "attack-roll",
  "type": "circumstance",
  "value": 4,
  "predicate": ["action:aid"]
}
```

## For the Empire's Sake!

```json
{
  "key": "RollOption",
  "domain": "diplomacy",
  "option": "for-the-empires-sake",
  "label": "For the Empire's Sake!",
  "toggleable": true
}
```

```json
{
  "key": "FlatModifier",
  "selector": "diplomacy",
  "type": "circumstance",
  "value": 4,
  "predicate": ["for-the-empires-sake"]
}
```

## Hadaganian Acumen

```json
{
  "key": "GrantItem",
  "uuid": "Compendium.pf2e.feats-srd.Item.h9jGaBxLUtevZYcZO",
  "flag": "untrainedImprovisation"
}
```

```json
{
  "key": "Note",
  "selector": "skill-check",
  "title": "Hadaganian Acumen",
  "text": "You can attempt skill actions that normally require you to be trained, even if you are untrained."
}
```

## Imperial Formation

Automatic: applies the effect while adjacent to at least two allies.

## For Motherland!

Automatic: modifies Citizen's Perseverance.

## Citizen's Spell

Manual.

## Sense Comrades

```json
{
  "key": "Note",
  "selector": "perception",
  "title": "Sense Comrades",
  "text": "Willing allies within 60 feet that would otherwise be undetected by you are hidden instead. The flat check to target such hidden allies is 5 instead of 11."
}
```
