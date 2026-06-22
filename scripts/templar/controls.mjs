import { MODULE_ID } from "./constants.mjs"
import { toggleTemplarBarrierPanel } from "./panel.mjs"

export function registerTemplarControls() {
   game.keybindings.register(MODULE_ID, "toggleTemplarBarrier", {
      name: "PF2ESC.Templar.BarrierPanel.Open",
      hint: "PF2ESC.Templar.BarrierPanel.OpenHint",
      editable: [{ key: "KeyB", modifiers: [] }],
      restricted: false,
      onDown: () => {
         toggleTemplarBarrierPanel()
         return true
      },
   })

   Hooks.on("getSceneControlButtons", (controls) => {
      const tokens = Array.isArray(controls)
         ? controls.find((control) => control.name === "tokens")
         : controls.tokens
      if (!tokens?.tools) return

      const tool = {
         name: "sarnoutTemplarBarrier",
         title: "PF2ESC.Templar.BarrierPanel.SceneControl",
         icon: "fa-solid fa-shield-halved",
         button: true,
         visible: true,
         order: Object.keys(tokens.tools).length,
         onChange: () => toggleTemplarBarrierPanel(),
      }

      if (Array.isArray(tokens.tools)) tokens.tools.push(tool)
      else tokens.tools.sarnoutTemplarBarrier = tool
   })
}
