import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createRiderAvatarDesign } from "@/lib/rider-avatar";

import { RiderAvatar } from "./rider-avatar";

describe("vieillissement visuel des coureurs", () => {
  it("applique exactement les paliers 40, 55 et 90 ans", () => {
    const designAt = (age: number) =>
      createRiderAvatarDesign({
        profileKey: "europe_west",
        seed: -90_055_040,
        fallbackKey: `aging-${age}`,
        age,
      });

    expect(designAt(39).agingStage).toBe("adult");
    expect(designAt(40).agingStage).toBe("grey");
    expect(designAt(54).agingStage).toBe("grey");
    expect(designAt(55).agingStage).toBe("white");
    expect(designAt(89).agingStage).toBe("white");
    expect(designAt(90).agingStage).toBe("lich");
  });

  it("grisonne puis blanchit les cheveux avant la transformation en liche", () => {
    const createDesign = (age: number) =>
      createRiderAvatarDesign({
        profileKey: "europe_west",
        seed: -90_055_040,
        age,
      });
    const adult = createDesign(39);
    const grey = createDesign(40);
    const white = createDesign(55);
    const lich = createDesign(90);

    expect(grey.hairColor).not.toBe(adult.hairColor);
    expect(grey.hairColor).not.toBe("#E7E8E2");
    expect(white.hairColor).toBe("#E7E8E2");
    expect(lich.hairColor).toBe("#EEF4EF");
    expect(lich.skinTone).toBe("#B8D2C9");
    expect(lich.eyeColor).toBe("#71F4E4");
  });

  it("rend les rides et les détails surnaturels en vues détaillée et compacte", () => {
    const adultMarkup = renderAvatar(39);
    const greyMarkup = renderAvatar(40);
    const whiteMarkup = renderAvatar(55);
    const lichMarkup = renderAvatar(90);
    const compactLichMarkup = renderAvatar(90, "compact");

    expect(adultMarkup).not.toContain("data-avatar-aging-stage");
    expect(greyMarkup).toContain('data-avatar-aging-stage="grey"');
    expect(whiteMarkup).toContain('data-avatar-aging-stage="white"');
    expect(lichMarkup).toContain('data-avatar-aging-stage="lich"');
    expect(lichMarkup).toContain('fill="#A9FFF4"');
    expect(compactLichMarkup).toContain('data-avatar-aging-stage="lich"');
    expect(compactLichMarkup).toContain('data-avatar-render-mode="compact"');
  });
});

function renderAvatar(age: number, renderMode: "detailed" | "compact" = "detailed") {
  return renderToStaticMarkup(
    <RiderAvatar
      profileKey="europe_west"
      seed={-90_055_040}
      riderId={`aging-${age}`}
      age={age}
      renderMode={renderMode}
    />,
  );
}
