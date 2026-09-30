import { access, mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const SOURCE_DIRECTORY = path.resolve("tmp", "priority-partnership-batch-01");
const OUTPUT_DIRECTORY = path.resolve("public", "images", "sponsors");
const STYLES = ["classic", "modern", "bold"];

const BRANDS = [
  {
    id: "stupina-rautului",
    main: "STUPINA",
    second: "RĂUTULUI",
    descriptor: "MIERE · PROPOLIS · CEARĂ",
    colors: ["#4A2438", "#D99024", "#F4E3B1"],
    jerseyLogoTop: { bold: 175 },
    emblem: `<g stroke="#4A2438" stroke-width="13" stroke-linejoin="round"><path fill="#D99024" d="M256 45l67 38v77l-67 39-67-39V83z"/><path fill="#F4E3B1" d="M183 126c-62-23-104 15-100 67 47 18 87 1 119-37m127-30c62-23 104 15 100 67-47 18-87 1-119-37"/><path fill="#D99024" d="M213 168c-30 32-27 114 43 151 70-37 73-119 43-151z"/><path fill="none" d="M215 219c27 21 55 21 82 0m-87 51c31 20 61 20 92 0"/></g>`,
  },
  {
    id: "covoare-basarabene",
    main: "COVOARE",
    second: "BASARABENE",
    descriptor: "ȚESUTE ÎN MOLDOVA",
    colors: ["#A63D3A", "#233A63", "#E5C07B"],
    emblem: `<g transform="translate(256 174) rotate(45)"><rect x="-99" y="-99" width="198" height="198" rx="8" fill="#233A63"/><path d="M-99-34H-34V-99H34V-34H99V34H34V99H-34V34H-99z" fill="#A63D3A"/><rect x="-31" y="-31" width="62" height="62" fill="#E5C07B"/><path d="M-132-52h33v33h-33zm231 0h33v33H99zM-132 19h33v33h-33zm231 0h33v33H99z" fill="#E5C07B"/></g>`,
  },
  {
    id: "mecanica-balti",
    main: "MECANICA",
    second: "BĂLȚI",
    descriptor: "UTILAJE AGRICOLE",
    colors: ["#183247", "#D2672B", "#AAB3B7"],
    jerseyLogoTop: { bold: 175 },
    emblem: `<path fill="#D2672B" d="M107 96l44-44 37 27 26-14 9-46h66l9 46 26 14 37-27 44 44-26 37 14 26 46 9v66l-46 9-14 26 26 37-44 44-37-27-26 14H214l-26-14-37 27-44-44 26-37-14-26-46-9v-66l46-9 14-26z"/><path fill="#183247" d="M143 149h63l50 54 50-54h63v147h-66v-68l-47 49-47-49v68h-66z"/><path d="M152 330l104-37 104 37-104-17zM173 363l83-36 83 36-83-17z" fill="#AAB3B7"/>`,
  },
  {
    id: "lana-sibiului",
    main: "LÂNA",
    second: "SIBIULUI",
    descriptor: "FIR DIN CARPAȚI",
    colors: ["#214C3A", "#F1E7CF", "#C89A3D"],
    jerseySecondColor: "#C89A3D",
    emblem: `<path d="M362 126c-22-61-115-82-176-26-68 63-27 167 63 158 64-6 78-82 34-111-37-24-81 2-76 42 4 29 41 39 60 18" fill="none" stroke="#214C3A" stroke-width="28" stroke-linecap="round"/><path d="M96 310c56-58 108-66 160-20 55 49 107 30 160-31" fill="none" stroke="#C89A3D" stroke-width="28" stroke-linecap="round"/><path d="M105 350c59-45 111-47 157-8 51 42 99 29 145-10" fill="none" stroke="#214C3A" stroke-width="17" stroke-linecap="round"/>`,
  },
  {
    id: "portelan-de-alba",
    main: "PORȚELAN",
    second: "DE ALBA",
    descriptor: "DIN INIMA TRANSILVANIEI",
    colors: ["#1E4D8F", "#F7F4EA", "#C75B39"],
    jerseySecondColor: "#C75B39",
    jerseyLogoTop: { modern: 190 },
    emblem: `<path d="M104 245V137c0-93 304-93 304 0v108" fill="none" stroke="#1E4D8F" stroke-width="28" stroke-linecap="round"/><path d="M126 235h260c-8 87-50 128-130 128s-122-41-130-128z" fill="#F7F4EA" stroke="#1E4D8F" stroke-width="20"/><path d="M163 286c57-42 119 48 188-10" fill="none" stroke="#1E4D8F" stroke-width="17" stroke-linecap="round"/><path d="M217 220a39 39 0 0178 0z" fill="#C75B39"/>`,
  },
];

await main();

async function main() {
  let finalizedJerseys = 0;

  for (const brand of BRANDS) {
    const destination = path.join(OUTPUT_DIRECTORY, brand.id);
    await mkdir(destination, { recursive: true });
    const logo = await buildLogo(brand);
    await sharp(logo).webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(destination, "logo.webp"));

    for (const style of STYLES) {
      const source = path.join(SOURCE_DIRECTORY, `${brand.id}-${style}.png`);
      if (!(await exists(source))) continue;
      await finalizeJersey(source, logo, path.join(destination, `jersey-${style}.webp`));
      finalizedJerseys += 1;
    }
  }

  console.log(`${BRANDS.length} logos et ${finalizedJerseys} maillots finalisés.`);
}

function buildLogo(brand) {
  const [primary, secondary, accent] = brand.colors;
  const mainSize = fitText(brand.main, 54, 38);
  const secondSize = fitText(brand.second, 42, 31);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    ${brand.emblem}
    <text x="256" y="397" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="${mainSize}" font-weight="900" letter-spacing="2" fill="${primary}">${escapeXml(brand.main)}</text>
    <text x="256" y="439" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="${secondSize}" font-weight="800" letter-spacing="4" fill="${secondary}">${escapeXml(brand.second)}</text>
    <path d="M92 458h328" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>
    <text x="256" y="486" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" letter-spacing="3.2" fill="${primary}">${escapeXml(brand.descriptor)}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function finalizeJersey(sourcePath, logo, destinationPath) {
  const cleaned = await cleanTransparentSource(sourcePath);
  const jersey = await sharp(cleaned)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(568, 720, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const brand = BRANDS.find(({ id }) => destinationPath.includes(id));
  if (!brand) throw new Error(`Marque introuvable pour ${destinationPath}`);
  const jerseyLogo = await buildJerseyLogo(brand);
  const lockup = await sharp(jerseyLogo).resize({ width: 160 }).png().toBuffer();
  const style = STYLES.find((candidate) => destinationPath.includes(`jersey-${candidate}.webp`));
  const logoTop = Math.round((((style && brand.jerseyLogoTop?.[style]) ?? 225) / 960) * 750);

  await sharp({
    create: { width: 600, height: 750, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: jersey, gravity: "center" },
      { input: lockup, left: 220, top: logoTop },
    ])
    .webp({ quality: 88, alphaQuality: 94, effort: 6 })
    .toFile(destinationPath);
}

function buildJerseyLogo(brand) {
  const [primary, secondary] = brand.colors;
  const mainSize = fitText(brand.main, 54, 38);
  const secondSize = fitText(brand.second, 42, 31);
  const secondColor = brand.jerseySecondColor ?? secondary;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    ${brand.emblem}
    <text x="256" y="399" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="${mainSize}" font-weight="900" letter-spacing="2" fill="${primary}">${escapeXml(brand.main)}</text>
    <text x="256" y="448" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="${secondSize}" font-weight="900" letter-spacing="4" fill="${secondColor}">${escapeXml(brand.second)}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function cleanTransparentSource(sourcePath) {
  const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const corners = [[2, 2], [info.width - 3, 2], [2, info.height - 3], [info.width - 3, info.height - 3]];
  const key = corners.reduce((sum, [x, y]) => {
    const offset = (y * info.width + x) * 4;
    sum[0] += data[offset]; sum[1] += data[offset + 1]; sum[2] += data[offset + 2];
    return sum;
  }, [0, 0, 0]).map((value) => value / corners.length);

  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] < 250) continue;
    const distance = Math.hypot(data[offset] - key[0], data[offset + 1] - key[1], data[offset + 2] - key[2]);
    if (distance < 10) data[offset + 3] = 0;
    else if (distance < 78) data[offset + 3] = Math.round(((distance - 10) / 68) * 255);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

function fitText(value, maximum, minimum) {
  return Math.max(minimum, Math.min(maximum, Math.floor(460 / Math.max(4, value.length) * 1.55)));
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}
