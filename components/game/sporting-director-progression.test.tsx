import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MAX_SPORTING_DIRECTOR_EXPERIENCE_POINTS } from "../../lib/game/sporting-director-limits";
import { SportingDirectorProgression } from "./sporting-director-progression";

describe("SportingDirectorProgression", () => {
  it("affiche le niveau maximum sans annoncer de niveau 51", () => {
    const markup = renderToStaticMarkup(
      <SportingDirectorProgression
        experiencePoints={
          MAX_SPORTING_DIRECTOR_EXPERIENCE_POINTS + 1_000
        }
      />,
    );

    expect(markup).toContain("Niveau 50");
    expect(markup).toContain("Niveau maximum");
    expect(markup).toContain('aria-label="Niveau maximum atteint"');
    expect(markup).not.toContain("Niveau 51");
  });
});
