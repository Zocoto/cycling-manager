import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const TEMPLATE_PATH = path.resolve(
  "scripts",
  "assets",
  "neutral-cycling-jersey-template.webp"
);
const OUTPUT_ROOT = path.resolve("public", "images", "sponsors");
const STYLES = ["classic", "modern", "bold"];

const SPONSORS = [
  {
    id: "gom-lam-viet",
    wordmark: "LAM VIỆT",
    descriptor: "GỐM VIỆT",
    primary: "#174A7E",
    secondary: "#F3EAD7",
    accent: "#C85A3E",
    symbol: ceramicSymbol,
    design: ceramicDesign,
  },
  {
    id: "dong-duong-phanh",
    wordmark: "ĐÔNG DƯƠNG",
    descriptor: "PHANH",
    primary: "#20282D",
    secondary: "#E76F2E",
    accent: "#C9D1D4",
    symbol: brakeSymbol,
    design: brakeDesign,
  },
  {
    id: "hai-au-dong-tau",
    wordmark: "HẢI ÂU",
    descriptor: "ĐÓNG TÀU",
    primary: "#0C3559",
    secondary: "#0B8E92",
    accent: "#D48A3A",
    symbol: shipyardSymbol,
    design: shipyardDesign,
  },
];

await main();

async function main() {
  const template = await sharp(TEMPLATE_PATH)
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(568, 720, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: 15,
      bottom: 15,
      left: 16,
      right: 16,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  // `dest-in` reads the alpha channel of the composite input. Keeping the
  // prepared RGBA template here preserves its true garment silhouette;
  // extracting the alpha channel alone would turn it into opaque grayscale.
  const alphaMask = template;

  const textileShading = await sharp(template)
    .greyscale()
    .linear(0.72, 64)
    .png()
    .toBuffer();

  for (const sponsor of SPONSORS) {
    const destination = path.join(OUTPUT_ROOT, sponsor.id);
    await mkdir(destination, { recursive: true });

    await sharp(Buffer.from(buildLogoSvg(sponsor)))
      .webp({ quality: 92, alphaQuality: 100, effort: 6 })
      .toFile(path.join(destination, "logo.webp"));

    for (const style of STYLES) {
      const painted = await sharp(Buffer.from(buildJerseySvg(sponsor, style)))
        .ensureAlpha()
        .composite([{ input: alphaMask, blend: "dest-in" }])
        .png()
        .toBuffer();

      await sharp(painted)
        .ensureAlpha()
        .composite([
          {
            input: textileShading,
            blend: "multiply",
            opacity: 0.34,
          },
          {
            input: Buffer.from(zipperHighlightSvg()),
            blend: "over",
          },
          { input: alphaMask, blend: "dest-in" },
        ])
        .webp({ quality: 88, alphaQuality: 96, effort: 6 })
        .toFile(path.join(destination, `jersey-${style}.webp`));
    }
  }

  console.log(
    `${SPONSORS.length} sponsors vietnamiens, ${SPONSORS.length} logos et ${SPONSORS.length * STYLES.length} maillots générés.`
  );
}

function buildLogoSvg(sponsor) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    ${sponsor.symbol({ x: 256, y: 154, scale: 1.18, sponsor })}
    <text x="256" y="365" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="48" font-weight="900" letter-spacing="1.8" fill="${sponsor.primary}">${escapeXml(sponsor.wordmark)}</text>
    <path d="M126 390H386" stroke="${sponsor.accent}" stroke-width="7" stroke-linecap="round"/>
    <text x="256" y="430" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="23" font-weight="800" letter-spacing="5" fill="${sponsor.secondary}">${escapeXml(sponsor.descriptor)}</text>
  </svg>`;
}

function buildJerseySvg(sponsor, style) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750" viewBox="0 0 600 750">
    <defs>
      <linearGradient id="softLight" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FFFFFF" stop-opacity=".18"/>
        <stop offset=".48" stop-color="#FFFFFF" stop-opacity="0"/>
        <stop offset="1" stop-color="#000000" stop-opacity=".13"/>
      </linearGradient>
      <pattern id="microDots" width="12" height="12" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r="1.25" fill="#FFFFFF" opacity=".14"/>
      </pattern>
    </defs>
    ${sponsor.design(style, sponsor)}
    <rect width="600" height="750" fill="url(#softLight)"/>
  </svg>`;
}

function ceramicDesign(style, sponsor) {
  const lockup = jerseyLockup(sponsor, {
    x: 300,
    y: style === "bold" ? 232 : 194,
    scale: style === "classic" ? 0.52 : 0.48,
    foreground: style === "modern" ? sponsor.secondary : sponsor.primary,
    detail: style === "modern" ? sponsor.accent : sponsor.accent,
  });

  if (style === "classic") {
    return `
      <rect width="600" height="750" fill="${sponsor.secondary}"/>
      <path d="M0 0H600V125C480 150 120 150 0 125Z" fill="${sponsor.primary}"/>
      <path d="M0 95C148 142 452 142 600 95V121C450 168 150 168 0 121Z" fill="${sponsor.accent}"/>
      <path d="M0 520C112 468 188 487 300 535C412 583 490 590 600 530V750H0Z" fill="${sponsor.primary}"/>
      <path d="M0 499C108 448 195 457 306 507C415 556 505 559 600 506" fill="none" stroke="${sponsor.accent}" stroke-width="16" stroke-linecap="round"/>
      <path d="M0 558C117 510 206 527 311 574C418 622 504 626 600 576" fill="none" stroke="${sponsor.secondary}" stroke-width="9" opacity=".92"/>
      ${ceramicBand(36, 314, sponsor.primary, sponsor.accent)}
      ${lockup}`;
  }

  if (style === "modern") {
    return `
      <rect width="600" height="750" fill="${sponsor.primary}"/>
      <path d="M0 0H600L488 166L362 210L226 182L86 111Z" fill="${sponsor.secondary}"/>
      <path d="M-45 615C128 484 258 469 435 517C502 535 554 535 645 493V750H-45Z" fill="${sponsor.secondary}"/>
      <path d="M-60 628C118 487 257 471 441 526C513 547 568 540 658 490" fill="none" stroke="${sponsor.accent}" stroke-width="27" stroke-linecap="round"/>
      <path d="M53 96C170 150 246 192 358 183C436 177 502 143 574 73" fill="none" stroke="${sponsor.accent}" stroke-width="12" stroke-linecap="round"/>
      <path d="M0 0H132L203 750H0Z" fill="url(#microDots)" opacity=".9"/>
      ${lockup}`;
  }

  return `
    <rect width="600" height="750" fill="${sponsor.accent}"/>
    <path d="M0 0H600V191C457 137 144 137 0 191Z" fill="${sponsor.primary}"/>
    <path d="M0 476C135 377 251 367 370 414C461 450 524 449 600 408V750H0Z" fill="${sponsor.primary}"/>
    <path d="M-28 447C112 335 250 326 380 379C477 419 545 408 624 354" fill="none" stroke="${sponsor.secondary}" stroke-width="72" stroke-linecap="round"/>
    <path d="M-20 447C118 352 250 348 377 398C475 437 544 427 618 378" fill="none" stroke="${sponsor.primary}" stroke-width="15" stroke-linecap="round"/>
    <g opacity=".22">${ceramicBand(24, 576, sponsor.secondary, sponsor.accent)}</g>
    ${lockup}`;
}

function brakeDesign(style, sponsor) {
  const dark = sponsor.primary;
  const orange = sponsor.secondary;
  const metal = sponsor.accent;
  const lockup = jerseyLockup(sponsor, {
    x: 300,
    y: style === "bold" ? 292 : 194,
    scale: style === "classic" ? 0.48 : 0.45,
    foreground: style === "classic" ? dark : style === "modern" ? dark : "#FFFFFF",
    detail: orange,
  });

  if (style === "classic") {
    return `
      <rect width="600" height="750" fill="${metal}"/>
      <path d="M0 0H600V158C452 130 148 130 0 158Z" fill="${dark}"/>
      <path d="M0 526C140 472 231 488 331 533C431 579 513 575 600 528V750H0Z" fill="${dark}"/>
      <path d="M0 503C144 449 244 464 341 508C435 551 522 547 600 503" fill="none" stroke="${orange}" stroke-width="20"/>
      ${rotor(72, 142, 93, dark, orange, 0.34)}
      ${rotor(528, 142, 93, dark, orange, 0.34)}
      <rect y="310" width="600" height="38" fill="${dark}"/>
      <rect y="348" width="600" height="9" fill="${orange}"/>
      ${lockup}`;
  }

  if (style === "modern") {
    return `
      <rect width="600" height="750" fill="#EEF0EF"/>
      <path d="M0 0H177L600 632V750H484L0 170Z" fill="${dark}"/>
      <path d="M0 120L600 574V635L0 188Z" fill="${orange}"/>
      <path d="M0 150L600 603V622L0 176Z" fill="${metal}" opacity=".95"/>
      ${rotor(470, 522, 187, metal, orange, 0.48)}
      <path d="M-40 418C137 300 307 275 637 359" fill="none" stroke="${orange}" stroke-width="25" stroke-linecap="round"/>
      ${lockup}`;
  }

  return `
    <rect width="600" height="750" fill="${orange}"/>
    <path d="M0 0H600V112C442 155 158 155 0 112Z" fill="${dark}"/>
    ${rotor(300, 430, 270, dark, metal, 0.92)}
    ${rotor(300, 430, 184, metal, dark, 0.74)}
    <path d="M0 663L600 526V750H0Z" fill="${dark}"/>
    <path d="M0 631L600 494" stroke="${metal}" stroke-width="14"/>
    ${lockup}`;
}

function shipyardDesign(style, sponsor) {
  const navy = sponsor.primary;
  const teal = sponsor.secondary;
  const copper = sponsor.accent;
  const pearl = "#F2F4EF";
  const lockup = jerseyLockup(sponsor, {
    x: 300,
    y: style === "bold" ? 242 : 196,
    scale: style === "classic" ? 0.5 : 0.46,
    foreground: style === "classic" ? navy : pearl,
    detail: copper,
  });

  if (style === "classic") {
    return `
      <rect width="600" height="750" fill="${pearl}"/>
      <path d="M0 0H600V145C448 116 152 116 0 145Z" fill="${navy}"/>
      <path d="M0 478H600V750H0Z" fill="${navy}"/>
      <path d="M0 477H600V507H0Z" fill="${teal}"/>
      <path d="M0 516H600V526H0Z" fill="${copper}"/>
      <path d="M62 402H538L486 458H114Z" fill="${teal}" opacity=".18"/>
      <path d="M96 400H504L472 434H128Z" fill="none" stroke="${teal}" stroke-width="8"/>
      ${lockup}`;
  }

  if (style === "modern") {
    return `
      <rect width="600" height="750" fill="${navy}"/>
      <path d="M-40 671L600 221V750H-40Z" fill="${teal}"/>
      <path d="M-35 624L600 179V241L-35 690Z" fill="${pearl}"/>
      <path d="M-20 596L600 160V191L-20 628Z" fill="${copper}"/>
      <path d="M0 0H600V102C458 139 142 139 0 102Z" fill="${pearl}"/>
      <path d="M0 0H600V73C453 105 147 105 0 73Z" fill="${teal}"/>
      <path d="M72 576L338 390L555 357L389 454Z" fill="${navy}" opacity=".68"/>
      ${lockup}`;
  }

  return `
    <rect width="600" height="750" fill="${teal}"/>
    <path d="M0 0H600V187C458 127 142 127 0 187Z" fill="${navy}"/>
    <path d="M41 0H86V750H41ZM514 0H559V750H514Z" fill="${navy}"/>
    <path d="M41 360H559V389H41ZM41 570H559V599H41Z" fill="${copper}"/>
    <path d="M81 134C185 61 235 99 300 155C365 99 415 61 519 134C425 120 369 178 300 216C231 178 175 120 81 134Z" fill="${pearl}" opacity=".95"/>
    <path d="M0 646C161 589 281 607 394 646C473 673 539 669 600 639V750H0Z" fill="${navy}"/>
    ${lockup}`;
}

function jerseyLockup(sponsor, { x, y, scale, foreground, detail }) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    ${sponsor.symbol({ x: 0, y: -52, scale: 0.52, sponsor, primary: foreground, secondary: detail, accent: foreground })}
    <text x="0" y="51" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="50" font-weight="900" letter-spacing="1.8" fill="${foreground}">${escapeXml(sponsor.wordmark)}</text>
    <path d="M-137 70H137" stroke="${detail}" stroke-width="8" stroke-linecap="round"/>
    <text x="0" y="105" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="25" font-weight="800" letter-spacing="5" fill="${detail}">${escapeXml(sponsor.descriptor)}</text>
  </g>`;
}

function ceramicSymbol({ x, y, scale, sponsor, primary, secondary, accent }) {
  const p = primary ?? sponsor.primary;
  const s = secondary ?? sponsor.secondary;
  const a = accent ?? sponsor.accent;
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <path d="M-96-28C-72 47-38 78 0 78S72 47 96-28C42-8-42-8-96-28Z" fill="${p}"/>
    <path d="M-86-25C-39-9 39-9 86-25C42-44-42-44-86-25Z" fill="${s}" stroke="${p}" stroke-width="8"/>
    <path d="M-58 7C-22-8 17 25 59 3" fill="none" stroke="${s}" stroke-width="11" stroke-linecap="round"/>
    <path d="M26-98C66-69 64-34 31-13C43-44 12-45 26-98Z" fill="${a}"/>
  </g>`;
}

function brakeSymbol({ x, y, scale, sponsor, primary, secondary, accent }) {
  const p = primary ?? sponsor.primary;
  const s = secondary ?? sponsor.secondary;
  const a = accent ?? sponsor.accent;
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <circle r="82" fill="none" stroke="${p}" stroke-width="22"/>
    <circle r="38" fill="none" stroke="${a}" stroke-width="15"/>
    <g fill="${a}">${Array.from({ length: 8 }, (_, index) => {
      const angle = index * 45;
      return `<circle cx="0" cy="-61" r="7" transform="rotate(${angle})"/>`;
    }).join("")}</g>
    <path d="M31-81H87V17C87 58 60 81 28 83L4 38C24 29 31 16 31-9Z" fill="${s}"/>
  </g>`;
}

function shipyardSymbol({ x, y, scale, sponsor, primary, secondary, accent }) {
  const p = primary ?? sponsor.primary;
  const s = secondary ?? sponsor.secondary;
  const a = accent ?? sponsor.accent;
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <path d="M-111 2C-65-39-26-44 0-7C26-44 65-39 111 2C59-7 31 13 0 38C-31 13-59-7-111 2Z" fill="${p}"/>
    <path d="M-92 49H93L61 89H-61Z" fill="${s}"/>
    <path d="M-73 93C-28 72 30 110 77 86" fill="none" stroke="${a}" stroke-width="13" stroke-linecap="round"/>
  </g>`;
}

function ceramicBand(y, height, primary, accent) {
  return `<g transform="translate(0 ${y})">
    <path d="M0 0H600" stroke="${primary}" stroke-width="${height}"/>
    ${Array.from({ length: 12 }, (_, index) => {
      const x = 25 + index * 50;
      return `<path d="M${x - 13} 0Q${x} -16 ${x + 13} 0Q${x} 16 ${x - 13} 0" fill="none" stroke="${accent}" stroke-width="5"/>`;
    }).join("")}
  </g>`;
}

function rotor(cx, cy, radius, ring, holes, opacity) {
  return `<g opacity="${opacity}">
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${ring}" stroke-width="24"/>
    <circle cx="${cx}" cy="${cy}" r="${radius * 0.57}" fill="none" stroke="${holes}" stroke-width="10"/>
    ${Array.from({ length: 12 }, (_, index) => {
      const angle = index * 30;
      const holeRadius = radius * 0.8;
      const x = cx + Math.sin((angle * Math.PI) / 180) * holeRadius;
      const y = cy - Math.cos((angle * Math.PI) / 180) * holeRadius;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${Math.max(4, radius * 0.045).toFixed(1)}" fill="${holes}"/>`;
    }).join("")}
  </g>`;
}

function zipperHighlightSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750" viewBox="0 0 600 750">
    <path d="M299 63V690" stroke="#111820" stroke-opacity=".34" stroke-width="3"/>
    <path d="M302 63V690" stroke="#FFFFFF" stroke-opacity=".38" stroke-width="2"/>
    <rect x="293" y="64" width="14" height="24" rx="5" fill="#222B31" opacity=".76"/>
  </svg>`;
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
