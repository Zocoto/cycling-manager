import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const packageRoot = path.resolve(
  process.argv[2] ?? "C:/Dev/pcm26-bridge-lab/Cyclostratege-PCMAssets-Mod",
);
const gameDirectory = path.resolve(
  process.argv[3] ?? "C:/Program Files (x86)/Steam/steamapps/common/Pro Cycling Manager 2026",
);
const outputRoot = path.join(packageRoot, ".validation-roundtrip");
const teams = [
  ["mov", "ADL"], ["dct", "ARO"], ["gfc", "AUL"], ["soq", "LIL"],
  ["apt", "KRI"], ["uex", "VNA"], ["tvl", "YUK"], ["jay", "ARL"],
  ["ten", "JBF"], ["nci", "KAF"], ["efe", "LIM"], ["tbv", "MTH"],
  ["xat", "OKA"], ["ltk", "PKC"], ["tpp", "CCR"], ["pqt", "SCA"],
  ["loi", "TNP"],
  ["map", "KHG"], ["rbh", "TEO"], ["cof", "STK"],
  ["cjr", "PMF"], ["tca", "COV"],
  ["igd", "GLD"], ["dft", "DBF"], ["nsn", "IDM"], ["vbg", "UJM"],
];

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

await mkdir(outputRoot, { recursive: true });
const outputs = [];
for (const [abbreviation, sourceCode] of teams) {
  for (const piece of ["maillot", "minimaillot"]) {
    const expression = `window.__TAURI_INTERNALS__.invoke("read_base_piece", ${JSON.stringify({
      gameDir: gameDirectory,
      abbreviation,
      name: piece,
      modDir: packageRoot,
    })})`;
    const evaluation = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (evaluation.exceptionDetails || evaluation.result?.subtype === "error") {
      throw new Error(`Lecture impossible pour ${abbreviation}_${piece}.`);
    }
    const dataUrl = evaluation.result?.value;
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/png;base64,")) {
      throw new Error(`Résultat inattendu pour ${abbreviation}_${piece}.`);
    }
    const outputPath = path.join(outputRoot, `${abbreviation}_${piece}.png`);
    const buffer = Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64");
    await writeFile(outputPath, buffer);
    outputs.push({ abbreviation, sourceCode, piece, bytes: buffer.length });
  }
}
socket.close();
console.log(JSON.stringify({ outputRoot, files: outputs.length, outputs }, null, 2));
