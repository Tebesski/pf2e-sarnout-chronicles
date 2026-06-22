import { MODULE_ID } from "./constants.mjs"
import { renderTemplarTemplate } from "./templates.mjs"

export async function postTemplarMessage(actor, title, body) {
   if (!actor || !ChatMessage?.create) return
   await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      flags: {
         [MODULE_ID]: {
            templarMessage: true,
         },
      },
      content: await renderTemplarTemplate("chat-card", {
         title,
         body,
      }),
   })
}
