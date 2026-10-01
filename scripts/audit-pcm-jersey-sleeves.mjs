import { readdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const root = path.resolve("assets/pcm/teams");
const output = path.resolve(
  process.argv[2] ?? "C:/Dev/pcm26-bridge-lab/jersey-sleeve-audit.png",
);
const entries = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .sort((left, right) => left.name.localeCompare(right.name, "fr"));

const tiles = [];
for (const entry of entries) {
  const files = await readdir(path.join(root, entry.name));
  const jersey = files.find((file) => file.endsWith("_maillot.png"));
  if (!jersey) continue;

  const source = path.join(root, entry.name, jersey);
  const [leftBackSleeve, rightBackSleeve] = await Promise.all([
    sharp(source)
      .extract({ left: 642, top: 135, width: 140, height: 230 })
      .resize(196, 300)
      .png()
      .toBuffer(),
    sharp(source)
      .extract({ left: 1060, top: 135, width: 140, height: 230 })
      .resize(196, 300)
      .png()
      .toBuffer(),
  ]);
  const label = Buffer.from(`
    <svg width="400" height="330" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="330" fill="#f6f3ed"/>
      <text x="12" y="22" font-family="Arial" font-size="14" font-weight="700" fill="#19211e">${entry.name}</text>
      <text x="12" y="326" font-family="Arial" font-size="11" fill="#59615d">manche dorsale gauche</text>
      <text x="216" y="326" font-family="Arial" font-size="11" fill="#59615d">manche dorsale droite</text>
    </svg>`);
  tiles.push(
    await sharp(label)
      .composite([
        { input: leftBackSleeve, left: 4, top: 26 },
        { input: rightBackSleeve, left: 200, top: 26 },
      ])
      .png()
      .toBuffer(),
  );
}

const columns = 4;
const tileWidth = 400;
const tileHeight = 330;
const rows = Math.ceil(tiles.length / columns);
await sharp({
  create: {
    width: columns * tileWidth,
    height: rows * tileHeight,
    channels: 4,
    background: "#dedbd4",
  },
})
  .composite(
    tiles.map((input, index) => ({
      input,
      left: (index % columns) * tileWidth,
      top: Math.floor(index / columns) * tileHeight,
    })),
  )
  .png()
  .toFile(output);

console.log(JSON.stringify({ output, jerseys: tiles.length }, null, 2));
