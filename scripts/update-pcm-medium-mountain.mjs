import { constants } from "node:fs";
import {
  copyFile,
  readFile,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";

import { cdbToSql, sqlToCdb } from "cdb-converter";
import initSqlJs from "sql.js";

const apply = process.argv.includes("--apply");
const requestedPaths = process.argv.slice(2).filter((value) => value !== "--apply");

if (requestedPaths.length === 0) {
  throw new Error(
    "Indiquez au moins une base Cyclostratege .cdb à auditer ou corriger.",
  );
}

const SQL = await initSqlJs({
  locateFile: (file) => resolve("node_modules", "sql.js", "dist", file),
});

for (const requestedPath of requestedPaths) {
  const sourcePath = resolve(requestedPath);
  const parentName = basename(dirname(sourcePath));
  if (
    extname(sourcePath).toLowerCase() !== ".cdb" ||
    !/^Cyclostratege(?:-|$)/i.test(parentName)
  ) {
    throw new Error(`Base hors périmètre Cyclostratege : ${sourcePath}`);
  }
  await stat(sourcePath);

  const sourceBytes = await readFile(sourcePath);
  const db = cdbToSql(sourceBytes, SQL, { preciseTypes: true });
  try {
    const columns = new Set(
      queryRows(db, "PRAGMA table_info(DYN_cyclist)").map((row) =>
        String(row.name),
      ),
    );
    for (const requiredColumn of [
      "charac_i_mountain",
      "charac_i_hill",
      "charac_i_medium_mountain",
      "limit_i_medium_mountain",
      "CONSTANT",
    ]) {
      if (!columns.has(requiredColumn)) {
        throw new Error(
          `Colonne PCM26 absente de ${sourcePath} : ${requiredColumn}`,
        );
      }
    }

    const before = readSummary(db);
    db.run("BEGIN");
    try {
      db.run(`
        UPDATE DYN_cyclist
        SET charac_i_medium_mountain = CAST(
              ROUND((charac_i_mountain + charac_i_hill) / 2.0) AS INTEGER
            ),
            limit_i_medium_mountain = CAST(
              ROUND((charac_i_mountain + charac_i_hill) / 2.0) AS INTEGER
            )
        WHERE CONSTANT LIKE 'CS_%'
      `);
      db.run("COMMIT");
    } catch (error) {
      db.run("ROLLBACK");
      throw error;
    }
    const after = readSummary(db);
    if (after.total !== before.total || after.coherent !== after.total) {
      throw new Error(`Contrôle MM incomplet pour ${sourcePath}.`);
    }

    let backupPath = null;
    if (apply) {
      backupPath = `${sourcePath}.before-medium-mountain-20261001`;
      try {
        await copyFile(sourcePath, backupPath, constants.COPYFILE_EXCL);
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
      }

      const temporaryPath = `${sourcePath}.${process.pid}.tmp`;
      try {
        await writeFile(temporaryPath, new Uint8Array(sqlToCdb(db)));
        await verifyDatabase(temporaryPath, after.total);
        await copyFile(temporaryPath, sourcePath);
      } finally {
        await unlink(temporaryPath).catch(() => undefined);
      }
      await verifyDatabase(sourcePath, after.total);
    }

    console.log(
      JSON.stringify({
        mode: apply ? "apply" : "audit",
        sourcePath,
        backupPath,
        before,
        after,
      }),
    );
  } finally {
    db.close();
  }
}

function readSummary(db) {
  const row = queryRows(
    db,
    `SELECT
       COUNT(*) AS total,
       SUM(CASE
         WHEN charac_i_medium_mountain = CAST(
           ROUND((charac_i_mountain + charac_i_hill) / 2.0) AS INTEGER
         ) THEN 1 ELSE 0 END
       ) AS coherent,
       MIN(charac_i_medium_mountain) AS minimum,
       MAX(charac_i_medium_mountain) AS maximum
     FROM DYN_cyclist
     WHERE CONSTANT LIKE 'CS_%'`,
  )[0];
  return {
    total: Number(row?.total ?? 0),
    coherent: Number(row?.coherent ?? 0),
    minimum: row?.minimum === null ? null : Number(row?.minimum),
    maximum: row?.maximum === null ? null : Number(row?.maximum),
  };
}

async function verifyDatabase(path, expectedRiderCount) {
  const db = cdbToSql(await readFile(path), SQL, { preciseTypes: true });
  try {
    const summary = readSummary(db);
    if (
      summary.total !== expectedRiderCount ||
      summary.coherent !== expectedRiderCount
    ) {
      throw new Error(`Base PCM corrigée invalide : ${path}`);
    }
  } finally {
    db.close();
  }
}

function queryRows(db, sql) {
  const statement = db.prepare(sql);
  try {
    const rows = [];
    while (statement.step()) rows.push(statement.getAsObject());
    return rows;
  } finally {
    statement.free();
  }
}
