import "server-only";

import { buildPcmDatabase } from "@/services/pcm-export-builder";
import { createPcmExportSnapshot } from "@/services/pcm-export-snapshot";

export async function generatePcmExport() {
  const snapshot = await createPcmExportSnapshot();
  return buildPcmDatabase(snapshot);
}
