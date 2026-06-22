export async function resolveUuid(uuid) {
   return (
      globalThis.fromUuidSync?.(uuid) ??
      (uuid ? await fromUuid(uuid).catch(() => null) : null)
   )
}
