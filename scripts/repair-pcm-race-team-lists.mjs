import { createHash } from "node:crypto";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

import { cdbToSql, sqlToCdb } from "cdb-converter";
import initSqlJs from "sql.js";

const require = createRequire(import.meta.url);
const packageRoot = path.resolve(
  process.argv[2] || "C:/Dev/pcm26-bridge-lab/Cyclostratege-PCMAssets-Mod",
);
const targetPath = path.join(packageRoot, "OfficialRelease.cdb");
const backupPath = path.join(
  packageRoot,
  "OfficialRelease.pre-race-lists-fix.cdb",
);
const templatePath = path.resolve("assets/pcm/OfficialRelease.template.cdb");

function parseIdList(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized === "()") return [];
  return normalized
    .replace(/^\(/, "")
    .replace(/\)$/, "")
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function formatIdList(ids) {
  return `(${ids.join(",")})`;
}

function rows(db, sql) {
  const result = db.exec(sql)[0];
  if (!result) return [];
  return result.values.map((values) =>
    Object.fromEntries(result.columns.map((column, index) => [column, values[index]])),
  );
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function updateJsonHash(filePath, database, extra = {}) {
  const document = JSON.parse(await readFile(filePath, "utf8"));
  document.databaseSha256 = sha256(database);
  if ("databaseBytes" in document) document.databaseBytes = database.byteLength;
  Object.assign(document, extra);
  await writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`);
}

const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
const SQL = await initSqlJs({ locateFile: () => wasmPath });
const [targetBytes, templateBytes] = await Promise.all([
  readFile(targetPath),
  readFile(templatePath),
]);
const target = cdbToSql(targetBytes, SQL, { preciseTypes: true });
const template = cdbToSql(templateBytes, SQL, { preciseTypes: true });

try {
  const templateRaces = new Map(
    rows(
      template,
      "SELECT IDrace, gene_ilist_fkIDteam FROM STA_race ORDER BY IDrace",
    ).map((race) => [Number(race.IDrace), parseIdList(race.gene_ilist_fkIDteam)]),
  );
  const teams = rows(
    target,
    "SELECT IDteam, CONSTANT FROM DYN_team WHERE SUBSTR(CONSTANT, 1, 3) = CHAR(67, 83, 95) ORDER BY IDteam",
  );
  const spectator = teams.find((team) => team.CONSTANT === "CS_SPECTATOR");
  if (!spectator) throw new Error("Equipe spectateur absente de la base cible.");

  const spectatorTeamId = Number(spectator.IDteam);
  const sportingTeamIds = teams
    .filter((team) => Number(team.IDteam) !== spectatorTeamId)
    .map((team) => Number(team.IDteam));
  if (sportingTeamIds.length < 7) {
    throw new Error("Moins de sept equipes sportives Cyclostratege disponibles.");
  }

  let repaired = 0;
  for (const race of rows(
    target,
    "SELECT IDrace FROM STA_race ORDER BY IDrace",
  )) {
    const raceId = Number(race.IDrace);
    const originalTeamIds = templateRaces.get(raceId) ?? [];
    if (originalTeamIds.length === 0) continue;

    const targetCount = Math.min(
      sportingTeamIds.length + 1,
      Math.max(8, originalTeamIds.length),
    );
    const rotationStart = Math.abs(raceId) % sportingTeamIds.length;
    const remapped = [spectatorTeamId];
    for (let offset = 0; remapped.length < targetCount; offset += 1) {
      remapped.push(
        sportingTeamIds[(rotationStart + offset) % sportingTeamIds.length],
      );
    }

    target.run(
      "UPDATE STA_race SET gene_ilist_fkIDteam = ? WHERE IDrace = ?",
      [formatIdList(remapped), raceId],
    );
    repaired += 1;
  }

  const validTeamIds = new Set(teams.map((team) => Number(team.IDteam)));
  const repairedRaces = rows(
    target,
    "SELECT IDrace, gene_ilist_fkIDteam FROM STA_race WHERE LENGTH(gene_ilist_fkIDteam) > 2",
  );
  if (repairedRaces.length !== repaired) {
    throw new Error("Nombre incoherent de listes de participants reparees.");
  }
  for (const race of repairedRaces) {
    const ids = parseIdList(race.gene_ilist_fkIDteam);
    if (ids.length < 8) throw new Error(`Course ${race.IDrace}: moins de 8 equipes.`);
    if (!ids.includes(spectatorTeamId)) {
      throw new Error(`Course ${race.IDrace}: equipe spectateur absente.`);
    }
    if (new Set(ids).size !== ids.length) {
      throw new Error(`Course ${race.IDrace}: participant duplique.`);
    }
    if (ids.some((id) => !validTeamIds.has(id))) {
      throw new Error(`Course ${race.IDrace}: equipe non Cyclostratege.`);
    }
  }

  const repairedBytes = new Uint8Array(sqlToCdb(target));
  await copyFile(targetPath, backupPath);
  await writeFile(targetPath, repairedBytes);
  await updateJsonHash(path.join(packageRoot, "manifest.json"), repairedBytes);
  await updateJsonHash(path.join(packageRoot, "validation.json"), repairedBytes, {
    presetRaceParticipantListsRepaired: repaired,
  });

  console.log(
    JSON.stringify(
      {
        targetPath,
        backupPath,
        bytes: repairedBytes.byteLength,
        sha256: sha256(repairedBytes),
        cyclostrategeTeams: teams.length,
        repairedRaceLists: repaired,
        minimumParticipants: Math.min(
          ...repairedRaces.map((race) => parseIdList(race.gene_ilist_fkIDteam).length),
        ),
      },
      null,
      2,
    ),
  );
} finally {
  target.close();
  template.close();
}
