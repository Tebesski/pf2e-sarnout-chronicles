# Orc 5th-Level Ancestry Feats

Source: https://scribe.pf2.tools/v/pc8sO8Ls

## Intimidating Encouragement

Macro:

```js
game.modules
   .get("pf2e-sarnout-chronicles")
   .api.ancestries.orc.intimidatingEncouragement()
```

## Spirit Imbuing Ritual

Macro:

```js
game.modules
   .get("pf2e-sarnout-chronicles")
   .api.ancestries.orc.spiritImbuingRitual()
```

## Hunter's Defense

Macro:

```js
game.modules.get("pf2e-sarnout-chronicles").api.ancestries.orc.hunterDefense()
```

## Survival of the Fittest

```json
{
   "key": "Note",
   "selector": "athletics",
   "outcome": ["criticalFailure"],
   "title": "Survival of the Fittest",
   "text": "You can reroll this critical failure and must use the second result.",
   "predicate": [
      {
         "or": [
            "action:leap",
            "action:climb",
            "action:grab-an-edge",
            "action:swim"
         ]
      }
   ]
}
```

## Rending Tusks

```json
{
   "key": "DamageAlteration",
   "selectors": ["tusks-damage"],
   "slug": "base",
   "mode": "upgrade",
   "property": "dice-faces",
   "value": 8
}
```

```json
{
   "key": "DamageDice",
   "selector": "tusks-damage",
   "diceNumber": 1,
   "dieSize": "d4",
   "damageType": "bleed",
   "category": "persistent",
   "critical": true
}
```

## Metabolic Recovery

```json
{
   "itemType": "condition",
   "key": "ItemAlteration",
   "mode": "downgrade",
   "predicate": [
      {
         "or": ["item:damage:type:bleed", "item:damage:type:poison"]
      }
   ],
   "property": "pd-recovery-dc",
   "value": 10
}
```

## Nature's Anchor

Macro:

```js
game.modules.get("pf2e-sarnout-chronicles").api.ancestries.orc.naturesAnchor()
```

## Defy Death

```json
{
   "key": "ActiveEffectLike",
   "mode": "subtract",
   "path": "system.attributes.dying.recoveryDC",
   "value": 1
}
```

Temporary resurrection debilitation is manual.

## Blood Frenzy

Macro:

```js
game.modules.get("pf2e-sarnout-chronicles").api.ancestries.orc.bloodFrenzy()
```

## Victorious Vigor

Macro:

```js
game.modules.get("pf2e-sarnout-chronicles").api.ancestries.orc.victoriousVigor()
```

## Fearless

```json
{
   "key": "FlatModifier",
   "selector": "saving-throw",
   "type": "circumstance",
   "value": 1,
   "predicate": [
      {
         "or": ["origin:trait:fear", "item:trait:fear"]
      }
   ]
}
```

```json
{
   "key": "FlatModifier",
   "selector": "will-dc",
   "type": "circumstance",
   "value": 2,
   "predicate": ["action:demoralize"]
}
```

## That's How You Roar!

Automation: when a Demoralize roll against the owner fails or critically fails, the owner receives a private reaction reminder.

## Infused Vessel

Automation: when this feat is added, choose one eligible Spirit Vessel boon. The module updates the Spirit Vessel item and creates the matching action.

Absorb Strength:

```js
game.modules
   .get("pf2e-sarnout-chronicles")
   .api.ancestries.orc.infusedVesselAbsorbStrength()
```

Deflecting Spirit:

```js
game.modules
   .get("pf2e-sarnout-chronicles")
   .api.ancestries.orc.infusedVesselDeflectingSpirit()
```

Fleet Spirit:

```js
game.modules
   .get("pf2e-sarnout-chronicles")
   .api.ancestries.orc.infusedVesselFleetSpirit()
```

Use action items with matching slugs for charge tracking: `absorb-strength`, `deflecting-spirit`, `fleet-spirit`.

## Retributor's Edge

Macro:

```js
game.modules.get("pf2e-sarnout-chronicles").api.ancestries.orc.retributorsEdge()
```
