import { describe, expect, it } from "vitest";

import { isYouthScoutingMissionArchived } from "@/lib/game/youth-scouting-history";

describe("isYouthScoutingMissionArchived", () => {
  it("conserve un rapport non consulté dans les rapports récents", () => {
    expect(
      isYouthScoutingMissionArchived({ status: "completed", viewedAt: null, candidates: [] }),
    ).toBe(false);
  });

  it("archive un rapport déjà consulté même avec des profils sans décision", () => {
    expect(
      isYouthScoutingMissionArchived({
        status: "completed",
        viewedAt: "2026-07-29T12:00:00.000Z",
        candidates: [{ status: "signed" }, { status: "spotted" }],
      }),
    ).toBe(true);
  });

  it("conserve dans l’historique un ancien rapport vide déjà consulté", () => {
    expect(
      isYouthScoutingMissionArchived({
        status: "completed",
        viewedAt: "2026-07-01T12:00:00.000Z",
        candidates: [],
      }),
    ).toBe(true);
  });

  it("archive immédiatement un rapport dont tous les jeunes sont recrutés", () => {
    expect(
      isYouthScoutingMissionArchived(
        {
          status: "completed",
          viewedAt: null,
          candidates: [
            { status: "signed" },
            { status: "signed" },
          ],
        },
      ),
    ).toBe(true);
  });

  it("n’archive pas immédiatement un rapport partiellement recruté", () => {
    expect(
      isYouthScoutingMissionArchived(
        {
          status: "completed",
          viewedAt: null,
          candidates: [
            { status: "signed" },
            { status: "spotted" },
          ],
        },
      ),
    ).toBe(false);
  });

  it.each([
    [{ status: "signed" }, { status: "rejected" }],
    [{ status: "rejected" }, { status: "rejected" }],
  ] as const)("archive un rapport lorsque chaque profil a une décision", (...candidates) => {
    expect(
      isYouthScoutingMissionArchived({ status: "completed", viewedAt: null, candidates }),
    ).toBe(true);
  });

  it("laisse traiter les profils devenus indisponibles", () => {
    expect(
      isYouthScoutingMissionArchived({
        status: "completed",
        viewedAt: null,
        candidates: [{ status: "expired" }, { status: "rejected" }],
      }),
    ).toBe(false);
  });

  it("ne considère pas un rapport vide comme entièrement recruté", () => {
    expect(
      isYouthScoutingMissionArchived(
        {
          status: "completed",
          viewedAt: null,
          candidates: [],
        },
      ),
    ).toBe(false);
  });

  it("n’archive pas une mission active même si tous ses jeunes sont recrutés", () => {
    expect(
      isYouthScoutingMissionArchived(
        {
          status: "active",
          viewedAt: null,
          candidates: [{ status: "signed" }],
        },
      ),
    ).toBe(false);
  });

  it("n’archive jamais une mission qui n’est pas terminée", () => {
    expect(
      isYouthScoutingMissionArchived(
        {
          status: "active",
          viewedAt: "2026-07-01T12:00:00.000Z",
          candidates: [],
        },
      ),
    ).toBe(false);
  });
});
