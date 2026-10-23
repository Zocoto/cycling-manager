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
    for(const label of ['World Tour','Continental','+3 MON','+2 MON','+1 MON','4e','5e','6e–7e','8e–10e','2 boosters Cyclo-Stickers','+1 VAL'])expect(html).toContain(label);
    expect(html).not.toContain('bonus d’équipement inclus');
    expect(html).not.toContain('+1 PLA');
    const live=html.slice(html.indexOf('gouille-live-title'),html.indexOf('id="recompenses-gala"'));
    expect(live).toContain('Gants · Nuit dorée');expect(live).toContain('2 boosters Cyclo-Stickers');
    expect(html).toContain('7 à 8 coureurs');
    expect(html).toContain('Les gains du top 10.');
    expect(html).toContain('Parcours &amp; capacité PCM');
  });
  it("keeps demo participants and favorites inside explicit disclosures",()=>{
    const html=renderToStaticMarkup(<SeasonFourGalaPreview/>);
    expect(html.match(/Maillots &amp; engagés/g)).toHaveLength(3);
    expect(html.match(/Classement fictif/g)).toHaveLength(3);
    expect(html).not.toContain('<form');
  });
  it("explains usable consumables and the exclusive programme choice without organizer notes",()=>{
    const html=renderToStaticMarkup(<SeasonFourGalaPreview/>);
    for(const text of ['Cuissard · Éclat de Gala','Un seul format pour l’équipe','World Tour','Continental','Perfectionnement technique','Bloc haute intensité','Ration énergétique','Trousse de récupération','pas en cumul sur une seule','ne sont pas utilisés automatiquement'])expect(html).toContain(text);
    expect(html).not.toContain('Les derniers points à caler ensemble');
    expect(html).not.toContain('Roue avant · Éclat de Gala');
    expect(html).not.toContain('×2 pendant 3 jours');
    expect(html).not.toContain('Amstel Gold Race · 2023');
    expect(html).not.toContain('Paris–Roubaix · 2026');
  });
  it("exposes the event tile to all players without a draft label or extra player lookup",async()=>{
    const other=renderToStaticMarkup(await DashboardSeasonFourGalaEvents({userId:'another-player'}));
    expect(other).toContain('Halloween');expect(other).toContain('/jeu/gala-saison-4');expect(other).not.toMatch(/draft/i);
    const owner=renderToStaticMarkup(await DashboardSeasonFourGalaEvents({userId:'58140add-54c6-40af-9528-f823d0051d0f'}));
    expect(owner).toContain('/jeu/gala-saison-4');expect(owner).toContain('/jeu/halloween');
    expect(owner).toContain('data-with-halloween="true"');
  });
  it('uses real registrations for the public page and hides organizer exports by default',()=>{
    const html=renderToStaticMarkup(<SeasonFourGalaPreview context={{isOpen:true,team:null,program:null,selections:{},riders:[],counts:{"world-tour":0,continental:0}}}/>);
    expect(html).toContain('Inscriptions ouvertes');expect(html).toContain('Jeudi 5 novembre');
    expect(html).not.toContain('Classement fictif');expect(html).not.toContain('Vélo Club des Cimes');
    expect(html).not.toContain('Organisation · Exports PCM');expect(html).not.toMatch(/draft/i);
  });
  it('combines the format, course profiles and independent lineups before the live and collapsed rewards',()=>{
    const html=renderToStaticMarkup(<SeasonFourGalaPreview context={{isOpen:true,team:{id:'team',name:'Club'},program:'world-tour',selections:{},counts:{'world-tour':1,continental:0},riders:[{rider_id:'00000000-0000-4000-8000-000000000001',first_name:'Rider',last_name:'Test',mountain:73,hills:61,flat:68,time_trial:62,cobbles:59,sprint:66}]}}/>);
    expect(html.match(/<button(?=[^>]*name="intent")(?=[^>]*value="save-course")[^>]*>/g)).toHaveLength(3);
    expect(html).not.toContain('Valider les trois compositions');
    expect(html).not.toContain('Cyclo Stratège · Le rendez-vous de fin de saison');
    expect(html).not.toContain('Une soirée pour faire briller le peloton');
    expect(html).not.toContain('Des inscriptions ouvertes, un choix éclairé.');
    expect(html).toContain('<small>VAL</small><b>61</b>');
    expect(html).toContain('<small>MON</small><b>73</b>');
    expect(html.indexOf('id="programme-gala"')).toBeLessThan(html.indexOf('gouille-live-title'));
    expect(html).toMatch(/<details id="recompenses-gala"[^>]*>/);
    expect(html).not.toMatch(/<details id="recompenses-gala"[^>]*\bopen/);
  });
});
