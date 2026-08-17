import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const projectRoot = process.cwd();
const logoPath = path.join(
  projectRoot,
  "public",
  "logo-cyclo-stratege.png",
);

const instagramOutputDirectory = path.join(
  projectRoot,
  "Docs",
  "marketing",
  "instagram",
);

await mkdir(instagramOutputDirectory, { recursive: true });

const assets = [
  {
    output: path.join(
      projectRoot,
      "public",
      "images",
      "marketing",
      "season-2-beta-editorial-en.png",
    ),
    width: 1200,
    height: 630,
    logoWidth: 104,
    logoX: 66,
    logoY: 52,
    eyebrow: "SEASON 2 · BETA TEST",
    title: ["LEAD THE", "PELOTON"],
    body: "BUILD YOUR TEAM · WRITE YOUR STORY",
    footer: "JOIN THE BETA",
  },
  {
    output: path.join(projectRoot, "app", "opengraph-image.png"),
    width: 1200,
    height: 630,
    logoWidth: 104,
    logoX: 66,
    logoY: 52,
    eyebrow: "CYCLO STRATÈGE · SAISON 2",
    title: ["LA BÊTA", "EST OUVERTE"],
    body: "LE JEU DE MANAGEMENT CYCLISTE EN LIGNE",
    footer: "CYCLOSTRATEGE.FR",
  },
  {
    output: path.join(
      projectRoot,
      "public",
      "images",
      "marketing",
      "season-2-beta-editorial.png",
    ),
    width: 1200,
    height: 630,
    logoWidth: 104,
    logoX: 66,
    logoY: 52,
    eyebrow: "SAISON 2 · BÊTA TEST",
    title: ["PRENEZ LA TÊTE", "DU PELOTON"],
    body: "CRÉEZ VOTRE ÉQUIPE · ÉCRIVEZ VOTRE HISTOIRE",
    footer: "REJOINDRE LA BÊTA",
  },
  {
    output: path.join(
      instagramOutputDirectory,
      "season-2-beta-carousel-01.png",
    ),
    width: 1080,
    height: 1350,
    logoWidth: 132,
    logoX: 64,
    logoY: 64,
    eyebrow: "CYCLO STRATÈGE · SAISON 2",
    title: ["LA BÊTA", "EST OUVERTE"],
    body: "PRENEZ LA TÊTE DU PELOTON",
    footer: "CYCLOSTRATEGE.FR",
  },
  {
    output: path.join(
      instagramOutputDirectory,
      "season-2-beta-carousel-02.png",
    ),
    width: 1080,
    height: 1350,
    logoWidth: 132,
    logoX: 64,
    logoY: 64,
    eyebrow: "VOTRE CARRIÈRE",
    title: ["BÂTISSEZ", "VOTRE ÉQUIPE"],
    body: "RECRUTEMENT · ENTRAÎNEMENT · MATÉRIEL · STRATÉGIE",
    footer: "CHAQUE DÉCISION COMPTE",
  },
  {
    output: path.join(
      instagramOutputDirectory,
      "season-2-beta-carousel-03.png",
    ),
    width: 1080,
    height: 1350,
    logoWidth: 132,
    logoX: 64,
    logoY: 64,
    eyebrow: "SAISON 2 · BÊTA TEST",
    title: ["REJOIGNEZ", "LE PELOTON"],
    body: "JOUEZ · TESTEZ · PARTAGEZ VOS RETOURS",
    footer: "LIEN EN BIO",
  },
  {
    output: path.join(
      instagramOutputDirectory,
      "season-2-beta-story.png",
    ),
    width: 1080,
    height: 1920,
    logoWidth: 144,
    logoX: 64,
    logoY: 88,
    eyebrow: "CYCLO STRATÈGE · SAISON 2",
    title: ["VOTRE NOUVELLE", "SAISON COMMENCE"],
    body: "LA BÊTA EST OUVERTE",
    footer: "REJOINDRE LE JEU",
  },
];

for (const asset of assets) {
  await mkdir(path.dirname(asset.output), { recursive: true });
  await createAsset(asset);
}

await sharp(path.join(projectRoot, "app", "opengraph-image.png"))
  .toFile(path.join(projectRoot, "app", "twitter-image.png"));

console.log(
  [
    "Assets marketing Saison 2 générés :",
    ...assets.map((asset) => path.relative(projectRoot, asset.output)),
    "app/twitter-image.png",
  ].join("\n"),
);

async function createAsset({
  output,
  width,
  height,
  logoWidth,
  logoX,
  logoY,
  eyebrow,
  title,
  body,
  footer,
}) {
  const isWide = width / height > 1.5;
  const titleFontSize = isWide ? 76 : height > 1600 ? 102 : 96;
  const titleLineHeight = Math.round(titleFontSize * 0.94);
  const contentX = isWide ? 66 : 64;
  const titleY = isWide ? 255 : height > 1600 ? 650 : 520;
  const bodyY =
    titleY + title.length * titleLineHeight + (isWide ? 34 : 54);
  const footerY = height - (isWide ? 58 : height > 1600 ? 150 : 92);
  const eyebrowY = titleY - (isWide ? 70 : 96);
  const logo = await sharp(logoPath)
    .resize({ width: logoWidth })
    .png()
    .toBuffer();

  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#D6DFD2" stroke-opacity="0.065" stroke-width="1"/>
        </pattern>
        <linearGradient id="shade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#071A17" stop-opacity="0.98"/>
          <stop offset="0.52" stop-color="#071A17" stop-opacity="${isWide ? "0.82" : "0.72"}"/>
          <stop offset="1" stop-color="#071A17" stop-opacity="${isWide ? "0.12" : "0.28"}"/>
        </linearGradient>
        <linearGradient id="bottom" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0.35" stop-color="#071A17" stop-opacity="0"/>
          <stop offset="1" stop-color="#071A17" stop-opacity="0.92"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="#071A17"/>
      <rect width="100%" height="100%" fill="url(#grid)"/>
      <rect x="0" y="0" width="20" height="100%" fill="#42CDA8"/>
      <text x="95%" y="42%" text-anchor="end" fill="none" stroke="#42CDA8"
        stroke-opacity="0.28" stroke-width="4" font-family="Arial, Helvetica, sans-serif"
        font-size="300" font-weight="900" letter-spacing="-14">02</text>
      <polyline points="650,390 720,372 790,382 860,345 925,356 995,315 1060,330"
        fill="none" stroke="#F2C94C" stroke-opacity="0.8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="${contentX}" y="${eyebrowY - 31}" width="${Math.min(
        width - contentX * 2,
        eyebrow.length * 13 + 60,
      )}" height="48" rx="24" fill="#F2C94C"/>
      <text x="${contentX + 24}" y="${eyebrowY}" fill="#071A17" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" letter-spacing="2">${escapeXml(
        eyebrow,
      )}</text>
      ${title
        .map(
          (line, index) =>
            `<text x="${contentX}" y="${titleY + index * titleLineHeight}" fill="#FFFDF4" font-family="Arial, Helvetica, sans-serif" font-size="${titleFontSize}" font-weight="900" letter-spacing="-2">${escapeXml(line)}</text>`,
        )
        .join("")}
      <rect x="${contentX}" y="${bodyY - 25}" width="74" height="8" rx="4" fill="#42CDA8"/>
      <text x="${contentX}" y="${bodyY + 35}" fill="#D6DFD2" font-family="Arial, Helvetica, sans-serif" font-size="${isWide ? 24 : 28}" font-weight="700" letter-spacing="1.2">${escapeXml(
        body,
      )}</text>
      <text x="${contentX}" y="${footerY}" fill="#F2C94C" font-family="Arial, Helvetica, sans-serif" font-size="${isWide ? 25 : 30}" font-weight="900" letter-spacing="2.4">${escapeXml(
        footer,
      )}</text>
    </svg>
  `);

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#071A17",
    },
  })
    .composite([
      { input: overlay, left: 0, top: 0 },
      { input: logo, left: logoX, top: logoY },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
