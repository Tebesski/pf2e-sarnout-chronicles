export const MODULE_ID = "pf2e-sarnout-chronicles"
export const TEMPLAR_FLAG = "templar"
export const MODULE_PATH = `modules/${MODULE_ID}`
export const TEMPLAR_TEMPLATE_PATH = `${MODULE_PATH}/templates/templar`

export const TEMPLAR_SETTINGS = {
   autoDealReleasedBarrierDamage: "autoDealReleasedBarrierDamage",
   debugAutomation: "debugAutomation",
}

export const TEMPLAR_ASSETS = {
   barrier: `${MODULE_PATH}/assets/templar/img/barrier.png`,
   brilliantShield: `${MODULE_PATH}/assets/templar/img/brilliant-shield.png`,
   broken: `${MODULE_PATH}/assets/templar/img/broken.png`,
   fragment: `${MODULE_PATH}/assets/templar/img/fragment.png`,
   holding: `${MODULE_PATH}/assets/templar/img/holding.png`,
   advent: `${MODULE_PATH}/assets/templar/icons/advent.png`,
   blinding: `${MODULE_PATH}/assets/templar/icons/blinding.png`,
   brilliant: `${MODULE_PATH}/assets/templar/icons/brilliant.png`,
   gaol: `${MODULE_PATH}/assets/templar/icons/gaol.png`,
   heatLightning: `${MODULE_PATH}/assets/templar/icons/heat-lightning.png`,
   inculpation: `${MODULE_PATH}/assets/templar/icons/inculpation.png`,
   light: `${MODULE_PATH}/assets/templar/icons/light.png`,
   lightBurst: `${MODULE_PATH}/assets/templar/icons/light-burst.png`,
   lingering: `${MODULE_PATH}/assets/templar/icons/lingering.png`,
   prevail: `${MODULE_PATH}/assets/templar/icons/prevail.png`,
   reactive: `${MODULE_PATH}/assets/templar/icons/reactive.png`,
   refraction: `${MODULE_PATH}/assets/templar/icons/damping.png`,
   lightShell: `${MODULE_PATH}/assets/templar/icons/light-shell.png`,
   scutum: `${MODULE_PATH}/assets/templar/icons/scutum.png`,
   scorching: `${MODULE_PATH}/assets/templar/icons/scorching.png`,
   released: `${MODULE_PATH}/assets/templar/img/released.png`,
   releaseSound: `${MODULE_PATH}/assets/templar/sfx/PaladinEndurePainAbility.ogg`,
   adventSound: `${MODULE_PATH}/assets/templar/sfx/RuneBreak.ogg`,
   lastStrongholdSound: `${MODULE_PATH}/assets/templar/sfx/PaladinHadaganFemale.ogg`,
   lightBurstSound: `${MODULE_PATH}/assets/templar/sfx/dazzling-flash.ogg`,
   inculpationSound: `${MODULE_PATH}/assets/templar/sfx/dazzling-flash.ogg`,
   repentanceSound: `${MODULE_PATH}/assets/templar/sfx/PaladinLayonHandsAbility.ogg`,
   scorchingReprisalSound: `${MODULE_PATH}/assets/templar/sfx/smite.mp3`,
   flagellationSound: `${MODULE_PATH}/assets/templar/sfx/flagellant.wav`,
   lightGaolStartSound: `${MODULE_PATH}/assets/templar/sfx/gaol-start.ogg`,
   lightGaolLoopSound: `${MODULE_PATH}/assets/templar/sfx/gaol-loop.ogg`,
   blindingBladeSound: `${MODULE_PATH}/assets/templar/sfx/PriestBlind.ogg`,
   refractionInSound: `${MODULE_PATH}/assets/templar/sfx/Priest_Intervention_In.ogg`,
   refractionOutSound: `${MODULE_PATH}/assets/templar/sfx/Priest_Intervention_Out.ogg`,
   scutumFideiSound: `${MODULE_PATH}/assets/templar/sfx/PaladinKnightResistance.ogg`,
   lightShellSound: `${MODULE_PATH}/assets/templar/sfx/procs_pal.ogg`,
   prevailReleaseSound: `${MODULE_PATH}/assets/templar/sfx/PaladinPurgePainAbility.ogg`,
   philosophyOfDefenseSound: `${MODULE_PATH}/assets/templar/sfx/PaladinReliefPainAbility.ogg`,
   brilliantShardSound: `${MODULE_PATH}/assets/templar/sfx/PriestBarrier.ogg`,
   brilliantShardLoopSound: `${MODULE_PATH}/assets/templar/sfx/PriestBarrier_lp.ogg`,
   shatterSounds: [1, 2, 3, 4, 5, 6].map(
      (index) => `${MODULE_PATH}/assets/templar/sfx/shatter${index}.mp3`,
   ),
   breakSounds: [1, 2, 3, 4, 5, 6].map(
      (index) => `${MODULE_PATH}/assets/templar/sfx/break${index}.mp3`,
   ),
}

export const TEMPLAR_SLUGS = {
   dedication: ["templar-dedication"],
   retributorsOath: ["retributors-oath"],
   reactiveBarrier: ["reactive-barrier"],
   holdingBarrier: ["holding-barrier"],
   shieldBearer: ["shield-bearer"],
   imperviousBarrier: ["impervious-barrier"],
   philosophyOfDefense: ["philosophy-of-defense"],
   barrierJuggler: ["barrier-juggler"],
   defenseMaster: ["defense-master"],
   lightBurst: ["light-burst"],
   inculpation: ["inculpation"],
   prevail: ["prevail"],
   heatLightning: ["heat-lightning"],
   lastStronghold: ["last-redoubt", "last-stronghold"],
   providence: ["providence", "divine-intervention"],
   divineIntervention: ["providence", "divine-intervention"],
   flagellation: ["flagellation"],
   repentance: ["repentance"],
   lightProtects: ["light-protects"],
   asSafeAsChurch: ["as-safe-as-church"],
   allProtectingLight: ["all-protecting-light"],
   scorchingReprisal: [
      "scorching-reprisal",
      "blazing-reprisal",
      "divine-retribution",
   ],
   brilliantShard: ["brilliant-shard"],
   advent: ["advent", "rallying"],
   rallying: ["advent", "rallying"],
   lightDamping: ["refraction", "light-damping"],
   refraction: ["refraction", "light-damping"],
   lightShell: ["light-shell"],
   scutumFidei: ["scutum-fidei"],
   lightGaol: ["light-gaol"],
   blindingBlade: ["blinding-blade"],
}

export const TEMPLAR_FEAT_SLUG_GROUPS = [
   TEMPLAR_SLUGS.dedication,
   TEMPLAR_SLUGS.holdingBarrier,
   TEMPLAR_SLUGS.lightBurst,
   TEMPLAR_SLUGS.repentance,
   TEMPLAR_SLUGS.lightProtects,
   TEMPLAR_SLUGS.asSafeAsChurch,
   TEMPLAR_SLUGS.allProtectingLight,
   TEMPLAR_SLUGS.scorchingReprisal,
   TEMPLAR_SLUGS.brilliantShard,
   TEMPLAR_SLUGS.philosophyOfDefense,
   TEMPLAR_SLUGS.providence,
   TEMPLAR_SLUGS.inculpation,
   TEMPLAR_SLUGS.defenseMaster,
   TEMPLAR_SLUGS.advent,
   TEMPLAR_SLUGS.heatLightning,
   TEMPLAR_SLUGS.prevail,
   TEMPLAR_SLUGS.shieldBearer,
   TEMPLAR_SLUGS.flagellation,
   TEMPLAR_SLUGS.barrierJuggler,
   TEMPLAR_SLUGS.imperviousBarrier,
   TEMPLAR_SLUGS.lastStronghold,
   TEMPLAR_SLUGS.refraction,
   TEMPLAR_SLUGS.scutumFidei,
   TEMPLAR_SLUGS.lightGaol,
   TEMPLAR_SLUGS.blindingBlade,
   TEMPLAR_SLUGS.retributorsOath,
]

export const TEMPLAR_EFFECT_SLUGS = {
   sustainedHolding: "sustained-holding-barrier",
   light: "effect-templar-light",
   reactionUsed: "effect-templar-reaction-used",
   lightBurstUsed: "effect-light-burst-used",
   inculpationUsed: "effect-inculpation-used",
   barrierDamaged: "effect-barrier-was-damaged",
   lingeringBarrier: "effect-lingering-barrier",
   lastRedoubtSource: "effect-last-redoubt",
   lastRedoubtTemporaryHp: "effect-last-redoubt-temporary-hp",
   scorchingReprisal: "effect-scorching-reprisal",
}

export const SUSTAINED_HOLDING_SLUG = TEMPLAR_EFFECT_SLUGS.sustainedHolding
export const TEMPLAR_LIGHT_SLUG = TEMPLAR_EFFECT_SLUGS.light
export const TEMPLAR_REACTION_USED_SLUG = TEMPLAR_EFFECT_SLUGS.reactionUsed
export const LIGHT_BURST_USED_SLUG = TEMPLAR_EFFECT_SLUGS.lightBurstUsed
export const INCULPATION_USED_SLUG = TEMPLAR_EFFECT_SLUGS.inculpationUsed
export const BARRIER_DAMAGED_SLUG = TEMPLAR_EFFECT_SLUGS.barrierDamaged
export const LINGERING_BARRIER_SLUG = TEMPLAR_EFFECT_SLUGS.lingeringBarrier
export const LAST_STRONGHOLD_SOURCE_SLUG =
   TEMPLAR_EFFECT_SLUGS.lastRedoubtSource
export const LAST_STRONGHOLD_TEMP_SLUG =
   TEMPLAR_EFFECT_SLUGS.lastRedoubtTemporaryHp
export const SCORCHING_REPRISAL_EFFECT_SLUG =
   TEMPLAR_EFFECT_SLUGS.scorchingReprisal

export const GENERATED_TEMPLAR_ACTION_FLAG = "generatedTemplarAction"

export const LEGACY_GENERATED_ACTION_SLUGS = [
   "reactive-barrier",
   "holding-barrier",
   "light-burst",
   "inculpation",
   "refraction",
   "light-damping",
]

export const LEGACY_GENERATED_ACTION_DESCRIPTION_SNIPPETS = [
   "The module prompts for incoming damage",
   "using PF2e chat damage automation is preferred",
   "Your active barrier absorbs the damage and stores",
   "Your Light Barrier also takes the triggering damage and detonates",
   "When offered by the Templar Barrier dialog",
]

export const LINKED_TEMPLAR_EFFECTS = {
   brilliantShard: {
      slug: "effect-brilliant-shard",
      name: "Effect: Brilliant Shard",
      img: TEMPLAR_ASSETS.brilliant,
      description: "Tracks Brilliant Shard for the Templar barrier automation.",
      rules: () => [
         {
            key: "TokenLight",
            value: {
               bright: 20,
               dim: 40,
               color: "#f4d26a",
               alpha: 0.35,
               animation: {
                  type: "sunburst",
                  speed: 1,
                  intensity: 2,
               },
            },
         },
      ],
   },
   advent: {
      slug: "effect-advent",
      legacySlugs: ["effect-rallying"],
      name: "Effect: Advent",
      legacyNames: ["Effect: Rallying"],
      img: TEMPLAR_ASSETS.advent,
      description:
         "Tracks Advent for the Templar barrier automation and halves active-barrier Hardness while active.",
      rules: () => [
         {
            key: "Aura",
            radius: 15,
            slug: "advent-aura",
            traits: ["aura", "divine", "holy", "light"],
         },
      ],
   },
}

export const RELEASE_ANIMATION_MS = 1600
export const RELEASE_ICON_SWAP_MS = 1480
export const RELEASE_FLASH_TAIL_MS = RELEASE_ANIMATION_MS - RELEASE_ICON_SWAP_MS
export const RALLYING_ANIMATION_MS = 1400
export const RELEASED_ICON_MS = 5000
