"use client";

import {useState} from "react";
import {CollectorCardFace} from "./collector-card-face";
import {ALBUM_DEMO_COLLECTORS,CARD_RARITY_LABELS,canOfferAlbumCards,getCardRarity,getLooseAlbumCardCount,type AlbumPilotAction,type AlbumPilotState,type CollectorAlbumSnapshot} from "@/lib/game/collector-album";
import styles from "./collector-album.module.css";
import retro from "./collector-album-retro.module.css";

export function CollectorAlbumTradeDesk({state,ready,snapshot,onAction}:{state:AlbumPilotState;ready:boolean;snapshot:CollectorAlbumSnapshot;onAction:(action:AlbumPilotAction,text:string)=>void}){
  const [open,setOpen]=useState(false);
  const [mode,setMode]=useState<"director"|"card">("director");
  const [first,setFirst]=useState("");
  const [second,setSecond]=useState("");
  const [give,setGive]=useState<number[]>([0]);
  const cardFor=(number:number)=>snapshot.cards.find(c=>c.number===number)!;
  const label=(number:number)=>`${String(number).padStart(2,"0")} · ${cardFor(number).name} · ${CARD_RARITY_LABELS[getCardRarity(cardFor(number).rank)]}`;
  const available=[...new Set(state.owned)].filter(id=>getLooseAlbumCardCount(state,id)>0);
  const allWanted=[...new Set(ALBUM_DEMO_COLLECTORS.flatMap(p=>state.partners[p.id]))].sort((a,b)=>a-b);
  const partnerId=mode==="director"?first:second;
  const receive=Number(mode==="director"?second:first);
  const partner=ALBUM_DEMO_COLLECTORS.find(p=>p.id===partnerId);
  const partnerOptions=mode==="card"?ALBUM_DEMO_COLLECTORS.filter(p=>state.partners[p.id].includes(Number(first))):ALBUM_DEMO_COLLECTORS;
  const wanted=partner? [...new Set(state.partners[partner.id])]:[];
  const valid=ready&&!state.pending&&Boolean(partner)&&canOfferAlbumCards(state,{give,receive,partnerId});
  const offer=state.pending;
  const chosen=offer?ALBUM_DEMO_COLLECTORS.find(p=>p.id===offer.partnerId):null;
  const finish=(type:"accept"|"decline"|"cancel")=>{onAction({type},type==="accept"?"Échange de démonstration accepté : toutes les cartes ont été transférées ensemble.":"Offre close : les cartes réservées sont de nouveau disponibles.");setOpen(false);setGive([0]);};

  return <section className={styles.trades}>
    <header className={styles.tradeHeading}><p className={styles.eyebrow}>LE COIN DES COLLECTIONNEURS</p><h2>Trois vignettes pour la perle rare.</h2><p>Pars d’un DS ou d’une carte recherchée, puis propose un à trois exemplaires contre une carte. Les cartes collées restent protégées.</p></header>
    <p className={retro.testBanner}>Aperçu privé : les trois collectionneurs sont fictifs. Le courrier est simulé ici ; aucun message ni e-mail n’est envoyé à un vrai joueur.</p>
    <div className={styles.tradeSteps}><span>01 · Trouver</span><span>02 · Composer</span><span>03 · Proposer & réserver</span><span>04 · Accepter ou refuser</span></div>
    {!offer&&!open?<button className={styles.primaryButton} type="button" disabled={!ready||!available.length} onClick={()=>setOpen(true)}>Préparer un échange</button>:null}
    {!available.length&&!offer?<p className={styles.emptyWallet}>Aucune carte non collée disponible. Ouvre un sachet ou décolle une carte pour ce test.</p>:null}
    {offer?<div className={styles.pending}>
      <h3>Offre réservée · {chosen?.name}</h3><p>{offer.give.length} carte(s) contre une. Aucun transfert avant acceptation.</p>
      <div className={retro.multiTradeLayout}><div><h4>TU PROPOSES</h4><ul className={retro.offerList}>{offer.give.map((id,index)=><li key={index}><span>{label(id)}</span></li>)}</ul><p>Ces exemplaires ne peuvent plus être collés ni engagés dans une autre offre.</p></div><div><h4>TU DEMANDES</h4><CollectorCardFace card={cardFor(offer.receive)} season={snapshot.sourceSeason}/></div></div>
      <details className={retro.mailPreview}><summary>Voir le courrier simulé du destinataire</summary><div><strong>À : {chosen?.name}</strong><p>Objet : une proposition pour ta collection · Édition S{snapshot.sourceSeason}</p><p>Abbaye du Lion te propose : {offer.give.map(id=>cardFor(id).name).join(" + ")}.</p><p>En échange de : {cardFor(offer.receive).name}.</p><p>Cartes issues de la saison {snapshot.sourceSeason}. Tu peux accepter ou refuser cette proposition depuis l’album. Aucun transfert sans ton accord.</p><small>Simulation locale : ce courrier n’a pas été envoyé.</small></div></details>
      <div className={styles.tradeActions}><button type="button" className={styles.primaryButton} onClick={()=>finish("accept")}>Simuler l’acceptation</button><button type="button" className={styles.secondaryButton} onClick={()=>finish("decline")}>Simuler le refus</button><button type="button" className={styles.textButton} onClick={()=>finish("cancel")}>Annuler ma proposition</button></div>
    </div>:open?<section className={retro.tradeWindow} aria-label="Composer un échange">
      <div className={retro.searchModes}><button type="button" aria-pressed={mode==="director"} onClick={()=>{setMode("director");setFirst("");setSecond("");}}>Chercher un DS</button><button type="button" aria-pressed={mode==="card"} onClick={()=>{setMode("card");setFirst("");setSecond("");}}>Chercher une carte</button></div>
      <div className={retro.searchFields}>
        <label>{mode==="director"?"Le DS recherché":"La carte recherchée"}<select aria-label={mode==="director"?"Le DS recherché":"La carte recherchée"} value={first} onChange={e=>{setFirst(e.target.value);setSecond("");}}><option value="">Choisir…</option>{mode==="director"?ALBUM_DEMO_COLLECTORS.map(p=><option key={p.id} value={p.id}>{p.name}</option>):allWanted.map(id=><option key={id} value={id}>{label(id)}</option>)}</select></label>
        <label>{mode==="director"?"Ses cartes disponibles":"Les DS qui possèdent cette carte"}<select aria-label={mode==="director"?"Ses cartes disponibles":"Les DS qui possèdent cette carte"} value={second} disabled={!first} onChange={e=>setSecond(e.target.value)}><option value="">Choisir…</option>{mode==="director"?wanted.map(id=><option key={id} value={id}>{label(id)}</option>):partnerOptions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      </div>
      <div className={retro.multiTradeLayout}><div><h4>TES CARTES EN ÉCHANGE · 1 À 3</h4><p>Un exemplaire collé n’est jamais échangeable. Un doublon non collé peut l’être.</p>
        {give.map((id,index)=><div className={retro.offerRow} key={index}><label>Carte proposée {index+1}<select aria-label={`Carte proposée ${index+1}`} value={id} onChange={e=>setGive(give.map((n,i)=>i===index?Number(e.target.value):n))}><option value={0}>Choisir une carte…</option>{available.map(number=><option key={number} value={number} disabled={number===receive||give.filter((n,i)=>i!==index&&n===number).length>=getLooseAlbumCardCount(state,number)}>{label(number)} · {getLooseAlbumCardCount(state,number)} libre(s)</option>)}</select></label>{give.length>1?<button type="button" aria-label={`Retirer la carte proposée ${index+1}`} onClick={()=>setGive(give.filter((_,i)=>i!==index))}>×</button>:null}</div>)}
        {give.length<3?<button type="button" className={styles.textButton} onClick={()=>setGive([...give,0])}>+ Ajouter une carte à l’offre</button>:null}
      </div><div><h4>LA CARTE DEMANDÉE</h4>{receive&&partner&&state.partners[partner.id].includes(receive)?<CollectorCardFace key={receive} card={cardFor(receive)} season={snapshot.sourceSeason}/>:<div className={styles.tradeEmpty}>Choisis un DS et une carte pour composer ta proposition.</div>}</div></div>
      <div className={styles.tradeConsent}>{valid?<p>Tu proposes {give.length} carte(s) à {partner?.name} contre {cardFor(receive).name}. Elles seront réservées jusqu’à l’acceptation, au refus ou à l’annulation.</p>:<p>Choisis la carte demandée et un à trois exemplaires disponibles de ta collection.</p>}<button type="button" className={styles.primaryButton} disabled={!valid} onClick={()=>onAction({type:"propose",give,receive,partnerId},"Offre de démonstration réservée. Un aperçu du courrier est disponible ; aucun message réel n’a été envoyé.")}>Proposer cet échange de démonstration</button><button type="button" className={styles.textButton} onClick={()=>setOpen(false)}>Fermer sans envoyer</button></div>
    </section>:null}
    {state.history.length?<section className={styles.history}><h3>Historique de cet essai</h3><ul>{state.history.map((h,index)=><li key={index}><span>{h.give.map(id=>cardFor(id).name).join(" + ")} ⇄ {cardFor(h.receive).name}</span><strong>{h.outcome==="accepted"?"Accepté":h.outcome==="cancelled"?"Annulé":"Refusé"}</strong></li>)}</ul></section>:null}
  </section>;
}
