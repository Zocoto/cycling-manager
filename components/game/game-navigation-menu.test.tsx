import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GameNavigationMenu } from "./game-navigation-menu";
import { PLAYER_TRACKING_ADMIN_EMAIL } from "@/lib/game/player-tracking-access";

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

  it("affiche l’entrée fédération uniquement pour la bêta belge", () => {
    const belgianMarkup = renderToStaticMarkup(
      <GameNavigationMenu federationCountryCode="BE" />,
    );
    const otherMarkup = renderToStaticMarkup(
      <GameNavigationMenu federationCountryCode="FR" />,
    );

    expect(belgianMarkup).toContain('href="/jeu/federations/be"');
    expect(belgianMarkup).toContain("fi-be");
    expect(belgianMarkup).toContain("Fédération");
    expect(otherMarkup).not.toContain('href="/jeu/federations/be"');
  });

  it("masque les indicateurs de chargement qui se déforment dans le menu contextuel", () => {
    const markup = renderToStaticMarkup(<GameNavigationMenu />);

    expect(markup).not.toContain("app-link-pending-indicator");
  });
  it("masque le suivi des joueurs aux comptes ordinaires", () => {
    const markup = renderToStaticMarkup(
      <GameNavigationMenu viewerEmail="membre@example.com" />,
    );

    expect(markup).not.toContain("/jeu/suivi-joueurs");
    expect(markup).not.toContain("Suivi des joueurs");
  });

  it("affiche le suivi des joueurs uniquement au compte administrateur", () => {
    const markup = renderToStaticMarkup(
      <GameNavigationMenu viewerEmail={PLAYER_TRACKING_ADMIN_EMAIL} />,
    );

    expect(markup).toContain('href="/jeu/suivi-joueurs"');
    expect(markup).toContain("Suivi des joueurs");
  });

  it("conserve le raccourci privilégié dans le bandeau supérieur", () => {
    const headerSource = readFileSync(
      resolve(process.cwd(), "components/game/game-header.tsx"),
      "utf8",
    ).replace(/\r\n/g, "\n");

    expect(headerSource).toContain("federationCountryCode={federationCountryCode}");
    expect(headerSource).toContain(
      "canAccessRaceSimulator(simulatorEmail) ? (",
    );
    expect(headerSource).toContain("<RaceSimulatorShortcut isEnglish={isEnglish} />");
    expect(headerSource).not.toContain("showRaceSimulator");
  });
});
