function tokenDocument(target) {
   if (!target) return null
   if (target.documentName === "Token") return target
   if (target.document?.documentName === "Token") return target.document
   if (target.object?.document?.documentName === "Token")
      return target.object.document
   if (typeof target.getActiveTokens === "function") {
      const token =
         target.getActiveTokens(true, true)?.[0] ??
         target.getActiveTokens(false, true)?.[0]
      return token?.document ?? token ?? null
   }
   return target.document ?? target
}

function supportedTargetTokenDoc(doc) {
   const type = String(doc?.actor?.type ?? "").toLowerCase()
   return doc?.actor && !["vehicle", "hazard"].includes(type)
}

export function uniqueTokenDocs(targets = []) {
   const source = Array.isArray(targets) ? targets : [targets]
   const seen = new Set()
   return source.map(tokenDocument).filter((doc) => {
      const key = doc?.uuid ?? doc?.id
      if (!supportedTargetTokenDoc(doc)) return false
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
   })
}
