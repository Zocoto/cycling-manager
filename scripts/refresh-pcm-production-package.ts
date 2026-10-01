import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { config } from "dotenv";
import { unzipSync } from "fflate";

config({ path: ".env.local", quiet: true });

const PACKAGE_FILES = [
  "OfficialRelease.cdb",
  "OfficialLocal.cdb",
  "mod.xml",
  "manifest.json",
  "validation.json",
  "LISEZ-MOI.txt",
] as const;

async function main() {
  const packageRoot = path.resolve(
    process.argv[2] ??
      "C:/Dev/pcm26-bridge-lab/Cyclostratege-PCMAssets-Mod",
  );
  const bridgeRoot = path.resolve(packageRoot, "..");
  const backupRoot = path.join(
    bridgeRoot,
    "backups",
    `pcm-refresh-${new Date().toISOString().replaceAll(":", "-")}`,
  );
  const exportRoot = path.join(bridgeRoot, "exports");

  const { generatePcmExport } = await import("../services/pcm-export");
  const result = await generatePcmExport();
  const archiveFiles = unzipSync(result.archive);

  await Promise.all([
    mkdir(packageRoot, { recursive: true }),
    mkdir(backupRoot, { recursive: true }),
    mkdir(exportRoot, { recursive: true }),
  ]);

  for (const name of PACKAGE_FILES) {
    const sourcePath = path.join(packageRoot, name);
    try {
      await copyFile(sourcePath, path.join(backupRoot, name));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    const contents = archiveFiles[name];
    if (!contents) throw new Error(`Fichier ${name} absent du nouvel export.`);
    await writeFile(sourcePath, contents);
  }

  const archivePath = path.join(exportRoot, result.filename);
  await writeFile(archivePath, result.archive);

  const manifest = JSON.parse(
    await readFile(path.join(packageRoot, "manifest.json"), "utf8"),
  );
  console.log(
    JSON.stringify(
      {
        refreshed: true,
        packageRoot,
        backupRoot,
        archivePath,
        archiveSha256: result.archiveSha256,
        databaseSha256: result.database.outputSha256,
        databaseBytes: result.database.bytes,
        season: result.database.season,
        teams: result.database.counts.teams,
        riders: result.database.counts.riders,
        contracts: result.database.counts.contracts,
        manifestDatabaseSha256: manifest.databaseSha256,
      },
      null,
      2,
    ),
  );
}

void main();
