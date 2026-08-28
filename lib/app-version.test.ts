import packageMetadata from "../package.json";
import { describe, expect, it } from "vitest";

import { APP_RELEASE_CHANNEL, APP_VERSION } from "./app-version";
import { latestRelease } from "./releases";

describe("version de l'application", () => {
  it("reste synchronisée entre le projet et les surfaces publiques", () => {
    expect(packageMetadata.version).toBe(APP_VERSION);
    expect(APP_RELEASE_CHANNEL).toBe("Bêta");
    expect(latestRelease.version).toContain(APP_VERSION);
  });
});

