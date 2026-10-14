import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  ALL_TRANSFER_AUCTION_SOURCES,
  TRANSFER_AUCTION_SOURCES,
  type TransferAuctionSourceSelection,
} from "@/lib/game/transfer-auction-sources";
import {
  TransferAuctionList,
  TransferAuctionListView,
  type TransferAuctionListItem,
} from "./transfer-auction-list";

const listings: TransferAuctionListItem[] = TRANSFER_AUCTION_SOURCES.flatMap(({ id: source }) =>
  [false, true].map((isFinished) => {
    const id = `${source}-${isFinished ? "finished" : "active"}`;
    return { id, source, isFinished, card: <article data-testid={id}>{id}</article> };
  }),
);
const nationalDayBanner = <aside data-testid="national-banner">Fête nationale</aside>;

function renderSelection(sources: TransferAuctionSourceSelection, items = listings) {
  return renderToStaticMarkup(
    <TransferAuctionListView listings={items} nationalDayBanner={nationalDayBanner} sources={sources} onSourceChange={vi.fn()} />,
  );
}

describe("filtres des enchères", () => {
  it("affiche trois cases cochées et toutes les offres dès le rendu initial", () => {
    const html = renderToStaticMarkup(<TransferAuctionList listings={listings} nationalDayBanner={nationalDayBanner} />);
    expect(html.match(/type="checkbox"/g)).toHaveLength(3);
    expect(html.match(/checked=""/g)).toHaveLength(3);
    for (const { label } of TRANSFER_AUCTION_SOURCES) expect(html).toContain(label);
    for (const { id } of listings) expect(html).toContain(`data-testid="${id}"`);
    expect(html).toContain("6 offres affichées");
    expect(html).toContain("Filtrer les enchères par origine");
    expect(html.indexOf("<fieldset")).toBeLessThan(html.indexOf('data-testid="national-banner"'));
    expect(html.indexOf("<fieldset")).toBeLessThan(html.indexOf('data-testid="director-active"'));
  });

  it.each(Array.from({ length: 8 }, (_, mask) => mask))("respecte la combinaison %i sur les offres actives et terminées", (mask) => {
    const sources = { director: Boolean(mask & 1), daily: Boolean(mask & 2), "national-day": Boolean(mask & 4) };
    const html = renderSelection(sources);
    for (const listing of listings) {
      expect(html.includes(`data-testid="${listing.id}"`)).toBe(sources[listing.source]);
    }
    expect(html.includes('data-testid="national-banner"')).toBe(sources["national-day"]);
    expect(html.match(/checked=""/g)?.length ?? 0).toBe(Object.values(sources).filter(Boolean).length);
    const count = Object.values(sources).filter(Boolean).length * 2;
    expect(html).toContain(`${count} offre${count > 1 ? "s" : ""} affichée${count > 1 ? "s" : ""}`);
    expect(html.includes("Enchères terminées")).toBe(count > 0);
  });

  it("conserve l’ordre des offres et place tout l’historique après les offres actives", () => {
    const html = renderSelection(ALL_TRANSFER_AUCTION_SOURCES);
    expect(html.indexOf('data-testid="director-active"')).toBeLessThan(html.indexOf('data-testid="daily-active"'));
    expect(html.indexOf('data-testid="national-day-active"')).toBeLessThan(html.indexOf("Enchères terminées"));
    expect(html.indexOf("Enchères terminées")).toBeLessThan(html.indexOf('data-testid="director-finished"'));
    expect(html.indexOf('data-testid="director-finished"')).toBeLessThan(html.indexOf('data-testid="daily-finished"'));
  });

  it("explique comment réafficher les offres si tout est décoché", () => {
    const html = renderSelection({ director: false, daily: false, "national-day": false });
    expect(html).toContain("Aucun type d’offre sélectionné");
    expect(html).toContain("Cochez un autre type d’offre");
    expect(html).not.toContain("Aucune enchère ouverte");
  });

  it("distingue un filtre sans résultat d’un marché vide", () => {
    const html = renderSelection({ director: true, daily: false, "national-day": false }, listings.filter((listing) => listing.source === "daily"));
    expect(html).toContain("Aucune offre pour ces filtres");
    expect(html).not.toContain("Enchères terminées");
    const empty = renderSelection(ALL_TRANSFER_AUCTION_SOURCES, []);
    expect(empty).toContain("Aucune enchère ouverte");
    expect(empty).toContain("apparaîtra à 9 h");
  });

  it("réaffiche les cartes lorsqu’une origine est cochée à nouveau", () => {
    const hidden = renderSelection({ ...ALL_TRANSFER_AUCTION_SOURCES, daily: false });
    expect(hidden).not.toContain('data-testid="daily-active"');
    const restored = renderSelection(ALL_TRANSFER_AUCTION_SOURCES);
    expect(restored).toContain('data-testid="daily-active"');
    expect(restored).toContain('data-testid="daily-finished"');
  });
});
