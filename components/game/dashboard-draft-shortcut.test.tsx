import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDraftFixture } from "@/test/fixtures/season-draft";
import type { DashboardFastSummary } from "@/services/dashboard-fast-summary";

const mocks = vi.hoisted(() => ({ client: vi.fn(), view: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/services/season-draft", () => ({ getSeasonDraftView: mocks.view }));

import { DashboardDraftShortcut } from "./dashboard-draft-shortcut";

describe("annonce de draft du bureau", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.client.mockResolvedValue({});
    mocks.view.mockResolvedValue(createDraftFixture());
  });

  it.each([2, 7, 28])("ne charge pas la draft à J%s", async (seasonDayNumber) => {
    const result = await DashboardDraftShortcut({ summaryPromise: Promise.resolve({ seasonDayNumber } as DashboardFastSummary) });
    expect(result).toBeNull();
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.view).not.toHaveBeenCalled();
  });

  it("affiche l’annonce de la draft pendant J1", async () => {
    const result = await DashboardDraftShortcut({ summaryPromise: Promise.resolve({ seasonDayNumber: 1 } as DashboardFastSummary) });
    expect(result).not.toBeNull();
    expect(mocks.view).toHaveBeenCalledOnce();
  });

  it("masque une draft encore en cours après minuit malgré un résumé J1 périmé", async () => {
    const view = createDraftFixture();
    view.serverNow = "2026-11-07T00:00:00+01:00";
    view.edition!.status = "running";
    mocks.view.mockResolvedValue(view);
    const result = await DashboardDraftShortcut({ summaryPromise: Promise.resolve({ seasonDayNumber: 1 } as DashboardFastSummary) });
    expect(result).toBeNull();
  });
});
