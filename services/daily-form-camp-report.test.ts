import { describe, expect, it, vi } from "vitest";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDailyFormCampReport } from "./daily-form-camp-report";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function client(data: unknown, error: { message: string } | null = null) {
  const abortSignal = vi.fn().mockResolvedValue({ data, error });
  const rpc = vi.fn(() => ({ abortSignal }));
  return { supabase: { rpc } as unknown as ServerClient, rpc, abortSignal };
}

describe("form-camp report service", () => {
  it("makes one bounded authenticated RPC and never accepts a team or rider identity", async () => {
    const mock = client({ teamName: "Test", seasonName: "S4", dayNumber: 4, currentDayNumber: 5,
      calendarDate: "2026-10-12", riders: [] });
    expect(await getDailyFormCampReport(mock.supabase, "4")).toMatchObject({ riderCount: 0 });
    expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("get_current_team_daily_form_camp_report", { p_day_number: 4 });
    expect(mock.abortSignal).toHaveBeenCalledExactlyOnceWith(expect.any(AbortSignal));
  });

  it("lets the RPC choose the latest completed day for invalid query strings", async () => {
    const mock = client(null);
    expect(await getDailyFormCampReport(mock.supabase, "4anything")).toBeNull();
    expect(mock.rpc).toHaveBeenCalledWith("get_current_team_daily_form_camp_report", { p_day_number: null });
  });

  it("returns no report when the current user has no team or the payload is invalid", async () => {
    expect(await getDailyFormCampReport(client(null).supabase)).toBeNull();
    expect(await getDailyFormCampReport(client({ riders: [] }).supabase)).toBeNull();
  });

  it("surfaces query failure without treating it as a successfully settled empty day", async () => {
    await expect(getDailyFormCampReport(client(null, { message: "Unavailable" }).supabase))
      .rejects.toThrow("Impossible de charger le rapport des stages de forme : Unavailable");
  });
});
