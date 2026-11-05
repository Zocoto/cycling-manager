import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { halloweenToInventoryItems } from "@/lib/game/halloween-inventory";
import { HalloweenInventoryCard } from "./halloween-inventory-card";
import { HALLOWEEN_PREVIEW_ITEMS } from "@/lib/game/halloween-catalog";
import type { TeamInventoryItem } from "@/lib/game/inventory";

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
  it("ne rend aucun élément d’avatar même s’il reste dans une ancienne liste chargée", () => {
    const base = halloweenToInventoryItems({ "spectres-tea": 1 })[0];
    for (const cosmetic of HALLOWEEN_PREVIEW_ITEMS.filter((item) => item.kind === "cosmetic")) {
      const legacyItem: TeamInventoryItem = {
        ...base, id: `halloween:${cosmetic.id}`, sourceId: cosmetic.id, catalogKey: cosmetic.id,
        name: cosmetic.name, description: cosmetic.description, effectSummary: cosmetic.effect,
        iconKey: cosmetic.art, halloween: cosmetic, isConsumable: false,
        availableQuantity: 0, equippedQuantity: 1,
      };
      expect(renderToStaticMarkup(<HalloweenInventoryCard item={legacyItem} />), cosmetic.id).toBe("");
    }
  });
  it("garde les sorts et le cadre de matériel à récupérer dans l’inventaire", () => {
    const spell = halloweenToInventoryItems({ "vampire-kiss": 1 })[0];
    const spellMarkup = renderToStaticMarkup(<HalloweenInventoryCard item={spell} />);
    expect(spellMarkup).toContain("Baiser du vampire");
    expect(spellMarkup).toContain("Envoyer ce sort");
    const frameClaim = halloweenToInventoryItems({ "headless-frame-claim": 1 })[0];
    expect(renderToStaticMarkup(<HalloweenInventoryCard item={frameClaim} />)).toContain(frameClaim.name);
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
