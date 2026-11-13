// Run with NODE_OPTIONS=--conditions=react-server and tsx, from the repository root.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { unzipSync } from "fflate";

import type { PcmExportSnapshot } from "../lib/game/pcm-export/types";
import { buildPcmDatabase } from "../services/pcm-export-builder";
import { createPcmExportPackage } from "../services/pcm-export-package";

async function main() {
  const [snapshotFile, expectedHash, outputDirectory, archiveOption, ...rest] = process.argv.slice(2);
  if (!snapshotFile || !expectedHash || !/^[0-9a-f]{64}$/i.test(expectedHash) || !outputDirectory
    || rest.length || (archiveOption && archiveOption !== "--preserve-gala-schelde")) {
    throw new Error("Usage: tsx scripts/build-pcm-from-reviewed-snapshot.ts <snapshot.json> <file SHA-256> <new output directory> [--preserve-gala-schelde]");
  }
  const contents = await readFile(resolve(snapshotFile));
  const hash = createHash("sha256").update(contents).digest("hex");
  if (hash !== expectedHash.toLowerCase()) throw new Error("L’empreinte du snapshot ne correspond pas à la source vérifiée.");
  const snapshot = JSON.parse(contents.toString("utf8")) as PcmExportSnapshot;
  if (snapshot.schemaVersion !== 1 || snapshot.source !== "Cyclostratege production") {
    throw new Error("Format de snapshot PCM inconnu.");
  }
  const database = await buildPcmDatabase(snapshot, undefined, { preserveGalaSchelde: Boolean(archiveOption) });
  const packageResult = await createPcmExportPackage(database, {
    edition: snapshot.galaEdition === "season-four" ? "gala-s4" : "standard",
  });
  const output = resolve(outputDirectory);
  await mkdir(output);
  const archiveFiles = unzipSync(packageResult.archive);
  await Promise.all([
    ...Object.entries(archiveFiles).map(([name, data]) => writeFile(join(output, name), data, { flag: "wx" })),
    writeFile(join(output, packageResult.filename), packageResult.archive, { flag: "wx" }),
  ]);
  console.log(JSON.stringify({
    output,
    sourceFileSha256: hash,
    archiveSha256: packageResult.archiveSha256,
    databaseSha256: database.metadata.outputSha256,
    localDatabaseSha256: database.metadata.localOutputSha256,
    counts: database.metadata.counts,
  }, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
