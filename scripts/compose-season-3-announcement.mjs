import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import sharp from "sharp";

const sourcePath = process.argv[2];

if (!sourcePath) {
  throw new Error("Usage: node scripts/compose-season-3-announcement.mjs <source-image>");
}

const root = process.cwd();
const websitePath = resolve(
  root,
  "public/images/announcements/saison-3-federations.webp",
);
const instagramPath = resolve(
  root,
  "public/social/saison-3-federations-instagram.png",
);
const logoPath = resolve(root, "public/logo-cyclo-stratege.png");

await Promise.all([
  mkdir(dirname(websitePath), { recursive: true }),
  mkdir(dirname(instagramPath), { recursive: true }),
]);

const background = await sharp(sourcePath)
  .resize(1080, 1080, { fit: "cover", position: "centre" })
  .webp({ quality: 88, smartSubsample: true })
  .toBuffer();

await sharp(background).toFile(websitePath);

const logo = await sharp(logoPath)
  .resize(128, 128)
  .composite([
    {
      input: Buffer.from(
        '<svg width="128" height="128"><circle cx="64" cy="64" r="64" fill="white"/></svg>',
      ),
      blend: "dest-in",
    },
  ])
  .png()
  .toBuffer();

const typography = Buffer.from(`
  <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="topShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#071A17" stop-opacity="0.94"/>
        <stop offset="0.62" stop-color="#071A17" stop-opacity="0.75"/>
        <stop offset="1" stop-color="#071A17" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="bottomShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#071A17" stop-opacity="0"/>
        <stop offset="1" stop-color="#071A17" stop-opacity="0.88"/>
      </linearGradient>
    </defs>

    <rect width="1080" height="570" fill="url(#topShade)"/>
    <rect y="790" width="1080" height="290" fill="url(#bottomShade)"/>

    <text x="76" y="82" fill="#8DE3C9" font-family="Arial, sans-serif" font-size="23" font-weight="700" letter-spacing="5">UNE NOUVELLE ÈRE COMMENCE</text>
    <text x="72" y="228" fill="#F2C94C" font-family="Arial Black, Arial, sans-serif" font-size="132" font-weight="900" letter-spacing="-4">SAISON 3</text>
    <rect x="76" y="265" width="176" height="8" rx="4" fill="#42CDA8"/>
    <text x="74" y="350" fill="#FFFDF4" font-family="Arial, sans-serif" font-size="52" font-weight="700" letter-spacing="1">LE POUVOIR AUX</text>
    <text x="70" y="434" fill="#FFFDF4" font-family="Arial Black, Arial, sans-serif" font-size="77" font-weight="900" letter-spacing="-1">FÉDÉRATIONS</text>

    <circle cx="140" cy="970" r="70" fill="#F2C94C"/>
    <text x="234" y="960" fill="#FFFDF4" font-family="Arial Black, Arial, sans-serif" font-size="35" font-weight="900" letter-spacing="1">CYCLO STRATÈGE</text>
    <text x="236" y="997" fill="#8DE3C9" font-family="Arial, sans-serif" font-size="19" font-weight="700" letter-spacing="3">JEU DE MANAGEMENT CYCLISTE</text>
  </svg>
`);

await sharp(background)
  .composite([
    { input: typography, left: 0, top: 0 },
    { input: logo, left: 76, top: 906 },
  ])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(instagramPath);

console.log(websitePath);
console.log(instagramPath);
