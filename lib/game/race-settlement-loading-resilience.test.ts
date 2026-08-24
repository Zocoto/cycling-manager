import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("race settlement calendar loading", () => {
  const calendarService = readSource("services/race-calendar.ts");
  const migration = readSource(
    "supabase/migrations/20260824070000_optimize_targeted_race_settlement_loading.sql",
  );

  it("passes large UUID lists through RPC bodies instead of URL filters", () => {
    expect(calendarService).toContain(
      'admin.rpc("get_race_calendar_rider_context", {',
    );
    expect(calendarService).toContain("p_rider_ids: riderIdChunk");
    expect(calendarService).toContain(
      '.rpc("get_calendar_engaged_riders", {',
    );
    expect(migration).toContain(
      "public.get_race_calendar_rider_context(uuid[])",
    );
    expect(migration).toContain("p_race_edition_ids uuid[]");
    expect(migration).toContain("edition.id = any(");
  });

  it("keeps a URL-safe fallback during rolling deployments", () => {
    expect(calendarService).toContain(
      "const URL_SAFE_UUID_FILTER_CHUNK_SIZE = 40",
    );
    expect(calendarService).toContain(
      "chunkSize: URL_SAFE_UUID_FILTER_CHUNK_SIZE",
    );
    expect(calendarService).toContain(
      "get_active_calendar_engaged_riders",
    );
  });

  it("bounds compact context requests without PostgREST pagination replay", () => {
    expect(calendarService).toContain(
      "const RIDER_CONTEXT_RPC_CHUNK_SIZE = 500",
    );
    expect(calendarService).toContain(
      "const RIDER_CONTEXT_RPC_CONCURRENCY = 4",
    );
    expect(calendarService).toContain(
      "for (const requestBatch of chunkValues(",
    );
  });

  it("keeps rider context private to the backend", () => {
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
