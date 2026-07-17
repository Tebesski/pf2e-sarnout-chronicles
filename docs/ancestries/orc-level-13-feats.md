# Orc 13th-Level Ancestry Feats

Source: https://scribe.pf2.tools/v/pc8sO8Ls

## Ferocious Beasts

Target the relevant companions, pets, familiars, or bonded animals:

```js
game.modules.get("pf2e-sarnout-chronicles").api.ancestries.orc.ferociousBeasts()
```

## Embassy of Nature

Manual ritual.

## Righteous Fury

```js
game.modules.get("pf2e-sarnout-chronicles").api.ancestries.orc.righteousFury()
```

## Incredible Tenacity

Automatic: updates Orc Tenacity to once per hour.

## Blood Calls to Blood

Automatic: applies a melee Strike damage bonus equal to twice wounded + doomed, maximum +6.

## Overcome Shame

Automation: critical failed Strike rolls send a private reminder.

Use:

```js
game.modules.get("pf2e-sarnout-chronicles").api.ancestries.orc.overcomeShame()
```

Miss penalty:

```js
game.modules.get("pf2e-sarnout-chronicles").api.ancestries.orc.overcomeShamePenalty()
```

## Major Vessel

Automation: when added, choose one eligible Spirit Vessel boon. Spell boons are granted as primal innate spells.

Cloak of Poison:

```js
game.modules
   .get("pf2e-sarnout-chronicles")
   .api.ancestries.orc.majorVesselCloakOfPoison()
```
