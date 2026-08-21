import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { collectChunkedPaginatedRows } from "@/lib/supabase/pagination";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("championship title query resilience", () => {
  it("splits a season-wide rider lookup into bounded PostgREST requests", async () => {
    const riderIds = Array.from({ length: 205 }, (_, index) =>
      `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    );
    const requestedChunks: string[][] = [];

    const result = await collectChunkedPaginatedRows<
      { riderId: string },
      { message: string },
      string
    >({
      values: riderIds,
      fetchPage: async (chunk) => {
        requestedChunks.push(chunk);
        return {
          data: chunk.map((riderId) => ({ riderId })),
          error: null,
        };
      },
    });

    expect(requestedChunks.map((chunk) => chunk.length)).toEqual([
      100,
      100,
      5,
    ]);
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(205);
  });

  it("uses chunked and paginated queries for every championship jersey type", () => {
    const continentalSource = readSource(
      "services/rider-continental-championship-titles.ts",
    );
    const nationalSource = readSource(
      "services/rider-national-championship-titles.ts",
    );

    expect(
      continentalSource.match(/collectChunkedPaginatedRows</g),
    ).toHaveLength(1);
    expect(continentalSource).toContain('values: uniqueRiderIds');
    expect(continentalSource).toContain('.in("rider_id", riderIdChunk)');
    expect(continentalSource).toContain('.range(from, to)');
    expect(continentalSource).not.toContain(
      '.in("rider_id", uniqueRiderIds)',
    );

    expect(nationalSource.match(/collectChunkedPaginatedRows</g)).toHaveLength(
      2,
    );
    expect(nationalSource.match(/values: uniqueRiderIds/g)).toHaveLength(2);
    expect(
      nationalSource.match(/\.in\("rider_id", riderIdChunk\)/g),
    ).toHaveLength(2);
    expect(nationalSource.match(/\.range\(from, to\)/g)).toHaveLength(2);
    expect(nationalSource).not.toContain(
      '.in("rider_id", uniqueRiderIds)',
    );
  });

  it("keeps cosmetic jersey failures isolated from calendar registration", () => {
    const raceCalendarSource = readSource("services/race-calendar.ts");

    expect(raceCalendarSource).toContain(
      "Impossible de charger les maillots de champions nationaux du calendrier",
    );
    expect(raceCalendarSource).toContain(
      "Impossible de charger les maillots de champions du monde du calendrier",
    );
    expect(raceCalendarSource).toContain(
      "Impossible de charger les maillots de champions continentaux du calendrier",
    );
    expect(raceCalendarSource.match(/\.catch\(\(error: unknown\) =>/g)).toHaveLength(
      3,
    );
  });
});
