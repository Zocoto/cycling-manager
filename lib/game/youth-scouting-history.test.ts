import { describe, expect, it } from "vitest";

import {
  YOUTH_SCOUTING_REPORT_ARCHIVE_DELAY_MS,
  isYouthScoutingMissionArchived,
} from "@/lib/game/youth-scouting-history";

const NOW = new Date("2026-07-29T12:00:00.000Z");

describe("isYouthScoutingMissionArchived", () => {
  it("conserve un rapport non consulté dans les rapports récents", () => {
    expect(
      isYouthScoutingMissionArchived(
        { status: "completed", viewedAt: null },
        NOW,
      ),
    ).toBe(false);
  });

  it("conserve un rapport consulté depuis moins de trois jours", () => {
    expect(
      isYouthScoutingMissionArchived(
        {
          status: "completed",
          viewedAt: new Date(
            NOW.getTime() - YOUTH_SCOUTING_REPORT_ARCHIVE_DELAY_MS + 1,
          ).toISOString(),
        },
        NOW,
      ),
    ).toBe(false);
  });

  it("archive un rapport exactement trois jours après sa consultation", () => {
    expect(
      isYouthScoutingMissionArchived(
        {
          status: "completed",
          viewedAt: new Date(
            NOW.getTime() - YOUTH_SCOUTING_REPORT_ARCHIVE_DELAY_MS,
          ).toISOString(),
        },
        NOW,
      ),
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
        NOW,
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
        NOW,
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
        NOW,
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
        NOW,
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
        NOW,
      ),
    ).toBe(false);
  });
});
