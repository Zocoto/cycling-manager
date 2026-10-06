import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const tracePath = resolve(".next/server/app/api/game/chat/images/route.js.nft.json");
const { files } = JSON.parse(readFileSync(tracePath, "utf8"));
const normalized = files.map((file) => file.replaceAll("\\", "/"));
const runtime = `${process.platform}-${process.arch}`;

// Catch missing native assets before a successful build can be promoted.
if (!normalized.some((file) => file.includes(`/@img/sharp-${runtime}/`) && file.endsWith(".node"))) {
  throw new Error(`Chat image upload trace is missing the sharp ${runtime} binary.`);
}
if (process.platform === "linux" && !normalized.some((file) =>
  file.includes(`/@img/sharp-libvips-${runtime}/`) && /\/lib\/libvips-cpp\.so\./.test(file))) {
  throw new Error(`Chat image upload trace is missing the libvips ${runtime} shared library.`);
}
console.log(`Chat image native runtime verified in build trace (${runtime}).`);
