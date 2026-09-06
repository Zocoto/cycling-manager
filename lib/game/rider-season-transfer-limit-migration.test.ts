import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260906143000_allow_one_rider_team_change_per_season.sql",
  ),
  "utf8",
);
const transferService = readFileSync(
  resolve(process.cwd(), "services/transfer-market.ts"),
  "utf8",
);
const transferPage = readFileSync(
  resolve(process.cwd(), "app/jeu/transferts/page.tsx"),
  "utf8",
);

describe("rider season transfer limit", () => {
  it("does not count a first free-agent signing as a team change", () => {
    expect(migration).toContain(
      "contract.acquisition_type in ('daily_auction', 'free_agent')",
    );
    expect(migration).toContain("else null");
    expect(migration).toContain("previous_contract.team_id <> contract.team_id");
  });

  it("locks the rider after joining a second team", () => {
    expect(migration).toContain(
      "when v_has_previous_other_team then new.start_season_id",
    );
    expect(migration).toContain("new.transfer_locked_season_id := case");
    expect(migration).toContain("rider_contracts_team_change_lock_idx");
  });

  it("blocks every attempt to make a second team change", () => {
    expect(migration).toContain(
      "v_already_changed_team or v_previous_team_count >= 2",
    );
    expect(migration).toContain(
      "Transfert impossible : ce coureur a déjà changé d’équipe cette saison.",
    );
    expect(migration).toContain(
      "before insert on public.rider_contracts",
    );
  });

  it("exposes the rule before a blocked signing or offer", () => {
    expect(transferService).toContain("hasChangedTeamThisSeason");
    expect(transferService).toContain(
      '.eq("transfer_locked_season_id", context.season.id)',
    );
    expect(transferPage).toContain(
      "Une première signature comme agent libre ne compte pas comme un changement.",
    );
    expect(transferPage).toContain(
      "nouveau transfert impossible",
    );
  });
});
