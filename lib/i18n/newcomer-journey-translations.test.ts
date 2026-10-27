import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translateUiText, UI_TRANSLATIONS } from "./ui-translations";
import { translateFrenchUiDate } from "./french-ui-date";
import { formatDashboardAssistantDate } from "@/lib/game/dashboard-assistant";

const source=readFileSync("supabase/migrations/20260920140000_create_newcomer_welcome_journey.sql","utf8");
const steps=[...source.matchAll(/\(\s*'([a-z_]+)',\s*(\d),\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*(\d+)\s*\)/g)];

describe("English newcomer journey",()=>{
  it("fully translates every real database title, description and chapter",()=>{
    expect(steps).toHaveLength(8);
    for(const step of steps)for(const text of [step[3],step[4],step[5]]){
      expect(UI_TRANSLATIONS[text],text).toBeTruthy();
      expect(translateUiText(text),text).toBe(UI_TRANSLATIONS[text]);
      expect(translateUiText(text),text).not.toBe(text);
    }
  });
  it.each([
    ["Faire une offre aux enchères","Place an auction bid"],
    ["S’inscrire à une course","Register for a race"],
    ["Placez une enchère sur un coureur du marché quotidien.","Place a bid on a rider in the daily auction market."],
    ["Choisissez une épreuve accessible et envoyez votre demande d’inscription.","Choose an eligible race and submit your entry."],
    ["Premières décisions","First decisions"],
    ["15 quotidiennes · 4 entre DS · prochaine clôture 11:27","15 daily auctions · 4 from other managers · next close 11:27"],
    ["23 quotidiennes · 8 entre DS · prochaine clôture 17:02","23 daily auctions · 8 from other managers · next close 17:02"],
    ["2 quotidiennes · 3 entre DS","2 daily auctions · 3 from other managers"],
    ["7 quotidiennes · prochaine clôture 08:12","7 daily auctions · next close 08:12"],
    ["6 entre DS · prochaine clôture 18:06","6 from other managers · next close 18:06"],
    ["5 quotidiennes","5 daily auctions"],
    ["2 entre DS","2 from other managers"],
  ])("does not leave French fragments in %s",(fr,en)=>expect(translateUiText(fr)).toBe(en));
  it("translates the capitalised assistant date completely without changing the French formatter",()=>{
    expect(formatDashboardAssistantDate("2026-10-27")).toBe("Mardi 27 octobre");
    expect(translateUiText(formatDashboardAssistantDate("2026-10-27"))).toBe("Tuesday 27 October");
    expect(translateUiText("  Mardi 27 octobre  ")).toBe("  Tuesday 27 October  ");
  });
  it.each([
    ["Lundi 26 octobre","Monday 26 October"],["Mardi 27 octobre","Tuesday 27 October"],
    ["Mercredi 28 octobre","Wednesday 28 October"],["Jeudi 29 octobre","Thursday 29 October"],
    ["Vendredi 30 octobre","Friday 30 October"],["Samedi 31 octobre","Saturday 31 October"],
    ["Dimanche 1 novembre","Sunday 1 November"],["29 février 2028","29 February 2028"],
    ["samedi 17 octobre 2026","Saturday 17 October 2026"],
  ])("recognises a complete date: %s",(fr,en)=>expect(translateFrenchUiDate(fr)).toBe(en));
  it.each(["Mardi Racing","Corto Maltese","Tuesday 27 October","31 février 2026","0 octobre","29 février 2027"])("does not reinterpret names, English text or invalid dates: %s",text=>{
    expect(translateFrenchUiDate(text)).toBeNull();
  });
});
