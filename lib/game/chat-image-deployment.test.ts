import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("chat image native deployment regression", () => {
  it("explicitly includes sharp and platform libraries in the custom upload route", () => {
    expect(nextConfig.outputFileTracingIncludes?.["/api/game/chat/images"]).toEqual(expect.arrayContaining([
      "./node_modules/sharp/**/*",
      "./node_modules/@img/sharp-*/**/*",
    ]));
  });
  it("checks the built runtime trace before deployment", () => {
    const { scripts } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    expect(scripts.postbuild).toContain("node scripts/validate-chat-image-runtime.mjs");
  });
});
