import { TEMPLAR_TEMPLATE_PATH } from "./constants.mjs"

export async function renderTemplarTemplate(name, context = {}) {
   const renderer =
      globalThis.foundry?.applications?.handlebars?.renderTemplate ??
      globalThis.renderTemplate
   if (typeof renderer !== "function") {
      throw new Error("Foundry Handlebars renderer is not available.")
   }
   return renderer(`${TEMPLAR_TEMPLATE_PATH}/${name}.hbs`, context)
}

export function textParagraph(text) {
   return { text: String(text ?? ""), html: false }
}

export function fact(label, value, { html = false } = {}) {
   return {
      label: String(label ?? ""),
      value: String(value ?? ""),
      html: Boolean(html),
   }
}

export function optionPreview(html) {
   return String(html ?? "")
}
