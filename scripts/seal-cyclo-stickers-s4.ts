/** Seal a reviewed offline export; never connects to production or replaces a snapshot. */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { assertCycloStickersFinalSnapshot } from "../lib/game/cyclo-stickers-release";
import type { CollectorAlbumSnapshot } from "../lib/game/collector-album";

async function main() {
  const [input,output]=process.argv.slice(2);
  if(!input||!output||resolve(input)===resolve(output)) throw new Error("Usage: npx tsx scripts/seal-cyclo-stickers-s4.ts <reviewed-export.json> <new-frozen-snapshot.json>");
  const exportData=JSON.parse(await readFile(resolve(input),"utf8")) as {sourceSeasonStatus:string;snapshot:CollectorAlbumSnapshot};
  assertCycloStickersFinalSnapshot(exportData.snapshot,exportData.sourceSeasonStatus);
  const serialized=JSON.stringify(exportData.snapshot);
  const manifest={snapshot:exportData.snapshot,sha256:createHash("sha256").update(serialized).digest("hex"),sealedAt:new Date().toISOString()};
  await writeFile(resolve(output),`${JSON.stringify(manifest,null,2)}\n`,{flag:"wx"});
  console.log(JSON.stringify({sealed:true,sourceSeason:4,launchSeason:5,riders:50,introduction:18,sha256:manifest.sha256}));
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Snapshot sealing failed");process.exitCode=1;});
