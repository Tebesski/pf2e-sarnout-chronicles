# Hadaganian 9th-Level Ancestry Feats

Source: https://scribe.pf2.tools/v/2ljQwst3

## Exemplary Sacrifice

Manual.

## Coordinated Effort

```json
{
  "key": "Note",
  "selector": "skill-check",
  "predicate": ["action:aid"],
  "title": "Coordinated Effort",
  "text": "After you Aid an ally at a skill check that does not have the attack trait, you can also Aid any other ally who attempts the same skill check for the same purpose that round as a free action."
}
```

## Path of Endurance

```json
{
  "key": "Note",
  "selector": "skill-check",
  "title": "Path of Endurance",
  "text": "You can Hustle twice as long while exploring before stopping. You can go without food or water twice as long as another human. Your group can use your Constitution modifier to determine group Hustle speed."
}
```

## Hadaganian Resourcefulness

```js
game.modules.get("pf2e-sarnout-chronicles").api.ancestries.hadaganian.hadaganianResourcefulness()
```

## Talented Citizen

```json
{
  "key": "ChoiceSet",
  "flag": "talentedCitizenDedication",
  "adjustName": false,
  "choices": {
    "filter": ["item:level:2", "item:trait:dedication"],
    "itemType": "feat"
  },
  "prompt": "Choose a 2nd-level dedication feat"
}
```

```json
{
  "key": "GrantItem",
  "uuid": "{item|flags.pf2e.rulesSelections.talentedCitizenDedication}",
  "flag": "talentedCitizenDedication",
  "reevaluateOnUpdate": false
}
```

## Steel of the People

Automatic: modifies the Citizen's Perseverance effect.

## Deep Sense of Camaraderie

```json
{
  "key": "AdjustDegreeOfSuccess",
  "selector": "skill-check",
  "adjustment": {
    "criticalFailure": "to-success",
    "failure": "to-success"
  },
  "predicate": ["action:aid", "skill:rank:2"]
}
```
