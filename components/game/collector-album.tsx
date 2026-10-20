"use client";

import Link from "@/components/ui/app-link";
import { useEffect, useId, useReducer, useState } from "react";
import { CollectorCardFace } from "./collector-card-face";
import { VintageCyclingArtwork } from "./collector-album-artwork";
import { CollectorAlbumBoosters } from "./collector-album-boosters";
import { CollectorAlbumAchievements } from "./collector-album-achievements";
import { CollectorAlbumTradeDesk } from "./collector-album-trades";
import { AlbumProfileArtwork } from "./collector-album-profile-artwork";
import { getAdjacentAlbumProfile, getAlbumProfileCards, getAlbumProfileLeaves } from "@/lib/game/collector-album-layout";
import {
  ALBUM_PROFILES, albumPilotStorageKey, createAlbumPilotState,
  getLooseAlbumCardCount, getAlbumPilotPacks, readAlbumPilotState, updateAlbumPilot,
  type AlbumPilotAction, type AlbumPilotState, type AlbumProfile,
  type CollectorAlbumSnapshot, type CollectorCard,
} from "@/lib/game/collector-album";
import styles from "./collector-album.module.css";
import retro from "./collector-album-retro.module.css";
import spread from "./collector-album-spread.module.css";

type Store = { ready: boolean; state: AlbumPilotState; cards: CollectorCard[] };
type StoreAction = AlbumPilotAction | { type: "restore"; state: AlbumPilotState };
function reducer(store: Store, action: StoreAction): Store {
  if (action.type === "restore") return {...store, ready: true, state: action.state};
  if (!store.ready) return store;
  return {...store, state: updateAlbumPilot(store.state, action, store.cards)};
}

export function CollectorAlbum({ snapshot, storageOwnerId, initialTab = "album", initialProfile = "tours" }: {snapshot: CollectorAlbumSnapshot; storageOwnerId: string; initialTab?: "album" | "trades" | "boosters" | "achievements"; initialProfile?: AlbumProfile}) {
  const [store, dispatch] = useReducer(reducer, {ready: false, state: createAlbumPilotState(snapshot.collectionSeason), cards: snapshot.cards});
  const [tab, setTab] = useState(initialTab);
  const [profile, setProfile] = useState<AlbumProfile>(initialProfile);
  const chapterId = useId();
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
  const profileCards = getAlbumProfileCards(snapshot.cards, profile);
  const leaves = getAlbumProfileLeaves(profileCards);
  const chapterIndex = ALBUM_PROFILES.indexOf(selectedProfile);
  const pastedInChapter = profileCards.filter(card => state.pasted.includes(card.number)).length;
  const available = [...new Set(state.owned)].filter(id => getLooseAlbumCardCount(state,id) > 0 || state.pending?.give.includes(id));
  const walletPageCount = Math.max(1,Math.ceil(available.length/2));
  const visibleWalletPage = Math.min(walletPage,walletPageCount-1);
  const closedPackCount = getAlbumPilotPacks(snapshot.collectionSeason).length - state.openedPacks.length;
  const send = (action: AlbumPilotAction, text: string) => { dispatch(action); setNotice(text); };
  const switchProfile = (next: AlbumProfile, scrollToBook = false) => {
    setProfile(next);
    if (scrollToBook) requestAnimationFrame(() => document.getElementById(chapterId)?.scrollIntoView({block: "start", behavior: "auto"}));
  };

  return <div className={`${styles.root} ${retro.albumDesk} ${spread.desk}`}>
    <div className={styles.utility}><Link href="/jeu/gazette">← La Cyclogazette</Link><span><span className={styles.liveDot} /> Aperçu privé · Abbaye du Lion</span></div>
    <header className={retro.cover}>
      <div className={retro.coverMasthead}><span>LA CYCLOGAZETTE · ÉDITIONS DU VÉLO</span><span>50 COUREURS · COLLECTION À COMPLÉTER</span></div>
      <div className={retro.coverCopy}><h1><span>L’Album du</span><em>peloton</em></h1><p className={retro.coverIntro}>Les champions passent.<br />Les souvenirs restent.</p><p className={retro.coverDetails}>Les cinquante figures du classement UCI de la saison {snapshot.sourceSeason}. Leurs visages, leurs maillots et toute la passion du vélo, vignette après vignette.</p></div>
      <div className={retro.coverPicture}><VintageCyclingArtwork className={retro.coverIllustration} /><div className={retro.seasonStamp}><span>ÉDITION</span><strong>S{snapshot.sourceSeason}</strong></div><span className={retro.pictureCaption}>Échappées, cols et belles histoires — l’album des passionnés.</span></div>
      <div className={retro.coverFooter}><span>UNE SAISON. UN ALBUM. CINQUANTE SOUVENIRS.</span><span>CYCLO STRATÈGE · NOTES NATIVES · MAILLOTS OFFICIELS</span></div>
    </header>
    <div className={retro.seasonShelf}><strong>Édition saison {snapshot.sourceSeason} · Les champions du peloton</strong><span>Notes, maillots et résultats figés en fin de saison {snapshot.sourceSeason}. Une collection indépendante par édition.</span></div>
    <div className={styles.pilotNote}><span aria-hidden="true">✦</span><p><strong>Ton exemplaire de démonstration.</strong> Deux cartes et deux sachets d’essai. Progression et échanges restent dans ce navigateur. Les récompenses sont simulées, sans effet sur ton équipe.</p></div>
    {storageUnavailable ? <p role="status" className={styles.warning}>Le stockage du navigateur est indisponible : cet essai sera réinitialisé à la fermeture de la page.</p> : null}
    <div className={styles.toolbar}>
      <div className={styles.tabButtons} aria-label="Rubriques de la collection"><button type="button" aria-pressed={tab === "album"} onClick={()=>setTab("album")}>L’album</button><button type="button" aria-pressed={tab === "boosters"} onClick={()=>setTab("boosters")}>Les sachets <span>{closedPackCount}</span></button><button type="button" aria-pressed={tab === "trades"} onClick={()=>setTab("trades")}>Échanges <span>Démo</span>{state.pending ? " · 1" : ""}</button><button type="button" aria-pressed={tab === "achievements"} onClick={()=>setTab("achievements")}>Vitrine & succès</button></div>
      <div className={styles.progress}><strong>{state.pasted.length}<small> / 50</small></strong><span>cartes collées</span><div aria-hidden="true"><i style={{width:`${state.pasted.length * 2}%`}} /></div></div>
    </div>
    <p className={styles.notice} role="status" aria-live="polite">{notice || (store.ready ? "Ton album attend ses premières histoires." : "Ouverture de ton album…")}</p>

    {tab === "album" ? <>
      <nav className={`${styles.profiles} ${spread.contents}`} aria-label="Profils de coureurs">{ALBUM_PROFILES.map((entry,index) => <button type="button" key={entry.id} aria-pressed={profile === entry.id} aria-current={profile === entry.id ? "page" : undefined} onClick={()=>switchProfile(entry.id)}><span className={spread.contentsNumber} aria-hidden="true">{String(index+1).padStart(2,"0")}</span><span>{entry.label}</span><small>{snapshot.cards.filter(c=>c.profileKey === entry.id && state.pasted.includes(c.number)).length}/{snapshot.cards.filter(c=>c.profileKey === entry.id).length}</small></button>)}</nav>
      <div className={spread.layout}>
        <section id={chapterId} className={`${styles.book} ${spread.book}`} data-profile={profile} aria-label={`Page ${selectedProfile.label}`}>
          <div className={spread.landscape} aria-hidden="true"><AlbumProfileArtwork profile={profile} decorative /></div>
          <header className={spread.chapterHeading}>
            <div className={spread.chapterCopy}><p className={spread.publisher}>LA CYCLOGAZETTE · COLLECTION SAISON {snapshot.sourceSeason}</p><p className={spread.chapterIndex}>CHAPITRE {String(chapterIndex+1).padStart(2,"0")} <span>/ {String(ALBUM_PROFILES.length).padStart(2,"0")}</span></p><h2>{selectedProfile.label}</h2><p className={spread.subtitle}>{selectedProfile.subtitle}</p><p className={spread.chapterCount}><strong>{pastedInChapter} / {profileCards.length}</strong> vignettes collées <span aria-hidden="true">·</span> Toute la catégorie sur cette double page</p></div>
            <div className={spread.chapterPostcard}><AlbumProfileArtwork profile={profile} decorative /><span>{selectedProfile.symbol} <span>{selectedProfile.subtitle}</span></span></div>
          </header>
          <div className={spread.leaves}>{leaves.map((cards, leafIndex) => <div className={spread.leaf} key={`${profile}-${leafIndex}`} data-album-leaf={leafIndex + 1}>
            <div className={spread.leafHeader}><span>{selectedProfile.label}</span><span>COLLECTION S{snapshot.sourceSeason}</span></div>
            <div className={`${spread.slots} ${cards.length > 8 ? spread.denseSlots : ""}`}>{cards.map(card => {
            const pasted = state.pasted.includes(card.number);
            const owned = state.owned.includes(card.number);
            const reserved = getLooseAlbumCardCount(state,card.number) < 1 && state.pending?.give.includes(card.number);
            return <div key={card.id} className={`${styles.slotWrap} ${spread.slotWrap}`} data-album-slot={card.number}>
              {pasted ? <><CollectorCardFace card={card} season={snapshot.sourceSeason} /><button type="button" className={styles.textButton} onClick={()=>send({type:"unpaste",card:card.number},`${card.name} rejoint les cartes à coller.`)}>Décoller pour le test</button></> : <div className={`${styles.emptySlot} ${spread.emptySlot} ${owned ? spread.readySlot : ""}`}>
                <span className={styles.slotNumber}>{String(card.number).padStart(2,"0")}</span><span className={styles.slotSymbol} aria-hidden="true">{selectedProfile.symbol}</span><h3>{card.name}</h3><p>{card.country}</p>
                {owned ? <button type="button" className={styles.primaryButton} disabled={!store.ready || reserved} onClick={()=>send({type:"paste",card:card.number},`${card.name} est collé dans ton album.`)}>{reserved ? "Réservée à l’échange" : "Coller cette carte"}</button> : <span className={styles.toFind}>À collectionner</span>}
              </div>}
            </div>;
          })}</div>
            {cards.length === 0 ? <div className={spread.emptyChapter}><span aria-hidden="true">{selectedProfile.symbol}</span><p>Les grandes histoires tiennent parfois en une seule vignette.</p></div> : null}
            <div className={spread.folio}><span>L’ALBUM DU PELOTON · S{snapshot.sourceSeason}</span><strong>{String(chapterIndex * 2 + leafIndex + 2).padStart(2,"0")}</strong></div>
          </div>)}</div>
          <footer className={spread.bookFooter}><button type="button" aria-label="Catégorie précédente" disabled={chapterIndex === 0} onClick={()=>switchProfile(getAdjacentAlbumProfile(profile,-1),true)}>← <span>Catégorie précédente</span></button><span><strong>{chapterIndex+1}</strong> / {ALBUM_PROFILES.length} <small>{profileCards.length} coureurs dans ce chapitre</small></span><button type="button" aria-label="Catégorie suivante" disabled={chapterIndex === ALBUM_PROFILES.length-1} onClick={()=>switchProfile(getAdjacentAlbumProfile(profile,1),true)}><span>Catégorie suivante</span> →</button></footer>
        </section>
        <aside className={`${styles.wallet} ${retro.collectorTable} ${spread.walletShelf}`}><div className={styles.walletHeading}><p className={styles.eyebrow}>SUR LA TABLE</p><h2>Les cartes à coller <span>{available.length}</span></h2><p>Choisis leur page, puis colle tes cartes.</p></div>
          {available.length ? available.slice(visibleWalletPage*2,visibleWalletPage*2+2).map(id => <div className={styles.walletCard} key={id}><CollectorCardFace card={cardFor(id)} season={snapshot.sourceSeason} /><p className={retro.copyCount}>{state.owned.filter(n=>n===id).length} exemplaire(s) · {getLooseAlbumCardCount(state,id)} disponible(s)</p><button type="button" className={styles.primaryButton} disabled={!store.ready || state.pasted.includes(id) || getLooseAlbumCardCount(state,id)<1} onClick={()=>{const c=cardFor(id);switchProfile(c.profileKey,true);send({type:"paste",card:id},`${c.name} est collé dans ton album.`);}}>{state.pasted.includes(id) ? "Déjà collée · doublon pour échange" : getLooseAlbumCardCount(state,id)<1 ? "Carte réservée à l’échange" : "Coller dans l’album ↗"}</button></div>) : <p className={styles.emptyWallet}>Toutes tes cartes sont dans l’album. Feuillette les chapitres ou ouvre un sachet pour continuer.</p>}
          {walletPageCount>1 ? <div className={styles.bookFooter}><button type="button" aria-label="Cartes à coller précédentes" disabled={visibleWalletPage===0} onClick={()=>setWalletPage(visibleWalletPage-1)}>←</button><span>{visibleWalletPage+1} / {walletPageCount}</span><button type="button" aria-label="Cartes à coller suivantes" disabled={visibleWalletPage===walletPageCount-1} onClick={()=>setWalletPage(visibleWalletPage+1)}>→</button></div> : null}
          <div className={styles.gazetteNote}><span aria-hidden="true">✉</span><h3>Un rendez-vous rare</h3><p>À terme, certaines éditions de la Gazette pourront offrir une carte. Aucun tirage n’est encore activé. Pas d’achat, ni d’autre source prévue pour le moment.</p></div>
        </aside>
      </div>
    </> : tab === "boosters" ? <CollectorAlbumBoosters state={state} ready={store.ready} snapshot={snapshot} onAction={send} onViewAlbum={()=>setTab("album")} /> : tab === "achievements" ? <CollectorAlbumAchievements state={state} ready={store.ready} snapshot={snapshot} onAction={send} /> : <CollectorAlbumTradeDesk state={state} ready={store.ready} snapshot={snapshot} onAction={send} />}
    <footer className={styles.legend}><div><h2>Les finitions de la collection</h2><p>Le classement UCI final S{snapshot.sourceSeason} détermine la finition. Les notes restent celles du coureur, sans bonus d’équipement.</p><div className={styles.rarityLegend}><span>✦ Or <small>1–5</small></span><span>✦ Argent <small>6–20</small></span><span>✦ Bronze <small>21–50</small></span></div></div><div className={styles.reset}><p>Aperçu privé · aucun effet sur les courses, les finances ou les inventaires des joueurs.</p>{resetConfirm ? <div><button type="button" onClick={()=>{send({type:"reset"},"La démonstration est réinitialisée : tes deux cartes de départ sont disponibles.");setResetConfirm(false);}}>Confirmer la remise à zéro</button><button type="button" onClick={()=>setResetConfirm(false)}>Garder mon essai</button></div> : <button type="button" onClick={()=>setResetConfirm(true)}>Réinitialiser uniquement cet essai</button>}</div></footer>
  </div>;
}
