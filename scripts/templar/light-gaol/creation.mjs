import { MODULE_ID, TEMPLAR_ASSETS } from "../constants.mjs"
import { LIGHT_GAOL_OWNER_SLUG } from "./data.mjs"

export function lightGaolCreatedIds() {
   return {
      actors: [],
      tokens: [],
      walls: [],
      region: null,
      adjacencyRegion: null,
      light: null,
      sound: null,
      action: null,
      spellDc: null,
   }
}

export function lightGaolGeometry(token, gridSize) {
   const originX = token.x
   const originY = token.y
   const squarePx = gridSize * 2
   return {
      originX,
      originY,
      squarePx,
      centerX: originX + gridSize,
      centerY: originY + gridSize,
      adjacency: {
         x: originX - gridSize,
         y: originY - gridSize,
         width: squarePx + gridSize * 2,
         height: squarePx + gridSize * 2,
      },
   }
}

export function lightGaolAdjacencyRegionData({
   adjacency,
   ownerUuid,
   behaviorType,
   events,
   source,
}) {
   return {
      name: "Light Gaol Adjacency",
      elevation: { bottom: 0, top: 19, topInclusive: false },
      shapes: [
         {
            type: "rectangle",
            x: adjacency.x,
            y: adjacency.y,
            width: adjacency.width,
            height: adjacency.height,
            gridBased: true,
         },
      ],
      behaviors: [{ type: behaviorType, system: { events, source } }],
      flags: {
         [MODULE_ID]: {
            isLightGaolAdjacency: true,
            ownerUuid,
         },
      },
   }
}

export function lightGaolBoundaryRegionData({
   actorName,
   originX,
   originY,
   squarePx,
   ownerUuid,
   behaviorType,
   events,
   source,
}) {
   return {
      name: `Light Gaol (${actorName})`,
      color: "#ffdd00",
      visibility: 2,
      elevation: { bottom: 0, top: 20, topInclusive: false },
      shapes: [
         {
            type: "rectangle",
            x: originX,
            y: originY,
            width: squarePx,
            height: squarePx,
            gridBased: true,
         },
      ],
      behaviors: [{ type: behaviorType, system: { events, source } }],
      flags: {
         [MODULE_ID]: { lightGaolRegion: true, ownerUuid },
      },
   }
}

export function lightGaolAmbientLightData({ x, y }) {
   return {
      x,
      y,
      config: {
         dim: 80,
         bright: 40,
         color: "#ffd700",
         alpha: 0.5,
         animation: { type: "sunburst", speed: 2, intensity: 3 },
      },
   }
}

export function lightGaolAmbientSoundData({ actorName, x, y, ownerUuid }) {
   return {
      name: `Light Gaol (${actorName})`,
      x,
      y,
      radius: 80,
      path: TEMPLAR_ASSETS.lightGaolLoopSound,
      repeat: true,
      volume: 1,
      walls: true,
      easing: true,
      hidden: false,
      flags: {
         [MODULE_ID]: {
            isLightGaolSound: true,
            ownerUuid,
         },
      },
   }
}

export function lightGaolWallSegments({ originX, originY, gridSize, squarePx }) {
   return [
      { x1: originX, y1: originY, x2: originX + gridSize, y2: originY },
      {
         x1: originX + gridSize,
         y1: originY,
         x2: originX + squarePx,
         y2: originY,
      },
      {
         x1: originX + squarePx,
         y1: originY,
         x2: originX + squarePx,
         y2: originY + gridSize,
      },
      {
         x1: originX + squarePx,
         y1: originY + gridSize,
         x2: originX + squarePx,
         y2: originY + squarePx,
      },
      {
         x1: originX + squarePx,
         y1: originY + squarePx,
         x2: originX + gridSize,
         y2: originY + squarePx,
      },
      {
         x1: originX + gridSize,
         y1: originY + squarePx,
         x2: originX,
         y2: originY + squarePx,
      },
      {
         x1: originX,
         y1: originY + squarePx,
         x2: originX,
         y2: originY + gridSize,
      },
      { x1: originX, y1: originY + gridSize, x2: originX, y2: originY },
   ]
}

export function lightGaolWallData(segment) {
   return {
      c: [segment.x1, segment.y1, segment.x2, segment.y2],
      light: CONST.EDGE_SENSE_TYPES.NONE,
      sight: CONST.EDGE_SENSE_TYPES.NONE,
      sound: CONST.EDGE_SENSE_TYPES.NONE,
      move: CONST.WALL_MOVEMENT_TYPES.NONE,
      flags: { [MODULE_ID]: { isLightGaolWall: true } },
   }
}

export function lightGaolWallActorData({
   wallHp,
   hardness,
   level,
   alliance,
   wallId,
   ownerUuid,
}) {
   return {
      name: "Light Gaol Wall",
      type: "hazard",
      system: {
         attributes: {
            hp: { value: wallHp, max: wallHp },
            immunities: [{ type: "critical-hits" }, { type: "precision" }],
            resistances: [
               {
                  type: "all-damage",
                  value: hardness,
                  exceptions: ["force", "ghost-touch"],
                  doubleVs: ["non-magical"],
               },
            ],
         },
         details: {
            isComplex: false,
            level: { value: level },
            alliance: alliance ?? null,
         },
      },
      flags: {
         [MODULE_ID]: {
            isLightGaolActor: true,
            linkedWallId: wallId,
            ownerUuid,
         },
      },
   }
}

export function lightGaolWallTokenData({
   segment,
   actorId,
   wallId,
   ownerUuid,
   originX,
   originY,
   squarePx,
   gridSize,
}) {
   const width = segment.x1 === segment.x2 ? 0.2 : 1
   const height = segment.y1 === segment.y2 ? 0.2 : 1
   let x = Math.min(segment.x1, segment.x2)
   let y = Math.min(segment.y1, segment.y2)

   if (x === originX + squarePx) x -= width * gridSize
   if (y === originY + squarePx) y -= height * gridSize

   return {
      name: "Light Gaol Wall",
      actorId,
      x,
      y,
      width,
      height,
      alpha: 0,
      disposition: 1,
      locked: true,
      flags: {
         [MODULE_ID]: {
            isLightGaolToken: true,
            linkedWallId: wallId,
            ownerUuid,
         },
      },
   }
}

export function lightGaolOwnerEffectData(createdIds) {
   return {
      name: "Effect: Light Gaol",
      type: "effect",
      img: TEMPLAR_ASSETS.lightBurst,
      system: {
         slug: LIGHT_GAOL_OWNER_SLUG,
         duration: { value: 1, unit: "minutes", expiry: "turn-start" },
         description: { value: "You have conjured a Light Gaol." },
         rules: [
            { key: "RollOption", domain: "all", option: "light-gaol-owner" },
         ],
      },
      flags: { [MODULE_ID]: { lightGaolData: createdIds } },
   }
}
