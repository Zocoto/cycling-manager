import { readdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const projectRoot = process.cwd();
const assetGroups = [
  {
    directory: path.join(
      projectRoot,
      "public",
      "images",
      "equipment",
      "brands"
    ),
    resize: {
      width: 960,
      height: 360,
      fit: "contain",
      background: "#ffffff",
    },
  },
  {
    directory: path.join(
      projectRoot,
      "public",
      "images",
      "equipment",
      "products"
    ),
    resize: {
      width: 1280,
      height: 800,
      fit: "cover",
      position: "centre",
    },
  },
];

let processed = 0;

for (const group of assetGroups) {
  const files = (await readdir(group.directory))
    .filter((file) => file.endsWith(".png"))
    .sort();

  for (const file of files) {
    const input = path.join(group.directory, file);
    const output = path.join(
      group.directory,
      `${path.basename(file, ".png")}.webp`
    );

    await sharp(input)
      .resize(group.resize)
      .webp({ quality: 84, effort: 5, smartSubsample: true })
      .toFile(output);

    processed += 1;
  }
}

console.log(`Optimisation terminée : ${processed} ressources WebP générées.`);
