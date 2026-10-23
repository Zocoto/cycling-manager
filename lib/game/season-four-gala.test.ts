import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canAccessSeasonFourGala } from "./season-four-gala-access";
import { GALA_COURSES, GALA_PODIUM_PROPOSAL, GALA_PROGRAM_PROFILES, SEASON_FOUR_GALA, galaClubCapacity } from "./season-four-gala";
import baseProfiles from "./season-four-gala-base-profiles.json";

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
  it("uses vanilla stage references and derived altitude positions without edition dates in names",()=>{
    expect(Object.values(GALA_COURSES).map(course=>course.filename)).toEqual(['top_tdf_18_2022','topclas_maastricht_2018','topclas_roubaix_2018','c0_schelde_2015']);
    for(const [profile,source] of Object.entries(baseProfiles)){
      const course=GALA_COURSES[profile as keyof typeof GALA_COURSES];
      expect(course.name).not.toMatch(/\b20\d{2}\b/);
      expect(source.source).toContain('PCM26 base');
      expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(source.sourcePointCount).toBeGreaterThan(700);
      expect(course.elevationPositions?.length).toBe(course.elevation.length);
      expect(course.elevation.length).toBeLessThanOrEqual(194);
      expect(course.elevationPositions?.[0]).toBe(0);
      expect(course.elevationPositions?.at(-1)).toBe(1);
      expect(course.elevationPositions?.every((position,index,list)=>Number.isFinite(position)&&position>=0&&position<=1&&(!index||position>list[index-1]))).toBe(true);
      expect(course.elevation.every(height=>Number.isFinite(height)&&height>=0&&height<=101)).toBe(true);
    }
    expect(GALA_COURSES.hills.elevation.filter(height=>height>40).length).toBeGreaterThan(10);
    expect(Math.max(...GALA_COURSES.sprint.elevation)).toBeLessThan(17);
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
