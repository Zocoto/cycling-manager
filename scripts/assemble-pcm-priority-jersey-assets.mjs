import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const workspaceRoot = path.resolve(
  process.argv[2] ??
    "C:/Dev/pcm26-bridge-lab/Cyclostratege-PCMAssets-Mod",
);
const teamsRoot = path.join(workspaceRoot, "SourceAssets", "Teams");

const teams = [
  {
    code: "ARO",
    pcmCompatibilitySlot: "dct",
    sponsor: "Ardennes Outillage",
    jersey: "Acier",
    style: "modern",
    currentTeam: "BelgianTalent",
    manager: "BelgianSteph",
    source: "public/images/sponsors/ardennes-outillage/jersey-modern.webp",
    palette: ["#1a1c1f", "#ef3d20", "#d7d9db", "#555b60"],
  },
  {
    code: "AUL",
    pcmCompatibilitySlot: "gfc",
    sponsor: "Cidrerie de l’Aulne",
    jersey: "Pomme tempête",
    style: "bold",
    currentTeam: "Gouille Developpement",
    manager: "gouilleTW",
    source: "public/images/sponsors/cidrerie-aulne/jersey-bold.webp",
    palette: ["#071f36", "#0a797d", "#f6e5ae", "#e9261b"],
  },
  {
    code: "LIL",
    pcmCompatibilitySlot: "soq",
    sponsor: "Lilangeni Ingilazi",
    jersey: "Four en fusion",
    style: "bold",
    currentTeam: "Lusutfu Cane",
    manager: "Julgator",
    source: "public/images/sponsors/lilangeni-ingilazi/jersey-bold.webp",
    rearLogoOverlay: "public/images/sponsors/lilangeni-ingilazi/logo.webp",
    palette: ["#064733", "#f5edcf", "#42d6d4", "#f68a10"],
  },
  {
    code: "ADL",
    pcmCompatibilitySlot: "mov",
    sponsor: "Abbaye du Lion",
    jersey: "Tradition",
    style: "classic",
    currentTeam: "Abbaye du Lion",
    manager: "Roger Letesteur",
    source: "public/images/sponsors/abbaye-du-lion/jersey-classic.webp",
    rearLogoOverlay: "public/images/sponsors/abbaye-du-lion/logo.webp",
    palette: ["#3c2118", "#f1e6c8", "#b48a36", "#68422c"],
  },
  {
    code: "YUK",
    pcmCompatibilitySlot: "tvl",
    sponsor: "Yukikaze Outdoor",
    jersey: "Hokkaidō",
    style: "classic",
    currentTeam: "Yukikaze Outdoor",
    manager: "Alioch4",
    source: "public/images/sponsors/yukikaze-outdoor/jersey-classic.webp",
    palette: ["#072e62", "#f7f8f5", "#4dc9e7", "#ef3e2f"],
  },
  {
    code: "VNA",
    pcmCompatibilitySlot: "uex",
    sponsor: "Vereda Nova Automóveis",
    jersey: "Arara Viva",
    style: "bold",
    currentTeam: "Vereda Nova Automóveis",
    manager: "Misha3",
    source: "public/images/sponsors/vereda-nova-automoveis/jersey-bold.webp",
    palette: ["#ffd20b", "#005735", "#68ba1f", "#f7f7ee"],
  },
];

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function sha256(filePath) {
  return createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
}

async function describe(filePath, role) {
  const metadata = await sharp(filePath).metadata();
  return {
    file: path.basename(filePath),
    role,
    width: metadata.width,
    height: metadata.height,
    hasAlpha: metadata.hasAlpha,
    sha256: await sha256(filePath),
  };
}

for (const team of teams) {
  const outputDirectory = path.join(teamsRoot, team.code);
  const uvSourcePath = path.join(
    outputDirectory,
    `${team.code}_uv-source.png`,
  );
  const referenceSourcePath = path.join(projectRoot, team.source);
  const referencePath = path.join(
    outputDirectory,
    `${team.code}_reference.webp`,
  );
  const texturePath = path.join(
    outputDirectory,
    `${team.code}_maillot.png`,
  );
  const miniPath = path.join(
    outputDirectory,
    `${team.code}_minimaillot.png`,
  );
  const previewPath = path.join(
    outputDirectory,
    `${team.code}_preview.png`,
  );
  const manifestPath = path.join(outputDirectory, "manifest.json");

  await mkdir(outputDirectory, { recursive: true });
  await copyFile(referenceSourcePath, referencePath);

  const textureBase = await sharp(uvSourcePath)
    .resize({
      width: 1200,
      height: 826,
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .sharpen({ sigma: 0.45, m1: 0.45, m2: 0.9 })
    .png()
    .toBuffer();
  const texturePipeline = sharp(textureBase);
  if (team.rearLogoOverlay) {
    const rearLogo = await sharp(path.join(projectRoot, team.rearLogoOverlay))
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize({
        width: 128,
        height: 112,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    texturePipeline.composite([{ input: rearLogo, left: 828, top: 565 }]);
  }
  await texturePipeline
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(texturePath);

  const miniJersey = await sharp(referenceSourcePath)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({
      width: 248,
      height: 248,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 256,
      height: 256,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: miniJersey, left: 4, top: 4 }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(miniPath);

  const referencePreview = await sharp(referenceSourcePath)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({
      width: 420,
      height: 570,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const texturePreview = await sharp(texturePath)
    .resize({ width: 930, height: 640, fit: "contain" })
    .png()
    .toBuffer();
  const miniPreview = await sharp(miniPath)
    .resize({
      width: 220,
      height: 220,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const palette = team.palette
    .map(
      (color, index) =>
        `<circle cx="${20 + index * 48}" cy="0" r="14" fill="${color}" stroke="#8b8376" stroke-width="1"/>`,
    )
    .join("");
  const previewBackground = Buffer.from(`
    <svg width="1600" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1600" height="1080" fill="#f3f0e9"/>
      <rect x="30" y="30" width="1540" height="1020" rx="30" fill="#fffdf8" stroke="#d6d0c4" stroke-width="2"/>
      <text x="76" y="100" fill="#202720" font-family="Arial, sans-serif" font-weight="700" font-size="38">${escapeXml(team.sponsor.toUpperCase())} · ${escapeXml(team.jersey.toUpperCase())}</text>
      <text x="76" y="139" fill="#687066" font-family="Arial, sans-serif" font-size="21">PCM26 · ${escapeXml(team.manager)} · code graphique ${team.code}</text>
      <text x="90" y="202" fill="#4e574b" font-family="Arial, sans-serif" font-weight="700" font-size="19">RÉFÉRENCE S4</text>
      <text x="550" y="202" fill="#4e574b" font-family="Arial, sans-serif" font-weight="700" font-size="19">PATRON UV PCM26</text>
      <rect x="72" y="220" width="450" height="690" rx="18" fill="#ece8df"/>
      <rect x="540" y="220" width="990" height="690" rx="18" fill="#e4e1da"/>
      <text x="1180" y="953" fill="#4e574b" font-family="Arial, sans-serif" font-weight="700" font-size="18">MINI-MAILLOT</text>
      <g transform="translate(82 956)">${palette}</g>
      <text x="300" y="963" fill="#687066" font-family="Arial, sans-serif" font-size="18">logo cuissard : arrière uniquement</text>
    </svg>
  `);

  await sharp(previewBackground)
    .composite([
      { input: referencePreview, left: 87, top: 260 },
      { input: texturePreview, left: 570, top: 245 },
      { input: miniPreview, left: 1300, top: 825 },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(previewPath);

  const manifest = {
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    game: "Pro Cycling Manager 2026",
    team: {
      currentName: team.currentTeam,
      season4Sponsor: team.sponsor,
      manager: team.manager,
      pcmAssetCode: team.code.toLowerCase(),
      pcmCompatibilitySlot: team.pcmCompatibilitySlot,
    },
    selection: {
      jerseyName: team.jersey,
      jerseyStyle: team.style,
      sourcePath: team.source,
    },
    productionRules: {
      frontShortsSponsorLogo: false,
      rearShortsSponsorLogo: true,
      sourceUvPreserved: `${team.code}_uv-source.png`,
    },
    assets: await Promise.all([
      describe(texturePath, "PCM26 3D jersey UV texture"),
      describe(miniPath, "PCM26 interface mini-jersey"),
      describe(previewPath, "quality-control review board"),
      describe(referencePath, "selected season 4 reference"),
    ]),
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

console.log(
  JSON.stringify(
    {
      workspaceRoot,
      teams: teams.map(({ code, sponsor, jersey }) => ({
        code,
        sponsor,
        jersey,
      })),
    },
    null,
    2,
  ),
);
