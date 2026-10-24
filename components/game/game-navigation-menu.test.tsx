import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach,describe, expect, it,vi } from "vitest";
import {NAVIGATION_GROUPS_FR} from "@/lib/game/game-navigation";
const navigationState=vi.hoisted(()=>({locale:"fr",pathname:"/jeu"}));
vi.mock("next/navigation",()=>({usePathname:()=>navigationState.pathname}));
vi.mock("@/components/i18n/locale-provider",()=>({useLocale:()=>({locale:navigationState.locale})}));
beforeEach(()=>{navigationState.locale="fr";navigationState.pathname="/jeu";});

import { GameNavigationMenu } from "./game-navigation-menu";
import { PLAYER_TRACKING_ADMIN_EMAIL } from "@/lib/game/player-tracking-access";

describe("GameNavigationMenu", () => {
  it("retire le gala du menu du jeu", () => {
    const markup = renderToStaticMarkup(<GameNavigationMenu viewerEmail="membre@example.com" />);
    expect(markup).not.toContain('href="/jeu/gala-fin-de-saison"');
    expect(markup).not.toContain("Grand Gala de fin de saison");
  });
  it("ne révèle jamais le simulateur dans le menu", () => {
    const markup = renderToStaticMarkup(<GameNavigationMenu />);

    expect(markup).not.toContain("/jeu/simulateur-course");
    expect(markup).not.toContain("Simulateur de course");
  });

  it("réserve le parrainage au menu utilisateur", () => {
    const markup = renderToStaticMarkup(<GameNavigationMenu />);
    const headerSource = readFileSync(
      resolve(process.cwd(), "components/game/game-header.tsx"),
      "utf8",
    );

    expect(markup).not.toContain('href="/jeu/parrainage"');
    expect(headerSource).not.toContain('href="/jeu/parrainage"');
  });

  it("affiche toujours le Fan-club et retire les doublons du menu utilisateur", () => {
    const markup = renderToStaticMarkup(<GameNavigationMenu />);

    expect(markup).toContain('href="/jeu/fan-club"');
    expect(markup).toContain("Fan-club &amp; boutique");
    expect(markup).not.toContain('href="/jeu/directeur-sportif"');
    expect(markup).not.toContain('href="/guide"');
    expect(markup).toContain('href="/jeu/guide"');
    expect(markup).toContain('href="/jeu/nouveautes"');
    expect(markup).not.toContain('target="_blank"');
  });

  it("affiche l’entrée fédération correspondant au pays du sponsor", () => {
    const belgianMarkup = renderToStaticMarkup(
      <GameNavigationMenu federationCountryCode="BE" />,
    );
    const otherMarkup = renderToStaticMarkup(
      <GameNavigationMenu federationCountryCode="FR" />,
    );

    expect(belgianMarkup).toContain('href="/jeu/federations/be"');
    expect(belgianMarkup).toContain("fi-be");
    expect(belgianMarkup).toContain("Ma fédération");
    expect(otherMarkup).toContain('href="/jeu/federations/fr"');
    expect(otherMarkup).toContain("fi-fr");
    expect(belgianMarkup).not.toContain("Bêta belge");
  });

  it("masque les indicateurs de chargement qui se déforment dans le menu contextuel", () => {
    const markup = renderToStaticMarkup(<GameNavigationMenu />);

    expect(markup).not.toContain("app-link-pending-indicator");
  });
  it("renders the six validated groups and keeps the office above them",()=>{
    const markup=renderToStaticMarkup(<GameNavigationMenu/>);
    expect([...markup.matchAll(/data-navigation-group="([^"]+)"/g)].map(match=>match[1])).toEqual(NAVIGATION_GROUPS_FR.map(group=>group.id));
    expect(markup.indexOf('href="/jeu"')).toBeLessThan(markup.indexOf('data-navigation-group="team"'));
    for(const href of ["/jeu/preparation-course","/jeu/materiel/equiper","/jeu/materiel/laboratoire","/jeu/championnats-nationaux"])expect(markup).toContain(`href="${href}"`);
  });
  it("keeps the public S4 gala separate from permanent management",()=>{
    const markup=renderToStaticMarkup(<GameNavigationMenu/>);
    expect(markup).toContain('href="/jeu/gala-saison-4"');
    expect(markup).toContain("Événements");
    expect(markup).not.toContain('href="/jeu/album"');
  });
  it("shows the amateur jersey workshop only when explicitly applicable",()=>{
    expect(renderToStaticMarkup(<GameNavigationMenu/>)).not.toContain('href="/jeu/maillot"');
    expect(renderToStaticMarkup(<GameNavigationMenu showJerseyWorkshop/>)).toContain('href="/jeu/maillot"');
  });
  it("renders the English groups and highlights only the actual material subpage",()=>{
    navigationState.locale="en";navigationState.pathname="/jeu/materiel/laboratoire";
    const markup=renderToStaticMarkup(<GameNavigationMenu federationCountryCode="BE"/>);
    expect(markup).toContain("Team &amp; staff");expect(markup).toContain("Equipment &amp; inventory");
    expect(markup).toContain("My riders’ call-ups");expect(markup).toContain("My federation");
    expect(markup).toContain('href="/jeu/federations/be"');
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup.match(/<a\b[^>]*aria-current="page"[^>]*>/)?.[0]).toContain('href="/jeu/materiel/laboratoire"');
  });
  it("masque le suivi des joueurs aux comptes ordinaires", () => {
    const markup = renderToStaticMarkup(
      <GameNavigationMenu viewerEmail="membre@example.com" />,
    );

    expect(markup).not.toContain("/jeu/suivi-joueurs");
    expect(markup).not.toContain("Suivi des joueurs");
    expect(markup).not.toContain("/jeu/export-pcm");
    expect(markup).not.toContain("Export PCM26");
  });

  it("affiche le suivi des joueurs uniquement au compte administrateur", () => {
    const markup = renderToStaticMarkup(
      <GameNavigationMenu viewerEmail={PLAYER_TRACKING_ADMIN_EMAIL} />,
    );

    expect(markup).toContain('href="/jeu/suivi-joueurs"');
    expect(markup).toContain("Suivi des joueurs");
    expect(markup).toContain('href="/jeu/export-pcm"');
    expect(markup).toContain("Export PCM26");
  });

  it("conserve le raccourci privilégié dans le bandeau supérieur", () => {
    const headerSource = readFileSync(
      resolve(process.cwd(), "components/game/game-header.tsx"),
      "utf8",
    ).replace(/\r\n/g, "\n");

    expect(headerSource).toContain("federationCountryCode={federationCountryCode}");
    expect(headerSource).toContain(
      "canAccessRaceSimulator(simulatorEmail) || gameStaffRole ? (",
    );
    expect(headerSource).toContain("<RaceSimulatorShortcut isEnglish={isEnglish} />");
    expect(headerSource).not.toContain("showRaceSimulator");
  });
});
