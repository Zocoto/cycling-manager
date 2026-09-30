import "server-only";

import { buildPcmDatabase } from "@/services/pcm-export-builder";
import { createPcmExportPackage } from "@/services/pcm-export-package";
import { createPcmExportSnapshot } from "@/services/pcm-export-snapshot";

export async function generatePcmExport() {
  const snapshot = await createPcmExportSnapshot();
  const database = await buildPcmDatabase(snapshot);
  return createPcmExportPackage(database);
}
