import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8").replaceAll("\r", "");

const migration = read(
  "supabase/migrations/20260925100000_require_ds_approval_for_automatic_international_callups.sql",
);
const pool = read("services/federation-selection-pool.ts");
const federationActions = read("app/jeu/federations/selection-actions.ts");
const callupActions = read("app/jeu/selections-internationales/actions.ts");
const maintenance = read("app/api/cron/game-maintenance/route.ts");

describe("automatic international federation call-ups", () => {
  it("freezes one auditable J8 qualification ranking for CC and Worlds", () => {
    expect(migration).toContain(
      "create table public.international_nation_qualification_snapshots",
    );
    expect(migration).toContain("ranking_day_number smallint not null default 8");
    expect(migration).toContain("ranked.world_rank <= 30 as is_qualified");
    expect(migration).toContain("ranked.continental_rank <= 20");
    expect(migration).toContain("previous_points.points, 0)::numeric * 0.25");
    expect(migration).toContain(
      "perform public.freeze_due_international_nation_qualifications(p_now)",
    );
    expect(maintenance).toContain(
      '"freeze_due_international_nation_qualifications"',
    );
  });

  it("only resolves CC and World targets for countries frozen as qualified", () => {
    const target = migration
      .split(
        "create or replace function public.get_national_federation_selection_target(",
      )[1]
      .split("$$;")[0];
    expect(target).toContain(
      "from public.international_nation_qualification_snapshots as snapshot",
    );
    expect(target).toContain("and snapshot.is_qualified = true");
    expect(target).toContain(
      "slot.competition_code in (\n          'continental_championship', 'world_championship'",
    );
  });

  it("creates a pending approval for every managed rider and never auto-accepts it", () => {
    const producer = migration
      .split(
        "create or replace function public.prepare_due_automatic_federation_professional_lineups(",
      )[1]
      .split("$$;")[0];
    expect(producer).toContain(
      "case when v_candidate.sporting_director_id is null\n            then 'confirmed' else 'pending' end",
    );
    expect(producer).toContain("member.response_status in ('pending', 'confirmed')");
    expect(producer).toContain("'federation-auto-callup:' || member.id::text");
    expect(producer).toContain(
      "sans réponse, il ne sera pas mobilisé",
    );
    expect(producer).not.toContain(
      "v_candidate.sporting_director_id, 'confirmed', p_now",
    );
  });

  it("closes CC and World approvals at H-24 and keeps unanswered calls out", () => {
    expect(migration).toContain("then interval '24 hours'");
    expect(migration).toContain(
      "set response_status = 'declined', responded_at = p_now",
    );
    expect(migration).toContain(
      "return query select 0::integer, 0::integer",
    );
    expect(migration).toContain(
      "Since S3 the federation lists are authoritative",
    );
  });

  it("refills and synchronizes immediately after either call-up response path", () => {
    expect(federationActions).toContain(
      "await syncFederationChampionshipStartlists();",
    );
    expect(callupActions).toContain(
      "await syncDueNationalFederationChampionshipLineups({ force: true })",
    );
  });

  it("projects raw academy ratings onto the same 0-100 scale as junior pages", () => {
    expect(pool).toContain(
      'import { projectYouthRating } from "@/lib/game/youth-training"',
    );
    expect(pool).toContain(
      "mountain: projectFederationYouthRating(junior.mountain)",
    );
    expect(pool).toContain(
      "return Math.round(projectYouthRating(Number(value)))",
    );
    expect(pool).not.toContain("mountain: Number(junior.mountain)");
  });
});
