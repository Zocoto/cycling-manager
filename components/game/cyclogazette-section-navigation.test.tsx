import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CyclogazetteSectionNavigation } from "./cyclogazette-section-navigation";

describe("CyclogazetteSectionNavigation", () => {
  it("conserve un accès permanent au journal et aux awards", () => {
    const markup = renderToStaticMarkup(
      <CyclogazetteSectionNavigation activeSection="awards" />,
    );

    expect(markup).toContain("Le journal");
    expect(markup).toContain("Awards du peloton");
    expect(markup).toContain("onglet=awards");
    expect(markup).toContain('aria-current="page"');
  });
});
