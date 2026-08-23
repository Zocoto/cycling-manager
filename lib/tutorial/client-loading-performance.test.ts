import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

const providerSource = readSource(
  "components/tutorial/tutorial-provider.tsx",
);
const launcherSource = readSource(
  "components/tutorial/tutorial-center-launcher.tsx",
);
const headerSource = readSource("components/game/game-header.tsx");

describe("tutorial client loading performance", () => {
  it("keeps the tutorial catalog outside the initial provider bundle", () => {
    expect(providerSource).not.toContain(
      'from "@/lib/tutorial/catalog"',
    );
    expect(providerSource).not.toContain(
      'from "@/lib/i18n/tutorials-en"',
    );
    expect(providerSource).toContain(
      'import("@/lib/tutorial/client-runtime")',
    );
  });

  it("prioritizes the runtime only when an automatic tutorial is pending", () => {
    const bootstrapStart = providerSource.indexOf(
      "const hydrateTutorialBootstrap",
    );
    const bootstrapEnd = providerSource.indexOf(
      "const initialBootstrapHandledRef",
    );
    const bootstrapSource = providerSource.slice(bootstrapStart, bootstrapEnd);

    const noAutoStartGuard = bootstrapSource.indexOf(
      "bootstrap.autoStartTutorialKeys.length === 0",
    );
    const runtimeLoad = bootstrapSource.indexOf(
      "loadAndStoreTutorialRuntime()",
    );

    expect(noAutoStartGuard).toBeGreaterThan(-1);
    expect(runtimeLoad).toBeGreaterThan(noAutoStartGuard);
  });

  it("loads the tutorial centre on user intent instead of with the header", () => {
    expect(headerSource).toContain("<TutorialCenterLauncher />");
    expect(headerSource).not.toContain("<TutorialCenterMenu />");
    expect(launcherSource).toContain(
      'import("@/components/tutorial/tutorial-center-menu")',
    );
    expect(launcherSource).toContain("ssr: false");
    expect(launcherSource).toContain("onPointerEnter");
    expect(launcherSource).toContain("onFocus");
    expect(launcherSource).toContain("initiallyOpen");
  });
});
