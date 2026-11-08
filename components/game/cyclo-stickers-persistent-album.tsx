"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ALBUM_ACHIEVEMENTS, getAlbumAchievementProgress, type AlbumPilotAction, type CollectorAlbumSnapshot } from "@/lib/game/collector-album";
import { notifyCycloStickersBoostersChanged } from "@/lib/game/cyclo-stickers-booster-sync";
import { getCycloStickersLeaderboard, type StickerAlbumLeaderboard } from "@/lib/game/cyclo-stickers-leaderboard";
import { createCycloStickersTradeRequestIds, getCycloStickersActionRpc, getCycloStickersOpenRpc, toCycloStickersAlbumView } from "@/lib/game/cyclo-stickers-persistent-view";
import type { CycloStickersCollector, CycloStickersPersistentState, CycloStickersTrade } from "@/lib/game/cyclo-stickers-persistence";
import type { WeeklyLoginBoosterProgress } from "@/lib/game/weekly-login-boosters";
import { CollectorAlbum, type CollectorAlbumTab } from "./collector-album";
import { CollectorCardFace } from "./collector-card-face";
import { AlbumBoosterArtwork } from "./collector-album-artwork";
import { WeeklyLoginBoostersPanel } from "./weekly-login-boosters-panel";
import styles from "./collector-album-retro.module.css";
import collection from "./cyclo-stickers-collection.module.css";

type Mutation = (name: string, args: Record<string, unknown>, message: string) => Promise<CycloStickersPersistentState | null>;
const BOOSTER_SOURCE_LABELS = { login: "Connexion", referral: "Parrainage", edition: "Événement" };
/** Only RPC responses can replace the collection. Browser demonstration saves are never read. */
export function CycloStickersPersistentAlbum({
  snapshot,
  initialState,
  initialLeaderboard = null,
  initialTab = "album",
  loginBoosterProgress = null,
}: {
  snapshot: CollectorAlbumSnapshot;
  initialState: CycloStickersPersistentState;
  initialLeaderboard?: StickerAlbumLeaderboard | null;
  initialTab?: CollectorAlbumTab;
  loginBoosterProgress?: WeeklyLoginBoosterProgress | null;
}) {
  const [state, setState] = useState(initialState);
  const [leaderboard, setLeaderboard] = useState(initialLeaderboard);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const locked = useRef(false);
  const refreshingLeaderboard = useRef(false);

  useEffect(() => {
    if (loginBoosterProgress?.boosterAwardedToday) {
      notifyCycloStickersBoostersChanged(initialState.boosterCount > 0);
    }
  }, [initialState.boosterCount, loginBoosterProgress?.boosterAwardedToday]);

  const refreshLeaderboard = async () => {
    if (refreshingLeaderboard.current) return;
    refreshingLeaderboard.current = true;
    try {
      const next = await getCycloStickersLeaderboard(createSupabaseBrowserClient(), snapshot.edition);
      if (next) setLeaderboard(next);
    } finally {
      refreshingLeaderboard.current = false;
    }
  };
  const mutate: Mutation = async (name, args, message) => {
    if (locked.current) return null;
    locked.current = true; setBusy(true); setNotice("");
    try {
      const result = await createSupabaseBrowserClient().rpc(name, args);
      if (result.error) throw new Error(result.error.message);
      const next = result.data?.state as CycloStickersPersistentState | undefined;
      if (!next || next.edition.id !== state.edition.id || next.directorId !== state.directorId) throw new Error("La réponse du serveur ne correspond pas à ta collection.");
      setState(next); setNotice(message); return next;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "L’action n’a pas pu être confirmée. Recharge la page pour retrouver ta collection.");
      return null;
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
    leaderboard, onViewLeaderboard: () => void refreshLeaderboard(),
    boosters: <PersistentBoosters snapshot={snapshot} state={state} busy={busy} mutate={mutate} loginBoosterProgress={loginBoosterProgress} onPaste={card => send({ type: "paste", card })} />,
    duplicates: <PersistentDuplicates snapshot={snapshot} owned={state.owned} />,
    achievements: <PersistentAchievements snapshot={snapshot} state={state} busy={busy} onAction={send} />,
    trades: requestedCard => <PersistentTrades key={requestedCard ?? "desk"} snapshot={snapshot} state={state} busy={busy} mutate={mutate} initialTarget={requestedCard} />,
  }} />;
}

function PersistentBoosters({ snapshot, state, busy, mutate, loginBoosterProgress, onPaste }: {
  snapshot: CollectorAlbumSnapshot;
  state: CycloStickersPersistentState;
  busy: boolean;
  mutate: Mutation;
  loginBoosterProgress: WeeklyLoginBoosterProgress | null;
  onPaste: (number: number) => void;
}) {
  const [openedKey, setOpenedKey] = useState<string | null>(null);
  const reveal = useRef<HTMLElement>(null);
  const closed = state.boosters
    .filter(pack => !pack.openedAt)
    .sort((left, right) => Number(right.acquisitionSource === "gazette") - Number(left.acquisitionSource === "gazette"));
  const latest = state.openedPacks.find(pack => `${pack.inventorySource}:${pack.id}` === openedKey) ?? state.openedPacks[0];

  useEffect(() => {
    if (!openedKey || !reveal.current) return;
    reveal.current.focus({ preventScroll: true });
    reveal.current.scrollIntoView({ block: "start", behavior: "auto" });
  }, [openedKey]);

  const openPack = async (pack: CycloStickersPersistentState["boosters"][number]) => {
    const rpc = getCycloStickersOpenRpc(state.edition.id, pack.inventorySource, pack.id);
    const next = await mutate(rpc.rpcName, rpc.args, "Sachet ouvert : deux vignettes ont rejoint ta collection.");
    if (next) {
      setOpenedKey(`${pack.inventorySource}:${pack.id}`);
      notifyCycloStickersBoostersChanged(next.boosterCount > 0);
    }
  };

  return <section className={styles.boosterDesk} aria-label="Les sachets de cartes">
    <header className={styles.sectionHeading}><p>LES SACHETS · COLLECTION S{state.edition.collectionSeason}</p><h2>Deux vignettes à découvrir.</h2><span>Chaque sachet conserve son édition. Les doublons sont possibles.</span></header>
    {loginBoosterProgress ? <WeeklyLoginBoostersPanel progress={loginBoosterProgress} /> : null}
    <div className={styles.packShelf}>{closed.length ? closed.map((pack, index) => <div className={styles.packOffer} key={`${pack.inventorySource}:${pack.id}`}>
      <button type="button" className={styles.openPackButton} disabled={busy} aria-label={`Ouvrir le sachet ${index + 1}`} onClick={() => void openPack(pack)}><AlbumBoosterArtwork sourceSeason={snapshot.presentationSeason ?? snapshot.sourceSeason} gamesEdition={snapshot.gamesEdition} additionalRiders={snapshot.cards.filter(card=>!card.kind&&card.number>69).length} /><span>Ouvrir ce sachet ↗</span></button>
      <p>{pack.acquisitionSource === "gazette" ? "Cadeau Cyclogazette" : BOOSTER_SOURCE_LABELS[pack.inventorySource]} · 2 vignettes</p>
    </div>) : <p>Aucun sachet fermé dans cette édition.</p>}</div>
    {latest && (
      <section ref={reveal} tabIndex={-1} className={`${styles.reveal} ${collection.reveal}`} aria-label="Dernier sachet ouvert">
        <h3>Les deux vignettes de ton dernier sachet</h3>
        <div className={collection.revealedCards}>
          {latest.cards.map((number, index) => {
            const card = snapshot.cards.find(row => row.number === number);
            if (!card) return null;
            const owned = state.owned.find(row => row.cardNumber === number);
            const secondCopy = latest.cards.indexOf(number) < index;
            const canPaste = owned && !owned.pasted && owned.quantity > owned.reserved && !secondCopy;
            return (
              <div className={collection.revealedCard} key={`${number}-${index}`}>
                <CollectorCardFace card={card} season={snapshot.sourceSeason} />
                {canPaste ? (
                  <button
                    type="button"
                    className={collection.paste}
                    aria-label={`Coller ${card.name} dans mon album`}
                    disabled={busy}
                    onClick={() => onPaste(number)}
                  >
                    Coller dans mon album
                  </button>
                ) : (
                  <p className={collection.cardStatus}>
                    {secondCopy
                      ? "Double dans ce sachet"
                      : owned?.pasted
                        ? "Collée dans l’album"
                        : "Vignette indisponible pour le collage"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    )}
    <details className={styles.odds}><summary>Les chances de cette édition</summary><dl>{Object.entries(state.edition.odds).map(([rarity, odds]) => <div key={rarity}><dt>{rarity === "bronze" ? "Bronze" : rarity === "silver" ? "Argent" : rarity === "gold" ? "Or" : "Vignettes spéciales"}</dt><dd>{odds} %</dd></div>)}</dl></details>
  </section>;
}

function PersistentDuplicates({ snapshot, owned }: {
  snapshot: CollectorAlbumSnapshot;
  owned: CycloStickersPersistentState["owned"];
}) {
  const byNumber = new Map(owned.map(row => [row.cardNumber, row]));
  const doubles = snapshot.cards.flatMap(card => {
    const row = byNumber.get(card.number);
    if (!row || row.quantity < 2) return [];
    const count = row.quantity - 1;
    const reserved = Math.min(row.reserved, count);
    return [{ card, available: count - reserved, reserved }];
  });

  return (
    <section className={styles.achievementDesk} aria-label="Inventaire des doubles">
      <header className={styles.sectionHeading}>
        <h2>Inventaire des doubles</h2>
        <span>Retrouve les exemplaires au-delà du premier et ceux déjà réservés dans tes échanges.</span>
      </header>
      {doubles.length ? (
        <ul className={collection.doubles}>
          {doubles.map(({ card, available, reserved }) => (
            <li className={collection.doubleRow} key={card.number}>
              <span className={collection.stickerNumber}>N° {String(card.number).padStart(2, "0")}</span>
              <strong className={collection.stickerName}>{card.name}</strong>
              <span className={collection.quantities}>
                <span><b>{available}</b> en stock</span>
                {reserved > 0 && <span><b>{reserved}</b> en réservation</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={collection.empty}>Tu n’as pas encore de vignette en double.</p>
      )}
    </section>
  );
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
