"use client";

import { Fragment, useState, type ReactNode } from "react";

import {
  ALL_TRANSFER_AUCTION_SOURCES,
  TRANSFER_AUCTION_SOURCES,
  type TransferAuctionSource,
  type TransferAuctionSourceSelection,
} from "@/lib/game/transfer-auction-sources";

export type TransferAuctionListItem = {
  id: string;
  source: TransferAuctionSource;
  isFinished: boolean;
  card: ReactNode;
};

type TransferAuctionListProps = {
  // Cards and banners stay server-rendered; filtering needs no new request.
  listings: TransferAuctionListItem[];
  nationalDayBanner: ReactNode;
};

export function TransferAuctionList(props: TransferAuctionListProps) {
  const [sources, setSources] = useState(ALL_TRANSFER_AUCTION_SOURCES);

  return (
    <TransferAuctionListView
      {...props}
      sources={sources}
      onSourceChange={(source, checked) => {
        setSources((current) => ({ ...current, [source]: checked }));
      }}
    />
  );
}

export function TransferAuctionListView({
  listings,
  nationalDayBanner,
  sources,
  onSourceChange,
}: TransferAuctionListProps & {
  sources: TransferAuctionSourceSelection;
  onSourceChange: (source: TransferAuctionSource, checked: boolean) => void;
}) {
  const visibleListings = listings.filter((listing) => sources[listing.source]);
  const activeListings = visibleListings.filter((listing) => !listing.isFinished);
  const finishedListings = visibleListings.filter((listing) => listing.isFinished);
  const hasSelectedSource = Object.values(sources).some(Boolean);

  return (
    <>
      <fieldset className="mt-5 min-w-0 rounded-2xl border border-[#315B3E]/12 bg-white/70 px-4 py-3">
        <legend className="sr-only">Filtrer les enchères par origine</legend>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <span aria-hidden="true" className="text-[10px] font-black uppercase tracking-wider text-[#60756E]">Afficher</span>
          {TRANSFER_AUCTION_SOURCES.map((source) => (
            <label key={source.id} className="flex min-h-10 cursor-pointer items-center gap-2.5 text-xs font-bold text-[#48665F]">
              <input
                type="checkbox"
                name="auctionSource"
                value={source.id}
                checked={sources[source.id]}
                onChange={(event) => onSourceChange(source.id, event.target.checked)}
                className="h-4 w-4 rounded border-[#315B3E]/25 accent-[#176951] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176951]"
              />
              {source.label}
            </label>
          ))}
          <span role="status" className="text-xs font-semibold text-[#60756E] sm:ml-auto">
            {visibleListings.length} offre{visibleListings.length > 1 ? "s" : ""} affichée{visibleListings.length > 1 ? "s" : ""}
          </span>
        </div>
      </fieldset>
      {sources["national-day"] ? nationalDayBanner : null}
      <div data-tutorial-id="transfer-daily-listings">
        {visibleListings.length > 0 ? (
          <div className="space-y-8">
            {activeListings.length > 0 ? (
              <div className="mt-5 grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {activeListings.map((listing) => <Fragment key={listing.id}>{listing.card}</Fragment>)}
              </div>
            ) : null}
            {finishedListings.length > 0 ? (
              <section aria-labelledby="finished-auctions-title" className="mt-5 rounded-[2rem] border border-[#315B3E]/12 bg-[#E9ECEA]/70 p-5 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#71807B]">Historique du jour</p>
                    <h3 id="finished-auctions-title" className="mt-1 text-xl font-black text-[#44534F]">Enchères terminées</h3>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[#71807B]">Ces résultats restent visibles jusqu’au renouvellement du marché demain.</p>
                  </div>
                  <span className="rounded-full border border-[#71807B]/20 bg-white/70 px-3 py-1 text-xs font-black text-[#53615D]">{finishedListings.length}</span>
                </div>
                <div className="mt-5 grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {finishedListings.map((listing) => <Fragment key={listing.id}>{listing.card}</Fragment>)}
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="mt-5 rounded-[2rem] border border-dashed border-[#315B3E]/25 bg-white/70 px-6 py-14 text-center">
            <h3 className="text-xl font-black text-[#183F37]">
              {!hasSelectedSource ? "Aucun type d’offre sélectionné" : listings.length > 0 ? "Aucune offre pour ces filtres" : "Aucune enchère ouverte"}
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-[#60756E]">
              {!hasSelectedSource || listings.length > 0
                ? "Cochez un autre type d’offre pour afficher davantage d’enchères."
                : "La prochaine sélection quotidienne apparaîtra à 9 h, ou dès qu’un DS publiera un coureur."}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
