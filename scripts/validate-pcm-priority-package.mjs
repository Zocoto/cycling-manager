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
  { pcmTeamId: 249, sourceCode: "ARL", pcmSlot: "jay" },
  { pcmTeamId: 278, sourceCode: "JBF", pcmSlot: "ten" },
  { pcmTeamId: 279, sourceCode: "KAF", pcmSlot: "nci" },
  { pcmTeamId: 290, sourceCode: "LIM", pcmSlot: "efe" },
  { pcmTeamId: 297, sourceCode: "MTH", pcmSlot: "tbv" },
  { pcmTeamId: 307, sourceCode: "OKA", pcmSlot: "xat" },
  { pcmTeamId: 311, sourceCode: "PKC", pcmSlot: "ltk" },
  { pcmTeamId: 315, sourceCode: "CCR", pcmSlot: "tpp" },
  { pcmTeamId: 319, sourceCode: "SCA", pcmSlot: "pqt" },
  { pcmTeamId: 332, sourceCode: "TNP", pcmSlot: "loi" },
  { pcmTeamId: 283, sourceCode: "KHG", pcmSlot: "map" },
  { pcmTeamId: 331, sourceCode: "TEO", pcmSlot: "rbh" },
  { pcmTeamId: 259, sourceCode: "STK", pcmSlot: "cof" },
  { pcmTeamId: 267, sourceCode: "PMF", pcmSlot: "cjr" },
  { pcmTeamId: 256, sourceCode: "COV", pcmSlot: "tca" },
  { pcmTeamId: 268, sourceCode: "GLD", pcmSlot: "igd" },
  { pcmTeamId: 260, sourceCode: "DBF", pcmSlot: "dft" },
  { pcmTeamId: 273, sourceCode: "IDM", pcmSlot: "nsn" },
  { pcmTeamId: 334, sourceCode: "UJM", pcmSlot: "vbg" },
  { pcmTeamId: 250, sourceCode: "VEL", pcmSlot: "adr" },
  { pcmTeamId: 265, sourceCode: "HHY", pcmSlot: "kcr" },
  { pcmTeamId: 295, sourceCode: "MAL", pcmSlot: "vrr" },
  { pcmTeamId: 304, sourceCode: "MDL", pcmSlot: "aub" },
  { pcmTeamId: 320, sourceCode: "SDR", pcmSlot: "tfb" },
  { pcmTeamId: 322, sourceCode: "PBF", pcmSlot: "ekp" },
  { pcmTeamId: 343, sourceCode: "MLA", pcmSlot: "bcs" },
  { pcmTeamId: 344, sourceCode: "DDP", pcmSlot: "bbh" },
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
