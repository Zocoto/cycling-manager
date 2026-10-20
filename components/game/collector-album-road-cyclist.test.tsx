import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoadPerspectiveCyclist } from "./collector-album-road-cyclist";

describe("album road-perspective rider drawing", () => {
  it("anchors the rear tyre to the route contact and faces the horizon", () => {
    const html = renderToStaticMarkup(createElement(RoadPerspectiveCyclist, { x: 530, y: 620, scale: .9, jersey: "#b95542", headingDeg: 6 }));
    expect(html).toContain('transform="translate(530 620) rotate(6) scale(0.9)"');
    expect(html).toContain('data-art-cyclist-view="rear-three-quarter"');
    expect(html).toContain('data-art-heading-deg="6"');
    expect(html).toContain('data-art-riding-posture="hoods"');
    expect(html).toContain('<ellipse cx="0" cy="-28" rx="11" ry="28"');
    expect(html).toContain('<ellipse cx="5" cy="-75" rx="8" ry="22"');
    expect(html).not.toMatch(/<(image|filter|animate|foreignObject)\b|https?:\/\//);
  });

  it("offers a distinct aero posture without turning a side-on drawing", () => {
    const base = { x: 0, y: 0, jersey: "#dfb756" };
    const road = renderToStaticMarkup(createElement(RoadPerspectiveCyclist, base));
    const aero = renderToStaticMarkup(createElement(RoadPerspectiveCyclist, { ...base, aero: true }));
    expect(road).toContain('transform="translate(0 0) rotate(0) scale(1)"');
    expect(aero).toContain('data-art-riding-posture="aero"');
    expect(aero).not.toEqual(road);
    expect(aero).toContain('<ellipse cx="5" cy="-75" rx="8" ry="22"');
    expect(aero).toContain('<ellipse cx="0" cy="-28" rx="11" ry="28"');
  });

  it.each([30, -30, 6])("keeps the anatomy upright when the road heading is %s degrees", (headingDeg) => {
    const html = renderToStaticMarkup(createElement(RoadPerspectiveCyclist, { x: 0, y: 0, jersey: "#b95542", aero: true, headingDeg }));
    const bodyLean = Number((headingDeg * .15).toFixed(3));
    const counterRotation = Number((bodyLean - headingDeg).toFixed(3));
    expect(html).toContain(`transform="translate(0 0) rotate(${headingDeg}) scale(1)"`);
    expect(html).toContain(`transform="rotate(${counterRotation} 0 -95)"`);
    expect(html).toContain(`data-art-body-lean-deg="${bodyLean}"`);
    expect(Math.abs(bodyLean)).toBeLessThanOrEqual(4.5);
  });
});
