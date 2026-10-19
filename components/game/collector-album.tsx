"use client";

import Image from "next/image";
import Link from "@/components/ui/app-link";
import { useEffect, useReducer, useState } from "react";
import { RiderAvatar } from "./rider-avatar";
import {
  ALBUM_PROFILES, CARD_RARITY_LABELS, albumPilotStorageKey, createAlbumPilotState,
  getCardRarity, readAlbumPilotState, updateAlbumPilot,
  type AlbumPilotAction, type AlbumPilotState, type AlbumProfile,
  type CollectorAlbumSnapshot, type CollectorCard,
} from "@/lib/game/collector-album";
import styles from "./collector-album.module.css";

const PRIMARY_STATS = [["mountain", "MO"], ["hills", "VAL"], ["flat", "PLA"], ["timeTrial", "CLM"], ["cobbles", "PAV"], ["sprint", "SPR"]] as const;

export function CollectorCardFace({ card, season }: { card: CollectorCard; season: number }) {
  const rarity = getCardRarity(card.rank);
  return <article className={`${styles.card} ${styles[rarity]}`} aria-label={`${card.name}, carte ${CARD_RARITY_LABELS[rarity]}`}>
    <div className={styles.cardTop}><span>CS / {String(card.number).padStart(2,"0")}</span><span>{CARD_RARITY_LABELS[rarity]} <span aria-hidden="true">✦</span></span></div>
    <div className={styles.art}>
      <svg className={styles.contours} viewBox="0 0 280 160" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1"><path d="M-20 140 40 100 80 110 130 30 170 80 210 45 300 105M-20 152 40 112 80 122 130 42 170 92 210 57 300 117M-20 164 40 124 80 134 130 54 170 104 210 69 300 129M-20 176 40 136 80 146 130 66 170 116 210 81 300 141" /></g></svg>
      <span className={styles.rankWatermark} aria-hidden="true">{String(card.rank).padStart(2,"0")}</span>
      <RiderAvatar riderId={card.id} profileKey={card.avatarProfileKey} seed={card.avatarSeed} age={card.age} jersey={card.jersey} label={`Portrait de ${card.name}`} className={styles.portrait} />
      {card.jersey.imagePath ? <Image src={card.jersey.imagePath} alt={`Maillot de ${card.teamName}, saison ${season}`} width={72} height={84} sizes="72px" className={styles.jersey} /> : null}
      <span className={styles.country}>{card.countryCode.toUpperCase()} <span aria-hidden="true">/</span> {card.age} ans</span>
    </div>
    <div className={styles.cardIdentity}><p>{card.profile}</p><h3>{card.name}</h3><span>{card.teamName}</span></div>
    <dl className={styles.stats}>{PRIMARY_STATS.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{card.ratings[key]}</dd></div>)}</dl>
    <div className={styles.achievements}><span><strong>{card.rank === 1 ? "1er" : `${card.rank}e`}</strong> UCI S{season}</span><span><strong>{card.victories}</strong> victoires</span></div>
    <footer className={styles.cardFoot}><span>{card.points.toLocaleString("fr-FR")} pts UCI</span><span>ÉDITION S{season + 1}</span></footer>
  </article>;
}

type Store = { ready: boolean; state: AlbumPilotState };
type StoreAction = AlbumPilotAction | { type: "restore"; state: AlbumPilotState };
function reducer(store: Store, action: StoreAction): Store {
  if (action.type === "restore") return {ready: true, state: action.state};
  if (!store.ready) return store;
  return {ready: true, state: updateAlbumPilot(store.state, action)};
}

export function CollectorAlbum({ snapshot, storageOwnerId }: {snapshot: CollectorAlbumSnapshot; storageOwnerId: string}) {
  const [store, dispatch] = useReducer(reducer, {ready: false, state: createAlbumPilotState()});
  const [tab, setTab] = useState<"album" | "trades">("album");
  const [profile, setProfile] = useState<AlbumProfile>("tours");
  const [page, setPage] = useState(0);
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
      dispatch({type: "restore", state: readAlbumPilotState(raw)});
    });
    return () => { cancelled = true; };
  }, [key]);
  useEffect(() => {
    if (!store.ready) return;
    try { window.localStorage.setItem(key, JSON.stringify(store.state)); } catch { queueMicrotask(() => setStorageUnavailable(true)); }
  }, [key, store]);
  const cardFor = (number: number) => snapshot.cards.find(card => card.number === number)!;
  const selectedProfile = ALBUM_PROFILES.find(entry => entry.id === profile)!;
  const profileCards = snapshot.cards.filter(card => card.profileKey === profile);
  const pageCount = Math.max(1, Math.ceil(profileCards.length / 4));
  const visibleCards = profileCards.slice(page * 4, page * 4 + 4);
  const available = state.owned.filter(id => !state.pasted.includes(id));
  const send = (action: AlbumPilotAction, text: string) => { dispatch(action); setNotice(text); };
  const switchProfile = (next: AlbumProfile) => {setProfile(next); setPage(0);};

  return <div className={styles.root}>
    <div className={styles.utility}><Link href="/jeu/gazette">← La Cyclogazette</Link><span><span className={styles.liveDot} /> Aperçu privé · Abbaye du Lion</span></div>
    <header className={styles.cover}>
      <div className={styles.coverCopy}><p className={styles.eyebrow}>La Cyclogazette présente / Collection S{snapshot.collectionSeason}</p><h1>L’Album<br />du <em>peloton.</em></h1><p className={styles.lead}>50 visages. Une saison à collectionner.</p><p className={styles.intro}>Les figures du top 50 UCI de la saison {snapshot.sourceSeason}, réunies dans un album à compléter, carte après carte.</p></div>
      <div className={styles.coverSeal}><span>LA SÉLECTION</span><strong>50</strong><span>COUREURS · S{snapshot.sourceSeason}</span><i aria-hidden="true">✦</i><small>Grands tours · Classiques · Sprint</small></div>
      <div className={styles.coverFooter}><span>Notes natives & maillots de la saison {snapshot.sourceSeason}</span><span>COLLER. COLLECTIONNER. ÉCHANGER.</span></div>
    </header>
    <div className={styles.pilotNote}><span aria-hidden="true">✦</span><p><strong>Ton exemplaire de démonstration.</strong> Deux cartes offertes pour cet aperçu. Collage et échanges sont enregistrés uniquement dans ce navigateur. Aucun autre joueur n’est impliqué.</p></div>
    {storageUnavailable ? <p role="status" className={styles.warning}>Le stockage du navigateur est indisponible : cet essai sera réinitialisé à la fermeture de la page.</p> : null}
    <div className={styles.toolbar}>
      <div className={styles.tabButtons} aria-label="Rubriques de la collection"><button type="button" aria-pressed={tab === "album"} onClick={()=>setTab("album")}>L’album</button><button type="button" aria-pressed={tab === "trades"} onClick={()=>setTab("trades")}>Les échanges <span>Démo</span>{state.pending ? " · 1" : ""}</button></div>
      <div className={styles.progress}><strong>{state.pasted.length}<small> / 50</small></strong><span>cartes collées</span><div aria-hidden="true"><i style={{width:`${state.pasted.length * 2}%`}} /></div></div>
    </div>
    <p className={styles.notice} role="status" aria-live="polite">{notice || (store.ready ? "Ton album attend ses premières histoires." : "Ouverture de ton album…")}</p>

    {tab === "album" ? <>
      <nav className={styles.profiles} aria-label="Profils de coureurs">{ALBUM_PROFILES.map(entry => <button type="button" key={entry.id} aria-pressed={profile === entry.id} onClick={()=>switchProfile(entry.id)}><span aria-hidden="true">{entry.symbol}</span>{entry.label}<small>{snapshot.cards.filter(c=>c.profileKey === entry.id && state.pasted.includes(c.number)).length}/{snapshot.cards.filter(c=>c.profileKey === entry.id).length}</small></button>)}</nav>
      <div className={styles.layout}>
        <section className={styles.book} aria-label={`Page ${selectedProfile.label}`}>
          <header className={styles.bookHeading}><div><p className={styles.eyebrow}>CHAPITRE {String(ALBUM_PROFILES.indexOf(selectedProfile)+1).padStart(2,"0")} / {selectedProfile.label}</p><h2>{selectedProfile.subtitle}</h2></div><span aria-hidden="true">{selectedProfile.symbol}</span></header>
          <div className={styles.slots}>{visibleCards.map(card => {
            const pasted = state.pasted.includes(card.number);
            const owned = state.owned.includes(card.number);
            const reserved = state.pending?.give === card.number;
            return <div key={card.id} className={styles.slotWrap}>
              {pasted ? <><CollectorCardFace card={card} season={snapshot.sourceSeason} /><button type="button" className={styles.textButton} onClick={()=>send({type:"unpaste",card:card.number},`${card.name} rejoint les cartes à coller.`)}>Décoller pour le test</button></> : <div className={`${styles.emptySlot} ${owned ? styles.readySlot : ""}`}>
                <span className={styles.slotNumber}>{String(card.number).padStart(2,"0")}</span><span className={styles.slotSymbol} aria-hidden="true">{selectedProfile.symbol}</span><h3>{card.name}</h3><p>{card.country} · {CARD_RARITY_LABELS[getCardRarity(card.rank)]}</p>
                {owned ? <button type="button" className={styles.primaryButton} disabled={!store.ready || reserved} onClick={()=>send({type:"paste",card:card.number},`${card.name} est collé dans ton album.`)}>{reserved ? "Réservée à l’échange" : "Coller cette carte"}</button> : <span className={styles.toFind}>À collectionner</span>}
              </div>}
            </div>;
          })}</div>
          <footer className={styles.bookFooter}><span>{profileCards.length} coureurs dans ce chapitre</span><div><button type="button" aria-label="Page précédente" disabled={page === 0} onClick={()=>setPage(p=>p-1)}>←</button><span>{page+1} / {pageCount}</span><button type="button" aria-label="Page suivante" disabled={page >= pageCount - 1} onClick={()=>setPage(p=>p+1)}>→</button></div></footer>
        </section>
        <aside className={styles.wallet}><div className={styles.walletHeading}><p className={styles.eyebrow}>SUR LA TABLE</p><h2>Les cartes à coller <span>{available.length}</span></h2><p>Choisis leur page, puis colle tes cartes.</p></div>
          {available.length ? available.map(id => <div className={styles.walletCard} key={id}><CollectorCardFace card={cardFor(id)} season={snapshot.sourceSeason} /><button type="button" className={styles.primaryButton} disabled={!store.ready || state.pending?.give === id} onClick={()=>{const c=cardFor(id);switchProfile(c.profileKey);setPage(Math.floor(snapshot.cards.filter(x=>x.profileKey === c.profileKey).findIndex(x=>x.number===id)/4));send({type:"paste",card:id},`${c.name} est collé dans ton album.`);}}>{state.pending?.give === id ? "Carte réservée à l’échange" : "Coller dans l’album ↗"}</button></div>) : <p className={styles.emptyWallet}>Tes deux cartes sont dans l’album. Feuillette les chapitres pour les retrouver.</p>}
          <div className={styles.gazetteNote}><span aria-hidden="true">✉</span><h3>Un rendez-vous rare</h3><p>À terme, certaines éditions de la Gazette pourront offrir une carte. Aucun tirage n’est encore activé. Pas d’achat, ni d’autre source prévue pour le moment.</p></div>
        </aside>
      </div>
    </> : <TradeDesk state={state} ready={store.ready} snapshot={snapshot} onAction={send} />}
    <footer className={styles.legend}><div><h2>Les finitions de la collection</h2><p>Le classement UCI final S{snapshot.sourceSeason} détermine la finition. Les notes restent celles du coureur, sans bonus d’équipement.</p><div className={styles.rarityLegend}><span>✦ Or <small>1–5</small></span><span>✦ Argent <small>6–20</small></span><span>✦ Bronze <small>21–50</small></span></div></div><div className={styles.reset}><p>Aperçu privé · aucun effet sur les courses, les finances ou les inventaires des joueurs.</p>{resetConfirm ? <div><button type="button" onClick={()=>{send({type:"reset"},"La démonstration est réinitialisée : tes deux cartes de départ sont disponibles.");setResetConfirm(false);}}>Confirmer la remise à zéro</button><button type="button" onClick={()=>setResetConfirm(false)}>Garder mon essai</button></div> : <button type="button" onClick={()=>setResetConfirm(true)}>Réinitialiser uniquement cet essai</button>}</div></footer>
  </div>;
}

function TradeDesk({ state, ready, snapshot, onAction }: {state: AlbumPilotState; ready: boolean; snapshot: CollectorAlbumSnapshot; onAction:(action:AlbumPilotAction,text:string)=>void}) {
  const [give, setGive] = useState(0);
  const [receive, setReceive] = useState(0);
  const cardFor = (id:number)=>snapshot.cards.find(c=>c.number === id)!;
  const eligible = state.owned.filter(id=>!state.pasted.includes(id));
  const chosenGive = eligible.includes(give) ? give : (eligible[0] ?? 0);
  const chosenReceive = state.partner.includes(receive) ? receive : state.partner[0];
  return <section className={styles.trades}>
    <header className={styles.tradeHeading}><p className={styles.eyebrow}>LE COIN DES COLLECTIONNEURS</p><h2>Une carte contre une histoire.</h2><p>Teste une proposition à <strong>Collectionneur démo</strong>, un partenaire fictif. Aucun message n’est envoyé à un joueur.</p></header>
    <div className={styles.tradeSteps}><span>01 · Choisir</span><span>02 · Proposer & réserver</span><span>03 · Accepter ou refuser</span></div>
    {state.pending ? <div className={styles.pending}>
      <h3>Proposition en attente · partenaire fictif</h3><p>Ta carte est réservée jusqu’à l’acceptation, au refus ou à l’annulation.</p>
      <div className={styles.exchangeCards}><div><p>TU ENVOIES</p><CollectorCardFace card={cardFor(state.pending.give)} season={snapshot.sourceSeason} /></div><span aria-hidden="true">⇄</span><div><p>TU REÇOIS</p><CollectorCardFace card={cardFor(state.pending.receive)} season={snapshot.sourceSeason} /></div></div>
      <div className={styles.tradeActions}><button type="button" className={styles.primaryButton} onClick={()=>onAction({type:"accept"},"Échange de démonstration accepté. Les deux cartes ont été transférées ensemble.")}>Simuler l’acceptation</button><button type="button" className={styles.secondaryButton} onClick={()=>onAction({type:"decline"},"Le partenaire fictif a refusé. Ta carte est de nouveau disponible.")}>Simuler le refus</button><button type="button" className={styles.textButton} onClick={()=>onAction({type:"cancel"},"Proposition annulée. Aucune carte n’a changé de main.")}>Annuler ma proposition</button></div>
    </div> : <div className={styles.tradeComposer}>
      <div className={styles.exchangeCards}><div><label htmlFor="album-give">TA CARTE NON COLLÉE</label><select id="album-give" value={chosenGive} onChange={e=>setGive(Number(e.target.value))} disabled={!eligible.length}><option value={0} disabled>{eligible.length ? "Choisir une carte" : "Aucune carte disponible"}</option>{eligible.map(id=><option key={id} value={id}>{cardFor(id).name} · {CARD_RARITY_LABELS[getCardRarity(cardFor(id).rank)]}</option>)}</select>{chosenGive ? <CollectorCardFace card={cardFor(chosenGive)} season={snapshot.sourceSeason} /> : <div className={styles.tradeEmpty}>Tes cartes sont collées dans l’album. Décolle-en une pour essayer l’échange.</div>}</div><span aria-hidden="true">⇄</span><div><label htmlFor="album-receive">CARTE DU PARTENAIRE FICTIF</label><select id="album-receive" value={chosenReceive} onChange={e=>setReceive(Number(e.target.value))}>{state.partner.map(id=><option key={id} value={id}>{cardFor(id).name} · {CARD_RARITY_LABELS[getCardRarity(cardFor(id).rank)]}</option>)}</select><CollectorCardFace card={cardFor(chosenReceive)} season={snapshot.sourceSeason} /></div></div>
      <div className={styles.tradeConsent}><p>Une carte non collée contre une autre, sans argent. Si tu échanges ton unique exemplaire, tu ne le possèdes plus. Les cartes déjà collées ne peuvent pas être proposées.</p>{chosenGive && getCardRarity(cardFor(chosenGive).rank) !== getCardRarity(cardFor(chosenReceive).rank) ? <p className={styles.warning}>Les finitions sont différentes : vérifie que cet échange te convient.</p> : null}<button type="button" className={styles.primaryButton} disabled={!ready || !chosenGive} onClick={()=>onAction({type:"propose",give:chosenGive,receive:chosenReceive},"Proposition créée pour le partenaire fictif. Ta carte est réservée, pas encore échangée.")}>Proposer cet échange de démonstration</button></div>
    </div>}
    {state.history.length ? <section className={styles.history}><h3>Historique de cet essai</h3><ul>{state.history.map((h,index)=><li key={index}><span>{cardFor(h.give).name} ⇄ {cardFor(h.receive).name}</span><strong>{h.outcome === "accepted" ? "Accepté" : h.outcome === "cancelled" ? "Annulé" : "Refusé"}</strong></li>)}</ul></section> : null}
  </section>;
}
