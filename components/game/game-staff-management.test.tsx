import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GameStaffMember } from "@/lib/game/game-product-news";
import { GameStaffManagement } from "./game-staff-management";

const members: GameStaffMember[] = [
  { userId: "owner-id", directorId: "director-owner", displayName: "Fondateur", role: "owner" },
  { userId: "staff-id", directorId: "director-staff", displayName: "Référent de jeu", role: "game_staff" },
];
const action = async () => ({ status: "success" as const, message: "Enregistré" });

describe("GameStaffManagement", () => {
  it("shows a protected owner and only allows removing delegated staff", () => {
    const html = renderToStaticMarkup(<GameStaffManagement members={members} searchAction={action} roleAction={action} />);
    expect(html).toContain("Fondateur · accès protégé");
    expect(html).toContain('aria-label="Retirer le rôle de Référent de jeu"');
    expect(html).not.toContain('aria-label="Retirer le rôle de Fondateur"');
    expect(html).toContain('name="enabled" value="false"');
    expect(html).toContain('name="user_id" value="staff-id"');
    expect(html).not.toContain('name="user_id" value="owner-id"');
  });

  it("requires an explicit bounded search, does not grant a role in the search form", () => {
    const html = renderToStaticMarkup(<GameStaffManagement members={members} searchAction={action} roleAction={action} />);
    expect(html).toContain('name="query"');
    expect(html).toContain('minLength="2"');
    expect(html).toContain('maxLength="60"');
    expect(html).toContain("Aucun accès n’est accordé automatiquement");
    expect(html).not.toContain('name="enabled" value="true"');
    expect(html).toContain("Ce rôle ne donne pas accès à la gestion des autres membres");
  });

  it("does not fetch on keystrokes, poll, import server actions or automatically mutate roles", () => {
    const source = readFileSync(new URL("./game-staff-management.tsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/useEffect|onChange|setInterval|fetch\(/);
    expect(source).not.toMatch(/from ["']@\/app\/.+actions/);
    expect(source).toContain('name="enabled" value="true"');
    expect(source).toContain("existingMembers.has(candidate.userId)");
  });

  it("escapes member names and has a clear empty state", () => {
    const html = renderToStaticMarkup(<GameStaffManagement members={[{ ...members[1], displayName: "<script>bad()</script>" }]} searchAction={action} roleAction={action} />);
    expect(html).not.toContain("<script>bad()");
    expect(html).toContain("&lt;script&gt;");
    expect(renderToStaticMarkup(<GameStaffManagement members={[]} searchAction={action} roleAction={action} />)).toContain("Aucun membre délégué pour le moment");
  });
});
