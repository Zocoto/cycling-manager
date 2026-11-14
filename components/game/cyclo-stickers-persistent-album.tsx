"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ALBUM_ACHIEVEMENTS, getAlbumAchievementProgress, type AlbumPilotAction, type CollectorAlbumSnapshot } from "@/lib/game/collector-album";
import { notifyCycloStickersBoostersChanged, notifyCycloStickersTradesChanged } from "@/lib/game/cyclo-stickers-booster-sync";
import { getCycloStickersLeaderboard, type StickerAlbumLeaderboard } from "@/lib/game/cyclo-stickers-leaderboard";
import { getCycloStickersActionRpc, getCycloStickersOpenRpc, toCycloStickersAlbumView } from "@/lib/game/cyclo-stickers-persistent-view";
import type { CycloStickersPersistentState } from "@/lib/game/cyclo-stickers-persistence";
import type { WeeklyLoginBoosterProgress } from "@/lib/game/weekly-login-boosters";
import { CollectorAlbum, type CollectorAlbumTab } from "./collector-album";
import { CollectorCardFace } from "./collector-card-face";
import { AlbumBoosterArtwork } from "./collector-album-artwork";
import { WeeklyLoginBoostersPanel } from "./weekly-login-boosters-panel";
import { CycloStickersTrades } from "./cyclo-stickers-trades";
import styles from "./collector-album-retro.module.css";
import collection from "./cyclo-stickers-collection.module.css";

type Mutation = (
  name: string,
  args: Record<string, unknown>,
  message: string | ((next: CycloStickersPersistentState) => string),
  onError?: (message: string) => void,
) => Promise<CycloStickersPersistentState | null>;
const BOOSTER_SOURCE_LABELS = { login: "Connexion", referral: "Parrainage", edition: "Événement" };
const BOOSTER_ACQUISITION_LABELS = new Map([
  ["gazette", "Cadeau Cyclogazette"],
  ["global_chat_quiz", "Quizz’o Stratège"],
]);
/** Only RPC responses can replace the collection. Browser demonstration saves are never read. */
export function CycloStickersPersistentAlbum({
  snapshot,
  initialState,
  initialLeaderboard = null,
  initialTab = "album",
  initialTradeView = "compose",
  loginBoosterProgress = null,
}: {
  snapshot: CollectorAlbumSnapshot;
  initialState: CycloStickersPersistentState;
  initialLeaderboard?: StickerAlbumLeaderboard | null;
  initialTab?: CollectorAlbumTab;
  initialTradeView?: "compose" | "inbox";
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
  const mutate: Mutation = async (name, args, message, onError) => {
    if (locked.current) return null;
    locked.current = true; setBusy(true); setNotice("");
    try {
      const result = await createSupabaseBrowserClient().rpc(name, args);
      if (result.error) throw new Error(result.error.message);
      const next = result.data?.state as CycloStickersPersistentState | undefined;
      if (!next || next.edition.id !== state.edition.id || next.directorId !== state.directorId) throw new Error("La réponse du serveur ne correspond pas à ta collection.");
      setState(next);
      setNotice(typeof message === "function" ? message(next) : message);
      if (name === "respond_current_cyclo_stickers_trade" && args.p_response !== "cancel") {
        notifyCycloStickersTradesChanged(next.incomingOffers.length);
      }
      return next;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "L’action n’a pas pu être confirmée. Recharge la page pour retrouver ta collection.";
      if (onError) onError(reason);
      else setNotice(reason);
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
    duplicates: onOffer => <PersistentDuplicates snapshot={snapshot} owned={state.owned} busy={busy} onOffer={onOffer} />,
    achievements: <PersistentAchievements snapshot={snapshot} state={state} busy={busy} onAction={send} />,
    trades: (requestedCard, wanted, offeredCard, onViewBoosters) => <CycloStickersTrades
      key={`${requestedCard ?? ""}:${offeredCard ?? ""}`}
      snapshot={snapshot}
      state={state}
      busy={busy}
      mutate={mutate}
      initialTarget={requestedCard}
      initialOffer={offeredCard}
      initialView={requestedCard || offeredCard ? "compose" : initialTradeView}
      wanted={wanted}
      onViewBoosters={onViewBoosters}
    />,
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
      <p>{BOOSTER_ACQUISITION_LABELS.get(pack.acquisitionSource ?? "") ?? BOOSTER_SOURCE_LABELS[pack.inventorySource]} · 2 vignettes</p>
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

function PersistentDuplicates({ snapshot, owned, busy, onOffer }: {
  snapshot: CollectorAlbumSnapshot;
  owned: CycloStickersPersistentState["owned"];
  busy: boolean;
  onOffer: (number: number) => void;
}) {
  const { locale } = useLocale();
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
        <span>{locale === "en" ? "Choose a spare to see matching trades." : "Choisis un double pour voir les échanges possibles."}</span>
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
              <button
                type="button"
                className={collection.tradeDuplicate}
                disabled={busy || available === 0}
                onClick={() => onOffer(card.number)}
              >
                {locale === "en" ? "Trade this spare" : "Échanger ce double"}
                <span aria-hidden="true">→</span>
              </button>
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
