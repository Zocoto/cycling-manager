import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canAccessSeasonFourGala } from "./season-four-gala-access";
import { GALA_COURSES, GALA_PODIUM_PROPOSAL, GALA_PROGRAM_PROFILES, SEASON_FOUR_GALA, galaClubCapacity } from "./season-four-gala";

describe("private S4 gala rehearsal", () => {
  it("accepts only Zocoto's authenticated account ID", () => {
    expect(canAccessSeasonFourGala("58140add-54c6-40af-9528-f823d0051d0f")).toBe(true);
    for (const identity of [null,undefined,"Zocoto","owner","game_staff","paul.leblanc22@gmail.com","another-player"]) expect(canAccessSeasonFourGala(identity)).toBe(false);
  });
  it("authorizes the server page before loading its header and returns 404 to other accounts", () => {
    const page=readFileSync(join(process.cwd(),"app/jeu/gala-saison-4/page.tsx"),"utf8");
    expect(page).toContain('if (!canAccessSeasonFourGala(user.id)) notFound()');
    expect(page.indexOf('if (!canAccessSeasonFourGala(user.id))')).toBeLessThan(page.indexOf('getGameHeaderData(supabase,user.id)'));
    expect(page).toContain('index: false, follow: false');
    expect(page).not.toContain('searchParams');
  });
  it("defines two distinct three-race programs with shared mountain and hilly routes", () => {
    expect(GALA_PROGRAM_PROFILES['world-tour']).toEqual(['mountain','hills','cobbles']);
    expect(GALA_PROGRAM_PROFILES.continental).toEqual(['mountain','hills','sprint']);
    expect(SEASON_FOUR_GALA.date).toBe('2026-11-06');
    expect(SEASON_FOUR_GALA.twitchUrl).toBe('https://www.twitch.tv/gouille_tw');
    expect(SEASON_FOUR_GALA.liveBoosters).toBe(2);
  });
  it("reserves an indicative observer place without creating an enrollment limit", () => {
    expect(Object.values(GALA_COURSES).map(galaClubCapacity)).toEqual([22,24,24,19]);
    expect(Object.values(GALA_COURSES).every(course=>course.filename.length>0)).toBe(true);
  });
  it("uses the bib-shorts winner prize and existing equipment artwork", () => {
    expect(GALA_PODIUM_PROPOSAL.map(prize=>prize.rank)).toEqual([1,2,3]);
    expect(GALA_PODIUM_PROPOSAL[0].slot).toBe('bib_shorts');
    for(const item of [...GALA_PODIUM_PROPOSAL,{image:SEASON_FOUR_GALA.hostAvatar}]) expect(existsSync(join(process.cwd(),'public',item.image))).toBe(true);
    const page=readFileSync(join(process.cwd(),"components/game/season-four-gala-preview.tsx"),"utf8");
    expect(page).not.toMatch(/\.rpc\(|fetch\(|localStorage|sessionStorage/);
    expect(page).toContain('aucune inscription réelle');
  });
  it("reuses the atmospheric peloton as a non-interactive golden watermark",()=>{
    const css=readFileSync(join(process.cwd(),'components/game/season-four-gala.module.css'),'utf8');
    expect(css).toContain("url('/images/peloton-header.webp')");
    expect(css).toContain('pointer-events:none');
    expect(css).toContain('sepia(1)');
    expect(css).toContain('opacity:.17');
  });
});
