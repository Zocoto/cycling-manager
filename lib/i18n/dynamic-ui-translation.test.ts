import { describe, expect, it } from "vitest";
import { applyUiTranslationTemplate, compileUiTranslationTemplate } from "./dynamic-ui-translation";

describe("safe dynamic UI translations", () => {
  it("reorders named parameters without interpreting their contents", () => {
    const template = compileUiTranslationTemplate("Maillot {{0}} de {{1}}", "{{1}}'s {{0}} jersey")!;
    expect(applyUiTranslationTemplate(template, "Maillot officiel de Abbaye du Lion")).toBe("Abbaye du Lion's officiel jersey");
    expect(applyUiTranslationTemplate(template, "Maillot officiel de $& <Cyclistes>")).toBe("$& <Cyclistes>'s officiel jersey");
  });
  it("matches literal punctuation, not regular expressions", () => {
    const template = compileUiTranslationTemplate("Bonus de recherche (R&D) : +{{0}} %.", "R&D bonus: +{{0}}%.")!;
    expect(applyUiTranslationTemplate(template, "Bonus de recherche (R&D) : +12 %.")).toBe("R&D bonus: +12%.");
    expect(applyUiTranslationTemplate(template, "Bonus de recherche R&D : +12 %.")).toBeNull();
  });
  it("allows only verified grammatical suffixes to be omitted", () => {
    const template = compileUiTranslationTemplate("{{0}} coureur{{grammar1}} engagé{{grammar2}} par votre équipe", "{{0}} rider{{grammar1}} entered by your team")!;
    expect(applyUiTranslationTemplate(template, "3 coureurs engagés par votre équipe")).toBe("3 riders entered by your team");
    expect(applyUiTranslationTemplate(template, "1 coureur engagé par votre équipe")).toBe("1 rider entered by your team");
    expect(applyUiTranslationTemplate(template, "3 coureurs engagéChandler par votre équipe")).toBeNull();
  });
  it("rejects translations which drop or invent actual variables", () => {
    expect(compileUiTranslationTemplate("Maillot {{0}} de {{1}}", "Jersey of {{1}}")).toBeNull();
    expect(compileUiTranslationTemplate("Maillot {{0}} de {{1}}", "{{2}} jersey of {{1}}")).toBeNull();
    expect(compileUiTranslationTemplate("Maillot {{0}} de {{1}}", "{{0}} jersey of {{1}}{{grammar2}}")).toBeNull();
  });
  it("bounds captures and rejects adjacent or insufficiently specific slots", () => {
    expect(compileUiTranslationTemplate("{{0}} {{1}}", "{{0}} {{1}}")).toBeNull();
    expect(compileUiTranslationTemplate("{{0}} jour", "{{0}} day")).toBeNull();
    const template = compileUiTranslationTemplate("Maillot officiel de {{0}}", "Official jersey of {{0}}")!;
    expect(applyUiTranslationTemplate(template, `Maillot officiel de ${"x".repeat(501)}`)).toBeNull();
  });
  it("preserves sequential SQL exception values", () => {
    const template = compileUiTranslationTemplate("Coureur %s indisponible pour %s.", "Rider %s unavailable for %s.")!;
    expect(applyUiTranslationTemplate(template, "Coureur Chandler indisponible pour le Tour.")).toBe("Rider Chandler unavailable for le Tour.");
  });
  it("validates repeated named parameters", () => {
    const template = compileUiTranslationTemplate("Équipement {{name}}, propriété de {{name}}", "Equipment {{name}}, owned by {{name}}")!;
    expect(applyUiTranslationTemplate(template, "Équipement Abbaye, propriété de Abbaye")).toBe("Equipment Abbaye, owned by Abbaye");
    expect(applyUiTranslationTemplate(template, "Équipement Abbaye, propriété de Ujik")).toBeNull();
  });
});
