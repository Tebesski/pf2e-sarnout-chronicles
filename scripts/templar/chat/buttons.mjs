import { templarActions } from "../api.mjs"

async function documentFromUuid(uuid) {
   if (!uuid) return null
   return globalThis.fromUuidSync?.(uuid) || fromUuid(uuid).catch(() => null)
}

async function handleLightShellButton(lightShell) {
   const actor = await documentFromUuid(lightShell.dataset.actorUuid)
   const target = await documentFromUuid(lightShell.dataset.targetUuid)
   await templarActions.lightShell({
      actor,
      targetActor: target?.actor ?? target,
      spendFocus: false,
   })
}

async function pingTargetFromRow(row) {
   const uuid = row?.dataset?.targetUuid
   const doc = await documentFromUuid(uuid)
   const object = doc?.object ?? canvas?.tokens?.get?.(doc?.id)
   const center = object?.center ?? {
      x:
         Number(doc?.x ?? 0) +
         (Number(doc?.width ?? 1) * (canvas?.grid?.size ?? 100)) / 2,
      y:
         Number(doc?.y ?? 0) +
         (Number(doc?.height ?? 1) * (canvas?.grid?.size ?? 100)) / 2,
   }
   if (Number.isFinite(center.x) && Number.isFinite(center.y)) {
      await canvas?.animatePan?.({ x: center.x, y: center.y })
      canvas?.ping?.(center)
   }
}

function handleTemplarChatButtonClick(event) {
   const lightShell = event.target.closest?.("[data-templar-light-shell]")
   if (lightShell) {
      event.preventDefault()
      void handleLightShellButton(lightShell)
      return
   }

   const lightBurstSave = event.target.closest?.(
      "[data-templar-light-burst-save]",
   )
   if (lightBurstSave) {
      event.preventDefault()
      const messageId = lightBurstSave.closest?.(".message")?.dataset?.messageId
      void templarActions.rollLightBurstSaveFromCard({
         targetUuid: lightBurstSave.dataset.targetUuid,
         messageId,
      })
      return
   }

   const lightGaolSave = event.target.closest?.(
      "[data-templar-light-gaol-save]",
   )
   if (lightGaolSave) {
      event.preventDefault()
      void templarActions.rollLightGaolSaveFromCard({
         targetUuid: lightGaolSave.dataset.targetUuid,
         dc: lightGaolSave.dataset.dc,
         saveType: lightGaolSave.dataset.templarLightGaolSave,
      })
      return
   }

   const blindingBladeSave = event.target.closest?.(
      "[data-templar-blinding-blade-save]",
   )
   if (blindingBladeSave) {
      event.preventDefault()
      const targeted = Array.from(game.user?.targets ?? [])[0]
      const targetUuid =
         blindingBladeSave.dataset.targetUuid ||
         targeted?.document?.uuid ||
         targeted?.uuid ||
         null
      void templarActions.rollBlindingBladeSaveFromCard({
         targetUuid,
         dc: blindingBladeSave.dataset.dc,
      })
      return
   }

   const pingTarget = event.target.closest?.("[data-action='atw-ping-target']")
   if (pingTarget) {
      event.preventDefault()
      void pingTargetFromRow(pingTarget.closest?.("[data-target-uuid]"))
   }
}

export function installTemplarChatButtonListeners() {
   if (installTemplarChatButtonListeners.installed) return
   installTemplarChatButtonListeners.installed = true
   document.addEventListener("click", handleTemplarChatButtonClick)
}
