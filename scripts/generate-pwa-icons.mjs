import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const logoPath = path.join(
  projectDirectory,
  "public",
  "logo-cyclo-stratege.png",
);
const pwaDirectory = path.join(projectDirectory, "public", "pwa");

await mkdir(pwaDirectory, { recursive: true });

async function createIcon({ size, contentRatio, destination }) {
  const logoSize = Math.round(size * contentRatio);
  const logo = await sharp(logoPath)
    .trim()
    .resize(logoSize, logoSize, { fit: "contain" })
    .png()
    .toBuffer();
  const glow = Buffer.from(`
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="glow" cx="68%" cy="28%" r="82%">
          <stop offset="0" stop-color="#176951" />
          <stop offset="0.58" stop-color="#0B302B" />
          <stop offset="1" stop-color="#071A17" />
        </radialGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${Math.round(size * 0.2)}" fill="url(#glow)" />
      <circle cx="${Math.round(size * 0.83)}" cy="${Math.round(size * 0.16)}" r="${Math.round(size * 0.2)}" fill="none" stroke="#42CDA8" stroke-opacity="0.12" stroke-width="${Math.max(2, Math.round(size * 0.035))}" />
      <rect y="${size - Math.max(3, Math.round(size * 0.018))}" width="${size}" height="${Math.max(3, Math.round(size * 0.018))}" fill="#F2C94C" />
    </svg>
  `);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: "#071A17",
    },
  })
    .composite([
      { input: glow },
      { input: logo, gravity: "centre" },
    ])
    .png({ compressionLevel: 9, palette: true })
    .toFile(destination);
}

await Promise.all([
  createIcon({
    size: 192,
    contentRatio: 0.76,
    destination: path.join(pwaDirectory, "icon-192.png"),
  }),
  createIcon({
    size: 512,
    contentRatio: 0.76,
    destination: path.join(pwaDirectory, "icon-512.png"),
  }),
  createIcon({
    size: 512,
    contentRatio: 0.58,
    destination: path.join(pwaDirectory, "icon-maskable-512.png"),
  }),
  createIcon({
    size: 180,
    contentRatio: 0.72,
    destination: path.join(projectDirectory, "app", "apple-icon.png"),
  }),
]);

console.log("PWA icons generated.");
