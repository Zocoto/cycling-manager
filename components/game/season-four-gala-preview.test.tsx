import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SeasonFourGalaPreview } from "./season-four-gala-preview";

vi.mock("./dashboard-halloween-shortcut",()=>({DashboardHalloweenShortcut:vi.fn(()=> <a href="/jeu/halloween">Halloween</a>)}));
import { DashboardSeasonFourGalaEvents } from "./dashboard-season-four-gala-events";

describe("private gala presentation",()=>{
  it("shows the host avatar and correct Twitch destination with no live embed",()=>{
    const html=renderToStaticMarkup(<SeasonFourGalaPreview/>);
    expect(html).toContain('https://www.twitch.tv/gouille_tw');
    expect(html).toContain('Logo de la chaîne Twitch de Gouille');
    expect(html).not.toContain('<iframe');
    expect(html).toContain('Horaire à venir');
  });
  it("shows profile-based podium rewards, seven remaining top-ten places and live gifts",()=>{
    const html=renderToStaticMarkup(<SeasonFourGalaPreview/>);
    for(const label of ['World Tour','Continental','+3 MON','+2 MON','+1 MON','4e–5e','6e–7e','8e–10e','2 boosters Cyclo-Stickers','+1 PLA'])expect(html).toContain(label);
    expect(html).toContain('bonus d’équipement inclus');
    expect(html).toContain('Parcours &amp; capacité PCM');
  });
  it("keeps demo participants and favorites inside explicit disclosures",()=>{
    const html=renderToStaticMarkup(<SeasonFourGalaPreview/>);
    expect(html.match(/Maillots &amp; engagés/g)).toHaveLength(3);
    expect(html.match(/Classement fictif/g)).toHaveLength(3);
    expect(html).not.toContain('<form');
  });
  it("does not expose the private event tile to any other player",async()=>{
    const other=renderToStaticMarkup(await DashboardSeasonFourGalaEvents({userId:'another-player'}));
    expect(other).toContain('Halloween');expect(other).not.toContain('/jeu/gala-saison-4');
    const owner=renderToStaticMarkup(await DashboardSeasonFourGalaEvents({userId:'58140add-54c6-40af-9528-f823d0051d0f'}));
    expect(owner).toContain('/jeu/gala-saison-4');expect(owner).toContain('/jeu/halloween');
    expect(owner).toContain('data-with-halloween="true"');
  });
});
