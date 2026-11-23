import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { strToU8, zipSync } from "fflate";
import { createPcmGraphicsInstaller, PCM_GRAPHICS_FILES } from "@/lib/game/pcm-export/graphics-installer";
import { createSeasonFiveGalaStartlistInstaller } from "@/lib/game/season-five-gala-installer";
import type { buildSeasonFiveGalaStartlists } from "@/lib/game/season-five-gala-startlists";

import type {
  PcmExportPackageResult,
  PcmExportResult,
} from "@/lib/game/pcm-export/types";

export type PcmExportEdition = "standard" | "gala" | "gala-s4" | "gala-s5";

export async function createPcmExportPackage({
  cdb,
  localCdb: localDatabase,
  metadata,
}: PcmExportResult, { edition = "standard", galaStartlists }: { edition?: PcmExportEdition; galaStartlists?: ReturnType<typeof buildSeasonFiveGalaStartlists> } = {}): Promise<PcmExportPackageResult> {
  const localDatabaseSha256 = createHash("sha256")
    .update(localDatabase)
    .digest("hex");
  if (localDatabaseSha256 !== metadata.localOutputSha256) {
    throw new Error(
      "Le catalogue de noms PCM ne correspond pas à la base générée : export interrompu.",
    );
  }
  const databaseSha256 = createHash("sha256").update(cdb).digest("hex");
  if (databaseSha256 !== metadata.outputSha256 || cdb.byteLength !== metadata.bytes) {
    throw new Error("La base PCM ne correspond pas au rapport de génération : export interrompu.");
  }
  if (edition === "gala-s5" && (!galaStartlists || galaStartlists.manifest.databaseSha256 !== databaseSha256 || galaStartlists.manifest.snapshotSha256 !== metadata.snapshotSha256 || metadata.season !== 5)) {
    throw new Error("The S5 database and registered startlists must be generated together.");
  }
  if (galaStartlists && edition !== "gala-s5") throw new Error("S5 startlists require the explicit S5 package edition.");

  const date = new Date(metadata.generatedAt);
  if (!Number.isFinite(date.getTime())) throw new Error("Date de génération PCM invalide.");
  const stamp = date.toISOString().replace(/[-:]/g, "").slice(0, 15).replace("T", "-");
  const exportId = randomUUID().replaceAll("-", "").slice(0, 12);
  const editionSuffix = edition === "gala-s5" ? "-Gala-S5" : edition === "gala-s4" ? "-Gala-S4" : edition === "gala" ? "-Gala" : "";
  const folder = `Cyclostratege-PCM26-S${metadata.season}${editionSuffix}-${stamp}Z-${exportId}`;
  const title = `Cyclostratège S${metadata.season}${editionSuffix.replaceAll("-", " ")} · ${date.toISOString().slice(0, 19).replace("T", " ")} UTC · ${exportId}`;
  const identity = { id: folder.toLowerCase(), title, folder };
  const manifest = {
    formatVersion: 2,
    title,
    exportId,
    edition,
    modId: identity.id,
    installationFolder: folder,
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
    countryFlags: metadata.countryFlags,
    nationalChampions: metadata.nationalChampions,
    internationalChampions: metadata.internationalChampions,
    scope: metadata.scope,
    compatibleGraphics: { workshopItem: "3811779261", files: PCM_GRAPHICS_FILES, report: "compatibilite-graphismes.json" },
    ...(galaStartlists ? { gala: { edition: "season-five", sourceSeason: 5, identitySeason: 6, startlists: "Startlists/manifest.json", simulationCount: galaStartlists.manifest.events.length } } : {}),
  };
  const graphics = {
    ...metadata.graphics,
    databaseSha256,
    localDatabaseSha256,
    countryFlags: metadata.countryFlags,
    coverage: {
      customTeamKits: metadata.graphics?.teamKits.filter(team => team.custom).length,
      customDistinctives: metadata.graphics?.distinctives.filter(title => title.custom).length,
      missingCountryFlags: metadata.countryFlags?.filter(flag => flag.source === "missing").length,
    },
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
    internationalChampions: metadata.internationalChampions,
  };
  const galaFiles: Record<string, Uint8Array> = {};
  if (galaStartlists) {
    const events = galaStartlists.manifest.events.map(event => {
      const content = galaStartlists.files[String(event.file)];
      if (!content) throw new Error("Missing S5 startlist file.");
      return { ...event, sha256: createHash("sha256").update(content).digest("hex") };
    });
    for (const [filename, content] of Object.entries(galaStartlists.files)) galaFiles[`Startlists/${filename}`] = strToU8(content);
    galaFiles["Startlists/manifest.json"] = strToU8(JSON.stringify({ ...galaStartlists.manifest, events }, null, 2) + "\n");
    galaFiles["Installer-startlist-gala-S5.ps1"] = strToU8("\uFEFF" + createSeasonFiveGalaStartlistInstaller());
    galaFiles["Startlists/LISEZ-MOI.txt"] = strToU8(createSeasonFiveGalaInstallationGuide());
  }
  const archive = zipSync(
    {
      "OfficialRelease.cdb": cdb,
      "OfficialLocal.cdb": localDatabase,
      "mod.xml": strToU8(createModXml(metadata, identity)),
      "manifest.json": strToU8(
        `${JSON.stringify(manifest, null, 2)}\n`,
      ),
      "validation.json": strToU8(
        `${JSON.stringify(validation, null, 2)}\n`,
      ),
      "compatibilite-graphismes.json": strToU8(`${JSON.stringify(graphics, null, 2)}\n`),
      "LISEZ-MOI.txt": strToU8(createInstallationGuide(folder, title)),
      "Installer-graphismes.ps1": strToU8(`\uFEFF${createPcmGraphicsInstaller()}`),
      ...galaFiles,
    },
    { level: 6 },
  );
  const archiveSha256 = createHash("sha256").update(archive).digest("hex");

  return {
    archive,
    filename: `${folder}.zip`,
    archiveSha256,
    database: metadata,
  };
}

function createSeasonFiveGalaInstallationGuide() {
  return [
    "Gala S5 — compositions enregistrees, notes natives S5, identites S6 confirmees.",
    "Cette base et ces XML ont ete generes ensemble. Ne pas les melanger avec un autre export ni avec le package S4.",
    "Fermer PCM. Dans ce dossier, lancer Installer-startlist-gala-S5.ps1 -Course <eventKey> -Groupe 1.",
    "Choisir le programme, la course et le groupe dans manifest.json. Une seule startlist par course peut etre active dans PCM.",
    "Les groupes sont equilibres et comprennent toutes les equipes inscrites. Refaire la simulation pour chaque groupe.",
    "7 a 8 coureurs par equipe. Une place native est reservee a l'equipe de simulation.",
    "Le script verifie l'empreinte de la base et du XML, et sauvegarde la precedente startlist de cette course avant remplacement.",
    "Pour verifier sans installer, ajouter -VerifyOnly. Ne pas renommer les XML et ne pas copier des doublons portant un suffixe (1).",
    "Les montagnes utilisent le mode etape et la variante exacte stageFile du manifeste.",
    "Les graphismes Steam S6 doivent etre prepares et verifies avec ce package avant la publication Workshop.",
  ].join("\r\n");
}

function createModXml(metadata: PcmExportResult["metadata"], identity: { id: string; title: string }) {
  return `<?xml version="1.0" encoding="utf-8"?>
<Mod>
    <Id>${identity.id}</Id>
    <Title>${identity.title}</Title>
    <Description>Export Cyclostratège pour PCM26 — saison ${metadata.season}</Description>
    <Visibility>Private</Visibility>
    <TimeCreated>${metadata.generatedAt}</TimeCreated>
    <TimeUpdated>${metadata.generatedAt}</TimeUpdated>
</Mod>
`;
}

function createInstallationGuide(folder: string, title: string) {
  return `INSTALLATION DE LA BASE CYCLOSTRATEGE POUR PCM26

1. Fermez complètement Pro Cycling Manager 2026.
2. Décompressez l'archive téléchargée.
3. Placez les fichiers décompressés dans un dossier nommé "${folder}", puis copiez ce dossier dans :
   %APPDATA%\\Pro Cycling Manager 2026\\Mod\\
4. Le chemin final doit être :
   %APPDATA%\\Pro Cycling Manager 2026\\Mod\\${folder}\\OfficialRelease.cdb
   Le fichier OfficialLocal.cdb doit se trouver juste à côté, sans sous-dossier.
5. Abonnez-vous au pack graphique Steam et attendez la fin du téléchargement :
   https://steamcommunity.com/sharedfiles/filedetails/?id=3811779261
6. Dans ce dossier de base, exécutez Installer-graphismes.ps1 avec PowerShell.
   Il copie les quatre PAK compatibles du Workshop juste à côté des deux CDB et de mod.xml.
   Vous pouvez également copier manuellement les quatre fichiers listés dans manifest.json
   depuis steamapps\\workshop\\content\\3936530\\3811779261\\ dans ce même dossier.
7. Relancez PCM26 et sélectionnez "${title}".
8. Créez une nouvelle partie avec cette base.

Ne remplacez pas la base du dossier "Default".
N'utilisez pas cette DB avec une sauvegarde déjà commencée.
Les équipes et coureurs professionnels réels ont été retirés de cette base.
L'équipe "Cyclostratège" contient dix coureurs Simulo destinés au mode spectateur.
Les graphismes personnalisés sont fournis par le Workshop : installez les PAK
avec l’outil fourni. Le fichier compatibilite-graphismes.json indique les clubs
avec un maillot et un mini-maillot, les distinctifs personnalisés disponibles
et les drapeaux absents du pack. Les autres clubs utilisent les visuels de PCM.
Les pays manquants et leurs noms sont ajoutés automatiquement à cette base.
Les titres pris en charge par PCM sont exportés : nationaux, mondiaux et
européens (route et contre-la-montre).
Installez ensemble OfficialRelease.cdb et OfficialLocal.cdb de cet export.
L'abonnement seul utilise les graphismes lorsque vous sélectionnez la base du
Workshop. Pour cette base exportée séparément, les QUATRE PAK doivent être
dans SON dossier : les placer uniquement dans ~mods ne suffit pas à les activer.
Cet export ne remplace pas les graphismes du Workshop et ne modifie aucune sauvegarde.
`;
}
