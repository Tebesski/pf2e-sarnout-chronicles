export function lastRedoubtRegionScript({
   moduleId,
   ownerUuid,
   rank,
   hasAdvent,
   adventHardness,
   lightProtects,
   allProtectingLight,
} = {}) {
   return `const MODULE_ID = "${moduleId}";
const ownerUuid = "${ownerUuid}";
const rank = ${rank};
const hasAdvent = ${hasAdvent};
const adventHardness = ${adventHardness};
const lightProtects = ${lightProtects};
const allProtectingLight = ${allProtectingLight};

if (!event.data.token) return;
const tokenDoc = event.data.token.document ?? event.data.token;
const actor = tokenDoc.actor;
if (!actor) return;
const owner = await fromUuid(ownerUuid);
if (!owner || (owner.alliance !== actor.alliance && actor.uuid !== ownerUuid)) return;

const isOwner = actor.uuid === ownerUuid;
const isEnter = event.name === "tokenEnter";
const isExit = event.name === "tokenExit";
const isTurnStart = event.name === "tokenTurnStart";

if (isEnter || isTurnStart) {
    const existingTemps = actor.items.filter(i => i.flags?.[MODULE_ID]?.lastRedoubtTempHp);
    let needsTempHp = existingTemps.length === 0;

    if (isTurnStart) {
        if (existingTemps.length) {
            try {
                const currentIds = new Set(actor.items.map(i => i.id));
                const idsToDelete = existingTemps.map(i => i.id).filter(id => currentIds.has(id));
                if (idsToDelete.length) await actor.deleteEmbeddedDocuments("Item", idsToDelete);
            } catch (_error) {
                undefined;
            }
        }
        needsTempHp = true;
    }

    const itemsToCreate = [];

    if (needsTempHp) {
        itemsToCreate.push({
            name: "Last Redoubt Temp HP",
            type: "effect",
            img: "modules/" + MODULE_ID + "/assets/templar/icons/hp.png",
            system: { slug: "effect-last-redoubt-temp-hp", rules: [{ key: "TempHP", value: rank * 2 }] },
            flags: { [MODULE_ID]: { lastRedoubtTempHp: true, source: ownerUuid } }
        });
    }

    if (!isOwner && !actor.items.some(i => i.flags?.[MODULE_ID]?.lastRedoubtAction)) {
        itemsToCreate.push({
            name: "Last Redoubt Defenses",
            type: "action",
            img: "modules/" + MODULE_ID + "/assets/templar/icons/ac.png",
            system: { actionType: { value: "action" }, actions: { value: 1 }, description: { value: "Gain +1 circumstance bonus to AC until the start of your next turn." } },
            flags: { [MODULE_ID]: { lastRedoubtAction: true, source: ownerUuid } }
        });
    }

    if (!isOwner && hasAdvent && !actor.items.some(i => i.flags?.[MODULE_ID]?.lastRedoubtAdvent)) {
        const rules = [];
        if (allProtectingLight) {
            rules.push({ key: "Resistance", type: "all-damage", value: adventHardness });
        } else if (lightProtects) {
            rules.push({ key: "Resistance", type: "physical", value: adventHardness });
            rules.push({ key: "Resistance", type: "custom", label: "Light Protects", value: adventHardness, definition: [{or: ["item:trait:darkness", "item:trait:shadow", "item:trait:unholy", "origin:trait:darkness", "origin:trait:shadow", "origin:trait:unholy"]}] });
        } else {
            rules.push({ key: "Resistance", type: "physical", value: adventHardness });
        }

        itemsToCreate.push({
            name: "Effect: Last Redoubt Advent",
            type: "effect",
            img: "modules/" + MODULE_ID + "/assets/templar/icons/last-stronghold.png",
            system: { slug: "effect-last-redoubt-advent", duration: { value: 1, unit: "rounds", expiry: "turn-start" }, rules: rules },
            flags: { [MODULE_ID]: { lastRedoubtAdvent: true, source: ownerUuid } }
        });
    }

    if (itemsToCreate.length) {
        try {
            await actor.createEmbeddedDocuments("Item", itemsToCreate);
        } catch (_error) {
            undefined;
        }
    }
}

if (isExit) {
    const currentIds = new Set(actor.items.map(i => i.id));
    const itemsToDelete = actor.items.filter(i => {
        const flags = i.flags?.[MODULE_ID] || {};
        return flags.lastRedoubtTempHp || flags.lastRedoubtAction || flags.lastRedoubtAcEffect || flags.lastRedoubtAdvent || i.slug === "effect-last-redoubt-temp-hp" || i.slug === "effect-last-redoubt-ac" || i.slug === "effect-last-redoubt-advent";
    }).map(i => i.id).filter(id => currentIds.has(id));
    
    if (itemsToDelete.length) {
        try {
            await actor.deleteEmbeddedDocuments("Item", itemsToDelete);
        } catch (_error) {
            undefined;
        }
    }
}`
}
