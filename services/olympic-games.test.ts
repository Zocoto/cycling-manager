import {beforeEach, describe, expect, it, vi} from "vitest";

const db = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  calls: [] as string[],
}));
vi.mock("@/lib/supabase/admin", () => ({createSupabaseAdminClient: () => ({
  from(table: string) {
    db.calls.push(table);
    let rows = db.tables[table] ?? [];
    const query = {
      select() { return query; },
      eq(column: string, value: unknown) { rows = rows.filter(row => row[column] === value); return query; },
      in(column: string, values: unknown[]) { rows = rows.filter(row => values.includes(row[column])); return query; },
      async maybeSingle() { return {data: rows[0] ?? null, error: null}; },
      async returns() { return {data: rows, error: null}; },
    };
    return query;
  },
  async rpc(name: string) { db.calls.push(name); return {data: [{country_id:"fr",rider_quota:name.includes("time_trial") ? 2 : 8}],error:null}; },
})}));
import {getOlympicOverview} from "./olympic-games";

beforeEach(() => {
  db.calls = [];
  db.tables = {
    national_federation_olympic_events: [{season_id:"s4",race_edition_id:"road",time_trial_race_edition_id:"itt",qualification_frozen_at:"frozen"}],
    race_editions: [{id:"road",race_id:"road-race",status:"registration_open"},{id:"itt",race_id:"itt-race",status:"completed"}],
    races: [{id:"road-race",slug:"preserved-road-url"},{id:"itt-race",slug:"jeux-quadriennaux-clm"}],
  };
});
describe("Olympic programme reads", () => {
  it("returns both disciplines in time order with separate standings and batched queries", async () => {
    const result = await getOlympicOverview("s4");
    expect(result.events).toMatchObject([
      {id:"nc-time-trial",hrefSlug:"jeux-quadriennaux-clm",profileType:"time_trial",status:"completed"},
      {id:"nc-hills",hrefSlug:"preserved-road-url",profileType:"mixed"},
    ]);
    expect(result.olympics.nations[0].rider_quota).toBe(8);
    expect(result.olympics.timeTrialNations?.[0].rider_quota).toBe(2);
    expect(db.calls.filter(call => call === "race_editions")).toHaveLength(1);
    expect(db.calls.filter(call => call === "races")).toHaveLength(1);
  });
  it("does not fabricate events before programme creation", async () => {
    db.tables.national_federation_olympic_events = [];
    expect((await getOlympicOverview("s4")).events).toEqual([]);
    expect(db.calls).not.toContain("race_editions");
  });
  it("fails explicitly if an edition is missing instead of linking to the wrong race", async () => {
    db.tables.race_editions = db.tables.race_editions.filter(row => row.id !== "itt");
    await expect(getOlympicOverview("s4")).rejects.toThrow("incomplet");
  });
});
