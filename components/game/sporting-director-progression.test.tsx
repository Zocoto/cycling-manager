import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SportingDirectorProgression } from "./sporting-director-progression";

describe("SportingDirectorProgression", () => {
  it("shows progress towards level 51 above the former XP cap", () => {
    const markup = renderToStaticMarkup(
      <SportingDirectorProgression
        experiencePoints={
          64_700
        }
      />,
    );

    expect(markup).toContain("Niveau 50");
    expect(markup).toContain("Niveau 51");
    expect(markup).toContain("64700 XP");
    expect(markup).toContain('aria-label="Progression d’expérience vers le niveau 51"');
    expect(markup).toContain('aria-valuemax="2550"');
    expect(markup).toContain('aria-valuenow="1000"');
    expect(markup).not.toContain("Niveau maximum");
  });

  it("renders level 51 and the next threshold in compact mode", () => {
    const markup = renderToStaticMarkup(<SportingDirectorProgression experiencePoints={66_250} compact />);
    expect(markup).toContain("Niveau 51");
    expect(markup).toContain("Niveau 52");
    expect(markup).toContain('aria-valuemax="2600"');
    expect(markup).not.toContain("Niveau maximum");
  });
});
