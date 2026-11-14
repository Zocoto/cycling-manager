"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import Link from "@/components/ui/app-link";
import { getCollectorCardRarity, type CollectorAlbumSnapshot } from "@/lib/game/collector-album";
import { createCycloStickersTradeRequestIds } from "@/lib/game/cyclo-stickers-persistent-view";
import type { CycloStickersCollectorMatch, CycloStickersPersistentState, CycloStickersTrade } from "@/lib/game/cyclo-stickers-persistence";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { RiderAvatar } from "./rider-avatar";
import styles from "./cyclo-stickers-trades.module.css";

const LIMIT = 3;
const COPY = {
  fr: {
    heading: "Échanges de vignettes",
    intro: "Sélectionne un double pour trouver les collectionneurs qui en ont besoin et possèdent une vignette qui te manque.",
    compose: "Lancer un échange",
    inbox: "Mes propositions",
    offered: "Tes doubles disponibles",
    emptyStock: "Tu n’as pas encore de double disponible pour un échange.",
    emptyStockHelp: "Ton premier exemplaire reste dans ta collection. Les doubles libres apparaîtront ici.",
    openBoosters: "Ouvrir mes boosters",
    chooseOffer: "Tu peux proposer jusqu’à trois doubles.",
    searchOptions: "Vignettes recherchées",
    missing: "Toutes les vignettes manquantes",
    saved: "Ma liste de recherche",
    selected: "La vignette choisie dans l’album",
    find: "Trouver un échange",
    add: "Ajouter à l’offre",
    retry: "Relancer la recherche",
    searching: "Recherche en cours…",
    manualTitle: "Chercher un DS par son nom",
    name: "Nom du DS",
    searchDirector: "Chercher ce DS",
    matches: "Collectionneurs compatibles",
    manualMatches: "Résultats par nom",
    noMatches: "Aucun collectionneur ne correspond à cette proposition. Essaie d’autres vignettes ou élargis ta recherche.",
    noDirectors: "Aucun collectionneur trouvé avec ce nom.",
    unavailable: "La recherche est indisponible.",
    wants: "Il lui manque",
    duplicates: "Doubles recherchés disponibles",
    requested: "Les vignettes que tu demandes",
    emptyReceive: "Ce collectionneur n’a aucune autre vignette disponible pour cet échange.",
    selectRecipient: "Choisis un collectionneur pour composer ton échange.",
    selectDuplicate: "Choisis un double pour afficher les échanges possibles.",
    givenTo: "Tu proposes",
    askingFor: "Tu demandes",
    offer: "Envoyer la proposition",
    missingRequest: "Choisis au moins une vignette à demander pour envoyer ta proposition.",
    updateOffer: "Les exemplaires sélectionnés ne sont plus disponibles. Ajuste ta sélection.",
    reserved: "Tes exemplaires restent réservés tant que l’offre est active, pendant 48 h au maximum.",
    sent: "Proposition envoyée. Tes exemplaires sont réservés.",
    incoming: "Propositions reçues",
    outgoing: "Propositions envoyées",
    noOffers: "Aucune proposition en cours.",
    history: "Historique des échanges",
    accept: "Accepter cet échange",
    decline: "Refuser",
    cancel: "Annuler ma proposition",
    acceptedNotice: "Échange accepté. Les cartes ont été transférées.",
    closedNotice: "Proposition close. Les cartes réservées sont libérées.",
    expiredNotice: "La proposition a expiré. Les cartes réservées sont libérées.",
    pending: "En attente",
    accepted: "Accepté",
    declined: "Refusé",
    cancelled: "Annulé",
    expired: "Expiré",
    gold: "Or",
    silver: "Argent",
    bronze: "Bronze",
    holographic: "Édition spéciale",
  },
  en: {
    heading: "Sticker trades",
    intro: "Select a spare to find collectors who need it and have a sticker you’re missing.",
    compose: "Start a trade",
    inbox: "My offers",
    offered: "Your available spares",
    emptyStock: "You don’t have any spare stickers available for a trade yet.",
    emptyStockHelp: "Your first copy stays in your collection. Available spares will appear here.",
    openBoosters: "Open my boosters",
    chooseOffer: "You can offer up to three spares.",
    searchOptions: "Stickers you want",
    missing: "All missing stickers",
    saved: "My wanted list",
    selected: "Sticker selected in the album",
    find: "Find a trade",
    add: "Add to offer",
    retry: "Search again",
    searching: "Searching…",
    manualTitle: "Find an SD by name",
    name: "SD name",
    searchDirector: "Find this SD",
    matches: "Matching collectors",
    manualMatches: "Name search results",
    noMatches: "No collectors match this offer. Try other stickers or broaden your search.",
    noDirectors: "No collectors found with that name.",
    unavailable: "Search is unavailable.",
    wants: "Missing from their collection",
    duplicates: "Available spares you want",
    requested: "Stickers you are asking for",
    emptyReceive: "This collector has no other stickers available for this trade.",
    selectRecipient: "Choose a collector to put together your trade.",
    selectDuplicate: "Select a spare to see possible trades.",
    givenTo: "You offer",
    askingFor: "You request",
    offer: "Send offer",
    missingRequest: "Choose at least one sticker to request before sending your offer.",
    updateOffer: "The copies you selected are no longer available. Adjust your selection.",
    reserved: "Your copies stay reserved while the offer is active, for up to 48 hours.",
    sent: "Offer sent. Your copies are reserved.",
    incoming: "Incoming offers",
    outgoing: "Sent offers",
    noOffers: "No pending offers.",
    history: "Trade history",
    accept: "Accept this trade",
    decline: "Decline",
    cancel: "Cancel my offer",
    acceptedNotice: "Trade accepted. The stickers have been transferred.",
    closedNotice: "Offer closed. Reserved copies have been released.",
    expiredNotice: "The offer expired. Reserved copies have been released.",
    pending: "Pending",
    accepted: "Accepted",
    declined: "Declined",
    cancelled: "Cancelled",
    expired: "Expired",
    gold: "Gold",
    silver: "Silver",
    bronze: "Bronze",
    holographic: "Special edition",
  },
} as const;

type Stock = { cardNumber: number; quantity: number };
type SearchMode = "matches" | "manual";
type SearchResult = { key: string; mode: SearchMode; collectors: CycloStickersCollectorMatch[]; failed?: true };
type Mutation = (
  name: string,
  args: Record<string, unknown>,
  message: string | ((next: CycloStickersPersistentState) => string),
  onError?: (message: string) => void,
) => Promise<CycloStickersPersistentState | null>;

function countCopies(numbers: readonly number[], cardNumber: number) {
  return numbers.filter(number => number === cardNumber).length;
}

function fitsStock(numbers: readonly number[], stock: readonly Stock[]) {
  return numbers.length > 0 && numbers.length <= LIMIT && numbers.every(number =>
    countCopies(numbers, number) <= (stock.find(row => row.cardNumber === number)?.quantity ?? 0),
  );
}

function requestedCards(offer: CycloStickersTrade) {
  return offer.receiveCards?.length ? offer.receiveCards : [offer.receive];
}

export function CycloStickersTrades({ snapshot, state, busy, mutate, initialTarget, wanted, initialOffer = null, initialView = "compose", onViewBoosters }: {
  snapshot: CollectorAlbumSnapshot;
  state: CycloStickersPersistentState;
  busy: boolean;
  mutate: Mutation;
  initialTarget: number | null;
  wanted: readonly number[];
  initialOffer?: number | null;
  initialView?: "compose" | "inbox";
  onViewBoosters?: () => void;
}) {
  const { locale } = useLocale();
  const t = COPY[locale];
  const id = useId();
  const request = useRef(createCycloStickersTradeRequestIds());
  const inFlight = useRef<{ key: string; promise: Promise<CycloStickersCollectorMatch[]> } | null>(null);
  const composePanel = useRef<HTMLDivElement>(null);
  const focusCompose = useRef(false);
  const [view, setView] = useState(initialView);
  const [scope, setScope] = useState<"missing" | "saved" | "selected">(initialTarget ? "selected" : "missing");
  const [give, setGive] = useState<number[]>(() => initialOffer && state.owned.some(row => row.cardNumber === initialOffer && row.quantity - 1 - row.reserved > 0) ? [initialOffer] : []);
  const [receive, setReceive] = useState<number[]>([]);
  const [recipient, setRecipient] = useState("");
  const [query, setQuery] = useState("");
  const [manualQuery, setManualQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [offerError, setOfferError] = useState("");
  const [responseError, setResponseError] = useState<{ id: string; message: string } | null>(null);

  const cards = new Map(snapshot.cards.map(card => [card.number, card]));
  const cardName = (number: number) => cards.get(number)?.name ?? `#${number}`;
  const stock = state.owned.flatMap(row => {
    const quantity = row.quantity - 1 - row.reserved;
    return quantity > 0 && cards.has(row.cardNumber) ? [{ cardNumber: row.cardNumber, quantity }] : [];
  });
  const validGive = fitsStock(give, stock);
  const wantedScope = useMemo(() => {
    if (scope === "selected" && initialTarget) return [initialTarget];
    if (scope === "saved" && wanted.length) return [...wanted];
    return null;
  }, [initialTarget, scope, wanted]);
  const mode: SearchMode = manualQuery ? "manual" : "matches";
  const searchKey = validGive ? JSON.stringify([state.edition.id, give, wantedScope, manualQuery, attempt]) : null;
  const currentResult = result?.key === searchKey ? result : null;
  const searching = view === "compose" && Boolean(searchKey && !currentResult);
  const selected = currentResult?.collectors.find(collector => collector.directorId === recipient);
  const receiveStock = selected?.availableCards.filter(row => !give.includes(row.cardNumber) && cards.has(row.cardNumber)) ?? [];
  const canSend = validGive && selected && fitsStock(receive, receiveStock);

  function focusOfferPicker() {
    const panel = composePanel.current;
    const target = panel?.querySelector<HTMLElement>("[data-trade-start-target]:not(:disabled)") ?? panel;
    target?.focus();
  }

  useEffect(() => {
    if (view !== "compose" || !focusCompose.current) return;
    focusCompose.current = false;
    focusOfferPicker();
  }, [view]);

  function startTrade() {
    if (view === "compose") {
      focusOfferPicker();
    } else {
      focusCompose.current = true;
      setView("compose");
    }
  }

  function clearSelection() {
    setResult(null);
    setRecipient("");
    setReceive([]);
    setOfferError("");
  }

  useEffect(() => {
    if (view !== "compose" || !searchKey || currentResult || busy) return;
    let listening = true;
    if (inFlight.current?.key !== searchKey) {
      const promise = (async () => {
        const client = createSupabaseBrowserClient();
        const response = mode === "matches"
          ? await client.rpc("search_current_cyclo_stickers_trade_matches", {
              p_edition: state.edition.id,
              p_give: give,
              p_wanted: wantedScope,
              p_query: "",
              p_limit: 20,
            })
          : await client.rpc("search_current_cyclo_stickers_collectors", {
              p_edition: state.edition.id,
              p_query: manualQuery,
              p_card_number: wantedScope?.length === 1 ? wantedScope[0] : null,
              p_limit: 20,
            });
        if (response.error) throw new Error(response.error.message);
        const collectors = (response.data ?? []) as CycloStickersCollectorMatch[];
        return mode === "manual"
          ? collectors.map(collector => ({ ...collector, wantedOfferCards: [] }))
          : collectors;
      })();
      inFlight.current = { key: searchKey, promise };
    }
    const { promise } = inFlight.current;
    void promise.then(
      collectors => { if (listening) setResult({ key: searchKey, mode, collectors }); },
      () => { if (listening) setResult({ key: searchKey, mode, collectors: [], failed: true }); },
    ).finally(() => {
      if (inFlight.current?.promise === promise) inFlight.current = null;
    });
    return () => { listening = false; };
  }, [busy, currentResult, give, manualQuery, mode, searchKey, state.edition.id, view, wantedScope]);

  function changeOffer(next: number[]) {
    setGive(next);
    setManualQuery("");
    clearSelection();
  }

  function sendOffer() {
    if (!canSend || busy || searching) return;
    setOfferError("");
    const sortedGive = [...give].sort((a, b) => a - b);
    const sortedReceive = [...receive].sort((a, b) => a - b);
    const requestId = request.current.forOffer(JSON.stringify([recipient, sortedGive, sortedReceive]));
    void mutate("propose_current_cyclo_stickers_trade", {
      p_edition: state.edition.id,
      p_request_id: requestId,
      p_recipient_id: recipient,
      p_give: sortedGive,
      p_receive_cards: sortedReceive,
    }, t.sent, setOfferError).then(next => {
      if (!next) return;
      request.current.confirmed(requestId);
      changeOffer([]);
      setView("inbox");
    });
  }

  function respond(offer: CycloStickersTrade, response: "accept" | "decline" | "cancel") {
    setResponseError(null);
    void mutate("respond_current_cyclo_stickers_trade", {
      p_edition: state.edition.id,
      p_offer_id: offer.id,
      p_response: response,
      p_expected_receive_cards: requestedCards(offer),
    }, next => {
      const closedOffer = next.history.find(item => item.id === offer.id);
      if (closedOffer?.status === "accepted") return t.acceptedNotice;
      return closedOffer?.status === "expired" ? t.expiredNotice : t.closedNotice;
    }, message => setResponseError({ id: offer.id, message }));
  }

  function picker(entries: readonly Stock[], values: readonly number[], change: (next: number[]) => void, offering = false) {
    return <ul className={styles.picker}>
      {entries.map(({ cardNumber, quantity }) => {
        const card = cards.get(cardNumber);
        if (!card) return null;
        const count = countCopies(values, cardNumber);
        const rarity = getCollectorCardRarity(card);
        const canAdd = values.length < LIMIT && count < quantity;
        return <li key={cardNumber} className={styles.sticker} data-rarity={rarity} data-selected={count > 0}>
          <button type="button" className={styles.cardButton} data-trade-start-target={offering || undefined} aria-label={locale === "en" ? `Add ${card.name}` : `Ajouter ${card.name}`} disabled={!canAdd} onClick={() => change([...values, cardNumber])}>
            <span className={styles.portrait} aria-hidden="true">
              {card.kind
                ? <span className={`fi fi-${card.countryCode.toLowerCase()}`} />
                : <RiderAvatar profileKey={card.avatarProfileKey} seed={card.avatarSeed} riderId={card.id} age={card.age} jersey={card.jersey} renderMode="compact" className={styles.avatar} />}
            </span>
            <span className={styles.identity}><strong>{card.name}</strong><small>#{String(cardNumber).padStart(2, "0")} · {t[rarity]} · ×{quantity}</small></span>
            <span className={styles.add}>{offering && !values.length ? t.find : t.add} <span aria-hidden="true">+</span></span>
          </button>
          {count > 0 ? <div className={styles.quantity}>
            <button type="button" aria-label={locale === "en" ? `Remove ${card.name}` : `Retirer ${card.name}`} disabled={count === 0} onClick={() => {
              const index = values.lastIndexOf(cardNumber);
              change(values.filter((_, position) => position !== index));
            }}>−</button>
            <output>{count}</output>
          </div> : null}
        </li>;
      })}
    </ul>;
  }

  const describe = (numbers: readonly number[]) => [...new Set(numbers)].map(number => {
    const count = countCopies(numbers, number);
    return count > 1 ? `${count} × ${cardName(number)}` : cardName(number);
  }).join(" + ");

  const receipt = (offer: CycloStickersTrade, outgoing: boolean) => <article className={styles.receipt} key={offer.id}>
    <h4>{outgoing ? offer.toName : offer.fromName}</h4>
    <dl>
      <div><dt>{t.givenTo}</dt><dd>{describe(outgoing ? offer.give : requestedCards(offer))}</dd></div>
      <div><dt>{t.askingFor}</dt><dd>{describe(outgoing ? requestedCards(offer) : offer.give)}</dd></div>
    </dl>
    <div className={styles.receiptActions}>
      {outgoing
        ? <button type="button" className={styles.secondary} disabled={busy} onClick={() => respond(offer, "cancel")}>{t.cancel}</button>
        : <><button type="button" className={styles.primary} disabled={busy} onClick={() => respond(offer, "accept")}>{t.accept}</button><button type="button" className={styles.secondary} disabled={busy} onClick={() => respond(offer, "decline")}>{t.decline}</button></>}
    </div>
    {responseError?.id === offer.id ? <p className={styles.actionError} role="alert">{responseError.message}</p> : null}
  </article>;

  return <section className={styles.desk} aria-label={t.heading} data-album-trade-composer="" tabIndex={-1}>
    <header className={styles.header}>
      <h2>{t.heading}</h2>
      <div className={styles.switcher}>
        <button type="button" className={styles.start} aria-controls={`${id}-compose`} onClick={startTrade}><span aria-hidden="true">＋</span> {t.compose}</button>
        <button type="button" aria-pressed={view === "inbox"} onClick={() => setView("inbox")}>{t.inbox} <span>{state.incomingOffers.length + state.outgoingOffers.length}</span></button>
      </div>
    </header>
    {view === "compose" ? <div ref={composePanel} id={`${id}-compose`} className={styles.workbench} tabIndex={-1}>
      <fieldset className={styles.step} disabled={busy}>
        <legend>{t.offered} <span>{give.length}/{LIMIT}</span></legend>
        {stock.length
          ? <><p>{give.length ? t.chooseOffer : t.intro}</p>{picker(stock, give, changeOffer, true)}</>
          : <div className={styles.emptyStock}>
            <p><strong>{t.emptyStock}</strong></p>
            <p>{t.emptyStockHelp}</p>
            {onViewBoosters
              ? <button type="button" className={styles.primary} data-trade-start-target onClick={onViewBoosters}>{t.openBoosters}</button>
              : <Link className={styles.primary} data-trade-start-target href="/jeu/album?onglet=boosters">{t.openBoosters}</Link>}
          </div>}
        {stock.length && (initialTarget || wanted.length) ? <div className={styles.searchTools}>
          <label htmlFor={`${id}-scope`}>{t.searchOptions}
            <select id={`${id}-scope`} value={scope} onChange={event => {
              setScope(event.target.value as typeof scope);
              setManualQuery("");
              clearSelection();
            }}>
              <option value="missing">{t.missing}</option>
              {wanted.length ? <option value="saved">{t.saved} ({wanted.length})</option> : null}
              {initialTarget ? <option value="selected">{t.selected} · {cardName(initialTarget)}</option> : null}
            </select>
          </label>
        </div> : null}
        {validGive ? <details className={styles.manual}>
          <summary>{t.manualTitle}</summary>
          <form className={styles.searchTools} onSubmit={event => {
            event.preventDefault();
            if (!query.trim()) return;
            setManualQuery(query.trim());
            setAttempt(value => value + 1);
            clearSelection();
          }}>
            <label htmlFor={`${id}-name`}>{t.name}<input id={`${id}-name`} value={query} maxLength={80} onChange={event => setQuery(event.target.value)} /></label>
            <button type="submit" className={styles.secondary} disabled={!query.trim()}>{t.searchDirector}</button>
          </form>
        </details> : null}
      </fieldset>
      {stock.length ? <div className={styles.results}>
        <div className={styles.resultHead}>
          <h3>{mode === "matches" ? t.matches : t.manualMatches}</h3>
          {mode === "manual" ? <button type="button" className={styles.secondary} disabled={busy} onClick={() => {
            setManualQuery("");
            clearSelection();
          }}>{t.find}</button> : null}
        </div>
        {!validGive ? <p className={styles.empty}>{t.selectDuplicate}</p> : null}
        {searching ? <p className={styles.empty} role="status">{t.searching}</p> : null}
        {currentResult?.failed ? <div className={styles.retry}>
          <p role="alert">{t.unavailable}</p>
          <button type="button" className={styles.secondary} disabled={busy} onClick={() => setAttempt(value => value + 1)}>{t.retry}</button>
        </div> : null}
        {currentResult && !currentResult.failed ? (
          currentResult.collectors.length > 0 ? <div className={styles.matches}>
            {currentResult.collectors.map(collector => <button type="button" key={collector.directorId} className={styles.match} disabled={busy} aria-pressed={recipient === collector.directorId} onClick={() => {
              if (recipient === collector.directorId) return;
              setRecipient(collector.directorId);
              setReceive([]);
              setOfferError("");
            }}>
              <strong>{collector.displayName}</strong>
              {collector.wantedOfferCards.length ? <span>{t.wants} <b>{describe(collector.wantedOfferCards)}</b></span> : null}
              {mode === "matches" ? <span>{t.duplicates} <b>{describe(collector.availableCards.slice(0, 3).map(row => row.cardNumber))}</b>
                {collector.availableCards.length > 3 ? ` +${collector.availableCards.length - 3}` : null}
              </span> : null}
            </button>)}
            {!selected ? <p className={styles.empty}>{t.selectRecipient}</p> : null}
          </div> : <p className={styles.empty} role="status">{mode === "matches" ? t.noMatches : t.noDirectors}</p>
        ) : null}
      </div> : null}
      {selected ? <fieldset className={`${styles.step} ${styles.requested}`} disabled={busy || searching}>
        <legend>{t.requested} <span>{receive.length}/{LIMIT}</span></legend>
        {receiveStock.length ? picker(receiveStock, receive, next => { setReceive(next); setOfferError(""); }) : <p className={styles.empty}>{t.emptyReceive}</p>}
        <div className={styles.summary}>
          <dl>
            <div><dt>{t.givenTo}</dt><dd>{describe(give)}</dd></div>
            {receive.length ? <div><dt>{t.askingFor}</dt><dd>{describe(receive)}</dd></div> : null}
          </dl>
          <button type="button" className={styles.primary} disabled={!canSend} onClick={sendOffer}>{t.offer}</button>
          {offerError ? <p className={styles.actionError} role="alert">{offerError}</p> : null}
          <p>{canSend ? t.reserved : !receive.length ? t.missingRequest : t.updateOffer}</p>
        </div>
      </fieldset> : null}
    </div> : <><div className={styles.mailbox}>
      <section><h3>{t.incoming} <span>{state.incomingOffers.length}</span></h3>
        {state.incomingOffers.length ? state.incomingOffers.map(offer => receipt(offer, false)) : <p className={styles.empty}>{t.noOffers}</p>}
      </section>
      <section><h3>{t.outgoing} <span>{state.outgoingOffers.length}</span></h3>
        {state.outgoingOffers.length ? state.outgoingOffers.map(offer => receipt(offer, true)) : <p className={styles.empty}>{t.noOffers}</p>}
      </section>
    </div>
    {state.history.length ? <details className={styles.history}><summary>{t.history}</summary>
      <ul>{state.history.map(offer => <li key={offer.id}><span>{describe(offer.give)} ⇄ {describe(requestedCards(offer))}</span><b>{t[offer.status]}</b></li>)}</ul>
    </details> : null}</>}
  </section>;
}
