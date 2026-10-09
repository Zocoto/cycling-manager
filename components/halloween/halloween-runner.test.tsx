import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { HalloweenState } from "@/lib/game/halloween-event";
import { HalloweenRunner } from "./halloween-runner";
import { HalloweenRunnerOverview } from "./halloween-runner-overview";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const state: HalloweenState = { state: "open", startsAt: "", endsAt: "", shopEndsAt: "", joined: true, coins: 0, tickets: 0, inventory: {}, obtained: {}, cosmetics: {}, purchases: {}, curse: null, pendingGift: null, bandages: 0, attempts: 0, drawn: false, activeRun: null, ranking: [], dailyRanking: [], riders: [], targets: [], projects: [] };

describe("écran de jeu dédié", () => {
  it("rend seulement l’écran et les deux grandes commandes, sans boutique ni classement", () => {
    const html = renderToStaticMarkup(createElement(HalloweenRunner, { state }));
    expect(html).toContain("data-halloween-console");
    expect(html).toContain('data-runner-action="jump"');
    expect(html).toContain('data-runner-action="duck"');
    expect(html).toContain("Sauter"); expect(html).toContain("Se baisser"); expect(html).toContain("Maintenir");
    expect(html).toContain("Jouer la poursuite");
    expect(html).not.toContain("<table"); expect(html).not.toContain("GameHeader");
    expect(html).toContain("/jeu/halloween?onglet=classements");
  });
  it("la page ne démarre pas d’essai au chargement et vérifie la connexion", () => {
    const page = readFileSync("app/jeu/halloween/poursuite/page.tsx", "utf8");
    expect(page).toContain("supabase.auth.getUser()");
    expect(page).toContain('supabase.rpc("get_current_halloween_state")');
    expect(page).toContain('if (!state.joined) redirect("/jeu/halloween")');
    expect(page).not.toMatch(/GameHeader|reviewOnly|start_halloween|halloweenRequest|\.insert\(|\.update\(/);
    const legacy = readFileSync("app/jeu/halloween/page.tsx", "utf8");
    expect(legacy).toContain('if (onglet === "poursuite") redirect("/jeu/halloween/poursuite")');
  });
  it("affiche l’essai restitué même après deux essais ordinaires, sans changer les commandes", () => {
    const html = renderToStaticMarkup(createElement(HalloweenRunner, { state: { ...state, attempts: 2, tickets: 0, replayAvailable: true } }));
    expect(html).toContain("Utiliser mon essai restitué");
    expect(html).toContain("1 essai gratuit restitué · scores et gains conservés");
    expect(html).toContain('data-runner-action="jump"');
    expect(html).toContain('data-runner-action="duck"');
    const ordinary = renderToStaticMarkup(createElement(HalloweenRunner, { state: { ...state, attempts: 2, replayAvailable: false } }));
    expect(ordinary).not.toContain("essai restitué");
  });
  it("la recette reste locale et les classements restent consultables hors du jeu", () => {
    const preview = readFileSync("app/apercus/halloween-recette/page.tsx", "utf8");
    expect(preview).toContain('process.env.NODE_ENV === "production"');
    expect(preview.indexOf('process.env.NODE_ENV === "production"')).toBeLessThan(preview.indexOf('onglet === "console"'));
    const html = renderToStaticMarkup(createElement(HalloweenRunnerOverview, { state }));
    expect(html).toContain("/jeu/halloween/poursuite"); expect(html).toContain("<table"); expect(html).not.toContain("<canvas");
  });
  it("protège la zone tactile et les safe areas sans bloquer les autres pages", () => {
    const css = readFileSync("components/halloween/halloween-console.css", "utf8");
    expect(css).toContain("height: 100dvh");
    expect(css).toContain("grid-template-rows: minmax(0, 1fr) auto");
    expect(css).toContain("env(safe-area-inset-bottom"); expect(css).toContain("touch-action: none");
    expect(css).toContain("body:has([data-halloween-console])");
    expect(css).toContain(".game-shell:has([data-halloween-console]) .tutorial-floating-launcher");
  });
});
