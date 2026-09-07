import { mkdir } from "node:fs/promises";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";

import { RiderAvatar } from "../components/game/rider-avatar";
import type { RiderJerseyAppearance } from "../lib/rider-jersey";

const WIDTH = 1080;
const HEIGHT = 1920;
const projectRoot = process.cwd();
const outputDirectory = path.join(
  projectRoot,
  "Docs",
  "marketing",
  "instagram",
  "comment-ca-marche-entrainement",
);

const COLORS = {
  ink: "#071A17",
  green: "#176951",
  green2: "#278B70",
  mint: "#42CDA8",
  mintSoft: "#DFF8EC",
  yellow: "#F2C94C",
  cream: "#FFFDF4",
  paper: "#F4F7F2",
  gray: "#60756E",
  red: "#D1495B",
  orange: "#E67E22",
  blue: "#2D9CDB",
  purple: "#7B61FF",
} as const;

const worldChampionJersey: RiderJerseyAppearance = {
  primaryColor: "#FFFFFF",
  secondaryColor: "#E32636",
  accentColor: "#2166B1",
  pattern: "solid",
  status: "world-champion",
  championshipType: "time_trial",
};

const mesfinAvatarMarkup = renderToStaticMarkup(
  <RiderAvatar
    profileKey="east_africa"
    seed={128}
    riderId="6e5ace56-87e4-4576-a67b-8e6448a6c15c"
    age={22}
    jersey={worldChampionJersey}
    label="Portrait généré de Mesfin Deng"
    className="h-12 w-12"
  />,
);
const extractedMesfinAvatarSvg = mesfinAvatarMarkup.match(
  /<svg[\s\S]*<\/svg>/,
)?.[0];

if (!extractedMesfinAvatarSvg) {
  throw new Error("Impossible de générer l’avatar de Mesfin Deng.");
}

const mesfinAvatarSvg: string = extractedMesfinAvatarSvg;

const initialRatings = {
  mountain: 71,
  hills: 50,
  flat: 52,
  timeTrial: 67,
  cobbles: 54,
  sprint: 61,
  acceleration: 69,
  downhill: 61,
  endurance: 63,
  resistance: 57,
  recovery: 59,
  breakaway: 66,
  prologue: 58,
};

const currentRatings = {
  mountain: 77,
  hills: 56,
  flat: 53,
  timeTrial: 67,
  cobbles: 55,
  sprint: 62,
  acceleration: 73,
  downhill: 64,
  endurance: 68,
  resistance: 60,
  recovery: 62,
  breakaway: 67,
  prologue: 59,
};

const dailyRatingChanges: Record<number, Partial<typeof currentRatings>> = {
  5: { endurance: 1 },
  6: { hills: 1, mountain: 1, acceleration: 1 },
  8: { hills: 1, recovery: 1 },
  11: { hills: 1, sprint: 1, breakaway: 1, resistance: 1 },
  12: { acceleration: 1 },
  14: { downhill: 1 },
  15: { mountain: 1 },
  16: { hills: 1, endurance: 1 },
  18: { mountain: 1, recovery: 1, endurance: 1 },
  19: { hills: 1 },
  20: { downhill: 1 },
  21: { endurance: 1, acceleration: 1 },
  22: { hills: 1, mountain: 1, recovery: 1, resistance: 1 },
  23: { endurance: 1 },
  24: { downhill: 1 },
  25: { flat: 1, cobbles: 1, mountain: 1, prologue: 1 },
};

const progressionSeries = [
  { key: "mountain", label: "MON", color: COLORS.red },
  { key: "hills", label: "VAL", color: COLORS.orange },
  { key: "endurance", label: "END", color: "#219653" },
  { key: "acceleration", label: "ACC", color: "#F2994A" },
  { key: "recovery", label: "REC", color: "#00A6A6" },
] as const;

let logoDataUri = "";
let teamLogoDataUri = "";
let jerseyDataUri = "";
let trainingCenterDataUri = "";

async function main() {
  await mkdir(outputDirectory, { recursive: true });

  [logoDataUri, teamLogoDataUri, jerseyDataUri, trainingCenterDataUri] =
    await Promise.all([
      fileDataUri(path.join(projectRoot, "public", "logo-cyclo-stratege.png")),
      fileDataUri(
        path.join(
          projectRoot,
          "public",
          "images",
          "sponsors",
          "abbaye-du-lion",
          "logo.webp",
        ),
      ),
      fileDataUri(
        path.join(
          projectRoot,
          "public",
          "images",
          "sponsors",
          "abbaye-du-lion",
          "jersey-bold.webp",
        ),
      ),
      fileDataUri(
        path.join(
          projectRoot,
          "public",
          "images",
          "infrastructure",
          "training-center.webp",
        ),
      ),
    ]);

  const slides = [
  {
    file: "comment-ca-marche-entrainement-01-cover.png",
    svg: coverSlide(),
  },
  {
    file: "comment-ca-marche-entrainement-02-coureur-potentiel.png",
    svg: riderPotentialSlide(),
  },
  {
    file: "comment-ca-marche-entrainement-03-programme.png",
    svg: trainingProgramSlide(),
  },
  {
    file: "comment-ca-marche-entrainement-04-staff.png",
    svg: staffSlide(),
  },
  {
    file: "comment-ca-marche-entrainement-05-bonus.png",
    svg: bonusesSlide(),
  },
  {
    file: "comment-ca-marche-entrainement-06-progression-mesfin.png",
    svg: progressionSlide(),
  },
  {
    file: "comment-ca-marche-entrainement-07-recap.png",
    svg: recapSlide(),
  },
  ];

  for (const slide of slides) {
    await sharp(Buffer.from(slide.svg))
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(path.join(outputDirectory, slide.file));
  }

  const contactWidth = 810;
  const thumbWidth = 250;
  const thumbHeight = Math.round((thumbWidth * HEIGHT) / WIDTH);
  const thumbBuffers = await Promise.all(
    slides.map((slide) =>
      sharp(path.join(outputDirectory, slide.file))
        .resize(thumbWidth, thumbHeight)
        .toBuffer(),
    ),
  );

  await sharp({
    create: {
      width: contactWidth,
      height: 3 * thumbHeight + 80,
      channels: 4,
      background: "#E7ECE8",
    },
  })
    .composite(
      thumbBuffers.map((input, index) => ({
        input,
        left: 20 + (index % 3) * 270,
        top: 20 + Math.floor(index / 3) * (thumbHeight + 20),
      })),
    )
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(
      path.join(
        outputDirectory,
        "comment-ca-marche-entrainement-contact-sheet.png",
      ),
    );

  console.log(
    [
    "Story Comment ça marche · Entraînement générée :",
      ...slides.map((slide) => path.relative(projectRoot, path.join(outputDirectory, slide.file))),
      path.relative(
        projectRoot,
        path.join(
          outputDirectory,
          "comment-ca-marche-entrainement-contact-sheet.png",
        ),
      ),
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

function coverSlide() {
  const radar = radarChart({
    x: 610,
    y: 645,
    size: 390,
    values: currentRatings,
    max: 100,
    fill: COLORS.mint,
    stroke: COLORS.mint,
    labels: true,
    dark: true,
  });

  return frame({
    page: 1,
    dark: true,
    body: `
      <image href="${logoDataUri}" x="64" y="58" width="126" height="126" preserveAspectRatio="xMidYMid meet"/>
      ${pill(64, 236, 345, "COMMENT ÇA MARCHE ?", COLORS.yellow, COLORS.ink)}
      ${headline(64, 407, ["L’ENTRAÎNEMENT", "DES COUREURS"], 91, COLORS.cream, 94)}
      <text x="68" y="625" fill="#B8D8CD" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">Faire progresser un coureur,</text>
      <text x="68" y="663" fill="#B8D8CD" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">séance après séance.</text>

      <g transform="translate(64 720)">
        <rect width="952" height="460" rx="38" fill="#0D2B25" stroke="#42CDA8" stroke-opacity=".25"/>
        <circle cx="211" cy="180" r="119" fill="#FFFDF4" stroke="#42CDA8" stroke-width="5"/>
        ${placeAvatar(92, 61, 238)}
        <g transform="translate(350 70)">
          <text x="0" y="26" fill="#9BE0BC" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="900" letter-spacing="3">CAS RÉEL · SAISON 2</text>
          <text x="0" y="92" fill="#FFFDF4" font-family="Arial, Helvetica, sans-serif" font-size="57" font-weight="900">MESFIN DENG</text>
          <text x="0" y="136" fill="#D6DFD2" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="700">22 ans · Tanzanie · Abbaye du Lion</text>
          <g transform="translate(0 174)">
            ${statBadge(0, 0, 205, "POTENTIEL", "4 ★", COLORS.yellow)}
            ${statBadge(221, 0, 205, "MOYENNE", "63,3", COLORS.mint)}
            ${statBadge(442, 0, 160, "PROGRÈS", "+35", COLORS.orange)}
          </g>
          <text x="0" y="330" fill="#F2C94C" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="900">→ UNE BELLE COURBE NE DOIT RIEN AU HASARD</text>
        </g>
      </g>
      <g opacity=".22">${radar}</g>
    `,
  });
}

function riderPotentialSlide() {
  const potentialSteps = Array.from({ length: 8 }, (_, index) => {
    const stars = (index + 1) / 2;
    const cap = 60 + (index + 1) * 5;
    const x = 34 + (index % 4) * 94;
    const y = 250 + Math.floor(index / 4) * 76;
    const active = stars === 4;
    return `
      <g transform="translate(${x} ${y})">
        <rect width="82" height="64" rx="15" fill="${active ? COLORS.yellow : "#EAF0EC"}" stroke="${active ? COLORS.ink : "#D3DED8"}" stroke-width="${active ? 2 : 1}"/>
        <text x="41" y="26" text-anchor="middle" fill="${COLORS.ink}" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900">${formatNumber(stars)}★</text>
        <text x="41" y="48" text-anchor="middle" fill="${COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="800">CAP ${cap}</text>
      </g>`;
  }).join("");

  return frame({
    page: 2,
    dark: false,
    eyebrow: "1 · LE COUREUR",
    title: ["TOUT PART", "DU POTENTIEL"],
    body: `
      <g transform="translate(64 350)">
        ${gameCard(0, 0, 470, 700)}
        <text x="34" y="48" fill="${COLORS.green2}" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900" letter-spacing="2.4">FICHE COUREUR</text>
        <circle cx="160" cy="190" r="105" fill="#E9F4EF" stroke="#176951" stroke-opacity=".18" stroke-width="4"/>
        ${placeAvatar(55, 85, 210)}
        <text x="300" y="142" fill="${COLORS.ink}" font-family="Arial, Helvetica, sans-serif" font-size="39" font-weight="900">Mesfin</text>
        <text x="300" y="184" fill="${COLORS.ink}" font-family="Arial, Helvetica, sans-serif" font-size="39" font-weight="900">Deng</text>
        <text x="300" y="224" fill="${COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700">TZ · 22 ans</text>
        ${pill(286, 256, 145, "4 ÉTOILES", COLORS.yellow, COLORS.ink, 17)}
        <line x1="34" x2="436" y1="328" y2="328" stroke="#DCE6E1"/>
        <text x="34" y="376" fill="${COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900" letter-spacing="2">SES ATOUTS AUJOURD’HUI</text>
        ${statRow(34, 414, "MON", 77, "+6", COLORS.red)}
        ${statRow(34, 474, "ACC", 73, "+4", COLORS.orange)}
        ${statRow(34, 534, "END", 68, "+5", "#219653")}
        <rect x="34" y="615" width="402" height="60" rx="16" fill="#E8F7F1"/>
        <text x="54" y="652" fill="${COLORS.green}" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="900">PREMIER DE LA CLASSE · ×1,5</text>
      </g>
      <g transform="translate(565 350)">
        ${gameCard(0, 0, 451, 700)}
        <text x="34" y="48" fill="${COLORS.green2}" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900" letter-spacing="2.4">POTENTIEL · 8 PALIERS</text>
        <text x="34" y="98" fill="${COLORS.ink}" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="900">Plus qu’une promesse :</text>
        <text x="34" y="134" fill="${COLORS.ink}" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="900">un plafond de progression.</text>
        <text x="34" y="184" fill="${COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700">Le potentiel fixe la moyenne maximale</text>
        <text x="34" y="213" fill="${COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700">et améliore l’efficacité de l’apprentissage.</text>
        ${potentialSteps}
        <rect x="34" y="435" width="383" height="142" rx="24" fill="${COLORS.ink}"/>
        <text x="58" y="476" fill="#9BE0BC" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900" letter-spacing="2">MESFIN · 4★</text>
        <text x="58" y="516" fill="${COLORS.cream}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" letter-spacing="1.5">PLAFOND DE MOYENNE</text>
        <text x="58" y="561" fill="${COLORS.yellow}" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="900">100</text>
        <text x="34" y="630" fill="${COLORS.green}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900">À RETENIR</text>
        <text x="34" y="661" fill="${COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700">Les jeunes et les notes basses progressent plus vite.</text>
      </g>
    `,
  });
}

function trainingProgramSlide() {
  return frame({
    page: 3,
    dark: false,
    eyebrow: "2 · LE PROGRAMME",
    title: ["CHOISIS", "UNE DIRECTION"],
    body: `
      <g transform="translate(64 350)">
        ${gameCard(0, 0, 952, 485)}
        <text x="34" y="48" fill="${COLORS.green2}" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900" letter-spacing="2.4">PROGRAMME INDIVIDUEL · MESFIN DENG</text>
        <circle cx="96" cy="137" r="62" fill="#E9F4EF"/>
        ${placeAvatar(34, 75, 124)}
        <text x="178" y="115" fill="${COLORS.ink}" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="900">Profil · Grimpeur</text>
        <text x="178" y="151" fill="${COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700">Forme actuelle 65,7 % · Potentiel 4★</text>
        <line x1="34" x2="918" y1="215" y2="215" stroke="#DCE6E1"/>

        <g transform="translate(34 258)">
          <text x="0" y="0" fill="${COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="900" letter-spacing="2">INTENSITÉ</text>
          <rect x="0" y="34" width="328" height="14" rx="7" fill="#DCE6E1"/>
          <rect x="0" y="34" width="230" height="14" rx="7" fill="${COLORS.green}"/>
          <circle cx="230" cy="41" r="15" fill="${COLORS.yellow}" stroke="${COLORS.ink}" stroke-width="3"/>
          <rect x="246" y="-20" width="82" height="48" rx="14" fill="white" stroke="#D3DED8"/>
          <text x="287" y="12" text-anchor="middle" fill="${COLORS.green}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900">70 %</text>
          <text x="0" y="86" fill="${COLORS.red}" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900">FORME : −10 PTS / SÉANCE</text>
        </g>

        ${selectBox(404, 258, 220, "DOMAINE", "GRIMPEUR")}
        ${selectBox(652, 258, 266, "ENTRAÎNEUR", "NUNO KYAW · N5")}
        <rect x="34" y="406" width="884" height="50" rx="14" fill="#E8F7F1"/>
        <text x="58" y="438" fill="${COLORS.green}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900">✓ Les réglages validés avant 8 h pilotent la séance du jour.</text>
      </g>

      ${numberedCallout(64, 880, "01", "INTENSITÉ", ["Plus elle monte, plus la progression", "accélère… mais la forme baisse."])}
      ${numberedCallout(386, 880, "02", "DOMAINE", ["Il concentre le travail sur les stats", "primaires et secondaires ciblées."])}
      ${numberedCallout(708, 880, "03", "SUIVI", ["Sous le seuil de forme, le coureur", "se repose et récupère 2 points."])}

      <text x="64" y="1268" fill="${COLORS.green}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900">LE BON PLAN = PROGRESSER SANS GRILLER LA SAISON.</text>
    `,
  });
}

function staffSlide() {
  return frame({
    page: 4,
    dark: false,
    eyebrow: "3 · LE STAFF",
    title: ["L’ENTRAÎNEUR", "FAIT LA DIFFÉRENCE"],
    body: `
      <g transform="translate(64 350)">
        ${gameCard(0, 0, 952, 334)}
        <rect width="952" height="105" rx="28" fill="${COLORS.ink}"/>
        <circle cx="88" cy="105" r="50" fill="${COLORS.yellow}" stroke="white" stroke-width="7"/>
        <text x="88" y="117" text-anchor="middle" fill="${COLORS.ink}" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="900">NK</text>
        <text x="162" y="62" fill="#9BE0BC" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="900" letter-spacing="2">ENTRAÎNEUR ASSIGNÉ</text>
        <text x="162" y="99" fill="${COLORS.cream}" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="900">Nuno Kyaw</text>
        <text x="726" y="65" fill="#9BE0BC" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="900" letter-spacing="2">NIVEAU</text>
        <text x="726" y="102" fill="${COLORS.yellow}" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="900">5 / 5</text>
        <text x="48" y="174" fill="${COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="900" letter-spacing="2">SPÉCIALITÉ PRINCIPALE</text>
        <text x="48" y="215" fill="${COLORS.ink}" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="900">MONTAGNE</text>
        ${pill(258, 182, 152, "+20 %", COLORS.mintSoft, COLORS.green, 20)}
        <text x="48" y="264" fill="${COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700">+4 % par niveau sur les statistiques de sa spécialité.</text>
        <text x="48" y="300" fill="${COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700">Les lignes de talent supplémentaires peuvent se cumuler.</text>
        <rect x="684" y="156" width="220" height="136" rx="22" fill="#F3F8F5" stroke="#D3DED8"/>
        <text x="708" y="190" fill="${COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="900" letter-spacing="2">NATIONALITÉ</text>
        <text x="708" y="229" fill="${COLORS.ink}" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="900">ID · INDONÉSIE</text>
        <text x="708" y="264" fill="${COLORS.red}" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900">PAS D’AFFINITÉ ICI</text>
      </g>

      <g transform="translate(64 724)">
        ${bonusCard(0, 0, 292, 318, "MÊME NATIONALITÉ", "+10 %", ["Bonus sur toute la séance", "si entraîneur et coureur", "partagent leur nationalité."], COLORS.yellow)}
        ${bonusCard(330, 0, 292, 318, "CAPACITÉ", "4 À 8", ["Un entraîneur suit un nombre", "limité de coureurs selon", "son niveau."], COLORS.mint)}
        ${bonusCard(660, 0, 292, 318, "KINÉ", "+ FORME", ["Il atténue la perte de forme", "et aide à tenir un programme", "plus exigeant."], COLORS.blue)}
      </g>
      <rect x="64" y="1090" width="952" height="112" rx="24" fill="#0D2B25"/>
      <text x="98" y="1135" fill="#9BE0BC" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="900" letter-spacing="2">LE BON RÉFLEXE</text>
      <text x="98" y="1176" fill="${COLORS.cream}" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="900">ASSIGNER LE STAFF COUREUR PAR COUREUR.</text>
    `,
  });
}

function bonusesSlide() {
  return frame({
    page: 5,
    dark: true,
    body: `
      <image href="${logoDataUri}" x="64" y="58" width="112" height="112" preserveAspectRatio="xMidYMid meet"/>
      ${pill(64, 215, 288, "4 · LES BONUS", COLORS.yellow, COLORS.ink)}
      ${headline(64, 335, ["EMPILER", "LES BONS LEVIERS"], 80, COLORS.cream, 83)}
      <text x="66" y="520" fill="#B8D8CD" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700">Le cas Mesfin montre comment plusieurs systèmes se répondent.</text>

      <g transform="translate(64 575)">
        <defs><clipPath id="training-photo"><rect width="410" height="286" rx="28"/></clipPath></defs>
        <image href="${trainingCenterDataUri}" width="410" height="286" preserveAspectRatio="xMidYMid slice" clip-path="url(#training-photo)"/>
        <rect y="192" width="410" height="94" fill="#071A17" fill-opacity=".83" clip-path="url(#training-photo)"/>
        <text x="28" y="232" fill="#9BE0BC" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="900" letter-spacing="2">INFRASTRUCTURE RÉELLE</text>
        <text x="28" y="266" fill="${COLORS.cream}" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="900">CENTRE N2 · +4 %</text>
      </g>

      <g transform="translate(505 575)">
        ${darkBonusRow(0, "POTENTIEL 4★", "EFFICACITÉ MAX.", COLORS.yellow)}
        ${darkBonusRow(110, "PREMIER DE LA CLASSE", "×1,5", COLORS.mint)}
        ${darkBonusRow(220, "ENTRAÎNEUR MONTAGNE N5", "+20 % MON", COLORS.red)}
      </g>

      <g transform="translate(64 905)">
        <rect width="952" height="218" rx="30" fill="#0D2B25" stroke="#42CDA8" stroke-opacity=".26"/>
        <text x="36" y="48" fill="#9BE0BC" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="900" letter-spacing="2.2">LA CHAÎNE DE PROGRESSION</text>
        ${formulaNode(36, 82, 160, "COUREUR", "4★ · 22 ANS")}
        ${arrow(211, 122)}
        ${formulaNode(254, 82, 160, "PROGRAMME", "70% · GRIMPEUR")}
        ${arrow(429, 122)}
        ${formulaNode(472, 82, 160, "STAFF", "N5 MONTAGNE")}
        ${arrow(647, 122)}
        ${formulaNode(690, 82, 226, "CLUB", "CENTRE N2")}
      </g>
      <text x="64" y="1195" fill="${COLORS.yellow}" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="900">BON À SAVOIR</text>
      <text x="64" y="1234" fill="${COLORS.cream}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">Les capacités spéciales peuvent aussi modifier la progression ou le déclin.</text>
      <text x="64" y="1272" fill="#9BE0BC" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="800">Lis la fiche avant de fixer le programme.</text>
    `,
  });
}

function progressionSlide() {
  const plot = progressionChart(34, 205, 884, 390);

  return frame({
    page: 6,
    dark: false,
    eyebrow: "5 · LE RÉSULTAT",
    title: ["MESFIN PREND", "UNE AUTRE DIMENSION"],
    body: `
      <g transform="translate(64 350)">
        ${gameCard(0, 0, 952, 690)}
        <text x="34" y="48" fill="${COLORS.green2}" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900" letter-spacing="2.4">PROGRESSION · SAISON 2 · J0 → J25</text>
        <g transform="translate(34 72)">
          ${miniKpi(0, "+35", "POINTS CUMULÉS", COLORS.yellow)}
          ${miniKpi(292, "60,6 → 63,3", "MOYENNE", COLORS.mint)}
          ${miniKpi(584, "12 / 13", "STATS EN HAUSSE", COLORS.orange)}
        </g>
        ${plot}
        <rect x="34" y="620" width="884" height="48" rx="14" fill="#FFF5D3"/>
        <text x="58" y="651" fill="#7B5D08" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="900">Même avec une blessure en J9–J10 et un stage en J13.</text>
      </g>
      <g transform="translate(64 1082)">
        ${gainPill(0, "VALLON", "+6", COLORS.orange)}
        ${gainPill(230, "MONTAGNE", "+6", COLORS.red)}
        ${gainPill(460, "ENDURANCE", "+5", "#219653")}
        ${gainPill(690, "ACCÉLÉRATION", "+4", "#F2994A")}
      </g>
      <text x="64" y="1266" fill="${COLORS.green}" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="900">UNE COURBE CONSTRUITE, PAS UNE SIMPLE BARRE D’XP.</text>
    `,
  });
}

function recapSlide() {
  return frame({
    page: 7,
    dark: true,
    body: `
      <image href="${logoDataUri}" x="64" y="58" width="126" height="126" preserveAspectRatio="xMidYMid meet"/>
      ${pill(64, 230, 216, "EN BREF", COLORS.yellow, COLORS.ink)}
      ${headline(64, 345, ["TA STRATÉGIE", "ÉCRIT LA COURBE"], 79, COLORS.cream, 84)}

      <g transform="translate(64 585)">
        ${recapRow(0, "01", "ÉVALUE LE COUREUR", "Âge · potentiel · notes · capacités")}
        ${recapRow(130, "02", "RÈGLE SON PROGRAMME", "Intensité · domaine · seuil de forme")}
        ${recapRow(260, "03", "AFFECTE LE BON STAFF", "Niveau · spécialité · nationalité · talents")}
        ${recapRow(390, "04", "DÉVELOPPE LE CLUB", "Centre d’entraînement et infrastructures")}
      </g>

      <g transform="translate(64 1120)">
        <rect width="952" height="118" rx="28" fill="${COLORS.yellow}"/>
        <text x="34" y="45" fill="${COLORS.ink}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" letter-spacing="2">CHAQUE JOUR · 8 H</text>
        <text x="34" y="87" fill="${COLORS.ink}" font-family="Arial, Helvetica, sans-serif" font-size="31" font-weight="900">BÂTIS TON PROCHAIN MESFIN.</text>
        <text x="918" y="76" text-anchor="end" fill="${COLORS.ink}" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="900">→</text>
      </g>
      <image href="${teamLogoDataUri}" x="889" y="60" width="110" height="110" preserveAspectRatio="xMidYMid meet" opacity=".82"/>
      <image href="${jerseyDataUri}" x="850" y="280" width="190" height="238" preserveAspectRatio="xMidYMid meet" opacity=".24"/>
    `,
  });
}

function frame({
  page,
  dark,
  eyebrow,
  title,
  body,
}: {
  page: number;
  dark: boolean;
  eyebrow?: string;
  title?: string[];
  body: string;
}) {
  const background = dark ? COLORS.ink : COLORS.paper;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <defs>
        <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M48 0H0V48" fill="none" stroke="${dark ? "#D6DFD2" : "#315B3E"}" stroke-opacity="${dark ? ".055" : ".045"}"/>
        </pattern>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#071A17" flood-opacity=".12"/>
        </filter>
      </defs>
      <rect width="1080" height="1920" fill="${background}"/>
      <rect width="1080" height="1920" fill="url(#grid)"/>
      <rect width="20" height="1920" fill="${COLORS.mint}"/>
      <text x="64" y="126" fill="${dark ? "#9BE0BC" : COLORS.green}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" letter-spacing="2.2">COMMENT ÇA MARCHE · ENTRAÎNEMENT</text>
      <text x="1018" y="126" text-anchor="end" fill="${dark ? "#9BE0BC" : COLORS.green}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" letter-spacing="2">${String(page).padStart(2, "0")} / 07</text>
      <line x1="64" y1="166" x2="1016" y2="166" stroke="${dark ? "#9BE0BC" : COLORS.green}" stroke-opacity=".28"/>
      <g transform="translate(0 260)">
        ${eyebrow ? pill(64, 70, Math.max(230, eyebrow.length * 15 + 52), eyebrow, COLORS.yellow, COLORS.ink) : ""}
        ${title ? headline(64, 166, title, 67, COLORS.ink, 73) : ""}
        ${body}
      </g>
      <line x1="64" y1="1742" x2="1016" y2="1742" stroke="${dark ? "#9BE0BC" : COLORS.green}" stroke-opacity=".28"/>
      <text x="64" y="1798" fill="${dark ? COLORS.yellow : COLORS.green}" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="900" letter-spacing="2">CYCLOSTRATEGE.FR</text>
      <text x="1016" y="1798" text-anchor="end" fill="${dark ? "#D6DFD2" : COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" letter-spacing="1.5">${page === 7 ? "À TOI DE JOUER  →" : "TOUCHE POUR LA SUITE  →"}</text>
    </svg>`;
}

function pill(
  x: number,
  y: number,
  width: number,
  label: string,
  fill: string,
  color: string,
  fontSize = 20,
) {
  return `
    <g transform="translate(${x} ${y})">
      <rect width="${width}" height="50" rx="25" fill="${fill}"/>
      <text x="24" y="33" fill="${color}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="900" letter-spacing="2">${escapeXml(label)}</text>
    </g>`;
}

function headline(
  x: number,
  y: number,
  lines: string[],
  fontSize: number,
  color: string,
  lineHeight: number,
) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" fill="${color}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="900" letter-spacing="-2">${escapeXml(line)}</text>`,
    )
    .join("");
}

function gameCard(x: number, y: number, width: number, height: number) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="28" fill="#FFFFFF" stroke="#D8E2DD" filter="url(#shadow)"/>`;
}

function placeAvatar(x: number, y: number, size: number) {
  return mesfinAvatarSvg.replace(
    /^<svg[^>]*>/,
    `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 96 96">`,
  );
}

function statBadge(x: number, y: number, width: number, label: string, value: string, accent: string) {
  return `
    <g transform="translate(${x} ${y})">
      <rect width="${width}" height="92" rx="18" fill="#173A33" stroke="${accent}" stroke-opacity=".55"/>
      <text x="18" y="28" fill="#9BE0BC" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="900" letter-spacing="2">${escapeXml(label)}</text>
      <text x="18" y="69" fill="${accent}" font-family="Arial, Helvetica, sans-serif" font-size="33" font-weight="900">${escapeXml(value)}</text>
    </g>`;
}

function statRow(x: number, y: number, label: string, value: number, gain: string, color: string) {
  return `
    <g transform="translate(${x} ${y})">
      <rect width="402" height="48" rx="14" fill="#F3F8F5"/>
      <circle cx="24" cy="24" r="7" fill="${color}"/>
      <text x="44" y="31" fill="${COLORS.ink}" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="900">${label}</text>
      <text x="310" y="31" text-anchor="end" fill="${COLORS.ink}" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900">${value}</text>
      <text x="378" y="31" text-anchor="end" fill="${COLORS.green2}" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="900">${gain}</text>
    </g>`;
}

function selectBox(x: number, y: number, width: number, label: string, value: string) {
  return `
    <g transform="translate(${x} ${y})">
      <text x="0" y="0" fill="${COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="900" letter-spacing="2">${label}</text>
      <rect x="0" y="22" width="${width}" height="70" rx="16" fill="#F7FAF8" stroke="#C9D8D1"/>
      <text x="20" y="65" fill="${COLORS.ink}" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="900">${value}</text>
      <path d="M${width - 28} 50l7 7 7-7" fill="none" stroke="${COLORS.green}" stroke-width="2.5" stroke-linecap="round"/>
    </g>`;
}

function numberedCallout(x: number, y: number, number: string, title: string, lines: string[]) {
  return `
    <g transform="translate(${x} ${y})">
      <rect width="286" height="250" rx="24" fill="#FFFFFF" stroke="#D8E2DD" filter="url(#shadow)"/>
      <rect x="20" y="20" width="58" height="58" rx="17" fill="${COLORS.ink}"/>
      <text x="49" y="58" text-anchor="middle" fill="${COLORS.yellow}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900">${number}</text>
      <text x="20" y="119" fill="${COLORS.green}" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="900">${title}</text>
      ${lines.map((line, index) => `<text x="20" y="${162 + index * 29}" fill="${COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700">${escapeXml(line)}</text>`).join("")}
    </g>`;
}

function bonusCard(x: number, y: number, width: number, height: number, title: string, value: string, lines: string[], accent: string) {
  return `
    <g transform="translate(${x} ${y})">
      <rect width="${width}" height="${height}" rx="26" fill="#FFFFFF" stroke="#D8E2DD" filter="url(#shadow)"/>
      <rect x="22" y="22" width="72" height="11" rx="5" fill="${accent}"/>
      <text x="22" y="76" fill="${COLORS.green}" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="900" letter-spacing="1.4">${title}</text>
      <text x="22" y="139" fill="${COLORS.ink}" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="900">${value}</text>
      ${lines.map((line, index) => `<text x="22" y="${198 + index * 29}" fill="${COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700">${escapeXml(line)}</text>`).join("")}
    </g>`;
}

function darkBonusRow(y: number, label: string, value: string, accent: string) {
  return `
    <g transform="translate(0 ${y})">
      <rect width="511" height="88" rx="22" fill="#0D2B25" stroke="${accent}" stroke-opacity=".32"/>
      <circle cx="34" cy="44" r="10" fill="${accent}"/>
      <text x="58" y="38" fill="#D6DFD2" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900">${label}</text>
      <text x="58" y="64" fill="#9BE0BC" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700">ACTIF SUR MESFIN</text>
      <text x="480" y="53" text-anchor="end" fill="${accent}" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="900">${value}</text>
    </g>`;
}

function formulaNode(x: number, y: number, width: number, title: string, detail: string) {
  return `
    <g transform="translate(${x} ${y})">
      <rect width="${width}" height="98" rx="18" fill="#173A33"/>
      <text x="18" y="35" fill="${COLORS.yellow}" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="900" letter-spacing="1.3">${title}</text>
      <text x="18" y="67" fill="${COLORS.cream}" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="800">${detail}</text>
    </g>`;
}

function arrow(x: number, y: number) {
  return `<path d="M${x} ${y}h24m-7-7 7 7-7 7" fill="none" stroke="${COLORS.mint}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function miniKpi(x: number, value: string, label: string, accent: string) {
  return `
    <g transform="translate(${x} 0)">
      <rect width="268" height="96" rx="18" fill="#F3F8F5"/>
      <rect width="7" height="96" rx="3.5" fill="${accent}"/>
      <text x="25" y="46" fill="${COLORS.ink}" font-family="Arial, Helvetica, sans-serif" font-size="29" font-weight="900">${value}</text>
      <text x="25" y="74" fill="${COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="900" letter-spacing="1.5">${label}</text>
    </g>`;
}

function progressionChart(x: number, y: number, width: number, height: number) {
  const plotX = x + 38;
  const plotY = y + 26;
  const plotWidth = width - 64;
  const plotHeight = height - 86;
  const minimum = 45;
  const maximum = 80;
  const xForDay = (day: number) => plotX + (day / 25) * plotWidth;
  const yForValue = (value: number) =>
    plotY + ((maximum - value) / (maximum - minimum)) * plotHeight;
  const ticks = [45, 50, 55, 60, 65, 70, 75, 80];
  const xTicks = [0, 5, 10, 15, 20, 25];
  const snapshots = buildProgressionSnapshots();

  return `
    <g>
      ${ticks.map((tick) => `<line x1="${plotX}" y1="${yForValue(tick)}" x2="${plotX + plotWidth}" y2="${yForValue(tick)}" stroke="#DCE6E1"/><text x="${plotX - 12}" y="${yForValue(tick) + 5}" text-anchor="end" fill="${COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700">${tick}</text>`).join("")}
      ${xTicks.map((tick) => `<line x1="${xForDay(tick)}" y1="${plotY}" x2="${xForDay(tick)}" y2="${plotY + plotHeight}" stroke="#ECF1EE"/><text x="${xForDay(tick)}" y="${plotY + plotHeight + 28}" text-anchor="middle" fill="${COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="800">${tick === 0 ? "DÉPART" : `J${tick}`}</text>`).join("")}
      <rect x="${xForDay(9)}" y="${plotY}" width="${xForDay(11) - xForDay(9)}" height="${plotHeight}" fill="#D1495B" fill-opacity=".06"/>
      <text x="${(xForDay(9) + xForDay(11)) / 2}" y="${plotY + 18}" text-anchor="middle" fill="${COLORS.red}" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="900">BLESSURE</text>
      ${progressionSeries.map((series) => {
        const points = snapshots
          .map((snapshot) => `${xForDay(snapshot.day)},${yForValue(snapshot.values[series.key])}`)
          .join(" ");
        return `<polyline points="${points}" fill="none" stroke="${series.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${xForDay(25)}" cy="${yForValue(currentRatings[series.key])}" r="6" fill="white" stroke="${series.color}" stroke-width="3"/>`;
      }).join("")}
      <g transform="translate(${plotX} ${plotY + plotHeight + 52})">
        ${progressionSeries.map((series, index) => `<g transform="translate(${index * 142} 0)"><circle cx="7" cy="0" r="6" fill="${series.color}"/><text x="21" y="5" fill="${COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="900">${series.label}</text></g>`).join("")}
      </g>
    </g>`;
}

function buildProgressionSnapshots() {
  const values = { ...initialRatings };
  const snapshots = [{ day: 0, values: { ...values } }];

  for (let day = 1; day <= 25; day += 1) {
    const changes = dailyRatingChanges[day] ?? {};
    for (const [key, change] of Object.entries(changes)) {
      const ratingKey = key as keyof typeof values;
      values[ratingKey] += change ?? 0;
    }
    snapshots.push({ day, values: { ...values } });
  }

  snapshots[snapshots.length - 1] = { day: 25, values: { ...currentRatings } };
  return snapshots;
}

function gainPill(x: number, label: string, gain: string, accent: string) {
  return `
    <g transform="translate(${x} 0)">
      <rect width="210" height="92" rx="22" fill="#FFFFFF" stroke="#D8E2DD" filter="url(#shadow)"/>
      <circle cx="28" cy="31" r="8" fill="${accent}"/>
      <text x="48" y="37" fill="${COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="900">${label}</text>
      <text x="28" y="74" fill="${COLORS.ink}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900">${gain}</text>
    </g>`;
}

function recapRow(y: number, number: string, title: string, detail: string) {
  return `
    <g transform="translate(0 ${y})">
      <rect width="790" height="105" rx="24" fill="#0D2B25" stroke="#42CDA8" stroke-opacity=".22"/>
      <rect x="22" y="22" width="62" height="62" rx="18" fill="${COLORS.yellow}"/>
      <text x="53" y="62" text-anchor="middle" fill="${COLORS.ink}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900">${number}</text>
      <text x="112" y="46" fill="${COLORS.cream}" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="900">${title}</text>
      <text x="112" y="76" fill="#9BE0BC" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700">${detail}</text>
    </g>`;
}

function radarChart({
  x,
  y,
  size,
  values,
  max,
  fill,
  stroke,
  labels,
  dark,
}: {
  x: number;
  y: number;
  size: number;
  values: typeof currentRatings;
  max: number;
  fill: string;
  stroke: string;
  labels: boolean;
  dark: boolean;
}) {
  const entries = Object.entries(values) as Array<[keyof typeof values, number]>;
  const center = size / 2;
  const radius = size * 0.39;
  const point = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (index / entries.length) * Math.PI * 2;
    const r = radius * (value / max);
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r];
  };
  const outer = entries.map((_, index) => point(index, max)).map((p) => p.join(",")).join(" ");
  const polygon = entries.map(([, value], index) => point(index, value)).map((p) => p.join(",")).join(" ");
  const shortLabels = ["MON", "VAL", "PLA", "CLM", "PAV", "SPR", "ACC", "DES", "END", "RES", "REC", "BAR", "PRO"];

  return `
    <g transform="translate(${x} ${y})">
      ${[.25, .5, .75, 1].map((ratio) => {
        const ring = entries.map((_, index) => point(index, max * ratio)).map((p) => p.join(",")).join(" ");
        return `<polygon points="${ring}" fill="none" stroke="${dark ? "#9BE0BC" : COLORS.green}" stroke-opacity=".24"/>`;
      }).join("")}
      ${entries.map((_, index) => {
        const [px, py] = point(index, max);
        return `<line x1="${center}" y1="${center}" x2="${px}" y2="${py}" stroke="${dark ? "#9BE0BC" : COLORS.green}" stroke-opacity=".18"/>`;
      }).join("")}
      <polygon points="${outer}" fill="${dark ? "#0D2B25" : "#F3F8F5"}" fill-opacity=".45" stroke="${stroke}" stroke-opacity=".3"/>
      <polygon points="${polygon}" fill="${fill}" fill-opacity=".34" stroke="${stroke}" stroke-width="3"/>
      ${labels ? entries.map((_, index) => {
        const angle = -Math.PI / 2 + (index / entries.length) * Math.PI * 2;
        const r = radius + 27;
        const px = center + Math.cos(angle) * r;
        const py = center + Math.sin(angle) * r + 4;
        return `<text x="${px}" y="${py}" text-anchor="middle" fill="${dark ? "#D6DFD2" : COLORS.gray}" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="900">${shortLabels[index]}</text>`;
      }).join("") : ""}
    </g>`;
}

async function fileDataUri(filePath: string) {
  const buffer = await sharp(filePath).png().toBuffer();
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
