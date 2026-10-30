import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { EmptyRosterRecoveryState } from "@/services/empty-roster-recovery";
import { EmptyRosterRecovery } from "./empty-roster-recovery";

vi.mock("@/app/jeu/effectif/actions", () => ({ recoverEmptyTeamRosterAction: vi.fn() }));

const state = {
  available: true,
  team_country_id: "11111111-1111-4111-8111-111111111111",
  team_country_name: "Rwanda",
  team_country_iso_alpha2: "RW",
  name_profile_code: "east_africa",
  recovered_this_season: false,
  has_committed_riders: false,
} satisfies EmptyRosterRecoveryState & { has_committed_riders: boolean };

describe("empty-team recovery notice", () => {
  it("offers the seven-rider recovery with its country and one action, without accepting country or team fields", () => {
    const html = renderToStaticMarkup(<EmptyRosterRecovery state={state} />);
    expect(html).toContain('id="relancer-effectif"');
    expect(html).toContain("7 coureurs");
    expect(html).toContain("Rwanda");
    expect(html.match(/<form\b/g)).toHaveLength(1);
    expect(html).toContain('type="submit"');
    expect(html).not.toMatch(/name="(?:country|countryId|teamId|p_expected_country_id|p_rider_identities)"/);
    expect(html).not.toContain(state.team_country_id);
    expect(html).not.toContain(state.name_profile_code);
  });

  it("explains an already used recovery and offers no submission form", () => {
    const html = renderToStaticMarkup(<EmptyRosterRecovery state={{ ...state, available: false, recovered_this_season: true }} />);
    expect(html).toContain("déjà été utilisée cette saison");
    expect(html).not.toMatch(/<form\b/);
    expect(html).not.toMatch(/type="submit"/);
  });

  it("renders nothing when there is no recovery to offer", () => {
    const occupied = { ...state, available: false, has_committed_riders: true };
    expect(renderToStaticMarkup(<EmptyRosterRecovery state={occupied} />)).toBe("");
  });
});
