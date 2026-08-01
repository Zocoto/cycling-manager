import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SIZE = 256;
const FRAME_COUNT = 16;
const outputDirectory = path.resolve(
  process.cwd(),
  "public/images/chat/reactions",
);

const palette = {
  ink: "#0B302B",
  green: "#176951",
  mint: "#72D4B7",
  yellow: "#F2C94C",
  coral: "#E96C52",
  sky: "#DDF3E7",
  road: "#D9DED9",
  white: "#FFFDF6",
  blue: "#4E8FD3",
};

function wrapSvg(content) {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
      <rect width="256" height="256" rx="30" fill="${palette.sky}"/>
      <circle cx="212" cy="48" r="24" fill="${palette.yellow}" opacity=".8"/>
      <path d="M0 152 Q78 132 256 155 V256 H0Z" fill="#A9CBB5"/>
      <path d="M0 178 Q128 151 256 176 V256 H0Z" fill="${palette.road}"/>
      <path d="M0 218 Q128 193 256 214" fill="none" stroke="${palette.white}" stroke-width="6" stroke-dasharray="18 14" opacity=".9"/>
      ${content}
    </svg>
  `);
}

function bicycle({ x, y, jersey = palette.green, pose = 0, scale = 1 }) {
  const pedal = pose * Math.PI * 2;
  const crankX = 3 * Math.cos(pedal);
  const crankY = 3 * Math.sin(pedal);
  const bob = Math.sin(pedal) * 1.5;
  return `
    <g transform="translate(${x} ${y + bob}) scale(${scale})" stroke="${palette.ink}" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="-35" cy="26" r="25" fill="${palette.white}" stroke-width="5"/>
      <circle cx="35" cy="26" r="25" fill="${palette.white}" stroke-width="5"/>
      <path d="M-35 26 L-7 24 L12 -3 L35 26 L-2 26 L-20 -4" fill="none" stroke="${palette.blue}" stroke-width="6"/>
      <path d="M-24 -5 H-10 M9 -5 H24" fill="none" stroke-width="5"/>
      <circle cx="-2" cy="26" r="4" fill="${palette.yellow}" stroke-width="3"/>
      <path d="M${-2 + crankX} ${26 + crankY} L${-11 - crankX} ${37 - crankY}" fill="none" stroke-width="4"/>
      <path d="M-11 ${37 - crankY} L-22 ${43 - crankY}" fill="none" stroke-width="5"/>
      <path d="M-2 26 L13 3 L-2 -15 L-20 -4" fill="none" stroke-width="6"/>
      <path d="M-2 -15 L18 -5 L27 4" fill="none" stroke-width="6"/>
      <path d="M-7 -30 Q7 -36 18 -22 L11 0 Q-2 4 -14 -4Z" fill="${jersey}" stroke-width="4"/>
      <circle cx="-2" cy="-48" r="13" fill="#B98261" stroke-width="4"/>
      <path d="M-16 -51 Q-4 -67 11 -54" fill="none" stroke="${palette.yellow}" stroke-width="7"/>
    </g>
  `;
}

function feedZoneFrame(frame) {
  const phase = frame / (FRAME_COUNT - 1);
  const bottleX = 215 - phase * 118;
  const bottleY = 120 - Math.sin(phase * Math.PI) * 42 + phase * 62;
  const rotation = phase * 420;
  const reach = Math.sin(Math.min(phase, 0.52) / 0.52 * Math.PI) * 22;
  return wrapSvg(`
    <path d="M221 115 Q230 102 242 110 V180 H214Z" fill="${palette.coral}" stroke="${palette.ink}" stroke-width="4"/>
    <circle cx="230" cy="96" r="13" fill="#B98261" stroke="${palette.ink}" stroke-width="4"/>
    <path d="M216 121 L${198 - reach} ${137 - reach * 0.3}" fill="none" stroke="${palette.ink}" stroke-width="7"/>
    ${bicycle({ x: 111, y: 148, pose: phase, jersey: palette.green, scale: 0.9 })}
    <g transform="translate(${bottleX} ${bottleY}) rotate(${rotation})">
      <rect x="-7" y="-14" width="14" height="28" rx="5" fill="${palette.yellow}" stroke="${palette.ink}" stroke-width="3"/>
      <path d="M-4 -14 H4" stroke="${palette.ink}" stroke-width="5"/>
    </g>
    ${phase > 0.58 ? `<path d="M${bottleX - 16} ${bottleY - 18} l-11 -8 M${bottleX - 20} ${bottleY} l-14 0" stroke="${palette.coral}" stroke-width="4" stroke-linecap="round"/>` : ""}
  `);
}

function punctureFrame(frame) {
  const phase = frame / (FRAME_COUNT - 1);
  const flat = phase < 0.35 ? 0 : Math.sin(((phase - 0.35) / 0.65) * Math.PI) * 8;
  const shrug = phase > 0.42 ? Math.sin(((phase - 0.42) / 0.58) * Math.PI) : 0;
  return wrapSvg(`
    <g transform="translate(128 151)" stroke="${palette.ink}" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="-42" cy="31" rx="27" ry="${27 - flat}" fill="${palette.white}" stroke-width="5"/>
      <circle cx="42" cy="31" r="27" fill="${palette.white}" stroke-width="5"/>
      <path d="M-42 31 L-8 27 L14 -4 L42 31 L-4 31 L-24 -5" fill="none" stroke="${palette.blue}" stroke-width="6"/>
      <path d="M-8 -31 Q7 -36 18 -20 L10 2 Q-4 7 -17 -4Z" fill="${palette.coral}" stroke-width="4"/>
      <circle cx="-2" cy="-50" r="13" fill="#B98261" stroke-width="4"/>
      <path d="M-16 -54 Q-5 -67 10 -56" fill="none" stroke="${palette.yellow}" stroke-width="7"/>
      <path d="M-10 -21 L${-27 - shrug * 18} ${-8 - shrug * 15}" fill="none" stroke-width="7"/>
      <path d="M12 -20 L${29 + shrug * 18} ${-7 - shrug * 15}" fill="none" stroke-width="7"/>
    </g>
    ${phase > 0.35 ? `<g fill="none" stroke="${palette.coral}" stroke-width="4" stroke-linecap="round"><path d="M63 162 l-13 -7"/><path d="M59 174 l-16 1"/><path d="M65 185 l-12 8"/></g>` : ""}
    <path d="M208 172 l26 -8 M211 184 l27 -3" stroke="${palette.ink}" stroke-width="5" opacity="${Math.max(0, 1 - phase * 1.4)}"/>
  `);
}

function earlyCelebrationFrame(frame) {
  const phase = frame / (FRAME_COUNT - 1);
  const rivalX = 286 - phase * 205;
  const armsUp = Math.min(1, phase * 2.4);
  return wrapSvg(`
    <path d="M218 147 V220" stroke="${palette.ink}" stroke-width="6"/>
    <path d="M207 151 H245" stroke="${palette.white}" stroke-width="7"/>
    ${bicycle({ x: 132, y: 149, pose: phase, jersey: palette.green, scale: 0.84 })}
    <g transform="translate(130 121)" stroke="${palette.ink}" stroke-width="7" stroke-linecap="round">
      <path d="M-7 0 L${-19 - armsUp * 16} ${-8 - armsUp * 31}"/>
      <path d="M8 0 L${20 + armsUp * 16} ${-8 - armsUp * 31}"/>
    </g>
    ${bicycle({ x: rivalX, y: 163, pose: phase * 1.5, jersey: palette.coral, scale: 0.68 })}
    ${phase > 0.72 ? `<path d="M${rivalX - 48} 130 l-18 -5 M${rivalX - 50} 142 l-23 0" stroke="${palette.yellow}" stroke-width="5" stroke-linecap="round"/>` : ""}
  `);
}

function snackAttackFrame(frame) {
  const phase = frame / (FRAME_COUNT - 1);
  const bounce = Math.sin(phase * Math.PI * 4);
  const wrapper1 = 118 + Math.sin(phase * Math.PI * 2) * 15;
  const wrapper2 = 151 + Math.cos(phase * Math.PI * 2) * 13;
  return wrapSvg(`
    ${bicycle({ x: 128, y: 150, pose: phase, jersey: "#E889AD", scale: 0.9 })}
    <g stroke="${palette.ink}" stroke-width="3">
      <rect x="${wrapper1}" y="${97 + bounce * 4}" width="15" height="27" rx="3" fill="${palette.yellow}" transform="rotate(${bounce * 9} ${wrapper1 + 7} 110)"/>
      <rect x="${wrapper2}" y="${104 - bounce * 5}" width="15" height="25" rx="3" fill="${palette.coral}" transform="rotate(${-bounce * 10} ${wrapper2 + 7} 116)"/>
      <rect x="92" y="110" width="16" height="24" rx="3" fill="${palette.mint}" transform="rotate(${bounce * 7} 100 122)"/>
    </g>
    <circle cx="111" cy="126" r="7" fill="${palette.yellow}" stroke="${palette.ink}" stroke-width="3"/>
    <circle cx="146" cy="127" r="7" fill="${palette.coral}" stroke="${palette.ink}" stroke-width="3"/>
    ${phase > 0.45 && phase < 0.8 ? `<path d="M176 120 q18 -14 28 0 q-8 18 -28 5Z" fill="${palette.white}" stroke="${palette.ink}" stroke-width="4"/><circle cx="184" cy="121" r="2" fill="${palette.ink}"/><circle cx="196" cy="119" r="2" fill="${palette.ink}"/>` : ""}
  `);
}

const animations = [
  ["feed-zone-chaos.gif", feedZoneFrame],
  ["flat-tire-shrug.gif", punctureFrame],
  ["early-celebration.gif", earlyCelebrationFrame],
  ["snack-hoarder.gif", snackAttackFrame],
];

await fs.mkdir(outputDirectory, { recursive: true });

for (const [filename, renderFrame] of animations) {
  const frames = [];
  for (let index = 0; index < FRAME_COUNT; index += 1) {
    const raw = await sharp(renderFrame(index)).raw().toBuffer();
    frames.push(raw);
  }

  const stackedFrames = Buffer.concat(frames);
  const outputPath = path.join(outputDirectory, filename);
  await sharp(stackedFrames, {
    raw: {
      width: SIZE,
      height: SIZE * FRAME_COUNT,
      channels: 4,
      pageHeight: SIZE,
    },
  })
    .gif({
      loop: 0,
      delay: 90,
      effort: 7,
      colors: 128,
      dither: 0.6,
    })
    .toFile(outputPath);
  const metadata = await sharp(outputPath, { animated: true }).metadata();
  console.log(
    `${filename}: ${metadata.pages} frames, ${metadata.width}x${metadata.pageHeight}`,
  );
}
