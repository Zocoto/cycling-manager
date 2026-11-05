/** Genuine S4 preview, separated from the completed-only public edition. No network access. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildCycloStickersS4CompletedQueries } from "./export-cyclo-stickers-s4";
import { assemblePreparedCycloStickersS4Snapshot, type CycloStickersS4IdentityStage } from "../lib/game/cyclo-stickers-source";

async function main() {
  const [mode, input, output] = process.argv.slice(2);
  if (mode === "sql" && input && !output) {
    await mkdir(resolve(input), { recursive: false });
    const queries = buildCycloStickersS4CompletedQueries();
    for (const [name, query] of Object.entries(queries)) {
      const preview = query.replaceAll("game_year=4 and status='completed'", "game_year=4 and status='active'");
      await writeFile(resolve(input, name), preview, { flag: "wx" });
    }
    console.log(JSON.stringify({ executed: false, queries: Object.keys(queries).length, sourceSeason: 4, provisional: true }));
    return;
  }
  if (mode === "assemble" && input && output) {
    const stage = JSON.parse(await readFile(resolve("data/collector-album-s4-identity-stage.json"), "utf8")) as CycloStickersS4IdentityStage;
    const files = { context: "01-context", ranking: "02-ranking", teams: "03-teams", championships: "04-championships", ratings: "05-ratings", honours: "06-honours", contracts: "07-contracts", naturalizations: "08-naturalizations", bonusRanking: "09-bonus-ranking" };
    const facts: Record<string, unknown> = {};
    for (const [key, name] of Object.entries(files)) {
      const raw = await readFile(resolve(input, `${name}.json`), "utf8");
      if (raw.length > 2_000_000) throw Error("Preview source exceeds bounded size");
      const parsed = JSON.parse(raw);
      facts[key] = Array.isArray(parsed) ? parsed : parsed.rows;
    }
    const snapshot = assemblePreparedCycloStickersS4Snapshot(stage, facts);
    await writeFile(resolve(output), `${JSON.stringify(snapshot, null, 2)}\n`, { flag: "wx" });
    console.log(JSON.stringify({ sourceSeason: snapshot.sourceSeason, sourceStatus: snapshot.sourceSeasonStatus, cards: snapshot.cards.length, capturedAt: snapshot.capturedAt }));
    return;
  }
  throw Error("Usage: prepare-cyclo-stickers-s4-preview.ts sql <new-directory> | assemble <source-directory> <new-snapshot.json>");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Preview preparation failed"); process.exitCode = 1; });
