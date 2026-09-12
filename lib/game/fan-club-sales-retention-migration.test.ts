import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260912160000_purge_completed_fan_club_shop_sales.sql",
);
const migration = readFileSync(migrationPath, "utf8");
const reportService = readFileSync(
  resolve(process.cwd(), "services/fan-club-sales-report.ts"),
  "utf8",
);
const reportPage = readFileSync(
  resolve(process.cwd(), "app/jeu/fan-club/rapport-ventes/page.tsx"),
  "utf8",
);
const fanClubComponent = readFileSync(
  resolve(process.cwd(), "components/game/fan-club.tsx"),
  "utf8",
);

describe("Fan Club shop sales retention", () => {
  it("purges detailed rows only when their season becomes completed", () => {
    expect(migration).toContain(
      "create trigger zzz_purge_completed_fan_club_shop_sales",
    );
    expect(migration).toContain("after update of status on public.seasons");
    expect(migration).toContain("new.status = 'completed'");
    expect(migration).toContain("old.status is distinct from 'completed'");
    expect(migration).toContain("where sale.season_id = new.id");
    expect(migration).toContain("season.status = 'completed'");
    expect(migration).not.toMatch(
      /delete from public\.(?:team_finance_transactions|fan_club_shop_inventory)/i,
    );
  });

  it("retains compact career progress for the five standard products", () => {
    expect(migration).toContain(
      "create table public.fan_club_shop_product_milestones",
    );
    expect(migration).toContain("primary key (team_id, product_code)");
    expect(migration).toContain("remember_fan_club_shop_product_sale");
    expect(migration).toContain("p_metric_key = 'fan_club_products_sold'");
    expect(migration).toContain(
      "from public.fan_club_shop_product_milestones as milestone",
    );
  });

  it("loads and labels only the active season in the sales report", () => {
    expect(reportService).toContain('.eq("season_id", activeSeason.id)');
    expect(reportService).not.toContain('.in("season_id", seasonIds)');
    expect(reportPage).toContain("Seules les journées de la saison en");
    expect(reportPage).toContain('label="Recettes de la saison"');
    expect(reportPage).not.toContain("Recettes historisées");
    expect(fanClubComponent).toContain("journées précédentes de la saison en cours");
    expect(fanClubComponent).toContain("Consulter la saison →");
  });
});
