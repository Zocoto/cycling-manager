import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveConcreteTutorialRoute } from "@/lib/tutorial/routes";
import type { TutorialProgressRow, TutorialSessionRow } from "@/types/tutorial";

const mocks = vi.hoisted(() => ({
  state: vi.fn(), client: vi.fn(), progress: vi.fn(), session: vi.fn(), identity: vi.fn(),
}));
vi.mock("@/lib/tutorial/onboarding-state", () => ({ getAuthenticatedTutorialOnboardingState: mocks.state }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/lib/tutorial/progress", () => ({
  getAuthenticatedTutorialProgress: mocks.progress,
  getActiveTutorialSession: mocks.session,
  requireAuthenticatedSportingDirectorId: mocks.identity,
}));

import { setTutorialStepAction, startTutorialAction } from "./tutorial-actions";

function fixture({
  key = "roster-management",
  status = "completed",
  historicalRoute = "/jeu/coureurs/[identifiant]",
}: {
  key?: string;
  status?: TutorialProgressRow["status"];
  historicalRoute?: string;
} = {}) {
  const timestamp = "2026-10-27T17:00:36.867Z";
  const progress: TutorialProgressRow = {
    id: "progress", sporting_director_id: "director", tutorial_key: key,
    tutorial_type: "contextual", tutorial_version: 1, status,
    current_step_key: "complete", current_route: historicalRoute,
    started_at: timestamp, completed_at: status === "completed" ? timestamp : null,
    skipped_at: status === "skipped" ? timestamp : null,
    metadata: {}, created_at: timestamp, updated_at: timestamp,
  };
  const session: TutorialSessionRow = {
    id: "session", tutorial_progress_id: progress.id, tutorial_version: 1,
    launch_source: "replay", status: "in_progress", first_step_key: "roster-overview",
    last_step_key: "roster-overview", started_at: timestamp, ended_at: null,
    metadata: {}, created_at: timestamp, updated_at: timestamp,
  };
  const writes: { table: string; data: Record<string, unknown> }[] = [];
  const client = {
    from: vi.fn((table: string) => {
      let payload: Record<string, unknown> = {};
      const q = {
        update: vi.fn((data: Record<string, unknown>) => { payload = data; writes.push({ table, data }); return q; }),
        eq: vi.fn(), select: vi.fn(), abortSignal: vi.fn(), maybeSingle: vi.fn(),
        single: vi.fn(async () => ({ data: { ...(table === "tutorial_progress" ? progress : session), ...payload }, error: null })),
      };
      q.eq.mockReturnValue(q); q.select.mockReturnValue(q); q.abortSignal.mockReturnValue(q); q.maybeSingle.mockImplementation(q.single); return q;
    }),
    rpc: vi.fn((name: string) => ({ abortSignal: vi.fn().mockResolvedValue({ data: name === "get_current_team_roster" ? [{ rider_id: "current-rider" }] : null, error: null }) })),
  };
  mocks.state.mockResolvedValue({ profileComplete: true, teamCreated: true, riderCount: 33 });
  mocks.progress.mockResolvedValue(progress); mocks.session.mockResolvedValue(session);
  mocks.identity.mockResolvedValue("director"); mocks.client.mockResolvedValue(client);
  return { progress, session, client, writes };
}

beforeEach(() => vi.resetAllMocks());

describe("completed tutorial replay navigation", () => {
  it("returns the partner page while retaining the completed equipment history", async () => {
    const f = fixture({ key: "equipment", historicalRoute: "/jeu/inventaire?categorie=equipment" });
    const result = await setTutorialStepAction({ tutorialKey: "equipment", stepKey: "equipment-partner-overview", route: "/jeu/materiel/equipementier" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resolvedRoute).toBe("/jeu/materiel/equipementier");
    expect(result.progress).toEqual(f.progress);
    expect(result.currentStepKey).toBe("equipment-partner-overview");
    expect(result.session?.last_step_key).toBe("equipment-partner-overview");
    expect(resolveConcreteTutorialRoute({ routePattern: "/jeu/materiel/equipementier", candidates: [result.resolvedRoute] })).toBe("/jeu/materiel/equipementier");
    expect(f.writes.map(w => w.table)).toEqual(["tutorial_sessions"]);
    expect(f.client.rpc).not.toHaveBeenCalled();
  });

  it("opens the chosen rider instead of sending the literal historical placeholder", async () => {
    const f = fixture();
    const result = await setTutorialStepAction({ tutorialKey: "roster-management", stepKey: "rider-overview", route: "/jeu/coureurs/chosen-rider" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resolvedRoute).toBe("/jeu/coureurs/chosen-rider");
    expect(result.progress).toEqual(f.progress);
    expect(resolveConcreteTutorialRoute({ routePattern: "/jeu/coureurs/[identifiant]", candidates: [result.resolvedRoute] })).toBe("/jeu/coureurs/chosen-rider");
    expect(f.writes.map(w => w.table)).toEqual(["tutorial_sessions"]);
    expect(f.client.rpc).not.toHaveBeenCalled();
  });

  it("returns to the roster on Previous without following the old finishing page", async () => {
    fixture();
    const result = await setTutorialStepAction({ tutorialKey: "roster-management", stepKey: "roster-contracts", route: "/jeu/effectif" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.resolvedRoute).toBe("/jeu/effectif");
  });

  it("starts a replay on the first page without resetting the completion", async () => {
    const f = fixture();
    const result = await startTutorialAction({ tutorialKey: "roster-management", launchSource: "replay", restartFromBeginning: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.currentStepKey).toBe("roster-overview");
    expect(result.resolvedRoute).toBe("/jeu/effectif");
    expect(result.progress).toEqual(f.progress);
    expect(f.writes).toEqual([]); // The already-selected active cursor needs no write.
    expect(f.client.rpc).not.toHaveBeenCalled();
  });

  it("also returns the server-resolved route when recovering a stale rider placeholder", async () => {
    const f = fixture();
    const result = await setTutorialStepAction({ tutorialKey: "roster-management", stepKey: "rider-overview", route: "/jeu/coureurs/[identifiant]" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resolvedRoute).toBe("/jeu/coureurs/current-rider");
    expect(result.progress).toEqual(f.progress);
    expect(f.client.rpc).toHaveBeenCalledExactlyOnceWith("get_current_team_roster");
  });

  it("preserves skipped status during manual discovery", async () => {
    const f = fixture({ status: "skipped" });
    const result = await setTutorialStepAction({ tutorialKey: "roster-management", stepKey: "rider-overview", route: "/jeu/coureurs/chosen-rider" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resolvedRoute).toBe("/jeu/coureurs/chosen-rider");
    expect(result.progress).toEqual(f.progress);
    expect(f.writes.map(w => w.table)).toEqual(["tutorial_sessions"]);
  });

  it("keeps saving the route and cursor for a genuinely unfinished tutorial", async () => {
    const f = fixture({ status: "in_progress" });
    const result = await setTutorialStepAction({ tutorialKey: "roster-management", stepKey: "rider-overview", route: "/jeu/coureurs/chosen-rider" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resolvedRoute).toBe("/jeu/coureurs/chosen-rider");
    expect(result.progress.current_route).toBe(result.resolvedRoute);
    expect(result.progress.current_step_key).toBe("rider-overview");
    expect(f.writes.map(w => w.table)).toEqual(["tutorial_progress", "tutorial_sessions"]);
    expect(f.client.rpc).not.toHaveBeenCalled();
  });

  it("rejects a mismatched section before writing session state", async () => {
    const f = fixture();
    const result = await setTutorialStepAction({ tutorialKey: "roster-management", stepKey: "rider-overview", route: "/jeu/transferts" });
    expect(result.ok).toBe(false);
    expect(f.writes).toEqual([]);
  });
});
