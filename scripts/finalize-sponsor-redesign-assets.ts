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
  const placement = getWellnessLogoEmblemPlacement(sponsor.id);
  const emblemLayer = await prepareEmblemLayer(
    emblem,
    placement.width,
    placement.height,
    placement.opacity,
  );
  const textLayer = Buffer.from(
    buildWellnessLogoSvg({ sponsor, lockup, countryDetails }),
  );

  return sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([
    { input: emblemLayer, left: placement.left, top: placement.top },
    { input: textLayer, left: 0, top: 0 },
  ]);
}

function getWellnessLogoEmblemPlacement(id: string) {
  const placements: Record<
    string,
    { width: number; height: number; left: number; top: number; opacity: number }
  > = {
    "savonnerie-calanque": { width: 154, height: 154, left: 34, top: 174, opacity: 1 },
    "savana-karite": { width: 178, height: 178, left: 167, top: 30, opacity: 1 },
    "atlas-ghassoul": { width: 230, height: 230, left: 141, top: 20, opacity: 1 },
    "yuzu-sento": { width: 142, height: 142, left: 321, top: 138, opacity: 1 },
    "hanbyeol-care": { width: 68, height: 68, left: 387, top: 132, opacity: 0.94 },
    "eldur-moss": { width: 112, height: 112, left: 44, top: 170, opacity: 1 },
    "sauna-sisu": { width: 92, height: 92, left: 210, top: 86, opacity: 1 },
    "kakheti-botanica": { width: 184, height: 184, left: 164, top: 164, opacity: 1 },
    "neem-nadi": { width: 124, height: 124, left: 42, top: 174, opacity: 1 },
    "nalu-noni": { width: 118, height: 118, left: 197, top: 176, opacity: 1 },
  };

  return placements[id] ?? { width: 160, height: 160, left: 176, top: 72, opacity: 1 };
}

function buildWellnessLogoSvg({
  sponsor,
  lockup,
  countryDetails,
}: {
  sponsor: Sponsor;
  lockup: BrandLockup;
  countryDetails: WellnessCountryDetails;
}) {
  const p = sponsor.colors.primary;
  const s = sponsor.colors.secondary;
  const a = sponsor.colors.accent;
  const t = sponsor.colors.text;
  const provenance = escapeXml(countryDetails.label);

  switch (sponsor.id) {
    case "savonnerie-calanque":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
        <path d="M190 190C250 152 344 151 448 191" fill="none" stroke="${s}" stroke-width="5" stroke-linecap="round"/>
        <text x="318" y="182" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="800" letter-spacing="8" fill="${p}">SAVONNERIE</text>
        <text x="329" y="260" text-anchor="middle" font-family="Georgia,serif" font-size="52" font-weight="700" letter-spacing="-1" fill="${p}">CALANQUE</text>
        <path d="M194 279C252 259 304 300 360 277S440 277 470 267" fill="none" stroke="${s}" stroke-width="9" stroke-linecap="round"/>
        <path d="M196 294C256 279 310 312 368 291S438 291 463 283" fill="none" stroke="${a}" stroke-width="4" stroke-linecap="round"/>
        <text x="329" y="333" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="800" letter-spacing="5" fill="${t}">SAVON DE MARSEILLE</text>
        <circle cx="437" cy="172" r="8" fill="none" stroke="${s}" stroke-width="3"/><circle cx="458" cy="151" r="13" fill="none" stroke="${a}" stroke-width="3"/>
        <path d="M230 362H408" stroke="${p}" stroke-width="3"/><path d="M414 362H435" stroke="#ED2939" stroke-width="3"/>
        <text x="329" y="390" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="700" letter-spacing="4" fill="${t}" opacity=".78">${provenance}</text>
      </svg>`;
    case "savana-karite":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
        <path d="M116 273C168 217 338 211 399 271" fill="none" stroke="${a}" stroke-width="5" stroke-linecap="round"/>
        <text x="256" y="292" text-anchor="middle" font-family="Georgia,serif" font-size="78" font-style="italic" font-weight="700" fill="${p}">Savana</text>
        <text x="256" y="353" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="49" font-weight="900" letter-spacing="7" fill="${s}">KARITÉ</text>
        <path d="M125 373C196 391 319 391 390 373" fill="none" stroke="${p}" stroke-width="4"/>
        <circle cx="206" cy="411" r="5" fill="#EF2B2D"/><circle cx="256" cy="411" r="5" fill="#FCD116"/><circle cx="306" cy="411" r="5" fill="#009E49"/>
        <text x="256" y="446" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="800" letter-spacing="5" fill="${t}">${provenance}</text>
      </svg>`;
    case "atlas-ghassoul":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
        <path d="M82 281H430M110 264H402" stroke="${a}" stroke-width="4" stroke-linecap="round"/>
        <text x="256" y="337" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="72" font-weight="900" letter-spacing="9" fill="${p}">ATLAS</text>
        <text x="256" y="383" text-anchor="middle" font-family="Trebuchet MS,Arial,sans-serif" font-size="36" font-weight="800" letter-spacing="8" fill="${s}">GHASSOUL</text>
        <path d="M116 410L137 389 158 410 179 389 200 410M312 410L333 389 354 410 375 389 396 410" fill="none" stroke="${a}" stroke-width="5"/>
        <text x="256" y="449" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="800" letter-spacing="5" fill="${t}">${provenance}</text>
      </svg>`;
    case "yuzu-sento":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
        <text x="42" y="245" font-family="Arial Black,Arial,Helvetica,sans-serif" font-size="78" font-weight="900" letter-spacing="-2" fill="${p}">YUZU</text>
        <text x="74" y="318" font-family="Arial Rounded MT Bold,Arial Black,Arial,sans-serif" font-size="65" font-weight="900" letter-spacing="3" fill="${s}" stroke="${p}" stroke-width="1.5" paint-order="stroke">SENTŌ</text>
        <path d="M70 341C145 319 223 370 300 341S417 337 469 350" fill="none" stroke="${p}" stroke-width="7" stroke-linecap="round"/>
        <path d="M96 363C170 343 235 389 315 360S420 359 454 368" fill="none" stroke="${a}" stroke-width="4" stroke-linecap="round"/>
        <text x="264" y="405" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="700" letter-spacing="8" fill="${t}">柚子銭湯</text>
        <text x="264" y="442" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="800" letter-spacing="5" fill="${t}" opacity=".78">TOKYO · JAPAN</text>
        <circle cx="421" cy="113" r="8" fill="none" stroke="${s}" stroke-width="3"/><circle cx="451" cy="91" r="14" fill="none" stroke="${a}" stroke-width="4"/>
      </svg>`;
    case "hanbyeol-care":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
        <path d="M85 200C162 157 338 157 425 203" fill="none" stroke="${s}" stroke-width="3"/>
        <text x="256" y="283" text-anchor="middle" font-family="Avenir Next,Montserrat,Arial,sans-serif" font-size="67" font-weight="300" letter-spacing="-2" fill="${p}">hanbyeol</text>
        <path d="M376 170l7 15 15 7-15 7-7 15-7-15-15-7 15-7z" fill="${a}"/>
        <text x="256" y="335" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="25" font-weight="700" letter-spacing="15" fill="${t}">CARE</text>
        <path d="M126 365H386" stroke="${a}" stroke-width="4" stroke-linecap="round"/>
        <text x="256" y="410" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" letter-spacing="6" fill="${t}">SEOUL · DAILY SKIN LAB</text>
      </svg>`;
    case "eldur-moss":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
        <text x="150" y="242" font-family="Georgia,serif" font-size="72" font-weight="700" letter-spacing="3" fill="${p}">ELDUR</text>
        <text x="156" y="310" font-family="Georgia,serif" font-size="59" font-style="italic" fill="${s}">&amp; Moss</text>
        <path d="M70 342C143 296 197 374 265 335S392 326 450 346" fill="none" stroke="${a}" stroke-width="5" stroke-linecap="round"/>
        <path d="M72 358C151 334 215 386 291 353S406 348 448 364" fill="none" stroke="${s}" stroke-width="8" stroke-linecap="round"/>
        <text x="260" y="409" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="800" letter-spacing="5" fill="${t}">GEOTHERMAL CARE · ÍSLAND</text>
      </svg>`;
    case "sauna-sisu":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
        <path d="M166 92V413M346 92V413M166 92H346" fill="none" stroke="${p}" stroke-width="8" stroke-linejoin="round"/>
        <path d="M216 164C188 127 243 111 217 74M256 160C228 124 282 106 258 66M298 164C270 129 325 112 300 76" fill="none" stroke="${a}" stroke-width="7" stroke-linecap="round"/>
        <text x="256" y="231" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="30" font-weight="900" letter-spacing="12" fill="${p}">SAUNA</text>
        <text x="256" y="335" text-anchor="middle" font-family="Impact,Arial Black,Arial,sans-serif" font-size="105" font-weight="900" letter-spacing="3" fill="${t}">SISU</text>
        <text x="256" y="385" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="800" letter-spacing="6" fill="${p}">BIRCH · TAR · STEAM</text>
        <path d="M201 424H311" stroke="#002F6C" stroke-width="5"/>
      </svg>`;
    case "kakheti-botanica":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
        <circle cx="256" cy="256" r="178" fill="none" stroke="${p}" stroke-width="8"/>
        <circle cx="256" cy="256" r="148" fill="none" stroke="${a}" stroke-width="3"/>
        <text x="256" y="141" text-anchor="middle" font-family="Georgia,serif" font-size="39" font-weight="700" letter-spacing="6" fill="${p}">KAKHETI</text>
        <text x="256" y="393" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="24" font-weight="800" letter-spacing="7" fill="${s}">BOTANICA</text>
        <circle cx="113" cy="256" r="5" fill="#FF0000"/><circle cx="399" cy="256" r="5" fill="#FF0000"/>
        <text x="256" y="469" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="800" letter-spacing="5" fill="${t}">KAKHETI · GEORGIA</text>
      </svg>`;
    case "neem-nadi":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
        <text x="145" y="251" font-family="Georgia,serif" font-size="69" font-weight="700" letter-spacing="3" fill="${p}">NEEM</text>
        <text x="146" y="326" font-family="Georgia,serif" font-size="72" font-style="italic" font-weight="700" fill="${s}">Nadi</text>
        <path d="M105 353C184 318 248 386 322 348S421 347 459 362" fill="none" stroke="${p}" stroke-width="8" stroke-linecap="round"/>
        <path d="M120 374C196 345 257 402 332 369S416 368 448 378" fill="none" stroke="${a}" stroke-width="4" stroke-linecap="round"/>
        <path d="M393 201C414 165 452 173 448 208C421 220 401 218 393 201Z" fill="${a}"/>
        <text x="277" y="422" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="800" letter-spacing="5" fill="${t}">NEEM · TULSI · INDIA</text>
      </svg>`;
    case "nalu-noni":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
        <text x="256" y="159" text-anchor="middle" font-family="Arial Rounded MT Bold,Arial Black,Arial,sans-serif" font-size="64" font-weight="900" letter-spacing="7" fill="${p}">NALU</text>
        <text x="256" y="401" text-anchor="middle" font-family="Arial Rounded MT Bold,Arial Black,Arial,sans-serif" font-size="57" font-weight="900" letter-spacing="6" fill="${s}">NONI</text>
        <path d="M64 367C147 328 214 403 290 366S409 357 459 382" fill="none" stroke="${p}" stroke-width="9" stroke-linecap="round"/>
        <path d="M79 389C159 359 223 419 302 387S407 382 447 399" fill="none" stroke="${a}" stroke-width="5" stroke-linecap="round"/>
        <text x="262" y="443" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="800" letter-spacing="5" fill="${t}">PACIFIC BOTANICALS · SAMOA</text>
      </svg>`;
    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><text x="256" y="330" text-anchor="middle" font-family="Arial,sans-serif" font-size="48" font-weight="900" fill="${p}">${escapeXml(lockup.main)}</text></svg>`;
  }
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
  emblem: _emblem,
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
    { input: brandingLayer, left: 0, top: 0 },
    { input: jerseyMask, left: 0, top: 0, blend: "dest-in" },
  ]);
}

function buildWellnessJerseyBrandingSvg({
  style,
  sponsor,
  lockup,
  countryDetails,
}: {
  style: "classic" | "modern" | "bold";
  sponsor: Sponsor;
  lockup: BrandLockup;
  countryDetails: WellnessCountryDetails;
}) {
  const p = sponsor.colors.primary;
  const s = sponsor.colors.secondary;
  const a = sponsor.colors.accent;
  const bg = sponsor.colors.background;
  const t = sponsor.colors.text;
  const provenance = escapeXml(countryDetails.label);

  switch (sponsor.id) {
    case "savonnerie-calanque":
      if (style === "classic") return jerseySvg(`
        <text x="300" y="257" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="800" letter-spacing="7" fill="${p}">SAVONNERIE</text>
        <text x="300" y="304" text-anchor="middle" font-family="Georgia,serif" font-size="48" font-weight="700" letter-spacing="-1" fill="${bg}" stroke="${p}" stroke-width="1.5" paint-order="stroke">CALANQUE</text>
        <path d="M176 323C223 307 267 337 312 321S393 316 426 326" fill="none" stroke="${a}" stroke-width="5" stroke-linecap="round"/>
        <circle cx="438" cy="251" r="8" fill="none" stroke="${bg}" stroke-width="3"/><circle cx="457" cy="228" r="13" fill="none" stroke="${s}" stroke-width="3"/>
        <text x="300" y="596" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="800" letter-spacing="5" fill="${bg}" opacity=".82">MARSEILLE</text>`);
      if (style === "modern") return jerseySvg(`
        <g transform="rotate(-8 300 303)">
          <text x="300" y="280" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="900" letter-spacing="7" fill="${p}">SAVONNERIE</text>
          <text x="300" y="326" text-anchor="middle" font-family="Georgia,serif" font-size="48" font-weight="700" fill="${bg}" stroke="${p}" stroke-width="2" paint-order="stroke">CALANQUE</text>
          <path d="M162 345C218 324 260 362 313 342S397 338 440 349" fill="none" stroke="${a}" stroke-width="6" stroke-linecap="round"/>
        </g>
        <circle cx="169" cy="394" r="15" fill="none" stroke="${bg}" stroke-width="4" opacity=".8"/><circle cx="135" cy="427" r="8" fill="none" stroke="${a}" stroke-width="3"/>`);
      return jerseySvg(`
        <text x="300" y="304" text-anchor="middle" transform="rotate(-3 300 304)" font-family="Georgia,serif" font-size="47" font-weight="700" letter-spacing="1" fill="${bg}" stroke="${p}" stroke-width="2" paint-order="stroke">CALANQUE</text>
        <text x="300" y="348" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="900" letter-spacing="7" fill="${a}">SAVONNERIE · MARSEILLE</text>
        <circle cx="146" cy="235" r="17" fill="none" stroke="${bg}" stroke-width="4"/><circle cx="458" cy="360" r="22" fill="none" stroke="${a}" stroke-width="5"/><circle cx="418" cy="406" r="10" fill="none" stroke="${bg}" stroke-width="3"/>
        <path d="M121 385C198 349 257 414 332 377S432 375 478 393" fill="none" stroke="${bg}" stroke-width="5" stroke-linecap="round"/>`);
    case "savana-karite":
      if (style === "classic") return jerseySvg(`
        <text x="300" y="285" text-anchor="middle" font-family="Georgia,serif" font-size="55" font-style="italic" font-weight="700" fill="${p}">Savana</text>
        <text x="300" y="326" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="28" font-weight="900" letter-spacing="7" fill="${s}">KARITÉ</text>
        <path d="M199 344C250 360 350 360 401 344" fill="none" stroke="${a}" stroke-width="4"/>
        <text x="300" y="596" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="800" letter-spacing="4" fill="${p}">BURKINA FASO</text>`);
      if (style === "modern") return jerseySvg(`
        <g transform="rotate(-11 306 333)">
          <text x="306" y="318" text-anchor="middle" font-family="Georgia,serif" font-size="56" font-style="italic" font-weight="700" fill="${p}" stroke="${bg}" stroke-width="2" paint-order="stroke">Savana</text>
          <text x="306" y="358" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="27" font-weight="900" letter-spacing="7" fill="${s}">KARITÉ</text>
        </g>
        <path d="M149 414C211 367 278 450 345 403S438 397 468 418" fill="none" stroke="${a}" stroke-width="6" stroke-linecap="round"/>`);
      return jerseySvg(`
        <text x="300" y="312" text-anchor="middle" transform="rotate(-4 300 312)" font-family="Georgia,serif" font-size="54" font-style="italic" font-weight="700" fill="${bg}" stroke="${p}" stroke-width="2" paint-order="stroke">Savana</text>
        <text x="300" y="366" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="32" font-weight="900" letter-spacing="9" fill="${s}" stroke="${p}" stroke-width="1.5" paint-order="stroke">KARITÉ</text>
        <path d="M181 392L160 419M211 403L198 440M419 392L440 419M389 403L402 440" stroke="${a}" stroke-width="7" stroke-linecap="round"/>
        <ellipse cx="300" cy="478" rx="42" ry="29" fill="none" stroke="${bg}" stroke-width="5" transform="rotate(-18 300 478)"/>`);
    case "atlas-ghassoul":
      if (style === "classic") return jerseySvg(`
        <text x="300" y="258" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="39" font-weight="900" letter-spacing="5" fill="${bg}" stroke="${p}" stroke-width="1.5" paint-order="stroke">ATLAS</text>
        <text x="300" y="293" text-anchor="middle" font-family="Trebuchet MS,Arial,sans-serif" font-size="24" font-weight="800" letter-spacing="5" fill="${a}">GHASSOUL</text>
        <path d="M204 314L221 297 238 314M362 314L379 297 396 314" fill="none" stroke="${s}" stroke-width="5"/>`);
      if (style === "modern") return jerseySvg(`
        <g transform="rotate(-13 300 332)">
          <text x="300" y="320" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="42" font-weight="900" letter-spacing="5" fill="${bg}" stroke="${p}" stroke-width="2" paint-order="stroke">ATLAS</text>
          <text x="300" y="355" text-anchor="middle" font-family="Trebuchet MS,Arial,sans-serif" font-size="23" font-weight="800" letter-spacing="5" fill="${a}">GHASSOUL</text>
        </g>`);
      return jerseySvg(`
        <text x="300" y="254" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="43" font-weight="900" letter-spacing="7" fill="${bg}" stroke="${p}" stroke-width="2" paint-order="stroke">ATLAS</text>
        <text x="300" y="289" text-anchor="middle" font-family="Trebuchet MS,Arial,sans-serif" font-size="24" font-weight="900" letter-spacing="6" fill="${a}">GHASSOUL</text>
        <path d="M145 322L173 294 201 322 229 294 257 322M343 322L371 294 399 322 427 294 455 322" fill="none" stroke="${s}" stroke-width="6"/>
        <path d="M300 408C267 449 271 484 300 499 329 484 333 449 300 408Z" fill="none" stroke="${bg}" stroke-width="5"/>`);
    case "yuzu-sento":
      if (style === "classic") return jerseySvg(`
        <text x="300" y="259" text-anchor="middle" font-family="Arial Black,Arial,Helvetica,sans-serif" font-size="42" font-weight="900" letter-spacing="2" fill="${bg}">YUZU SENTŌ</text>
        <text x="300" y="293" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="800" letter-spacing="7" fill="${s}">柚子銭湯</text>
        <circle cx="166" cy="273" r="11" fill="none" stroke="${s}" stroke-width="4"/><circle cx="438" cy="243" r="8" fill="none" stroke="${bg}" stroke-width="3"/>`);
      if (style === "modern") return jerseySvg(`
        <text x="300" y="337" text-anchor="middle" transform="rotate(-9 300 337)" font-family="Arial Black,Arial,Helvetica,sans-serif" font-size="40" font-weight="900" letter-spacing="2" fill="${p}" stroke="${bg}" stroke-width="2" paint-order="stroke">YUZU SENTO</text>
        <circle cx="450" cy="244" r="14" fill="none" stroke="${s}" stroke-width="4"/><circle cx="474" cy="214" r="8" fill="none" stroke="${a}" stroke-width="3"/>`);
      return jerseySvg(`
        <text x="300" y="299" text-anchor="middle" transform="rotate(-2 300 299)" font-family="Arial Black,Arial,Helvetica,sans-serif" font-size="42" font-weight="900" letter-spacing="2" fill="${bg}" stroke="${p}" stroke-width="2.5" paint-order="stroke">YUZU SENTO</text>
        <text x="300" y="345" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="800" letter-spacing="7" fill="${s}">柚子銭湯 · TOKYO</text>
        <g transform="rotate(28 430 205)">
          <rect x="402" y="150" width="58" height="93" rx="18" fill="${bg}" fill-opacity=".72" stroke="${p}" stroke-width="5"/>
          <rect x="415" y="135" width="32" height="20" rx="5" fill="${s}" stroke="${p}" stroke-width="4"/>
          <circle cx="431" cy="194" r="19" fill="${s}" stroke="${bg}" stroke-width="3"/>
          <path d="M431 176V212M413 194H449" stroke="${bg}" stroke-width="3" opacity=".8"/>
        </g>
        <path d="M459 241C477 270 454 291 468 316S492 349 477 383" fill="none" stroke="${a}" stroke-width="13" stroke-linecap="round" opacity=".78"/>
        <circle cx="463" cy="408" r="13" fill="none" stroke="${bg}" stroke-width="4"/><circle cx="438" cy="436" r="8" fill="none" stroke="${s}" stroke-width="3"/>`);
    case "hanbyeol-care":
      if (style === "classic") return jerseySvg(`
        <text x="300" y="286" text-anchor="middle" font-family="Avenir Next,Montserrat,Arial,sans-serif" font-size="45" font-weight="300" letter-spacing="-1" fill="${p}">hanbyeol</text>
        <text x="300" y="322" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" font-weight="700" letter-spacing="10" fill="${t}">CARE</text>
        <path d="M411 245l6 13 13 6-13 6-6 13-6-13-13-6 13-6z" fill="${a}"/>`);
      if (style === "modern") return jerseySvg(`
        <g transform="rotate(9 300 326)">
          <text x="300" y="320" text-anchor="middle" font-family="Avenir Next,Montserrat,Arial,sans-serif" font-size="48" font-weight="300" fill="${bg}" stroke="${p}" stroke-width="1.4" paint-order="stroke">hanbyeol</text>
          <text x="300" y="354" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="700" letter-spacing="10" fill="${a}">CARE</text>
        </g>
        <path d="M162 413l7 15 15 7-15 7-7 15-7-15-15-7 15-7z" fill="${bg}" opacity=".8"/>`);
      return jerseySvg(`
        <text x="300" y="300" text-anchor="middle" font-family="Avenir Next,Montserrat,Arial,sans-serif" font-size="52" font-weight="300" fill="${bg}" stroke="${p}" stroke-width="1.5" paint-order="stroke">hanbyeol</text>
        <text x="300" y="339" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" font-weight="700" letter-spacing="11" fill="${a}">CARE · SEOUL</text>
        <path d="M143 387l8 17 17 8-17 8-8 17-8-17-17-8 17-8zM452 232l5 11 11 5-11 5-5 11-5-11-11-5 11-5z" fill="${bg}" opacity=".85"/>
        <circle cx="188" cy="476" r="12" fill="${bg}" fill-opacity=".5"/><circle cx="420" cy="448" r="18" fill="${s}" fill-opacity=".55"/><circle cx="383" cy="507" r="8" fill="${bg}" fill-opacity=".55"/>`);
    case "eldur-moss":
      if (style === "classic") return jerseySvg(`
        <text x="300" y="278" text-anchor="middle" font-family="Georgia,serif" font-size="43" font-weight="700" letter-spacing="2" fill="${bg}">ELDUR</text>
        <text x="300" y="318" text-anchor="middle" font-family="Georgia,serif" font-size="34" font-style="italic" fill="${s}">&amp; Moss</text>
        <path d="M202 338C248 315 279 361 323 337S383 333 407 343" fill="none" stroke="${a}" stroke-width="5"/>`);
      if (style === "modern") return jerseySvg(`
        <g transform="rotate(-10 302 340)">
          <text x="302" y="326" text-anchor="middle" font-family="Georgia,serif" font-size="45" font-weight="700" fill="${bg}" stroke="${p}" stroke-width="1.5" paint-order="stroke">ELDUR</text>
          <text x="302" y="365" text-anchor="middle" font-family="Georgia,serif" font-size="32" font-style="italic" fill="${s}">&amp; Moss</text>
        </g>`);
      return jerseySvg(`
        <text x="300" y="285" text-anchor="middle" font-family="Georgia,serif" font-size="46" font-weight="700" letter-spacing="2" fill="${bg}" stroke="${p}" stroke-width="2" paint-order="stroke">ELDUR</text>
        <text x="300" y="327" text-anchor="middle" font-family="Georgia,serif" font-size="35" font-style="italic" fill="${s}">&amp; Moss</text>
        <path d="M153 382C203 335 228 422 279 371S357 358 390 387 444 393 468 371" fill="none" stroke="${a}" stroke-width="7" stroke-linecap="round"/>
        <path d="M184 448C157 413 216 393 190 356M420 455C393 419 449 397 426 362" fill="none" stroke="${bg}" stroke-width="5" stroke-linecap="round" opacity=".75"/>`);
    case "sauna-sisu":
      if (style === "classic") return jerseySvg(`
        <text x="300" y="252" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="19" font-weight="900" letter-spacing="10" fill="${bg}">SAUNA</text>
        <text x="300" y="321" text-anchor="middle" font-family="Impact,Arial Black,Arial,sans-serif" font-size="72" font-weight="900" letter-spacing="4" fill="${bg}">SISU</text>
        <text x="300" y="352" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="800" letter-spacing="5" fill="${a}">SUOMI</text>`);
      if (style === "modern") return jerseySvg(`
        <text x="304" y="349" text-anchor="middle" transform="rotate(-11 304 349)" font-family="Impact,Arial Black,Arial,sans-serif" font-size="56" font-weight="900" letter-spacing="4" fill="${p}" stroke="${bg}" stroke-width="2" paint-order="stroke">SAUNA SISU</text>
        <path d="M424 248C391 208 455 189 425 143" fill="none" stroke="${a}" stroke-width="6" stroke-linecap="round"/>`);
      return jerseySvg(`
        <text x="300" y="275" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="20" font-weight="900" letter-spacing="11" fill="${a}">SAUNA</text>
        <text x="300" y="346" text-anchor="middle" font-family="Impact,Arial Black,Arial,sans-serif" font-size="76" font-weight="900" letter-spacing="4" fill="${bg}" stroke="${p}" stroke-width="2" paint-order="stroke">SISU</text>
        <path d="M181 413C151 371 218 349 188 305M300 430C267 387 334 362 302 318M418 413C386 372 452 348 421 304" fill="none" stroke="${bg}" stroke-width="6" stroke-linecap="round" opacity=".75"/>
        <path d="M132 469C164 438 190 454 202 492-166 502-140 493-132 469ZM438 470C467 440 492 458 501 494-468 503-445 494-438 470Z" fill="none" stroke="${s}" stroke-width="4"/>`);
    case "kakheti-botanica":
      if (style === "classic") return jerseySvg(`
        <text x="300" y="292" text-anchor="middle" font-family="Georgia,serif" font-size="31" font-weight="700" letter-spacing="4" fill="${p}">KAKHETI</text>
        <text x="300" y="331" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" font-weight="800" letter-spacing="7" fill="${s}">BOTANICA</text>`);
      if (style === "modern") return jerseySvg(`
        <g transform="rotate(-12 300 347)">
          <text x="300" y="333" text-anchor="middle" font-family="Georgia,serif" font-size="39" font-weight="700" fill="${bg}" stroke="${p}" stroke-width="1.5" paint-order="stroke">KAKHETI</text>
          <text x="300" y="368" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="800" letter-spacing="6" fill="${a}">BOTANICA</text>
        </g>`);
      return jerseySvg(`
        <text x="300" y="310" text-anchor="middle" transform="rotate(-2 300 310)" font-family="Georgia,serif" font-size="40" font-weight="700" letter-spacing="4" fill="${bg}" stroke="${p}" stroke-width="2" paint-order="stroke">KAKHETI</text>
        <text x="300" y="356" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="900" letter-spacing="7" fill="${a}">BOTANICA</text>
        <g fill="${p}" stroke="${bg}" stroke-width="2"><circle cx="153" cy="419" r="12"/><circle cx="170" cy="436" r="12"/><circle cx="136" cy="438" r="12"/><circle cx="153" cy="457" r="12"/><circle cx="447" cy="419" r="12"/><circle cx="464" cy="436" r="12"/><circle cx="430" cy="438" r="12"/><circle cx="447" cy="457" r="12"/></g>`);
    case "neem-nadi":
      if (style === "classic") return jerseySvg(`
        <text x="300" y="279" text-anchor="middle" font-family="Georgia,serif" font-size="44" font-weight="700" letter-spacing="3" fill="${p}">NEEM</text>
        <text x="300" y="320" text-anchor="middle" font-family="Georgia,serif" font-size="37" font-style="italic" font-weight="700" fill="${s}">Nadi</text>
        <path d="M214 342C261 318 294 362 339 339S393 336 414 346" fill="none" stroke="${a}" stroke-width="5"/>`);
      if (style === "modern") return jerseySvg(`
        <text x="304" y="359" text-anchor="middle" transform="rotate(-10 304 359)" font-family="Georgia,serif" font-size="43" font-style="italic" font-weight="700" letter-spacing="2" fill="${p}" stroke="${bg}" stroke-width="1.5" paint-order="stroke">NEEM NADI</text>
        <path d="M431 270C451 235 482 244 480 277-456 288-438 286-431 270Z" fill="${a}"/>`);
      return jerseySvg(`
        <text x="300" y="312" text-anchor="middle" transform="rotate(-2 300 312)" font-family="Georgia,serif" font-size="45" font-weight="700" letter-spacing="3" fill="${bg}" stroke="${p}" stroke-width="2" paint-order="stroke">NEEM NADI</text>
        <text x="300" y="356" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="900" letter-spacing="6" fill="${s}">HERBAL HYGIENE · INDIA</text>
        <path d="M142 409C164 369 201 380 196 417-168 430-149 427-142 409ZM404 415C428 372 468 382 462 422-432 434-412 432-404 415Z" fill="${a}" stroke="${bg}" stroke-width="2"/>`);
    case "nalu-noni":
      if (style === "classic") return jerseySvg(`
        <text x="300" y="281" text-anchor="middle" font-family="Arial Rounded MT Bold,Arial Black,Arial,sans-serif" font-size="43" font-weight="900" letter-spacing="4" fill="${p}">NALU NONI</text>
        <path d="M184 305C238 279 276 326 329 302S406 299 433 311" fill="none" stroke="${a}" stroke-width="6" stroke-linecap="round"/>
        <text x="300" y="594" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="800" letter-spacing="5" fill="${s}">SAMOA</text>`);
      if (style === "modern") return jerseySvg(`
        <text x="304" y="354" text-anchor="middle" transform="rotate(-8 304 354)" font-family="Arial Rounded MT Bold,Arial Black,Arial,sans-serif" font-size="42" font-weight="900" letter-spacing="4" fill="${p}" stroke="${bg}" stroke-width="2" paint-order="stroke">NALU NONI</text>
        <path d="M146 415C212 378 267 441 332 407S425 401 465 421" fill="none" stroke="${a}" stroke-width="7" stroke-linecap="round"/>`);
      return jerseySvg(`
        <text x="300" y="310" text-anchor="middle" transform="rotate(-2 300 310)" font-family="Arial Rounded MT Bold,Arial Black,Arial,sans-serif" font-size="45" font-weight="900" letter-spacing="4" fill="${bg}" stroke="${p}" stroke-width="2" paint-order="stroke">NALU NONI</text>
        <text x="300" y="355" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="900" letter-spacing="7" fill="${a}">PACIFIC BOTANICALS</text>
        <path d="M122 405C195 357 251 438 327 394S430 394 483 421" fill="none" stroke="${bg}" stroke-width="8" stroke-linecap="round"/>
        <g fill="none" stroke="${a}" stroke-width="4"><path d="M162 464C135 422 204 405 167 373"/><path d="M438 469C412 426 481 410 443 378"/></g>`);
    default:
      return jerseySvg(`<text x="300" y="310" text-anchor="middle" font-family="Arial,sans-serif" font-size="40" font-weight="900" fill="${bg}">${escapeXml(lockup.main)}</text><text x="300" y="340" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="800" letter-spacing="4" fill="${a}">${provenance}</text>`);
  }
}

function jerseySvg(markup: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">${markup}</svg>`;
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
