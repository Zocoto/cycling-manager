import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260816143000_reward_hidden_switchback_discovery.sql",
  ),
  "utf8",
);
const profileAction = readFileSync(
  resolve(process.cwd(), "app/jeu/directeur-sportif/actions.ts"),
  "utf8",
);

describe("hidden switchback discovery rewards", () => {
  it("grants the cash and two real one-star talent items exactly once", () => {
    expect(migration).toContain("'classified-talent-dossier'");
    expect(migration).toContain("'{\"potentialBonus\":2}'::jsonb");
    expect(migration).toContain("v_context.team_season_id,\n    v_inventory_item_id,\n    2,");
    expect(migration).toContain("cash_balance = cash_balance + 100000");
    expect(migration).toContain("'hidden-switchback:' || p_sporting_director_id::text");
    expect(migration).toContain("on conflict (source_reference) do nothing");
  });

  it("returns the grant state and backfills existing discoverers", () => {
    expect(migration).toContain("'rewardsGranted', v_rewards_granted");
    expect(migration).toContain("where trophy.trophy_key = 'virage_cache'");
    expect(migration).toContain(
      "perform private.grant_hidden_switchback_rewards(",
    );
  });

  it("protects the spy glasses in the database", () => {
    expect(migration).toContain("v_glasses_key = 'spy-glasses'");
    expect(migration).toContain("and trophy.trophy_key = 'virage_cache'");
    expect(migration).toContain("and trophy.claimed_at is not null");
    expect(migration).toContain(
      "Le Virage caché doit être découvert pour porter les lunettes d’espion.",
    );
    expect(profileAction).toContain(
      "HIDDEN_SWITCHBACK_AVATAR_GLASSES_KEY",
    );
    expect(profileAction).toContain('.eq("trophy_key", "virage_cache")');
  });
});
