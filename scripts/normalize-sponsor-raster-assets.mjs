import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";

const TARGETS = {
  logo: {
    width: 512,
    height: 512,
    padding: 26,
  },
  jersey: {
    width: 600,
    height: 750,
    padding: 8,
  },
};

function isBackgroundCandidate(red, green, blue) {
  const minimum = Math.min(red, green, blue);
  const maximum = Math.max(red, green, blue);

  return minimum >= 205 && maximum - minimum <= 16;
}

function findLargestOpaqueComponent(data, width, height) {
  const pixelCount = width * height;
  const background = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let queueStart = 0;
  let queueEnd = 0;

  function enqueueBackground(index) {
    if (background[index] !== 0) {
      return;
    }

    const offset = index * 4;

    if (
      !isBackgroundCandidate(
        data[offset],
        data[offset + 1],
        data[offset + 2]
      )
    ) {
      return;
    }

    background[index] = 1;
    queue[queueEnd] = index;
    queueEnd += 1;
  }

  for (let x = 0; x < width; x += 1) {
    enqueueBackground(x);
    enqueueBackground((height - 1) * width + x);
  }

  for (let y = 0; y < height; y += 1) {
    enqueueBackground(y * width);
    enqueueBackground(y * width + width - 1);
  }

  while (queueStart < queueEnd) {
    const index = queue[queueStart];
    queueStart += 1;

    const x = index % width;
    const y = Math.floor(index / width);

    if (x > 0) enqueueBackground(index - 1);
    if (x + 1 < width) enqueueBackground(index + 1);
    if (y > 0) enqueueBackground(index - width);
    if (y + 1 < height) enqueueBackground(index + width);
  }

  const visited = new Uint8Array(pixelCount);
  let largestComponent = [];

  for (let start = 0; start < pixelCount; start += 1) {
    if (background[start] !== 0 || visited[start] !== 0) {
      continue;
    }

    const component = [];
    queueStart = 0;
    queueEnd = 0;
    queue[queueEnd] = start;
    queueEnd += 1;
    visited[start] = 1;

    while (queueStart < queueEnd) {
      const index = queue[queueStart];
      queueStart += 1;
      component.push(index);

      const x = index % width;
      const y = Math.floor(index / width);

      const neighbors = [];

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;

          const neighborX = x + offsetX;
          const neighborY = y + offsetY;

          if (
            neighborX >= 0 &&
            neighborX < width &&
            neighborY >= 0 &&
            neighborY < height
          ) {
            neighbors.push(neighborY * width + neighborX);
          }
        }
      }

      for (const neighbor of neighbors) {
        if (background[neighbor] === 0 && visited[neighbor] === 0) {
          visited[neighbor] = 1;
          queue[queueEnd] = neighbor;
          queueEnd += 1;
        }
      }
    }

    if (component.length > largestComponent.length) {
      largestComponent = component;
    }
  }

  const alpha = new Uint8Array(pixelCount);

  for (const index of largestComponent) {
    alpha[index] = 255;
  }

  return alpha;
}

function getAlphaBounds(alpha, width, height) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alpha[y * width + x] === 0) {
        continue;
      }

      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) {
    throw new Error("Aucun sujet opaque détecté dans l’image.");
  }

  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

async function normalizeAsset({ source, destination, kind }) {
  const target = TARGETS[kind];

  if (!target) {
    throw new Error(`Type d’asset inconnu : ${kind}`);
  }

  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = info.width * info.height;
  const sourceAlpha = new Uint8Array(pixelCount);
  let hasTransparency = false;

  for (let index = 0; index < pixelCount; index += 1) {
    const alphaValue = data[index * 4 + 3];
    sourceAlpha[index] = alphaValue;

    if (alphaValue < 250) {
      hasTransparency = true;
    }
  }

  const alpha = hasTransparency
    ? sourceAlpha
    : findLargestOpaqueComponent(data, info.width, info.height);

  for (let index = 0; index < pixelCount; index += 1) {
    data[index * 4 + 3] = alpha[index];
  }

  const bounds = getAlphaBounds(alpha, info.width, info.height);
  const availableWidth = target.width - target.padding * 2;
  const availableHeight = target.height - target.padding * 2;

  await mkdir(path.dirname(destination), { recursive: true });

  const cropped = await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .extract(bounds)
    .resize({
      width: availableWidth,
      height: availableHeight,
      fit: "contain",
      kernel: sharp.kernel.lanczos3,
    })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toBuffer();

  const resizedMetadata = await sharp(cropped).metadata();
  const left = Math.floor((target.width - resizedMetadata.width) / 2);
  const top = Math.floor((target.height - resizedMetadata.height) / 2);

  const output = sharp({
    create: {
      width: target.width,
      height: target.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: cropped, left, top }]);

  if (path.extname(destination).toLowerCase() === ".webp") {
    await output
      .webp({
        quality: 88,
        alphaQuality: 100,
        effort: 6,
        smartSubsample: true,
      })
      .toFile(destination);
  } else {
    await output
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
      })
      .toFile(destination);
  }

  console.log(`${kind.padEnd(6)} ${destination}`);
}

async function createReviewSheet(assets, destination) {
  const sponsors = new Map();

  for (const asset of assets) {
    const sponsorId = path.basename(path.dirname(asset.destination));
    const filename = path.basename(asset.destination);

    if (!sponsors.has(sponsorId)) {
      sponsors.set(sponsorId, new Map());
    }

    sponsors.get(sponsorId).set(filename, asset.destination);
  }

  const entries = [...sponsors.entries()];
  const columnCount = 2;
  const panelWidth = 900;
  const panelHeight = 400;
  const width = panelWidth * columnCount;
  const height = Math.ceil(entries.length / columnCount) * panelHeight;
  const composites = [];

  for (const [index, [sponsorId, sponsorAssets]] of entries.entries()) {
    const originX = (index % columnCount) * panelWidth;
    const originY = Math.floor(index / columnCount) * panelHeight;
    const labelSvg = Buffer.from(
      `<svg width="${panelWidth}" height="${panelHeight}">
        <text x="24" y="38" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#123C33">${sponsorId}</text>
        <text x="40" y="370" font-family="Arial, sans-serif" font-size="18" fill="#5B716A">logo</text>
        <text x="250" y="370" font-family="Arial, sans-serif" font-size="18" fill="#5B716A">classic</text>
        <text x="470" y="370" font-family="Arial, sans-serif" font-size="18" fill="#5B716A">modern</text>
        <text x="690" y="370" font-family="Arial, sans-serif" font-size="18" fill="#5B716A">bold</text>
        <line x1="0" y1="399" x2="${panelWidth}" y2="399" stroke="#DCE6E1"/>
      </svg>`
    );

    composites.push({ input: labelSvg, left: originX, top: originY });

    const slots = [
      ["logo", 24, 70, 180, 220],
      ["jersey-classic", 220, 65, 200, 270],
      ["jersey-modern", 440, 65, 200, 270],
      ["jersey-bold", 660, 65, 200, 270],
    ];

    for (const [basename, left, top, slotWidth, slotHeight] of slots) {
      const assetPath =
        sponsorAssets.get(`${basename}.webp`) ??
        sponsorAssets.get(`${basename}.png`);

      if (!assetPath) continue;

      const input = await sharp(assetPath)
        .resize({
          width: slotWidth,
          height: slotHeight,
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

      composites.push({
        input,
        left: originX + left,
        top: originY + top,
      });
    }
  }

  await mkdir(path.dirname(destination), { recursive: true });

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 248, g: 250, b: 249, alpha: 1 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(destination);

  console.log(`review ${destination}`);
}

async function convertPngSponsorDirectories(sponsorIds) {
  const filenames = [
    "logo",
    "jersey-classic",
    "jersey-modern",
    "jersey-bold",
  ];

  for (const sponsorId of sponsorIds) {
    for (const filename of filenames) {
      const source = path.join(
        "public",
        "images",
        "sponsors",
        sponsorId,
        `${filename}.png`,
      );
      const destination = path.join(
        "public",
        "images",
        "sponsors",
        sponsorId,
        `${filename}.webp`,
      );

      await sharp(source)
        .webp({
          quality: 88,
          alphaQuality: 100,
          effort: 6,
          smartSubsample: true,
        })
        .toFile(destination);

      console.log(`webp   ${destination}`);
    }
  }
}

async function main() {
  const command = process.argv[2];

  if (command === "--convert-png-to-webp") {
    const sponsorIds = process.argv.slice(3);

    if (sponsorIds.length === 0) {
      throw new Error("Au moins un identifiant sponsor est requis.");
    }

    await convertPngSponsorDirectories(sponsorIds);
    return;
  }

  const manifestPath = command;

  if (!manifestPath) {
    throw new Error(
      "Usage : node scripts/normalize-sponsor-raster-assets.mjs <manifest.json>"
    );
  }

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  for (const asset of manifest.assets) {
    await normalizeAsset(asset);
  }

  if (manifest.reviewDestination) {
    await createReviewSheet(manifest.assets, manifest.reviewDestination);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
