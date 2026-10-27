import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FinanceIncomeAnalysisPanel } from "./finance-income-analysis";
import { buildFinanceIncomeAnalysis } from "@/lib/game/finance-income-analysis";
describe("FinanceIncomeAnalysisPanel", () => {
  it("shows an accessible distribution, the largest source and received/planned amounts", () => {
    const analysis=buildFinanceIncomeAnalysis([
      {id:"sponsor",amount:200_000,category:"sponsor",status:"pending",sourceReference:"sponsor:contract:28"},
      {id:"shop",amount:50_000,category:"other",status:"posted",sourceReference:"fan-club:sales:day"},
    ]);
    const html=renderToStaticMarkup(<FinanceIncomeAnalysisPanel analysis={analysis} currency="EUR" seasonName="Saison 4" />);
    expect(html).toContain('role="img"');expect(html).toContain("de recettes par source");
    expect(html).toContain("Sponsors");expect(html).toContain("Boutique");expect(html).toContain("Encaissé");expect(html).toContain("À recevoir");
    expect(html).toContain("revenus bruts");expect(html).toContain("allocation de départ");
    const text=html.replace(/<[^>]+>/g,"").replace(/\s/g," ");
    expect(text).toContain("Total encaissé + à recevoir · Saison 4");
    expect(text).toContain("Déjà encaissé50 000 €");
    expect(text).toContain("À recevoir200 000 €");
    expect(text).toContain("Recettes de la saison250 000 €");
    expect(text).toContain("Les sommes encaissées sont déjà incluses dans le solde actuel");
    expect(text).toContain("y compris ses économies sur charges");
    expect(html).not.toContain("Prévu");
    expect(html).toContain("Première source de revenus");expect(html).not.toContain("Charges engagées");
  });
  it("has a clear empty state without an empty chart or invented earnings", () => {
    const html=renderToStaticMarkup(<FinanceIncomeAnalysisPanel analysis={buildFinanceIncomeAnalysis([])} currency="EUR" seasonName="Saison 4" />);
    expect(html).toContain("Aucune recette enregistrée");expect(html).not.toContain('role="img"');expect(html).not.toContain("NaN");
  });
});
