"use client";

import { useEffect, useRef, useState } from "react";
import { AlbumBoosterArtwork } from "./collector-album-artwork";
import { CollectorCardFace } from "./collector-card-face";
import { ALBUM_BOOSTER_ODDS, CARD_RARITY_LABELS, drawAlbumBooster, getAlbumPilotPacks, getCardRarity, getLooseAlbumCardCount, type AlbumPilotAction, type AlbumPilotState, type CollectorAlbumSnapshot } from "@/lib/game/collector-album";
import styles from "./collector-album-retro.module.css";
import discovery from "./collector-album-discovery.module.css";

type DiscoveryStatus = "new" | "pasted" | "duplicate";
type PackDiscovery = { id: string; statuses: DiscoveryStatus[]; revealedCount: number };

/** The first unseen copy is new; later copies in the same draw are duplicates. */
export function getAlbumPackDiscovery(cards: readonly number[], ownedBefore: readonly number[], pastedBefore: readonly number[]): DiscoveryStatus[] {
  const seen = new Set(ownedBefore);
  return cards.map(number => {
    const status = !seen.has(number) ? "new" : pastedBefore.includes(number) ? "pasted" : "duplicate";
    seen.add(number);
    return status;
  });
}

/** Old packs do not record their original inventory. Never infer newness from today's copies. */
export function getAlbumPackHistoryLabel(state: AlbumPilotState, number: number): string {
  if (state.pasted.includes(number)) return "Déjà dans l’album";
  if (getLooseAlbumCardCount(state, number) > 1) return "Doublon disponible";
  if (getLooseAlbumCardCount(state, number) > 0) return "À coller dans l’album";
  if (state.owned.includes(number)) return "Réservée pour un échange";
  return "Tirée dans ce sachet";
}

export function getAlbumPackPasteableCards(state: AlbumPilotState, cards: readonly number[]): number[] {
  return [...new Set(cards)].filter(number => !state.pasted.includes(number) && getLooseAlbumCardCount(state, number) > 0);
}

export function CollectorAlbumBoosters({ state, snapshot, ready, onAction, onViewAlbum, onPasteCards }: {
  state: AlbumPilotState;
  snapshot: CollectorAlbumSnapshot;
  ready: boolean;
  onAction: (action: AlbumPilotAction, text: string) => void;
  onViewAlbum: () => void;
  onPasteCards?: (numbers: readonly number[]) => void;
}) {
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [opening, setOpening] = useState<PackDiscovery | null>(null);
  const [error, setError] = useState("");
  const nextCardButton = useRef<HTMLButtonElement>(null);
  const finishedButton = useRef<HTMLButtonElement>(null);
  const closed = getAlbumPilotPacks(snapshot.collectionSeason).filter(pack => !state.openedPacks.some(open => open.id === pack.id));
  const revealed = state.openedPacks.find(pack => pack.id === selectedPack) ?? state.openedPacks.at(-1);
  const activeOpening = revealed && opening?.id === revealed.id ? opening : null;
  const revealedCount = activeOpening?.revealedCount ?? revealed?.cards.length ?? 0;
  const allRevealed = Boolean(revealed && revealedCount === revealed.cards.length);
  const pasteable = revealed && allRevealed ? getAlbumPackPasteableCards(state, revealed.cards) : [];
  const activeOpeningId = activeOpening?.id;

  useEffect(() => {
    if (!activeOpeningId) return;
    const target = allRevealed ? finishedButton.current : nextCardButton.current;
    // Keep keyboard focus when a back disappears, without scrolling past the revealed rider.
    target?.focus({ preventScroll: revealedCount > 0 });
  }, [activeOpeningId, allRevealed, revealedCount]);

  const openPack = (id: string) => {
    if (!ready || !closed.some(pack => pack.id === id)) return;
    try {
      const entropy = new Uint32Array(4);
      window.crypto.getRandomValues(entropy);
      const cards = drawAlbumBooster(snapshot.cards, Array.from(entropy, number => number / 4294967296));
      const statuses = getAlbumPackDiscovery(cards, state.owned, state.pasted);
      onAction({ type: "open-pack", id, season: snapshot.collectionSeason, cards }, "Sachet de démonstration ouvert : deux cartes ont rejoint ta collection.");
      setOpening({ id, statuses, revealedCount: 0 });
      setSelectedPack(id);
      setError("");
    } catch {
      setError("Impossible d’ouvrir le sachet dans ce navigateur. Il n’a pas été consommé.");
    }
  };

  const revealNext = (index: number) => {
    if (!revealed || !activeOpening || index !== activeOpening.revealedCount) return;
    const packId = revealed.id;
    const count = revealed.cards.length;
    setOpening(previous => {
      if (!previous || previous.id !== packId || previous.revealedCount !== index) return previous;
      return { ...previous, revealedCount: Math.min(previous.revealedCount + 1, count) };
    });
  };

  return <section className={styles.boosterDesk} aria-label="Les sachets de cartes">
    <header className={styles.sectionHeading}>
      <p>LE KIOSQUE DU COLLECTIONNEUR · ÉDITION S{snapshot.sourceSeason}</p>
      <h2>Le plaisir du petit sachet.</h2>
      <span>Deux champions de la saison {snapshot.sourceSeason}, avec leurs notes figées en fin de saison. À collectionner dans l’édition S{snapshot.sourceSeason}.</span>
    </header>
    <div className={styles.packShelf}>
      {closed.length ? closed.map((pack, index) => <div className={styles.packOffer} key={pack.id}>
        <button type="button" disabled={!ready} className={styles.openPackButton} onClick={() => openPack(pack.id)} aria-label={`Ouvrir le sachet de test ${index + 1}, édition saison ${snapshot.sourceSeason}`}>
          <AlbumBoosterArtwork sourceSeason={snapshot.sourceSeason} />
          <span>Déchirer le sachet <span aria-hidden="true">↗</span></span>
        </button>
        <p>Sachet d’essai · 2 cartes</p>
      </div>) : <p className={styles.allOpened}>Tes deux sachets d’essai sont ouverts. Tes cartes restent dans cet album ; tu peux réinitialiser la démonstration en bas de page.</p>}
    </div>
    {error ? <p role="alert" className={styles.testBanner}>{error}</p> : null}
    {revealed ? <section className={`${styles.reveal} ${discovery.desk}`} aria-label="Cartes du sachet ouvert" data-album-pack-mode={activeOpening ? "discovery" : "history"}>
      <header>
        <p>{activeOpening ? "LE SACHET EST OUVERT" : "LES SOUVENIRS DU KIOSQUE"}</p>
        <h3>{activeOpening && !allRevealed ? "Qui se cache dans ce sachet ?" : "Voici tes deux vignettes."}</h3>
        <span>{activeOpening ? "Retourne les cartes à ton rythme, puis trouve-leur une place dans l’album." : "Un sachet déjà ouvert. Les indications ci-dessous décrivent ta collection actuelle, pas le jour du tirage."}</span>
      </header>
      {activeOpening ? <div className={discovery.discoveryBar}>
        <p className={discovery.progress} role="status" aria-live="polite" aria-atomic="true">{revealedCount} / {revealed.cards.length} vignettes dévoilées</p>
        {!allRevealed ? <button type="button" className={discovery.skip} onClick={() => setOpening(previous => previous && previous.id === revealed.id ? { ...previous, revealedCount: revealed.cards.length } : previous)}>Tout révéler</button> : <span className={discovery.finished}>Le sachet a livré ses secrets.</span>}
      </div> : null}
      <div className={discovery.cards}>
        {revealed.cards.map((number, index) => {
          const card = snapshot.cards.find(candidate => candidate.number === number);
          const visible = index < revealedCount;
          const status = activeOpening?.statuses[index];
          const label = activeOpening ? status === "new" ? "Nouvelle vignette" : status === "pasted" ? "Déjà dans l’album" : "Doublon" : getAlbumPackHistoryLabel(state, number);
          return <div className={discovery.cardSlot} key={`${revealed.id}-${index}`} data-album-discovery-card={index + 1}>
            {visible && card ? <div className={discovery.face}>
              <CollectorCardFace card={card} season={snapshot.sourceSeason} />
              <p className={`${discovery.cardStatus} ${status === "new" ? discovery.newCard : ""}`} data-album-discovery-status={status ?? "history"}><span aria-hidden="true">{status === "new" ? "+" : "◇"}</span>{label}</p>
            </div> : <button ref={index === revealedCount ? nextCardButton : undefined} type="button" className={discovery.cardBack} disabled={index !== revealedCount} onClick={() => revealNext(index)} aria-label={`Révéler la vignette ${index + 1} sur ${revealed.cards.length}`}>
              <span className={discovery.publisher}>CYCLO STRATÈGE · COLLECTION</span>
              <span className={discovery.backTitle}>Les champions<br/><em>du peloton</em></span>
              <svg viewBox="0 0 170 100" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" strokeWidth="2"><circle cx="40" cy="61" r="27"/><circle cx="130" cy="61" r="27"/><path d="m40 61 27-43 22 43H40l44-32h28l18 32M60 18h16m26-10h9l1 21M74 8l12 11-4 13M64 75l28-29-6-27"/></g><path d="m84 6 5-4 8 6-4 6-9-2Z" fill="currentColor"/></svg>
              <span className={discovery.backSeason}>SAISON {snapshot.sourceSeason}</span>
              <span className={discovery.turnPrompt}>{index === revealedCount ? "Retourner la vignette ↻" : "La suivante attend son tour"}</span>
            </button>}
          </div>;
        })}
      </div>
      {state.openedPacks.length > 1 ? <div className={styles.openedHistory}>{state.openedPacks.map((pack, index) => <button type="button" key={pack.id} aria-pressed={revealed.id === pack.id} onClick={() => setSelectedPack(pack.id)}>Revoir le sachet {index + 1}</button>)}</div> : null}
      {allRevealed ? <div className={discovery.actions}>
        {onPasteCards && pasteable.length ? <button ref={finishedButton} className={discovery.paste} type="button" disabled={!ready} onClick={() => onPasteCards(pasteable)}>Coller ces vignettes <span aria-hidden="true">↗</span></button> : null}
        <button ref={onPasteCards && pasteable.length ? undefined : finishedButton} className={discovery.albumLink} type="button" onClick={onViewAlbum}>Retrouver mon album →</button>
      </div> : null}
    </section> : null}
    <details className={styles.odds}>
      <summary>Les chances, sans mystère</summary>
      <p>Deux tirages indépendants par sachet. Les doublons sont possibles, y compris dans un même sachet. Chaque carte d’une même finition a la même chance.</p>
      <dl>{(["bronze", "silver", "gold"] as const).map(rarity => {
        const count = snapshot.cards.filter(card => getCardRarity(card.rank) === rarity).length;
        return <div key={rarity}><dt>{CARD_RARITY_LABELS[rarity]}</dt><dd>{ALBUM_BOOSTER_ODDS[rarity]} % <small>soit {(ALBUM_BOOSTER_ODDS[rarity] / count).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} % par carte de cette finition</small></dd></div>;
      })}</dl>
    </details>
    <p className={styles.testBanner}>Deux sachets de démonstration, sans achat. Aucun tirage quotidien ni distribution dans la Gazette n’est activé. Les futures distributions resteront réservées à la Gazette.</p>
  </section>;
}
