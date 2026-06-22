import { renderTemplarTemplate } from "./templates.mjs"

const ApplicationV2 = foundry.applications.api.ApplicationV2

export async function dialogContent({ paragraphs = [], facts = [] } = {}) {
   return renderTemplarTemplate("dialog-content", { paragraphs, facts })
}

export async function promptNumber({
   title,
   titleForValue = null,
   label,
   value = 0,
   min = 0,
   step = 1,
} = {}) {
   return TemplarNumberPrompt.prompt({
      title,
      titleForValue,
      label,
      value,
      min,
      step,
   })
}

class TemplarNumberPrompt extends ApplicationV2 {
   constructor(data, options = {}) {
      super({
         ...options,
         window: {
            ...TemplarNumberPrompt.DEFAULT_OPTIONS.window,
            title:
               typeof data.titleForValue === "function"
                  ? data.titleForValue(Number(data.value) || 0)
                  : (data.title ?? "Templar Barrier"),
         },
      })
      this.data = data
      this.settle = data.settle
      this.settled = false
   }

   static DEFAULT_OPTIONS = {
      id: "pf2e-sarnout-templar-number-prompt",
      tag: "form",
      classes: ["pf2e-sarnout-number-prompt"],
      window: {
         title: "Templar Barrier",
         icon: "fa-solid fa-shield-halved",
      },
      position: {
         width: 320,
         height: "auto",
      },
   }

   static prompt(data) {
      return new Promise((resolve) => {
         new TemplarNumberPrompt({ ...data, settle: resolve }).render({
            force: true,
         })
      })
   }

   async _renderHTML() {
      return renderTemplarTemplate("number-prompt", {
         label: this.data.label,
         value: Number(this.data.value) || 0,
         min: this.data.min,
         step: this.data.step,
      })
   }

   _replaceHTML(html, content) {
      if (typeof html === "string") content.innerHTML = html
      else content.replaceChildren(html)

      const input = content.querySelector("input[name='value']")
      input?.focus()
      input?.select()
      this.#updateTitle(this.#readValue(content))
      const form =
         content.closest("form") ?? content.querySelector("form") ?? content
      form.addEventListener("submit", (event) => {
         event.preventDefault()
         this.#finish(this.#readValue(content))
      })
      content.querySelector("[data-ok]")?.addEventListener("click", (event) => {
         event.preventDefault()
         this.#finish(this.#readValue(content))
      })
      input?.addEventListener("keydown", (event) => {
         if (event.key !== "Enter") return
         event.preventDefault()
         this.#finish(this.#readValue(content))
      })
      input?.addEventListener("input", () => {
         this.#updateTitle(this.#readValue(content))
      })
      content
         .querySelector("[data-cancel]")
         ?.addEventListener("click", () => this.#finish(null))
   }

   async close(options = {}) {
      if (!this.settled) this.#finish(null, false)
      return super.close(options)
   }

   #readValue(content) {
      const number = Number(content.querySelector("input[name='value']")?.value)
      return Number.isFinite(number) ? number : null
   }

   #updateTitle(value) {
      if (typeof this.data.titleForValue !== "function" || value === null)
         return
      const title = this.data.titleForValue(value)
      const titleElement = this.element?.querySelector?.(".window-title")
      if (titleElement) titleElement.textContent = title
   }

   #finish(result, close = true) {
      if (this.settled) return
      this.settled = true
      this.settle(result)
      if (close) this.close()
   }
}

export class TemplarChoiceDialog extends ApplicationV2 {
   constructor(data, options = {}) {
      super({
         ...options,
         window: {
            ...TemplarChoiceDialog.DEFAULT_OPTIONS.window,
            title: data.title ?? "Templar Barrier",
         },
         position: {
            ...TemplarChoiceDialog.DEFAULT_OPTIONS.position,
            ...(options.position ?? {}),
            width: data.width ?? options.position?.width ?? 430,
         },
      })
      this.data = data
      this.settle = data.settle
      this.settled = false
   }

   static DEFAULT_OPTIONS = {
      id: "pf2e-sarnout-templar-choice-dialog",
      tag: "section",
      classes: ["pf2e-sarnout-choice-dialog"],
      window: {
         title: "Templar Barrier",
         icon: "fa-solid fa-shield-halved",
      },
      position: {
         width: 430,
         height: "auto",
      },
   }

   static prompt(data) {
      return new Promise((resolve) => {
         new TemplarChoiceDialog({ ...data, settle: resolve }).render({
            force: true,
         })
      })
   }

   async _renderHTML() {
      return renderTemplarTemplate("choice-dialog", {
         content: this.data.content ?? "",
         buttons: this.data.buttons ?? [],
      })
   }

   _replaceHTML(html, content) {
      if (typeof html === "string") content.innerHTML = html
      else content.replaceChildren(html)

      for (const button of content.querySelectorAll("[data-choice]")) {
         button.addEventListener("click", (event) => {
            event.preventDefault()
            if (
               button.disabled ||
               button.getAttribute("aria-disabled") === "true"
            )
               return
            this.#finish(button.dataset.choice ?? null)
         })
         button.addEventListener("keydown", (event) => {
            if (!["Enter", " "].includes(event.key)) return
            event.preventDefault()
            if (
               button.disabled ||
               button.getAttribute("aria-disabled") === "true"
            )
               return
            this.#finish(button.dataset.choice ?? null)
         })
      }
   }

   async close(options = {}) {
      if (!this.settled) this.#finish(null, false)
      return super.close(options)
   }

   #finish(result, close = true) {
      if (this.settled) return
      this.settled = true
      this.settle(result)
      if (close) this.close()
   }
}

export class TemplarSelectDialog extends ApplicationV2 {
   constructor(data, options = {}) {
      super({
         ...options,
         window: {
            ...TemplarSelectDialog.DEFAULT_OPTIONS.window,
            title: data.title ?? "Templar Barrier",
         },
         position: {
            ...TemplarSelectDialog.DEFAULT_OPTIONS.position,
            ...(options.position ?? {}),
            width: data.width ?? options.position?.width ?? 500,
         },
      })
      this.data = data
      this.settle = data.settle
      this.settled = false
   }

   static DEFAULT_OPTIONS = {
      id: "pf2e-sarnout-templar-select-dialog",
      tag: "form",
      classes: ["pf2e-sarnout-choice-dialog", "pf2e-sarnout-select-dialog"],
      window: {
         title: "Templar Barrier",
         icon: "fa-solid fa-shield-halved",
      },
      position: {
         width: 500,
         height: "auto",
      },
   }

   static prompt(data) {
      return new Promise((resolve) => {
         new TemplarSelectDialog({ ...data, settle: resolve }).render({
            force: true,
         })
      })
   }

   async _renderHTML() {
      return renderTemplarTemplate("select-dialog", {
         intro: this.data.intro ?? "",
         label: this.data.label ?? "Option",
         options: this.data.options ?? [],
         actionButtons: this.data.actionButtons ?? [],
         confirmLabel: this.data.confirmLabel ?? "Confirm",
      })
   }

   _replaceHTML(html, content) {
      if (typeof html === "string") content.innerHTML = html
      else content.replaceChildren(html)

      const form = content.closest("form") ?? content
      const select = content.querySelector("select[name='choice']")
      const preview = content.querySelector("[data-preview]")
      const refresh = () => {
         const option = this.#selectedOption(select?.value)
         if (preview) preview.innerHTML = option?.preview ?? ""
      }
      select?.addEventListener("change", refresh)
      refresh()

      for (const btn of content.querySelectorAll("[data-action-btn]")) {
         btn.addEventListener("click", (event) => {
            event.preventDefault()
            this.#finish(btn.dataset.actionBtn)
         })
      }

      form.addEventListener("submit", (event) => {
         event.preventDefault()
         const option = this.#selectedOption(select?.value)
         this.#finish(option?.id ?? null)
      })
      content
         .querySelector("[data-cancel]")
         ?.addEventListener("click", () => this.#finish(null))
   }

   async close(options = {}) {
      if (!this.settled) this.#finish(null, false)
      return super.close(options)
   }

   #selectedOption(id) {
      return (
         (this.data.options ?? []).find((option) => option.id === id) ?? null
      )
   }

   #finish(result, close = true) {
      if (this.settled) return
      this.settled = true
      this.settle(result)
      if (close) this.close()
   }
}
