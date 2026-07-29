import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { CYCLING_PROJECT_SPONSORS } from "../data/sponsors/cycling-projects";
import { POSTAL_SERVICE_SPONSORS } from "../data/sponsors/postal-services";
import type { Sponsor } from "../types/sponsor";

type BrandLockup = {
  id: string;
  main: string;
  descriptor: string;
  monogram: string;
  category: string;
};

const BRAND_LOCKUPS: BrandLockup[] = [
  { id: "aurora-racing-team", main: "AURORA", descriptor: "RACING TEAM", monogram: "ART", category: "CYCLING PROJECT" },
  { id: "pura-cadencia-test-team", main: "PURA CADENCIA", descriptor: "TEST TEAM", monogram: "PC", category: "ALTITUDE LAB" },
  { id: "bohemia-velocity-project", main: "BOHEMIA VELOCITY", descriptor: "PROJECT", monogram: "BVP", category: "CYCLING PROJECT" },
  { id: "atlas-racing-lab", main: "ATLAS", descriptor: "RACING LAB", monogram: "ARL", category: "CYCLING LAB" },
  { id: "koru-racing-collective", main: "KORU", descriptor: "RACING COLLECTIVE", monogram: "KRC", category: "CYCLING PROJECT" },
  { id: "danube-test-team", main: "DANUBE", descriptor: "TEST TEAM", monogram: "DTT", category: "AERO LAB" },
  { id: "savana-racing-project", main: "SAVANA", descriptor: "RACING PROJECT", monogram: "SRP", category: "CYCLING PROJECT" },
  { id: "orion-cycling-lab", main: "ORION", descriptor: "CYCLING LAB", monogram: "OCL", category: "CYCLING PROJECT" },
  { id: "quebec-nord-racing", main: "QUÉBEC NORD", descriptor: "RACING", monogram: "QNR", category: "CYCLING PROJECT" },
  { id: "garuda-test-team", main: "GARUDA", descriptor: "TEST TEAM", monogram: "GTT", category: "TROPICAL LAB" },
  { id: "nordhavn-post", main: "NORDHAVN", descriptor: "POST", monogram: "NP", category: "POSTAL SERVICE" },
  { id: "qhapaq-mail", main: "QHAPAQ", descriptor: "MAIL", monogram: "QM", category: "POSTAL SERVICE" },
  { id: "kapuluan-post", main: "KAPULUAN", descriptor: "POST", monogram: "KP", category: "POSTAL SERVICE" },
  { id: "sahel-colis", main: "SAHEL", descriptor: "COLIS", monogram: "SC", category: "POSTAL SERVICE" },
  { id: "triglav-parcel", main: "TRIGLAV", descriptor: "PARCEL", monogram: "TP", category: "POSTAL SERVICE" },
];

const sponsors = [
  ...CYCLING_PROJECT_SPONSORS,
  ...POSTAL_SERVICE_SPONSORS,
] satisfies readonly Sponsor[];
const lockupById = new Map(BRAND_LOCKUPS.map((lockup) => [lockup.id, lockup]));

const sourceDir = path.resolve("tmp", "sponsor-redesign-sources");
const outputDir = path.resolve("tmp", "sponsor-redesign-final");
const selectedSponsorId = readArgument("--only");
const selectedStyles = new Set(
  (readArgument("--styles") ?? "classic,modern,bold").split(","),
);
const directBranding = process.argv.includes("--direct");

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  await mkdir(outputDir, { recursive: true });

  const selectedSponsors = selectedSponsorId
    ? sponsors.filter((sponsor) => sponsor.id === selectedSponsorId)
    : sponsors;

  for (const sponsor of selectedSponsors) {
    const lockup = lockupById.get(sponsor.id);
    if (!lockup) throw new Error(`Identité graphique absente : ${sponsor.id}`);

    const logoSourcePath = path.join(sourceDir, `${sponsor.id}-logo.png`);
    const emblem = await removeChromaKey(logoSourcePath);
    const finalLogo = directBranding
      ? await buildDirectAsset(emblem, 512, 512, 470, 470)
      : await buildFinalLogo({ sponsor, lockup, emblem });
    await finalLogo.toFile(path.join(outputDir, `${sponsor.id}-logo.png`));

    for (const style of ["classic", "modern", "bold"] as const) {
      if (!selectedStyles.has(style)) continue;
      const jerseySourcePath = path.join(
        sourceDir,
        `${sponsor.id}-${style}.png`,
      );
      const jersey = await removeChromaKey(jerseySourcePath);
      const finalJersey = directBranding
        ? await buildDirectAsset(jersey, 600, 750, 558, 690)
        : await buildFinalJersey({
            sponsor,
            lockup,
            jersey,
            emblem,
          });
      await finalJersey.toFile(
        path.join(outputDir, `${sponsor.id}-${style}.png`),
      );
    }
  }

  console.log(
    `${selectedSponsors.length} identité(s) finalisée(s) dans ${outputDir}.`,
  );
}

async function removeChromaKey(inputPath: string) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const corners = [
    [2, 2],
    [info.width - 3, 2],
    [2, info.height - 3],
    [info.width - 3, info.height - 3],
  ];
  const key = corners.reduce(
    (total, [x, y]) => {
      const offset = (y * info.width + x) * 4;
      total[0] += data[offset];
      total[1] += data[offset + 1];
      total[2] += data[offset + 2];
      return total;
    },
    [0, 0, 0],
  ).map((value) => value / corners.length);

  for (let offset = 0; offset < data.length; offset += 4) {
    const redDistance = data[offset] - key[0];
    const greenDistance = data[offset + 1] - key[1];
    const blueDistance = data[offset + 2] - key[2];
    const distance = Math.sqrt(
      redDistance ** 2 + greenDistance ** 2 + blueDistance ** 2,
    );
    const matte = Math.max(0, Math.min(1, (distance - 18) / 96));
    data[offset + 3] = Math.round(data[offset + 3] * matte);

    if (matte > 0 && matte < 1) {
      const spill = Math.max(0, Math.min(data[offset], data[offset + 2]) - data[offset + 1]);
      data[offset] = Math.max(0, data[offset] - spill * (1 - matte) * 0.55);
      data[offset + 2] = Math.max(
        0,
        data[offset + 2] - spill * (1 - matte) * 0.55,
      );
    }
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

async function buildDirectAsset(
  image: Buffer,
  width: number,
  height: number,
  maximumWidth: number,
  maximumHeight: number,
) {
  const layer = await sharp(image)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(maximumWidth, maximumHeight, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: layer, gravity: "center" }]);
}
async function buildFinalLogo({
  sponsor,
  lockup,
  emblem,
}: {
  sponsor: Sponsor;
  lockup: BrandLockup;
  emblem: Buffer;
}) {
  const emblemLayer = await sharp(emblem)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(286, 286, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const mainSize = fitFontSize(lockup.main, 50, 31);
  const descriptorSize = fitFontSize(lockup.descriptor, 25, 17);
  const textLayer = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
      <text x="256" y="371" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="${mainSize}"
        font-weight="900" letter-spacing="1.6"
        fill="${sponsor.colors.primary}" stroke="${sponsor.colors.background}"
        stroke-width="2" paint-order="stroke">${escapeXml(lockup.main)}</text>
      <text x="256" y="406" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="${descriptorSize}"
        font-weight="800" letter-spacing="4"
        fill="${sponsor.colors.secondary}">${escapeXml(lockup.descriptor)}</text>
      <path d="M112 427H400" stroke="${sponsor.colors.accent}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="98" cy="427" r="4" fill="${sponsor.colors.accent}"/>
      <circle cx="414" cy="427" r="4" fill="${sponsor.colors.accent}"/>
      <text x="256" y="462" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="14"
        font-weight="800" letter-spacing="4.2"
        fill="${sponsor.colors.text}">${escapeXml(lockup.category)}</text>
    </svg>
  `);

  return sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([
    { input: emblemLayer, left: 113, top: 36 },
    { input: textLayer, left: 0, top: 0 },
  ]);
}

async function buildFinalJersey({
  sponsor,
  lockup,
  jersey,
  emblem,
}: {
  sponsor: Sponsor;
  lockup: BrandLockup;
  jersey: Buffer;
  emblem: Buffer;
}) {
  const jerseyLayer = await sharp(jersey)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(558, 690, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const emblemLayer = await sharp(emblem)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(76, 76, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const mainSize = fitFontSize(lockup.main, 39, 23);
  const descriptorSize = fitFontSize(lockup.descriptor, 19, 13);
  const brandingLayer = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
      <text x="300" y="291" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="${mainSize}"
        font-weight="900" letter-spacing="1.1"
        fill="${sponsor.colors.background}" stroke="${sponsor.colors.primary}"
        stroke-width="2.2" paint-order="stroke">${escapeXml(lockup.main)}</text>
      <text x="300" y="318" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="${descriptorSize}"
        font-weight="900" letter-spacing="3.2"
        fill="${sponsor.colors.accent}" stroke="${sponsor.colors.primary}"
        stroke-width="1.4" paint-order="stroke">${escapeXml(lockup.descriptor)}</text>
      <path d="M207 329H393" stroke="${sponsor.colors.accent}" stroke-width="3" stroke-linecap="round"/>
      <path d="M236 505 300 537 364 505" fill="none"
        stroke="${sponsor.colors.accent}" stroke-width="4" opacity=".8"/>
      <text x="300" y="568" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="12"
        font-weight="800" letter-spacing="3.6"
        fill="${sponsor.colors.background}" opacity=".92">${escapeXml(lockup.category)}</text>
    </svg>
  `);

  return sharp({
    create: {
      width: 600,
      height: 750,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([
    { input: jerseyLayer, left: 21, top: 30 },
    { input: emblemLayer, left: 262, top: 176 },
    { input: brandingLayer, left: 0, top: 0 },
  ]);
}

function fitFontSize(value: string, preferred: number, minimum: number) {
  const estimatedWidthAtPreferred = value.length * preferred * 0.68;
  if (estimatedWidthAtPreferred <= 360) return preferred;
  return Math.max(
    minimum,
    Math.floor((preferred * 360) / estimatedWidthAtPreferred),
  );
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function readArgument(name: string) {
  const argumentIndex = process.argv.indexOf(name);
  return argumentIndex >= 0 ? process.argv[argumentIndex + 1] : null;
}
