/** Assemble bounded completed-S4 source rows offline. The output still requires review before sealing. */
import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCycloStickersFinalSnapshot } from "../lib/game/cyclo-stickers-final-snapshot";

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output || resolve(input) === resolve(output)) throw new Error("Usage: npx tsx scripts/prepare-cyclo-stickers-s4.ts <completed-source-rows.json> <new-candidate-export.json>");
  if ((await stat(resolve(input))).size > 2_000_000) throw new Error("Source export exceeds the bounded 2 MB snapshot size");
  const snapshot = createCycloStickersFinalSnapshot(JSON.parse(await readFile(resolve(input), "utf8")));
  if (Date.parse(snapshot.capturedAt) > Date.now()) throw new Error("Cannot prepare a future capture");
  await writeFile(resolve(output), `${JSON.stringify({ sourceSeasonStatus: "completed", snapshot }, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ prepared: true, sealed: false, requiresReview: true, sourceSeason: 4, collectionSeason: 5, stickers: snapshot.cards.length }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Snapshot preparation failed"); process.exitCode = 1; });
