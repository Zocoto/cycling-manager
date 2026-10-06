import "server-only";

import { buildPcmDatabase } from "@/services/pcm-export-builder";
import { createPcmExportPackage } from "@/services/pcm-export-package";
import { createPcmExportSnapshot } from "@/services/pcm-export-snapshot";

export async function generatePcmExport(seasonFinale = false) {
  const snapshot = await createPcmExportSnapshot(seasonFinale);
  const database = await buildPcmDatabase(snapshot);
  const result = await createPcmExportPackage(database);
  return seasonFinale ? { ...result, filename: result.filename.replace(/\.zip$/, "-Gala.zip") } : result;
}
