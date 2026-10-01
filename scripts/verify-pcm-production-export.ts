import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { cdbToSql } from "cdb-converter";
import { config } from "dotenv";
import initSqlJs from "sql.js";

config({ path: ".env.local", quiet: true });

function parseIds(value: unknown): number[] {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized === "()") return [];
  return normalized
    .slice(1, -1)
    .split(",")
    .map((part) => Number(part));
}

async function main() {
  const [{ createPcmExportSnapshot }, { buildPcmDatabase }] = await Promise.all([
    import("../services/pcm-export-snapshot"),
    import("../services/pcm-export-builder"),
  ]);

  const snapshot = await createPcmExportSnapshot();
  const result = await buildPcmDatabase(snapshot);
  const SQL = await initSqlJs({
    locateFile: (file) => resolve("node_modules/sql.js/dist", file),
  });
  const db = cdbToSql(result.cdb, SQL, { preciseTypes: true });
  const scalar = (sql: string) =>
    Number(db.exec(sql)[0]?.values[0]?.[0] ?? 0);

  try {
  const teamRows = db.exec(
    "SELECT IDteam, CONSTANT FROM DYN_team WHERE SUBSTR(CONSTANT, 1, 3) = CHAR(67, 83, 95)",
  )[0];
  const teamIds = new Set(teamRows.values.map((row) => Number(row[0])));
  const spectatorTeamId = Number(
    teamRows.values.find((row) => row[1] === "CS_SPECTATOR")?.[0],
  );
  const raceRows = db.exec(
    "SELECT IDrace, gene_ilist_fkIDteam FROM STA_race WHERE LENGTH(gene_ilist_fkIDteam) > 2",
  )[0];
  const participantLists = raceRows.values.map((row) => ({
    raceId: Number(row[0]),
    ids: parseIds(row[1]),
  }));
  const invalidReferences = participantLists.flatMap((race) =>
    race.ids
      .filter((teamId) => !teamIds.has(teamId))
      .map((teamId) => ({ raceId: race.raceId, teamId })),
  );
  const missingSpectator = participantLists.filter(
    (race) => !race.ids.includes(spectatorTeamId),
  );
  const tooShort = participantLists.filter((race) => race.ids.length < 8);

  if (invalidReferences.length || missingSpectator.length || tooShort.length) {
    throw new Error(
      `Export PCM invalide: ${invalidReferences.length} references, ${missingSpectator.length} sans spectateur, ${tooShort.length} sous huit equipes.`,
    );
  }

  console.log(
    JSON.stringify(
      {
        valid: true,
        databaseSha256: createHash("sha256").update(result.cdb).digest("hex"),
        bytes: result.cdb.byteLength,
        cyclostrategeTeams: teamIds.size,
        riders: scalar(
          "SELECT COUNT(*) FROM DYN_cyclist WHERE SUBSTR(CONSTANT, 1, 3) = CHAR(67, 83, 95)",
        ),
        remappedRaceLists: participantLists.length,
        minimumParticipants: Math.min(
          ...participantLists.map((race) => race.ids.length),
        ),
        maximumParticipants: Math.max(
          ...participantLists.map((race) => race.ids.length),
        ),
        invalidReferences: invalidReferences.length,
        racesMissingSpectatorTeam: missingSpectator.length,
      },
      null,
      2,
    ),
  );
  } finally {
    db.close();
  }
}

void main();
