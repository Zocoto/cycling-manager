import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

import { cdbToSql } from "cdb-converter";
import sharp from "sharp";
import initSqlJs from "sql.js";

const require = createRequire(import.meta.url);
const packageRoot = path.resolve(
  process.argv[2] || "C:/Dev/pcm26-bridge-lab/Cyclostratege-PCMAssets-Mod",
);
const roundTripRoot = path.resolve(
  process.argv[3] || path.join(packageRoot, ".validation-roundtrip"),
);

const teams = [
  { pcmTeamId: 244, sourceCode: "ADL", pcmSlot: "mov" },
  { pcmTeamId: 253, sourceCode: "ARO", pcmSlot: "dct" },
  { pcmTeamId: 269, sourceCode: "AUL", pcmSlot: "gfc" },
  { pcmTeamId: 294, sourceCode: "LIL", pcmSlot: "soq" },
  { pcmTeamId: 302, sourceCode: "KRI", pcmSlot: "apt" },
  { pcmTeamId: 345, sourceCode: "VNA", pcmSlot: "uex" },
  { pcmTeamId: 351, sourceCode: "YUK", pcmSlot: "tvl" },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function pixelDigest(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    channels: info.channels,
    sha256: sha256(data),
  };
}

const manifest = JSON.parse(
  await readFile(path.join(packageRoot, "manifest.json"), "utf8"),
);
assert(manifest.scope?.graphicalAssetsIncluded, "Assets graphiques non declares.");
assert(manifest.graphics?.teams?.length === teams.length, "Lot graphique incomplet.");

const pakPath = path.join(packageRoot, manifest.graphics.pakFile);
const pak = await readFile(pakPath);
assert(
  sha256(pak) === manifest.graphics.pakSha256,
  "Empreinte du PAK incoherente.",
);

const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
const SQL = await initSqlJs({ locateFile: () => wasmPath });
const db = cdbToSql(
  await readFile(path.join(packageRoot, "OfficialRelease.cdb")),
  SQL,
  { preciseTypes: true },
);
const mappings = [];

for (const team of teams) {
  const statement = db.prepare(
    "SELECT jersey_sz_abbreviation FROM DYN_team WHERE IDteam = ?",
  );
  statement.bind([team.pcmTeamId]);
  assert(statement.step(), `Equipe PCM ${team.pcmTeamId} absente.`);
  const row = statement.getAsObject();
  statement.free();
  assert(
    row.jersey_sz_abbreviation === team.pcmSlot,
    `Slot incorrect pour l'equipe PCM ${team.pcmTeamId}.`,
  );

  for (const piece of ["maillot", "minimaillot"]) {
    const sourcePath = path.join(
      packageRoot,
      "SourceAssets",
      "Teams",
      team.sourceCode,
      `${team.sourceCode}_${piece}.png`,
    );
    const roundTripPath = path.join(
      roundTripRoot,
      `${team.pcmSlot}_${piece}.png`,
    );
    const source = await pixelDigest(sourcePath);
    const roundTrip = await pixelDigest(roundTripPath);
    assert(
      JSON.stringify(source) === JSON.stringify(roundTrip),
      `Round-trip PCM different pour ${team.sourceCode}/${piece}.`,
    );
  }

  mappings.push({
    pcmTeamId: team.pcmTeamId,
    sourceCode: team.sourceCode,
    pcmSlot: team.pcmSlot,
  });
}

db.close();
console.log(
  JSON.stringify(
    {
      valid: true,
      pak: {
        file: path.basename(pakPath),
        bytes: pak.length,
        sha256: sha256(pak),
      },
      teams: mappings,
      textures: teams.length * 2,
      roundTripPixelExact: true,
    },
    null,
    2,
  ),
);

