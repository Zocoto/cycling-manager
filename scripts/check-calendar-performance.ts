import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { collectPaginatedRows, collectChunkedPaginatedRows } from "../lib/supabase/pagination";

// Read-only HTTP check: exercise the real PostgREST 1,000-row limit, not a
// single oversized SQL aggregation. No account action or session is created.
config({ path: process.env.PERFORMANCE_ENV_FILE ?? ".env.local", quiet: true });
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing database configuration");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const counts = await supabase.rpc("get_active_calendar_engaged_counts").abortSignal(AbortSignal.timeout(10_000));
  if (counts.error) throw new Error(`Calendar count error: ${counts.error.code}`);
  const ids = (counts.data as { race_edition_id: string; engaged_rider_count: number }[])
    .filter((r) => r.engaged_rider_count > 0).sort((a,b) => b.engaged_rider_count-a.engaged_rider_count)
    .slice(0,20).map((r) => r.race_edition_id).sort();
  type Row = Record<string, unknown>;
  async function page(chunk: string[], from: number, to: number) {
    const result = await supabase.rpc("get_calendar_engaged_riders", { p_race_edition_ids: chunk }).range(from,to).abortSignal(AbortSignal.timeout(10_000));
    return { data: result.data as Row[] | null, error: result.error };
  }
  const start = performance.now();
  const original = await collectPaginatedRows({ fetchPage: (from,to) => page(ids,from,to) });
  const originalMs = Math.round(performance.now()-start);
  if (original.error) throw new Error(`Original startlist error: ${original.error.code}`);
  const chunkStart = performance.now();
  const chunked = await collectChunkedPaginatedRows({ values: ids, chunkSize: 10, maxConcurrency: 2, fetchPage: page });
  if (chunked.error) throw new Error(`Chunked startlist error: ${chunked.error.code}`);
  function hash(rows: Row[]) {
    return createHash("sha256").update(rows.map((row) => JSON.stringify(row)).sort().join("\n")).digest("hex");
  }
  if (original.data.length<=1000 || hash(original.data)!==hash(chunked.data)) throw new Error("Incomplete or mismatched startlist data");
  console.log(JSON.stringify({ editions: ids.length, rows: original.data.length, exactMatch: true, originalMs, chunkedMs: Math.round(performance.now()-chunkStart) }));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Calendar check failed"); process.exitCode=1; });
