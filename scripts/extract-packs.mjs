import { extractPack } from "@foundryvtt/foundryvtt-cli"
import fs from "fs"
import path from "path"

const srcDir = path.resolve(process.cwd(), "packs/src")
const dbDir = path.resolve(process.cwd(), "packs/db")

if (!fs.existsSync(srcDir)) {
   fs.mkdirSync(srcDir, { recursive: true })
}

const packs = fs
   .readdirSync(dbDir)
   .filter((f) => fs.statSync(path.join(dbDir, f)).isDirectory())

for (const pack of packs) {
   await extractPack(path.join(dbDir, pack), path.join(srcDir, pack))
}

console.log("Extraction complete.")
