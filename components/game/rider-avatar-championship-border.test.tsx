import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RiderAvatar } from "./rider-avatar";

describe("RiderAvatar championship border", () => {
  it("dessine et décrit le liseré de palmarès autour du portrait", () => {
    const markup = renderToStaticMarkup(
      <RiderAvatar
        profileKey="europe_west"
        seed="former-world-champion"
        championshipBorder={{
          kind: "world",
          colors: ["#2166B1", "#E32636", "#111111", "#F2C94C", "#16834A"],
          label: "Ancien champion du monde CLM",
        }}
      />,
    );

    expect(markup).toContain('data-championship-border="world"');
    expect(markup).toContain('title="Ancien champion du monde CLM"');
    expect(markup).toContain("linear-gradient(135deg");
    expect(markup).toContain("padding:3px");
  });
});
