import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import {
  AIRLINE_SPONSORS,
  TOURISM_SPONSORS,
} from "../data/sponsors/tourism-airlines";
import type { Sponsor } from "../types/sponsor";

const sponsors = [
  ...TOURISM_SPONSORS,
  ...AIRLINE_SPONSORS,
] satisfies readonly Sponsor[];

const sourceDirectory = path.resolve(
  "tmp",
  "travel-sponsor-sources"
);

const publicSponsorDirectory = path.resolve(
  "public",
  "images",
  "sponsors"
);

const jerseyWidth = 600;
const jerseyHeight = 750;

async function main(): Promise<void> {
  const jerseyBase = await prepareJerseyBase();
  const jerseyMask = await sharp(jerseyBase)
    .extractChannel(3)
    .png()
    .toBuffer();

  for (const [index, sponsor] of sponsors.entries()) {
    const outputDirectory = path.join(
      publicSponsorDirectory,
      sponsor.id
    );

    await mkdir(outputDirectory, {
      recursive: true,
    });

    const sourceLogoPath = path.join(
      sourceDirectory,
      `${sponsor.id}-logo.png`
    );

    const logo = await prepareLogo(sourceLogoPath);

    await sharp(logo)
      .webp({
        quality: 84,
        alphaQuality: 96,
        effort: 6,
        smartSubsample: true,
      })
      .toFile(
        path.join(outputDirectory, "logo.webp")
      );

    for (const jersey of sponsor.jerseys) {
      const design = await renderJersey({
        sponsor,
        style: jersey.style,
        sponsorIndex: index,
        logo,
        jerseyBase,
        jerseyMask,
      });

      await sharp(design)
        .webp({
          quality: 82,
          alphaQuality: 94,
          effort: 6,
          smartSubsample: true,
        })
        .toFile(
          path.join(
            outputDirectory,
            `jersey-${jersey.style}.webp`
          )
        );
    }
  }

  console.log(
    `${sponsors.length} sponsors et ${sponsors.length * 3} maillots générés.`
  );
}

async function prepareLogo(
  sourcePath: string
): Promise<Buffer> {
  const source = await normalizeSourceTransparency(
    sourcePath
  );

  const layer = await sharp(source)
    .trim({
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0,
      },
    })
    .resize(474, 474, {
      fit: "contain",
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0,
      },
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0,
      },
    },
  })
    .composite([
      {
        input: layer,
        gravity: "center",
      },
    ])
    .png()
    .toBuffer();
}

async function prepareJerseyBase(): Promise<Buffer> {
  const sourcePath = path.join(
    sourceDirectory,
    "blank-jersey.png"
  );

  const source = await normalizeSourceTransparency(
    sourcePath
  );

  const layer = await sharp(source)
    .trim({
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0,
      },
    })
    .resize(566, 704, {
      fit: "contain",
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0,
      },
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: jerseyWidth,
      height: jerseyHeight,
      channels: 4,
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0,
      },
    },
  })
    .composite([
      {
        input: layer,
        gravity: "center",
      },
    ])
    .png()
    .toBuffer();
}

async function normalizeSourceTransparency(
  sourcePath: string
): Promise<Buffer> {
  const metadata = await sharp(sourcePath).metadata();

  if (metadata.hasAlpha) {
    return sharp(sourcePath)
      .ensureAlpha()
      .png()
      .toBuffer();
  }

  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cornerPixels = [
    0,
    info.width - 1,
    (info.height - 1) * info.width,
    info.height * info.width - 1,
  ];

  const background = cornerPixels.reduce(
    (average, pixelIndex) => {
      const offset = pixelIndex * 4;
      average[0] += data[offset];
      average[1] += data[offset + 1];
      average[2] += data[offset + 2];
      return average;
    },
    [0, 0, 0]
  ).map((value) => value / cornerPixels.length);

  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset] - background[0];
    const green = data[offset + 1] - background[1];
    const blue = data[offset + 2] - background[2];
    const distance = Math.sqrt(
      red ** 2 + green ** 2 + blue ** 2
    );

    data[offset + 3] = Math.round(
      255 * Math.max(0, Math.min(1, (distance - 12) / 72))
    );
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

async function renderJersey({
  sponsor,
  style,
  sponsorIndex,
  logo,
  jerseyBase,
  jerseyMask,
}: {
  sponsor: Sponsor;
  style: Sponsor["jerseys"][number]["style"];
  sponsorIndex: number;
  logo: Buffer;
  jerseyBase: Buffer;
  jerseyMask: Buffer;
}): Promise<Buffer> {
  const artwork = Buffer.from(
    buildJerseySvg({
      sponsor,
      style,
      sponsorIndex,
    })
  );

  const maskedArtwork = await sharp(artwork)
    .removeAlpha()
    .joinChannel(jerseyMask)
    .png()
    .toBuffer();

  const texture = await buildJerseyTexture(
    jerseyBase
  );

  const logoPlacement =
    style === "classic"
      ? { width: 104, height: 104, left: 248, top: 188 }
      : style === "modern"
        ? { width: 94, height: 94, left: 374, top: 175 }
        : { width: 112, height: 112, left: 244, top: 164 };

  const jerseyLogo = await sharp(logo)
    .resize(
      logoPlacement.width,
      logoPlacement.height,
      {
        fit: "contain",
        background: {
          r: 0,
          g: 0,
          b: 0,
          alpha: 0,
        },
      }
    )
    .png()
    .toBuffer();

  const styledJersey = await sharp(maskedArtwork)
    .composite([
      {
        input: texture,
        blend: "multiply",
      },
      {
        input: jerseyBase,
        blend: "soft-light",
      },
      {
        input: jerseyLogo,
        left: logoPlacement.left,
        top: logoPlacement.top,
      },
    ])
    .png()
    .toBuffer();

  const highlightedJersey = await sharp(styledJersey)
    .composite([
      {
        input: buildSeamHighlightSvg(),
        blend: "screen",
      },
    ])
    .png()
    .toBuffer();

  return applyAlphaMask(
    highlightedJersey,
    jerseyMask
  );
}

async function applyAlphaMask(
  image: Buffer,
  alphaMask: Buffer
): Promise<Buffer> {
  const { data: colorData, info } = await sharp(image)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const maskData = await sharp(alphaMask)
    .greyscale()
    .raw()
    .toBuffer();

  const output = Buffer.alloc(
    info.width * info.height * 4
  );

  for (
    let pixelIndex = 0;
    pixelIndex < info.width * info.height;
    pixelIndex += 1
  ) {
    const colorOffset = pixelIndex * 3;
    const outputOffset = pixelIndex * 4;

    output[outputOffset] = colorData[colorOffset];
    output[outputOffset + 1] =
      colorData[colorOffset + 1];
    output[outputOffset + 2] =
      colorData[colorOffset + 2];
    output[outputOffset + 3] =
      maskData[pixelIndex];
  }

  return sharp(output, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

async function buildJerseyTexture(
  jerseyBase: Buffer
): Promise<Buffer> {
  const { data, info } = await sharp(jerseyBase)
    .greyscale()
    .linear(1.1, -16)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (
    let offset = 0;
    offset < data.length;
    offset += info.channels
  ) {
    const alphaOffset = offset + info.channels - 1;
    data[alphaOffset] = Math.round(
      data[alphaOffset] * 0.62
    );
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toBuffer();
}

function buildJerseySvg({
  sponsor,
  style,
  sponsorIndex,
}: {
  sponsor: Sponsor;
  style: Sponsor["jerseys"][number]["style"];
  sponsorIndex: number;
}): string {
  const { primary, secondary, accent, background, text } = sponsor.colors;
  const label = escapeXml(sponsor.shortName.toUpperCase());
  const fontSize = fitLabelFontSize(
    sponsor.shortName,
    style === "classic"
      ? 410
      : style === "modern"
        ? 340
        : 260
  );
  const commonTexture = `
    <filter id="fabric" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="${sponsorIndex + 11}" result="noise"/>
      <feColorMatrix in="noise" type="saturate" values="0" result="mono"/>
      <feComponentTransfer in="mono" result="faded"><feFuncA type="table" tableValues="0 0.08"/></feComponentTransfer>
      <feBlend in="SourceGraphic" in2="faded" mode="overlay"/>
    </filter>`;

  const artwork =
    style === "classic"
      ? `
        <rect width="600" height="750" fill="${primary}"/>
        <path d="M0 88H600V205H0Z" fill="${secondary}"/>
        <path d="M0 205H600V225H0Z" fill="${accent}"/>
        <path d="M0 555H600V610H0Z" fill="${secondary}" opacity=".88"/>
        <path d="M0 610H600V624H0Z" fill="${accent}"/>
        <path d="M0 260H600V385H0Z" fill="${background}" opacity=".96"/>
        <path d="M0 260H600M0 385H600" stroke="${accent}" stroke-width="10"/>
        <text x="300" y="354" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="${fontSize}" font-weight="900" letter-spacing="1" fill="${text}">${label}</text>
        <path d="M299 35V710" stroke="${text}" stroke-width="5" opacity=".34"/>
        <path d="M306 35V710" stroke="${background}" stroke-width="2" opacity=".44"/>`
      : style === "modern"
        ? `
          <rect width="600" height="750" fill="${background}"/>
          <path d="M-100 690 418 -40 720 -40 154 760Z" fill="${primary}"/>
          <path d="M-24 730 461 -15 520 28 35 770Z" fill="${secondary}"/>
          <path d="M65 750 488 80 520 103 98 750Z" fill="${accent}"/>
          <path d="M-35 130C135 202 274 167 632 52" fill="none" stroke="${secondary}" stroke-width="30" opacity=".8"/>
          <path d="M-35 130C135 202 274 167 632 52" fill="none" stroke="${accent}" stroke-width="8"/>
          <g transform="rotate(-10 300 422)">
            <rect x="94" y="382" width="412" height="78" rx="39" fill="${background}" opacity=".9"/>
            <text x="300" y="435" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="${fontSize}" font-weight="900" fill="${text}">${label}</text>
          </g>
          <path d="M299 35V710" stroke="${text}" stroke-width="5" opacity=".3"/>
          <path d="M306 35V710" stroke="${background}" stroke-width="2" opacity=".42"/>`
        : `
          <rect width="600" height="750" fill="${secondary}"/>
          <rect x="0" y="0" width="600" height="750" fill="${primary}" opacity=".7"/>
          ${buildBoldMotif(sponsor, sponsorIndex)}
          <path d="M48 545H552" stroke="${background}" stroke-width="4" opacity=".66"/>
          <text x="300" y="600" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="${fontSize + 2}" font-weight="900" fill="${background}" stroke="${text}" stroke-width="1.4" paint-order="stroke">${label}</text>
          <path d="M299 35V710" stroke="${text}" stroke-width="5" opacity=".34"/>
          <path d="M306 35V710" stroke="${background}" stroke-width="2" opacity=".46"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
    <defs>${commonTexture}</defs>
    <g filter="url(#fabric)">${artwork}</g>
  </svg>`;
}

function buildBoldMotif(
  sponsor: Sponsor,
  sponsorIndex: number
): string {
  const { secondary, accent, background, text } = sponsor.colors;
  const starField = Array.from(
    { length: 18 },
    (_, index) => {
      const x = 50 + ((index * 97 + sponsorIndex * 31) % 500);
      const y = 90 + ((index * 53 + sponsorIndex * 17) % 410);
      const radius = 2 + (index % 4);
      return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${background}" opacity="${0.4 + (index % 3) * 0.2}"/>`;
    }
  ).join("");

  switch (sponsor.id) {
    case "mongolian-steppes":
      return `<circle cx="430" cy="150" r="92" fill="${accent}"/><path d="M-30 420C92 330 182 443 300 352S505 300 650 370" fill="none" stroke="${background}" stroke-width="52"/><path d="M-30 440C105 350 206 462 320 374S520 322 650 388" fill="none" stroke="${accent}" stroke-width="18"/><path d="M94 468C188 415 241 488 323 446S446 423 516 453" fill="none" stroke="${secondary}" stroke-width="14"/>`;
    case "himalayan-mountains":
      return `<circle cx="430" cy="154" r="100" fill="${secondary}"/><path d="M-40 515 148 245 248 390 356 192 650 540Z" fill="${background}"/><path d="M78 350 148 245 203 326 176 312 151 334 126 309ZM287 315 356 192 431 329 389 296 355 322 329 291Z" fill="${accent}"/>`;
    case "visit-samarkand":
      return `<g fill="none" stroke="${accent}" stroke-width="12" opacity=".9"><path d="M70 110 150 30 230 110 150 190ZM370 110 450 30 530 110 450 190Z"/><path d="M45 365 150 260 255 365 150 470ZM345 365 450 260 555 365 450 470Z"/></g><g fill="${background}" opacity=".7"><circle cx="150" cy="110" r="28"/><circle cx="450" cy="110" r="28"/><circle cx="150" cy="365" r="34"/><circle cx="450" cy="365" r="34"/></g>`;
    case "kyrgyz-highlands":
      return `<circle cx="300" cy="338" r="196" fill="none" stroke="${background}" stroke-width="18"/><circle cx="300" cy="338" r="92" fill="${accent}" opacity=".85"/><g stroke="${background}" stroke-width="12">${Array.from({ length: 12 }, (_, index) => `<path d="M300 338 300 145" transform="rotate(${index * 30} 300 338)"/>`).join("")}</g>`;
    case "visit-albanian-riviera":
      return `<circle cx="420" cy="155" r="92" fill="${accent}"/><path d="M-50 470C90 342 201 520 331 381S529 330 655 423" fill="none" stroke="${background}" stroke-width="58"/><path d="M-50 485C102 365 210 534 346 397S538 353 655 438" fill="none" stroke="${accent}" stroke-width="24"/><path d="M95 236 300 102 505 236 420 214 300 250 180 214Z" fill="${secondary}" opacity=".84"/>`;
    case "wadi-rum-horizons":
      return `${starField}<circle cx="440" cy="180" r="72" fill="${accent}" opacity=".8"/><path d="M30 476C97 350 166 320 240 429 321 546 390 285 565 431" fill="none" stroke="${background}" stroke-width="54"/><path d="M40 492C131 397 176 389 239 453 315 529 402 350 560 452" fill="none" stroke="${accent}" stroke-width="18"/>`;
    case "guatemala-volcano-routes":
      return `<path d="M42 505 286 180 552 505Z" fill="${text}"/><path d="M214 278 286 180 367 285 326 264 289 296 254 260Z" fill="${background}"/><path d="M286 180C281 239 330 269 305 334S258 420 291 511" fill="none" stroke="${accent}" stroke-width="22"/><path d="M-20 475C151 420 273 538 626 438" fill="none" stroke="${secondary}" stroke-width="38"/>`;
    case "pearl-of-africa-trails":
      return `<circle cx="440" cy="154" r="86" fill="${accent}"/><path d="M90 500C45 363 115 209 249 126 196 283 217 392 90 500ZM510 500C555 363 485 209 351 126 404 283 383 392 510 500Z" fill="${background}" opacity=".78"/><path d="M300 165C256 246 257 335 300 424 343 335 344 246 300 165Z" fill="${accent}"/>`;
    case "mekong-discovery-laos":
      return `<path d="M-30 464C73 315 175 520 290 364S485 286 630 419" fill="none" stroke="${background}" stroke-width="50"/><path d="M-20 482C82 351 183 532 305 381S496 315 620 438" fill="none" stroke="${accent}" stroke-width="16"/><g fill="${accent}" stroke="${background}" stroke-width="5"><ellipse cx="300" cy="224" rx="42" ry="91"/><ellipse cx="300" cy="224" rx="42" ry="91" transform="rotate(58 300 224)"/><ellipse cx="300" cy="224" rx="42" ry="91" transform="rotate(-58 300 224)"/></g>`;
    case "visit-icelandic-highlands":
      return `${starField}<path d="M-70 125C75 20 176 218 306 90S500 22 680 134" fill="none" stroke="${accent}" stroke-width="42" opacity=".9"/><path d="M-50 174C84 70 188 242 314 132S508 62 650 173" fill="none" stroke="${secondary}" stroke-width="25"/><path d="M35 500 213 251 308 392 408 216 574 500Z" fill="${text}" opacity=".8"/>`;
    case "druk-horizon-air":
      return `<path d="M-60 430C98 361 184 200 315 104 235 279 267 358 659 250-42 637 83 464-60 430Z" fill="${accent}"/><path d="M-40 458C105 390 199 253 322 163 268 304 302 377 640 302-20 597 102 494-40 458Z" fill="${background}"/><path d="M86 484C206 421 252 370 349 320" fill="none" stroke="${secondary}" stroke-width="20"/>`;
    case "caspian-kite-airways":
    case "kilimanjaro-skylink":
    case "altiplano-condor":
    case "coral-bird-airways":
      return `<path d="M-45 454C112 418 164 235 297 133 234 281 256 350 637 214-22 604 103 494-45 454Z" fill="${accent}"/><path d="M-20 478C126 440 190 294 311 208 270 322 315 379 612 286 21 557 127 514-20 478Z" fill="${background}"/><path d="M62 518C182 466 283 417 438 369" fill="none" stroke="${secondary}" stroke-width="17"/>`;
    case "bengal-monsoon-air":
      return `<path d="M300 118C194 250 146 327 147 402 148 504 215 546 300 546S452 504 453 402C454 327 406 250 300 118Z" fill="${secondary}" opacity=".82"/><path d="M58 452C156 359 220 489 301 397S456 337 544 421" fill="none" stroke="${background}" stroke-width="36"/><circle cx="420" cy="180" r="68" fill="${accent}"/>`;
    case "frankincense-air":
      return `<path d="M40 501C207 421 98 334 246 264S430 173 548 93" fill="none" stroke="${background}" stroke-width="55" stroke-linecap="round"/><path d="M50 512C217 432 119 357 257 286S431 198 557 112" fill="none" stroke="${accent}" stroke-width="17" stroke-linecap="round"/><circle cx="423" cy="176" r="82" fill="${accent}" opacity=".5"/>`;
    case "amber-sky-aviation":
      return `<g fill="${accent}" stroke="${background}" stroke-width="5"><path d="M60 442 188 158 252 442Z"/><path d="M176 442 310 92 376 442Z"/><path d="M306 442 439 174 548 442Z"/></g><path d="M40 474C191 407 370 531 561 435" fill="none" stroke="${secondary}" stroke-width="26"/>`;
    case "pura-vida-wings":
      return `<circle cx="430" cy="159" r="86" fill="${accent}"/><path d="M94 499C40 351 103 202 250 107 202 272 219 397 94 499ZM506 499C560 351 497 202 350 107 398 272 381 397 506 499Z" fill="${background}" opacity=".82"/><path d="M58 475C164 378 239 502 322 400S476 350 552 427" fill="none" stroke="${secondary}" stroke-width="24"/>`;
    case "balkan-star-air":
      return `<path d="m300 82 52 152 161 3-128 97 47 154-132-91-132 91 47-154-128-97 161-3Z" fill="${accent}" stroke="${background}" stroke-width="16"/><path d="M38 508C189 429 361 513 564 400" fill="none" stroke="${secondary}" stroke-width="28"/>`;
    default:
      return `<circle cx="300" cy="318" r="190" fill="none" stroke="${accent}" stroke-width="26"/><path d="M72 442C186 332 281 493 526 326" fill="none" stroke="${background}" stroke-width="32"/>`;
  }
}

function buildSeamHighlightSvg(): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
    <path d="M300 54V702" stroke="#FFFFFF" stroke-width="2" opacity=".18"/>
    <path d="M76 198C118 164 153 129 203 106M524 198C482 164 447 129 397 106" fill="none" stroke="#FFFFFF" stroke-width="2" opacity=".13"/>
    <path d="M146 662H454" stroke="#FFFFFF" stroke-width="2" opacity=".12"/>
  </svg>`);
}

function fitLabelFontSize(
  value: string,
  maximumWidth: number
): number {
  const preferred = 34;
  const estimatedWidth = value.length * preferred * 0.83;

  if (estimatedWidth <= maximumWidth) {
    return preferred;
  }

  return Math.max(
    17,
    Math.floor(
      (preferred * maximumWidth) / estimatedWidth
    )
  );
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
