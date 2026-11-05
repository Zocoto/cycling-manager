import { describe, expect, it } from "vitest";

import { findVisibleTutorialTarget } from "@/lib/tutorial/targets";

describe("tutorial rendered targets", () => {
  const hidden = { visible: false };
  const mobile = { visible: true };
  const desktop = { visible: true };
  const candidates: Record<string, typeof hidden[]> = {
    mobile: [hidden, mobile],
    desktop: [desktop],
    hidden: [hidden],
  };
  const find = (id: string) => candidates[id] ?? [];
  const visible = (target: typeof hidden) => target.visible;

  it("ignores a hidden responsive copy before the visible copy", () => {
    expect(findVisibleTutorialTarget(["mobile", "desktop"], find, visible)).toBe(mobile);
  });

  it("falls back to the desktop target when the mobile target is hidden", () => {
    expect(findVisibleTutorialTarget(["hidden", "desktop"], find, visible)).toBe(desktop);
  });

  it("waits for an absent or still hidden target", () => {
    expect(findVisibleTutorialTarget(["absent", "hidden"], find, visible)).toBeNull();
  });
});
