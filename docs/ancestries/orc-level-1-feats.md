# Orc 1st-Level Ancestry Feats

Source: https://scribe.pf2.tools/v/pc8sO8Ls

## Shaman Caste

```json
{
   "key": "ActiveEffectLike",
   "mode": "upgrade",
   "path": "system.skills.occultism.rank",
   "value": 1
}
```

```json
{
   "key": "ActiveEffectLike",
   "mode": "upgrade",
   "path": "system.skills.nature.rank",
   "value": 1
}
```

```json
{
   "key": "FlatModifier",
   "selector": ["crafting", "deception", "intimidation", "medicine"],
   "type": "circumstance",
   "value": 1,
   "predicate": [
      {
         "or": [
            "self:condition:clumsy",
            "self:condition:drained",
            "self:condition:enfeebled"
         ]
      }
   ]
}
```

```json
{
   "key": "FlatModifier",
   "selector": ["athletics", "stealth", "thievery"],
   "type": "circumstance",
   "value": 1,
   "predicate": [
      {
         "or": [
            "self:condition:restrained",
            "self:condition:slowed",
            "self:condition:stupefied"
         ]
      }
   ]
}
```

```json
{
   "key": "FlatModifier",
   "selector": "saving-throw",
   "type": "circumstance",
   "value": 2,
   "predicate": [
      {
         "or": ["origin:trait:drug", "item:trait:drug"]
      }
   ]
}
```

## Warrior Caste

Automation: when the owner rolls initiative, they receive a private reminder that they can use Always Ready to Interact and draw a weapon.

## Retributor Caste

```json
{
   "key": "Resistance",
   "type": "fire",
   "value": "floor(@actor.level / 2)"
}
```

```json
{
   "itemType": "condition",
   "key": "ItemAlteration",
   "mode": "downgrade",
   "predicate": ["item:damage:type:fire"],
   "property": "pd-recovery-dc",
   "value": 10
}
```

## Maverick

```json
{
   "key": "Resistance",
   "type": "mental",
   "value": "max(1, floor(@actor.level / 2))"
}
```

```json
{
   "key": "FlatModifier",
   "selector": "saving-throw",
   "type": "circumstance",
   "value": 1,
   "predicate": ["inflicts:controlled"]
}
```

## Hunter Eyes

```json
{
   "key": "Sense",
   "selector": "low-light-vision"
}
```

If already low-light vision, upgrade to darkvision manually.

## Slave Goblin

```json
{
   "key": "ActiveEffectLike",
   "mode": "add",
   "path": "system.build.languages.granted",
   "value": {
      "slug": "goblinsk",
      "source": "{item|name}"
   },
   "predicate": [
      {
         "not": "berserkers-tradition"
      }
   ]
}
```

```json
{
   "key": "FlatModifier",
   "selector": ["intimidation", "diplomacy", "cha-based"],
   "type": "circumstance",
   "value": 1,
   "predicate": ["berserkers-tradition", "target:trait:goblin"]
}
```

```json
{
   "key": "GrantItem",
   "uuid": "Compendium.pf2e.feats-srd.Item.6yPrvbSDaa8glLjn",
   "flag": "pet"
}
```

Goblin pet variant details are manual.

## Alert Sleep

Effect: Alert Sleep.

```json
{
   "key": "AdjustModifier",
   "selector": "ac",
   "slug": "unconscious",
   "suppress": true,
   "predicate": ["self:condition:unconscious"]
}
```

```json
{
   "key": "AdjustModifier",
   "selector": "perception",
   "slug": "unconscious",
   "suppress": true,
   "predicate": ["self:condition:unconscious"]
}
```

```json
{
   "key": "AdjustModifier",
   "selector": "reflex",
   "slug": "unconscious",
   "suppress": true,
   "predicate": ["self:condition:unconscious"]
}
```

## Orc Lore

```json
{
   "key": "ActiveEffectLike",
   "mode": "upgrade",
   "path": "system.skills.athletics.rank",
   "value": 1
}
```

```json
{
   "key": "ActiveEffectLike",
   "mode": "upgrade",
   "path": "system.skills.survival.rank",
   "value": 1
}
```

```json
{
   "key": "GrantItem",
   "uuid": "Compendium.pf2e.feats-srd.Item.BocFD2KV0qgUC76x",
   "flag": "additionalLoreOrc"
}
```

## Orc Superstition

```json
{
   "domain": "all",
   "key": "RollOption",
   "option": "orc-superstition",
   "toggleable": true
}
```

```json
{
   "key": "FlatModifier",
   "selector": "saving-throw",
   "type": "circumstance",
   "value": 1,
   "predicate": [
      "orc-superstition",
      {
         "or": ["arcane", "divine", "primal", "occult", "magical"]
      }
   ]
}
```

## Orc Weapon Familiarity

```json
{
   "key": "MartialProficiency",
   "slug": "orc-weapon-familiarity-martial",
   "definition": [
      "item:category:martial",
      {
         "or": [
            "item:trait:orc",
            "item:base:longbow",
            "item:base:composite-longbow",
            "item:base:shortbow",
            "item:base:composite-shortbow",
            "item:base:battle-axe",
            "item:base:falchion",
            "item:base:warhammer",
            "item:base:maul",
            "item:base:claw-blade",
            "item:base:scizore",
            "item:base:dandpatta"
         ]
      }
   ],
   "sameAs": "simple"
}
```

```json
{
   "key": "MartialProficiency",
   "slug": "orc-weapon-familiarity-advanced",
   "definition": [
      "item:category:advanced",
      {
         "or": [
            "item:trait:orc",
            "item:base:longbow",
            "item:base:composite-longbow",
            "item:base:shortbow",
            "item:base:composite-shortbow",
            "item:base:battle-axe",
            "item:base:falchion",
            "item:base:warhammer",
            "item:base:maul",
            "item:base:claw-blade",
            "item:base:scizore",
            "item:base:dandpatta"
         ]
      }
   ],
   "sameAs": "martial"
}
```

```json
{
   "key": "CriticalSpecialization",
   "predicate": [
      {
         "gte": ["self:level", 5]
      },
      {
         "or": [
            "item:trait:orc",
            "item:base:longbow",
            "item:base:composite-longbow",
            "item:base:shortbow",
            "item:base:composite-shortbow",
            "item:base:battle-axe",
            "item:base:falchion",
            "item:base:warhammer",
            "item:base:maul",
            "item:base:claw-blade",
            "item:base:scizore",
            "item:base:dandpatta"
         ]
      }
   ]
}
```

## Competitive Spirit

Macro:

```js
game.modules
   .get("pf2e-sarnout-chronicles")
   .api.ancestries.orc.competitiveSpirit()
```

## Snooze

Macro:

```js
game.modules.get("pf2e-sarnout-chronicles").api.ancestries.orc.snooze()
```

## Spirit Vessel

Automation: when this feat is added, the module creates the Spirit Vessel equipment item and Spiritual Health ability. The passive disease/poison save benefit is on the Spirit Vessel item and works only while the vessel is carried.

## Beast Trainer

```json
{
   "key": "ActiveEffectLike",
   "mode": "upgrade",
   "path": "system.skills.nature.rank",
   "value": 1
}
```

```json
{
   "key": "GrantItem",
   "uuid": "Compendium.pf2e.feats-srd.Item.dZDmWXzZfIoBJ53Q",
   "flag": "tameAnimal"
}
```

```json
{
   "key": "FlatModifier",
   "selector": ["diplomacy", "deception", "intimidation"],
   "type": "circumstance",
   "value": 1,
   "predicate": [
      {
         "or": ["target:trait:animal", "target:trait:beast"]
      }
   ]
}
```

## Shamanic Practice

Manual.

## Orc Tenacity

Automation: when reduced to 0 HP, the owner is prompted to use Orc Tenacity. On use, the charge is spent, HP becomes 1, downed conditions are removed, and Wounded 1 is applied.
