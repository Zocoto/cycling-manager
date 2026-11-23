import "server-only";

import { buildPcmDatabase } from "@/services/pcm-export-builder";
import { createPcmExportPackage } from "@/services/pcm-export-package";
import { createPcmExportSnapshot } from "@/services/pcm-export-snapshot";
import { loadSeasonFiveGalaExportSource } from "@/services/season-five-gala-startlists";
import { buildSeasonFiveGalaStartlists } from "@/lib/game/season-five-gala-startlists";

export async function generatePcmExport(seasonFinale = false,seasonFourGala = false,seasonFiveGala = false) {
  const source = seasonFiveGala ? await loadSeasonFiveGalaExportSource() : undefined;
  const snapshot = await createPcmExportSnapshot(seasonFinale,seasonFourGala,source);
  const database = await buildPcmDatabase(snapshot);
  return createPcmExportPackage(database, {
    edition: seasonFiveGala ? "gala-s5" : seasonFourGala ? "gala-s4" : seasonFinale ? "gala" : "standard",
    ...(source ? { galaStartlists: buildSeasonFiveGalaStartlists(source, snapshot, database.metadata.outputSha256) } : {}),
  });
}
