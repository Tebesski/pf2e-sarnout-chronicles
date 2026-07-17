# Hadaganian 1st-Level Ancestry Feats

Source: https://scribe.pf2.tools/v/2ljQwst3

## Imperial Training

```json
{
  "key": "ChoiceSet",
  "flag": "imperialTrainingFeat",
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
  "uuid": "{item|flags.pf2e.rulesSelections.imperialTrainingFeat}",
  "flag": "imperialTrainingFeat",
  "allowDuplicate": true
}
```

## Display of Virtue

Macro:

```js
game.modules.get("pf2e-sarnout-chronicles").api.ancestries.hadaganian.displayOfVirtue()
```

```json
{
  "key": "Note",
  "selector": "saving-throw",
  "predicate": ["item:trait:emotion"],
  "title": "Display of Virtue",
  "text": "If this emotion effect affects you, you can use Display of Virtue to hide the effect from hostile observers."
}
```

## Empire's Will

```json
{
  "key": "RollOption",
  "domain": "saving-throw",
  "option": "empires-will",
  "label": "Empire's Will",
  "toggleable": true
}
```

```json
{
  "key": "AdjustDegreeOfSuccess",
  "selector": "saving-throw",
  "adjustment": {
    "success": "one-degree-better"
  },
  "predicate": ["empires-will", "item:trait:mental"]
}
```

```json
{
  "key": "Note",
  "selector": "will-dc",
  "title": "Empire's Will",
  "text": "If a creature fails a Coerce check against you, it critically fails instead."
}
```

## Hadaganian Cunning

```json
{
  "key": "ChoiceSet",
  "flag": "hadaganianCunningSkillOne",
  "choices": "CONFIG.PF2E.skills",
  "prompt": "Choose a trained skill"
}
```

```json
{
  "key": "ActiveEffectLike",
  "mode": "upgrade",
  "path": "system.skills.{item|flags.pf2e.rulesSelections.hadaganianCunningSkillOne}.rank",
  "value": 1
}
```

```json
{
  "key": "ChoiceSet",
  "flag": "hadaganianCunningSkillTwo",
  "choices": "CONFIG.PF2E.skills",
  "prompt": "Choose a second trained skill"
}
```

```json
{
  "key": "ActiveEffectLike",
  "mode": "upgrade",
  "path": "system.skills.{item|flags.pf2e.rulesSelections.hadaganianCunningSkillTwo}.rank",
  "value": 1
}
```

## Unconventional Weaponry

Automatic: when the feat is added to an actor, the module prompts for the item base name and writes the needed rule elements onto the feat.

## Nezeb's Path

Macro:

```js
game.modules.get("pf2e-sarnout-chronicles").api.ancestries.hadaganian.nezebsPath()
```

```json
{
  "key": "RollOption",
  "domain": "skill-check",
  "option": "nezebs-path-recall-feat",
  "label": "Recall Feat",
  "toggleable": true
}
```

```json
{
  "key": "FlatModifier",
  "selector": "skill-check",
  "type": "circumstance",
  "value": 1,
  "predicate": ["nezebs-path-recall-feat"]
}
```

## Citizen's Perseverance

Macro:

```js
game.modules.get("pf2e-sarnout-chronicles").api.ancestries.hadaganian.citizensPerseverance()
```

Effect rule elements:

```json
{
  "key": "FlatModifier",
  "selector": "will",
  "type": "circumstance",
  "value": 1,
  "predicate": ["item:trait:fear"]
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

## Cosmopolitan

```json
{
  "key": "ChoiceSet",
  "flag": "cosmopolitanSkill",
  "choices": "CONFIG.PF2E.skills",
  "prompt": "Choose Society, or another trained skill if already trained in Society"
}
```

```json
{
  "key": "ActiveEffectLike",
  "mode": "upgrade",
  "path": "system.skills.{item|flags.pf2e.rulesSelections.cosmopolitanSkill}.rank",
  "value": 1
}
```

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
  "key": "RollOption",
  "domain": "society",
  "option": "cosmopolitan-customs",
  "label": "Cosmopolitan: customs",
  "toggleable": true
}
```

```json
{
  "key": "FlatModifier",
  "selector": "society",
  "type": "circumstance",
  "value": 1,
  "predicate": ["cosmopolitan-customs"]
}
```

```json
{
  "key": "RollOption",
  "domain": "diplomacy",
  "option": "cosmopolitan-non-human",
  "label": "Cosmopolitan: non-human sentient creature",
  "toggleable": true
}
```

```json
{
  "key": "FlatModifier",
  "selector": "diplomacy",
  "type": "circumstance",
  "value": 1,
  "predicate": ["cosmopolitan-non-human"]
}
```

## Exemplar Imperial

Automatic module automation:

On a qualifying critical success, eligible allied actors on the active scene gain the matching Exemplar Imperial effect for 1 minute. When the matching roll is made, the effect is removed and a 1-hour cooldown effect is applied.

```json
{
  "key": "Note",
  "selector": "attack-roll",
  "outcome": ["criticalSuccess"],
  "title": "Exemplar Imperial",
  "text": "Allies who can clearly see and hear you and have neutral or better attitude toward the Empire gain +1 circumstance bonus to their next attack roll within 1 minute. You cannot benefit from Exemplar Imperial for 1 hour after using it."
}
```

```json
{
  "key": "Note",
  "selector": "skill-check",
  "outcome": ["criticalSuccess"],
  "title": "Exemplar Imperial",
  "text": "Allies who can clearly see and hear you and have neutral or better attitude toward the Empire gain +1 circumstance bonus to their next skill check of this kind within 1 minute. You cannot benefit from Exemplar Imperial for 1 hour after using it."
}
```

```json
{
  "key": "Note",
  "selector": "saving-throw",
  "outcome": ["criticalSuccess"],
  "title": "Exemplar Imperial",
  "text": "Allies who can clearly see and hear you and have neutral or better attitude toward the Empire gain +1 circumstance bonus to their next saving throw of this kind within 1 minute. You cannot benefit from Exemplar Imperial for 1 hour after using it."
}
```

## Citizen's Cantrip

Manual.

## Helping Hand

Automatic module automation:

When an ally within 30 feet fails an Aid action, the owner of a nearby actor with Helping Hand receives a private chat reminder.

## Hada Weapon Familiarity

```json
{
  "key": "MartialProficiency",
  "slug": "hada-weapon-familiarity-martial",
  "definition": [
    "item:category:martial",
    {
      "or": [
        "item:trait:hadaganian",
        "item:trait:inorodets",
        "item:base:longbow",
        "item:base:composite-longbow",
        "item:base:zulfikar",
        "item:base:chakram",
        "item:base:talwar",
        "item:base:scimitar",
        "item:base:bladed-scarf",
        "item:base:fighting-fan",
        "item:base:spear",
        "item:base:longspear",
        "item:base:katar",
        "item:base:tri-bladed-katar"
      ]
    }
  ],
  "sameAs": "simple"
}
```

```json
{
  "key": "MartialProficiency",
  "slug": "hada-weapon-familiarity-advanced",
  "definition": [
    "item:category:advanced",
    {
      "or": [
        "item:trait:hadaganian",
        "item:trait:inorodets",
        "item:base:longbow",
        "item:base:composite-longbow",
        "item:base:zulfikar",
        "item:base:chakram",
        "item:base:talwar",
        "item:base:scimitar",
        "item:base:bladed-scarf",
        "item:base:fighting-fan",
        "item:base:spear",
        "item:base:longspear",
        "item:base:katar",
        "item:base:tri-bladed-katar"
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
        "item:trait:hadaganian",
        "item:trait:inorodets",
        "item:base:longbow",
        "item:base:composite-longbow",
        "item:base:zulfikar",
        "item:base:chakram",
        "item:base:talwar",
        "item:base:scimitar",
        "item:base:bladed-scarf",
        "item:base:fighting-fan",
        "item:base:spear",
        "item:base:longspear",
        "item:base:katar",
        "item:base:tri-bladed-katar"
      ]
    }
  ]
}
```

## Imperial Lore

```json
{
  "key": "ActiveEffectLike",
  "mode": "upgrade",
  "path": "system.skills.soc.rank",
  "value": 1
}
```

```json
{
  "key": "ActiveEffectLike",
  "mode": "upgrade",
  "path": "system.skills.ath.rank",
  "value": 1
}
```

```json
{
  "key": "GrantItem",
  "uuid": "Compendium.pf2e.feats-srd.Item.BocFD2KV0qgUC76x",
  "flag": "additionalLoreEmpire",
  "allowDuplicate": true
}
```

## Collective Tactics

Applies a modified `Effect: Follow The Expert` using `Compendium.pf2e.other-effects.Item.VCSpuc3Tf3XWMkd3`.

Macro:

```js
game.modules.get("pf2e-sarnout-chronicles").api.ancestries.hadaganian.collectiveTactics()
```

## Hadaganian Ambition

```json
{
  "key": "ChoiceSet",
  "flag": "hadaganianAmbitionClassFeat",
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
  "uuid": "{item|flags.pf2e.rulesSelections.hadaganianAmbitionClassFeat}",
  "flag": "hadaganianAmbitionClassFeat"
}
```
