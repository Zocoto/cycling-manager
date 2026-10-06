import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FREE_AGENT_RIDER_JERSEY } from "@/lib/rider-jersey";
import { PcmGalaRegistrationPanel } from "./pcm-gala-registration-panel";
import { SeasonFinaleGalaPresentation } from "./season-finale-gala-presentation";
import { SeasonFinaleGalaReplay } from "./season-finale-gala-replay";
import { PcmGalaStartlistExportPanel } from "./pcm-gala-startlist-export-panel";

const context = { riders: [], eventStatuses: { "gala-des-puncheurs": "open" as const }, rosterSize: 7, selectedEventKey: null, selectedRiderIds: [], publicStartlists: {}, jersey: FREE_AGENT_RIDER_JERSEY };

describe("page du gala", () => {
  it("présente le format différé, les lots proposés et l'absence de gains habituels", () => {
    const html = renderToStaticMarkup(<SeasonFinaleGalaPresentation />);
    expect(html).toContain("Grand Gala de fin de saison");
    expect(html).toContain("Pas de live");
    expect(html).toContain("Aucun effet sur la forme");
    expect(html).toContain("Ni argent, ni points de classement");
    expect(html).not.toContain("À confirmer");
    expect(html).toContain("hors-circuit");
    expect(html).toContain("chaque groupe");
    expect(html).toContain("Gants de Gala");
    expect(html).toContain('href="#inscriptions-gala"');
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html.match(/<article /g)).toHaveLength(5);
    expect(html).not.toContain("Découvrir les lots");
    expect(html).not.toContain("<nav");
    expect(html).toContain("Jeudi 8 octobre à 12 h (J28), heure de Paris");
    expect(html).toContain('dateTime="2026-10-08T12:00:00+02:00"');
    expect(html).toContain("vendredi 9 octobre après-midi");
    expect(html).toContain("leur identité de la saison prochaine");
    expect(html).not.toContain("clôture des inscriptions à venir");
  });
  it("n'affiche que le profil vallonné et propose six à huit coureurs", () => {
    const html = renderToStaticMarkup(<PcmGalaRegistrationPanel {...context} seasonFinale />);
    expect(html).toContain("Le parcours du gala");
    expect(html).toContain("205 km");
    expect(html).toContain('value="gala-des-puncheurs"');
    expect(html).not.toContain("Gala des Sommets");
    expect(html).not.toContain("Gala des Sprinteurs");
    expect(html).toContain("0/8");
    expect(html).toContain("6 minimum · 8 maximum");
    expect(html).toContain('stroke="#D2B46B"');
    expect(html).not.toContain("Étape 1");
    expect(html).not.toContain("Étape 2");
  });
  it("ne change pas le thème ni le sélecteur de l'ancien pilote à trois profils", () => {
    const html = renderToStaticMarkup(<PcmGalaRegistrationPanel {...context} />);
    expect(html).toContain("Gala des Sommets");
    expect(html).toContain("Gala des Sprinteurs");
    expect(html).toContain("0/7");
    expect(html).toContain('stroke="#176951"');
    expect(html).not.toContain('stroke="#D2B46B"');
  });
  it("garde l'extracteur administratif compact sans menu d'installation supplémentaire", () => {
    const html = renderToStaticMarkup(<PcmGalaStartlistExportPanel eventKey="gala-des-puncheurs" compact />);
    expect(html).toContain("Télécharger la startlist du gala");
    expect(html).toContain("Un XML par groupe");
    expect(html).not.toContain("<details");
    expect(html).not.toContain("Dernier export de cette session");
  });
  it("avertit avant de remplacer une inscription sur un ancien profil", () => {
    const html = renderToStaticMarkup(<PcmGalaRegistrationPanel {...context} selectedEventKey="gala-des-sommets" seasonFinale />);
    expect(html).toContain("remplacera cette ancienne inscription");
    expect(html).toContain('value="gala-des-puncheurs"');
  });
  it("affiche l'identité prochaine saison avant inscription et bloque une identité non confirmée", () => {
    const identity = { team_id: "team", identity_season: 4, team_name: "Futur sponsor - Secondaire", team_short_name: "FUT", team_country_code: "fr", registration_country_id: "country", sponsor_catalog_key: null, jersey_id: null, jersey_style: null, identity_ready: true };
    const html = renderToStaticMarkup(<PcmGalaRegistrationPanel {...context} seasonFinale seasonFinaleIdentity={identity} />);
    expect(html).toContain("Votre identité pour la saison 4");
    expect(html).toContain("Futur sponsor - Secondaire");
    const pending = renderToStaticMarkup(<PcmGalaRegistrationPanel {...context} seasonFinale seasonFinaleIdentity={{ ...identity, identity_ready: false }} />);
    expect(pending).toContain("reste à confirmer");
    expect(pending).toContain('href="/jeu/sponsoring"');
  });
  it("ne charge aucun lecteur tiers avant le clic et n'invente pas de vidéo", () => {
    const waiting = renderToStaticMarkup(<SeasonFinaleGalaReplay videoId={null} />);
    const ready = renderToStaticMarkup(<SeasonFinaleGalaReplay videoId="Abcdef123_-" />);
    expect(waiting).toContain("Vidéo à venir après le gala");
    expect(waiting).not.toContain("<iframe");
    expect(ready).toContain("Charger et regarder le replay");
    expect(ready).not.toContain("<iframe");
  });
});
