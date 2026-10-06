import "server-only";

import { createHash } from "node:crypto";

import { strToU8, zipSync } from "fflate";

import type {
  PcmExportPackageResult,
  PcmExportResult,
} from "@/lib/game/pcm-export/types";

export async function createPcmExportPackage({
  cdb,
  localCdb: localDatabase,
  metadata,
}: PcmExportResult): Promise<PcmExportPackageResult> {
  const localDatabaseSha256 = createHash("sha256")
    .update(localDatabase)
    .digest("hex");
  if (localDatabaseSha256 !== metadata.localOutputSha256) {
    throw new Error(
      "Le catalogue de noms PCM ne correspond pas à la base générée : export interrompu.",
    );
  }

  const manifest = {
    formatVersion: 2,
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
    countryAdditions: metadata.countryAdditions,
    nationalChampions: metadata.nationalChampions,
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
    countriesAdded: metadata.countryAdditions.length,
    nationalityFallbacks: metadata.countryFallbacks.length,
    nationalChampions: metadata.nationalChampions,
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
Les équipes et coureurs professionnels réels ont été retirés de cette base.
L'équipe "Cyclostratège" contient dix coureurs Simulo destinés au mode spectateur.
Les assets graphiques personnalisés ne sont pas encore inclus dans ce pack.
Les pays manquants et leurs noms sont ajoutés automatiquement à cette base.
Les titres nationaux actifs sont conservés (route et contre-la-montre).
Installez ensemble OfficialRelease.cdb et OfficialLocal.cdb de cet export.
Conservez séparément les trois PAK graphiques Cyclostratège (maillots,
champions et drapeaux) : cet export ne remplace pas les fichiers graphiques.
Les croix rouges devant les maillots, photos, courses et équipements sont donc
normales : seules les deux lignes de base de données doivent être reconnues.
`;
}
