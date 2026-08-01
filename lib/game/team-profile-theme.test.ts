import { describe, expect, it } from "vitest";

import { createTeamProfileTheme } from "./team-profile-theme";

describe("createTeamProfileTheme", () => {
  it("assombrit une couleur claire pour conserver un bandeau lisible", () => {
    const theme = createTeamProfileTheme({
      primary: "#F5D547",
      secondary: "#FFFFFF",
      accent: "#12263A",
      background: "#FFF9E6",
      text: "#12263A",
    });

    expect(theme.primary).not.toBe("#F5D547");
    expect(theme.primary).toMatch(/^#[0-9A-F]{6}$/);
    expect(theme.accent).not.toBe("#12263A");
    expect(theme.line).toMatch(/^rgba\(/);
  });

  it("produit des palettes distinctes selon les couleurs de l??quipe", () => {
    const blue = createTeamProfileTheme({
      primary: "#164C7B",
      secondary: "#B9E4EA",
      accent: "#E8B44F",
    });
    const red = createTeamProfileTheme({
      primary: "#9F2635",
      secondary: "#123F45",
      accent: "#E2B653",
    });

    expect(blue.primary).not.toBe(red.primary);
    expect(blue.soft).not.toBe(red.soft);
  });
});
