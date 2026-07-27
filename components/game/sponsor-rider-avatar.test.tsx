import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createSponsoredRiderJersey } from "@/lib/rider-jersey";

import { RiderAvatar } from "./rider-avatar";

describe("rendu du maillot sponsor dans l’avatar", () => {
  it("projette le haut du visuel sélectionné sur le buste du coureur", () => {
    const imagePath =
      "/images/sponsors/veloria-mobilites/jersey-modern.png";
    const markup = renderToStaticMarkup(
      <RiderAvatar
        profileKey={null}
        seed={42}
        riderId="rider-sponsored"
        jersey={createSponsoredRiderJersey({
          colors: {
            primary: "#123456",
            secondary: "#ABCDEF",
            accent: "#FEDCBA",
            background: "#FFFFFF",
            text: "#071A17",
          },
          style: "modern",
          imagePath,
        })}
      />,
    );

    expect(markup).toContain('data-sponsor-jersey-artwork="true"');
    expect(markup).toContain(`href="${imagePath}"`);
    expect(markup).toContain('x="-6"');
    expect(markup).toContain('y="62"');
    expect(markup).toContain('width="110"');
    expect(markup).toContain('height="138"');
    expect(markup).toContain('preserveAspectRatio="none"');
  });

  it("conserve le motif vectoriel lorsque le visuel sponsor est absent", () => {
    const markup = renderToStaticMarkup(
      <RiderAvatar
        profileKey={null}
        seed={42}
        riderId="rider-sponsored-fallback"
        jersey={createSponsoredRiderJersey({
          colors: {
            primary: "#123456",
            secondary: "#ABCDEF",
            accent: "#FEDCBA",
            background: "#FFFFFF",
            text: "#071A17",
          },
          style: "classic",
        })}
      />,
    );

    expect(markup).not.toContain("data-sponsor-jersey-artwork");
    expect(markup).toContain('fill="#ABCDEF"');
    expect(markup).toContain('fill="#FEDCBA"');
  });
});
