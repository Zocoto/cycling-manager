import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { createFinalCycloStickersSourceFixture } from "./cyclo-stickers-final-snapshot.fixture";
import { serializeCycloStickersSnapshot } from "./cyclo-stickers-final-snapshot";

it("prepares and seals only completed reviewed rows, preserves the source and refuses overwrite/tampering", () => {
  const directory = mkdtempSync(join(tmpdir(), "cyclo-stickers-cli-"));
  const run = (script: string, input: string, output: string) => execFileSync(process.execPath, [resolve("node_modules/tsx/dist/cli.mjs"), resolve("scripts", script), input, output], { encoding: "utf8", stdio: "pipe", timeout: 15_000 });
  try {
    const source = createFinalCycloStickersSourceFixture();
    source.season.startsOn = "2020-01-01";
    source.season.endsOn = "2020-01-28";
    source.capturedAt = "2020-01-29T00:05:00.000Z";
    const input = join(directory, "source.json");
    const candidate = join(directory, "candidate.json");
    const output = join(directory, "sealed.json");
    const sourceText = JSON.stringify(source);
    writeFileSync(input, sourceText);
    expect(JSON.parse(run("prepare-cyclo-stickers-s4.ts", input, candidate)).sealed).toBe(false);
    expect(JSON.parse(run("seal-cyclo-stickers-s4.ts", candidate, output)).sealed).toBe(true);
    const manifest = JSON.parse(readFileSync(output, "utf8"));
    expect(manifest.snapshot.cards).toHaveLength(69);
    expect(manifest.sha256).toBe(createHash("sha256").update(serializeCycloStickersSnapshot(manifest.snapshot)).digest("hex"));
    expect(readFileSync(input, "utf8")).toBe(sourceText);
    const sealedText = readFileSync(output, "utf8");
    expect(() => run("seal-cyclo-stickers-s4.ts", candidate, output)).toThrow();
    expect(readFileSync(output, "utf8")).toBe(sealedText);
    manifest.snapshot.cards[0].ratings.mountain = 99;
    writeFileSync(candidate, JSON.stringify({ sourceSeasonStatus: "completed", snapshot: manifest.snapshot }));
    expect(() => run("seal-cyclo-stickers-s4.ts", candidate, join(directory, "forged.json"))).toThrow();
    writeFileSync(input, JSON.stringify({ ...source, season: { ...source.season, status: "active" } }));
    expect(() => run("prepare-cyclo-stickers-s4.ts", input, join(directory, "active.json"))).toThrow();
  } finally {
    if (resolve(directory).startsWith(`${resolve(tmpdir())}\\cyclo-stickers-cli-`)) rmSync(directory, { recursive: true, force: true });
  }
}, 60_000);
