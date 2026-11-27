"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import Link from "@/components/ui/app-link";
import { getCollectorCardRarity, type CollectorAlbumSnapshot } from "@/lib/game/collector-album";
import { countStickerReferences, getCrossSeasonReceivedCards, isCycloStickersTradeWorkspace,
  legacyTradeWorkspace, sortStickerReferences, stickerReference, stickerReferenceKey } from "@/lib/game/cyclo-stickers-cross-trades";
import { createCycloStickersTradeRequestIds } from "@/lib/game/cyclo-stickers-persistent-view";
import { notifyCycloStickersTradesChanged } from "@/lib/game/cyclo-stickers-booster-sync";
import type { CycloStickersCardReference as Ref, CycloStickersCrossCollector, CycloStickersCrossTrade,
  CycloStickersMutation, CycloStickersPersistentState, CycloStickersSeasonCard, CycloStickersTradeStatus,
  CycloStickersTradeWorkspace } from "@/lib/game/cyclo-stickers-persistence";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { RiderAvatar } from "./rider-avatar";
import { COPY } from "./cyclo-stickers-trade-copy";
import styles from "./cyclo-stickers-trades.module.css";

const LIMIT = 3;
type Stock = CycloStickersSeasonCard & { quantity: number };
type SearchResult = { key: string; collectors: CycloStickersCrossCollector[]; failed?: true };
function fitsStock(items: readonly Ref[], stock: readonly Stock[]) {
  return items.length > 0 && items.length <= LIMIT && items.every(item =>
    countStickerReferences(items, item) <= (stock.find(row => stickerReferenceKey(row) === stickerReferenceKey(item))?.quantity ?? 0));
}

export function CycloStickersTrades({ snapshot, state, busy, mutate, initialTarget, wanted,
  initialOffer = null, initialView = "compose", onViewBoosters, onWorkspaceChange }: {
  snapshot: CollectorAlbumSnapshot; state: CycloStickersPersistentState; busy: boolean; mutate: CycloStickersMutation;
  initialTarget: number | null; wanted: readonly number[]; initialOffer?: number | null;
  initialView?: "compose" | "inbox"; onViewBoosters?: () => void;
  onWorkspaceChange?: (workspace: CycloStickersTradeWorkspace) => void;
}) {
  const { locale } = useLocale();
  const t = COPY[locale];
  const id = useId();
  const request = useRef(createCycloStickersTradeRequestIds());
  const operation = useRef(false);
  const mounted = useRef(true);
  const revision = useRef(0);
  const workspaceListener = useRef(onWorkspaceChange);
  useEffect(() => { workspaceListener.current = onWorkspaceChange; }, [onWorkspaceChange]);
  const catalogueCache = useRef<Record<string, CollectorAlbumSnapshot>>({ [snapshot.edition]: snapshot });
  const catalogueRequests = useRef(new Set<string>());
  const [catalogues, setCatalogues] = useState<Record<string, CollectorAlbumSnapshot>>(() => ({ [snapshot.edition]: snapshot }));
  const [catalogueErrors, setCatalogueErrors] = useState<Record<string, boolean>>({});
  const [workspace, setWorkspace] = useState(() => legacyTradeWorkspace(snapshot, state));
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceError, setWorkspaceError] = useState(false);
  const [refreshAttempt, setRefreshAttempt] = useState(0);
  const [view, setView] = useState(initialView);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [offerEdition, setOfferEdition] = useState(state.edition.id);
  const [wantedEdition, setWantedEdition] = useState(state.edition.id);
  const [scope, setScope] = useState<"missing" | "saved" | "selected">(initialTarget ? "selected" : "missing");
  const [give, setGive] = useState<Ref[]>(() => initialOffer && state.owned.some(row => row.cardNumber === initialOffer && row.quantity - 1 - row.reserved > 0)
    ? [{ editionId: state.edition.id, cardNumber: initialOffer }] : []);
  const [receive, setReceive] = useState<Ref[]>([]);
  const [recipient, setRecipient] = useState("");
  const [query, setQuery] = useState("");
  const [manualQuery, setManualQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [offerError, setOfferError] = useState("");
  const [responseError, setResponseError] = useState<{ id: string; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const composePanel = useRef<HTMLDivElement>(null);
  const focusCompose = useRef(false);
  const blocked = busy || submitting || !workspaceReady;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let listening = true;
    const version = ++revision.current;
    void (async () => {
      try {
        const response = await createSupabaseBrowserClient().rpc("get_current_cyclo_stickers_trade_inventory");
        if (response.error || !isCycloStickersTradeWorkspace(response.data, state.directorId)) throw new Error("Invalid trade inventory");
        if (!listening || version !== revision.current) return;
        setWorkspace(response.data); setWorkspaceReady(true); setWorkspaceError(false);
        workspaceListener.current?.(response.data);
        notifyCycloStickersTradesChanged(response.data.incomingOffers.length);
      } catch {
        if (listening && version === revision.current) setWorkspaceError(true);
      }
    })();
    return () => { listening = false; };
  }, [state.directorId, refreshAttempt]);

  const neededEditions = useMemo(() => [...new Set([offerEdition, wantedEdition,
    ...[...(view === "inbox" ? [...workspace.incomingOffers, ...workspace.outgoingOffers] : []), ...(historyOpen ? workspace.history : [])]
      .flatMap(offer => [...offer.giveItems, ...offer.receiveItems].map(item => item.editionId))])],
    [offerEdition, wantedEdition, view, historyOpen, workspace.incomingOffers, workspace.outgoingOffers, workspace.history]);
  useEffect(() => {
    for (const editionId of neededEditions) {
      const summary = workspace.editions.find(edition => edition.editionId === editionId);
      if (!summary || catalogueCache.current[editionId] || catalogueRequests.current.has(editionId)) continue;
      catalogueRequests.current.add(editionId);
      void (async () => {
        try {
          const response = await createSupabaseBrowserClient().rpc("get_cyclo_stickers_catalogue", { p_edition: editionId });
          const next = response.data?.snapshot as CollectorAlbumSnapshot | undefined;
          if (response.error || response.data?.editionId !== editionId || !next || next.edition !== editionId ||
            next.sourceSeason !== summary.sourceSeason || next.collectionSeason !== summary.collectionSeason ||
            next.sourceSeasonId !== summary.sourceSeasonId || !Array.isArray(next.cards) || next.cards.length !== summary.totalCards ||
            new Set(next.cards.map(card => card.number)).size !== next.cards.length ||
            next.cards.some(card => !Number.isInteger(card.number) || card.number < 1 || typeof card.name !== "string")) throw new Error("Invalid edition catalogue");
          if (!mounted.current) return;
          catalogueCache.current = { ...catalogueCache.current, [editionId]: next };
          setCatalogues(catalogueCache.current);
          setCatalogueErrors(current => ({ ...current, [editionId]: false }));
        } catch { if (mounted.current) setCatalogueErrors(current => ({ ...current, [editionId]: true })); }
        finally { catalogueRequests.current.delete(editionId); }
      })();
    }
  }, [neededEditions, workspace.editions, refreshAttempt]);

  const editions = useMemo(() => new Map(workspace.editions.map(edition => [edition.editionId, edition])), [workspace.editions]);
  const cardFor = (ref: Ref) => catalogues[ref.editionId]?.cards.find(card => card.number === ref.cardNumber);
  const seasonFor = (ref: Ref) => editions.get(ref.editionId)?.sourceSeason;
  const cardLabel = (ref: Ref, quantity = 1) => {
    const card = cardFor(ref);
    const label = [`S${seasonFor(ref) ?? "?"}`, `#${String(ref.cardNumber).padStart(2, "0")}`, card?.name, card?.stickerTitle].filter(Boolean).join(" · ");
    return quantity > 1 ? `${quantity} × ${label}` : label;
  };
  const describe = (items: readonly Ref[]) => [...new Map(items.map(item => [stickerReferenceKey(item), item])).values()]
    .map(item => cardLabel(item, countStickerReferences(items, item))).join(" + ");
  const stock: Stock[] = workspace.owned.flatMap(row => {
    const quantity = row.quantity - 1 - row.reserved;
    return row.editionId === offerEdition && quantity > 0 && cardFor(row) ? [{ ...row, quantity }] : [];
  });
  const validGive = fitsStock(give, stock);
  const wantedScope = useMemo(() => {
    const catalogue = catalogues[wantedEdition];
    if (!catalogue) return [];
    const numbers = wantedEdition === state.edition.id && scope === "selected" && initialTarget ? [initialTarget]
      : wantedEdition === state.edition.id && scope === "saved" && wanted.length ? [...wanted] : null;
    return catalogue.cards.filter(card => numbers ? numbers.includes(card.number) : manualQuery || !workspace.owned.some(row =>
      row.editionId === wantedEdition && row.cardNumber === card.number && (row.quantity > 0 || row.pasted)))
      .map(card => ({ editionId: wantedEdition, cardNumber: card.number }));
  }, [catalogues, wantedEdition, state.edition.id, scope, initialTarget, wanted, manualQuery, workspace.owned]);
  const searchKey = workspaceReady && validGive && catalogues[wantedEdition]
    ? JSON.stringify([sortStickerReferences(give), wantedScope, manualQuery, attempt]) : null;
  const currentResult = useMemo(() => result?.key === searchKey ? result : searchKey && wantedScope.length === 0
    ? { key: searchKey, collectors: [] } : null, [result, searchKey, wantedScope.length]);
  const searching = view === "compose" && Boolean(searchKey && !currentResult);
  const selected = currentResult?.collectors.find(collector => collector.directorId === recipient);
  const receiveStock = selected?.availableCards.filter(row => row.editionId === wantedEdition &&
    !give.some(item => stickerReferenceKey(item) === stickerReferenceKey(row)) && cardFor(row)) ?? [];
  const canSend = workspaceReady && validGive && selected && fitsStock(receive, receiveStock);
  const catalogueFailed = neededEditions.some(editionId => catalogueErrors[editionId]);

  useEffect(() => {
    if (view !== "compose" || !searchKey || currentResult || busy || submitting) return;
    let listening = true;
    void (async () => {
      try {
        const response = await createSupabaseBrowserClient().rpc("search_cyclo_stickers_cross_season_matches", {
          p_give: sortStickerReferences(give), p_wanted: wantedScope, p_query: manualQuery, p_limit: 20,
        });
        if (response.error || !Array.isArray(response.data)) throw new Error("Trade search unavailable");
        if (listening) setResult({ key: searchKey, collectors: response.data as CycloStickersCrossCollector[] });
      } catch { if (listening) setResult({ key: searchKey, collectors: [], failed: true }); }
    })();
    return () => { listening = false; };
  }, [view, searchKey, currentResult, busy, submitting, give, wantedScope, manualQuery]);

  function applyWorkspace(next: CycloStickersTradeWorkspace) {
    if (!mounted.current || !isCycloStickersTradeWorkspace(next, state.directorId)) return;
    revision.current += 1;
    setWorkspace(next); setWorkspaceReady(true); setWorkspaceError(false);
    workspaceListener.current?.(next);
  }
  function clearSelection() { setResult(null); setRecipient(""); setReceive([]); setOfferError(""); }
  function changeOffer(next: Ref[]) { setGive(next); setManualQuery(""); clearSelection(); }
  function focusOfferPicker() {
    const target = composePanel.current?.querySelector<HTMLElement>("[data-trade-start-target]:not(:disabled)") ?? composePanel.current;
    target?.focus();
  }
  useEffect(() => {
    if (view === "compose" && focusCompose.current) { focusCompose.current = false; focusOfferPicker(); }
  }, [view]);
  function startTrade() { if (view === "compose") focusOfferPicker(); else { focusCompose.current = true; setView("compose"); } }

  async function sendOffer() {
    if (!canSend || blocked || searching || operation.current) return;
    operation.current = true; setSubmitting(true); setOfferError("");
    const sortedGive = sortStickerReferences(give), sortedReceive = sortStickerReferences(receive);
    const requestId = request.current.forOffer(JSON.stringify([state.edition.id, recipient, sortedGive, sortedReceive]));
    let confirmedStatus: CycloStickersTradeStatus | undefined;
    try {
      const next = await mutate("propose_cyclo_stickers_cross_season_trade", {
        p_view_edition: state.edition.id, p_expected_director_id: state.directorId,
        p_request_id: requestId, p_recipient_id: recipient, p_give: sortedGive, p_receive: sortedReceive,
      }, () => confirmedStatus === "accepted" ? t.acceptedNotice : confirmedStatus === "expired" ? t.expiredNotice
        : confirmedStatus === "cancelled" || confirmedStatus === "declined" ? t.closedNotice : t.sent,
      setOfferError, (next, receipt) => { confirmedStatus = receipt?.status; applyWorkspace(next); });
      if (!next || !mounted.current) return;
      request.current.confirmed(requestId); changeOffer([]); setView("inbox");
    } finally { operation.current = false; if (mounted.current) setSubmitting(false); }
  }
  async function respond(offer: CycloStickersCrossTrade, response: "accept" | "decline" | "cancel") {
    if (operation.current || blocked) return;
    operation.current = true; setSubmitting(true); setResponseError(null);
    let confirmedStatus: CycloStickersTradeStatus | undefined;
    try {
      await mutate("respond_cyclo_stickers_cross_season_trade", {
        p_view_edition: state.edition.id, p_expected_director_id: state.directorId, p_offer_id: offer.id, p_response: response,
        p_expected_give: sortStickerReferences(offer.giveItems), p_expected_receive: sortStickerReferences(offer.receiveItems),
      }, () => confirmedStatus === "accepted" ? t.acceptedNotice : confirmedStatus === "expired" ? t.expiredNotice : t.closedNotice,
      message => setResponseError({ id: offer.id, message }), (next, receipt) => { confirmedStatus = receipt?.status; applyWorkspace(next); });
    } finally { operation.current = false; if (mounted.current) setSubmitting(false); }
  }

  function picker(entries: readonly Stock[], values: readonly Ref[], change: (next: Ref[]) => void, offering = false) {
    return <ul className={styles.picker}>{entries.map(row => {
      const card = cardFor(row);
      if (!card) return null;
      const count = countStickerReferences(values, row), rarity = getCollectorCardRarity(card);
      return <li key={stickerReferenceKey(row)} className={styles.sticker} data-rarity={rarity} data-selected={count > 0}>
        <button type="button" className={styles.cardButton} data-trade-start-target={offering || undefined}
          aria-label={locale === "en" ? `Add ${cardLabel(row)}` : `Ajouter ${cardLabel(row)}`}
          disabled={blocked || values.length >= LIMIT || count >= row.quantity} onClick={() => change([...values, stickerReference(row)])}>
          <span className={styles.portrait} aria-hidden="true">{card.kind ? <span className={`fi fi-${card.countryCode.toLowerCase()}`} />
            : <RiderAvatar profileKey={card.avatarProfileKey} seed={card.avatarSeed} riderId={card.id} age={card.age} jersey={card.jersey} renderMode="compact" className={styles.avatar} />}</span>
          <span className={styles.identity}><strong>{card.name}</strong><small><b className={styles.season}>S{seasonFor(row)}</b> #{String(row.cardNumber).padStart(2, "0")} · {t[rarity]} · ×{row.quantity}</small>
            {card.stickerTitle ? <small>{card.stickerTitle}</small> : null}</span>
          <span className={styles.add}>{offering && !values.length ? t.find : t.add} <span aria-hidden="true">+</span></span>
        </button>
        {count > 0 ? <div className={styles.quantity}><button type="button" disabled={blocked}
          aria-label={locale === "en" ? `Remove ${cardLabel(row)}` : `Retirer ${cardLabel(row)}`} onClick={() => {
            const index = values.findLastIndex(item => stickerReferenceKey(item) === stickerReferenceKey(row));
            change(values.filter((_, position) => position !== index));
          }}>−</button><output>{count}</output></div> : null}
      </li>;
    })}</ul>;
  }
  function receipt(offer: CycloStickersCrossTrade, outgoing: boolean) {
    const received = getCrossSeasonReceivedCards(outgoing ? offer.receiveItems : offer.giveItems, workspace.owned);
    const duplicates = received.reduce((sum, card) => sum + card.duplicateQuantity, 0);
    const warningId = `${id}-${offer.id}-duplicates`;
    const fullyDescribed = [...offer.giveItems, ...offer.receiveItems].every(item => cardFor(item));
    return <article className={styles.receipt} key={offer.id}>
      <h4>{outgoing ? offer.toName : offer.fromName}</h4><dl>
        <div><dt>{t.givenTo}</dt><dd>{describe(outgoing ? offer.giveItems : offer.receiveItems)}</dd></div>
        <div><dt>{t.askingFor}</dt><dd><ul className={styles.receivedCards}>{received.map(card => <li key={stickerReferenceKey(card)}>
          <span>{cardLabel(card, card.quantity)}</span><small className={styles.collectionStatus} data-owned={!card.newForCollection}>
            {card.newForCollection ? t.newForYou : t.alreadyOwned}
            {card.newForCollection && card.duplicateQuantity > 0 ? locale === "en" ? ` · ${card.duplicateQuantity} spare${card.duplicateQuantity > 1 ? "s" : ""}` : ` · ${card.duplicateQuantity} double${card.duplicateQuantity > 1 ? "s" : ""}` : null}
          </small></li>)}</ul></dd></div>
      </dl>
      {!fullyDescribed ? <p role="status">{t.loadingCatalogue}</p> : null}
      {duplicates > 0 ? <aside className={styles.duplicateWarning} id={warningId} role="note"><span aria-hidden="true">!</span>
        <div><strong>{locale === "en" ? `You will receive ${duplicates} spare ${duplicates > 1 ? "copies" : "copy"}.` : `Tu recevras ${duplicates} exemplaire${duplicates > 1 ? "s" : ""} en double.`}</strong><p>{t.duplicateHelp}</p></div></aside> : null}
      <div className={styles.receiptActions}>{outgoing
        ? <button type="button" className={styles.secondary} disabled={blocked} onClick={() => void respond(offer, "cancel")}>{t.cancel}</button>
        : <><button type="button" className={styles.primary} aria-describedby={duplicates > 0 ? warningId : undefined} disabled={blocked || !fullyDescribed} onClick={() => void respond(offer, "accept")}>{t.accept}</button>
          <button type="button" className={styles.secondary} disabled={blocked} onClick={() => void respond(offer, "decline")}>{t.decline}</button></>}</div>
      {responseError?.id === offer.id ? <p className={styles.actionError} role="alert">{responseError.message}</p> : null}
    </article>;
  }

  return <section className={styles.desk} aria-label={t.heading} data-album-trade-composer="" tabIndex={-1}>
    <header className={styles.header}><h2>{t.heading}</h2><div className={styles.switcher}>
      <button type="button" className={styles.start} aria-controls={`${id}-compose`} onClick={startTrade}><span aria-hidden="true">＋</span> {t.compose}</button>
      <button type="button" aria-pressed={view === "inbox"} onClick={() => setView("inbox")}>{t.inbox} <span>{workspace.incomingOffers.length + workspace.outgoingOffers.length}</span></button>
    </div></header>
    <p className={styles.collectionsHelp}>{t.collectionsHelp}</p>
    {!workspaceReady && !workspaceError ? <p role="status" className={styles.empty}>{t.loadingStock}</p> : null}
    {workspaceError || catalogueFailed ? <div className={styles.retry}><p role="alert">{t.stockUnavailable}</p>
      <button type="button" className={styles.secondary} disabled={busy || submitting} onClick={() => setRefreshAttempt(value => value + 1)}>{t.retryStock}</button></div> : null}
    {view === "compose" ? <div ref={composePanel} id={`${id}-compose`} className={styles.workbench} tabIndex={-1}>
      <fieldset className={styles.step} disabled={blocked}><legend>{t.offered} <span>{give.length}/{LIMIT}</span></legend>
        <div className={styles.collectionPickers}>
          <label>{t.offerCollection}<select aria-label={t.offerCollection} value={offerEdition} onChange={event => { setOfferEdition(event.target.value); changeOffer([]); }}>
            {workspace.editions.map(edition => <option key={edition.editionId} value={edition.editionId}>Album S{edition.sourceSeason}</option>)}</select></label>
          <label>{t.wantedCollection}<select aria-label={t.wantedCollection} value={wantedEdition} onChange={event => { setWantedEdition(event.target.value); setScope("missing"); setManualQuery(""); clearSelection(); }}>
            {workspace.editions.map(edition => <option key={edition.editionId} value={edition.editionId}>Album S{edition.sourceSeason}</option>)}</select></label>
        </div>
        {!catalogues[offerEdition] || !catalogues[wantedEdition] ? <p role="status">{t.loadingCatalogue}</p> : null}
        {stock.length ? <><p>{give.length ? t.chooseOffer : t.intro}</p>{picker(stock, give, changeOffer, true)}</>
          : <div className={styles.emptyStock}><p><strong>{t.emptyStock}</strong></p><p>{t.emptyStockHelp}</p>
            {onViewBoosters && offerEdition === state.edition.id ? <button type="button" className={styles.primary} data-trade-start-target onClick={onViewBoosters}>{t.openBoosters}</button>
              : <Link className={styles.primary} data-trade-start-target href={`/jeu/album?edition=${encodeURIComponent(offerEdition)}&onglet=boosters`}>{t.openBoosters}</Link>}</div>}
        {stock.length && wantedEdition === state.edition.id && (initialTarget || wanted.length) ? <div className={styles.searchTools}>
          <label>{t.searchOptions}<select value={scope} onChange={event => { setScope(event.target.value as typeof scope); setManualQuery(""); clearSelection(); }}>
            <option value="missing">{t.missing}</option>{wanted.length ? <option value="saved">{t.saved} ({wanted.length})</option> : null}
            {initialTarget ? <option value="selected">{t.selected} · {cardLabel({ editionId: state.edition.id, cardNumber: initialTarget })}</option> : null}
          </select></label></div> : null}
        {validGive ? <details className={styles.manual}><summary>{t.manualTitle}</summary><form className={styles.searchTools} onSubmit={event => {
          event.preventDefault(); if (!query.trim()) return; setManualQuery(query.trim()); setAttempt(value => value + 1); clearSelection();
        }}><label>{t.name}<input value={query} maxLength={80} onChange={event => setQuery(event.target.value)} /></label>
          <button type="submit" className={styles.secondary} disabled={!query.trim()}>{t.searchDirector}</button></form></details> : null}
      </fieldset>
      {stock.length ? <div className={styles.results}><div className={styles.resultHead}><h3>{manualQuery ? t.manualMatches : t.matches}</h3>
        {manualQuery ? <button type="button" className={styles.secondary} disabled={blocked} onClick={() => { setManualQuery(""); clearSelection(); }}>{t.find}</button> : null}</div>
        {!validGive ? <p className={styles.empty}>{t.selectDuplicate}</p> : null}{searching ? <p className={styles.empty} role="status">{t.searching}</p> : null}
        {currentResult?.failed ? <div className={styles.retry}><p role="alert">{t.unavailable}</p><button type="button" className={styles.secondary} disabled={blocked} onClick={() => setAttempt(value => value + 1)}>{t.retry}</button></div> : null}
        {currentResult && !currentResult.failed ? currentResult.collectors.length ? <div className={styles.matches}>
          {currentResult.collectors.map(collector => <button type="button" key={collector.directorId} className={styles.match} disabled={blocked} aria-pressed={recipient === collector.directorId} onClick={() => {
            if (recipient !== collector.directorId) { setRecipient(collector.directorId); setReceive([]); setOfferError(""); }
          }}><strong>{collector.displayName}</strong>{collector.wantedOfferCards.length ? <span>{t.wants} <b>{describe(collector.wantedOfferCards)}</b></span> : null}
            <span>{t.duplicates} <b>{describe(collector.availableCards.slice(0, 3))}</b>{collector.availableCards.length > 3 ? ` +${collector.availableCards.length - 3}` : null}</span></button>)}
          {!selected ? <p className={styles.empty}>{t.selectRecipient}</p> : null}</div>
          : <p className={styles.empty} role="status">{manualQuery ? t.noDirectors : t.noMatches}</p> : null}
      </div> : null}
      {selected ? <fieldset className={`${styles.step} ${styles.requested}`} disabled={blocked || searching}><legend>{t.requested} <span>{receive.length}/{LIMIT}</span></legend>
        {receiveStock.length ? picker(receiveStock, receive, next => { setReceive(next); setOfferError(""); }) : <p className={styles.empty}>{t.emptyReceive}</p>}
        <div className={styles.summary}><dl><div><dt>{t.givenTo}</dt><dd>{describe(give)}</dd></div>{receive.length ? <div><dt>{t.askingFor}</dt><dd>{describe(receive)}</dd></div> : null}</dl>
          <button type="button" className={styles.primary} disabled={!canSend || blocked} onClick={() => void sendOffer()}>{t.offer}</button>
          {offerError ? <p className={styles.actionError} role="alert">{offerError}</p> : null}<p>{canSend ? t.reserved : !receive.length ? t.missingRequest : t.updateOffer}</p></div>
      </fieldset> : null}
    </div> : <><div className={styles.mailbox}>
      <section><h3>{t.incoming} <span>{workspace.incomingOffers.length}</span></h3>{workspace.incomingOffers.length ? workspace.incomingOffers.map(offer => receipt(offer, false)) : <p className={styles.empty}>{t.noOffers}</p>}</section>
      <section><h3>{t.outgoing} <span>{workspace.outgoingOffers.length}</span></h3>{workspace.outgoingOffers.length ? workspace.outgoingOffers.map(offer => receipt(offer, true)) : <p className={styles.empty}>{t.noOffers}</p>}</section>
    </div>{workspace.history.length ? <details className={styles.history} onToggle={event => setHistoryOpen(event.currentTarget.open)}><summary>{t.history}</summary><ul>{workspace.history.map(offer => <li key={offer.id}>
      <span>{describe(offer.giveItems)} ⇄ {describe(offer.receiveItems)}</span><b>{t[offer.status]}</b></li>)}</ul></details> : null}</>}
  </section>;
}
