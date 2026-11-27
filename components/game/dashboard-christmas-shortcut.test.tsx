import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import {DashboardChristmasShortcut} from "./dashboard-christmas-shortcut";
import {getGameNavigationEvents} from "@/lib/game/game-navigation";

describe("Christmas public entry",()=>{
  it("does not expose a public shortcut before server opening",()=>{
    const now=new Date("2026-11-30T22:59:59.999Z");
    expect(renderToStaticMarkup(<DashboardChristmasShortcut now={now}/>)).toBe("");
    expect(getGameNavigationEvents("fr",now).some(([,href])=>href==="/jeu/noel")).toBe(false);
  });
  it("adds the event beside the existing events without a new fixed header button",()=>{
    const now=new Date("2026-11-30T23:00:00Z");
    expect(renderToStaticMarkup(<DashboardChristmasShortcut now={now}/>)).toContain('href="/jeu/noel"');
    expect(getGameNavigationEvents("en",now)).toContainEqual(["Christmas in the peloton","/jeu/noel"]);
    expect(getGameNavigationEvents("fr",now)).toContainEqual(["Le Grand Gala · Saison 4","/jeu/gala-saison-4"]);
  });
  it("hides the limited-time entry at the end of December",()=>{
    const now=new Date("2026-12-31T23:00:00Z");
    expect(renderToStaticMarkup(<DashboardChristmasShortcut now={now}/>)).toBe("");
    expect(getGameNavigationEvents("fr",now)).not.toContainEqual(["Le Noël du Peloton","/jeu/noel"]);
  });
});
