"use client";

import { useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ALBUM_ACHIEVEMENTS, getAlbumAchievementProgress, type AlbumPilotAction, type CollectorAlbumSnapshot } from "@/lib/game/collector-album";
import { createCycloStickersTradeRequestIds, getCycloStickersActionRpc, getCycloStickersOpenRpc, toCycloStickersAlbumView } from "@/lib/game/cyclo-stickers-persistent-view";
import type { CycloStickersCollector, CycloStickersPersistentState, CycloStickersTrade } from "@/lib/game/cyclo-stickers-persistence";
import { CollectorAlbum } from "./collector-album";
import { CollectorCardFace } from "./collector-card-face";
import { AlbumBoosterArtwork } from "./collector-album-artwork";
import styles from "./collector-album-retro.module.css";

type Mutation = (name: string, args: Record<string, unknown>, message: string) => Promise<boolean>;
type Tab = "album" | "trades" | "boosters" | "achievements";

/** Only RPC responses can replace the collection. Browser demonstration saves are never read. */
export function CycloStickersPersistentAlbum({ snapshot, initialState, initialTab = "album" }: { snapshot: CollectorAlbumSnapshot; initialState: CycloStickersPersistentState; initialTab?: Tab }) {
  const [state, setState] = useState(initialState);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const locked = useRef(false);
  const mutate: Mutation = async (name, args, message) => {
    if (locked.current) return false;
    locked.current = true; setBusy(true); setNotice("");
    try {
      const result = await createSupabaseBrowserClient().rpc(name, args);
      if (result.error) throw new Error(result.error.message);
      const next = result.data?.state as CycloStickersPersistentState | undefined;
      if (!next || next.edition.id !== state.edition.id || next.directorId !== state.directorId) throw new Error("La réponse du serveur ne correspond pas à ta collection.");
      setState(next); setNotice(message); return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "L’action n’a pas pu être confirmée. Recharge la page pour retrouver ta collection.");
      return false;
    } finally { locked.current = false; setBusy(false); }
  };
  const send = (action: AlbumPilotAction) => {
    try {
      const rpc = getCycloStickersActionRpc(state.edition.id, action);
      void mutate(rpc.rpcName, rpc.args, action.type === "paste" ? "Vignette collée dans ton album." : "Récompense enregistrée dans ton compte.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Action indisponible."); }
  };
  const view = toCycloStickersAlbumView(state);
  return <CollectorAlbum snapshot={snapshot} storageOwnerId={state.directorId} initialTab={initialTab} runtime={{
    state: view, ready: !busy, ownerName: state.owner.displayName,
    boosterCount: state.boosterCount, tradeCount: state.incomingOffers.length + state.outgoingOffers.length,
    notice, onAction: send,
    boosters: <PersistentBoosters snapshot={snapshot} state={state} busy={busy} mutate={mutate} />,
    achievements: <PersistentAchievements snapshot={snapshot} state={state} busy={busy} onAction={send} />,
    trades: requestedCard => <PersistentTrades key={requestedCard ?? "desk"} snapshot={snapshot} state={state} busy={busy} mutate={mutate} initialTarget={requestedCard} />,
  }} />;
}

function PersistentBoosters({ snapshot, state, busy, mutate }: { snapshot: CollectorAlbumSnapshot; state: CycloStickersPersistentState; busy: boolean; mutate: Mutation }) {
  const closed = state.boosters.filter(pack => !pack.openedAt);
  const latest = state.openedPacks[0];
  return <section className={styles.boosterDesk} aria-label="Les sachets de cartes">
    <header className={styles.sectionHeading}><p>LES SACHETS · COLLECTION S{state.edition.collectionSeason}</p><h2>Deux vignettes à découvrir.</h2><span>Chaque sachet conserve son édition. Les doublons sont possibles.</span></header>
    <div className={styles.packShelf}>{closed.length ? closed.map((pack, index) => <div className={styles.packOffer} key={`${pack.inventorySource}:${pack.id}`}>
      <button type="button" className={styles.openPackButton} disabled={busy} aria-label={`Ouvrir le sachet ${index + 1}`} onClick={() => {
        const rpc = getCycloStickersOpenRpc(state.edition.id, pack.inventorySource, pack.id);
        void mutate(rpc.rpcName, rpc.args, "Sachet ouvert : deux vignettes ont rejoint ta collection.");
      }}><AlbumBoosterArtwork sourceSeason={snapshot.presentationSeason ?? snapshot.sourceSeason} gamesEdition={snapshot.gamesEdition} additionalRiders={snapshot.cards.filter(card=>!card.kind&&card.number>69).length} /><span>Ouvrir ce sachet ↗</span></button>
      <p>{pack.inventorySource === "login" ? "Connexion" : pack.inventorySource === "referral" ? "Parrainage" : "Événement"} · 2 vignettes</p>
    </div>) : <p>Aucun sachet fermé dans cette édition.</p>}</div>
    {latest ? <section className={styles.reveal} aria-label="Dernier sachet ouvert"><h3>Les deux vignettes de ton dernier sachet</h3><div className={styles.packShelf}>{latest.cards.map((number, index) => {
      const card = snapshot.cards.find(row => row.number === number);
      return card ? <CollectorCardFace key={index} card={card} season={snapshot.sourceSeason} /> : null;
    })}</div></section> : null}
    <details className={styles.odds}><summary>Les chances de cette édition</summary><dl>{Object.entries(state.edition.odds).map(([rarity, odds]) => <div key={rarity}><dt>{rarity === "bronze" ? "Bronze" : rarity === "silver" ? "Argent" : rarity === "gold" ? "Or" : "Vignettes spéciales"}</dt><dd>{odds} %</dd></div>)}</dl></details>
  </section>;
}

function PersistentAchievements({ snapshot, state, busy, onAction }: { snapshot: CollectorAlbumSnapshot; state: CycloStickersPersistentState; busy: boolean; onAction: (action: AlbumPilotAction) => void }) {
  const view = toCycloStickersAlbumView(state);
  return <section className={styles.achievementDesk}><header className={styles.sectionHeading}><p>LE LIVRE D’OR</p><h2>Les souvenirs de ta collection.</h2><span>Chaque récompense est attribuée une seule fois pour cette édition.</span></header>
    <div className={styles.achievementGrid}>{state.edition.achievements.map(config => {
      const definition = ALBUM_ACHIEVEMENTS.find(row => row.id === config.id);
      if (!definition) return null;
      const achievement = { ...definition, name: config.name, target: config.target ?? definition.target, cash: config.cash, xp: config.xp, reputation: config.reputation };
      const progress = getAlbumAchievementProgress(achievement, view, snapshot.cards);
      const claimed = state.claimedAchievements.includes(achievement.id);
      return <article className={styles.achievement} key={achievement.id}><h3>{achievement.name}</h3><p>{achievement.description}</p><progress aria-label={achievement.name} value={Math.min(progress.value, progress.target)} max={progress.target} /><p>{Math.min(progress.value, progress.target)} / {progress.target}</p>
        <div className={styles.rewardLine}><strong>{achievement.cash.toLocaleString("fr-FR")} €</strong><span>{achievement.xp} XP · {achievement.reputation} réputation</span></div>
        <button type="button" disabled={busy || claimed || progress.value < progress.target} onClick={() => onAction({ type: "claim-achievement", id: achievement.id })}>{claimed ? "Récompense reçue" : "Recevoir la récompense"}</button>
      </article>;
    })}</div>
  </section>;
}

function PersistentTrades({ snapshot, state, busy, mutate, initialTarget }: { snapshot: CollectorAlbumSnapshot; state: CycloStickersPersistentState; busy: boolean; mutate: Mutation; initialTarget: number | null }) {
  const [query, setQuery] = useState("");
  const [wanted, setWanted] = useState(initialTarget ?? 0);
  const [collectors, setCollectors] = useState<CycloStickersCollector[]>([]);
  const [recipient, setRecipient] = useState("");
  const [receive, setReceive] = useState(initialTarget ?? 0);
  const [give, setGive] = useState([0]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(createCycloStickersTradeRequestIds());
  const cardName = (number: number) => snapshot.cards.find(card => card.number === number)?.name ?? String(number);
  const available = state.owned.filter(row => row.quantity - Number(row.pasted) - row.reserved > 0);
  const selected = collectors.find(row => row.directorId === recipient);
  const valid = Boolean(selected?.availableCards.some(row => row.cardNumber === receive) && give.length && give.every(number => number > 0 && number !== receive && available.some(row => row.cardNumber === number && row.quantity - Number(row.pasted) - row.reserved >= give.filter(value => value === number).length)));
  const respond = (offer: CycloStickersTrade, response: "accept" | "decline" | "cancel") => void mutate("respond_current_cyclo_stickers_trade", { p_edition: state.edition.id, p_offer_id: offer.id, p_response: response }, response === "accept" ? "Échange accepté. Les cartes ont été transférées." : "Proposition close. Les cartes réservées sont libérées.");
  return <section className={styles.tradeWindow} aria-label="Échanges entre collectionneurs" data-album-trade-composer="" tabIndex={-1}>
    <header className={styles.sectionHeading}><p>LE COIN DES COLLECTIONNEURS</p><h2>Une rencontre pour la prochaine vignette.</h2><span>Les exemplaires collés et réservés restent protégés. Un transfert nécessite l’accord du destinataire.</span></header>
    <form onSubmit={async event => {
      event.preventDefault(); setSearching(true); setError("");
      try {
        const result = await createSupabaseBrowserClient().rpc("search_current_cyclo_stickers_collectors", { p_edition: state.edition.id, p_query: query, p_card_number: wanted || null, p_limit: 20 });
        if (result.error) throw new Error(result.error.message);
        setCollectors((result.data ?? []) as CycloStickersCollector[]); setRecipient("");
      } catch (failure) { setError(failure instanceof Error ? failure.message : "La recherche est indisponible."); }
      finally { setSearching(false); }
    }}><label>Nom du DS<input value={query} maxLength={80} onChange={event => setQuery(event.target.value)} /></label><label>Vignette recherchée<select value={wanted} onChange={event => setWanted(Number(event.target.value))}><option value={0}>Toutes les vignettes</option>{snapshot.cards.map(card => <option key={card.number} value={card.number}>N°{card.number} · {card.name}</option>)}</select></label><button type="submit" disabled={searching || busy}>Chercher un collectionneur</button></form>
    {error ? <p role="alert">{error}</p> : null}
    {collectors.length ? <div className={styles.searchFields}><label>Le collectionneur<select value={recipient} onChange={event => { setRecipient(event.target.value); setReceive(wanted); }}><option value="">Choisir un DS…</option>{collectors.map(row => <option key={row.directorId} value={row.directorId}>{row.displayName}</option>)}</select></label>
      <label>Sa vignette<select value={receive} disabled={!selected} onChange={event => setReceive(Number(event.target.value))}><option value={0}>Choisir une vignette…</option>{selected?.availableCards.map(row => <option key={row.cardNumber} value={row.cardNumber}>N°{row.cardNumber} · {cardName(row.cardNumber)}</option>)}</select></label>
      {give.map((number, index) => <label key={index}>Vignette proposée {index + 1}<select value={number} onChange={event => setGive(previous => previous.map((value, offset) => offset === index ? Number(event.target.value) : value))}><option value={0}>Choisir une vignette…</option>{available.map(row => <option key={row.cardNumber} value={row.cardNumber}>N°{row.cardNumber} · {cardName(row.cardNumber)}</option>)}</select></label>)}
      {give.length < 3 ? <button type="button" onClick={() => setGive(previous => [...previous, 0])}>Ajouter une vignette</button> : null}{give.length > 1 ? <button type="button" onClick={() => setGive(previous => previous.slice(0, -1))}>Retirer la dernière vignette</button> : null}
      <button type="button" disabled={busy || !valid} onClick={() => {
        const signature = JSON.stringify({ recipient, give, receive });
        const requestId = request.current.forOffer(signature);
        void mutate("propose_current_cyclo_stickers_trade", { p_edition: state.edition.id, p_request_id: requestId, p_recipient_id: recipient, p_give: give, p_receive: receive }, "Proposition envoyée. Tes exemplaires sont réservés.").then(confirmed => { if (confirmed) request.current.confirmed(requestId); });
      }}>Proposer et réserver ces vignettes</button>
    </div> : null}
    <h3>Propositions reçues · {state.incomingOffers.length}</h3>{state.incomingOffers.map(offer => <article key={offer.id}><p>{offer.fromName} te propose {offer.give.map(cardName).join(" + ")} contre {cardName(offer.receive)}.</p><button type="button" disabled={busy} onClick={() => respond(offer, "accept")}>Accepter cet échange</button><button type="button" disabled={busy} onClick={() => respond(offer, "decline")}>Refuser</button></article>)}
    <h3>Propositions envoyées · {state.outgoingOffers.length}</h3>{state.outgoingOffers.map(offer => <article key={offer.id}><p>{offer.toName} · {offer.give.map(cardName).join(" + ")} contre {cardName(offer.receive)}</p><button type="button" disabled={busy} onClick={() => respond(offer, "cancel")}>Annuler ma proposition</button></article>)}
    {state.history.length ? <><h3>Historique</h3>{state.history.map(offer => <p key={offer.id}>{offer.give.map(cardName).join(" + ")} ⇄ {cardName(offer.receive)} · {offer.status === "accepted" ? "Accepté" : offer.status === "declined" ? "Refusé" : offer.status === "expired" ? "Expiré" : "Annulé"}</p>)}</> : null}
  </section>;
}
