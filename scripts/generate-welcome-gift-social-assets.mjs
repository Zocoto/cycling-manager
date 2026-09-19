import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import sharp from "sharp";

const root = process.cwd();
const backgroundPath = resolve(root, "public/images/peloton-header.webp");
const logoPath = resolve(root, "public/logo-cyclo-stratege.png");

const assets = [
  {
    output: resolve(root, "public/social/cadeau-bienvenue-feed.png"),
    width: 1080,
    height: 1350,
    titleY: 350,
    cardY: 680,
    footerY: 1255,
  },
  {
    output: resolve(root, "public/social/cadeau-bienvenue-story.png"),
    width: 1080,
    height: 1920,
    titleY: 560,
    cardY: 980,
    footerY: 1760,
  },
];

const logo = await sharp(logoPath).resize(132, 132).png().toBuffer();

for (const asset of assets) {
  await mkdir(dirname(asset.output), { recursive: true });

  const background = await sharp(backgroundPath)
    .resize(asset.width, asset.height, {
      fit: "cover",
      position: "right",
    })
    .modulate({ brightness: 0.72, saturation: 0.9 })
    .toBuffer();

  const cardWidth = 438;
  const cardHeight = asset.height > 1500 ? 260 : 235;
  const cardGap = 24;
  const cardX = 76;
  const secondCardX = cardX + cardWidth + cardGap;
  const titleSize = asset.height > 1500 ? 104 : 92;
  const titleLineHeight = Math.round(titleSize * 0.94);

  const overlay = Buffer.from(`
    <svg width="${asset.width}" height="${asset.height}" viewBox="0 0 ${asset.width} ${asset.height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#071A17" stop-opacity="0.91"/>
          <stop offset="0.58" stop-color="#071A17" stop-opacity="0.68"/>
          <stop offset="1" stop-color="#071A17" stop-opacity="0.96"/>
        </linearGradient>
        <linearGradient id="card" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#0B302B" stop-opacity="0.97"/>
          <stop offset="1" stop-color="#176951" stop-opacity="0.94"/>
        </linearGradient>
      </defs>

      <rect width="100%" height="100%" fill="url(#shade)"/>
      <rect x="0" y="0" width="18" height="100%" fill="#42CDA8"/>
      <rect x="76" y="${asset.titleY - 150}" width="650" height="50" rx="25" fill="#F2C94C"/>
      <text x="104" y="${asset.titleY - 116}" fill="#071A17" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900" letter-spacing="2.6">CADEAU DE BIENVENUE · OFFRE LIMITÉE</text>

      <text x="74" y="${asset.titleY}" fill="#FFFDF4" font-family="Arial Black, Arial, sans-serif" font-size="${titleSize}" font-weight="900" letter-spacing="-3">PRENEZ UNE</text>
      <text x="72" y="${asset.titleY + titleLineHeight}" fill="#F2C94C" font-family="Arial Black, Arial, sans-serif" font-size="${titleSize}" font-weight="900" letter-spacing="-3">ROUE D’AVANCE</text>
      <rect x="78" y="${asset.titleY + titleLineHeight + 48}" width="112" height="9" rx="4.5" fill="#42CDA8"/>

      <rect x="${cardX}" y="${asset.cardY}" width="${cardWidth}" height="${cardHeight}" rx="30" fill="url(#card)" stroke="#8DE3C9" stroke-opacity="0.52" stroke-width="2"/>
      <text x="${cardX + 32}" y="${asset.cardY + 62}" fill="#8DE3C9" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="800" letter-spacing="2.5">BUDGET DE DÉPART</text>
      <text x="${cardX + 30}" y="${asset.cardY + 145}" fill="#F2C94C" font-family="Arial Black, Arial, sans-serif" font-size="67" font-weight="900">15 000 €</text>
      <text x="${cardX + 32}" y="${asset.cardY + 195}" fill="#D6DFD2" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700">+ 5 000 € pour se lancer</text>

      <rect x="${secondCardX}" y="${asset.cardY}" width="${cardWidth}" height="${cardHeight}" rx="30" fill="url(#card)" stroke="#8DE3C9" stroke-opacity="0.52" stroke-width="2"/>
      <text x="${secondCardX + 32}" y="${asset.cardY + 62}" fill="#8DE3C9" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="800" letter-spacing="2.5">VOTRE PREMIER EXPERT</text>
      <text x="${secondCardX + 30}" y="${asset.cardY + 145}" fill="#F2C94C" font-family="Arial Black, Arial, sans-serif" font-size="61" font-weight="900">SCOUT N3</text>
      <text x="${secondCardX + 32}" y="${asset.cardY + 195}" fill="#D6DFD2" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700">Déjà dans votre staff</text>

      <text x="76" y="${asset.footerY - 66}" fill="#8DE3C9" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="800" letter-spacing="3.2">JEU DE MANAGEMENT CYCLISTE · GRATUIT · SUR NAVIGATEUR</text>
      <text x="76" y="${asset.footerY}" fill="#FFFDF4" font-family="Arial Black, Arial, sans-serif" font-size="37" font-weight="900" letter-spacing="1">CYCLOSTRATEGE.FR/INSCRIPTION</text>
    </svg>
  `);

  await sharp(background)
    .composite([
      { input: overlay, left: 0, top: 0 },
      { input: logo, left: 76, top: 70 },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(asset.output);
}

console.log(
  [
    "Visuels du cadeau de bienvenue générés :",
    ...assets.map((asset) => asset.output),
  ].join("\n"),
);
