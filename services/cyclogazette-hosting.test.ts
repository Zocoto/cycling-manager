import { describe, expect, it, vi } from "vitest";

import { loadCyclogazetteHostingStories } from "./cyclogazette-hosting";

const context = {
  gameYear: 5,
  dayNumber: 21,
  calendarDate: "2026-11-26",
  now: new Date("2026-11-26T19:01:00Z"),
};

function fixture(data: unknown[] = []) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    returns: vi.fn().mockResolvedValue({ data, error: null }),
  };
  const from = vi.fn().mockReturnValue(query);
  return { admin: { from } as unknown as Parameters<typeof loadCyclogazetteHostingStories>[0], from, query };
}

describe("Gazette hosting announcements", () => {
  it("does not query during the initial seasons or before the jury window", async () => {
    const { admin, from } = fixture();
    expect(await loadCyclogazetteHostingStories(admin, { ...context, gameYear: 4 })).toEqual([]);
    expect(await loadCyclogazetteHostingStories(admin, { ...context, dayNumber: 20 })).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it("announces only player hosts in a mixed jury result, in both languages", async () => {
    const { admin, from, query } = fixture([
      {
        target_game_year: 6,
        event_key: "continental_championship_pro:europe",
        event_type: "continental_championship_pro",
        continent_code: "europe",
        decision: "hosted",
        countries: { name: "Allemagne", iso_alpha2: "DE" },
        award: { candidacy: { submitter: { automation: null } } },
      },
      {
        target_game_year: 6,
        event_key: "world_championship_junior",
        event_type: "world_championship_junior",
        continent_code: null,
        decision: "neutral",
        countries: null,
        award: null,
      },
      {
        target_game_year: 6,
        event_key: "nations_cup_pro",
        event_type: "nations_cup_pro",
        continent_code: null,
        decision: "hosted",
        countries: { name: "Italie", iso_alpha2: "IT" },
        award: { candidacy: { submitter: { automation: { id: "bot" } } } },
      },
    ]);
    const stories = await loadCyclogazetteHostingStories(admin, context);
    expect(from).toHaveBeenCalledExactlyOnceWith("national_federation_hosting_decisions");
    expect(query.eq).toHaveBeenCalledWith("decision", "hosted");
    expect(query.eq).toHaveBeenCalledWith("gazette_date", "2026-11-26");
    expect(query.not).toHaveBeenCalledWith("award.candidacy.submitter.auth_user_id", "is", null);
    expect(query.gte).toHaveBeenCalledExactlyOnceWith("target_game_year", 6);
    expect(query.lte).toHaveBeenCalledWith("target_game_year", 6);
    expect(query.lte).toHaveBeenCalledWith("decided_at", context.now.toISOString());
    expect(query.limit).toHaveBeenCalledExactlyOnceWith(26);
    expect(stories).toEqual([expect.objectContaining({
      id: "federation-hosting:6:2026-11-26",
      kind: "federation_hosting",
      hostingDecisions: [
        {
          eventKey: "continental_championship_pro:europe",
          eventName: "Championnats continentaux professionnels · Europe",
          eventNameEn: "Professional Continental Championships · Europe",
          hostName: "Allemagne",
          hostNameEn: "Germany",
          countryCode: "de",
        },
      ],
    })]);
  });

  it("skips the article when no player was selected and uses the jury day of later seasons", async () => {
    const { admin, query } = fixture();
    expect(await loadCyclogazetteHostingStories(admin, {
      gameYear: 12,
      dayNumber: 21,
      calendarDate: "2027-06-18",
      now: new Date("2027-06-18T18:01:00Z"),
    })).toEqual([]);
    expect(query.eq).toHaveBeenCalledWith("gazette_date", "2027-06-18");
    expect(query.eq).toHaveBeenCalledWith("decision", "hosted");
    expect(query.lte).toHaveBeenCalledWith("target_game_year", 13);
  });

  it("allows the first issue after rollover to announce decisions that arrived after the last closing", async () => {
    const { admin, query } = fixture();
    await loadCyclogazetteHostingStories(admin, {
      ...context, gameYear: 6, dayNumber: 1, calendarDate: "2026-12-04",
      now: new Date("2026-12-04T19:01:00Z"),
    });
    expect(query.eq).toHaveBeenCalledWith("gazette_date", "2026-12-04");
    expect(query.gte).toHaveBeenCalledWith("target_game_year", 6);
  });
});
