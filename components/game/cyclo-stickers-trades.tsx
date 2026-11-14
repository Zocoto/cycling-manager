"use client";

import { useId, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { getCollectorCardRarity, type CollectorAlbumSnapshot } from "@/lib/game/collector-album";
import { createCycloStickersTradeRequestIds } from "@/lib/game/cyclo-stickers-persistent-view";
import type { CycloStickersCollectorMatch, CycloStickersPersistentState, CycloStickersTrade } from "@/lib/game/cyclo-stickers-persistence";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import retro from "./collector-album-retro.module.css";
import styles from "./cyclo-stickers-trades.module.css";

const LIMIT = 3;
const COPY = {
  fr: {
    heading: "Échanges de vignettes",
    intro: "Choisis ce que tu proposes. Le carnet te montre les collectionneurs à qui il manque au moins une de ces vignettes et qui ont un double que tu recherches.",
    offered: "Tes vignettes à proposer",
    emptyStock: "Tu n’as aucune vignette libre à proposer.",
    chooseOffer: "Choisis jusqu’à trois exemplaires libres. Les vignettes collées et réservées sont protégées.",
    searchOptions: "Vignettes recherchées",
    missing: "Toutes les vignettes manquantes",
    saved: "Ma liste de recherche",
    selected: "La vignette choisie dans l’album",
    searchMatches: "Trouver des échanges",
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
    selectRecipient: "Choisis un collectionneur pour voir ses vignettes disponibles.",
    givenTo: "Tu proposes",
    askingFor: "Tu demandes",
    offer: "Envoyer la proposition",
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
    intro: "Choose what you can offer. The trade desk finds collectors missing at least one of those stickers who have a spare that you want.",
    offered: "Stickers you can offer",
    emptyStock: "You have no available stickers to offer.",
    chooseOffer: "Choose up to three available copies. Pasted and reserved stickers are protected.",
    searchOptions: "Stickers you want",
    missing: "All missing stickers",
    saved: "My wanted list",
    selected: "Sticker selected in the album",
    searchMatches: "Find trades",
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
    selectRecipient: "Choose a collector to see their available stickers.",
    givenTo: "You offer",
    askingFor: "You request",
    offer: "Send offer",
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
type SearchResult = { mode: SearchMode; collectors: CycloStickersCollectorMatch[] };
type Mutation = (
  name: string,
  args: Record<string, unknown>,
  message: string | ((next: CycloStickersPersistentState) => string),
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

export function CycloStickersTrades({ snapshot, state, busy, mutate, initialTarget, wanted }: {
  snapshot: CollectorAlbumSnapshot;
  state: CycloStickersPersistentState;
  busy: boolean;
  mutate: Mutation;
  initialTarget: number | null;
  wanted: readonly number[];
}) {
  const { locale } = useLocale();
  const t = COPY[locale];
  const id = useId();
  const request = useRef(createCycloStickersTradeRequestIds());
  const searchLock = useRef(false);
  const [scope, setScope] = useState<"missing" | "saved" | "selected">(initialTarget ? "selected" : "missing");
  const [give, setGive] = useState<number[]>([]);
  const [receive, setReceive] = useState<number[]>([]);
  const [recipient, setRecipient] = useState("");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const cards = new Map(snapshot.cards.map(card => [card.number, card]));
  const cardName = (number: number) => cards.get(number)?.name ?? `#${number}`;
  const stock = state.owned.flatMap(row => {
    const quantity = row.quantity - Number(row.pasted) - row.reserved;
    return quantity > 0 && cards.has(row.cardNumber) ? [{ cardNumber: row.cardNumber, quantity }] : [];
  });
  const selected = result?.collectors.find(collector => collector.directorId === recipient);
  const receiveStock = selected?.availableCards.filter(row => !give.includes(row.cardNumber) && cards.has(row.cardNumber)) ?? [];
  const validGive = fitsStock(give, stock);
  const canSend = validGive && selected && fitsStock(receive, receiveStock);

  function clearSearch() {
    setResult(null);
    setRecipient("");
    setReceive([]);
    setError("");
  }

  function search(mode: SearchMode) {
    if (!validGive || searchLock.current || busy || (mode === "manual" && !query.trim())) return;
    searchLock.current = true;
    setSearching(true);
    clearSearch();
    void (async () => {
      try {
        const client = createSupabaseBrowserClient();
        const response = mode === "matches"
          ? await client.rpc("search_current_cyclo_stickers_trade_matches", {
              p_edition: state.edition.id,
              p_give: give,
              p_wanted: scope === "selected" && initialTarget ? [initialTarget] : scope === "saved" && wanted.length ? [...wanted] : null,
              p_query: "",
              p_limit: 20,
            })
          : await client.rpc("search_current_cyclo_stickers_collectors", {
              p_edition: state.edition.id,
              p_query: query.trim(),
              p_card_number: scope === "selected" ? initialTarget : null,
              p_limit: 20,
            });
        if (response.error) throw new Error(response.error.message);
        const collectors = (response.data ?? []) as CycloStickersCollectorMatch[];
        setResult({ mode, collectors: mode === "manual"
          ? collectors.map(collector => ({ ...collector, wantedOfferCards: [] }))
          : collectors });
      } catch {
        setError(t.unavailable);
      } finally {
        searchLock.current = false;
        setSearching(false);
      }
    })();
  }

  function sendOffer() {
    if (!canSend || busy || searching) return;
    const sortedGive = [...give].sort((a, b) => a - b);
    const sortedReceive = [...receive].sort((a, b) => a - b);
    const requestId = request.current.forOffer(JSON.stringify([recipient, sortedGive, sortedReceive]));
    void mutate("propose_current_cyclo_stickers_trade", {
      p_edition: state.edition.id,
      p_request_id: requestId,
      p_recipient_id: recipient,
      p_give: sortedGive,
      p_receive_cards: sortedReceive,
    }, t.sent).then(next => {
      if (!next) return;
      request.current.confirmed(requestId);
      setGive([]);
      clearSearch();
    });
  }

  function respond(offer: CycloStickersTrade, response: "accept" | "decline" | "cancel") {
    void mutate("respond_current_cyclo_stickers_trade", {
      p_edition: state.edition.id,
      p_offer_id: offer.id,
      p_response: response,
      p_expected_receive_cards: requestedCards(offer),
    }, next => {
      const closedOffer = next.history.find(item => item.id === offer.id);
      if (closedOffer?.status === "accepted") return t.acceptedNotice;
      return closedOffer?.status === "expired" ? t.expiredNotice : t.closedNotice;
    });
  }

  function picker(entries: readonly Stock[], values: readonly number[], change: (next: number[]) => void) {
    return <ul className={styles.picker}>
      {entries.map(({ cardNumber, quantity }) => {
        const card = cards.get(cardNumber);
        if (!card) return null;
        const count = countCopies(values, cardNumber);
        const rarity = getCollectorCardRarity(card);
        return <li key={cardNumber} className={styles.sticker} data-rarity={rarity} data-selected={count > 0}>
          <span className={styles.number}>#{String(cardNumber).padStart(2, "0")}</span>
          <span className={styles.identity}><strong>{card.name}</strong><small>{t[rarity]} · ×{quantity}</small></span>
          <div className={styles.quantity} aria-label={card.name}>
            <button type="button" aria-label={locale === "en" ? `Remove ${card.name}` : `Retirer ${card.name}`} disabled={count === 0} onClick={() => {
              const index = values.lastIndexOf(cardNumber);
              change(values.filter((_, position) => position !== index));
            }}>−</button>
            <output>{count}</output>
            <button type="button" aria-label={locale === "en" ? `Add ${card.name}` : `Ajouter ${card.name}`} disabled={values.length >= LIMIT || count >= quantity} onClick={() => change([...values, cardNumber])}>+</button>
          </div>
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
  </article>;

  return <section className={`${retro.tradeWindow} ${styles.desk}`} aria-label={t.heading} data-album-trade-composer="" tabIndex={-1}>
    <header className={retro.sectionHeading}>
      <h2>{t.heading}</h2>
      <span>{t.intro}</span>
    </header>
    <fieldset className={styles.step} disabled={busy || searching}>
      <legend>{t.offered} <span>{give.length}/{LIMIT}</span></legend>
      {stock.length
        ? <><p>{t.chooseOffer}</p>{picker(stock, give, next => { setGive(next); clearSearch(); })}</>
        : <p className={styles.empty}>{t.emptyStock}</p>}
      {stock.length ? <div className={styles.searchTools}>
        <label htmlFor={`${id}-scope`}>{t.searchOptions}
          <select id={`${id}-scope`} value={scope} onChange={event => {
            setScope(event.target.value as typeof scope);
            clearSearch();
          }}>
            <option value="missing">{t.missing}</option>
            {wanted.length ? <option value="saved">{t.saved} ({wanted.length})</option> : null}
            {initialTarget ? <option value="selected">{t.selected} · {cardName(initialTarget)}</option> : null}
          </select>
        </label>
        <button type="button" className={styles.primary} disabled={!validGive} onClick={() => search("matches")}>{searching ? t.searching : t.searchMatches}</button>
      </div> : null}
      {stock.length ? <details className={styles.manual}>
        <summary>{t.manualTitle}</summary>
        <form className={styles.searchTools} onSubmit={event => { event.preventDefault(); search("manual"); }}>
          <label htmlFor={`${id}-name`}>{t.name}<input id={`${id}-name`} value={query} maxLength={80} onChange={event => {
            setQuery(event.target.value);
            if (result?.mode === "manual") clearSearch();
          }} /></label>
          <button type="submit" className={styles.secondary} disabled={!validGive || !query.trim()}>{t.searchDirector}</button>
        </form>
      </details> : null}
    </fieldset>
    {searching ? <p className={styles.empty} role="status">{t.searching}</p> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {result ? <fieldset className={styles.step} disabled={busy || searching}>
      <legend>{result.mode === "matches" ? t.matches : t.manualMatches}</legend>
      {result.collectors.length > 0 ? <div className={styles.matches}>
        {result.collectors.map(collector => <button type="button" key={collector.directorId} className={styles.match} aria-pressed={recipient === collector.directorId} onClick={() => {
          setRecipient(collector.directorId);
          setReceive([]);
        }}>
          <strong>{collector.displayName}</strong>
          {collector.wantedOfferCards.length ? <span>{t.wants} <b>{describe(collector.wantedOfferCards)}</b></span> : null}
          {result.mode === "matches" ? <span>{t.duplicates} <b>{describe(collector.availableCards.slice(0, 3).map(row => row.cardNumber))}</b>
            {collector.availableCards.length > 3 ? ` +${collector.availableCards.length - 3}` : null}
          </span> : null}
        </button>)}
      </div> : <p className={styles.empty} role="status">{result.mode === "matches" ? t.noMatches : t.noDirectors}</p>}
      {result.collectors.length > 0 && !selected ? <p>{t.selectRecipient}</p> : null}
    </fieldset> : null}
    {selected ? <fieldset className={styles.step} disabled={busy || searching}>
      <legend>{t.requested} <span>{receive.length}/{LIMIT}</span></legend>
      {receiveStock.length ? picker(receiveStock, receive, setReceive) : <p className={styles.empty}>{t.emptyReceive}</p>}
      <div className={styles.summary}>
        <dl>
          <div><dt>{t.givenTo}</dt><dd>{describe(give)}</dd></div>
          {receive.length ? <div><dt>{t.askingFor}</dt><dd>{describe(receive)}</dd></div> : null}
        </dl>
        <button type="button" className={styles.primary} disabled={!canSend} onClick={sendOffer}>{t.offer}</button>
        <p>{t.reserved}</p>
      </div>
    </fieldset> : null}
    <div className={styles.mailbox}>
      <section><h3>{t.incoming} <span>{state.incomingOffers.length}</span></h3>
        {state.incomingOffers.length ? state.incomingOffers.map(offer => receipt(offer, false)) : <p className={styles.empty}>{t.noOffers}</p>}
      </section>
      <section><h3>{t.outgoing} <span>{state.outgoingOffers.length}</span></h3>
        {state.outgoingOffers.length ? state.outgoingOffers.map(offer => receipt(offer, true)) : <p className={styles.empty}>{t.noOffers}</p>}
      </section>
    </div>
    {state.history.length ? <details className={styles.history}><summary>{t.history}</summary>
      <ul>{state.history.map(offer => <li key={offer.id}><span>{describe(offer.give)} ⇄ {describe(requestedCards(offer))}</span><b>{t[offer.status]}</b></li>)}</ul>
    </details> : null}
  </section>;
}
