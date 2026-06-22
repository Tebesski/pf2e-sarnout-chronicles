import { compilePack } from "@foundryvtt/foundryvtt-cli"
import fs from "fs"
import path from "path"

const srcDir = path.resolve(process.cwd(), "packs/src")
const dbDir = path.resolve(process.cwd(), "packs/db")

if (!fs.existsSync(dbDir)) {
   fs.mkdirSync(dbDir, { recursive: true })
}

const packs = fs
   .readdirSync(srcDir)
   .filter((f) => fs.statSync(path.join(srcDir, f)).isDirectory())

for (const pack of packs) {
   await compilePack(path.join(srcDir, pack), path.join(dbDir, pack))
}
