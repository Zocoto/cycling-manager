import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { unzipSync } from "fflate";

import { generatePcmExport } from "@/services/pcm-export";

async function main() {
  const destinationArgument = process.argv[2];

  if (!destinationArgument) {
    throw new Error(
      "Usage: tsx scripts/generate-pcm-assets-workspace.ts <destination>",
    );
  }

  const destination = resolve(destinationArgument);
  const workspaceRoot = resolve("C:/Dev");

  if (
    destination !== workspaceRoot &&
    !destination.startsWith(`${workspaceRoot}\\`)
  ) {
    throw new Error("Le dossier PCMAssets doit rester dans C:/Dev.");
  }

  const result = await generatePcmExport();
  const entries = unzipSync(result.archive);

  await mkdir(destination, { recursive: true });

  for (const [relativePath, contents] of Object.entries(entries)) {
    const outputPath = resolve(destination, relativePath);
    if (!outputPath.startsWith(`${destination}\\`)) {
      throw new Error(`Chemin d'archive invalide : ${relativePath}`);
    }
    await mkdir(resolve(outputPath, ".."), { recursive: true });
    await writeFile(outputPath, contents);
  }

  console.log(
    JSON.stringify(
      {
        destination,
        season: result.database.season,
        teams: result.database.counts.teams,
        riders: result.database.counts.riders,
        databaseSha256: result.database.outputSha256,
        archiveSha256: result.archiveSha256,
      },
      null,
      2,
    ),
  );
}

void main();
