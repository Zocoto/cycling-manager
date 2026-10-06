import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FREE_AGENT_RIDER_JERSEY } from "@/lib/rider-jersey";
import { PcmGalaRegistrationPanel } from "./pcm-gala-registration-panel";
import { SeasonFinaleGalaPresentation } from "./season-finale-gala-presentation";
import { SeasonFinaleGalaReplay } from "./season-finale-gala-replay";

const context = { riders: [], eventStatuses: { "gala-des-puncheurs": "open" as const }, rosterSize: 7, selectedEventKey: null, selectedRiderIds: [], publicStartlists: {}, jersey: FREE_AGENT_RIDER_JERSEY };

describe("page du gala", () => {
  it("présente le format différé, les lots proposés et l'absence de gains habituels", () => {
    const html = renderToStaticMarkup(<SeasonFinaleGalaPresentation />);
    expect(html).toContain("Grand Gala de fin de saison");
    expect(html).toContain("Pas de live");
    expect(html).toContain("Aucun effet sur la forme");
    expect(html).toContain("Ni argent, ni points de classement");
    expect(html).toContain("À confirmer");
    expect(html).toContain("Gants de Gala");
    expect(html).toContain('href="#inscriptions-gala"');
  });
  it("n'affiche que le profil vallonné et conserve les sept places", () => {
    const html = renderToStaticMarkup(<PcmGalaRegistrationPanel {...context} seasonFinale />);
    expect(html).toContain("Le parcours du gala");
    expect(html).toContain("205 km");
    expect(html).toContain('value="gala-des-puncheurs"');
    expect(html).not.toContain("Gala des Sommets");
    expect(html).not.toContain("Gala des Sprinteurs");
    expect(html).toContain("0/7");
  });
  it("avertit avant de remplacer une inscription sur un ancien profil", () => {
    const html = renderToStaticMarkup(<PcmGalaRegistrationPanel {...context} selectedEventKey="gala-des-sommets" seasonFinale />);
    expect(html).toContain("remplacera cette ancienne inscription");
    expect(html).toContain('value="gala-des-puncheurs"');
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
