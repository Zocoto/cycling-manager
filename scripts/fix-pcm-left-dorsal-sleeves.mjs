import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const ROOT = path.resolve("assets/pcm/teams");
const REVIEW_ROOT = path.resolve(
  process.env.PCM_SLEEVE_REVIEW_ROOT ??
    "C:/Dev/pcm26-bridge-lab/sleeve-fix-review",
);
const APPLY = process.argv.includes("--apply");
const PACKAGE_ROOT = path.resolve(
  process.env.PCM_PACKAGE_ROOT ??
    "C:/Dev/pcm26-bridge-lab/Cyclostratege-PCMAssets-Mod",
);

// The rear panel spans x=642..1199. Its sleeve islands are symmetrical around
// the panel centre, so mirroring the completed right sleeve is lossless and
// keeps the PCM26 UV geometry pixel-exact.
const TARGET = { left: 642, top: 135, width: 140, height: 230 };
const SOURCE = { left: 1060, top: 135, width: 140, height: 230 };

const TEAMS = [
  { slug: "abbaye-du-lion", code: "ADL" },
  { slug: "ardennes-outillage", code: "ARO" },
  { slug: "cidrerie-aulne", code: "AUL" },
  { slug: "lilangeni-ingilazi", code: "LIL" },
  { slug: "vereda-nova-automoveis", code: "VNA" },
  { slug: "yukikaze-outdoor", code: "YUK" },
  { slug: "atlas-racing-lab", code: "ARL" },
];

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function mirrorSleeve(sourcePath, outputPath) {
  const sourceBuffer = await sharp(sourcePath).png().toBuffer();
  const mirroredSleeve = await sharp(sourceBuffer)
    .extract(SOURCE)
    .flop()
    .png()
    .toBuffer();

  await sharp(sourceBuffer)
    .composite([{ input: mirroredSleeve, left: TARGET.left, top: TARGET.top }])
    .png()
    .toFile(outputPath);
}

async function updateManifest(manifestPath, assetPaths, generatedAt) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.generatedAt = generatedAt;
  for (const asset of manifest.assets ?? []) {
    const assetPath = assetPaths.get(asset.file);
    if (assetPath) asset.sha256 = await sha256(assetPath);
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

await mkdir(REVIEW_ROOT, { recursive: true });

const results = [];
for (const { slug, code } of TEAMS) {
  const sourcePath = path.join(ROOT, slug, `${code}_maillot.png`);
  const outputPath = APPLY
    ? sourcePath
    : path.join(REVIEW_ROOT, `${code}_maillot.png`);
  await mirrorSleeve(sourcePath, outputPath);

  results.push({ slug, code, sourcePath, outputPath });
}

if (APPLY) {
  const generatedAt = new Date().toISOString();
  for (const { slug, code, sourcePath } of results) {
    const repositoryDirectory = path.join(ROOT, slug);
    const repositoryPreviewPath = path.join(
      repositoryDirectory,
      `${code}_preview.png`,
    );
    const texturePreview = await sharp(sourcePath)
      .resize({ width: 930, height: 640, fit: "contain" })
      .png()
      .toBuffer();
    const refreshedPreview = await sharp(repositoryPreviewPath)
      .composite([{ input: texturePreview, left: 570, top: 245 }])
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
    await writeFile(repositoryPreviewPath, refreshedPreview);

    const packageDirectory = path.join(
      PACKAGE_ROOT,
      "SourceAssets",
      "Teams",
      code,
    );
    const packageTexturePath = path.join(packageDirectory, `${code}_maillot.png`);
    const packageUvSourcePath = path.join(packageDirectory, `${code}_uv-source.png`);
    const packagePreviewPath = path.join(packageDirectory, `${code}_preview.png`);
    await copyFile(sourcePath, packageTexturePath);
    await mirrorSleeve(packageUvSourcePath, packageUvSourcePath);
    await copyFile(repositoryPreviewPath, packagePreviewPath);

    const repositoryManifestPath = path.join(repositoryDirectory, "manifest.json");
    const packageManifestPath = path.join(packageDirectory, "manifest.json");
    await updateManifest(
      repositoryManifestPath,
      new Map([
        [`${code}_maillot.png`, sourcePath],
        [`${code}_preview.png`, repositoryPreviewPath],
      ]),
      generatedAt,
    );
    await updateManifest(
      packageManifestPath,
      new Map([
        [`${code}_maillot.png`, packageTexturePath],
        [`${code}_preview.png`, packagePreviewPath],
      ]),
      generatedAt,
    );
  }
}

let contactSheetPath = null;
if (!APPLY) {
  const tiles = await Promise.all(
    results.map(async ({ code, sourcePath, outputPath }) => {
      const [before, after] = await Promise.all([
        sharp(sourcePath).extract(TARGET).resize(240, 394).png().toBuffer(),
        sharp(outputPath).extract(TARGET).resize(240, 394).png().toBuffer(),
      ]);
      const label = Buffer.from(`
        <svg width="500" height="430" xmlns="http://www.w3.org/2000/svg">
          <rect width="500" height="430" fill="#f6f3ed"/>
          <text x="10" y="22" font-family="Arial" font-size="16" font-weight="700" fill="#19211e">${code}</text>
          <text x="10" y="424" font-family="Arial" font-size="12" fill="#59615d">avant</text>
          <text x="260" y="424" font-family="Arial" font-size="12" fill="#59615d">après</text>
        </svg>`);
      return sharp(label)
        .composite([
          { input: before, left: 5, top: 28 },
          { input: after, left: 255, top: 28 },
        ])
        .png()
        .toBuffer();
    }),
  );
  const columns = 2;
  const tileWidth = 500;
  const tileHeight = 430;
  contactSheetPath = path.join(REVIEW_ROOT, "sleeve-fix-contact-sheet.png");
  await sharp({
    create: {
      width: columns * tileWidth,
      height: Math.ceil(tiles.length / columns) * tileHeight,
      channels: 4,
      background: "#dedbd4",
    },
  })
    .composite(
      tiles.map((input, index) => ({
        input,
        left: (index % columns) * tileWidth,
        top: Math.floor(index / columns) * tileHeight,
      })),
    )
    .png()
    .toFile(contactSheetPath);

  const fullTiles = await Promise.all(
    results.map(async ({ code, outputPath }) => {
      const jersey = await sharp(outputPath).resize(600, 413).png().toBuffer();
      const label = Buffer.from(`
        <svg width="600" height="438" xmlns="http://www.w3.org/2000/svg">
          <rect width="600" height="438" fill="#f6f3ed"/>
          <text x="10" y="20" font-family="Arial" font-size="15" font-weight="700" fill="#19211e">${code} — patron corrigé</text>
        </svg>`);
      return sharp(label)
        .composite([{ input: jersey, left: 0, top: 25 }])
        .png()
        .toBuffer();
    }),
  );
  const fullContactSheetPath = path.join(
    REVIEW_ROOT,
    "sleeve-fix-full-contact-sheet.png",
  );
  await sharp({
    create: {
      width: columns * 600,
      height: Math.ceil(fullTiles.length / columns) * 438,
      channels: 4,
      background: "#dedbd4",
    },
  })
    .composite(
      fullTiles.map((input, index) => ({
        input,
        left: (index % columns) * 600,
        top: Math.floor(index / columns) * 438,
      })),
    )
    .png()
    .toFile(fullContactSheetPath);
}

console.log(
  JSON.stringify(
    { apply: APPLY, target: TARGET, source: SOURCE, contactSheetPath, results },
    null,
    2,
  ),
);
