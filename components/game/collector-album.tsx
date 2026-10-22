"use client";

import Link from "@/components/ui/app-link";
import { useEffect, useId, useReducer, useRef, useState, type PointerEvent } from "react";
import { CollectorCardFace } from "./collector-card-face";
import { CollectorAlbumCover } from "./collector-album-cover";
import { CollectorAlbumBoosters } from "./collector-album-boosters";
import { CollectorAlbumAchievements } from "./collector-album-achievements";
import { CollectorAlbumTradeDesk } from "./collector-album-trades";
import { AlbumProfileArtwork } from "./collector-album-profile-artwork";
import { getAlbumIntroductionLeaves, getAlbumProfileCards, getAlbumProfileLeaves } from "@/lib/game/collector-album-layout";
import { getAlbumBookTurn, getAlbumSwipeDirection } from "@/lib/game/collector-album-navigation";
import { albumReadingStorageKey, createAlbumReadingState, getNextAlbumChapter, readAlbumReadingState, updateAlbumReading, type AlbumReadingAction } from "@/lib/game/collector-album-reading";
import {
  ALBUM_PROFILES, albumPilotStorageKey, createAlbumPilotState,
  getLooseAlbumCardCount, getAlbumPilotPacks, readAlbumPilotState, updateAlbumPilot,
  type AlbumPilotAction, type AlbumPilotState, type AlbumProfile,
  type CollectorAlbumSnapshot, type CollectorCard,
} from "@/lib/game/collector-album";
import styles from "./collector-album.module.css";
import retro from "./collector-album-retro.module.css";
import spread from "./collector-album-spread.module.css";
import book from "./collector-album-book.module.css";
import { CycloStickersIntroduction } from "./cyclo-stickers-introduction";
import games from "./cyclo-stickers-games.module.css";
import format from "./collector-card-format.module.css";

type Store = { ready: boolean; state: AlbumPilotState; cards: CollectorCard[] };
type StoreAction = AlbumPilotAction | { type: "restore"; state: AlbumPilotState };
function reducer(store: Store, action: StoreAction): Store {
  if (action.type === "restore") return {...store, ready: true, state: action.state};
  if (!store.ready) return store;
  return {...store, state: updateAlbumPilot(store.state, action, store.cards)};
}

export function CollectorAlbum({ snapshot, storageOwnerId, initialTab = "album", initialIntroduction = false, initialProfile }: {snapshot: CollectorAlbumSnapshot; storageOwnerId: string; initialTab?: "album" | "trades" | "boosters" | "achievements"; initialIntroduction?: boolean; initialProfile?: AlbumProfile}) {
  const [store, dispatch] = useReducer(reducer, {ready: false, state: createAlbumPilotState(snapshot.collectionSeason,snapshot.cards), cards: snapshot.cards});
  const [tab, setTab] = useState(initialTab);
  const hasIntroduction=snapshot.cards.some(card=>card.kind);
  const [inIntroduction,setInIntroduction]=useState(hasIntroduction&&!initialProfile);
  const [introLeaf,setIntroLeaf]=useState(0);
  const editionSeason=snapshot.presentationSeason??snapshot.sourceSeason;
  const [profile, setProfile] = useState<AlbumProfile>(initialProfile ?? "tours");
  const [reading, setReading] = useState(createAlbumReadingState);
  const [readingReady, setReadingReady] = useState(false);
  const [bookOpen, setBookOpen] = useState(Boolean(initialProfile)||initialIntroduction);
  const [singlePage, setSinglePage] = useState(false);
  const [mobileLeaf, setMobileLeaf] = useState<1|2>(1);
  const [openingCover, setOpeningCover] = useState(false);
  const [turn, setTurn] = useState<{number:number; direction:"next"|"previous"}>({number:0,direction:"next"});
  const [requestedCard, setRequestedCard] = useState<number | null>(null);
  const openingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gesture = useRef<{x:number;y:number;pointerId:number}|null>(null);
  const chapterId = useId();
  const [walletPage, setWalletPage] = useState(0);
  const [notice, setNotice] = useState("");
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const state = store.state;
  const key = albumPilotStorageKey(storageOwnerId, snapshot.edition);
  const readingKey = albumReadingStorageKey(storageOwnerId, snapshot.edition);
  const read = (action: AlbumReadingAction) => setReading(previous => updateAlbumReading(previous, action, snapshot.cards));
  useEffect(() => {
    let cancelled = false;
    // Hydrate only after the server-matching first render; no browser access in SSR.
    queueMicrotask(() => {
      if (cancelled) return;
      let raw: string | null = null;
      let rawReading: string | null = null;
      try { raw = window.localStorage.getItem(key); rawReading = window.localStorage.getItem(readingKey); } catch { setStorageUnavailable(true); }
      const restored = readAlbumReadingState(rawReading, snapshot.cards);
      setReading(restored);
      setReadingReady(true);
      if (!initialProfile && restored.lastProfile) setProfile(restored.lastProfile);
      dispatch({type: "restore", state: readAlbumPilotState(raw, snapshot.collectionSeason,snapshot.cards)});
    });
    const sync = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) return;
      if (event.key === key || event.key === null) dispatch({type:"restore",state:readAlbumPilotState(event.newValue,snapshot.collectionSeason,snapshot.cards)});
      if (event.key === readingKey || event.key === null) setReading(readAlbumReadingState(event.newValue, snapshot.cards));
    };
    window.addEventListener("storage",sync);
    return () => { cancelled = true; window.removeEventListener("storage",sync); };
  }, [key, readingKey, initialProfile, snapshot.collectionSeason, snapshot.cards]);
  useEffect(() => {
    if (!store.ready) return;
    try { window.localStorage.setItem(key, JSON.stringify(store.state)); } catch { queueMicrotask(() => setStorageUnavailable(true)); }
  }, [key, store]);
  useEffect(() => {
    if (!readingReady) return;
    try { window.localStorage.setItem(readingKey, JSON.stringify(reading)); } catch { queueMicrotask(() => setStorageUnavailable(true)); }
  }, [reading, readingKey, readingReady]);
  useEffect(() => {
    if (!store.ready || !readingReady) return;
    // Dates are the first observed completion, never invented historical dates.
    queueMicrotask(() => setReading(previous => updateAlbumReading(previous, {type:"observe-completion",cards:snapshot.cards,pasted:store.state.pasted,at:new Date().toISOString()}, snapshot.cards)));
  }, [store.ready, store.state.pasted, readingReady, snapshot.cards]);
  useEffect(() => () => { if (openingTimer.current) clearTimeout(openingTimer.current); }, []);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => { setSinglePage(media.matches); setMobileLeaf(1); };
    queueMicrotask(update);
    media.addEventListener("change",update);
    return () => media.removeEventListener("change",update);
  }, []);
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
  const nextChapter = getNextAlbumChapter(snapshot.cards, state.pasted);
  const wanted = reading.wanted.filter(number => !state.owned.includes(number));
  const duplicateCount = [...new Set(state.owned)].reduce((sum, id) => sum + Math.max(0, getLooseAlbumCardCount(state,id) - Number(!state.pasted.includes(id))), 0);
  const chapterComplete = profileCards.length > 0 && pastedInChapter === profileCards.length;
  const resumeLabel = ALBUM_PROFILES.find(entry => entry.id === reading.lastProfile)?.label;
  const send = (action: AlbumPilotAction, text: string) => { dispatch(action); setNotice(text); };
  const switchProfile = (next: AlbumProfile, scrollToBook = false, leaf:1|2 = 1) => {
    if (next !== profile) setTurn(previous => ({number:previous.number + 1,direction:ALBUM_PROFILES.findIndex(entry => entry.id === next) > chapterIndex ? "next" : "previous"}));
    setProfile(next);
    setInIntroduction(false);
    setMobileLeaf(leaf);
    setBookOpen(true);
    read({type:"profile",profile:next});
    if (scrollToBook) requestAnimationFrame(() => {
      const chapter = document.getElementById(chapterId);
      chapter?.focus({preventScroll:true});
      chapter?.scrollIntoView({block:"start",behavior:"auto"});
    });
  };
  const showIntroduction = (leaf = 0, scrollToBook = true) => {
    setIntroLeaf(leaf); setInIntroduction(true); setBookOpen(true); setTab("album");
    read({type:"profile",profile:null});
    if(scrollToBook) requestAnimationFrame(()=>{const chapter=document.getElementById(chapterId);chapter?.focus({preventScroll:true});chapter?.scrollIntoView({block:"start",behavior:"auto"});});
  };
  const bookPosition = inIntroduction ? {section:"introduction" as const,leaf:introLeaf} : {section:"riders" as const,profile,leaf:mobileLeaf};
  const turnPage = (direction:-1|1) => {
    const target = getAlbumBookTurn(snapshot.cards,bookPosition,singlePage,direction);
    if (!target) return;
    if (target.section === "introduction") {
      setTurn(previous=>({number:previous.number+1,direction:direction===1?"next":"previous"}));
      showIntroduction(target.leaf); return;
    }
    if (target.profile === profile && !inIntroduction) {
      setMobileLeaf(target.leaf);
      setTurn(previous=>({number:previous.number+1,direction:direction === 1 ? "next" : "previous"}));
      requestAnimationFrame(()=>{const chapter=document.getElementById(chapterId);chapter?.focus({preventScroll:true});chapter?.scrollIntoView({block:"start",behavior:"auto"});});
    } else switchProfile(target.profile,true,target.leaf);
  };
  const previousDisabled = getAlbumBookTurn(snapshot.cards,bookPosition,singlePage,-1) === null;
  const nextDisabled = getAlbumBookTurn(snapshot.cards,bookPosition,singlePage,1) === null;
  const openBook = (start = false) => {
    if(hasIntroduction && (start || !reading.lastProfile)) showIntroduction(0);
    else switchProfile(start ? "tours" : reading.lastProfile ?? profile, true);
    setTurn({number:0,direction:"next"});
    setOpeningCover(true);
    if (openingTimer.current) clearTimeout(openingTimer.current);
    openingTimer.current = setTimeout(() => setOpeningCover(false), 650);
  };
  const findCard = (number:number) => {
    setRequestedCard(number);
    setTab("trades");
    setNotice("La carte recherchée est sélectionnée dans les échanges de démonstration.");
    requestAnimationFrame(() => {
      const composer = document.querySelector<HTMLElement>("[data-album-trade-composer]");
      composer?.focus({preventScroll:true});
      composer?.scrollIntoView({block:"start",behavior:"auto"});
    });
  };
  const pasteCards = (numbers:readonly number[]) => {
    const eligible = [...new Set(numbers)].filter(number => snapshot.cards.some(card => card.number === number) && !state.pasted.includes(number) && getLooseAlbumCardCount(state,number) > 0);
    if (!eligible.length) return;
    for (const number of eligible) dispatch({type:"paste",card:number});
    if(cardFor(eligible[0]).kind) showIntroduction(getAlbumIntroductionLeaves(snapshot.cards).findIndex(leaf=>leaf.some(card=>card.number===eligible[0])));
    else { switchProfile(cardFor(eligible[0]).profileKey, true); setTab("album"); }
    setNotice(`${eligible.length} vignette(s) collée(s) dans ton album.`);
  };
  const startGesture = (event:PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch" || (event.target as Element).closest("button,a,input,select,textarea")) return;
    gesture.current = {x:event.clientX,y:event.clientY,pointerId:event.pointerId};
  };
  const endGesture = (event:PointerEvent<HTMLElement>) => {
    const start = gesture.current;
    gesture.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const direction = getAlbumSwipeDirection(event.clientX-start.x,event.clientY-start.y);
    if (direction) turnPage(direction);
  };

  return <div className={`${styles.root} ${retro.albumDesk} ${spread.desk}`}>
    <div className={styles.utility}><Link href="/jeu/gazette">← La Cyclogazette</Link><span><span className={styles.liveDot} /> Aperçu privé · Abbaye du Lion</span></div>
    <header className={book.masthead}><h1>Album de Cyclo-Stickers</h1><span>Édition saison {editionSeason} · Les champions du peloton</span></header>
    {snapshot.gamesEdition?<details className={games.preparation}><summary>Édition S4 · Ouverture prévue en S5 · Aperçu privé</summary><p>Habillage S4, cartes et notes de test issues de S3. Les 50 coureurs définitifs seront ceux du classement UCI final S4, figés après la clôture de la saison.</p><ul><li>69 vignettes : 50 coureurs, 5 équipes, 10 champions continentaux, 2 champions du monde, le champion des Jeux et l’Équipier sans tête.</li><li>Les 19 vignettes d’ouverture sont fournies uniquement pour cet essai. Les spécimens ne sont pas des titres attribués à des coureurs.</li><li>Avant l’ouverture publique : inventaire serveur, échanges sécurisés, attribution Gazette et récompenses persistantes à raccorder. Aucune ouverture automatique de cette démo en S5.</li></ul><p><strong>À valider :</strong> couverture, sachets, finitions et cadence rare des distributions Gazette. Les chances affichées restent un barème de test.</p></details>:null}
    {storageUnavailable ? <p role="status" className={styles.warning}>Le stockage du navigateur est indisponible : cet essai sera réinitialisé à la fermeture de la page.</p> : null}
    <div className={styles.toolbar}>
      <div className={styles.tabButtons} aria-label="Rubriques de la collection"><button type="button" aria-pressed={tab === "album"} onClick={()=>setTab("album")}>L’album</button><button type="button" aria-pressed={tab === "boosters"} onClick={()=>setTab("boosters")}>Boosters <span>{closedPackCount}</span></button><button type="button" aria-pressed={tab === "trades"} onClick={()=>{setRequestedCard(null);setTab("trades");}}>Échanges <span>Démo</span>{state.pending ? " · 1" : ""}</button><button type="button" aria-pressed={tab === "achievements"} onClick={()=>setTab("achievements")}>Vitrine & succès</button></div>
      <div className={styles.progress}><strong>{state.pasted.length}<small> / {snapshot.cards.length}</small></strong><span>cartes collées</span><div aria-hidden="true"><i style={{width:`${state.pasted.length * 100/snapshot.cards.length}%`}} /></div></div>
    </div>
    <p className={styles.notice} role="status" aria-live="polite">{notice || (store.ready ? state.pasted.length ? "Les pages prennent vie" : "Ton album attend ses premières histoires." : "Ouverture de ton album…")}</p>

    {tab === "album" && !bookOpen ? <section className={book.coverStage} aria-label="Couverture de l’album"><CollectorAlbumCover season={editionSeason} gamesEdition={snapshot.gamesEdition} count={state.pasted.length} total={snapshot.cards.length} resumeLabel={resumeLabel} ready={store.ready && readingReady} onOpen={()=>openBook()} onStart={()=>openBook(true)} />{state.pasted.length === snapshot.cards.length && reading.completedAt ? <p className={book.completionNote}>Collection complète · Exemplaire signé Abbaye du Lion · Constaté le {new Date(reading.completedAt).toLocaleDateString("fr-FR",{timeZone:"UTC"})}</p> : null}</section> : tab === "album" ? <>
      <div className={book.bookControls}><button type="button" onClick={()=>{setBookOpen(false);setOpeningCover(false);requestAnimationFrame(()=>{const cover=document.querySelector<HTMLElement>("[data-album-cover] button");cover?.focus({preventScroll:true});cover?.scrollIntoView({block:"start",behavior:"auto"});});}}>← Refermer l’album</button><span>Feuillette les chapitres · glisse sur mobile</span></div>
      <nav className={`${styles.profiles} ${spread.contents}`} aria-label="Profils de coureurs">{hasIntroduction?<button type="button" aria-pressed={inIntroduction} aria-current={inIntroduction?"page":undefined} onClick={()=>showIntroduction(0,false)}><span className={spread.contentsNumber} aria-hidden="true">00</span><span>La saison S4</span><small>{snapshot.cards.filter(card=>card.kind&&state.pasted.includes(card.number)).length}/{snapshot.cards.filter(card=>card.kind).length}</small></button>:null}{ALBUM_PROFILES.map((entry,index) => <button type="button" key={entry.id} aria-pressed={!inIntroduction&&profile === entry.id} aria-current={!inIntroduction&&profile === entry.id ? "page" : undefined} onClick={()=>switchProfile(entry.id)}><span className={spread.contentsNumber} aria-hidden="true">{String(index+1).padStart(2,"0")}</span><span>{entry.label}</span><small>{snapshot.cards.filter(c=>!c.kind && c.profileKey === entry.id && state.pasted.includes(c.number)).length}/{snapshot.cards.filter(c=>!c.kind && c.profileKey === entry.id).length}</small></button>)}</nav>
      <div className={book.readingRail}><p>{nextChapter ? <><strong>Ton prochain chapitre ?</strong> Plus que {nextChapter.missing} vignette(s) chez les {ALBUM_PROFILES.find(entry=>entry.id === nextChapter.profile)!.label.toLowerCase()}.</> : <strong>Le peloton est au complet. Chaque page raconte ta saison.</strong>}</p>{nextChapter ? <button type="button" onClick={()=>switchProfile(nextChapter.profile,true)}>Aller au marque-page ↗</button> : <button type="button" onClick={()=>setTab("achievements")}>Voir mon livre d’or ↗</button>}</div>
      <div className={spread.layout}>
        <div className={book.bookStage}>
        {openingCover ? <div className={book.openingCover} aria-hidden="true"><CollectorAlbumCover season={editionSeason} gamesEdition={snapshot.gamesEdition} count={state.pasted.length} total={snapshot.cards.length} decorative /></div> : null}
        {turn.number > 0 && !openingCover ? <div key={turn.number} className={book.pageTurn} data-direction={turn.direction} aria-hidden="true" /> : null}
        <section key={inIntroduction?`intro-${introLeaf}`:profile} id={chapterId} tabIndex={-1} className={`${styles.book} ${spread.book} ${book.pageContent} ${book.gestureSurface}`} data-profile={inIntroduction?"introduction":profile} data-mobile-leaf={mobileLeaf} aria-label={inIntroduction?"Pages d’ouverture de l’album":`Page ${selectedProfile.label}`} onKeyDown={event=>{if(event.target !== event.currentTarget || (event.key !== "ArrowLeft" && event.key !== "ArrowRight"))return;event.preventDefault();turnPage(event.key === "ArrowRight" ? 1 : -1);}} onPointerDown={startGesture} onPointerUp={endGesture} onPointerCancel={()=>{gesture.current=null;}}>
          {inIntroduction?<CycloStickersIntroduction snapshot={snapshot} state={state} ready={store.ready} onAction={send} leaf={introLeaf} singlePage={singlePage} onTurn={turnPage} previousDisabled={previousDisabled} nextDisabled={nextDisabled}/>:<>
          <div className={book.pageEdges}><button type="button" aria-label="Feuille précédente" disabled={previousDisabled} onClick={()=>turnPage(-1)}>← Feuille précédente</button><span>Édition S{snapshot.sourceSeason} · {String(chapterIndex+1).padStart(2,"0")} / 07{singlePage ? <small> · {mobileLeaf} / {leaves[1].length > 0 ? 2 : 1}</small> : null}</span><button type="button" aria-label="Feuille suivante" disabled={nextDisabled} onClick={()=>turnPage(1)}>Feuille suivante →</button></div>
          <div className={spread.landscape} aria-hidden="true"><AlbumProfileArtwork profile={profile} decorative /></div>
          <header className={spread.chapterHeading}>
            <div className={spread.chapterCopy}><p className={spread.publisher}>LA CYCLOGAZETTE · COLLECTION SAISON {snapshot.sourceSeason}</p><p className={spread.chapterIndex}>CHAPITRE {String(chapterIndex+1).padStart(2,"0")} <span>/ {String(ALBUM_PROFILES.length).padStart(2,"0")}</span></p><h2>{selectedProfile.label}</h2><p className={spread.subtitle}>{selectedProfile.subtitle}</p><p className={spread.chapterCount}><strong>{pastedInChapter} / {profileCards.length}</strong> vignettes collées <span aria-hidden="true">·</span> Toute la catégorie sur cette double page</p>{chapterComplete && reading.completedChapters[profile] ? <div className={book.chapterStamp}><strong>Chapitre complet</strong>Constaté le {new Date(reading.completedChapters[profile]!).toLocaleDateString("fr-FR",{timeZone:"UTC"})}<span className={book.signature}>Abbaye du Lion</span></div> : null}</div>
            <div className={spread.chapterPostcard}><AlbumProfileArtwork profile={profile} decorative /><span>{selectedProfile.symbol} <span>{selectedProfile.subtitle}</span></span></div>
          </header>
          <div className={spread.leaves}>{leaves.map((cards, leafIndex) => <div className={spread.leaf} key={`${profile}-${leafIndex}`} data-album-leaf={leafIndex + 1}>
            <div className={spread.leafHeader}><span>{selectedProfile.label}</span><span>COLLECTION S{snapshot.sourceSeason}</span></div>
            <div className={`${spread.slots} ${format.grid}`}>{cards.map(card => {
            const pasted = state.pasted.includes(card.number);
            const owned = state.owned.includes(card.number);
            const reserved = getLooseAlbumCardCount(state,card.number) < 1 && state.pending?.give.includes(card.number);
            return <div key={card.id} className={`${styles.slotWrap} ${spread.slotWrap} ${format.slot}`} data-album-slot={card.number}>
              {pasted ? <><div className={book.pasted}><CollectorCardFace card={card} season={snapshot.sourceSeason} /></div><button type="button" className={styles.textButton} onClick={()=>send({type:"unpaste",card:card.number},`${card.name} rejoint les cartes à coller.`)}>Décoller pour le test</button></> : <div className={`${styles.emptySlot} ${spread.emptySlot} ${format.empty} ${owned ? spread.readySlot : ""}`}>
                <span className={styles.slotNumber}>{String(card.number).padStart(2,"0")}</span><span className={styles.slotSymbol} aria-hidden="true">{selectedProfile.symbol}</span><h3>{card.name}</h3><p>{card.country}</p>
                {owned ? <button type="button" className={styles.primaryButton} disabled={!store.ready || reserved} onClick={()=>send({type:"paste",card:card.number},`${card.name} est collé dans ton album.`)}>{reserved ? "Réservée à l’échange" : "Coller cette carte"}</button> : <span className={styles.toFind}>À collectionner</span>}
                {!owned ? <><button type="button" className={book.wantedButton} aria-label={`Rechercher ${card.name}`} aria-pressed={reading.wanted.includes(card.number)} disabled={!readingReady} onClick={()=>read({type:"wanted",card:card.number})}>{reading.wanted.includes(card.number) ? "✓ Dans ma liste de recherche" : "+ Je cherche cette carte"}</button><button type="button" className={book.findButton} disabled={!store.ready} onClick={()=>findCard(card.number)}>Trouver un échange ↗</button></> : null}
              </div>}
            </div>;
          })}</div>
            {cards.length === 0 ? <div className={spread.emptyChapter}><span aria-hidden="true">{selectedProfile.symbol}</span><p>Les grandes histoires tiennent parfois en une seule vignette.</p></div> : null}
            <div className={spread.folio}><span>CYCLO-STICKERS · S{editionSeason}</span><strong>{String(chapterIndex * 2 + leafIndex + (hasIntroduction?6:2)).padStart(2,"0")}</strong></div>
          </div>)}</div>
          <footer className={spread.bookFooter}><button type="button" aria-label={singlePage ? "Feuille précédente" : "Catégorie précédente"} disabled={previousDisabled} onClick={()=>turnPage(-1)}>← <span>Catégorie précédente</span></button><span><strong>{chapterIndex+1}</strong> / {ALBUM_PROFILES.length} <small>{profileCards.length} coureurs dans ce chapitre</small></span><button type="button" aria-label={singlePage ? "Feuille suivante" : "Catégorie suivante"} disabled={nextDisabled} onClick={()=>turnPage(1)}><span>Catégorie suivante</span> →</button></footer>
        </>}
        </section>
        </div>
        <aside className={`${styles.wallet} ${retro.collectorTable} ${spread.walletShelf}`}><div className={styles.walletHeading}><p className={styles.eyebrow}>SUR LA TABLE</p><h2>Les cartes à coller <span>{available.length}</span></h2><p>Choisis leur page, puis colle tes cartes.</p><p>{duplicateCount} doublon(s) échangeable(s) · {wanted.length} carte(s) recherchée(s)</p><button type="button" className={styles.textButton} onClick={()=>{setRequestedCard(null);setTab("trades");}}>Ouvrir mon carnet d’échanges ↗</button></div>
          {available.length ? available.slice(visibleWalletPage*2,visibleWalletPage*2+2).map(id => <div className={`${styles.walletCard} ${format.slot}`} key={id}><CollectorCardFace card={cardFor(id)} season={snapshot.sourceSeason} /><p className={retro.copyCount}>{state.owned.filter(n=>n===id).length} exemplaire(s) · {getLooseAlbumCardCount(state,id)} disponible(s)</p><button type="button" className={styles.primaryButton} disabled={!store.ready || state.pasted.includes(id) || getLooseAlbumCardCount(state,id)<1} onClick={()=>{const c=cardFor(id);if(c.kind)showIntroduction(getAlbumIntroductionLeaves(snapshot.cards).findIndex(leaf=>leaf.some(card=>card.number===c.number)));else switchProfile(c.profileKey,true);send({type:"paste",card:id},`${c.name} est collé dans ton album.`);}}>{state.pasted.includes(id) ? "Déjà collée · doublon pour échange" : getLooseAlbumCardCount(state,id)<1 ? "Carte réservée à l’échange" : "Coller dans l’album ↗"}</button></div>) : <p className={styles.emptyWallet}>Toutes tes cartes sont dans l’album. Feuillette les chapitres ou ouvre un sachet pour continuer.</p>}
          {walletPageCount>1 ? <div className={styles.bookFooter}><button type="button" aria-label="Cartes à coller précédentes" disabled={visibleWalletPage===0} onClick={()=>setWalletPage(visibleWalletPage-1)}>←</button><span>{visibleWalletPage+1} / {walletPageCount}</span><button type="button" aria-label="Cartes à coller suivantes" disabled={visibleWalletPage===walletPageCount-1} onClick={()=>setWalletPage(visibleWalletPage+1)}>→</button></div> : null}
          <div className={styles.gazetteNote}><span aria-hidden="true">✉</span><h3>Un rendez-vous rare</h3><p>À terme, certaines éditions de la Gazette pourront offrir une carte. Aucun tirage n’est encore activé. Pas d’achat, ni d’autre source prévue pour le moment.</p></div>
        </aside>
      </div>
    </> : tab === "boosters" ? <CollectorAlbumBoosters state={state} ready={store.ready} snapshot={snapshot} onAction={send} onViewAlbum={()=>{setTab("album");if(hasIntroduction&&!reading.lastProfile)showIntroduction();else switchProfile(reading.lastProfile ?? profile);}} onPasteCards={pasteCards} /> : tab === "achievements" ? <CollectorAlbumAchievements state={state} ready={store.ready} snapshot={snapshot} onAction={send} /> : <CollectorAlbumTradeDesk key={requestedCard ?? "desk"} state={state} ready={store.ready} snapshot={snapshot} onAction={send} requestedCard={requestedCard} wanted={wanted} onToggleWanted={number=>read({type:"wanted",card:number})} />}
    <div className={styles.pilotNote}><span aria-hidden="true">✦</span><p><strong>Ton exemplaire de démonstration.</strong> Deux cartes et deux sachets d’essai. {snapshot.gamesEdition?"Les 19 vignettes d’ouverture sont fournies pour ce test. ":null}Progression et échanges restent dans ce navigateur. Les récompenses sont simulées, sans effet sur ton équipe.</p></div>
    <footer className={styles.legend}><div><h2>Les finitions de la collection</h2><p>Le classement UCI final S{snapshot.sourceSeason} détermine la finition. Les notes restent celles du coureur, sans bonus d’équipement.</p><div className={styles.rarityLegend}><span>✦ Or <small>1–5</small></span><span>✦ Argent <small>6–20</small></span><span>✦ Bronze <small>21–50</small></span></div></div><div className={styles.reset}><p>Aperçu privé · aucun effet sur les courses, les finances ou les inventaires des joueurs.</p>{resetConfirm ? <div><button type="button" onClick={()=>{send({type:"reset"},"La démonstration est réinitialisée : tes deux cartes de départ sont disponibles.");setReading(createAlbumReadingState());setProfile("tours");setInIntroduction(hasIntroduction);setIntroLeaf(0);setBookOpen(false);setRequestedCard(null);setResetConfirm(false);}}>Confirmer la remise à zéro</button><button type="button" onClick={()=>setResetConfirm(false)}>Garder mon essai</button></div> : <button type="button" onClick={()=>setResetConfirm(true)}>Réinitialiser uniquement cet essai</button>}</div></footer>
  </div>;
}
