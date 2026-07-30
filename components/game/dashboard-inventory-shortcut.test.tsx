import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardInventoryShortcut } from "./dashboard-inventory-shortcut";

describe("DashboardInventoryShortcut", () => {
  it("sépare proprement les compteurs sur mobile et conserve la ligne compacte sur tablette", () => {
    const markup = renderToStaticMarkup(
      <DashboardInventoryShortcut totalUnits={26} availableUnits={0} />,
    );

    expect(markup).toContain("Inventaire");
    expect(markup).toContain(
      '<span class="block whitespace-nowrap">26 objets</span>',
    );
    expect(markup).toContain("0 disponible");
    expect(markup).toContain("sm:hidden");
    expect(markup).toContain("sm:block");
    expect(markup).toContain("26 objets · 0 disponible");
  });

  it("accorde les libellés au pluriel", () => {
    const markup = renderToStaticMarkup(
      <DashboardInventoryShortcut totalUnits={2} availableUnits={2} />,
    );

    expect(markup).toContain("2 objets");
    expect(markup).toContain("2 disponibles");
  });
});
