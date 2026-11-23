import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AMATEUR_JERSEY } from "@/lib/amateur-team";
import { GALA_S5_COURSES, SEASON_FIVE_GALA } from "@/lib/game/season-five-gala";
import type { SeasonFiveGalaContext } from "@/lib/game/season-five-gala-registration";
import type { SeasonFiveGalaPublicStartlists as PublicStartlists } from "@/lib/game/season-five-gala-public-startlists";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/app/jeu/gala-saison-5/actions", () => ({
  saveSeasonFiveGalaRegistrationAction: async () => ({ status: "success", message: "Inscription enregistrée." }),
  withdrawSeasonFiveGalaRegistrationAction: async () => ({ status: "success", message: "Inscription retirée." }),
}));
import { SeasonFiveGalaPreview } from "./season-five-gala-preview";
import { SeasonFiveGalaPublicStartlists } from "./season-five-gala-public-startlists";

const riderIds = Array.from({ length: 8 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
const riders = riderIds.map((rider_id, index) => ({ rider_id, first_name: `Mon coureur ${index + 1}`, last_name: "Équipe locale", mountain: 70, hills: 70, flat: 70, time_trial: 70, cobbles: 70, sprint: 70 }));
const context: SeasonFiveGalaContext = {
  isOpen: true, closesAt: SEASON_FIVE_GALA.registrationClosesAt,
  team: { id: "club-a", name: "Club A", futureName: "Club A S6", identityReady: true },
  program: "pro-tour", selections: { "pt-zoncolan": riderIds, "pt-liege": [], "pt-hamburg": [] }, riders,
};
const team = (name: string, jersey: PublicStartlists["courses"][number]["teams"][number]["jersey"]) => ({
  teamId: name, name, futureName: `${name} S6`, identityReady: true, jersey,
  riders: riderIds.slice(0, 7).map((riderId, index) => ({ riderId: `${name}-${riderId}`, firstName: `${name} coureur`, lastName: String(index + 1), position: index + 1 })),
});
const startlists: PublicStartlists = {
  editionId: "edition-s5", sourceSeason: 5, targetGameYear: 6, closesAt: SEASON_FIVE_GALA.registrationClosesAt,
  courses: GALA_S5_COURSES.map(course => ({ eventKey: course.id, program: course.program, teams: course.id === "pt-zoncolan"
    ? [team("Équipe une", { kind: "sponsor", imagePath: "/images/gala/gouille-twitch.png" }), team("Équipe deux", { kind: "amateur", jersey: DEFAULT_AMATEUR_JERSEY })]
    : [] })),
};

beforeEach(() => mocks.refresh.mockClear());

describe("gala programme lock and compact registration", () => {
  it("greys out the other programme after registration while displaying both public programmes", () => {
    const html = renderToStaticMarkup(<SeasonFiveGalaPreview registrationContext={context} startlists={startlists} />);
    expect(html).toMatch(/<button[^>]*role="tab"[^>]*disabled=""[^>]*aria-disabled="true"/);
    expect(html).toContain("Retirez d’abord votre inscription actuelle pour changer de programme.");
    expect(html).toContain("Modifier mes compositions");
    expect(html).toContain("Retirer toutes mes inscriptions");
    expect(html).toMatch(/<details[^>]*data-gala-own-editor="true"[^>]*>/);
    expect(html).not.toMatch(/<details[^>]*data-gala-own-editor="true"[^>]*open/);
    expect(html).not.toContain('name="selections"');
    expect(html).not.toContain("Je remplace mes inscriptions");
    expect(html).toContain("Équipe une S6");
    expect(html).toContain("Équipe deux S6");
    expect(html).toContain("Équipe deux coureur");
    expect(html.match(/data-gala-public-course=/g)).toHaveLength(6);
    expect(html).toContain("Voir les startlists");
  });

  it("leaves both programmes available for a new registration behind an explicit composer disclosure", () => {
    const html = renderToStaticMarkup(<SeasonFiveGalaPreview registrationContext={{ ...context, program: null, selections: {} }} startlists={startlists} />);
    expect(html).not.toContain('aria-disabled="true"');
    expect(html).toContain("Composer mon équipe");
    expect(html).not.toContain('name="selections"');
    expect(html).not.toContain("Retirer toutes mes inscriptions");
  });

  it("never presents a failed public read as an empty startlist", () => {
    const html = renderToStaticMarkup(<SeasonFiveGalaPublicStartlists startlists={null} registeredProgram={null} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Les startlists sont temporairement indisponibles.");
    expect(html).not.toContain("Aucune équipe inscrite");
    expect(html).not.toContain("0 équipe(s)");
  });

  it("shows real empty courses and each selected programme's three race summaries", () => {
    const html = renderToStaticMarkup(<SeasonFiveGalaPublicStartlists startlists={{ ...startlists,
      courses: startlists.courses.map(course => ({ ...course, teams: [] })),
    }} registeredProgram="continental" />);
    expect(html.match(/data-gala-public-course=/g)).toHaveLength(6);
    expect(html).toContain("0 équipe(s) inscrite(s)");
    expect(html).toContain("Aucune équipe inscrite pour cette épreuve pour le moment.");
    expect(html.indexOf("Continental")).toBeLessThan(html.indexOf("Pro Tour"));
  });
});
