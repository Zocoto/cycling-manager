import { readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const academyPage = read("app/jeu/centre-de-formation/page.tsx");
const academyCard = read("components/game/academy-rider-card.tsx");
const promotionForm = read("components/game/youth-promotion-form.tsx");
const parsedCard = ts.createSourceFile(
  "academy-rider-card.tsx",
  academyCard,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const cardFunction = parsedCard.statements.find(
  (node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "AcademyRiderCard",
)!;

function elements(node: ts.Node, tagName: string): ts.JsxElement[] {
  const result: ts.JsxElement[] = [];
  function visit(child: ts.Node) {
    if (
      ts.isJsxElement(child) &&
      child.openingElement.tagName.getText(parsedCard) === tagName
    ) {
      result.push(child);
    }
    ts.forEachChild(child, visit);
  }
  visit(node);
  return result;
}

function isInsideDisclosure(node: ts.Node): boolean {
  for (let parent = node.parent; parent && parent !== cardFunction; parent = parent.parent) {
    if (
      ts.isJsxElement(parent) &&
      ["details", "AcademyRiderSection"].includes(
        parent.openingElement.tagName.getText(parsedCard),
      )
    ) {
      return true;
    }
  }
  return false;
}

describe("agencement compact des juniors", () => {
  it("sépare chaque junior et garde son identité, son potentiel et son moral visibles", () => {
    expect(academyPage).toContain("<AcademyRiderCard");
    expect(academyCard).toContain("data-academy-rider-card");
    expect(academyCard).toContain("id={`junior-${rider.id}`}");

    for (const component of ["RiderAvatar", "PotentialStars", "RiderMoraleGauge"]) {
      let visible = false;
      function visit(node: ts.Node) {
        if (
          (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
          node.tagName.getText(parsedCard) === component &&
          !isInsideDisclosure(node)
        ) {
          visible = true;
        }
        ts.forEachChild(node, visit);
      }
      visit(cardFunction);
      expect(visible, `${component} reste dans l’aperçu`).toBe(true);
    }
  });

  it("replie par défaut les informations et les actions détaillées", () => {
    const sections = elements(cardFunction, "AcademyRiderSection");
    for (const label of ["Profil complet", "Entraînement", "Gestion"]) {
      const section = sections.find((section) =>
        section.openingElement.attributes.properties.some(
          (attribute) => ts.isJsxAttribute(attribute) &&
            attribute.name.getText(parsedCard) === "title" &&
            attribute.initializer && ts.isStringLiteral(attribute.initializer) &&
            attribute.initializer.text === label,
        ),
      );
      expect(section, `rubrique ${label}`).toBeDefined();
    }
    const sectionFunction = parsedCard.statements.find(
      (node): node is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(node) && node.name?.text === "AcademyRiderSection",
    )!;
    const [details] = elements(sectionFunction, "details");
    expect(details).toBeDefined();
    expect(elements(details, "summary")).toHaveLength(1);
    expect(details.openingElement.attributes.properties.some(
      (attribute) => ts.isJsxAttribute(attribute) &&
        ["open", "name"].includes(attribute.name.getText(parsedCard)),
    )).toBe(false);
    expect(details.getText(parsedCard)).toContain("{children}");
  });

  it("nomme explicitement la saison de recrutement dans le formulaire conservé", () => {
    expect(academyCard).toContain("<YouthPromotionForm");
    expect(academyCard).toContain("nextGameYear={gameYear + 1}");
    expect(promotionForm).toContain("Recruter pour la saison ${nextGameYear}");
  });
});
