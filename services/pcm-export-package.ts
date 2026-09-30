import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { strToU8, zipSync } from "fflate";

import type {
  PcmExportPackageResult,
  PcmExportResult,
} from "@/lib/game/pcm-export/types";

const LOCAL_DATABASE_PATH = join(
  process.cwd(),
  "assets",
  "pcm",
  "OfficialLocal.template.cdb",
);
const EXPECTED_LOCAL_DATABASE_SHA256 =
  "8e4312928de4700fafbb85e2b63b71635ab5455aa45c60dc6190784b7d51a740";

export async function createPcmExportPackage({
  cdb,
  metadata,
}: PcmExportResult): Promise<PcmExportPackageResult> {
  const localDatabase = await readFile(LOCAL_DATABASE_PATH);
  const localDatabaseSha256 = createHash("sha256")
    .update(localDatabase)
    .digest("hex");
  if (localDatabaseSha256 !== EXPECTED_LOCAL_DATABASE_SHA256) {
    throw new Error(
      "Le fichier local officiel PCM26 a ete modifie : export interrompu avant generation.",
    );
  }

  const manifest = {
    formatVersion: 1,
    title: "Cyclostratège",
    targetGame: "Pro Cycling Manager 2026",
    generatedAt: metadata.generatedAt,
    season: metadata.season,
    databaseFile: metadata.filename,
    databaseSha256: metadata.outputSha256,
    localDatabaseFile: "OfficialLocal.cdb",
    localDatabaseSha256,
    snapshotSha256: metadata.snapshotSha256,
    counts: metadata.counts,
    divisionCounts: metadata.divisionCounts,
    ratingScale: metadata.ratingScale,
    countryFallbacks: metadata.countryFallbacks,
    scope: metadata.scope,
  };
  const validation = {
    valid: true,
    generatedAt: metadata.generatedAt,
    databaseSha256: metadata.outputSha256,
    databaseBytes: metadata.bytes,
    localDatabaseSha256,
    localDatabaseBytes: localDatabase.byteLength,
    counts: metadata.counts,
    divisionCounts: metadata.divisionCounts,
    ratingRange: metadata.ratingRange,
    officialPcm26StageCatalogPreserved: true,
  };
  const archive = zipSync(
    {
      "OfficialRelease.cdb": cdb,
      "OfficialLocal.cdb": localDatabase,
      "mod.xml": strToU8(createModXml(metadata)),
      "manifest.json": strToU8(
        `${JSON.stringify(manifest, null, 2)}\n`,
      ),
      "validation.json": strToU8(
        `${JSON.stringify(validation, null, 2)}\n`,
      ),
      "LISEZ-MOI.txt": strToU8(createInstallationGuide(metadata.season)),
    },
    { level: 6 },
  );
  const archiveSha256 = createHash("sha256").update(archive).digest("hex");

  return {
    archive,
    filename: `Cyclostratege-PCM26-S${metadata.season}.zip`,
    archiveSha256,
    database: metadata,
  };
}

function createModXml(metadata: PcmExportResult["metadata"]) {
  return `<?xml version="1.0" encoding="utf-8"?>
<Mod>
    <Id>cyclostratege-local</Id>
    <Title>Cyclostratège</Title>
    <Description>Export Cyclostratège pour PCM26 — saison ${metadata.season}</Description>
    <Visibility>Private</Visibility>
    <TimeCreated>${metadata.generatedAt}</TimeCreated>
    <TimeUpdated>${metadata.generatedAt}</TimeUpdated>
</Mod>
`;
}

function createInstallationGuide(season: number) {
  return `INSTALLATION DE LA BASE CYCLOSTRATEGE POUR PCM26

1. Fermez complètement Pro Cycling Manager 2026.
2. Décompressez l'archive téléchargée.
3. Copiez le dossier "Cyclostratege-PCM26-S${season}" obtenu dans :
   %APPDATA%\\Pro Cycling Manager 2026\\Mod\\
4. Le chemin final doit être :
   %APPDATA%\\Pro Cycling Manager 2026\\Mod\\Cyclostratege-PCM26-S${season}\\OfficialRelease.cdb
   Le fichier OfficialLocal.cdb doit se trouver juste à côté, sans sous-dossier.
5. Relancez PCM26 et sélectionnez "Cyclostratege-PCM26-S${season}".
6. Créez une nouvelle partie avec cette base.

Ne remplacez pas la base du dossier "Default".
N'utilisez pas cette DB avec une sauvegarde déjà commencée.
Les assets graphiques personnalisés ne sont pas encore inclus dans ce pack.
Les croix rouges devant les maillots, photos, courses et équipements sont donc
normales : seules les deux lignes de base de données doivent être reconnues.
`;
}
