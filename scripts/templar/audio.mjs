function clamp(value, min, max) {
   return Math.max(min, Math.min(max, value))
}

export function audioVolume(defaultVolume = 0.75) {
   const setting = Number(game.settings?.get?.("core", "globalInterfaceVolume"))
   return Number.isFinite(setting) ? clamp(setting, 0, 1) : defaultVolume
}

const loopingSounds = new Map()

export async function playSound(
   src,
   volume = audioVolume(),
   { loop = false, broadcast = true } = {},
) {
   const helper =
      globalThis.foundry?.audio?.AudioHelper ?? globalThis.AudioHelper
   try {
      return await helper?.play?.({ src, volume, autoplay: true, loop }, broadcast)
   } catch (_error) {
      return null
   }
}

export async function playRandomSound(sounds, volume = audioVolume()) {
   if (!Array.isArray(sounds) || sounds.length === 0) return
   await playSound(sounds[Math.floor(Math.random() * sounds.length)], volume)
}

export async function playLoopSound(key, src, volume = audioVolume()) {
   if (!key || !src) return null
   stopLoopSound(key)
   const sound = await playSound(src, volume, { loop: true, broadcast: false })
   if (sound) loopingSounds.set(key, sound)
   return sound
}

export function stopLoopSound(key) {
   const sound = loopingSounds.get(key)
   if (!sound) return
   try {
      sound.stop?.()
   } catch (_error) {
      undefined
   }
   loopingSounds.delete(key)
}
