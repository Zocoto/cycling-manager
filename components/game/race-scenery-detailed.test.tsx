import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RaceSceneryBackdrop } from "./race-scenery-detailed";

describe("detailed race scenery", () => {
  it.each(["forest", "village", "urban"] as const)(
    "adds a fine-grain detail layer to %s scenery",
    (kind) => {
      const markup = renderToStaticMarkup(
        <RaceSceneryBackdrop
          kind={kind}
          isMoving
          showSpectators={false}
        />,
      );

      expect(markup).toContain(`data-detailed-race-scenery="${kind}"`);
      expect(markup).toContain("cm-race-scenery-detail");
      expect((markup.match(/<path/g) ?? []).length).toBeGreaterThan(15);
    },
  );
});
