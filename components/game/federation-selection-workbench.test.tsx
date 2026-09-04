import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FederationSelectionWorkbench } from "@/components/game/federation-selection-workbench";

describe("FederationSelectionWorkbench hosting", () => {
  it("uses the seasonal professional host without changing the static slot", () => {
    const markup = renderToStaticMarkup(
      <FederationSelectionWorkbench
        countryCode="FR"
        countryName="France"
        riders={[]}
        gameYear={4}
        selectionState={{
          canManage: false,
          automaticSelection: true,
          competitionHosts: {
            continental_championship_pro: {
              countryCode: "DE",
              countryName: "Allemagne",
            },
          },
          selections: {},
          pendingConfirmations: [],
        }}
      />,
    );

    expect(markup).toContain("Pays hôte : Allemagne");
    expect(markup).toContain("fi-de");
  });
});
