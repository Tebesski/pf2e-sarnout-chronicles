# Orc 9th-Level Ancestry Feats

Source: https://scribe.pf2.tools/v/pc8sO8Ls

## Death's Drum

```json
{
   "key": "FlatModifier",
   "selector": "fortitude",
   "type": "circumstance",
   "value": 2,
   "predicate": [
      {
         "or": ["self:condition:persistent-damage", "self:condition:wounded"]
      }
   ]
}
```

## Pervasive Superstition

```json
{
   "key": "FlatModifier",
   "selector": "saving-throw",
   "type": "circumstance",
   "value": 1,
   "predicate": [
      {
         "or": [
            "origin:trait:magical",
            "origin:trait:spell",
            "item:trait:magical",
            "item:trait:spell"
         ]
      }
   ]
}
```

## Undying Tenacity

Automatic: modifies Orc Tenacity to grant temporary HP equal to level.

## Fierce Competitor

```js
game.modules.get("pf2e-sarnout-chronicles").api.ancestries.orc.fierceCompetitor()
```

Victory bonus:

```js
game.modules
   .get("pf2e-sarnout-chronicles")
   .api.ancestries.orc.fierceCompetitorVictory()
```

## Stubborn Defiance

```json
{
   "key": "FlatModifier",
   "selector": "saving-throw",
   "type": "status",
   "value": 1,
   "predicate": [
      {
         "or": ["origin:trait:mental", "item:trait:mental"]
      }
   ]
}
```

Automation: failed saves against controlled effects send a private reminder.

```js
game.modules.get("pf2e-sarnout-chronicles").api.ancestries.orc.stubbornDefiance()
```

## Orc Ways

```js
game.modules.get("pf2e-sarnout-chronicles").api.ancestries.orc.orcWays()
```

## Eager Combatant

Automation: initiative rolls send a private movement reminder.

## Greater Vessel

Automation: when added, choose one eligible Spirit Vessel boon. Spell boons are granted as primal innate spells.

## Pride in Arms

```js
game.modules.get("pf2e-sarnout-chronicles").api.ancestries.orc.prideInArms()
```

## Clan Secrets

Automatic: grants `show the way` as an innate primal spell, heightened to rank 6 at level 13.
