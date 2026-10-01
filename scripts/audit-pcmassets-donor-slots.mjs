import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import initSqlJs from "sql.js";
import { cdbToSql } from "cdb-converter";

const gameDirectory = process.argv[2]
  ?? "C:/Program Files (x86)/Steam/steamapps/common/Pro Cycling Manager 2026";
const donorModDirectory = process.argv[3]
  ?? "C:/Program Files (x86)/Steam/steamapps/workshop/content/3936530/3749668860";
const candidateSource = process.argv[4]
  ?? "igd,dft,vbg,nsn,adr,kcr,vrr,aub,tfb,ekp,bcs,bbh,tft,tuk,vnq,uxm,eus,ptv,mbh,btc,acr,msp,urr,boa,tis,hac,rrs,tir,vwe,tnn,nmc,tud,cic,met,phv,tcq,drp,rrn,bcy,bie,bpc,vos,att,gsh,bai,tus,tsg";

async function readCandidates(source) {
  if (!source.startsWith("@cdb:")) {
    return source.split(",").map((value) => value.trim()).filter(Boolean);
  }
  const require = createRequire(import.meta.url);
  const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const db = cdbToSql(await readFile(source.slice(5)), SQL, { preciseTypes: true });
  const rows = db.exec(`
    SELECT jersey_sz_abbreviation AS abbreviation FROM DYN_team
    UNION
    SELECT jersey_sz_abbreviation AS abbreviation FROM DYN_sponsor
  `);
  const candidates = rows.flatMap((result) => result.values)
    .map(([value]) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean);
  db.close();
  return [...new Set(candidates)].sort();
}

const candidates = await readCandidates(candidateSource);

const endpoint = await fetch("http://127.0.0.1:9222/json")
  .then((response) => response.json());
const target = Array.isArray(endpoint) ? endpoint[0] : endpoint;
if (!target?.webSocketDebuggerUrl) {
  throw new Error("Interface PCMAssets introuvable.");
}

const socket = new WebSocket(target.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function send(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function canRead(abbreviation, piece) {
  const expression = `window.__TAURI_INTERNALS__.invoke("read_base_piece", ${JSON.stringify({
    gameDir: gameDirectory,
    abbreviation,
    name: piece,
    modDir: donorModDirectory,
  })})`;
  const evaluation = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  return !evaluation.exceptionDetails
    && evaluation.result?.subtype !== "error"
    && typeof evaluation.result?.value === "string"
    && evaluation.result.value.startsWith("data:image/png;base64,");
}

const results = [];
for (const abbreviation of candidates) {
  const maillot = await canRead(abbreviation, "maillot");
  const minimaillot = maillot && await canRead(abbreviation, "minimaillot");
  results.push({ abbreviation, maillot, minimaillot, usable: maillot && minimaillot });
}
socket.close();

console.log(JSON.stringify({
  donorModDirectory,
  candidates: results.length,
  usable: results.filter((result) => result.usable).map((result) => result.abbreviation),
  results,
}, null, 2));
