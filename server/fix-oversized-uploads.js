/**
 * One-time / maintenance: shrink existing uploads larger than WebGL limits.
 * Usage: npm run fix-uploads   (run from repo root while server is stopped)
 */
import path from "path";
import { fileURLToPath } from "url";
import { readdir } from "fs/promises";
import { capImageFileForWebGL } from "./utils/capImageForWebGL.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "../public/uploads");

async function main() {
  const files = await readdir(uploadsDir);
  let count = 0;
  for (const name of files) {
    if (!/\.(jpe?g|png|webp)$/i.test(name)) continue;
    const absPath = path.join(uploadsDir, name);
    const r = await capImageFileForWebGL(absPath);
    if (r.resized) {
      count++;
      console.log(`Resized ${name} → ${r.width}×${r.height}`);
    }
  }
  console.log(count ? `Done. Resized ${count} file(s).` : "Done. No oversized images found.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
