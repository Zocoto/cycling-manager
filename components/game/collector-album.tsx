"use client";

import Link from "@/components/ui/app-link";
import { useEffect, useReducer, useState } from "react";
import { CollectorCardFace } from "./collector-card-face";
import { VintageCyclingArtwork } from "./collector-album-artwork";
import { CollectorAlbumBoosters } from "./collector-album-boosters";
import { CollectorAlbumAchievements } from "./collector-album-achievements";
import { CollectorAlbumTradeDesk } from "./collector-album-trades";
import {
  ALBUM_PROFILES, CARD_RARITY_LABELS, albumPilotStorageKey, createAlbumPilotState,
  getCardRarity, getLooseAlbumCardCount, getAlbumPilotPacks, readAlbumPilotState, updateAlbumPilot,
  type AlbumPilotAction, type AlbumPilotState, type AlbumProfile,
  type CollectorAlbumSnapshot, type CollectorCard,
} from "@/lib/game/collector-album";
import styles from "./collector-album.module.css";
import retro from "./collector-album-retro.module.css";

type Store = { ready: boolean; state: AlbumPilotState; cards: CollectorCard[] };
type StoreAction = AlbumPilotAction | { type: "restore"; state: AlbumPilotState };
function reducer(store: Store, action: StoreAction): Store {
  if (action.type === "restore") return {...store, ready: true, state: action.state};
  if (!store.ready) return store;
  return {...store, state: updateAlbumPilot(store.state, action, store.cards)};
}

export function CollectorAlbum({ snapshot, storageOwnerId, initialTab = "album" }: {snapshot: CollectorAlbumSnapshot; storageOwnerId: string; initialTab?: "album" | "trades" | "boosters" | "achievements"}) {
  const [store, dispatch] = useReducer(reducer, {ready: false, state: createAlbumPilotState(snapshot.collectionSeason), cards: snapshot.cards});
  const [tab, setTab] = useState(initialTab);
  const [profile, setProfile] = useState<AlbumProfile>("tours");
  const [page, setPage] = useState(0);
  const [walletPage, setWalletPage] = useState(0);
  const [notice, setNotice] = useState("");
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const state = store.state;
  const key = albumPilotStorageKey(storageOwnerId, snapshot.edition);
  useEffect(() => {
    let cancelled = false;
    // Hydrate only after the server-matching first render; no browser access in SSR.
    queueMicrotask(() => {
      if (cancelled) return;
      let raw: string | null = null;
      try { raw = window.localStorage.getItem(key); } catch { setStorageUnavailable(true); }
      dispatch({type: "restore", state: readAlbumPilotState(raw, snapshot.collectionSeason)});
    });
    const sync = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) return;
      if (event.key === key || event.key === null) dispatch({type:"restore",state:readAlbumPilotState(event.newValue,snapshot.collectionSeason)});
    };
    window.addEventListener("storage",sync);
    return () => { cancelled = true; window.removeEventListener("storage",sync); };
  }, [key, snapshot.collectionSeason]);
  useEffect(() => {
    if (!store.ready) return;
    try { window.localStorage.setItem(key, JSON.stringify(store.state)); } catch { queueMicrotask(() => setStorageUnavailable(true)); }
  }, [key, store]);
  const cardFor = (number: number) => snapshot.cards.find(card => card.number === number)!;
  const selectedProfile = ALBUM_PROFILES.find(entry => entry.id === profile)!;
  const profileCards = snapshot.cards.filter(card => card.profileKey === profile);
  const pageCount = Math.max(1, Math.ceil(profileCards.length / 4));
  const visibleCards = profileCards.slice(page * 4, page * 4 + 4);
  const available = [...new Set(state.owned)].filter(id => getLooseAlbumCardCount(state,id) > 0 || state.pending?.give.includes(id));
  const walletPageCount = Math.max(1,Math.ceil(available.length/2));
  const visibleWalletPage = Math.min(walletPage,walletPageCount-1);
  const closedPackCount = getAlbumPilotPacks(snapshot.collectionSeason).length - state.openedPacks.length;
  const send = (action: AlbumPilotAction, text: string) => { dispatch(action); setNotice(text); };
  const switchProfile = (next: AlbumProfile) => {setProfile(next); setPage(0);};

  return <div className={`${styles.root} ${retro.albumDesk}`}>
    <div className={styles.utility}><Link href="/jeu/gazette">← La Cyclogazette</Link><span><span className={styles.liveDot} /> Aperçu privé · Abbaye du Lion</span></div>
    <header className={retro.cover}>
      <div className={retro.coverMasthead}><span>LA CYCLOGAZETTE · ÉDITIONS DU VÉLO</span><span>50 COUREURS · COLLECTION À COMPLÉTER</span></div>
      <div className={retro.coverCopy}><h1><span>L’Album du</span><em>peloton</em></h1><p className={retro.coverIntro}>Les champions passent.<br />Les souvenirs restent.</p><p className={retro.coverDetails}>Les cinquante figures du classement UCI de la saison {snapshot.sourceSeason}. Leurs visages, leurs maillots et toute la passion du vélo, vignette après vignette.</p></div>
      <div className={retro.coverPicture}><VintageCyclingArtwork className={retro.coverIllustration} /><div className={retro.seasonStamp}><span>ÉDITION</span><strong>S{snapshot.collectionSeason}</strong></div><span className={retro.pictureCaption}>Échappées, cols et belles histoires — l’album des passionnés.</span></div>
      <div className={retro.coverFooter}><span>UNE SAISON. UN ALBUM. CINQUANTE SOUVENIRS.</span><span>CYCLO STRATÈGE · NOTES NATIVES · MAILLOTS OFFICIELS</span></div>
    </header>
    <div className={retro.seasonShelf}><strong>Édition S{snapshot.collectionSeason} · Les champions S{snapshot.sourceSeason}</strong><span>Notes, maillots et résultats figés en fin de saison {snapshot.sourceSeason}. Une collection indépendante par édition.</span></div>
    <div className={styles.pilotNote}><span aria-hidden="true">✦</span><p><strong>Ton exemplaire de démonstration.</strong> Deux cartes et deux sachets d’essai. Progression et échanges restent dans ce navigateur. Les récompenses sont simulées, sans effet sur ton équipe.</p></div>
    {storageUnavailable ? <p role="status" className={styles.warning}>Le stockage du navigateur est indisponible : cet essai sera réinitialisé à la fermeture de la page.</p> : null}
    <div className={styles.toolbar}>
      <div className={styles.tabButtons} aria-label="Rubriques de la collection"><button type="button" aria-pressed={tab === "album"} onClick={()=>setTab("album")}>L’album</button><button type="button" aria-pressed={tab === "boosters"} onClick={()=>setTab("boosters")}>Les sachets <span>{closedPackCount}</span></button><button type="button" aria-pressed={tab === "trades"} onClick={()=>setTab("trades")}>Échanges <span>Démo</span>{state.pending ? " · 1" : ""}</button><button type="button" aria-pressed={tab === "achievements"} onClick={()=>setTab("achievements")}>Vitrine & succès</button></div>
      <div className={styles.progress}><strong>{state.pasted.length}<small> / 50</small></strong><span>cartes collées</span><div aria-hidden="true"><i style={{width:`${state.pasted.length * 2}%`}} /></div></div>
    </div>
    <p className={styles.notice} role="status" aria-live="polite">{notice || (store.ready ? "Ton album attend ses premières histoires." : "Ouverture de ton album…")}</p>

    {tab === "album" ? <>
      <nav className={styles.profiles} aria-label="Profils de coureurs">{ALBUM_PROFILES.map(entry => <button type="button" key={entry.id} aria-pressed={profile === entry.id} onClick={()=>switchProfile(entry.id)}><span aria-hidden="true">{entry.symbol}</span>{entry.label}<small>{snapshot.cards.filter(c=>c.profileKey === entry.id && state.pasted.includes(c.number)).length}/{snapshot.cards.filter(c=>c.profileKey === entry.id).length}</small></button>)}</nav>
      <div className={styles.layout}>
        <section className={`${styles.book} ${retro.albumPage}`} aria-label={`Page ${selectedProfile.label}`}>
          <div className={retro.chapterBanner}><div><span>LA CYCLOGAZETTE · ÉDITIONS DU VÉLO</span><strong>Le grand peloton</strong><p>LES VISAGES DE LA SAISON {snapshot.sourceSeason}</p></div><VintageCyclingArtwork className={retro.chapterScene}/></div>
          <header className={styles.bookHeading}><div><p className={styles.eyebrow}>CHAPITRE {String(ALBUM_PROFILES.indexOf(selectedProfile)+1).padStart(2,"0")} / {selectedProfile.label}</p><h2>{selectedProfile.subtitle}</h2></div><span aria-hidden="true">{selectedProfile.symbol}</span></header>
          <div className={styles.slots}>{visibleCards.map(card => {
            const pasted = state.pasted.includes(card.number);
            const owned = state.owned.includes(card.number);
            const reserved = getLooseAlbumCardCount(state,card.number) < 1 && state.pending?.give.includes(card.number);
            return <div key={card.id} className={styles.slotWrap}>
              {pasted ? <><CollectorCardFace card={card} season={snapshot.sourceSeason} /><button type="button" className={styles.textButton} onClick={()=>send({type:"unpaste",card:card.number},`${card.name} rejoint les cartes à coller.`)}>Décoller pour le test</button></> : <div className={`${styles.emptySlot} ${retro.stickerSpace} ${owned ? styles.readySlot : ""}`}>
                <span className={styles.slotNumber}>{String(card.number).padStart(2,"0")}</span><span className={styles.slotSymbol} aria-hidden="true">{selectedProfile.symbol}</span><h3>{card.name}</h3><p>{card.country} · {CARD_RARITY_LABELS[getCardRarity(card.rank)]}</p>
                {owned ? <button type="button" className={styles.primaryButton} disabled={!store.ready || reserved} onClick={()=>send({type:"paste",card:card.number},`${card.name} est collé dans ton album.`)}>{reserved ? "Réservée à l’échange" : "Coller cette carte"}</button> : <span className={styles.toFind}>À collectionner</span>}
              </div>}
            </div>;
          })}</div>
          <footer className={styles.bookFooter}><span>{profileCards.length} coureurs dans ce chapitre</span><div><button type="button" aria-label="Page précédente" disabled={page === 0} onClick={()=>setPage(p=>p-1)}>←</button><span>{page+1} / {pageCount}</span><button type="button" aria-label="Page suivante" disabled={page >= pageCount - 1} onClick={()=>setPage(p=>p+1)}>→</button></div></footer>
        </section>
        <aside className={`${styles.wallet} ${retro.collectorTable}`}><div className={styles.walletHeading}><p className={styles.eyebrow}>SUR LA TABLE</p><h2>Les cartes à coller <span>{available.length}</span></h2><p>Choisis leur page, puis colle tes cartes.</p></div>
          {available.length ? available.slice(visibleWalletPage*2,visibleWalletPage*2+2).map(id => <div className={styles.walletCard} key={id}><CollectorCardFace card={cardFor(id)} season={snapshot.sourceSeason} /><p className={retro.copyCount}>{state.owned.filter(n=>n===id).length} exemplaire(s) · {getLooseAlbumCardCount(state,id)} disponible(s)</p><button type="button" className={styles.primaryButton} disabled={!store.ready || state.pasted.includes(id) || getLooseAlbumCardCount(state,id)<1} onClick={()=>{const c=cardFor(id);switchProfile(c.profileKey);setPage(Math.floor(snapshot.cards.filter(x=>x.profileKey === c.profileKey).findIndex(x=>x.number===id)/4));send({type:"paste",card:id},`${c.name} est collé dans ton album.`);}}>{state.pasted.includes(id) ? "Déjà collée · doublon pour échange" : getLooseAlbumCardCount(state,id)<1 ? "Carte réservée à l’échange" : "Coller dans l’album ↗"}</button></div>) : <p className={styles.emptyWallet}>Toutes tes cartes sont dans l’album. Feuillette les chapitres ou ouvre un sachet pour continuer.</p>}
          {walletPageCount>1 ? <div className={styles.bookFooter}><button type="button" aria-label="Cartes à coller précédentes" disabled={visibleWalletPage===0} onClick={()=>setWalletPage(visibleWalletPage-1)}>←</button><span>{visibleWalletPage+1} / {walletPageCount}</span><button type="button" aria-label="Cartes à coller suivantes" disabled={visibleWalletPage===walletPageCount-1} onClick={()=>setWalletPage(visibleWalletPage+1)}>→</button></div> : null}
          <div className={styles.gazetteNote}><span aria-hidden="true">✉</span><h3>Un rendez-vous rare</h3><p>À terme, certaines éditions de la Gazette pourront offrir une carte. Aucun tirage n’est encore activé. Pas d’achat, ni d’autre source prévue pour le moment.</p></div>
        </aside>
      </div>
    </> : tab === "boosters" ? <CollectorAlbumBoosters state={state} ready={store.ready} snapshot={snapshot} onAction={send} onViewAlbum={()=>setTab("album")} /> : tab === "achievements" ? <CollectorAlbumAchievements state={state} ready={store.ready} snapshot={snapshot} onAction={send} /> : <CollectorAlbumTradeDesk state={state} ready={store.ready} snapshot={snapshot} onAction={send} />}
    <footer className={styles.legend}><div><h2>Les finitions de la collection</h2><p>Le classement UCI final S{snapshot.sourceSeason} détermine la finition. Les notes restent celles du coureur, sans bonus d’équipement.</p><div className={styles.rarityLegend}><span>✦ Or <small>1–5</small></span><span>✦ Argent <small>6–20</small></span><span>✦ Bronze <small>21–50</small></span></div></div><div className={styles.reset}><p>Aperçu privé · aucun effet sur les courses, les finances ou les inventaires des joueurs.</p>{resetConfirm ? <div><button type="button" onClick={()=>{send({type:"reset"},"La démonstration est réinitialisée : tes deux cartes de départ sont disponibles.");setResetConfirm(false);}}>Confirmer la remise à zéro</button><button type="button" onClick={()=>setResetConfirm(false)}>Garder mon essai</button></div> : <button type="button" onClick={()=>setResetConfirm(true)}>Réinitialiser uniquement cet essai</button>}</div></footer>
  </div>;
}
