import "server-only";

import { buildPcmDatabase } from "@/services/pcm-export-builder";
import { createPcmExportPackage } from "@/services/pcm-export-package";
import { createPcmExportSnapshot } from "@/services/pcm-export-snapshot";

export async function generatePcmExport(seasonFinale = false,seasonFourGala = false) {
  const snapshot = await createPcmExportSnapshot(seasonFinale,seasonFourGala);
  const database = await buildPcmDatabase(snapshot);
  return createPcmExportPackage(database, {
    edition: seasonFourGala ? "gala-s4" : seasonFinale ? "gala" : "standard",
  });
}
