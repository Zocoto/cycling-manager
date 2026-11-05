/** Seal a reviewed offline export; never connects to production or replaces a snapshot. */
import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { assertCycloStickersFinalSnapshot } from "../lib/game/cyclo-stickers-release";
import { serializeCycloStickersSnapshot } from "../lib/game/cyclo-stickers-final-snapshot";

async function main() {
  const [input,output]=process.argv.slice(2);
  if(!input||!output||resolve(input)===resolve(output)) throw new Error("Usage: npx tsx scripts/seal-cyclo-stickers-s4.ts <reviewed-export.json> <new-frozen-snapshot.json>");
  if ((await stat(resolve(input))).size > 2_000_000) throw new Error("Reviewed export exceeds the bounded 2 MB snapshot size");
  const exportData=JSON.parse(await readFile(resolve(input),"utf8")) as {sourceSeasonStatus:unknown;snapshot:unknown};
  assertCycloStickersFinalSnapshot(exportData.snapshot,exportData.sourceSeasonStatus);
  if (Date.parse(exportData.snapshot.capturedAt) > Date.now()) throw new Error("Cannot seal a future capture");
  const serialized=serializeCycloStickersSnapshot(exportData.snapshot);
  const manifest={schemaVersion:1,sourceSeasonStatus:"completed",snapshot:exportData.snapshot,sha256:createHash("sha256").update(serialized).digest("hex"),sealedAt:new Date().toISOString()};
  await writeFile(resolve(output),`${JSON.stringify(manifest,null,2)}\n`,{flag:"wx"});
  console.log(JSON.stringify({sealed:true,sourceSeason:4,launchSeason:5,riders:exportData.snapshot.cards.filter(card=>!card.kind).length,top50:50,bonusBreakaway:3,introduction:exportData.snapshot.cards.filter(card=>card.kind).length,sha256:manifest.sha256}));
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Snapshot sealing failed");process.exitCode=1;});
