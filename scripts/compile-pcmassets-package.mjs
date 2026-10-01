import { createHash } from "node:crypto";
import { copyFile, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const packageRoot = path.resolve(
  process.argv[2] ?? "C:/Dev/pcm26-bridge-lab/Cyclostratege-PCMAssets-Mod",
);
const gameDirectory = path.resolve(
  process.argv[3] ?? "C:/Program Files (x86)/Steam/steamapps/common/Pro Cycling Manager 2026",
);
const donorModDirectory = path.resolve(
  process.argv[4] ?? "C:/Program Files (x86)/Steam/steamapps/workshop/content/3936530/3749668860",
);
const changesDocument = JSON.parse(
  await readFile(path.join(packageRoot, "pcmassets-changes.json"), "utf8"),
);

const endpoint = await fetch("http://127.0.0.1:9222/json").then((response) => response.json());
const target = Array.isArray(endpoint) ? endpoint[0] : endpoint;
if (!target?.webSocketDebuggerUrl) throw new Error("Interface PCMAssets introuvable.");

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

const expression = `window.__TAURI_INTERNALS__.invoke("save_changes", ${JSON.stringify({
  gameDir: gameDirectory,
  changes: changesDocument.changes,
  modId: changesDocument.packageId,
  modDir: donorModDirectory,
})}).then(async result => {
  await window.__TAURI_INTERNALS__.invoke("set_active_mod", ${JSON.stringify({
    gameDir: gameDirectory,
    modId: changesDocument.packageId,
  })});
  return result ?? null;
})`;

const evaluation = await send("Runtime.evaluate", {
  expression,
  awaitPromise: true,
  returnByValue: true,
});
socket.close();
if (evaluation.exceptionDetails) {
  const detail = evaluation.exceptionDetails.exception?.description
    ?? evaluation.result?.description
    ?? evaluation.exceptionDetails.text
    ?? "Compilation PCMAssets impossible.";
  throw new Error(`${detail}\n${JSON.stringify(evaluation.exceptionDetails, null, 2)}`);
}
if (evaluation.result?.subtype === "error") {
  throw new Error(evaluation.result.description ?? "Compilation PCMAssets impossible.");
}

const compiledPakPath = evaluation.result?.value;
if (typeof compiledPakPath !== "string" || !compiledPakPath.endsWith(".pak")) {
  throw new Error("PCMAssets n'a pas renvoye le chemin du PAK compile.");
}
const packagePakPath = path.join(packageRoot, path.basename(compiledPakPath));
await copyFile(compiledPakPath, packagePakPath);
const packagePak = await readFile(packagePakPath);
const pakSha256 = createHash("sha256").update(packagePak).digest("hex");
const pakBytes = (await stat(packagePakPath)).size;

const manifestPath = path.join(packageRoot, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.graphics = {
  ...manifest.graphics,
  pakFile: path.basename(packagePakPath),
  pakSha256,
  pakBytes,
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const validationPath = path.join(packageRoot, "validation.json");
const validation = JSON.parse(await readFile(validationPath, "utf8"));
validation.graphics = {
  ...validation.graphics,
  pakFile: path.basename(packagePakPath),
  pakSha256,
  pakBytes,
};
await writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  compiled: true,
  packageId: changesDocument.packageId,
  changes: changesDocument.changes.length,
  gameDirectory,
  packageRoot,
  donorModDirectory,
  result: compiledPakPath,
  packagePakPath,
  pakSha256,
  pakBytes,
}, null, 2));
