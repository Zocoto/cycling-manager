import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";

const SPONSOR_ASSETS_ROOT = path.join(
  process.cwd(),
  "public",
  "images",
  "sponsors",
);
const EXPECTED_WIDTH = 600;
const EXPECTED_HEIGHT = 750;
const JERSEY_FILE_PATTERN = /^jersey-(classic|modern|bold)\.webp$/;
const AUDIT_CONCURRENCY = 8;

export function detectOpaqueSideMattes(data, width, height) {
  const sideBandWidth = Math.max(4, Math.round(width * 0.02));
  const requiredOpaqueRows = Math.ceil(height * 0.9);

  function isNearBlackOpaque(offset) {
    return (
      data[offset + 3] >= 240 &&
      data[offset] < 35 &&
      data[offset + 1] < 35 &&
      data[offset + 2] < 35
    );
  }

  function qualifyingColumns(start, end) {
    const columns = [];

    for (let x = start; x < end; x += 1) {
      let opaqueRows = 0;

      for (let y = 0; y < height; y += 1) {
        const offset = (y * width + x) * 4;

        if (isNearBlackOpaque(offset)) {
          opaqueRows += 1;
        }
      }

      if (opaqueRows >= requiredOpaqueRows) {
        columns.push(x);
      }
    }

    return columns;
  }

  const leftColumns = qualifyingColumns(0, sideBandWidth);
  const rightColumns = qualifyingColumns(width - sideBandWidth, width);

  return {
    hasSideMattes: leftColumns.length >= 2 && rightColumns.length >= 2,
    leftColumns,
    rightColumns,
  };
}

async function findJerseyAssets() {
  const sponsorDirectories = await readdir(SPONSOR_ASSETS_ROOT, {
    withFileTypes: true,
  });
  const assets = [];

  for (const sponsorDirectory of sponsorDirectories) {
    if (!sponsorDirectory.isDirectory()) {
      continue;
    }

    const sponsorPath = path.join(
      SPONSOR_ASSETS_ROOT,
      sponsorDirectory.name,
    );
    const entries = await readdir(sponsorPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && JERSEY_FILE_PATTERN.test(entry.name)) {
        assets.push(path.join(sponsorPath, entry.name));
      }
    }
  }

  return assets.sort();
}

async function auditJersey(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const failures = [];

  if (info.width !== EXPECTED_WIDTH || info.height !== EXPECTED_HEIGHT) {
    failures.push(
      `dimensions ${info.width}x${info.height} au lieu de ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`,
    );
  }

  let hasTransparentPixel = false;

  for (let offset = 3; offset < data.length; offset += 4) {
    if (data[offset] < 250) {
      hasTransparentPixel = true;
      break;
    }
  }

  if (!hasTransparentPixel) {
    failures.push("fond entièrement opaque");
  }

  const sideMatteResult = detectOpaqueSideMattes(
    data,
    info.width,
    info.height,
  );

  if (sideMatteResult.hasSideMattes) {
    failures.push(
      `bordures latérales opaques détectées (gauche: ${sideMatteResult.leftColumns.join(",")}; droite: ${sideMatteResult.rightColumns.join(",")})`,
    );
  }

  return failures;
}

async function main() {
  const assets = await findJerseyAssets();
  const failures = [];
  let nextAssetIndex = 0;

  async function auditWorker() {
    while (nextAssetIndex < assets.length) {
      const assetIndex = nextAssetIndex;
      nextAssetIndex += 1;
      const asset = assets[assetIndex];
      const assetFailures = await auditJersey(asset);

      if (assetFailures.length > 0) {
        failures.push({
          asset: path.relative(process.cwd(), asset).replaceAll("\\", "/"),
          failures: assetFailures,
        });
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(AUDIT_CONCURRENCY, assets.length) },
      () => auditWorker(),
    ),
  );
  failures.sort((left, right) => left.asset.localeCompare(right.asset));

  if (failures.length > 0) {
    console.error(
      `Audit maillots sponsors: ${failures.length} asset(s) non conforme(s) sur ${assets.length}.`,
    );

    for (const failure of failures) {
      console.error(`- ${failure.asset}: ${failure.failures.join("; ")}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log(
    `Audit maillots sponsors: ${assets.length} asset(s) conformes (600x750, alpha, aucune bordure latérale opaque).`,
  );
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);

if (isDirectExecution) {
  await main();
}
