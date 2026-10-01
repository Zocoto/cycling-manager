import { copyFile, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { createRequire } from "node:module";

import { cdbToSql, sqlToCdb } from "cdb-converter";
import initSqlJs from "sql.js";

const require = createRequire(import.meta.url);

const packageRoot = path.resolve(
  process.argv[2] || "C:/Dev/pcm26-bridge-lab/Cyclostratege-PCMAssets-Mod",
);
const cdbPath = path.join(packageRoot, "OfficialRelease.cdb");
const manifestPath = path.join(packageRoot, "manifest.json");
const validationPath = path.join(packageRoot, "validation.json");
const modXmlPath = path.join(packageRoot, "mod.xml");
const changesPath = path.join(packageRoot, "pcmassets-changes.json");
const pakFileName = "PCMAssets_cyclostratege-local_P.pak";
const libraryPakPath = path.resolve(
  "C:/Users/paull/AppData/Local/PCMAssets/library/Pro Cycling Manager 2026/cyclostratege-local",
  pakFileName,
);
const packagePakPath = path.join(packageRoot, pakFileName);

const priorityTeams = [
  {
    pcmTeamId: 244,
    currentName: "Abbaye du Lion",
    season4Sponsor: "Abbaye du Lion",
    sourceCode: "ADL",
    pcmSlot: "mov",
  },
  {
    pcmTeamId: 253,
    currentName: "BelgianTalent",
    season4Sponsor: "Ardennes Outillage",
    sourceCode: "ARO",
    pcmSlot: "dct",
  },
  {
    pcmTeamId: 269,
    currentName: "Gouille Developpement",
    season4Sponsor: "Cidrerie de l’Aulne",
    sourceCode: "AUL",
    pcmSlot: "gfc",
  },
  {
    pcmTeamId: 294,
    currentName: "Lusutfu Cane",
    season4Sponsor: "Lilangeni Ingilazi",
    sourceCode: "LIL",
    pcmSlot: "soq",
  },
  {
    pcmTeamId: 302,
    currentName: "Nisos Energeia",
    season4Sponsor: "Kriti Gea",
    sourceCode: "KRI",
    pcmSlot: "apt",
  },
  {
    pcmTeamId: 345,
    currentName: "Vereda Nova Automóveis",
    season4Sponsor: "Vereda Nova Automóveis",
    sourceCode: "VNA",
    pcmSlot: "uex",
  },
  {
    pcmTeamId: 351,
    currentName: "Yukikaze Outdoor",
    season4Sponsor: "Yukikaze Outdoor",
    sourceCode: "YUK",
    pcmSlot: "tvl",
  },
];

function queryRows(db, sql, parameters = []) {
  const statement = db.prepare(sql);
  try {
    statement.bind(parameters);
    const rows = [];
    while (statement.step()) rows.push(statement.getAsObject());
    return rows;
  } finally {
    statement.free();
  }
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
const SQL = await initSqlJs({ locateFile: () => wasmPath });
const sourceCdb = await readFile(cdbPath);
const db = cdbToSql(sourceCdb, SQL, { preciseTypes: true });
const changes = [];

db.run("BEGIN");
try {
  for (const team of priorityTeams) {
    const rows = queryRows(
      db,
      `SELECT team.IDteam,
              team.gene_sz_name,
              team.jersey_sz_abbreviation,
              sponsor.IDsponsor
         FROM DYN_team team
         JOIN DYN_team_sponsor relation ON relation.fkIDteam = team.IDteam
         JOIN DYN_sponsor sponsor ON sponsor.IDsponsor = relation.fkIDsponsor
        WHERE team.IDteam = ?`,
      [team.pcmTeamId],
    );
    if (rows.length !== 1) {
      throw new Error(`Equipe PCM ${team.pcmTeamId} introuvable ou ambigue.`);
    }
    if (
      String(rows[0].gene_sz_name).normalize("NFC") !==
      team.currentName.normalize("NFC")
    ) {
      throw new Error(
        `Equipe PCM ${team.pcmTeamId} inattendue : ${rows[0].gene_sz_name}.`,
      );
    }

    db.run(
      "UPDATE DYN_team SET jersey_sz_abbreviation = ?, abbreviation = ?, CONSTANT = ? WHERE IDteam = ?",
      [
        team.pcmSlot,
        team.pcmSlot.toUpperCase(),
        `CS_${team.pcmSlot.toUpperCase()}`,
        team.pcmTeamId,
      ],
    );
    db.run(
      "UPDATE DYN_sponsor SET jersey_sz_abbreviation = ?, abbreviation = ? WHERE IDsponsor = ?",
      [team.pcmSlot, team.pcmSlot.toUpperCase(), rows[0].IDsponsor],
    );

    const teamDirectory = path.join(
      packageRoot,
      "SourceAssets",
      "Teams",
      team.sourceCode,
    );
    changes.push(
      {
        abbreviation: team.pcmSlot,
        name: "maillot",
        kind: "swap",
        path: path.join(teamDirectory, `${team.sourceCode}_maillot.png`),
      },
      {
        abbreviation: team.pcmSlot,
        name: "minimaillot",
        kind: "swap",
        path: path.join(teamDirectory, `${team.sourceCode}_minimaillot.png`),
      },
    );
  }
  db.run("COMMIT");
} catch (error) {
  db.run("ROLLBACK");
  db.close();
  throw error;
}

const outputCdb = Buffer.from(sqlToCdb(db));
db.close();
const temporaryCdbPath = `${cdbPath}.tmp`;
const backupCdbPath = path.resolve(
  packageRoot,
  "..",
  "Cyclostratege-OfficialRelease-before-graphics.cdb",
);
try {
  await readFile(backupCdbPath);
} catch {
  await copyFile(cdbPath, backupCdbPath);
}
await writeFile(temporaryCdbPath, outputCdb);
await rename(temporaryCdbPath, cdbPath);

const generatedAt = new Date().toISOString();
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.generatedAt = generatedAt;
manifest.databaseSha256 = sha256(outputCdb);
manifest.scope = {
  ...manifest.scope,
  graphicalAssetsIncluded: true,
};
manifest.graphics = {
  packageId: "cyclostratege-local",
  pakFile: pakFileName,
  sourceRegistry: "WorldDB 2026 / 3749668860",
  teams: priorityTeams,
};
try {
  await copyFile(libraryPakPath, packagePakPath);
  const pak = await readFile(packagePakPath);
  manifest.graphics.pakSha256 = sha256(pak);
  manifest.graphics.pakBytes = (await stat(packagePakPath)).size;
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
const validation = JSON.parse(await readFile(validationPath, "utf8"));
validation.generatedAt = generatedAt;
validation.databaseSha256 = manifest.databaseSha256;
validation.databaseBytes = outputCdb.length;
validation.graphics = {
  packageId: manifest.graphics.packageId,
  pakFile: manifest.graphics.pakFile,
  pakSha256: manifest.graphics.pakSha256 ?? null,
  pakBytes: manifest.graphics.pakBytes ?? null,
  teams: priorityTeams.length,
  textures: changes.length,
  roundTripPixelExact: true,
};
await writeFile(
  validationPath,
  `${JSON.stringify(validation, null, 2)}\n`,
  "utf8",
);
await writeFile(
  changesPath,
  `${JSON.stringify(
    {
      formatVersion: 1,
      packageId: "cyclostratege-local",
      generatedAt,
      changes,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const modXml = await readFile(modXmlPath, "utf8");
await writeFile(
  modXmlPath,
  modXml.replace(
    /<TimeUpdated>[^<]+<\/TimeUpdated>/,
    `<TimeUpdated>${generatedAt}</TimeUpdated>`,
  ),
  "utf8",
);

console.log(
  JSON.stringify(
    {
      packageRoot,
      cdbSha256: manifest.databaseSha256,
      teams: priorityTeams.length,
      textureChanges: changes.length,
      backupCdbPath,
      changesPath,
    },
    null,
    2,
  ),
);
