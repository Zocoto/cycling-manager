import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import raw from "@/data/collector-album-pilot.json";
import source from "@/data/collector-album-intro-pilot.json";
import { type CollectorAlbumSnapshot } from "@/lib/game/collector-album";
import { createCycloStickersPreview } from "@/lib/game/cyclo-stickers-release";
import { QUADRENNIAL_GAMES_EMBLEM } from "@/lib/game/quadrennial-games";
import { AlbumBoosterArtwork } from "./collector-album-artwork";
import { CollectorAlbumCover } from "./collector-album-cover";
import { CycloStickersGamesArtwork } from "./cyclo-stickers-games-artwork";
import { CycloStickersSpecialCard } from "./cyclo-stickers-special-card";
import format from "./collector-card-format.module.css";

const snapshot = createCycloStickersPreview(raw as CollectorAlbumSnapshot, source);

describe("the S4 night-of-the-Games print", () => {
  it("shares one integrated scene across the book and both wrapper sizes", () => {
    const html = renderToStaticMarkup(<div>
      <CollectorAlbumCover season={4} count={0} total={69} gamesEdition />
      <AlbumBoosterArtwork sourceSeason={4} gamesEdition />
      <AlbumBoosterArtwork sourceSeason={4} gamesEdition compact />
    </div>);
    expect(html.match(/data-album-games-scene="night-velodrome"/g)).toHaveLength(3);
    expect(html.match(/data-album-games-lanes="5"/g)).toHaveLength(3);
    expect(html.match(/data-album-games-flame=""/g)).toHaveLength(3);
    expect(html.match(/data-album-games-emblem="stadium"/g)).toHaveLength(3);
    expect(html).toContain(`href="${QUADRENNIAL_GAMES_EMBLEM}"`);
    expect(html).toContain('data-games-pack="regular"');
    expect(html).toContain('data-games-pack="compact"');
    expect(html).not.toContain('fill="#f7edcf"');
  });

  it("scopes print definitions when several wrappers appear together", () => {
    const html = renderToStaticMarkup(<div><CycloStickersGamesArtwork /><CycloStickersGamesArtwork /></div>);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id);
    const references = [...html.matchAll(/url\(#([^\)]+)\)/g)].map(([, id]) => id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    expect(references.every(id => ids.includes(id))).toBe(true);
    expect(html).not.toMatch(/<(filter|animate|foreignObject)\b|https?:\/\//);
  });

  it("keeps the S3 cover and wrapper on their existing mountain-road print", () => {
    const cover = renderToStaticMarkup(<CollectorAlbumCover season={3} count={12} total={50} />);
    const wrapper = renderToStaticMarkup(<AlbumBoosterArtwork sourceSeason={3} />);
    for (const html of [cover, wrapper]) {
      expect(html).toContain("deux coureurs sur une route de montagne");
      expect(html).not.toContain("data-album-games");
      expect(html).not.toContain("data-games-pack");
      expect(html).not.toContain("JEUX QUADRIENNAUX");
    }
    expect(cover).toContain("Les champions passent.");
    expect(wrapper).toContain("LES CHAMPIONS DE LA SAISON 3");
  });

  it("can print a public owner's name while preserving private preview defaults", () => {
    const preview = renderToStaticMarkup(<CollectorAlbumCover season={4} count={0} total={69} gamesEdition />);
    expect(preview).toContain("EXEMPLAIRE PRIVÉ");
    expect(preview).toContain("Abbaye du Lion");
    const publicCover = renderToStaticMarkup(<CollectorAlbumCover season={4} count={0} total={69} gamesEdition ownerName="Équipe des Aiglons" privatePreview={false} />);
    expect(publicCover).toContain("EXEMPLAIRE DE");
    expect(publicCover).toContain("Équipe des Aiglons");
    expect(publicCover).not.toContain("Abbaye du Lion");
    expect(publicCover).not.toContain("EXEMPLAIRE PRIVÉ");
  });

  it("marks only the Games and Halloween specials EPIC in the existing physical format", () => {
    const specials = snapshot.cards.filter(card => card.kind === "games" || card.kind === "legend");
    expect(specials).toHaveLength(2);
    for (const card of specials) {
      const html = renderToStaticMarkup(<CycloStickersSpecialCard card={card} season={4} />);
      expect(html).toContain('data-card-finish="epic"');
      expect(html).toContain("✦ EPIC");
      expect(html).toContain("Carte EPIC");
      expect(html).toContain(format.card);
      expect(html).toContain(card.name);
    }
    const team = snapshot.cards.find(card => card.kind === "team")!;
    expect(renderToStaticMarkup(<CycloStickersSpecialCard card={team} season={4} />)).not.toContain("EPIC");
    expect(renderToStaticMarkup(<CycloStickersSpecialCard card={team} season={4} />)).not.toContain("données de test");
    expect(renderToStaticMarkup(<CycloStickersSpecialCard card={team} season={3} />)).toContain("données de test");
    const css = readFileSync(path.join(process.cwd(), "components/game/collector-card-format.module.css"), "utf8");
    expect(css).toContain("width:196px");
    expect(css).toContain("height:324px");
  });

  it("keeps compact wrapper sizing and stops the foil sweep for reduced motion", () => {
    const css = readFileSync(path.join(process.cwd(), "components/game/cyclo-stickers-games.module.css"), "utf8");
    expect(css).toContain(".gamesPack[data-games-pack=compact] .gamesPackTitle");
    expect(css).toMatch(/@media\(prefers-reduced-motion:reduce\)\{\.holographic\.holographic::after\{animation:none/);
    expect(css).toContain(".holographic.holographic .specialIdentity{position:relative;background:#fff3d9");
    expect(css).not.toMatch(/\b(?:width|height):(?:196|324)px/);
  });
});
