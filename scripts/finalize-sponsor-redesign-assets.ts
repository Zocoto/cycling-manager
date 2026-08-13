import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { AUTOMOTIVE_SPONSORS } from "../data/sponsors/automotive";
import { CYCLING_PROJECT_SPONSORS } from "../data/sponsors/cycling-projects";
import { POSTAL_SERVICE_SPONSORS } from "../data/sponsors/postal-services";
import { WELLNESS_HYGIENE_SPONSORS } from "../data/sponsors/wellness-hygiene";
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
  { id: "eichenrad-automobil", main: "EICHENRAD", descriptor: "AUTOMOBIL", monogram: "EA", category: "AUTOMOTIVE" },
  { id: "soramei-motors", main: "SORAMEI", descriptor: "MOTORS", monogram: "SM", category: "AUTOMOTIVE" },
  { id: "mesa-forge-automotive", main: "MESA FORGE", descriptor: "AUTOMOTIVE", monogram: "MF", category: "AUTOMOTIVE" },
  { id: "hanul-vector-motors", main: "HANUL VECTOR", descriptor: "MOTORS", monogram: "HV", category: "ELECTRIC MOBILITY" },
  { id: "jade-meridian-motors", main: "JADE MERIDIAN", descriptor: "MOTORS", monogram: "JM", category: "AUTOMOTIVE" },
  { id: "fulmine-rosso-automobili", main: "FULMINE ROSSO", descriptor: "AUTOMOBILI", monogram: "FR", category: "PERFORMANCE CARS" },
  { id: "mistralys-automobiles", main: "MISTRALYS", descriptor: "AUTOMOBILES", monogram: "MA", category: "ELECTRIC MOBILITY" },
  { id: "calder-wren-motorworks", main: "CALDER & WREN", descriptor: "MOTORWORKS", monogram: "CW", category: "BRITISH MOTORING" },
  { id: "suryavaan-motors", main: "SURYAVAAN", descriptor: "MOTORS", monogram: "SY", category: "SMART MOBILITY" },
  { id: "vereda-nova-automoveis", main: "VEREDA NOVA", descriptor: "AUTOMÓVEIS", monogram: "VN", category: "SOUTH AMERICAN MOTORS" },
  { id: "savonnerie-calanque", main: "SAVONNERIE CALANQUE", descriptor: "SAVON DE MARSEILLE", monogram: "SC", category: "OLIVE OIL SOAP" },
  { id: "savana-karite", main: "SAVANA KARITÉ", descriptor: "KARITÉ · SAVON NOIR", monogram: "SK", category: "SHEA DAILY CARE" },
  { id: "atlas-ghassoul", main: "ATLAS GHASSOUL", descriptor: "RITUELS DU HAMMAM", monogram: "AG", category: "MINERAL BATH CARE" },
  { id: "yuzu-sento", main: "YUZU SENTŌ", descriptor: "BATH & MINERAL", monogram: "YS", category: "JAPANESE BATH CARE" },
  { id: "hanbyeol-care", main: "HANBYEOL CARE", descriptor: "DAILY SKIN CARE", monogram: "HC", category: "DERMOCOSMETICS" },
  { id: "eldur-moss", main: "ELDUR & MOSS", descriptor: "GEOTHERMAL CARE", monogram: "EM", category: "ICELANDIC MINERALS" },
  { id: "sauna-sisu", main: "SAUNA SISU", descriptor: "BIRCH · TAR · STEAM", monogram: "SS", category: "FINNISH SAUNA CARE" },
  { id: "kakheti-botanica", main: "KAKHETI BOTANICA", descriptor: "GRAPE SEED CARE", monogram: "KB", category: "CAUCASUS BOTANICALS" },
  { id: "neem-nadi", main: "NEEM NADI", descriptor: "HERBAL HYGIENE", monogram: "NN", category: "NEEM & TULSI CARE" },
  { id: "nalu-noni", main: "NALU NONI", descriptor: "ISLAND BODY CARE", monogram: "NN", category: "PACIFIC BOTANICALS" },
];

const sponsors = [
  ...CYCLING_PROJECT_SPONSORS,
  ...POSTAL_SERVICE_SPONSORS,
  ...AUTOMOTIVE_SPONSORS,
  ...WELLNESS_HYGIENE_SPONSORS,
] satisfies readonly Sponsor[];

type WellnessCountryDetails = {
  label: string;
  colors: readonly string[];
};

const WELLNESS_COUNTRY_DETAILS: ReadonlyMap<string, WellnessCountryDetails> = new Map([
  ["savonnerie-calanque", { label: "FRANCE · MARSEILLE", colors: ["#002395", "#FFFFFF", "#ED2939"] }],
  ["savana-karite", { label: "BURKINA FASO", colors: ["#EF2B2D", "#FCD116", "#009E49"] }],
  ["atlas-ghassoul", { label: "MAROC", colors: ["#C1272D", "#006233"] }],
  ["yuzu-sento", { label: "JAPON", colors: ["#FFFFFF", "#BC002D"] }],
  ["hanbyeol-care", { label: "CORÉE DU SUD", colors: ["#FFFFFF", "#CD2E3A", "#0047A0"] }],
  ["eldur-moss", { label: "ISLANDE", colors: ["#02529C", "#FFFFFF", "#DC1E35"] }],
  ["sauna-sisu", { label: "FINLANDE", colors: ["#FFFFFF", "#002F6C"] }],
  ["kakheti-botanica", { label: "GÉORGIE", colors: ["#FFFFFF", "#FF0000"] }],
  ["neem-nadi", { label: "INDE", colors: ["#FF9933", "#FFFFFF", "#138808"] }],
  ["nalu-noni", { label: "SAMOA", colors: ["#CE1126", "#FFFFFF", "#002B7F"] }],
] as const);
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
            style,
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

  const edgePadding = Math.max(
    4,
    Math.round(Math.min(info.width, info.height) * 0.008),
  );

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const isInsideSafeArea =
        x >= edgePadding &&
        x < info.width - edgePadding &&
        y >= edgePadding &&
        y < info.height - edgePadding;

      if (isInsideSafeArea) continue;
      data[(y * info.width + x) * 4 + 3] = 0;
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
  const countryDetails = WELLNESS_COUNTRY_DETAILS.get(sponsor.id);

  if (countryDetails) {
    return buildWellnessFinalLogo({
      sponsor,
      lockup,
      emblem,
      countryDetails,
    });
  }

  const emblemLayer = await prepareEmblemLayer(emblem, 286, 286);
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

async function buildWellnessFinalLogo({
  sponsor,
  lockup,
  emblem,
  countryDetails,
}: {
  sponsor: Sponsor;
  lockup: BrandLockup;
  emblem: Buffer;
  countryDetails: WellnessCountryDetails;
}) {
  const emblemLayer = await prepareEmblemLayer(emblem, 244, 244);
  const mainSize = fitFontSizeForWidth(lockup.main, 58, 30, 420);
  const descriptorSize = fitFontSizeForWidth(lockup.descriptor, 25, 17, 380);
  const countryStripe = buildCountryStripeMarkup({
    colors: countryDetails.colors,
    x: 176,
    y: 374,
    width: 160,
    height: 11,
    outline: sponsor.colors.text,
  });
  const textLayer = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
      <rect x="38" y="251" width="436" height="111" rx="24"
        fill="${sponsor.colors.background}" fill-opacity=".96"
        stroke="${sponsor.colors.primary}" stroke-width="6"/>
      <path d="M65 266H447" stroke="${sponsor.colors.accent}" stroke-width="5" stroke-linecap="round"/>
      <text x="256" y="313" text-anchor="middle"
        font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="${mainSize}"
        font-weight="900" letter-spacing=".7"
        fill="${sponsor.colors.primary}" stroke="${sponsor.colors.background}"
        stroke-width="2.5" paint-order="stroke">${escapeXml(lockup.main)}</text>
      <text x="256" y="348" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="${descriptorSize}"
        font-weight="900" letter-spacing="2.6"
        fill="${sponsor.colors.secondary}">${escapeXml(lockup.descriptor)}</text>
      ${countryStripe}
      <text x="256" y="414" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="17"
        font-weight="900" letter-spacing="3.2"
        fill="${sponsor.colors.text}">${escapeXml(countryDetails.label)}</text>
      <path d="M118 436H394" stroke="${sponsor.colors.accent}" stroke-width="4" stroke-linecap="round"/>
      <text x="256" y="470" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="14"
        font-weight="800" letter-spacing="3.4"
        fill="${sponsor.colors.text}" opacity=".84">${escapeXml(lockup.category)}</text>
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
    { input: emblemLayer, left: 134, top: 8 },
    { input: textLayer, left: 0, top: 0 },
  ]);
}

async function buildFinalJersey({
  style,
  sponsor,
  lockup,
  jersey,
  emblem,
}: {
  style: "classic" | "modern" | "bold";
  sponsor: Sponsor;
  lockup: BrandLockup;
  jersey: Buffer;
  emblem: Buffer;
}) {
  const countryDetails = WELLNESS_COUNTRY_DETAILS.get(sponsor.id);

  if (countryDetails) {
    return buildWellnessFinalJersey({
      style,
      sponsor,
      lockup,
      jersey,
      emblem,
      countryDetails,
    });
  }

  const jerseyLayer = await sharp(jersey)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(558, 690, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const emblemLayer = await prepareEmblemLayer(emblem, 76, 76);
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

async function buildWellnessFinalJersey({
  style,
  sponsor,
  lockup,
  jersey,
  emblem,
  countryDetails,
}: {
  style: "classic" | "modern" | "bold";
  sponsor: Sponsor;
  lockup: BrandLockup;
  jersey: Buffer;
  emblem: Buffer;
  countryDetails: WellnessCountryDetails;
}) {
  const jerseyLayer = await sharp(jersey)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(558, 690, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const primaryEmblemSize = style === "classic" ? 132 : style === "modern" ? 150 : 174;
  const watermarkSize = style === "classic" ? 270 : style === "modern" ? 324 : 374;
  const watermarkOpacity = style === "classic" ? 0.18 : style === "modern" ? 0.25 : 0.34;
  const primaryEmblem = await prepareEmblemLayer(
    emblem,
    primaryEmblemSize,
    primaryEmblemSize,
  );
  const watermarkEmblem = await prepareEmblemLayer(
    emblem,
    watermarkSize,
    watermarkSize,
    watermarkOpacity,
  );
  const primaryTop = style === "classic" ? 126 : style === "modern" ? 119 : 105;
  const watermarkTop = style === "classic" ? 382 : style === "modern" ? 350 : 322;
  const primaryLeft = Math.round((600 - primaryEmblemSize) / 2);
  const watermarkLeft = Math.round((600 - watermarkSize) / 2);
  const wordmarkLines = splitJerseyWordmark(lockup.main);
  const longestWordmarkLine = wordmarkLines.reduce(
    (longest, line) => (line.length > longest.length ? line : longest),
    "",
  );
  const mainSize = fitFontSizeForWidth(
    longestWordmarkLine,
    style === "classic" ? 54 : style === "modern" ? 60 : 64,
    26,
    315,
  );
  const descriptorSize = fitFontSizeForWidth(
    lockup.descriptor,
    style === "bold" ? 22 : 20,
    15,
    390,
  );
  const jerseyMask = await sharp({
    create: {
      width: 600,
      height: 750,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: jerseyLayer, left: 21, top: 30 }])
    .png()
    .toBuffer();
  const brandingLayer = Buffer.from(
    buildWellnessJerseyBrandingSvg({
      style,
      sponsor,
      lockup,
      countryDetails,
      wordmarkLines,
      mainSize,
      descriptorSize,
    }),
  );

  return sharp({
    create: {
      width: 600,
      height: 750,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([
    { input: jerseyLayer, left: 21, top: 30 },
    { input: watermarkEmblem, left: watermarkLeft, top: watermarkTop },
    { input: primaryEmblem, left: primaryLeft, top: primaryTop },
    { input: brandingLayer, left: 0, top: 0 },
    { input: jerseyMask, left: 0, top: 0, blend: "dest-in" },
  ]);
}

function buildWellnessJerseyBrandingSvg({
  style,
  sponsor,
  lockup,
  countryDetails,
  wordmarkLines,
  mainSize,
  descriptorSize,
}: {
  style: "classic" | "modern" | "bold";
  sponsor: Sponsor;
  lockup: BrandLockup;
  countryDetails: WellnessCountryDetails;
  wordmarkLines: readonly string[];
  mainSize: number;
  descriptorSize: number;
}) {
  const isStackedWordmark = wordmarkLines.length > 1;
  const stackShift = isStackedWordmark ? 31 : 0;
  const plate =
    style === "classic"
      ? `<rect x="82" y="260" width="436" height="${146 + stackShift}" rx="25"
          fill="${sponsor.colors.primary}" fill-opacity=".91"
          stroke="${sponsor.colors.accent}" stroke-width="6"/>`
      : style === "modern"
        ? `<path d="M58 282 535 232 514 ${410 + stackShift} 78 ${432 + stackShift}Z"
            fill="${sponsor.colors.primary}" fill-opacity=".88"
            stroke="${sponsor.colors.accent}" stroke-width="7" stroke-linejoin="round"/>`
        : `<path d="M45 292Q300 235 555 292L526 ${445 + stackShift}Q300 ${482 + stackShift} 74 ${445 + stackShift}Z"
            fill="${sponsor.colors.primary}" fill-opacity=".82"
            stroke="${sponsor.colors.accent}" stroke-width="8" stroke-linejoin="round"/>`;
  const nameY = style === "classic" ? 324 : style === "modern" ? 337 : 350;
  const nameLineGap = Math.round(mainSize * 0.88);
  const firstNameY = isStackedWordmark
    ? nameY - Math.round(nameLineGap * 0.46)
    : nameY;
  const wordmarkMarkup = wordmarkLines
    .map(
      (line, index) => `<text x="300" y="${firstNameY + nameLineGap * index}" text-anchor="middle"
        transform="rotate(${style === "modern" ? -3 : 0} 300 ${firstNameY + nameLineGap * index})"
        font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="${mainSize}"
        font-weight="900" letter-spacing=".4"
        fill="${sponsor.colors.background}" stroke="${sponsor.colors.text}"
        stroke-width="4.5" paint-order="stroke">${escapeXml(line)}</text>`,
    )
    .join("");
  const descriptorY =
    (style === "classic" ? 358 : style === "modern" ? 372 : 387) + stackShift;
  const stripeY =
    (style === "classic" ? 375 : style === "modern" ? 390 : 405) + stackShift;
  const countryY =
    (style === "classic" ? 402 : style === "modern" ? 418 : 434) + stackShift;
  const countryStripe = buildCountryStripeMarkup({
    colors: countryDetails.colors,
    x: 252,
    y: stripeY,
    width: 96,
    height: 9,
    outline: sponsor.colors.background,
  });
  const collarStripe = buildCountryStripeMarkup({
    colors: countryDetails.colors,
    x: 258,
    y: 111,
    width: 84,
    height: 7,
    outline: sponsor.colors.text,
  });
  const echoWordmark = wordmarkLines.join(" ");
  const echoSize = fitFontSizeForWidth(echoWordmark, 48, 22, 390);
  const echoRotation = style === "modern" ? -7 : style === "bold" ? 5 : 0;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
      ${collarStripe}
      ${plate}
      ${wordmarkMarkup}
      <text x="300" y="${descriptorY}" text-anchor="middle"
        transform="rotate(${style === "modern" ? -3 : 0} 300 ${descriptorY})"
        font-family="Arial, Helvetica, sans-serif" font-size="${descriptorSize}"
        font-weight="900" letter-spacing="2.8"
        fill="${sponsor.colors.accent}" stroke="${sponsor.colors.text}"
        stroke-width="2.4" paint-order="stroke">${escapeXml(lockup.descriptor)}</text>
      ${countryStripe}
      <text x="300" y="${countryY}" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="13"
        font-weight="900" letter-spacing="3.1"
        fill="${sponsor.colors.background}" stroke="${sponsor.colors.text}"
        stroke-width="1.8" paint-order="stroke">${escapeXml(countryDetails.label)}</text>
      <text x="300" y="598" text-anchor="middle"
        transform="rotate(${echoRotation} 300 598)"
        font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="${echoSize}"
        font-weight="900" letter-spacing="1"
        fill="none" stroke="${sponsor.colors.background}" stroke-width="3"
        opacity="${style === "classic" ? ".18" : style === "modern" ? ".24" : ".3"}">${escapeXml(echoWordmark)}</text>
      <text x="300" y="628" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="12"
        font-weight="900" letter-spacing="3.3"
        fill="${sponsor.colors.accent}" stroke="${sponsor.colors.text}"
        stroke-width="1.4" paint-order="stroke" opacity=".9">${escapeXml(lockup.category)}</text>
    </svg>
  `;
}

function splitJerseyWordmark(value: string): string[] {
  if (value.length <= 15) return [value];

  const words = value.split(/\s+/);
  let bestSplitIndex = 1;
  let smallestDifference = Number.POSITIVE_INFINITY;

  for (let index = 1; index < words.length; index += 1) {
    const firstLine = words.slice(0, index).join(" ");
    const secondLine = words.slice(index).join(" ");
    const difference = Math.abs(firstLine.length - secondLine.length);

    if (difference < smallestDifference) {
      bestSplitIndex = index;
      smallestDifference = difference;
    }
  }

  return [
    words.slice(0, bestSplitIndex).join(" "),
    words.slice(bestSplitIndex).join(" "),
  ];
}
async function prepareEmblemLayer(
  emblem: Buffer,
  width: number,
  height: number,
  opacity = 1,
) {
  const { data, info } = await sharp(emblem)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(width, height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (opacity < 1) {
    for (let offset = 3; offset < data.length; offset += 4) {
      data[offset] = Math.round(data[offset] * opacity);
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

function buildCountryStripeMarkup({
  colors,
  x,
  y,
  width,
  height,
  outline,
}: {
  colors: readonly string[];
  x: number;
  y: number;
  width: number;
  height: number;
  outline: string;
}) {
  const segmentWidth = width / colors.length;
  const segments = colors
    .map(
      (color, index) =>
        `<rect x="${x + segmentWidth * index}" y="${y}" width="${segmentWidth + 0.5}" height="${height}" fill="${color}"/>`,
    )
    .join("");

  return `<g>${segments}<rect x="${x}" y="${y}" width="${width}" height="${height}"
    fill="none" stroke="${outline}" stroke-width="1.5" opacity=".95"/></g>`;
}

function fitFontSizeForWidth(
  value: string,
  preferred: number,
  minimum: number,
  maximumWidth: number,
) {
  const estimatedWidthAtPreferred = value.length * preferred * 0.63;

  if (estimatedWidthAtPreferred <= maximumWidth) return preferred;

  return Math.max(
    minimum,
    Math.floor((preferred * maximumWidth) / estimatedWidthAtPreferred),
  );
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
