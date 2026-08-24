import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260824123000_add_gt_collector_jerseys.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("maillots collectors des Grands Tours", () => {
  it("associe chaque couleur au bon Grand Tour", () => {
    expect(migration).toContain(
      "when 'collector-jersey-france' then 'boucle-des-provinces'",
    );
    expect(migration).toContain(
      "when 'collector-jersey-italy' then 'corsa-delle-regioni'",
    );
    expect(migration).toContain(
      "when 'collector-jersey-spain' then 'ruta-de-las-sierras'",
    );
    expect(migration).toContain("result.final_rank = 1");
  });

  it("facture chaque collector au cours exact du maillot classique", () => {
    expect(
      migration.match(/\('collector-jersey-(?:france|italy|spain)', 1, 'team-jersey'/g),
    ).toHaveLength(3);
    expect(migration).toContain(
      "price.product_code = v_product.wholesale_product_code",
    );
  });

  it("limite le stock collector à sa saison et conserve la capacité N1 de 300", () => {
    expect(migration).toContain("collector_season_id uuid");
    expect(migration).toContain(
      "inventory.collector_season_id is distinct from p_active_season_id",
    );
    expect(migration).toContain(
      "array[300, 800, 1600, 3000, 5000]::integer[]",
    );
  });

  it("applique aux collectors une demande et une marge supérieures", () => {
    expect(
      migration.match(/109::numeric, 0\.0022::numeric/g),
    ).toHaveLength(3);
    expect(
      migration.match(/3\.40::numeric, 1\.20::numeric/g),
    ).toHaveLength(3);
    expect(migration).toContain(
      "public.calculate_fan_club_price_factor(",
    );
  });
});
