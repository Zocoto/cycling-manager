import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FinancialDirectorEffect, TeamFinanceTransaction } from "@/services/team-finances";
import { FinanceTransactionColumn } from "./finance-transaction-column";

function transaction(id: string, overrides: Partial<TeamFinanceTransaction> = {}): TeamFinanceTransaction {
  return {
    id, dayNumber: 12, amount: 100, category: "race_prize", status: "posted",
    description: `Tour test — ${id}`, sourceReference: `reward:official-race:tour:rider:${id}:v1`, postedAt: "2026-10-20T18:00:00Z",
    ...overrides,
  };
}

function render(transactions: readonly TeamFinanceTransaction[], options: { positive?: boolean; effects?: readonly FinancialDirectorEffect[] } = {}) {
  const html = renderToStaticMarkup(<FinanceTransactionColumn title="Mouvements" transactions={transactions} currency="EUR" positive={options.positive ?? true} financialDirectorEffects={options.effects ?? []} />);
  return { html, text: html.replace(/<[^>]*>/g, "").replace(/\s/g, " ") };
}

describe("FinanceTransactionColumn", () => {
  it("keeps one-day and stage-race prizes in the same flow and preserves every original row", () => {
    const rows = [
      transaction("stage", { amount: 100.1, sourceReference: "reward:official-stage-prize:tour:stage:s1:rider:stage:v1" }),
      transaction("classic", { amount: 450, description: "Classique test — Victoire", sourceReference: "reward:official-race:classic:rider:classic:v1" }),
      transaction("general", { amount: 200.2 }),
      transaction("ttt", { amount: 30.3, sourceReference: "reward:official-ttt-stage:tour:stage:s2:team-season:team:v1" }),
      transaction("combativity-stage", { amount: 0.1, sourceReference: "reward:official-combativity:tour:stage:s2:rider:combativity-stage:v1" }),
      transaction("combativity-overall", { amount: 0.2, sourceReference: "reward:official-combativity:tour:overall:rider:combativity-overall:v1" }),
    ];
    const { html, text } = render(rows);
    expect(html.match(/<details/g)).toHaveLength(1);
    const summary = text.slice(text.indexOf("Tour test"), text.indexOf("Tour test — stage"));
    expect(summary).toContain("5 primes");
    expect(summary).toContain("+330,9 €");
    expect(summary).toContain("Déjà encaissé · inclus dans le solde");
    expect(text).toContain("Classique test — Victoire");
    expect(text).toContain("6 lignes");
    for (const row of rows) expect(text.split(row.description)).toHaveLength(2);
    expect(text).not.toContain("Règlements de fin de tour");
    expect(html).not.toMatch(/<script|<iframe/);
  });

  it("groups a course with several general prizes even without any stage prize", () => {
    const { html, text } = render([
      transaction("rider-a", { description: "Classique — Première place", sourceReference: "reward:official-race:classic:rider:a:v1" }),
      transaction("rider-b", { description: "Classique — Deuxième place", sourceReference: "reward:official-race:classic:rider:b:v1" }),
    ]);
    expect(html.match(/<details/g)).toHaveLength(1);
    expect(text).toContain("ClassiqueJ12 · 2 primes");
    expect(text).toContain("+200 €");
  });

  it("never mixes posted, pending and cancelled prizes in a group", () => {
    const { html, text } = render([
      transaction("paid-a"), transaction("paid-b"),
      transaction("future-a", { status: "pending", postedAt: null, amount: 12 }),
      transaction("future-b", { status: "pending", postedAt: null, amount: 13 }),
      transaction("cancelled", { status: "cancelled", amount: 999999 }),
    ]);
    const summaries = [...html.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>/g)].map((match) => match[1].replace(/<[^>]*>/g, ""));
    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toContain("Déjà encaissé · inclus dans le solde");
    expect(summaries[0]).toContain("+200");
    expect(summaries[0]).not.toContain("À recevoir");
    expect(summaries[1]).toContain("À recevoir · non encaissé");
    expect(summaries[1]).toContain("+25");
    expect(summaries[1]).not.toContain("Déjà encaissé");
    expect(text).toContain("4 lignes");
    expect(text).not.toContain("Tour test — cancelled");
    expect(text).not.toContain("999");
  });

  it("retains unknown sources, non-race receipts and singleton prizes as individual entries", () => {
    const { html, text } = render([
      transaction("unknown", { sourceReference: "reward:official-unknown:tour:rider:unknown:v1" }),
      transaction("truncated", { sourceReference: "reward:official-race:tour" }),
      transaction("future-format", { sourceReference: "reward:official-race:tour:rider:future-format:v1:extra" }),
      transaction("sponsor", { category: "sponsor" }),
      transaction("known"),
    ]);
    expect(html).not.toContain("<details");
    for (const id of ["unknown", "truncated", "future-format", "sponsor", "known"]) expect(text).toContain(`Tour test — ${id}`);
    expect(text).toContain("5 lignes");
  });

  it("keeps the DF credit separate from a grouped course total and annotates its original source", () => {
    const bonus: FinancialDirectorEffect = {
      id: "df-credit", sourceTransactionId: "race-a", dayNumber: 12, amount: 2,
      effect: "race_prize", baseAmount: 100, bonusPercentage: 2, status: "posted", description: "Bonus DF",
    };
    const { html, text } = render([
      transaction("race-a"), transaction("race-b"),
      transaction("df-credit", { amount: 2, category: "other", description: "Bonus DF distinct", sourceReference: "financial-director:bonus:race-a" }),
    ], { effects: [bonus] });
    const summary = html.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1] ?? "";
    expect(summary).toContain("+200");
    expect(summary).not.toContain("202");
    expect(text).toContain("DF · bonus 2 % sur 100 €");
    expect(text).toContain("Recette avec bonus DF : 102 €");
    expect(text).toContain("Crédit affiché séparément dans les recettes");
    expect(text).toContain("Bonus DF distinct");
    expect(text).toContain("DF · bonus sur recettes · Encaissé");
    expect(text).toContain("3 lignes");
  });

  it("retains gross salary expenses and marks their payment status independently of DF savings", () => {
    const saving: FinancialDirectorEffect = {
      id: "saving", sourceTransactionId: "salary", dayNumber: 12, amount: 40,
      effect: "staff_salary", baseAmount: 1000, bonusPercentage: 4, status: "posted", description: "Économie DF",
    };
    const { html, text } = render([
      transaction("salary", { amount: -1000, category: "staff_salary", description: "Salaire brut" }),
      transaction("future", { amount: -100, category: "rider_salary", status: "pending", postedAt: null }),
    ], { positive: false, effects: [saving] });
    expect(html).not.toContain("<details");
    expect(text).toContain("Salaire staff · Payé");
    expect(text).toContain("Dépense brute−1 000 €");
    expect(text).toContain("DF · économie 4 % sur 1 000 €");
    expect(text).toContain("Coût net indicatif : 960 €");
    expect(text).toContain("À payer · non débité");
    expect(text).not.toContain("−960 €");
  });

  it("renders an empty state after cancelled movements are excluded", () => {
    const { text } = render([transaction("cancelled", { status: "cancelled" })]);
    expect(text).toContain("0 ligne");
    expect(text).toContain("Aucun mouvement dans cette colonne.");
  });
});
