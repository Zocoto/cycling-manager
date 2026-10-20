import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import raw from "@/data/collector-album-pilot.json";
import { CARD_RARITY_LABELS, type CollectorCard } from "@/lib/game/collector-album";
import base from "./collector-album.module.css";
import print from "./collector-card-print.module.css";
import { CollectorCardFace } from "./collector-card-face";

const card = raw.cards[0] as CollectorCard;
const css = readFileSync(new URL("./collector-card-print.module.css", import.meta.url), "utf8");
const baseCss = readFileSync(new URL("./collector-album.module.css", import.meta.url), "utf8");
const hexRgb = (hex: string) => hex.slice(1).match(/.{2}/g)!.map(value => parseInt(value, 16) / 255);
const luminance = (hex: string) => hexRgb(hex).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const contrast = (foreground: string, background: string) => (Math.max(luminance(foreground), luminance(background)) + .05) / (Math.min(luminance(foreground), luminance(background)) + .05);

describe("printed bronze, silver and gold collector frames", () => {
  it.each([["gold", 1], ["silver", 6], ["bronze", 21]] as const)("keeps the %s finish accessible without a visible finish label or changed portrait and scores", (rarity, rank) => {
    const markup = renderToStaticMarkup(<CollectorCardFace card={{...card, rank}} season={3} />);
    expect(markup).toContain(rarity === "gold" ? base.card : base[rarity]);
    expect(markup).toContain(print.sticker);
    expect(markup).toContain(`aria-label="${card.name}, carte ${CARD_RARITY_LABELS[rarity]}"`);
    const visibleText = markup.replace(/<[^>]*>/g, " ");
    for (const label of Object.values(CARD_RARITY_LABELS)) {
      expect(visibleText).not.toMatch(new RegExp(`\\b${label}\\b`));
    }
    expect(markup).toContain(`Portrait de ${card.name}`);
    expect(markup).toContain(`/images/flags/4x3/${card.countryCode.toLowerCase()}.svg`);
    expect(markup).toContain(`<dt>MO</dt><dd>${card.ratings.mountain}</dd>`);
  });

  it("uses existing distinct metal palettes for the wide brushed frame and double fillet, not bitmap assets or animation", () => {
    const palettes = ["card", "silver", "bronze"].map(className => {
      const block = [...baseCss.matchAll(new RegExp(`\\.${className}\\{([^}]+)\\}`, "g"))].find(match => match[1].includes("--foil-light:"))![1];
      const colours = ["light", "mid", "dark"].map(tone => block.match(new RegExp(`--foil-${tone}:(#[a-f0-9]{6})`))![1]);
      return colours;
    });
    expect(new Set(palettes.map(palette => palette.join())).size).toBe(3);
    expect(palettes[0]).toEqual(["#f2d994", "#bf9346", "#775a2c"]);
    expect(palettes[1]).toEqual(["#e7edf0", "#9baeb4", "#566d73"]);
    expect(palettes[2]).toEqual(["#f3d2af", "#b77c53", "#784d35"]);
    const frame = css.match(/\.sticker\.sticker\s*\{([^}]+)\}/)![1];
    expect(frame).toContain("padding: 8px");
    expect(frame).toContain("repeating-linear-gradient");
    expect(frame).toContain("linear-gradient(115deg, var(--foil-light)");
    expect(frame).toContain("inset 0 0 0 1px var(--foil-light)");
    expect(frame).toContain("inset 0 0 0 4px var(--foil-dark)");
    expect(frame).toContain("--face: #fffaf0");
    expect(frame).not.toMatch(/url\(|animation|filter|transform/);
    expect(frame).not.toMatch(/background(?:-color)?:\s*#/);
    expect(css).toMatch(/\.sticker \.nameplate\s*\{[^}]*background: #294650/);
  });

  it("keeps the printed identity and scores readable without reintroducing a finish badge", () => {
    expect(css).not.toMatch(/\.sticker \.rarity\b/);
    for (const foreground of ["#fff5db", "#eee2c6"]) expect(contrast(foreground, "#294650")).toBeGreaterThan(7);
    expect(contrast("#263e49", "#f8efd7")).toBeGreaterThan(7);
    for (const foreground of ["#62604d", "#923f2e"]) expect(contrast(foreground, "#fbf1d9")).toBeGreaterThan(4.5);
    expect(css).toContain("color: #fff5db");
    expect(css).toContain("color: #eee2c6");
    expect(css).toContain("color: #62604d");
    expect(css).toContain("color: #923f2e");
    // Dense leaf cards keep seven pixels of metal; the name never gets line-clamped.
    const spread = readFileSync(new URL("./collector-album-spread.module.css", import.meta.url), "utf8");
    expect(spread).toMatch(/\.slotWrap \[data-album-card\]\{padding:7px\}/);
    const spreadCardOverrides = [...spread.matchAll(/\.slotWrap \[data-album-card\]\s*\{([^}]+)\}/g)];
    expect(spreadCardOverrides.length).toBeGreaterThan(0);
    for (const [, block] of spreadCardOverrides) expect(block).not.toMatch(/background(?:-color)?:/);
    expect(baseCss).toMatch(/\.cardIdentity h3\{[^}]*overflow-wrap:anywhere/);
  });
});
