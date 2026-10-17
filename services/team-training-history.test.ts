import { describe, expect, it } from "vitest";
import { loadTeamTrainingHistory } from "./team-training-history";

type Row = { id: string; rider_id: string; season_id: string; is_contract_eligible: boolean; processed_at: string };
function fixture(rows: Row[], failAt = -1) {
  const requests: Array<{ filters: Record<string, unknown>; from: number; to: number; order: string[] }> = [];
  let inFlight = 0, peak = 0;
  return { requests, peak: () => peak, client: { from(table: string) {
    expect(table).toBe("rider_training_sessions");
    const filters: Record<string, unknown> = {};
    const order: string[] = [];
    let start = 0, end = 0;
    const builder = {
      select: () => builder,
      eq(key: string, value: unknown) { filters[key] = value; return builder; },
      in(key: string, values: string[]) { filters[key] = values; return builder; },
      order(key: string, options?: { ascending: boolean }) { order.push(`${key}:${options?.ascending === false ? "desc" : "asc"}`); return builder; },
      range(from: number, to: number) { start = from; end = to; return builder; },
      async returns() {
        const requestIndex = requests.length;
        requests.push({ filters, from: start, to: end, order });
        peak = Math.max(peak, ++inFlight);
        await Promise.resolve();
        inFlight--;
        if (requestIndex === failAt) return { data: null, error: { message: "statement timeout" } };
        return { error: null, data: rows.filter(row => row.season_id === filters.season_id
          && row.is_contract_eligible === filters.is_contract_eligible
          && (filters.rider_id as string[]).includes(row.rider_id))
          .sort((a, b) => a.rider_id.localeCompare(b.rider_id) || b.processed_at.localeCompare(a.processed_at) || b.id.localeCompare(a.id))
          .slice(start, end + 1) };
      },
    };
    return builder;
  } } as never };
}

describe("bounded training history", () => {
  it("loads more than 1,000 reports completely, in sequential bounded pages", async () => {
    const rows = Array.from({ length: 1_540 }, (_, i) => ({ id: String(i).padStart(5, "0"),
      rider_id: `r${Math.floor(i / 28)}`, season_id: "s4", is_contract_eligible: true,
      processed_at: "2026-10-17T06:00:00Z" }));
    const riderIds = [...new Set(rows.map(row => row.rider_id))];
    const test = fixture([...rows,
      { ...rows[0], id: "old-season", season_id: "s3" },
      { ...rows[0], id: "not-eligible", is_contract_eligible: false },
      { ...rows[0], id: "other-team", rider_id: "other" }]);
    const result = await loadTeamTrainingHistory(test.client, "s4", [...riderIds, riderIds[0]]);
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1540);
    expect(new Set(result.data.map(row => (row as unknown as Row).id)).size).toBe(1540);
    expect(test.peak()).toBe(1);
    expect(test.requests.length).toBeGreaterThan(3);
    for (const request of test.requests) {
      expect((request.filters.rider_id as string[]).length).toBeLessThanOrEqual(50);
      expect(request.to - request.from).toBe(499);
      expect(request.order).toEqual(["rider_id:asc", "processed_at:desc", "id:desc"]);
    }
  });
  it("does not query an empty roster", async () => {
    const test = fixture([]);
    expect(await loadTeamTrainingHistory(test.client, "s4", [])).toEqual({ data: [], error: null });
    expect(test.requests).toEqual([]);
  });
  it("never reports a truncated season as complete after a page fails", async () => {
    const rows = Array.from({ length: 600 }, (_, i) => ({ id: String(i), rider_id: "r1",
      season_id: "s4", is_contract_eligible: true, processed_at: "2026-10-17T06:00:00Z" }));
    const test = fixture(rows, 1);
    expect(await loadTeamTrainingHistory(test.client, "s4", ["r1"]))
      .toEqual({ data: [], error: { message: "statement timeout" } });
  });
});
