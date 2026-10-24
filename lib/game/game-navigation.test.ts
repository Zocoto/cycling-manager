import {existsSync,readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe,expect,it} from "vitest";
import {
  NAVIGATION_GROUPS_FR,NAVIGATION_GROUPS_EN,NAVIGATION_EVENTS_FR,
  getGameNavigationGroups,getActiveGameNavigationGroupId,getActiveGameNavigationHref,
} from "./game-navigation";
import {getMobileMoreNavigationGroups} from "./mobile-navigation";

describe("shared management navigation",()=>{
  it("keeps the six approved families in the same order and with the same routes in both languages",()=>{
    const ids=["team","races","equipment","club","federation","community"];
    expect(NAVIGATION_GROUPS_FR.map(group=>group.id)).toEqual(ids);
    expect(NAVIGATION_GROUPS_EN.map(group=>group.id)).toEqual(ids);
    expect(NAVIGATION_GROUPS_FR.map(group=>group.label)).toEqual(["Équipe & staff","Courses & résultats","Matériel & inventaire","Gestion du club","Fédération & championnats","Vie du jeu & aide"]);
    expect(NAVIGATION_GROUPS_EN.map(group=>group.links.map(([,href])=>href))).toEqual(NAVIGATION_GROUPS_FR.map(group=>group.links.map(([,href])=>href)));
  });
  it("points every permanent destination to a real existing game page, once only",()=>{
    const hrefs=NAVIGATION_GROUPS_FR.flatMap(group=>group.links.map(([,href])=>href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for(const href of hrefs)expect(existsSync(resolve(process.cwd(),"app",href.slice(1),"page.tsx")),href).toBe(true);
    expect(hrefs).not.toContain("/jeu");
    expect(hrefs).not.toContain("/jeu/gala-saison-4");
    expect(hrefs).not.toContain("/jeu/album");
    expect(hrefs.join(" ")).not.toMatch(/administration|simulateur|export-pcm|suivi-joueurs|apercus/);
    expect(NAVIGATION_EVENTS_FR).toContainEqual(["Le Grand Gala · Saison 4","/jeu/gala-saison-4"]);
  });
  it.each(["fr","en"])("preserves all previous ordinary destinations with contextual jerseys (%s)",locale=>{
    const hrefs=getGameNavigationGroups({locale,showJerseyWorkshop:true}).flatMap(group=>group.links.map(([,href])=>href));
    for(const href of ["equipe","effectif","objectifs","calendrier","resultats","classements","entrainement","centre-de-soin","centre-de-formation","championnats-internationaux","selections-internationales","staff","transferts","sponsoring","finances","infrastructures","materiel","materiel/equipementier","inventaire","maillot","fan-club","chat","recherche","nouveautes","guide"])expect(hrefs).toContain(`/jeu/${href}`);
  });
  it("shows the workshop only for amateur teams and does not mutate the common inventory",()=>{
    const before=JSON.stringify(NAVIGATION_GROUPS_FR);
    expect(getGameNavigationGroups().flatMap(group=>group.links).some(([,href])=>href==="/jeu/maillot")).toBe(false);
    expect(getGameNavigationGroups({showJerseyWorkshop:true})[0].links[1]).toEqual(["Atelier du maillot","/jeu/maillot"]);
    expect(getGameNavigationGroups({locale:"en",showJerseyWorkshop:true})[0].links[1][0]).toBe("Jersey workshop");
    getGameNavigationGroups({federationCountryCode:"BE"});
    expect(JSON.stringify(NAVIGATION_GROUPS_FR)).toBe(before);
  });
  it.each(["BE"," be ","fr"])("uses the existing country-specific federation route for %s",country=>{
    const group=getGameNavigationGroups({federationCountryCode:country}).find(group=>group.id==="federation")!;
    expect(group.links[0][1]).toBe(`/jeu/federations/${country.trim().toLowerCase()}`);
  });
  it.each([null,"","../admin","belgium","<script>"])("keeps the safe federation redirect when no valid country is known: %s",country=>{
    expect(getGameNavigationGroups({federationCountryCode:country}).find(group=>group.id==="federation")!.links[0][1]).toBe("/jeu/federation");
  });
  it.each([
    ["/jeu/materiel/laboratoire","/jeu/materiel/laboratoire","equipment"],
    ["/jeu/materiel/equiper","/jeu/materiel/equiper","equipment"],
    ["/jeu/materiel/equipementier","/jeu/materiel/equipementier","equipment"],
    ["/jeu/effectif","/jeu/effectif","team"],
    ["/jeu/staff/formations","/jeu/staff","team"],
    ["/jeu/championnats-nationaux/route","/jeu/championnats-nationaux","federation"],
    ["/jeu/selections-internationales","/jeu/selections-internationales","federation"],
    ["/jeu/coureurs/example",null,"team"],
    ["/jeu/courses/example",null,"races"],
    ["/jeu/nations/be",null,"federation"],
    ["/jeu",null,null],
    ["/jeu/materiel-inconnu",null,null],
  ])("selects the most precise page and family for %s",(pathname,href,id)=>{
    const groups=getGameNavigationGroups();
    expect(getActiveGameNavigationHref(groups,pathname)).toBe(href);
    expect(getActiveGameNavigationGroupId(groups,pathname)).toBe(id);
  });
  it("retains the same six stable family IDs in mobile More without duplicating the dock",()=>{
    const groups=getMobileMoreNavigationGroups(getGameNavigationGroups());
    expect(groups.map(group=>group.id)).toEqual(NAVIGATION_GROUPS_FR.map(group=>group.id));
    const hrefs=groups.flatMap(group=>group.links.map(([,href])=>href));
    for(const href of ["/jeu","/jeu/effectif","/jeu/transferts","/jeu/calendrier","/jeu/preparation-course","/jeu/resultats"])expect(hrefs).not.toContain(href);
    expect(hrefs).toContain("/jeu/materiel/laboratoire");
    expect(hrefs).toContain("/jeu/guide");
  });
  it("does not fetch game data or prefetch the dashboard destinations",()=>{
    const source=readFileSync(resolve(process.cwd(),"components/game/dashboard-management-navigation.tsx"),"utf8");
    expect(source).not.toContain('"use client"');
    expect(source).toContain("prefetch={false}");
    expect(source).not.toMatch(/createSupabase|\.rpc\(|\bfetch\(|useEffect|prefetchOnIntent/);
  });
});
