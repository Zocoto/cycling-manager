import { describe, expect, it } from "vitest";

import { isYouthScoutingMissionArchived } from "@/lib/game/youth-scouting-history";

describe("isYouthScoutingMissionArchived", () => {
  it("conserve un rapport non consulté dans les rapports récents", () => {
    expect(
      isYouthScoutingMissionArchived({ status: "completed", viewedAt: null }),
    ).toBe(false);
  });

  it("archive un rapport dès qu’il est marqué comme consulté", () => {
    expect(
      isYouthScoutingMissionArchived({
        status: "completed",
        viewedAt: "2026-07-29T12:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("archive aussi les rapports consultés avant ce changement", () => {
    expect(
      isYouthScoutingMissionArchived({
        status: "completed",
        viewedAt: "2026-07-01T12:00:00.000Z",
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
        },
      ),
    ).toBe(false);
  });
});
