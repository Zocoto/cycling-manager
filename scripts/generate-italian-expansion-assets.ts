import { mkdir, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { ITALIAN_SPONSORS } from "../data/sponsors/italy";
import type { Sponsor } from "../types/sponsor";

const sponsorIds = [
  "seta-lario",
  "cantieri-tirreno",
  "emilia-automazione",
  "vetro-laguna",
  "pelletteria-arno",
  "riso-del-po",
  "pomodoro-vesuvio",
  "caseificio-delle-murge",
  "dolomiti-arredo",
  "ottica-bellagio",
] as const;
const styles = ["classic", "modern", "bold"] as const;
const sponsors = sponsorIds.map((id) => {
  const sponsor = ITALIAN_SPONSORS.find((candidate) => candidate.id === id);
  if (!sponsor) throw new Error(`Sponsor italien introuvable : ${id}`);
  return sponsor;
});

const sourceDirectory = path.resolve(
  "tmp",
  "italian-sponsor-redesign",
  "boards",
);
const outputDirectory = path.resolve("public", "images", "sponsors");
const previewPath = path.resolve(
  "tmp",
  "italian-sponsor-redesign",
  "contact-sheet-final.webp",
);
const jerseyWidth = 600;
const jerseyHeight = 750;

type JerseyStyle = (typeof styles)[number];

void main();

async function main(): Promise<void> {
  const jerseyMask = await prepareJerseyMask();
  const generatedAssets: string[] = [];

  for (const sponsor of sponsors) {
    const boardPath = path.join(sourceDirectory, `${sponsor.id}.png`);
    const metadata = await sharp(boardPath).metadata();
    if (metadata.width !== 1536 || metadata.height !== 1024) {
      throw new Error(
        `${sponsor.id}: planche attendue en 1536×1024, reçue en ${metadata.width}×${metadata.height}.`,
      );
    }

    const sponsorDirectory = path.join(outputDirectory, sponsor.id);
    await mkdir(sponsorDirectory, { recursive: true });
    await sharp(Buffer.from(buildLogoSvg(sponsor)))
      .webp({ quality: 84, alphaQuality: 100, effort: 6, smartSubsample: true })
      .toFile(path.join(sponsorDirectory, "logo.webp"));

    for (const [styleIndex, style] of styles.entries()) {
      const isolatedJersey = await isolateJersey(boardPath, styleIndex);
      const exactBrandMark = await sharp(Buffer.from(buildJerseyMarkSvg(sponsor)))
        .resize(224, 88, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
      const brandedJersey = await sharp(isolatedJersey)
        .composite([
          {
            input: exactBrandMark,
            left: getMarkLeft(style),
            top: getMarkTop(style),
          },
        ])
        .png()
        .toBuffer();
      const finalJersey = await multiplyAlpha(brandedJersey, jerseyMask);
      const outputPath = path.join(sponsorDirectory, `jersey-${style}.webp`);

      await sharp(finalJersey)
        .webp({ quality: 78, alphaQuality: 100, effort: 6, smartSubsample: true })
        .toFile(outputPath);
      generatedAssets.push(outputPath);
    }
  }

  await buildContactSheet(generatedAssets);
  await reportAssets(generatedAssets);
}

async function isolateJersey(
  boardPath: string,
  styleIndex: number,
): Promise<Buffer> {
  // Les planches ont été générées sur un cadrage identique. On prélève le
  // vêtement dans chaque tiers, puis le gabarit alpha officiel garantit une
  // silhouette constante sans laisser entrer les ombres du fond de studio.
  return sharp(boardPath)
    .extract({
      // Le prélèvement reste volontairement à l'intérieur du vêtement : le
      // gabarit final rétablit manches et épaules sans importer un seul pixel
      // du fond généré autour du maillot.
      left: styleIndex * 512 + 42,
      top: 150,
      width: 428,
      height: 700,
    })
    .resize(jerseyWidth, jerseyHeight, { fit: "fill" })
    .png()
    .toBuffer();
}

async function prepareJerseyMask(): Promise<Buffer> {
  const silhouette = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750" viewBox="0 0 600 750">
    <path fill="#fff" d="M242 34C260 20 340 20 358 34L377 72C438 81 511 109 555 151C578 174 585 229 580 316L498 339L465 233C454 359 466 557 491 689C444 721 156 721 109 689C134 557 146 359 135 233L102 339L20 316C15 229 22 174 45 151C89 109 162 81 223 72Z"/>
  </svg>`);
  return sharp(silhouette)
    .greyscale()
    .png()
    .toBuffer();
}

async function multiplyAlpha(image: Buffer, mask: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(image)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const maskAlpha = await sharp(mask).greyscale().raw().toBuffer();
  for (let pixelIndex = 0; pixelIndex < maskAlpha.length; pixelIndex += 1) {
    const offset = pixelIndex * 4 + 3;
    data[offset] = Math.round((data[offset] * maskAlpha[pixelIndex]) / 255);
    if (data[offset] === 0) {
      data[offset - 3] = 0;
      data[offset - 2] = 0;
      data[offset - 1] = 0;
    }
  }
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

function buildLogoSvg(sponsor: Sponsor): string {
  const { primary, secondary, accent, text } = sponsor.colors;
  const lines = splitName(sponsor.name);
  const fontSize = lines.length === 1 ? fitFontSize(lines[0], 52, 31, 410) : 43;
  const wordmark = lines
    .map(
      (line, index) =>
        `<text x="256" y="${286 + index * 52}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" font-weight="900" letter-spacing="1.5" fill="${primary}">${escapeXml(line.toUpperCase())}</text>`,
    )
    .join("");
  const descriptorY = lines.length === 1 ? 365 : 404;
  const descriptorSize = fitFontSize(
    sponsor.sector.toUpperCase(),
    15,
    9,
    410,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <g transform="translate(186 34)">${buildEmblem(sponsor.id, primary, secondary, accent)}</g>
    ${wordmark}
    <path d="M108 ${descriptorY - 24}H404" stroke="${secondary}" stroke-width="5" stroke-linecap="round"/>
    <text x="256" y="${descriptorY}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="${descriptorSize}" font-weight="800" letter-spacing="2" fill="${text}">${escapeXml(sponsor.sector.toUpperCase())}</text>
    <text x="256" y="${descriptorY + 39}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="800" letter-spacing="6" fill="${secondary}">ITALIA</text>
  </svg>`;
}

function buildJerseyMarkSvg(sponsor: Sponsor): string {
  const { primary, secondary, accent, background } = sponsor.colors;
  const lines = splitName(sponsor.name);
  const fontSize = lines.length === 1 ? fitFontSize(lines[0], 30, 19, 235) : 24;
  const wordmark = lines
    .map(
      (line, index) =>
        `<text x="118" y="${42 + index * 29}" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" font-weight="900" letter-spacing=".7" fill="${primary}" stroke="${background}" stroke-width="4" paint-order="stroke">${escapeXml(line.toUpperCase())}</text>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="140" viewBox="0 0 360 140">
    <g transform="translate(7 7) scale(.62)">${buildEmblem(sponsor.id, primary, secondary, accent)}</g>
    ${wordmark}
  </svg>`;
}

function buildEmblem(
  sponsorId: string,
  primary: string,
  secondary: string,
  accent: string,
): string {
  const base = `fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  switch (sponsorId) {
    case "seta-lario":
      return `<path d="M25 25C84 3 112 23 93 51S43 73 43 98s38 28 76 7" ${base} stroke="${primary}" stroke-width="13"/><path d="M18 47L121 92M24 68L114 112" ${base} stroke="${secondary}" stroke-width="5"/><path d="M38 17V121M62 10V128M87 11V122M111 18V111" stroke="${accent}" stroke-width="3" opacity=".8"/>`;
    case "cantieri-tirreno":
      return `<path d="M15 80L39 112H104L127 80 103 92H39Z" fill="${primary}"/><path d="M43 30H94L110 80H28Z" fill="none" stroke="${secondary}" stroke-width="9"/><path d="M15 121C38 108 51 132 72 119s35 10 54-2" ${base} stroke="${accent}" stroke-width="7"/>`;
    case "emilia-automazione":
      return `<path d="M24 109L47 86 60 48 93 31 117 52 96 75 72 69 61 103 42 122" ${base} stroke="${primary}" stroke-width="12"/><circle cx="59" cy="49" r="13" fill="${secondary}"/><circle cx="96" cy="53" r="12" fill="${accent}"/><circle cx="54" cy="106" r="13" fill="${secondary}"/>`;
    case "vetro-laguna":
      return `<path d="M70 8C42 42 23 68 28 94c5 27 25 40 42 40s37-13 42-40C117 68 98 42 70 8Z" fill="${accent}" fill-opacity=".45" stroke="${primary}" stroke-width="8"/><path d="M47 89C70 57 84 61 99 39M43 106C66 93 81 101 102 79" ${base} stroke="${secondary}" stroke-width="7"/>`;
    case "pelletteria-arno":
      return `<path d="M22 18H118V122H22Z" rx="16" fill="${primary}"/><path d="M37 104L56 36H83c29 0 32 38 6 48H52" ${base} stroke="${secondary}" stroke-width="12"/><path d="M26 25H114V115H26Z" fill="none" stroke="${accent}" stroke-width="3" stroke-dasharray="6 6"/>`;
    case "riso-del-po":
      return `<path d="M43 126C63 89 69 53 70 13M69 58C47 54 35 41 29 27M68 75C91 68 104 52 109 36" ${base} stroke="${primary}" stroke-width="7"/><g fill="${secondary}"><ellipse cx="38" cy="31" rx="7" ry="13" transform="rotate(-42 38 31)"/><ellipse cx="49" cy="48" rx="7" ry="13" transform="rotate(-42 49 48)"/><ellipse cx="99" cy="43" rx="7" ry="13" transform="rotate(42 99 43)"/><ellipse cx="88" cy="61" rx="7" ry="13" transform="rotate(42 88 61)"/><ellipse cx="69" cy="23" rx="7" ry="13"/></g>`;
    case "pomodoro-vesuvio":
      return `<circle cx="70" cy="76" r="48" fill="${primary}" stroke="${secondary}" stroke-width="7"/><path d="M70 28C63 53 43 46 36 64c22 1 20 21 34 31 14-10 12-30 34-31-7-18-27-11-34-36Z" fill="${accent}"/><path d="M70 22c-8-14-20-13-29-6 13 0 19 7 29 17 10-10 16-17 29-17-9-7-21-8-29 6Z" fill="${secondary}"/>`;
    case "caseificio-delle-murge":
      return `<path d="M15 91L78 31 126 88 112 119H31Z" fill="${secondary}" stroke="${primary}" stroke-width="7"/><circle cx="81" cy="72" r="8" fill="${primary}"/><circle cx="102" cy="91" r="6" fill="${primary}"/><path d="M39 16C25 35 18 47 20 61c3 16 14 23 23 23s20-7 23-23C68 47 56 35 39 16Z" fill="${accent}" stroke="${primary}" stroke-width="5"/>`;
    case "dolomiti-arredo":
      return `<path d="M17 26H58V46H81V26H123V66H102V89H123V129H81V108H58V129H17V89H38V66H17Z" fill="${primary}"/><path d="M38 66H102V89H38Z" fill="${secondary}"/><path d="M58 46H81V108H58Z" fill="${accent}"/>`;
    case "ottica-bellagio":
      return `<path d="M12 55C34 39 54 41 67 57H73c13-16 33-18 55-2l-6 48c-3 20-35 23-46-8l-6-19-6 19c-11 31-43 28-46 8Z" fill="${primary}" stroke="${accent}" stroke-width="7"/><path d="M24 63C38 54 50 55 60 67M80 67c10-12 22-13 36-4" ${base} stroke="${secondary}" stroke-width="7"/>`;
    default:
      return `<circle cx="70" cy="70" r="52" fill="${primary}"/><circle cx="70" cy="70" r="32" fill="none" stroke="${secondary}" stroke-width="10"/>`;
  }
}

function getMarkLeft(style: JerseyStyle): number {
  if (style === "modern") return 188;
  return style === "bold" ? 188 : 188;
}

function getMarkTop(style: JerseyStyle): number {
  if (style === "modern") return 202;
  return style === "bold" ? 196 : 188;
}

function splitName(value: string): string[] {
  if (value.length <= 18) return [value];
  const words = value.split(/\s+/);
  let bestIndex = 1;
  let bestDifference = Number.POSITIVE_INFINITY;
  for (let index = 1; index < words.length; index += 1) {
    const difference = Math.abs(
      words.slice(0, index).join(" ").length -
        words.slice(index).join(" ").length,
    );
    if (difference < bestDifference) {
      bestIndex = index;
      bestDifference = difference;
    }
  }
  return [words.slice(0, bestIndex).join(" "), words.slice(bestIndex).join(" ")];
}

function fitFontSize(
  value: string,
  preferred: number,
  minimum: number,
  maximumWidth: number,
): number {
  const estimatedWidth = value.length * preferred * 0.62;
  if (estimatedWidth <= maximumWidth) return preferred;
  return Math.max(minimum, Math.floor((preferred * maximumWidth) / estimatedWidth));
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
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
    })),
  );
  await mkdir(path.dirname(previewPath), { recursive: true });
  await sharp({
    create: {
      width: columns * cellWidth,
      height: rows * cellHeight,
      channels: 4,
      background: { r: 238, g: 243, b: 240, alpha: 1 },
    },
  })
    .composite(composites)
    .webp({ quality: 86, effort: 6, smartSubsample: true })
    .toFile(previewPath);
}

async function reportAssets(assets: readonly string[]): Promise<void> {
  const allAssets = [
    ...assets,
    ...sponsors.map((sponsor) => path.join(outputDirectory, sponsor.id, "logo.webp")),
  ];
  const sizes = await Promise.all(
    allAssets.map(async (assetPath) => (await stat(assetPath)).size),
  );
  const jerseySizes = sizes.slice(0, assets.length);
  console.log(
    [
      `${sponsors.length} sponsors, ${assets.length} maillots et ${sponsors.length} logos finalisés.`,
      `Poids total des 40 assets : ${(sizes.reduce((sum, size) => sum + size, 0) / 1024 / 1024).toFixed(2)} Mo.`,
      `Maillot moyen : ${(jerseySizes.reduce((sum, size) => sum + size, 0) / jerseySizes.length / 1024).toFixed(1)} Ko.`,
      `Plus gros maillot : ${(Math.max(...jerseySizes) / 1024).toFixed(1)} Ko.`,
      `Planche de contrôle : ${previewPath}`,
    ].join("\n"),
  );
}
