import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const packageRoot = path.resolve(
  process.argv[2] ?? "C:/Dev/pcm26-bridge-lab/Cyclostratege-PCMAssets-Mod",
);
const packageTeamsRoot = path.join(packageRoot, "SourceAssets", "Teams");

const teams = [
  {
    directory: "kaffa-origins", code: "KAF", pcmTeamId: 279, pcmSlot: "nci",
    permanentTeamId: "35061203-aa19-4986-83e1-b227cea4ecb5", currentName: "Kaffa Origins",
    sponsor: "Kaffa Origins", manager: "Fra Troisset", jersey: "Origines", style: "bold",
    jerseyId: "kaffa-origins-bold", source: "public/images/sponsors/kaffa-origins/jersey-bold.webp",
    logo: "public/images/sponsors/kaffa-origins/logo.webp",
  },
  {
    directory: "lima-maki", code: "LIM", pcmTeamId: 290, pcmSlot: "efe",
    permanentTeamId: "b5fd7b9a-a254-4e41-9428-3cd1b2bf90fc", currentName: "Lima Maki",
    sponsor: "Lima Maki", manager: "Humberto Julgaby", jersey: "Pacifique", style: "classic",
    jerseyId: "lima-maki-classic", source: "public/images/sponsors/lima-maki/jersey-classic.webp",
    logo: "public/images/sponsors/lima-maki/logo.webp",
  },
  {
    directory: "terroirs-unis", code: "TNP", pcmTeamId: 332, pcmSlot: "loi",
    permanentTeamId: "52cf9278-cb70-4ed1-9c76-ae7263be8d70", currentName: "Terroirs Unis",
    sponsor: "Terroirs Unis", manager: "Jean léchaper", jersey: "Sillons", style: "modern",
    jerseyId: "terroirs-unis-modern", source: "public/images/sponsors/terroirs-unis/jersey-modern.webp",
    logo: "public/images/sponsors/terroirs-unis/logo.webp",
  },
  {
    directory: "penn-kreiz-crepes", code: "PKC", pcmTeamId: 311, pcmSlot: "ltk",
    permanentTeamId: "8de6e531-3cd5-4d5e-beba-34fd54dc5ea1", currentName: "Penn Kreiz Crêpes",
    sponsor: "Penn Kreiz Crêpes", manager: "JLFlick13", jersey: "Grand disque", style: "bold",
    jerseyId: "penn-kreiz-crepes-bold", source: "public/images/sponsors/penn-kreiz-crepes/jersey-bold.webp",
    logo: "public/images/sponsors/penn-kreiz-crepes/logo.webp",
  },
  {
    directory: "okavango-stack", code: "OKA", pcmTeamId: 307, pcmSlot: "xat",
    permanentTeamId: "69b20e97-b88b-4c8c-b98b-b0fd28939913", currentName: "Okavango Stack",
    sponsor: "Okavango Stack", manager: "Max Lamenace", jersey: "Delta Grill", style: "classic",
    jerseyId: "okavango-stack-classic", source: "public/images/sponsors/okavango-stack/jersey-classic.webp",
    logo: "public/images/sponsors/okavango-stack/logo.webp",
  },
  {
    directory: "montecristi-toquilla-house", code: "MTH", pcmTeamId: 297, pcmSlot: "tbv",
    permanentTeamId: "c9db310c-1a90-4df5-9f78-fd48c8147425", currentName: "Montecristi Toquilla House",
    sponsor: "Montecristi Toquilla House", manager: "Romain Bardet", jersey: "Ruban", style: "modern",
    jerseyId: "montecristi-toquilla-house-modern", source: "public/images/sponsors/montecristi-toquilla-house/jersey-modern.webp",
    logo: "public/images/sponsors/montecristi-toquilla-house/logo.webp",
  },
  {
    directory: "cumbre-coca-rush", code: "CCR", pcmTeamId: 315, pcmSlot: "tpp",
    permanentTeamId: "12277621-b716-4b0c-934a-f1a0b52364ba", currentName: "Pura Cadencia Test Team",
    sponsor: "Cumbre Coca Rush", manager: "Sousou", jersey: "Cumbre néon", style: "bold",
    jerseyId: "cumbre-coca-rush-bold", source: "public/images/sponsors/cumbre-coca-rush/jersey-bold.webp",
    logo: "public/images/sponsors/cumbre-coca-rush/logo.webp",
  },
  {
    directory: "atlas-racing-lab", code: "ARL", pcmTeamId: 249, pcmSlot: "jay",
    permanentTeamId: "7ba5ff3b-d8cf-46ac-b82b-a53b34fed827", currentName: "Atlas Racing Lab",
    sponsor: "Atlas Racing Lab", manager: "T-Point", jersey: "Ocre Racing", style: "bold",
    jerseyId: "atlas-racing-lab-bold", source: "public/images/sponsors/atlas-racing-lab/jersey-bold.webp",
    logo: "public/images/sponsors/atlas-racing-lab/logo.webp", rearLogoWidth: 112,
    repairRearLogo: true,
  },
  {
    directory: "sainte-croix-automata", code: "SCA", pcmTeamId: 319, pcmSlot: "pqt",
    permanentTeamId: "bb7c87bd-a474-4260-8f85-f349849683f3", currentName: "Sainte-Croix Automata",
    sponsor: "Sainte-Croix Automata", manager: "Tibz21", jersey: "Mélodie", style: "modern",
    jerseyId: "sainte-croix-automata-modern", source: "public/images/sponsors/sainte-croix-automata/jersey-modern.webp",
    logo: "public/images/sponsors/sainte-croix-automata/logo.webp",
  },
  {
    directory: "junkanoo-brass-feather", code: "JBF", pcmTeamId: 278, pcmSlot: "ten",
    permanentTeamId: "34026dd0-77b0-46d8-94ba-fd3256c8df79", currentName: "Junkanoo Brass & Feather",
    sponsor: "Junkanoo Brass & Feather", manager: "Yoann Ahaf", jersey: "Parade", style: "classic",
    jerseyId: "junkanoo-brass-feather-classic", source: "public/images/sponsors/junkanoo-brass-feather/jersey-classic.webp",
    logo: "public/images/sponsors/junkanoo-brass-feather/logo.webp", rearLogoWidth: 110,
    repairRearLogo: true,
  },
  {
    directory: "kyrgyz-highlands", code: "KHG", pcmTeamId: 283, pcmSlot: "map",
    permanentTeamId: "f2ffb52a-8a36-401d-90a9-ca5270cc8252", currentName: "Kyrgyz Highlands",
    sponsor: "Kyrgyz Highlands", manager: "blk14", jersey: "Vol de l’aigle", style: "bold",
    jerseyId: "kyrgyz-highlands-bold", source: "public/images/sponsors/kyrgyz-highlands/jersey-bold.webp",
    logo: "public/images/sponsors/kyrgyz-highlands/logo.webp",
  },
  {
    directory: "teranga-ocean", code: "TEO", pcmTeamId: 331, pcmSlot: "rbh",
    permanentTeamId: "088a7b6b-a8cf-4545-b08b-4bff6c42b476", currentName: "Teranga Océan",
    sponsor: "Teranga Océan", manager: "Ernest Testicular", jersey: "Hospitalité", style: "classic",
    jerseyId: "teranga-ocean-classic", source: "public/images/sponsors/teranga-ocean/jersey-classic.webp",
    logo: "public/images/sponsors/teranga-ocean/logo.webp",
  },
  {
    directory: "stoke-kilnware", code: "STK", pcmTeamId: 259, pcmSlot: "cof",
    permanentTeamId: "fefee0ef-81a9-472b-9b8b-e9029815f396", currentName: "Davidson Fish & Chips",
    sponsor: "Stoke Kilnware", manager: "Freddy", jersey: "Kiln Arch", style: "modern",
    jerseyId: "stoke-kilnware-modern", source: "public/images/sponsors/stoke-kilnware/jersey-modern.webp",
    logo: "public/images/sponsors/stoke-kilnware/logo.webp",
  },
  {
    directory: "pampa-mate-fuego", code: "PMF", pcmTeamId: 267, pcmSlot: "cjr",
    permanentTeamId: "b6932cdd-3ad3-4475-9509-080c35694f2d", currentName: "Fugazza Sprint",
    sponsor: "Pampa Maté Fuego", manager: "Garzol", jersey: "Maté céleste", style: "classic",
    jerseyId: "pampa-mate-fuego-classic", source: "public/images/sponsors/pampa-mate-fuego/jersey-classic.webp",
    logo: "public/images/sponsors/pampa-mate-fuego/logo.webp",
  },
  {
    directory: "covoare-basarabene", code: "COV", pcmTeamId: 256, pcmSlot: "tca",
    permanentTeamId: "de60b8f0-c3c7-4f8e-bd85-305439b1a482", currentName: "Codru Cellars",
    sponsor: "Covoare Basarabene", manager: "Jeff Tomtob", jersey: "Țesătură", style: "classic",
    jerseyId: "covoare-basarabene-classic", source: "public/images/sponsors/covoare-basarabene/jersey-classic.webp",
    logo: "public/images/sponsors/covoare-basarabene/logo.webp",
  },
  {
    directory: "glen-durnach", code: "GLD", pcmTeamId: 268, pcmSlot: "igd",
    permanentTeamId: "20bcbcf8-7f09-42b7-b4be-ce77d4aade10", currentName: "Glen Durnach",
    sponsor: "Glen Durnach", manager: "Dénis Gregoire", jersey: "Peat Valley", style: "modern",
    jerseyId: "glen-durnach-modern", source: "public/images/sponsors/glen-durnach/jersey-modern.webp",
    logo: "public/images/sponsors/glen-durnach/logo.webp",
  },
  {
    directory: "dodo-blue-finance", code: "DBF", pcmTeamId: 260, pcmSlot: "dft",
    permanentTeamId: "ac9c6a66-e4ee-404e-bf9d-0665a6515640", currentName: "Dodo Blue Finance",
    sponsor: "Dodo Blue Finance", manager: "Rigobert", jersey: "Port-Louis", style: "classic",
    jerseyId: "dodo-blue-finance-classic", source: "public/images/sponsors/dodo-blue-finance/jersey-classic.webp",
    logo: "public/images/sponsors/dodo-blue-finance/logo.webp",
  },
  {
    directory: "indus-mithai", code: "IDM", pcmTeamId: 273, pcmSlot: "nsn",
    permanentTeamId: "ac3691bf-5539-4243-b0f1-69385f340391", currentName: "Indus Mithai",
    sponsor: "Indus Mithai", manager: "Rondoudou", jersey: "Fleuve Rose", style: "modern",
    jerseyId: "indus-mithai-modern", source: "public/images/sponsors/indus-mithai/jersey-modern.webp",
    logo: "public/images/sponsors/indus-mithai/logo.webp",
  },
  {
    directory: "uji-midori", code: "UJM", pcmTeamId: 334, pcmSlot: "vbg",
    permanentTeamId: "ad506cc8-91ff-4306-a30f-b1397e2154a5", currentName: "Tsubame Precision",
    sponsor: "Uji Midori", manager: "Pipo Inzaghi", jersey: "Jardin d’Uji", style: "modern",
    jerseyId: "uji-midori-modern", source: "public/images/sponsors/uji-midori/jersey-modern.webp",
    logo: "public/images/sponsors/uji-midori/logo.webp",
  },
];

const escapeXml = (value) => value
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&apos;");

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function describe(filePath, role) {
  const metadata = await sharp(filePath).metadata();
  return {
    file: path.basename(filePath), role, width: metadata.width, height: metadata.height,
    hasAlpha: metadata.hasAlpha, sha256: await sha256(filePath),
  };
}

for (const team of teams) {
  const repositoryDirectory = path.join(projectRoot, "assets", "pcm", "teams", team.directory);
  const packageDirectory = path.join(packageTeamsRoot, team.code);
  const sourceUvPath = path.join(packageDirectory, `${team.code}_uv-source.png`);
  const referenceSourcePath = path.join(projectRoot, team.source);
  const logoPath = path.join(projectRoot, team.logo);
  const texturePath = path.join(repositoryDirectory, `${team.code}_maillot.png`);
  const miniPath = path.join(repositoryDirectory, `${team.code}_minimaillot.png`);
  const previewPath = path.join(repositoryDirectory, `${team.code}_preview.png`);
  const referencePath = path.join(repositoryDirectory, `${team.code}_reference.webp`);
  const manifestPath = path.join(repositoryDirectory, "manifest.json");

  await mkdir(repositoryDirectory, { recursive: true });
  await mkdir(packageDirectory, { recursive: true });
  await copyFile(referenceSourcePath, referencePath);

  const resizedTexture = await sharp(sourceUvPath)
    .resize({ width: 1200, height: 826, fit: "fill", kernel: sharp.kernel.lanczos3 })
    .sharpen({ sigma: 0.35, m1: 0.35, m2: 0.7 })
    .png()
    .toBuffer();
  const textureComposites = [];
  if (team.repairRearLogo) {
    const patch = await sharp(resizedTexture)
      .extract({ left: 190, top: 606, width: 220, height: 142 })
      .png()
      .toBuffer();
    const exactRearLogo = await sharp(logoPath)
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize({ width: team.rearLogoWidth, height: 78, fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer();
    textureComposites.push(
      { input: patch, left: 792, top: 518 },
      {
        input: exactRearLogo,
        left: Math.round(902 - team.rearLogoWidth / 2),
        top: 552,
      },
    );
  }

  await sharp(resizedTexture)
    .composite(textureComposites)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(texturePath);

  const mini = await sharp(referenceSourcePath)
    .trim()
    .resize({
      width: 248, height: 248, fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
  await sharp({
    create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: mini, left: 4, top: 4 }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(miniPath);

  const [referencePreview, texturePreview, miniPreview] = await Promise.all([
    sharp(referenceSourcePath).trim().resize({ width: 420, height: 570, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
    sharp(texturePath).resize({ width: 930, height: 640, fit: "contain" }).png().toBuffer(),
    sharp(miniPath).resize({ width: 220, height: 220, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
  ]);
  const board = Buffer.from(`
    <svg width="1600" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1600" height="1080" fill="#f1eee7"/>
      <rect x="30" y="30" width="1540" height="1020" rx="30" fill="#fffdf8" stroke="#d2ccc0" stroke-width="2"/>
      <text x="76" y="100" fill="#202720" font-family="Arial, sans-serif" font-weight="700" font-size="36">${escapeXml(team.sponsor.toUpperCase())} · ${escapeXml(team.jersey.toUpperCase())}</text>
      <text x="76" y="139" fill="#687066" font-family="Arial, sans-serif" font-size="21">PCM26 · ${escapeXml(team.manager)} · équipe ${team.pcmTeamId} · slot ${team.pcmSlot.toUpperCase()}</text>
      <text x="90" y="202" fill="#4e574b" font-family="Arial, sans-serif" font-weight="700" font-size="19">RÉFÉRENCE S4 VALIDÉE</text>
      <text x="550" y="202" fill="#4e574b" font-family="Arial, sans-serif" font-weight="700" font-size="19">PATRON UV PCM26</text>
      <rect x="72" y="220" width="450" height="690" rx="18" fill="#ece8df"/>
      <rect x="540" y="220" width="990" height="690" rx="18" fill="#e4e1da"/>
      <text x="1180" y="953" fill="#4e574b" font-family="Arial, sans-serif" font-weight="700" font-size="18">MINI-MAILLOT</text>
      <text x="82" y="968" fill="#687066" font-family="Arial, sans-serif" font-size="18">logo cuissard : arrière uniquement · identité et lettrage contrôlés</text>
    </svg>
  `);
  await sharp(board)
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
      permanentTeamId: team.permanentTeamId,
      pcmTeamId: team.pcmTeamId,
      currentName: team.currentName,
      season4Sponsor: team.sponsor,
      manager: team.manager,
      displayCode: team.code,
      pcmAssetCode: team.pcmSlot,
    },
    selection: {
      jerseyId: team.jerseyId,
      jerseyName: team.jersey,
      jerseyStyle: team.style,
      sourcePath: team.source,
      source: "manager season 4 selection",
    },
    productionRules: {
      frontShortsSponsorLogo: false,
      rearShortsSponsorLogo: true,
      sourceUvPreserved: `${team.code}_uv-source.png`,
      visualIdentityPreserved: true,
    },
    assets: await Promise.all([
      describe(texturePath, "PCM26 3D jersey UV texture"),
      describe(miniPath, "PCM26 interface mini-jersey"),
      describe(previewPath, "quality-control review board"),
      describe(referencePath, "selected season 4 reference"),
    ]),
    notes: [
      "The selected Cyclostratege jersey remains the visual source of truth.",
      "The bib-shorts sponsor logo is placed on the rear panel only.",
      "The PCM team id remains permanent when the sponsor identity changes.",
    ],
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  for (const fileName of [
    `${team.code}_maillot.png`, `${team.code}_minimaillot.png`,
    `${team.code}_preview.png`, `${team.code}_reference.webp`, "manifest.json",
  ]) {
    await copyFile(path.join(repositoryDirectory, fileName), path.join(packageDirectory, fileName));
  }
}

console.log(JSON.stringify({ packageRoot, teams: teams.map(({ code, sponsor, pcmSlot }) => ({ code, sponsor, pcmSlot })) }, null, 2));
