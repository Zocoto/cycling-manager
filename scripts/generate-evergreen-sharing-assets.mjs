import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const projectRoot = process.cwd();
const sourcePath = path.join(
  projectRoot,
  "public",
  "images",
  "marketing",
  "webgame-nexus-cover.webp",
);
const openGraphPath = path.join(projectRoot, "app", "opengraph-image.png");
const twitterPath = path.join(projectRoot, "app", "twitter-image.png");

await mkdir(path.dirname(openGraphPath), { recursive: true });

const sharingImage = await sharp(sourcePath)
  .resize(1200, 630, {
    fit: "cover",
    position: "centre",
  })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer();

await Promise.all([
  sharp(sharingImage).toFile(openGraphPath),
  sharp(sharingImage).toFile(twitterPath),
]);

console.log(
  [
    "Aperçus de partage permanents générés :",
    path.relative(projectRoot, openGraphPath),
    path.relative(projectRoot, twitterPath),
  ].join("\n"),
);
