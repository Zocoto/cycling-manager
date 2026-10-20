import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ALBUM_PROFILES } from "@/lib/game/collector-album";
import { AlbumProfileArtwork } from "./collector-album-profile-artwork";

describe("album category poster drawings", () => {
  it.each(ALBUM_PROFILES)("renders a different full-page scene for $id", ({ id }) => {
    const html = renderToStaticMarkup(createElement(AlbumProfileArtwork, { profile: id }));
    expect(html).toContain('viewBox="0 0 1200 700"');
    expect(html).toContain(`data-album-profile="${id}"`);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).not.toContain('role="img"');
    expect(html).not.toMatch(/<(image|filter|animate|foreignObject)\b|https?:\/\//);
  });

  it("offers descriptive accessible illustrations when they are not decorative", () => {
    const html = renderToStaticMarkup(createElement(AlbumProfileArtwork, { profile: "cobbles", decorative: false, className: "poster" }));
    expect(html).toContain('role="img"');
    expect(html).toContain('class="poster"');
    expect(html).not.toContain("aria-hidden");
    const titleId = html.match(/<title id="([^"]+)"/)?.[1];
    expect(titleId).toBeTruthy();
    expect(html).toContain(`aria-labelledby="${titleId}"`);
    expect(html).toContain("secteur pavé, moulin");
  });

  it("scopes every printing pattern to its own instance", () => {
    const html = renderToStaticMarkup(createElement("div", null,
      createElement(AlbumProfileArtwork, { profile: "cobbles" }),
      createElement(AlbumProfileArtwork, { profile: "cobbles" }),
    ));
    const ids = [...html.matchAll(/<pattern id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    const references = [...html.matchAll(/url\(#([^\)]+)\)/g)].map((match) => match[1]);
    expect(references.every((reference) => ids.includes(reference))).toBe(true);
  });

  it("does not reuse the same scenery for different rider categories", () => {
    const drawings = ALBUM_PROFILES.map(({ id }) => renderToStaticMarkup(createElement(AlbumProfileArtwork, { profile: id }))
      .replace(/album-[^-]+-/g, "album-instance-")
      .replace(/data-album-profile="[^"]+"/, ""));
    expect(new Set(drawings).size).toBe(ALBUM_PROFILES.length);
  });

  it.each(["cobbles", "timeTrial"] as const)("points the %s riders along the road, towards the horizon", profile => {
    const html = renderToStaticMarkup(createElement(AlbumProfileArtwork, { profile }));
    const scene = html.match(/<g\b[^>]*data-road-scene="[^>]+>/)?.[0] ?? "";
    const horizon = [Number(attribute(scene, "data-road-vanishing-x")), Number(attribute(scene, "data-road-vanishing-y"))] as Point;
    const road = roadBounds(html);
    const riders = [...html.matchAll(/<g\b[^>]*data-art-cyclist-view="rear-three-quarter"[^>]*>/g)];
    expect(riders.length).toBeGreaterThan(0);
    expect(html).not.toContain('data-art-cyclist-view="side-climbing"');

    for (const [rider] of riders) {
      const transform = attribute(rider, "transform");
      const [, xText, yText, angleText] = transform.match(/^translate\(([-\d.]+) ([-\d.]+)\) rotate\(([-\d.]+)\) scale\(([-\d.]+)\)$/) ?? [];
      const x = Number(xText), y = Number(yText), angle = Number(angleText) * Math.PI / 180;
      expect(Number.isFinite(x + y + angle)).toBe(true);
      expect(y).toBeGreaterThan(horizon[1]);
      expect(Number(attribute(rider, "data-art-heading-deg"))).toBe(Number(angleText));

      // Local -Y is the bicycle's forward axis; rotation must point it up-road.
      const forward = [Math.sin(angle), -Math.cos(angle)] as Point;
      const toHorizon = [horizon[0] - x, horizon[1] - y] as Point;
      const alignment = (forward[0] * toHorizon[0] + forward[1] * toHorizon[1]) / Math.hypot(...toHorizon);
      expect(alignment).toBeGreaterThan(.999);
      expect(x).toBeGreaterThan(road.leftAt(y));
      expect(x).toBeLessThan(road.rightAt(y));
      expect(attribute(rider, "data-art-riding-posture")).toBe(profile === "timeTrial" ? "aero" : "hoods");
    }
  });

  it("projects individual cobbles inside the road, with larger stones in the foreground", () => {
    const html = renderToStaticMarkup(createElement(AlbumProfileArtwork, { profile: "cobbles" }));
    const road = roadBounds(html);
    const rows = new Map<number, { area: number; height: number }[]>();
    for (const [stone] of html.matchAll(/<polygon\b[^>]*data-road-stone=""[^>]*>/g)) {
      const points = attribute(stone, "points").split(" ").map(point => point.split(",").map(Number) as Point);
      expect(points).toHaveLength(4);
      for (const [x, y] of points) {
        expect(x).toBeGreaterThan(road.leftAt(y));
        expect(x).toBeLessThan(road.rightAt(y));
      }
      const top = Math.min(...points.map(([, y]) => y));
      const bottom = Math.max(...points.map(([, y]) => y));
      const area = Math.abs(points.reduce((sum, [x, y], index) => {
        const [nextX, nextY] = points[(index + 1) % points.length];
        return sum + x * nextY - nextX * y;
      }, 0)) / 2;
      const row = rows.get(top) ?? [];
      row.push({ area, height: bottom - top });
      rows.set(top, row);
    }
    const orderedRows = [...rows].sort(([a], [b]) => a - b).map(([, stones]) => stones);
    expect(orderedRows.length).toBeGreaterThanOrEqual(8);
    const average = (stones: { area: number }[]) => stones.reduce((sum, stone) => sum + stone.area, 0) / stones.length;
    expect(average(orderedRows.at(-1)!)).toBeGreaterThan(average(orderedRows[0]) * 8);
    expect(orderedRows.at(-1)![0].height).toBeGreaterThan(orderedRows[0][0].height * 4);
  });

  it("places the punchers on the climb with their wheels tangent to its gradient", () => {
    const html = renderToStaticMarkup(createElement(AlbumProfileArtwork, { profile: "hills" }));
    const road = html.match(/<path\b[^>]*data-road-riding-line="hills"[^>]*>/)?.[0] ?? "";
    const coordinates = attribute(road, "d").match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    expect(coordinates).toHaveLength(12); // M, cubic C, then smooth cubic S.
    const point = (offset: number): Point => [coordinates[offset], coordinates[offset + 1]];
    const [start, control1, control2, joint, control4, end] = [0, 2, 4, 6, 8, 10].map(point);
    const segments = [
      [start, control1, control2, joint],
      [joint, [2 * joint[0] - control2[0], 2 * joint[1] - control2[1]] as Point, control4, end],
    ];
    const riders = [...html.matchAll(/<g\b[^>]*data-art-cyclist-view="side-climbing"[^>]*>/g)];
    expect(riders.length).toBeGreaterThan(0);
    for (const [rider] of riders) {
      const [, xText, yText, angleText] = attribute(rider, "transform").match(/^translate\(([-\d.]+) ([-\d.]+)\) rotate\(([-\d.]+)\)/) ?? [];
      const x = Number(xText), y = Number(yText), angle = Number(angleText);
      const samples = segments.flatMap(segment => Array.from({ length: 501 }, (_, index) => {
        const t = index / 500, u = 1 - t;
        const [a, b, c, d] = segment;
        const px = u ** 3 * a[0] + 3 * u ** 2 * t * b[0] + 3 * u * t ** 2 * c[0] + t ** 3 * d[0];
        const py = u ** 3 * a[1] + 3 * u ** 2 * t * b[1] + 3 * u * t ** 2 * c[1] + t ** 3 * d[1];
        const dx = 3 * u ** 2 * (b[0] - a[0]) + 6 * u * t * (c[0] - b[0]) + 3 * t ** 2 * (d[0] - c[0]);
        const dy = 3 * u ** 2 * (b[1] - a[1]) + 6 * u * t * (c[1] - b[1]) + 3 * t ** 2 * (d[1] - c[1]);
        return { distance: Math.hypot(x - px, y - py), heading: Math.atan2(dy, dx) * 180 / Math.PI };
      }));
      const nearest = samples.reduce((best, sample) => sample.distance < best.distance ? sample : best);
      expect(nearest.distance).toBeLessThan(3);
      expect(angle).toBeLessThan(0);
      expect(Math.abs(angle - nearest.heading)).toBeLessThan(3);
    }
  });
});

type Point = [number, number];

function attribute(tag: string, name: string) {
  const value = tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
  if (value === undefined) throw new Error(`Missing ${name} in artwork markup`);
  return value;
}

function roadBounds(html: string) {
  const tag = html.match(/<path\b[^>]*data-road-riding-line="[^>]+>/)?.[0] ?? "";
  const [, leftText, topText, widthText, spreadText, heightText, bottomLeftText] = attribute(tag, "d")
    .match(/^M([-\d.]+) ([-\d.]+)h([-\d.]+)l([-\d.]+) ([-\d.]+)H([-\d.]+)Z$/) ?? [];
  const left = Number(leftText), top = Number(topText), width = Number(widthText), spread = Number(spreadText), height = Number(heightText), bottomLeft = Number(bottomLeftText);
  expect(Number.isFinite(left + top + width + spread + height + bottomLeft)).toBe(true);
  return {
    leftAt: (y: number) => left + (bottomLeft - left) * (y - top) / height,
    rightAt: (y: number) => left + width + spread * (y - top) / height,
  };
}
