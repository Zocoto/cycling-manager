import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(scriptDirectory, "..");
const sponsorDirectory = path.join(
  workspace,
  "public",
  "images",
  "sponsors",
  "kriti-gea",
);
const outputDirectory = path.join(
  workspace,
  "assets",
  "pcm",
  "teams",
  "kriti-gea",
);

const logoPath = path.join(sponsorDirectory, "logo.webp");
const selectedJerseyPath = path.join(sponsorDirectory, "jersey-modern.webp");
const texturePath = path.join(outputDirectory, "APT_maillot.png");
const miniJerseyPath = path.join(outputDirectory, "APT_minimaillot.png");
const previewPath = path.join(outputDirectory, "kriti-gea-pcm-preview.png");
const manifestPath = path.join(outputDirectory, "manifest.json");

const textureWidth = 1200;
const textureHeight = 826;
const ivory = "#efe2c4";
const lightIvory = "#f7edd5";
const olive = "#56682b";
const darkOlive = "#3f4d22";
const terracotta = "#c95327";
const aegeanBlue = "#1671a8";

await mkdir(outputDirectory, { recursive: true });

const textureSvg = Buffer.from(`
<svg width="${textureWidth}" height="${textureHeight}" viewBox="0 0 ${textureWidth} ${textureHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ivoryFabric" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${lightIvory}"/>
      <stop offset="0.56" stop-color="${ivory}"/>
      <stop offset="1" stop-color="#dfcda8"/>
    </linearGradient>
    <linearGradient id="oliveFabric" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#687a36"/>
      <stop offset="0.54" stop-color="${olive}"/>
      <stop offset="1" stop-color="${darkOlive}"/>
    </linearGradient>
    <linearGradient id="shorts" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#485725"/>
      <stop offset="1" stop-color="#252e18"/>
    </linearGradient>
    <pattern id="weave" width="6" height="6" patternUnits="userSpaceOnUse">
      <path d="M0 1.5H6 M0 4.5H6" stroke="#fff" stroke-opacity=".04" stroke-width=".65"/>
      <path d="M1.5 0V6 M4.5 0V6" stroke="#1b220f" stroke-opacity=".075" stroke-width=".65"/>
    </pattern>
    <filter id="clothNoise" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="2" seed="18" result="noise"/>
      <feColorMatrix in="noise" type="saturate" values="0" result="mono"/>
      <feComponentTransfer in="mono" result="softNoise">
        <feFuncA type="table" tableValues="0 .055"/>
      </feComponentTransfer>
      <feBlend in="SourceGraphic" in2="softNoise" mode="soft-light"/>
    </filter>
  </defs>

  <!-- PCM26 UV base: left/front torso, central inserts, right/back torso and bib shorts. -->
  <rect width="1200" height="455" fill="url(#ivoryFabric)"/>
  <rect y="455" width="1200" height="371" fill="url(#shorts)"/>
  <rect x="585" width="100" height="455" fill="url(#oliveFabric)"/>

  <!-- Sleeve cuffs: olive, bordered by the thin blue and cream bands from Labyrinthe. -->
  <g>
    <path d="M0 300H135V455H0Z M430 300H585V455H430Z M1120 300H1200V455H1120Z" fill="url(#oliveFabric)"/>
    <g fill="none">
      <path d="M0 354H135 M430 354H585 M1120 354H1200" stroke="${aegeanBlue}" stroke-width="8"/>
      <path d="M0 365H135 M430 365H585 M1120 365H1200" stroke="${lightIvory}" stroke-width="5"/>
      <path d="M0 376H135 M430 376H585 M1120 376H1200" stroke="${aegeanBlue}" stroke-width="3"/>
    </g>
  </g>

  <!-- Horizontal olive chest line, continuous on front and back panels. -->
  <path d="M135 144H450 M685 144H1120" stroke="${darkOlive}" stroke-width="13"/>
  <path d="M135 151H450 M685 151H1120" stroke="#778746" stroke-width="2" opacity=".72"/>

  <!-- Labyrinthe lower-front composition: terracotta spiral, blue sweep and olive field. -->
  <path d="M135 272C198 284 250 254 303 269C361 285 396 250 450 219V455H135Z" fill="url(#oliveFabric)"/>
  <path d="M135 274C192 300 238 254 290 276C338 297 340 365 376 393C401 414 425 419 450 421V455H135Z" fill="${terracotta}"/>
  <path d="M135 274C192 300 238 254 290 276C338 297 340 365 376 393C401 414 425 419 450 421" fill="none" stroke="${lightIvory}" stroke-width="11"/>
  <path d="M346 287C356 329 367 370 397 392C416 406 433 410 450 411" fill="none" stroke="${aegeanBlue}" stroke-width="10"/>
  <path d="M356 285C366 326 377 360 404 380C423 393 437 397 450 398" fill="none" stroke="${lightIvory}" stroke-width="5"/>
  <g fill="none" stroke="${lightIvory}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M288 441C218 442 166 405 164 353C162 304 209 280 253 288C302 297 323 339 306 373C291 404 247 410 221 389C199 371 203 339 224 326C245 313 272 324 278 344C284 365 267 379 250 376C236 374 229 363 232 353" stroke-width="13"/>
    <path d="M302 443C238 452 181 428 153 391" stroke-width="7" opacity=".9"/>
  </g>

  <!-- Mirrored rear composition, kept readable from the helicopter camera. -->
  <path d="M685 231C756 267 811 267 867 247C951 218 1024 269 1120 282V455H685Z" fill="url(#oliveFabric)"/>
  <path d="M685 421C742 414 783 385 811 342C841 296 891 279 935 297C983 318 1003 363 988 404C978 431 958 445 939 455H685Z" fill="${terracotta}"/>
  <path d="M685 409C744 404 780 376 804 337C835 287 890 269 940 290C995 314 1016 368 995 414C986 434 972 446 958 455" fill="none" stroke="${lightIvory}" stroke-width="11"/>
  <path d="M685 394C744 388 777 357 798 320" fill="none" stroke="${aegeanBlue}" stroke-width="10"/>
  <path d="M685 382C734 377 765 350 789 309" fill="none" stroke="${lightIvory}" stroke-width="5"/>
  <path d="M951 442C1001 424 1018 385 1000 348C982 310 932 301 901 326C875 347 879 385 905 399C926 411 951 400 956 379C960 362 947 349 932 351C918 353 912 365 916 375" fill="none" stroke="${lightIvory}" stroke-width="12" stroke-linecap="round"/>

  <!-- Olive branches in cream line-art, as on the chosen jersey. -->
  <g fill="none" stroke="${lightIvory}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M367 447C386 422 405 395 433 359"/>
    <path d="M386 420C373 400 375 383 390 371C398 390 397 405 386 420Z"/>
    <path d="M401 400C394 377 402 361 421 354C422 376 415 390 401 400Z"/>
    <path d="M416 382C418 361 429 349 446 347C441 366 431 378 416 382Z"/>
    <ellipse cx="380" cy="432" rx="8" ry="12" transform="rotate(-37 380 432)"/>
    <ellipse cx="395" cy="438" rx="8" ry="12" transform="rotate(-37 395 438)"/>
    <ellipse cx="410" cy="441" rx="8" ry="12" transform="rotate(-37 410 441)"/>
    <path d="M739 446C760 418 780 389 810 354"/>
    <path d="M760 417C746 397 750 378 765 368C773 388 772 403 760 417Z"/>
    <path d="M777 396C770 374 779 359 797 352C797 374 791 387 777 396Z"/>
    <ellipse cx="750" cy="430" rx="8" ry="12" transform="rotate(-37 750 430)"/>
    <ellipse cx="767" cy="436" rx="8" ry="12" transform="rotate(-37 767 436)"/>
  </g>

  <!-- Cretan sun marks on upper chest/back and sleeves. -->
  <g fill="none" stroke="${terracotta}" stroke-width="5" stroke-linecap="round">
    <circle cx="404" cy="72" r="12"/>
    <path d="M404 47V38 M404 106V97 M379 72H370 M438 72H429 M386 54L379 47 M429 97L422 90 M386 90L379 97 M429 47L422 54"/>
    <circle cx="1062" cy="72" r="12"/>
    <path d="M1062 47V38 M1062 106V97 M1037 72H1028 M1096 72H1087 M1044 54L1037 47 M1087 97L1080 90 M1044 90L1037 97 M1087 47L1080 54"/>
  </g>

  <!-- Bib shorts use the same four-colour identity without competing with the jersey. -->
  <path d="M135 455H450V826H135Z M685 455H1120V826H685Z" fill="url(#shorts)"/>
  <path d="M135 455H162V826H135Z M423 455H450V826H423Z M685 455H713V826H685Z M1092 455H1120V826H1092Z" fill="${terracotta}" opacity=".9"/>
  <path d="M162 455H171V826H162Z M414 455H423V826H414Z M713 455H722V826H713Z M1083 455H1092V826H1083Z" fill="${aegeanBlue}"/>
  <path d="M171 455H176V826H171Z M409 455H414V826H409Z M722 455H727V826H722Z M1078 455H1083V826H1078Z" fill="${lightIvory}"/>
  <path d="M0 748H135 M450 748H585 M1120 748H1200" stroke="${aegeanBlue}" stroke-width="8"/>
  <path d="M0 761H135 M450 761H585 M1120 761H1200" stroke="${lightIvory}" stroke-width="5"/>

  <rect width="1200" height="826" fill="url(#weave)" filter="url(#clothNoise)"/>
</svg>
`);

const logo = sharp(logoPath).trim({
  background: { r: 0, g: 0, b: 0, alpha: 0 },
});

async function createLogo(width, rotation = 0) {
  let pipeline = logo.clone().resize({ width, withoutEnlargement: false });
  if (rotation !== 0) {
    pipeline = pipeline.rotate(rotation, {
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }
  return pipeline.png().toBuffer();
}

const [frontLogo, backLogo, leftSleeveLogo, rightSleeveLogo, shortsLogo] =
  await Promise.all([
    createLogo(190),
    createLogo(210),
    createLogo(96, 90),
    createLogo(96, -90),
    createLogo(76),
  ]);

await sharp(textureSvg)
  .composite([
    { input: frontLogo, left: 197, top: 172 },
    { input: backLogo, left: 798, top: 166 },
    { input: leftSleeveLogo, left: 18, top: 170 },
    { input: rightSleeveLogo, left: 466, top: 166 },
    { input: leftSleeveLogo, left: 1123, top: 166 },
    { input: shortsLogo, left: 254, top: 552 },
    { input: shortsLogo, left: 868, top: 552 },
  ])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(texturePath);

const selectedJerseySource = await sharp(selectedJerseyPath)
  .extract({ left: 5, top: 1, width: 590, height: 748 })
  .png()
  .toBuffer();

const selectedJersey = await sharp(selectedJerseySource)
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .resize({
    width: 248,
    height: 248,
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
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
  .composite([{ input: selectedJersey, left: 4, top: 4 }])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(miniJerseyPath);

const sourcePreview = await sharp(selectedJerseySource)
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .resize({
    width: 420,
    height: 540,
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();
const texturePreview = await sharp(texturePath)
  .resize({ width: 920, height: 634, fit: "contain" })
  .png()
  .toBuffer();
const miniPreview = await sharp(miniJerseyPath)
  .resize({
    width: 256,
    height: 256,
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

const previewBackground = Buffer.from(`
<svg width="1600" height="1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1600" height="1080" fill="#f4f0e7"/>
  <rect x="34" y="34" width="1532" height="1012" rx="28" fill="#fffdf8" stroke="#d7c9aa" stroke-width="2"/>
  <text x="80" y="104" fill="#26351d" font-family="Arial, sans-serif" font-weight="700" font-size="38">KRITI GEA · LABYRINTHE</text>
  <text x="80" y="142" fill="#64705b" font-family="Arial, sans-serif" font-size="22">PCM26 · équipe permanente 302 · slot graphique APT</text>
  <text x="102" y="207" fill="#4b563f" font-family="Arial, sans-serif" font-weight="700" font-size="19">RÉFÉRENCE SÉLECTIONNÉE</text>
  <text x="565" y="207" fill="#4b563f" font-family="Arial, sans-serif" font-weight="700" font-size="19">PATRON UV PCM26</text>
  <text x="1175" y="920" fill="#4b563f" font-family="Arial, sans-serif" font-weight="700" font-size="19">MINI-MAILLOT</text>
  <rect x="548" y="226" width="984" height="694" rx="16" fill="#ece7dc"/>
  <rect x="80" y="226" width="440" height="672" rx="16" fill="#ece7dc"/>
  <g transform="translate(80 934)">
    <circle cx="14" cy="0" r="14" fill="${ivory}" stroke="#b8aa8d"/>
    <circle cx="64" cy="0" r="14" fill="${olive}"/>
    <circle cx="114" cy="0" r="14" fill="${terracotta}"/>
    <circle cx="164" cy="0" r="14" fill="${aegeanBlue}"/>
    <text x="204" y="7" fill="#64705b" font-family="Arial, sans-serif" font-size="20">ivoire · olive · terre cuite · bleu Égée</text>
  </g>
</svg>
`);

await sharp(previewBackground)
  .composite([
    { input: sourcePreview, left: 90, top: 280 },
    { input: texturePreview, left: 580, top: 254 },
    { input: miniPreview, left: 1284, top: 780 },
  ])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(previewPath);

async function describeAsset(filePath, role) {
  const data = await readFile(filePath);
  const metadata = await sharp(data).metadata();
  return {
    file: path.basename(filePath),
    role,
    width: metadata.width,
    height: metadata.height,
    sha256: createHash("sha256").update(data).digest("hex"),
  };
}

const manifest = {
  formatVersion: 1,
  generatedAt: new Date().toISOString(),
  game: "Pro Cycling Manager 2026",
  team: {
    permanentTeamId: "caea0559-e3a6-408b-9e2f-4a7755859dd6",
    pcmTeamId: 302,
    currentName: "Nisos Energeia",
    season4Sponsor: "Kriti Gea",
    displayCode: "KRI",
    pcmAssetCode: "APT",
  },
  selection: {
    sponsorId: "da289111-922f-458b-91fb-4e6330c80414",
    sponsorContractId: "df9e0f8d-1473-4c1c-af31-afb5785c9e9d",
    jerseyId: "kriti-gea-modern",
    jerseyStyle: "modern",
    jerseyName: "Labyrinthe",
    source: "manager season 4 selection",
  },
  assets: await Promise.all([
    describeAsset(texturePath, "PCM26 3D jersey UV texture"),
    describeAsset(miniJerseyPath, "PCM26 interface mini-jersey"),
    describeAsset(previewPath, "review board"),
  ]),
  notes: [
    "The mini-jersey uses the selected Cyclostratege artwork without reinterpretation.",
    "The UV texture recreates the selected ivory, olive, terracotta and Aegean-blue identity on the PCM26 garment layout.",
    "The permanent PCM team id remains 302 when the sponsor name changes.",
  ],
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      outputDirectory,
      texturePath,
      miniJerseyPath,
      previewPath,
      manifestPath,
    },
    null,
    2,
  ),
);
