import { slugify } from "../hadaganian/helpers.mjs"

const PATCH_MARK = Symbol.for("pf2e-sarnout-chronicles.werecreatureDedicationPatch")

function itemSlug(item) {
   return slugify(item?.slug ?? item?.system?.slug ?? item?.name)
}

function traitSet(item) {
   return new Set(
      (item?.system?.traits?.value ?? [])
         .map((trait) => slugify(trait))
         .filter(Boolean),
   )
}

function isWerecreatureDedication(feat) {
   if (typeof feat?.isOfType === "function" && !feat.isOfType("feat")) return false
   if (feat?.type && feat.type !== "feat") return false
   const slug = itemSlug(feat)
   const traits = traitSet(feat)
   const text = [
      feat?.name,
      feat?.system?.description?.value,
      feat?._source?.system?.description?.value,
   ]
      .join(" ")
      .toLowerCase()
   return (
      slug === "werecreature-dedication" ||
      (slug.includes("werecreature") && traits.has("dedication")) ||
      (traits.has("werecreature") && traits.has("dedication")) ||
      (text.includes("werecreature") && traits.has("dedication"))
   )
}

function isAncestryFeatSlot(slotData) {
   const rawGroup = slotData?.groupId?.value ?? slotData?.groupId ?? ""
   const rawSlot = slotData?.slotId?.value ?? slotData?.slotId ?? ""
   const groupId = slugify(rawGroup)
   const slotId = slugify(rawSlot)
   return (
      groupId === "ancestry" ||
      groupId === "ancestral-paragon" ||
      slotId.startsWith("ancestry-") ||
      slotId === "ancestry" ||
      slotId.includes("ancestral-paragon")
   )
}

function cloneAsAncestryFeat(feat) {
   const source = feat.toObject()
   foundry.utils.setProperty(source, "system.category", "ancestry")
   return new Item.implementation(source)
}

function normalizedWerecreatureFeat(feat, slotData) {
   if (!isAncestryFeatSlot(slotData)) return feat
   if (!isWerecreatureDedication(feat)) return feat
   if (feat.category === "ancestry") return feat
   return cloneAsAncestryFeat(feat)
}

function patchFeatCollection(feats) {
   const proto = feats ? Object.getPrototypeOf(feats) : null
   if (!proto?.insertFeat || proto[PATCH_MARK]) return

   const original = proto.insertFeat
   Object.defineProperty(proto, PATCH_MARK, { value: true })
   proto.insertFeat = async function sscWerecreatureInsertFeat(feat, slotData) {
      return original.call(this, normalizedWerecreatureFeat(feat, slotData), slotData)
   }

   for (const group of feats.values?.() ?? []) {
      patchFeatGroup(group)
   }
   patchFeatGroup(feats.bonus)
}

function patchFeatGroup(group) {
   const proto = group ? Object.getPrototypeOf(group) : null
   if (!proto?.insertFeat || proto[PATCH_MARK]) return

   const original = proto.insertFeat
   const originalIsFeatValid = proto.isFeatValid
   Object.defineProperty(proto, PATCH_MARK, { value: true })
   if (typeof originalIsFeatValid === "function") {
      proto.isFeatValid = function sscWerecreatureIsFeatValid(feat) {
         if (this.id === "ancestry" && isWerecreatureDedication(feat)) return true
         return originalIsFeatValid.call(this, feat)
      }
   }
   proto.insertFeat = async function sscWerecreatureGroupInsertFeat(
      feat,
      slotId = null,
   ) {
      const normalized = normalizedWerecreatureFeat(feat, {
         groupId: this.id,
         slotId,
      })
      return original.call(this, normalized, slotId)
   }
}

export function normalizeWerecreatureDedicationSource(item, changes = null) {
   const data = changes ?? item
   const slotId =
      foundry.utils.getProperty(data, "system.location") ??
      foundry.utils.getProperty(data, "system.location.value") ??
      foundry.utils.getProperty(item, "_source.system.location") ??
      foundry.utils.getProperty(item, "_source.system.location.value") ??
      foundry.utils.getProperty(item, "system.location")
   if (!isAncestryFeatSlot({ slotId })) {
      return
   }
   if (!isWerecreatureDedication(item)) return

   if (changes) {
      foundry.utils.setProperty(changes, "system.category", "ancestry")
   } else {
      item.updateSource({ "system.category": "ancestry" })
   }
}

export function registerWerecreatureDedicationSlotAutomation() {
   Hooks.once("ready", () => {
      for (const actor of game.actors ?? []) {
         if (actor.type === "character") patchFeatCollection(actor.feats)
      }
   })

   Hooks.on("renderCharacterSheetPF2e", (sheet) => {
      if (sheet.actor?.type === "character") patchFeatCollection(sheet.actor.feats)
   })

   Hooks.on("createActor", (actor) => {
      if (actor.type === "character") patchFeatCollection(actor.feats)
   })
}
