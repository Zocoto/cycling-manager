import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { cp, lstat, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";

import { cdbToSql } from "cdb-converter";
import { strToU8, unzipSync, zipSync } from "fflate";
import initSqlJs from "sql.js";

const workshopId = "3811779261";
const appId = "3936530";
const exportFiles = [
  "OfficialRelease.cdb", "OfficialLocal.cdb", "mod.xml", "manifest.json",
  "validation.json", "LISEZ-MOI.txt", "Installer-graphismes.ps1",
];
const reportFile = "compatibilite-graphismes.json";
const programmeRaces = {
  "World-Tour/top_tdf.xml": 25,
  "World-Tour/topclas_maastricht.xml": 173,
  "World-Tour/topclas_roubaix.xml": 4,
  "Continental/top_tdf.xml": 25,
  "Continental/topclas_maastricht.xml": 173,
  "Continental/c0_classiquedunkerque.xml": 105,
};
const flagScales = ["4k", "big", "nor", "sma"];
const defaultUnrealPak = "C:/Program Files/Epic Games/UE_5.6/Engine/Binaries/Win64/UnrealPak.exe";
const execute = promisify(execFile);

const { values: options } = parseArgs({
  options: {
    export: { type: "string" }, graphics: { type: "string" }, "unreal-pak": { type: "string" },
    startlists: { type: "string" }, output: { type: "string" }, title: { type: "string" },
  },
});
assert(options.export, "--export is required (the directory or ZIP of the database export)");
assert(!options.output || options.graphics, "--graphics is required to stage a Workshop upload");
assert(!options.output || options.title?.trim(), "--title is required to stage a Workshop upload");
assert(!options.title || !/[\r\n\0]/.test(options.title), "Invalid Workshop database title");

const source = path.resolve(options.export);
const graphicsRoot = path.resolve(options.graphics ?? source);
const databaseFiles = await loadExport(source);
const manifest = decodeJson(databaseFiles["manifest.json"]);
const reportedGraphics = databaseFiles[reportFile] && decodeJson(databaseFiles[reportFile]);
const databaseSha256 = sha256(databaseFiles["OfficialRelease.cdb"]);
const localDatabaseSha256 = sha256(databaseFiles["OfficialLocal.cdb"]);
assert.equal(manifest.databaseSha256, databaseSha256, "OfficialRelease.cdb does not match the export manifest");
assert.equal(manifest.localDatabaseSha256, localDatabaseSha256, "OfficialLocal.cdb does not match the export manifest");
if (reportedGraphics) {
  assert.equal(reportedGraphics.databaseSha256, databaseSha256, "Graphics report does not match OfficialRelease.cdb");
  assert.equal(reportedGraphics.localDatabaseSha256, localDatabaseSha256, "Graphics report does not match OfficialLocal.cdb");
}

const require = createRequire(import.meta.url);
const SQL = await initSqlJs({ locateFile: () => require.resolve("sql.js/dist/sql-wasm.wasm") });
const database = cdbToSql(databaseFiles["OfficialRelease.cdb"], SQL, { preciseTypes: true });
const local = cdbToSql(databaseFiles["OfficialLocal.cdb"], SQL, { preciseTypes: true });
const scratch = await mkdtemp(path.join(tmpdir(), "pcm-workshop-audit-"));
try {
  const graphics = await inspectGraphics(manifest.compatibleGraphics, graphicsRoot, scratch);
  const data = inspectDatabase(database, local, graphics, reportedGraphics);
  const startlists = options.startlists ? await inspectStartlists(options.startlists, database, data) : null;
  const audit = {
    databaseSha256, localDatabaseSha256,
    teams: data.teams.size, riders: data.riders.size, countries: data.countries,
    graphics: { paks: graphics.paks, teamKits: data.teamKits, distinctives: data.distinctives },
    startlists: startlists?.events ?? [],
  };
  if (options.output) {
    assert(reportedGraphics, `The revised export must include ${reportFile}`);
    if (startlists) {
      const entered = new Set(startlists.events.flatMap(event => event.teamIds));
      for (const team of data.teamKits) if (entered.has(team.teamId)) {
        assert(team.custom, 'A Gala starter is missing its cooked jersey pair: ' + team.name);
      }
    }
    assert.equal(data.countries.filter((country) => country.missingFlagScales.length).length, 0,
      "At least one flag used by this database is absent from the Workshop atlas. Review the audit first.");
    await stageWorkshop(path.resolve(options.output), options.title, databaseFiles, manifest, graphicsRoot, graphics, startlists, audit);
  }
  console.log(JSON.stringify(options.output ? {
    databaseSha256, localDatabaseSha256, teams: audit.teams, riders: audit.riders,
    countries: audit.countries.length, startlists: audit.startlists.length,
    customTeamKits: data.teamKits.filter(team => team.custom).length,
    customDistinctives: data.distinctives.filter(title => title.compiled).length,
    auditFile: path.join(path.resolve(options.output), "audit.json"),
  } : audit, null, 2));
} finally {
  database.close();
  local.close();
  await rm(scratch, { recursive: true, force: true });
}

async function loadExport(sourcePath) {
  if (sourcePath.toLowerCase().endsWith(".zip")) return unzipSync(await readFile(sourcePath));
  const names = await readdir(sourcePath);
  const required = [...exportFiles, ...(names.includes(reportFile) ? [reportFile] : [])];
  return Object.fromEntries(await Promise.all(required.map(async (name) => [name, await readFile(path.join(sourcePath, name))])));
}

function decodeJson(contents) {
  return JSON.parse(Buffer.from(contents).toString("utf8"));
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function hashFile(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function inspectGraphics(spec, root, temp) {
  assert.equal(String(spec?.workshopItem), workshopId, "Wrong Steam graphics item in export manifest");
  assert(spec.files?.length, "No graphics PAKs in export manifest");
  const names = new Set();
  const paks = [];
  const paths = new Set();
  const unrealPak = path.resolve(options["unreal-pak"] ?? defaultUnrealPak);
  let atlasPak;
  for (const { name, sha256: expectedHash } of spec.files) {
    assert.match(name, /^PCMAssets_[\w-]+_P\.pak$/i, "Invalid PAK filename");
    assert(!names.has(name.toLowerCase()), `Duplicate PAK ${name}`);
    names.add(name.toLowerCase());
    const file = path.join(root, name);
    assert.equal(await hashFile(file), expectedHash, `PAK version mismatch: ${name}`);
    const { stdout } = await execute(unrealPak, [file, "-List", `-abslog=${path.join(temp, name + ".log")}`],
      { cwd: temp, encoding: "utf8", windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    const mount = stdout.match(/with mount point "([^"]+)"/)?.[1]?.toLowerCase();
    const members = new Set([...stdout.matchAll(/Display: "([^"]+)" offset:/g)].map((match) => match[1].toLowerCase()));
    assert(mount && members.size > 0, `Unreadable PAK index: ${name}`);
    if (mount === "../../../pcm/content/gui/") {
      assert(!atlasPak, "Several PAKs replace the same PCM flag atlases");
      atlasPak = file;
      for (const scale of flagScales) {
        for (const extension of ["xml", "uasset", "uexp"]) {
          assert(members.has(`all_${scale}.${extension}`), `Incomplete flag atlas ${scale} in ${name}`);
        }
      }
    } else {
      assert(mount.endsWith("/plugins/mod/"), `Unexpected PCM jersey PAK mount: ${mount}`);
      for (const resource of members) paths.add(resource);
    }
    paks.push({ name, sha256: expectedHash, mount, members: members.size });
  }
  assert(atlasPak, "No flag atlas in the graphics package");
  await execute(unrealPak, [atlasPak, "-Extract", temp, "-Filter=*.xml", `-abslog=${path.join(temp, "flags.log")}`],
    { cwd: temp, windowsHide: true });
  const flags = new Map();
  for (const scale of flagScales) {
    const xml = await readFile(path.join(temp, `all_${scale}.xml`), "utf8");
    const sprites = new Set([...xml.matchAll(/<SubTexture\s+name="([^"]+)"/g)].map((match) => match[1]));
    assert(sprites.size > 0, `No sprites in flag atlas ${scale}`);
    flags.set(scale, sprites);
  }
  return { paks, paths, flags };
}

function rows(database, statement) {
  const result = database.exec(statement)[0];
  return result?.values.map((values) => Object.fromEntries(result.columns.map((column, index) => [column, values[index]]))) ?? [];
}

function inspectDatabase(db, localDb, graphics, reported) {
  const teams = new Map(rows(db, "SELECT IDteam, gene_sz_name, jersey_sz_abbreviation, fkIDcountry FROM DYN_team WHERE CONSTANT LIKE 'CS\\_%' ESCAPE '\\'")
    .map((team) => [team.IDteam, team]));
  const riders = new Map(rows(db, `SELECT c.IDcyclist, c.fkIDteam, c.fkIDcontract, c.gene_i_champion_bit,
      co.IDcountry AS nationality, co.CONSTANT AS countryCode, ctr.fkIDteam AS contractTeam,
      ctr.fkIDcyclist AS contractRider, ctr.gene_b_active_contract AS activeContract
    FROM DYN_cyclist c LEFT JOIN STA_region r ON r.IDregion=c.fkIDregion
    LEFT JOIN STA_country co ON co.IDcountry=r.fkIDcountry
    LEFT JOIN DYN_contract_cyclist ctr ON ctr.IDcontract_cyclist=c.fkIDcontract
    WHERE c.CONSTANT LIKE 'CS\\_%' ESCAPE '\\'`).map((rider) => [rider.IDcyclist, rider]));
  assert(teams.has(243) && riders.size > 0, "Export has no spectator team or riders");
  const populatedTeams = new Set();
  for (const rider of riders.values()) {
    assert(teams.has(rider.fkIDteam), `Rider ${rider.IDcyclist} points at an unknown team`);
    assert(rider.nationality, `Rider ${rider.IDcyclist} has no country/region`);
    assert(rider.fkIDcontract > 0 && rider.activeContract === 1 && rider.contractRider === rider.IDcyclist && rider.contractTeam === rider.fkIDteam,
      `Rider ${rider.IDcyclist} has no active matching contract`);
    populatedTeams.add(rider.fkIDteam);
  }
  for (const id of teams.keys()) assert(populatedTeams.has(id), `Team ${id} has no riders`);
  for (let id = 9001; id <= 9010; id++) assert.equal(riders.get(id)?.fkIDteam, 243, `Missing spectator ${id}`);

  const usedCountries = new Set([
    ...Array.from(riders.values(), (rider) => rider.nationality),
    ...Array.from(teams.values(), (team) => team.fkIDcountry),
  ]);
  const names = new Map(rows(localDb, "SELECT IDloc, gene_sz_french, gene_sz_english FROM LOC").map((row) => [row.IDloc, row]));
  const countries = rows(db, "SELECT IDcountry, CONSTANT, gene_strID_country_name, gene_sz_flag FROM STA_country ORDER BY CONSTANT")
    .filter((country) => usedCountries.has(country.IDcountry)).map((country) => {
      const name = names.get(country.gene_strID_country_name);
      assert(name?.gene_sz_french?.trim() && name?.gene_sz_english?.trim(), `Missing French or English country name: ${country.CONSTANT}`);
      return {
        id: country.IDcountry, code: country.CONSTANT, name: name.gene_sz_french, flag: country.gene_sz_flag,
        missingFlagScales: flagScales.filter((scale) => !graphics.flags.get(scale).has(country.gene_sz_flag)),
      };
    });
  assert.equal(countries.length, usedCountries.size, "An exported team has an unknown country");

  const claim = new Map(reported?.teamKits?.map((entry) => [entry.teamId, entry]));
  if (reported) assert.equal(claim.size, teams.size, "Graphics report does not cover all CDB teams");
  const hasTexture = (stem) => [".uasset", ".uexp"].every((extension) => graphics.paths.has(stem + extension));
  const jerseyStem = (code) => `content/jersey/team/${code}/${code}_maillot`;
  const teamKits = Array.from(teams.values(), (team) => {
    const code = team.jersey_sz_abbreviation.toLowerCase();
    const jersey = hasTexture(jerseyStem(code));
    const mini = hasTexture(`content/minijersey/team/${code}_minimaillot`);
    const claimed = claim.get(team.IDteam);
    if (reported) {
      assert.equal(claimed?.assetCode, code, `Graphics report differs from CDB code for team ${team.IDteam}`);
      assert.equal(claimed?.custom, jersey && mini, `Graphics report differs from actual jersey pair for team ${team.IDteam}`);
    }
    return { teamId: team.IDteam, name: team.gene_sz_name, code, jersey, mini, custom: jersey && mini, claimedCustom: claimed?.custom ?? null };
  });
  const distinctives = (reported?.distinctives ?? []).map((entry) => {
    const code = teams.get(entry.teamId)?.jersey_sz_abbreviation.toLowerCase();
    assert.equal(code, entry.assetCode, `Graphics report differs from CDB code for rider ${entry.riderId}`);
    assert.equal(riders.get(entry.riderId)?.fkIDteam, entry.teamId, `Graphics report assigns rider ${entry.riderId} to a different team`);
    const compiled = entry.variant ? hasTexture(`${jerseyStem(code)}_${entry.variant.toLowerCase()}`) : false;
    assert.equal(entry.custom, compiled, `Incorrect champion texture coverage for ${entry.riderId}: ${entry.variant}`);
    return { ...entry, compiled };
  });
  return { teams, riders, countries, teamKits, distinctives };
}

async function inspectStartlists(sourcePath, db, data) {
  const { files } = decodeJson(await readFile(sourcePath));
  assert.deepEqual(Object.keys(files).sort(), Object.keys(programmeRaces).sort(), "Expected the six exact native Gala S4 startlist files");
  const events = Object.entries(programmeRaces).map(([file, raceId]) => {
    const [rule] = rows(db, `SELECT r.gene_sz_filename, rr.gene_i_max_team, rr.gene_i_min_riders, rr.gene_i_max_riders
      FROM STA_race r JOIN STA_race_rules rr ON rr.fkIDrace=r.IDrace WHERE r.IDrace=${raceId}`);
    assert.equal(rule?.gene_sz_filename + ".xml", path.posix.basename(file), `Wrong PCM native file name for ${file}`);
    assert.equal(rule.gene_i_min_riders, 7, `Wrong minimum team size for ${file}`);
    assert.equal(rule.gene_i_max_riders, 8, `Wrong maximum team size for ${file}`);
    const xml = files[file];
    const body = xml.match(/^<\?xml version="1\.0" encoding="utf-8"\?>\s*<startlist>([\s\S]*?)<\/startlist>\s*$/)?.[1];
    assert(body, `Invalid startlist XML in ${file}`);
    const teamPattern = /<team id="(\d+)">((?:\s*<cyclist id="\d+"\s*\/>)*\s*)<\/team>/g;
    const lineups = [...body.matchAll(teamPattern)];
    assert.equal(body.replace(teamPattern, "").trim(), "", `Unexpected startlist elements in ${file}`);
    assert(lineups.length >= 2 && lineups.length <= rule.gene_i_max_team, `Invalid number of teams in ${file}`);
    const teams = new Set();
    const riders = new Set();
    for (const [, teamText, cyclists] of lineups) {
      const teamId = Number(teamText);
      assert(data.teams.has(teamId) && !teams.has(teamId), `Unknown or repeated team ${teamId} in ${file}`);
      teams.add(teamId);
      const ids = [...cyclists.matchAll(/<cyclist id="(\d+)"\s*\/>/g)].map((match) => Number(match[1]));
      assert(ids.length >= rule.gene_i_min_riders && ids.length <= rule.gene_i_max_riders, `Wrong team size for ${teamId} in ${file}`);
      if (teamId === 243) assert.deepEqual(ids, [9001, 9002, 9003, 9004, 9005, 9006, 9007], `Wrong spectator lineup in ${file}`);
      for (const riderId of ids) {
        assert(!riders.has(riderId), `Repeated rider ${riderId} in ${file}`);
        assert.equal(data.riders.get(riderId)?.fkIDteam, teamId, `Rider ${riderId} is missing or has another team in ${file}`);
        riders.add(riderId);
      }
    }
    assert(teams.has(243), `No spectator team in ${file}`);
    return { file, sha256: sha256(xml), teams: teams.size, riders: riders.size, teamIds: [...teams] };
  });
  assert.equal(rows(db, "SELECT IDstage FROM STA_stage WHERE fkIDrace=25 AND gene_i_stage_number=18").length, 1, "Missing Hautacam stage");
  return { files, events };
}

function xmlEscape(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function stageWorkshop(output, title, files, previousManifest, sourceGraphics, graphics, startlists, audit) {
  const description = `Base et graphismes Cyclostratège pour PCM26. Attendez la fin de la mise à jour Steam, relancez PCM26 et sélectionnez « ${title} ». Les startlists correspondantes sont disponibles dans l’export privé du gala sur cyclostratege.fr.`;
  const previousMod = Buffer.from(files["mod.xml"]).toString("utf8");
  const date = new Date(previousManifest.generatedAt).toISOString();
  const titleXml = xmlEscape(title);
  const modXml = `<?xml version="1.0" encoding="utf-8"?>\n<Mod>\n<Id>${workshopId}</Id>\n<Title>${titleXml}</Title>\n<Description>${xmlEscape(description)}</Description>\n<Visibility>Public</Visibility>\n<TimeCreated>2026-10-02T08:13:10.678Z</TimeCreated>\n<TimeUpdated>${date}</TimeUpdated>\n</Mod>\n`;
  assert.match(previousMod, /<Mod>[\s\S]*<\/Mod>/, "Source export is missing PCM mod metadata");
  const content = path.join(output, "Content");
  const steam = path.join(output, "Steam");
  await mkdir(output);
  await mkdir(content);
  await mkdir(steam);
  const manifest = {
    ...previousManifest, title, modId: workshopId, installationFolder: workshopId,
    scope: { ...previousManifest.scope, graphicalAssetsIncluded: true }, startlistsIncluded: false,
  };
  const guide = `${description}\n\nLes deux CDB et les PAK de ce dossier font partie de la même installation.\n`;
  const publicFiles = {
    ...Object.fromEntries(exportFiles.map((name) => [name, files[name]])),
    [reportFile]: files[reportFile], "mod.xml": modXml, "LISEZ-MOI.txt": guide,
    "manifest.json": JSON.stringify(manifest, null, 2) + "\n",
  };
  for (const [name, contents] of Object.entries(publicFiles)) await writeFile(path.join(content, name), contents);
  for (const { name, sha256: digest } of graphics.paks) {
    const destination = path.join(content, name);
    await cp(path.join(sourceGraphics, name), destination);
    assert.equal(await hashFile(destination), digest, `Copied PAK differs from verified input: ${name}`);
  }
  // This directory has already been public. Never copy arbitrary files from the export or staging directory.
  await cp(path.join(sourceGraphics, "SourceAssets"), path.join(content, "SourceAssets"), {
    recursive: true, filter: async (entry) => {
      const info = await lstat(entry);
      assert(!info.isSymbolicLink(), "Unexpected link in Workshop SourceAssets");
      return info.isDirectory() || /\.(json|md|png|svg|txt|webp)$/i.test(entry);
    },
  });
  await writeFile(path.join(output, "audit.json"), JSON.stringify(audit, null, 2) + "\n");
  const quote = (value) => `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  const vdf = {
    appid: appId, publishedfileid: workshopId, contentfolder: content, visibility: "0",
    title: "Cyclostratège PCM26 — Pack officiel", description,
    changenote: `Base ${title}. Vérification des nationalités, des maillots et des mini-maillots disponibles.`,
  };
  await writeFile(path.join(steam, "workshop-item.vdf"), `"workshopitem"\n{\n${Object.entries(vdf).map(([key, value]) => `  ${quote(key)} ${quote(value)}`).join("\n")}\n}\n`);
  if (startlists) {
    const installer = await readFile(fileURLToPath(new URL("./install-pcm-gala-startlists.ps1", import.meta.url)));
    const listFiles = Object.fromEntries(Object.entries(startlists.files).map(([name, contents]) => [`Startlists/${name}`, strToU8(contents)]));
    const startlistAudit = { databaseSha256: audit.databaseSha256, title, events: startlists.events };
    await writeFile(path.join(output, "Startlists.zip"), zipSync({
      ...listFiles,
      "Startlists/audit.json": strToU8(JSON.stringify(startlistAudit, null, 2) + "\n"),
      "Installer-startlists.ps1": new Uint8Array(installer),
      "LISEZ-MOI.txt": strToU8(`Startlists pour ${title}\n\nFermez PCM26. Décompressez ce ZIP. Depuis PowerShell, exécutez .\\Installer-startlists.ps1 -Programme Continental -BasePcm "CHEMIN\\OfficialRelease.cdb" (ou World-Tour). Utilisez une seule série à la fois. Montagne : Tour de France 2022, étape 18.\n`),
    }));
  }
}
