import { mkdir, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import {
  AIRLINE_SPONSORS,
  TOURISM_SPONSORS,
} from "../data/sponsors/tourism-airlines";
import type { Sponsor } from "../types/sponsor";

const sponsors = [
  ...TOURISM_SPONSORS,
  ...AIRLINE_SPONSORS,
] satisfies readonly Sponsor[];

const sourceDirectory = path.resolve("tmp", "travel-sponsor-sources");
const artworkDirectory = path.resolve(
  "tmp",
  "travel-sponsor-redesign",
  "generated"
);
const outputDirectory = path.resolve("public", "images", "sponsors");
const previewPath = path.resolve(
  "tmp",
  "travel-sponsor-redesign",
  "contact-sheet-final.webp"
);

const jerseyWidth = 600;
const jerseyHeight = 750;
const styles = ["classic", "modern", "bold"] as const;

type JerseyStyle = (typeof styles)[number];

async function main(): Promise<void> {
  const jerseyMask = await prepareJerseyMask();
  const generatedAssets: string[] = [];

  for (const sponsor of sponsors) {
    const sponsorOutputDirectory = path.join(outputDirectory, sponsor.id);
    await mkdir(sponsorOutputDirectory, { recursive: true });

    const logo = await prepareLogo(
      path.join(sourceDirectory, `${sponsor.id}-logo.png`)
    );

    await sharp(logo)
      .webp({
        quality: 84,
        alphaQuality: 100,
        effort: 6,
        smartSubsample: true,
      })
      .toFile(path.join(sponsorOutputDirectory, "logo.webp"));

    for (const style of styles) {
      const artworkPath = path.join(
        artworkDirectory,
        sponsor.id,
        `${style}.png`
      );
      const outputPath = path.join(
        sponsorOutputDirectory,
        `jersey-${style}.webp`
      );

      await stat(artworkPath);

      const jersey = await renderJersey({
        artworkPath,
        jerseyMask,
        logo,
        sponsorId: sponsor.id,
        style,
      });

      await sharp(jersey)
        .webp({
          quality: 78,
          alphaQuality: 100,
          effort: 6,
          smartSubsample: true,
        })
        .toFile(outputPath);

      generatedAssets.push(outputPath);
    }
  }

  await buildContactSheet(generatedAssets);
  await reportAssets(generatedAssets);
}

async function prepareJerseyMask(): Promise<Buffer> {
  const source = await normalizeSourceTransparency(
    path.join(sourceDirectory, "blank-jersey.png")
  );
  const trimmedJersey = await sharp(source)
    .trim({
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(566, 704, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const centeredJersey = await sharp({
    create: {
      width: jerseyWidth,
      height: jerseyHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: trimmedJersey, gravity: "center" }])
    .png()
    .toBuffer();
  const { data, info } = await sharp(centeredJersey)
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cleanAlpha = erodeAlpha(data, info.width, info.height);

  return sharp(cleanAlpha, {
    raw: { width: info.width, height: info.height, channels: 1 },
  })
    .blur(0.35)
    .png()
    .toBuffer();
}

function erodeAlpha(
  alpha: Buffer,
  width: number,
  height: number
): Buffer {
  const result = Buffer.alloc(alpha.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let minimum = 255;

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const sampleX = x + offsetX;
          const sampleY = y + offsetY;

          if (
            sampleX < 0 ||
            sampleX >= width ||
            sampleY < 0 ||
            sampleY >= height
          ) {
            minimum = 0;
            continue;
          }

          minimum = Math.min(
            minimum,
            alpha[sampleY * width + sampleX]
          );
        }
      }

      result[y * width + x] = minimum < 7 ? 0 : minimum;
    }
  }

  return result;
}

async function prepareLogo(sourcePath: string): Promise<Buffer> {
  const source = await normalizeSourceTransparency(sourcePath);
  const logo = await sharp(source)
    .trim({
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(474, 474, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

async function normalizeSourceTransparency(sourcePath: string): Promise<Buffer> {
  const metadata = await sharp(sourcePath).metadata();

  if (metadata.hasAlpha) {
    return sharp(sourcePath).ensureAlpha().png().toBuffer();
  }

  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const corners = [
    0,
    info.width - 1,
    (info.height - 1) * info.width,
    info.height * info.width - 1,
  ];
  const background = corners
    .reduce(
      (average, pixelIndex) => {
        const offset = pixelIndex * 4;
        average[0] += data[offset];
        average[1] += data[offset + 1];
        average[2] += data[offset + 2];
        return average;
      },
      [0, 0, 0]
    )
    .map((value) => value / corners.length);

  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset] - background[0];
    const green = data[offset + 1] - background[1];
    const blue = data[offset + 2] - background[2];
    const distance = Math.sqrt(red ** 2 + green ** 2 + blue ** 2);
    data[offset + 3] = Math.round(
      255 * Math.max(0, Math.min(1, (distance - 10) / 50))
    );
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function renderJersey({
  artworkPath,
  jerseyMask,
  logo,
  sponsorId,
  style,
}: {
  artworkPath: string;
  jerseyMask: Buffer;
  logo: Buffer;
  sponsorId: string;
  style: JerseyStyle;
}): Promise<Buffer> {
  const artwork = await sharp(artworkPath)
    .resize(jerseyWidth, jerseyHeight, { fit: "fill" })
    .removeAlpha()
    .joinChannel(jerseyMask)
    .png()
    .toBuffer();
  const placement = getLogoPlacement(sponsorId, style);
  const exactLogo = await sharp(logo)
    .resize(placement.width, placement.height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const branded = await sharp(artwork)
    .composite([
      {
        input: exactLogo,
        left: placement.left,
        top: placement.top,
      },
    ])
    .png()
    .toBuffer();

  return applyAlphaMask(branded, jerseyMask);
}

function getLogoPlacement(
  sponsorId: string,
  style: JerseyStyle
): { width: number; height: number; left: number; top: number } {
  if (sponsorId === "mongolian-steppes") {
    if (style === "modern") {
      return { width: 102, height: 102, left: 347, top: 159 };
    }

    return style === "classic"
      ? { width: 144, height: 144, left: 228, top: 164 }
      : { width: 142, height: 142, left: 229, top: 157 };
  }

  if (style === "classic") {
    return { width: 146, height: 146, left: 227, top: 145 };
  }

  if (style === "modern") {
    return { width: 132, height: 132, left: 234, top: 145 };
  }

  return { width: 140, height: 140, left: 230, top: 139 };
}

async function applyAlphaMask(image: Buffer, mask: Buffer): Promise<Buffer> {
  const { data: colorData, info } = await sharp(image)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const maskData = await sharp(mask).greyscale().raw().toBuffer();
  const output = Buffer.alloc(info.width * info.height * 4);

  for (let pixelIndex = 0; pixelIndex < info.width * info.height; pixelIndex += 1) {
    const colorOffset = pixelIndex * 3;
    const outputOffset = pixelIndex * 4;
    output[outputOffset] = colorData[colorOffset];
    output[outputOffset + 1] = colorData[colorOffset + 1];
    output[outputOffset + 2] = colorData[colorOffset + 2];
    output[outputOffset + 3] = maskData[pixelIndex];
  }

  return sharp(output, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function buildContactSheet(assets: readonly string[]): Promise<void> {
  const cellWidth = 200;
  const cellHeight = 250;
  const columns = 6;
  const rows = Math.ceil(assets.length / columns);
  const composites = await Promise.all(
    assets.map(async (assetPath, index) => ({
      input: await sharp(assetPath)
        .resize(cellWidth, cellHeight, { fit: "contain" })
        .png()
        .toBuffer(),
      left: (index % columns) * cellWidth,
      top: Math.floor(index / columns) * cellHeight,
    }))
  );

  await sharp({
    create: {
      width: columns * cellWidth,
      height: rows * cellHeight,
      channels: 4,
      background: { r: 239, g: 243, b: 241, alpha: 1 },
    },
  })
    .composite(composites)
    .webp({ quality: 86, effort: 6, smartSubsample: true })
    .toFile(previewPath);
}

async function reportAssets(assets: readonly string[]): Promise<void> {
  const sizes = await Promise.all(
    assets.map(async (assetPath) => (await stat(assetPath)).size)
  );
  const total = sizes.reduce((sum, size) => sum + size, 0);
  const largest = Math.max(...sizes);

  console.log(
    [
      `${sponsors.length} sponsors et ${assets.length} maillots finalisés.`,
      `Poids total : ${(total / 1024 / 1024).toFixed(2)} Mo.`,
      `Poids moyen : ${(total / assets.length / 1024).toFixed(1)} Ko.`,
      `Plus gros fichier : ${(largest / 1024).toFixed(1)} Ko.`,
      `Planche de contrôle : ${previewPath}`,
    ].join("\n")
  );
}

void main();
