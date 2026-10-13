import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { halloweenToInventoryItems } from "@/lib/game/halloween-inventory";
import { HalloweenInventoryCard } from "./halloween-inventory-card";

vi.mock("@/components/ui/app-link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => createElement("a", { href }, children) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("carte d’objet Halloween", () => {
  it("montre le stock acheté, l’illustration, les limites et l’accès direct", () => {
    const html = renderToStaticMarkup(<HalloweenInventoryCard item={halloweenToInventoryItems({ "spectres-tea": 2 })[0]} />);
    expect(html).toContain("Tisane du spectre");
    expect(html).toContain("Possédé : 2");
    expect(html).toContain("Disponible : 2");
    expect(html).toContain('data-halloween-art="slimming-tea"');
    expect(html).toContain("Plusieurs doses possibles sur le même coureur");
    expect(html).not.toContain("Une seule dose");
    expect(html).toContain("Coureur bénéficiaire");
    expect(html).toContain("Quantité à utiliser");
    expect(html).toContain("Utiliser 1 exemplaire");
    expect(html).not.toMatch(/Acquérir|Nouvelle idée|non activée|à valider/);
  });
  it("permet de gérer un accessoire déjà porté", () => {
    const html = renderToStaticMarkup(<HalloweenInventoryCard item={halloweenToInventoryItems({ "pumpkin-cap": 1 }, { hat: "pumpkin-cap" })[0]} />);
    expect(html).toContain("Porté sur votre portrait");
    expect(html).toContain("Gérer cet accessoire");
  });
  it("relie la page principale, les compteurs du bureau et les ancres de collection", () => {
    const page = readFileSync("app/jeu/inventaire/page.tsx", "utf8");
    expect(page).toContain('<HalloweenInventoryCard key={item.id} item={item} riders={riders}');
    expect(page).toContain('getCurrentTeamItemTargetRiders(supabase, true)');
    const dashboard = readFileSync("app/jeu/page.tsx", "utf8");
    expect(dashboard).toContain("getCurrentHalloweenInventory(user.id)");
    expect(dashboard).toContain("summary.inventoryTotalUnits + halloweenSummary.totalUnits");
    const event = readFileSync("components/halloween/halloween-event.tsx", "utf8");
    expect(event).toContain('id={`halloween-item-${item.id}`}');
  });
});
