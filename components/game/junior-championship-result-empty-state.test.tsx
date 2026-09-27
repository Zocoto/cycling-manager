import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JuniorChampionshipResultEmptyState } from "./junior-championship-result-empty-state";

describe("JuniorChampionshipResultEmptyState", () => {
  it("explique qu’un championnat junior annulé n’aura pas de classement", () => {
    const markup = renderToStaticMarkup(
      <JuniorChampionshipResultEmptyState status="cancelled" />,
    );

    expect(markup).toContain("Cette épreuve a été annulée.");
    expect(markup).toContain(
      "Aucun classement ne sera publié pour cette édition.",
    );
    expect(markup).not.toContain("pas encore publié");
  });

  it("conserve l’attente normale pour un championnat planifié", () => {
    const markup = renderToStaticMarkup(
      <JuniorChampionshipResultEmptyState status="planned" />,
    );

    expect(markup).toContain("Le résultat n’est pas encore publié.");
  });
});
