import { playSound } from "../audio.mjs"

export async function playTemplarSound(src, volume = 1, broadcast = true) {
   return playSound(src, volume, { broadcast })
}
