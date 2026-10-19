import { describe, expect, it } from "vitest";

import {
  getViewerRiderIdsByEdition,
  resolveRaceViewerTeamId,
} from "@/lib/game/race-viewer-riders";

const viewerTeamId = "15000000-0000-4000-8000-000000000001";
const otherTeamId = "15000000-0000-4000-8000-000000000002";
const editionId = "25000000-0000-4000-8000-000000000001";
const secondEditionId = "25000000-0000-4000-8000-000000000002";
const riderId = "35000000-0000-4000-8000-000000000001";
const otherRiderId = "35000000-0000-4000-8000-000000000002";

function row(
  rider = riderId,
  team = viewerTeamId,
  edition = editionId,
) {
  return { race_edition_id: edition, rider_id: rider, team_id: team };
}

describe("resolveRaceViewerTeamId", () => {
  it("accepts an identity already loaded by the header", async () => {
    await expect(resolveRaceViewerTeamId(viewerTeamId)).resolves.toBe(viewerTeamId);
  });

  it("accepts a concurrently loading header without delaying the caller", async () => {
    let resolveHeader!: (teamId: string) => void;
    const header = new Promise<string>((resolve) => { resolveHeader = resolve; });
    const identity = resolveRaceViewerTeamId(header);
    resolveHeader(viewerTeamId);

    await expect(identity).resolves.toBe(viewerTeamId);
  });

  it.each([null, undefined])("does not invent an absent identity (%s)", async (teamId) => {
    await expect(resolveRaceViewerTeamId(teamId)).resolves.toBeNull();
  });

  it("immediately handles a failed header and disables only view personalization", async () => {
    const header = Promise.reject<string>(new Error("Header unavailable"));
    const identity = resolveRaceViewerTeamId(header);
    // Independent calendar work can continue before this optional value is read.
    await new Promise((resolve) => setTimeout(resolve, 0));

    await expect(identity).resolves.toBeNull();
  });
});

describe("getViewerRiderIdsByEdition", () => {
  it("matches the club UUID, never rider or team display names", () => {
    const rows = [
      { ...row(), team_name: "Same team name", rider_name: "Same rider name" },
      {
        ...row(otherRiderId, otherTeamId),
        team_name: "Same team name",
        rider_name: "Same rider name",
      },
    ];

    expect(getViewerRiderIdsByEdition(rows, viewerTeamId)).toEqual(
      new Map([[editionId, [riderId]]]),
    );
    expect(getViewerRiderIdsByEdition(rows, "Same team name").size).toBe(0);
  });

  it("uses active club contracts instead of federation registration or country IDs", () => {
    const nationalCountryId = "45000000-0000-4000-8000-000000000001";
    const registrationId = "55000000-0000-4000-8000-000000000001";
    const rows = [
      { ...row(riderId, registrationId), country_id: nationalCountryId },
      { ...row(otherRiderId, registrationId), country_id: nationalCountryId },
    ];
    const ownership = { editionIds: new Set([editionId]), riderIds: new Set([riderId]) };

    expect(getViewerRiderIdsByEdition(rows, viewerTeamId, ownership).get(editionId)).toEqual([
      riderId,
    ]);
    expect(getViewerRiderIdsByEdition(rows, viewerTeamId, {
      ...ownership, riderIds: new Set(),
    }).size).toBe(0);
    expect(getViewerRiderIdsByEdition(rows, registrationId, {
      ...ownership, riderIds: new Set(),
    }).size).toBe(0);
    expect(getViewerRiderIdsByEdition(rows, nationalCountryId, {
      ...ownership, riderIds: new Set(),
    }).size).toBe(0);
  });

  it.each([null, undefined, ""])("does not infer a team without an identity (%s)", (teamId) => {
    expect(getViewerRiderIdsByEdition([row()], teamId).size).toBe(0);
  });

  it("deduplicates in source order, independently for each edition", () => {
    expect(
      getViewerRiderIdsByEdition(
        [row(otherRiderId), row(), row(otherRiderId), row(riderId, viewerTeamId, secondEditionId)],
        viewerTeamId,
      ),
    ).toEqual(
      new Map([
        [editionId, [otherRiderId, riderId]],
        [secondEditionId, [riderId]],
      ]),
    );
  });

  it("does not mark ambiguous club ownership as belonging to the viewer", () => {
    expect(
      getViewerRiderIdsByEdition(
        [row(), row(riderId, otherTeamId), row(), row(otherRiderId)],
        viewerTeamId,
      ),
    ).toEqual(new Map([[editionId, [otherRiderId]]]));
  });

  it("ignores incomplete identities and leaves the source startlist untouched", () => {
    const rows = Object.freeze([
      Object.freeze(row()),
      Object.freeze(row("", viewerTeamId)),
      Object.freeze(row(otherRiderId, "")),
      Object.freeze(row(otherRiderId, viewerTeamId, "")),
    ]);
    const original = structuredClone(rows);
    const result = getViewerRiderIdsByEdition(rows, viewerTeamId);
    result.get(editionId)?.push("view-only-extra");

    expect(rows).toEqual(original);
    expect(getViewerRiderIdsByEdition(rows, viewerTeamId).get(editionId)).toEqual([
      riderId,
    ]);
  });
});
