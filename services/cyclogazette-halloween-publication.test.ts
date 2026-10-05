import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCyclingHollowTeaserStory,
  type CyclogazetteFeatureStory,
} from "@/lib/game/cyclogazette";

const mocks = vi.hoisted(() => ({ createAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createAdmin }));

import { getCyclogazetteEditionById, publishCyclogazetteEdition } from "./cyclogazette";

const sportingStory: CyclogazetteFeatureStory = {
  id: "startlist:fixture",
  kind: "startlist",
  kicker: "Start-list",
  kickerEn: "Start list",
  title: "Le dossier sportif",
  titleEn: "The sporting feature",
  body: "Le texte sportif conservé.",
  bodyEn: "The sporting story is preserved.",
};

function publicationFixture(date = "2026-10-05", stories: CyclogazetteFeatureStory[] = [sportingStory]) {
  let row = {
    id: "77777777-7777-4777-8777-777777777777",
    season_id: "season-fixture",
    issue_number: 81,
    title: "La Cyclogazette",
    subtitle: "Les résultats du jour",
    issue_date: date,
    published_at: `${date}T18:01:00Z`,
    season_days: { day_number: 25 },
    content: { lead: null, raceStories: [], raceHighlights: [], mercatoStories: [], reactions: [], featureStories: stories },
  };
  const updates: Record<string, unknown>[] = [];
  const rpc = vi.fn().mockResolvedValue({ data: 0, error: null });
  const from = vi.fn((table: string) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({ error: null, data: table === "seasons"
        ? { id: "season-fixture", name: "Saison 3", game_year: 3, current_day_number: 25 }
        : table === "season_days"
          ? { id: "day-fixture", day_number: 25, calendar_date: date }
          : row })),
      update: vi.fn((values: Record<string, unknown>) => ({
        eq: vi.fn(async () => {
          updates.push(values);
          row = { ...row, ...values } as typeof row;
          return { error: null };
        }),
      })),
    };
    return chain;
  });
  mocks.createAdmin.mockReturnValue({ from, rpc });
  return { updates, from, rpc, row: () => row };
}

beforeEach(() => vi.clearAllMocks());

describe("publication persistée du feuilleton Halloween", () => {
  it.each(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"])("complète une édition du %s puis ne réécrit rien à la relance", async (date) => {
    const fixture = publicationFixture(date);
    const now = new Date(`${date}T18:11:00Z`);
    const first = await publishCyclogazetteEdition(now);
    expect(first.status).toBe("already-published");
    expect(fixture.updates).toHaveLength(1);
    expect(fixture.row().content.featureStories).toEqual([sportingStory, getCyclingHollowTeaserStory(date)]);
    expect(fixture.row().title).toBe("La Cyclogazette");
    expect(fixture.row().subtitle).toBe("Les résultats du jour");
    expect(await publishCyclogazetteEdition(now)).toMatchObject({ status: "already-published" });
    expect(fixture.updates).toHaveLength(1);
  });

  it("utilise la date de l’édition, pas celle de l’horloge de relance", async () => {
    const fixture = publicationFixture("2026-10-05");
    await publishCyclogazetteEdition(new Date("2026-10-06T18:11:00Z"));
    expect(fixture.row().content.featureStories[1]?.id).toBe("event:cycling-hollow:2026-10-05");
  });

  it("ne réécrit pas l’article d’hier déjà publié", async () => {
    const publishedEpisode = { ...getCyclingHollowTeaserStory("2026-10-04")!, body: "La version publiée hier." };
    const fixture = publicationFixture("2026-10-04", [sportingStory, publishedEpisode]);
    await publishCyclogazetteEdition(new Date("2026-10-05T18:11:00Z"));
    expect(fixture.updates).toHaveLength(0);
    expect(fixture.row().content.featureStories).toEqual([sportingStory, publishedEpisode]);
  });

  it("une lecture de l’archive ne publie aucun épisode ni ne déclenche de traitement", async () => {
    const fixture = publicationFixture();
    const archive = await getCyclogazetteEditionById(fixture.row().id);
    expect(archive?.content.featureStories).toEqual([sportingStory]);
    expect(fixture.updates).toHaveLength(0);
    expect(fixture.rpc).not.toHaveBeenCalled();
  });

  it("n’enrichit pas une édition après la fin de S3", async () => {
    const fixture = publicationFixture("2026-10-09");
    await publishCyclogazetteEdition(new Date("2026-10-09T18:11:00Z"));
    expect(fixture.updates).toHaveLength(0);
  });
});
