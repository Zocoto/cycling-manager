import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  createNationalChampionRiderJersey,
  createNationalTeamRiderJersey,
} from "@/lib/rider-jersey";
import { NationalChampionJersey } from "./national-champion-jersey";
import { RiderAvatar } from "./rider-avatar";
import { PREVIEW_MAURITIUS_CHAMPION as champion } from "@/lib/game/federation-jersey-preview-fixtures";

describe("rendu du maillot de champion national", () => {
  it.each(["detailed", "compact"] as const)("uses the published champion design on the %s portrait", (renderMode) => {
    const markup = renderToStaticMarkup(<RiderAvatar profileKey={null} seed={42} renderMode={renderMode}
      jersey={createNationalChampionRiderJersey({ countryCode: "MU", championshipType: "road", nationalDesign: champion })} />);
    expect(markup).toContain('data-national-jersey-element="champion-flag"');
    expect(markup).toContain('href="/images/flags/4x3/mu.svg"');
  });
  it("uses the identical published design on the full champion jersey", () => {
    const markup = renderToStaticMarkup(<NationalChampionJersey countryCode="MU" countryName="Maurice" championshipType="time_trial" nationalDesign={champion} />);
    expect(markup).toContain('data-national-jersey-element="champion-flag"');
    expect(markup).toContain("champion national du contre-la-montre");
  });
  it("injecte le drapeau bulgare complet dans le maillot", () => {
    const markup = renderToStaticMarkup(
      <NationalChampionJersey
        countryCode="BG"
        countryName="Bulgarie"
        championshipType="road"
      />,
    );
    expect(markup).toContain('data-national-champion-flag="bg"');
    expect(markup).toContain('href="/images/flags/4x3/bg.svg"');
    expect(markup).not.toContain("foreignObject");
    expect(markup).toContain(
      "Maillot de champion national sur route de Bulgarie",
    );
  });

  it("injecte le drapeau français dans le haut du maillot de l’avatar", () => {
    const markup = renderToStaticMarkup(
      <RiderAvatar
        profileKey={null}
        seed={42}
        riderId="champion-fr"
        jersey={createNationalChampionRiderJersey({
          countryCode: "FR",
          championshipType: "road",
        })}
      />,
    );
    expect(markup).toContain('data-national-champion-flag="fr"');
    expect(markup).toContain('href="/images/flags/4x3/fr.svg"');
    expect(markup).toContain('x="0" y="64" width="96" height="34"');
    expect(markup).toContain('data-avatar-jersey-viewport="upper-body"');
    expect(markup).toContain('viewBox="0 36 260 92.08333333333333"');
    expect(markup).toContain('x="0" y="0" width="260" height="300"');
    expect(markup).toContain("contain:paint");
    expect(markup).not.toContain("foreignObject");
  });

  it.each([
    ["BG", [0, 150, 110]],
    ["DE", [255, 0, 0]],
  ] as const)("shows only the upper flag bands for %s instead of squeezing the lower band into the bust", async (countryCode, expectedColor) => {
    const markup = renderToStaticMarkup(<RiderAvatar profileKey="europe_west" seed={42}
      jersey={createNationalChampionRiderJersey({ countryCode, championshipType: "road" })} />);
    const svg = markup.slice(markup.indexOf("<svg"), markup.lastIndexOf("</svg>") + 6)
      .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
      .replace(`href="/images/flags/4x3/${countryCode.toLowerCase()}.svg"`,
        `href="data:image/svg+xml;base64,${readFileSync(path.join(process.cwd(), `public/images/flags/4x3/${countryCode.toLowerCase()}.svg`)).toString("base64")}"`);
    const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const offset = (92 * info.width + 10) * info.channels;
    expect([...data.subarray(offset, offset + 3)]).toEqual(expectedColor);
  });

  it("reproduit le maillot fédéral publié sur l’avatar de sélection", () => {
    const markup = renderToStaticMarkup(
      <RiderAvatar
        profileKey={null}
        seed={42}
        riderId="selection-be"
        jersey={createNationalTeamRiderJersey("BE", {
          schemaVersion: 2,
          baseColor: "#FAFAFA",
          elements: [
            {
              id: "lion-belge",
              kind: "emblem",
              shape: "shield",
              color: "#111111",
              secondaryColor: "#FDDA24",
              x: 60,
              y: 72,
              width: 46,
              height: 54,
              rotation: 0,
              opacity: 1,
            },
          ],
        })}
      />,
    );

    expect(markup).toContain('data-national-emblem="belgian-lion"');
    expect(markup).toContain("lion-belge");
    expect(markup).toContain('viewBox="0 6 120 42.5"');
    expect(markup).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(markup).not.toContain('data-national-champion-flag="be"');
  });

  it("keeps the upper motif of a custom jersey in the bust instead of pulling its lower decorations upward", async () => {
    const markup = renderToStaticMarkup(<RiderAvatar profileKey="europe_west" seed={42}
      jersey={createNationalTeamRiderJersey("BE", {
        schemaVersion: 2, baseColor: "#FFFFFF", elements: [
          { id: "upper", kind: "band", shape: "rectangle", x: 60, y: 35, width: 120, height: 26,
            color: "#FF0000", secondaryColor: "#FF0000", rotation: 0, opacity: 1 },
          { id: "lower", kind: "band", shape: "rectangle", x: 60, y: 106, width: 120, height: 26,
            color: "#0000FF", secondaryColor: "#0000FF", rotation: 0, opacity: 1 },
        ],
      })} />);
    const svg = markup.slice(markup.indexOf("<svg"), markup.lastIndexOf("</svg>") + 6)
      .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const offset = (92 * info.width + 10) * info.channels;
    expect([...data.subarray(offset, offset + 3)]).toEqual([255, 0, 0]);
  });
});
