import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NaturalizationCard } from "./naturalization-card";

const action = async () => {};
const currentCountry = { id: "be", name: "Belgique", code: "BE" };
const targetCountry = { id: "fr", name: "France", code: "FR" };

describe("NaturalizationCard", () => {
  it("affiche le décompte dans un bouton désactivé", () => {
    const markup = renderToStaticMarkup(
      <NaturalizationCard
        eligibility={{
          level: "professional",
          eligible: false,
          reason: "tenure_incomplete",
          elapsedDays: 70,
          requiredDays: 84,
          remainingDays: 14,
          currentCountry,
          targetCountry,
        }}
        subjectName="Coureur Test"
        subjectId="rider-id"
        subjectIdField="riderId"
        action={action}
      />,
    );

    expect(markup).toContain("70/84 jours");
    expect(markup).toContain("Disponible dans 14 j");
    expect(markup).toContain("disabled");
  });

  it("explique le blocage définitif d’un champion national", () => {
    const markup = renderToStaticMarkup(
      <NaturalizationCard
        eligibility={{
          level: "professional",
          eligible: false,
          reason: "champion_locked",
          elapsedDays: 90,
          requiredDays: 84,
          remainingDays: 0,
          currentCountry,
          targetCountry,
        }}
        subjectName="Champion Test"
        subjectId="rider-id"
        subjectIdField="riderId"
        action={action}
      />,
    );

    expect(markup).toContain("Pays définitif");
    expect(markup).toContain("championnat national route ou CLM");
    expect(markup).toContain("Naturalisation bloquée");
  });

  it("rend l’action lorsque l’ancienneté est atteinte", () => {
    const markup = renderToStaticMarkup(
      <NaturalizationCard
        eligibility={{
          level: "youth",
          eligible: true,
          reason: "eligible",
          elapsedDays: 28,
          requiredDays: 28,
          remainingDays: 0,
          currentCountry,
          targetCountry,
        }}
        subjectName="Junior Test"
        subjectId="junior-id"
        subjectIdField="academyRiderId"
        action={action}
        compact
      />,
    );

    expect(markup).toContain("Naturaliser pour France");
    expect(markup).toContain('name="academyRiderId"');
    expect(markup).not.toContain("Naturalisation indisponible");
  });
});
