import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

/** Most GPUs/WebGL contexts reject textures wider/taller than 8192 px. */
const MAX_TEXTURE_DIM = 8192;

/**
 * Shrinks oversized images so WebGL loaders (Photo Sphere Viewer / Three.js) succeed.
 * Overwrites file in place. Skips unreadable/non-image suffixes gracefully.
 *
 * @param {string} absPath Absolute path on disk.
 * @returns {Promise<{ resized: boolean; width?: number; height?: number }>}
 */
export async function capImageFileForWebGL(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
    return { resized: false };
  }

  let meta;
  try {
    meta = await sharp(absPath).metadata();
  } catch {
    return { resized: false };
  }

  const w = meta.width || 0;
  const h = meta.height || 0;
  if (!w || !h) return { resized: false };
  if (w <= MAX_TEXTURE_DIM && h <= MAX_TEXTURE_DIM) {
    return { resized: false, width: w, height: h };
  }

  const tmp = `${absPath}.webgl-cap.tmp`;

  const pipeline = sharp(absPath).rotate().resize(MAX_TEXTURE_DIM, MAX_TEXTURE_DIM, {
    fit: "inside",
    withoutEnlargement: true,
  });

  if (ext === ".png") {
    await pipeline.png({ compressionLevel: 6 }).toFile(tmp);
  } else if (ext === ".webp") {
    await pipeline.webp({ quality: 90 }).toFile(tmp);
  } else {
    await pipeline.jpeg({ quality: 92, mozjpeg: true }).toFile(tmp);
  }

  await fs.rename(tmp, absPath);

  const after = await sharp(absPath).metadata();
  return { resized: true, width: after.width, height: after.height };
}
