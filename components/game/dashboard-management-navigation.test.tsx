import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import {NAVIGATION_GROUPS_FR} from "@/lib/game/game-navigation";
import {DashboardManagementNavigation} from "./dashboard-management-navigation";

describe("dashboard management navigation",()=>{
  it("matches the six menu families and preserves one-click access to all of their pages",()=>{
    const html=renderToStaticMarkup(<DashboardManagementNavigation riderCount={40} teamRank={12} balanceLabel="123 456 €"/>);
    expect([...html.matchAll(/data-dashboard-navigation-group="([^"]+)"/g)].map(match=>match[1])).toEqual(NAVIGATION_GROUPS_FR.map(group=>group.id));
    for(const group of NAVIGATION_GROUPS_FR)for(const [,href] of group.links)expect(html).toContain(`href="${href}"`);
    expect(html).toContain("40 coureurs");expect(html).toContain("#12 UCI");expect(html).toContain("123 456 €");
    expect(html).toContain("data-navigation-medical-icon");
    expect(html).not.toContain("/jeu/maillot");expect(html).not.toContain("/jeu/album");expect(html).not.toContain("/jeu/export-pcm");
  });
  it("keeps contextual jerseys, the correct federation and the deferred fanclub status",()=>{
    const html=renderToStaticMarkup(<DashboardManagementNavigation federationCountryCode="BE" showJerseyWorkshop fanClubStatus={<p>Siège niveau 3</p>}/>);
    expect(html).toContain('href="/jeu/federations/be"');expect(html).not.toContain('href="/jeu/federation"');
    expect(html).toContain('href="/jeu/maillot"');expect(html).toContain("Siège niveau 3");
  });
});
