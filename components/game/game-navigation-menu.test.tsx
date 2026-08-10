import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GameNavigationMenu } from "./game-navigation-menu";

describe("GameNavigationMenu", () => {
  it("ne révèle jamais le simulateur dans le menu", () => {
    const markup = renderToStaticMarkup(<GameNavigationMenu />);

    expect(markup).not.toContain("/jeu/simulateur-course");
    expect(markup).not.toContain("Simulateur de course");
  });

  it("conserve un accès permanent au parrainage dans le menu principal", () => {
    const markup = renderToStaticMarkup(<GameNavigationMenu />);

    expect(markup).toContain('href="/jeu/parrainage"');
    expect(markup).toContain('href="/jeu/parrainage">Parrainage');
  });

  it("conserve le raccourci privilégié dans le bandeau supérieur", () => {
    const headerSource = readFileSync(
      resolve(process.cwd(), "components/game/game-header.tsx"),
      "utf8",
    ).replace(/\r\n/g, "\n");

    expect(headerSource).toContain("<GameNavigationMenu />");
    expect(headerSource).toContain(
      "canAccessRaceSimulator(simulatorEmail) ? (",
    );
    expect(headerSource).toContain("<RaceSimulatorShortcut />");
    expect(headerSource).not.toContain("showRaceSimulator");
  });
});