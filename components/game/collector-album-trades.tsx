"use client";

import {useState} from "react";
import {CollectorCardFace} from "./collector-card-face";
import {ALBUM_DEMO_COLLECTORS,CARD_RARITY_LABELS,canOfferAlbumCards,getCollectorCardRarity,getLooseAlbumCardCount,type AlbumPilotAction,type AlbumPilotState,type CollectorAlbumSnapshot} from "@/lib/game/collector-album";
import {getAlbumDuplicateCards,getAlbumTradeMatches,type AlbumTradeMatch} from "@/lib/game/collector-album-trade-discovery";
import styles from "./collector-album.module.css";
import retro from "./collector-album-retro.module.css";
import discovery from "./collector-album-trade-discovery.module.css";

export function CollectorAlbumTradeDesk({state,ready,snapshot,onAction,requestedCard=null,wanted=[],onToggleWanted}:{state:AlbumPilotState;ready:boolean;snapshot:CollectorAlbumSnapshot;onAction:(action:AlbumPilotAction,text:string)=>void;requestedCard?:number|null;wanted?:readonly number[];onToggleWanted?:(number:number)=>void}){
  const initialTarget=snapshot.cards.some(card=>card.number===requestedCard)?requestedCard:null;
  const [open,setOpen]=useState(Boolean(initialTarget));
  const [mode,setMode]=useState<"director"|"card">(initialTarget?"card":"director");
  const [first,setFirst]=useState(initialTarget?String(initialTarget):"");
  const [second,setSecond]=useState("");
  const [give,setGive]=useState<number[]>([0]);
  const cardFor=(number:number)=>snapshot.cards.find(c=>c.number===number)!;
  const label=(number:number)=>`${String(number).padStart(2,"0")} · ${cardFor(number).name} · ${CARD_RARITY_LABELS[getCollectorCardRarity(cardFor(number))]}`;
  const available=[...new Set(state.owned)].filter(id=>getLooseAlbumCardCount(state,id)>0);
  const allWanted=[...new Set(ALBUM_DEMO_COLLECTORS.flatMap(p=>state.partners[p.id]))].sort((a,b)=>a-b);
  const partnerId=mode==="director"?first:second;
  const receive=Number(mode==="director"?second:first);
  const partner=ALBUM_DEMO_COLLECTORS.find(p=>p.id===partnerId);
  const partnerOptions=mode==="card"?ALBUM_DEMO_COLLECTORS.filter(p=>state.partners[p.id].includes(Number(first))):ALBUM_DEMO_COLLECTORS;
  const partnerStock=partner? [...new Set(state.partners[partner.id])]:[];
  const valid=ready&&!state.pending&&Boolean(partner)&&canOfferAlbumCards(state,{give,receive,partnerId},snapshot.cards);
  const offer=state.pending;
  const chosen=offer?ALBUM_DEMO_COLLECTORS.find(p=>p.id===offer.partnerId):null;
  const finish=(type:"accept"|"decline"|"cancel")=>{onAction({type},type==="accept"?"Échange de démonstration accepté : toutes les cartes ont été transférées ensemble.":"Offre close : les cartes réservées sont de nouveau disponibles.");setOpen(false);setGive([0]);};
  const missingCards=snapshot.cards.filter(card=>!state.owned.includes(card.number));
  const wantedSet=new Set(wanted);
  const wantedCards=missingCards.filter(card=>wantedSet.has(card.number));
  const duplicates=getAlbumDuplicateCards(state);
  const allMatches=getAlbumTradeMatches(state,snapshot.cards,wanted);
  const selectedSearch=open&&mode==="card"&&cardFor(Number(first));
  const matches=(selectedSearch?allMatches.filter(match=>match.receive===selectedSearch.number):allMatches).slice(0,4);
  const searchFor=(number:number)=>{setOpen(true);setMode("card");setFirst(String(number));setSecond("");setGive([0]);};
  const composeMatch=(match:AlbumTradeMatch)=>{searchFor(match.receive);setSecond(match.partnerId);setGive([match.give]);};

  return <section className={styles.trades}>
    <header className={styles.tradeHeading}><p className={styles.eyebrow}>LE COIN DES COLLECTIONNEURS</p><h2>Trois vignettes pour la perle rare.</h2><p>Pars d’un DS ou d’une carte recherchée, puis propose un à trois exemplaires contre une carte. Les cartes collées restent protégées.</p></header>
    <p className={retro.testBanner}>Aperçu privé : les trois collectionneurs sont fictifs. Le courrier est simulé ici ; aucun message ni e-mail n’est envoyé à un vrai joueur.</p>
    <div className={styles.tradeSteps}><span>01 · Trouver</span><span>02 · Composer</span><span>03 · Proposer & réserver</span><span>04 · Accepter ou refuser</span></div>
    {!offer?<section className={discovery.discovery} aria-label="Trouver mes cartes manquantes">
      <h3>La prochaine vignette est peut-être ici.</h3>
      <p>Les suggestions croisent tes manquantes avec les collections fictives de cet essai. Seuls tes doublons libres sont suggérés : tu conserves toujours un exemplaire de chaque carte.</p>
      <h4>MES RECHERCHES · {wantedCards.length}</h4>
      {wantedCards.length?<ul className={discovery.chips}>{wantedCards.map(card=><li key={card.number}>
        <button type="button" disabled={!ready} onClick={()=>searchFor(card.number)} aria-label={`Chercher ${card.name}`}><span className={discovery.number}>N°{String(card.number).padStart(2,"0")}</span>{card.name}</button>
        {onToggleWanted?<button type="button" disabled={!ready} aria-label={`Ne plus rechercher ${card.name}`} onClick={()=>onToggleWanted(card.number)}>×</button>:null}
      </li>)}</ul>:<p>Repère une vignette manquante et ajoute-la à tes recherches pour la retrouver facilement.</p>}
      <details className={discovery.missing}>
        <summary>Toutes mes cartes manquantes · {missingCards.length}</summary>
        {missingCards.length?<ul className={discovery.missingList}>{missingCards.map(card=><li key={card.number}>
          <strong><span className={discovery.number}>N°{String(card.number).padStart(2,"0")}</span>{card.name}</strong>
          <span className={discovery.cardActions}>
            {onToggleWanted?<button type="button" disabled={!ready} aria-pressed={wantedSet.has(card.number)} aria-label={`${wantedSet.has(card.number)?"Ne plus rechercher":"Rechercher"} ${card.name}`} onClick={()=>onToggleWanted(card.number)}>{wantedSet.has(card.number)?"Recherchée ✓":"Je la cherche"}</button>:null}
            <button type="button" disabled={!ready} onClick={()=>searchFor(card.number)} aria-label={`Trouver un échange pour ${card.name}`}>Trouver un échange</button>
          </span>
        </li>)}</ul>:<p>Toutes les vignettes sont dans ta collection. Il ne reste qu’à les coller !</p>}
      </details>
      <h4>LES RENCONTRES POSSIBLES · DÉMONSTRATION</h4>
      {selectedSearch?<p className={discovery.selected}>Recherche en cours : N°{String(selectedSearch.number).padStart(2,"0")} · {selectedSearch.name}</p>:null}
      {matches.length?<ul className={discovery.matches}>{matches.map(match=><li className={discovery.match} key={`${match.partnerId}-${match.receive}`}>
        <span>{match.reciprocal?"Correspondance réciproque":"Un doublon pour avancer"} · démo</span>
        <h4>{cardFor(match.receive).name}</h4>
        <p>{ALBUM_DEMO_COLLECTORS.find(collector=>collector.id===match.partnerId)?.name} possède cette vignette qui te manque.</p>
        <p>Tu peux proposer ton doublon de <strong>{cardFor(match.give).name}</strong>{match.reciprocal?", absent de sa collection fictive.":"."}</p>
        <button type="button" disabled={!ready} onClick={()=>composeMatch(match)}>Préparer cette proposition</button>
      </li>)}</ul>:<p>{!duplicates.length?"Pas encore de doublon libre à suggérer. Tes exemplaires uniques, collés ou réservés ne sont pas proposés automatiquement.":selectedSearch?"Aucune correspondance avec tes doublons pour cette vignette dans l’essai actuel. Tu peux consulter les collections fictives ci-dessous.":"Aucune correspondance pour l’instant dans les collections fictives de cet essai."}</p>}
      <small>Préparer une proposition ne réserve aucune carte. L’envoi et l’acceptation restent deux actions distinctes et explicites.</small>
    </section>:null}
    {!offer&&!open?<button className={styles.primaryButton} type="button" disabled={!ready||!available.length} onClick={()=>setOpen(true)}>Préparer un échange</button>:null}
    {!available.length&&!offer?<p className={styles.emptyWallet}>Aucune carte non collée disponible. Ouvre un sachet ou décolle une carte pour ce test.</p>:null}
    {offer?<div className={styles.pending}>
      <h3>Offre réservée · {chosen?.name}</h3><p>{offer.give.length} carte(s) contre une. Aucun transfert avant acceptation.</p>
      <div className={retro.multiTradeLayout}><div><h4>TU PROPOSES</h4><ul className={retro.offerList}>{offer.give.map((id,index)=><li key={index}><span>{label(id)}</span></li>)}</ul><p>Ces exemplaires ne peuvent plus être collés ni engagés dans une autre offre.</p></div><div><h4>TU DEMANDES</h4><CollectorCardFace card={cardFor(offer.receive)} season={snapshot.sourceSeason}/></div></div>
      <details className={retro.mailPreview}><summary>Voir le courrier simulé du destinataire</summary><div><strong>À : {chosen?.name}</strong><p>Objet : une proposition pour ta collection · Édition S{snapshot.sourceSeason}</p><p>Abbaye du Lion te propose : {offer.give.map(id=>cardFor(id).name).join(" + ")}.</p><p>En échange de : {cardFor(offer.receive).name}.</p><p>Cartes issues de la saison {snapshot.sourceSeason}. Tu peux accepter ou refuser cette proposition depuis l’album. Aucun transfert sans ton accord.</p><small>Simulation locale : ce courrier n’a pas été envoyé.</small></div></details>
      <div className={styles.tradeActions}><button type="button" className={styles.primaryButton} onClick={()=>finish("accept")}>Simuler l’acceptation</button><button type="button" className={styles.secondaryButton} onClick={()=>finish("decline")}>Simuler le refus</button><button type="button" className={styles.textButton} onClick={()=>finish("cancel")}>Annuler ma proposition</button></div>
    </div>:open?<section className={retro.tradeWindow} aria-label="Composer un échange" data-album-trade-composer="" tabIndex={-1}>
      <div className={retro.searchModes}><button type="button" aria-pressed={mode==="director"} onClick={()=>{setMode("director");setFirst("");setSecond("");}}>Chercher un DS</button><button type="button" aria-pressed={mode==="card"} onClick={()=>{setMode("card");setFirst("");setSecond("");}}>Chercher une carte</button></div>
      <div className={retro.searchFields}>
        <label>{mode==="director"?"Le DS recherché":"La carte recherchée"}<select aria-label={mode==="director"?"Le DS recherché":"La carte recherchée"} value={first} onChange={e=>{setFirst(e.target.value);setSecond("");}}><option value="">Choisir…</option>{mode==="director"?ALBUM_DEMO_COLLECTORS.map(p=><option key={p.id} value={p.id}>{p.name}</option>):[...new Set([...allWanted,...missingCards.map(card=>card.number),...(initialTarget?[initialTarget]:[])])].sort((a,b)=>a-b).map(id=><option key={id} value={id}>{label(id)}</option>)}</select></label>
        <label>{mode==="director"?"Ses cartes disponibles":"Les DS qui possèdent cette carte"}<select aria-label={mode==="director"?"Ses cartes disponibles":"Les DS qui possèdent cette carte"} value={second} disabled={!first} onChange={e=>setSecond(e.target.value)}><option value="">Choisir…</option>{mode==="director"?partnerStock.map(id=><option key={id} value={id}>{label(id)}</option>):partnerOptions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      </div>
      {mode==="card"&&first&&!partnerOptions.length?<p className={discovery.selected}>Aucun des collectionneurs fictifs ne possède cette carte pour le moment. Tu peux l’ajouter à tes recherches.</p>:null}
      <div className={retro.multiTradeLayout}><div><h4>TES CARTES EN ÉCHANGE · 1 À 3</h4><p>Un exemplaire collé n’est jamais échangeable. Les suggestions utilisent tes doublons ; dans cette composition manuelle, tu peux aussi choisir un exemplaire unique non collé.</p>
        {give.map((id,index)=><div className={retro.offerRow} key={index}><label>Carte proposée {index+1}<select aria-label={`Carte proposée ${index+1}`} value={id} onChange={e=>setGive(give.map((n,i)=>i===index?Number(e.target.value):n))}><option value={0}>Choisir une carte…</option>{available.map(number=><option key={number} value={number} disabled={number===receive||give.filter((n,i)=>i!==index&&n===number).length>=getLooseAlbumCardCount(state,number)}>{label(number)} · {getLooseAlbumCardCount(state,number)} libre(s)</option>)}</select></label>{give.length>1?<button type="button" aria-label={`Retirer la carte proposée ${index+1}`} onClick={()=>setGive(give.filter((_,i)=>i!==index))}>×</button>:null}</div>)}
        {give.length<3?<button type="button" className={styles.textButton} onClick={()=>setGive([...give,0])}>+ Ajouter une carte à l’offre</button>:null}
      </div><div><h4>LA CARTE DEMANDÉE</h4>{receive&&partner&&state.partners[partner.id].includes(receive)?<CollectorCardFace key={receive} card={cardFor(receive)} season={snapshot.sourceSeason}/>:<div className={styles.tradeEmpty}>Choisis un DS et une carte pour composer ta proposition.</div>}</div></div>
      <div className={styles.tradeConsent}>{valid?<p>Tu proposes {give.length} carte(s) à {partner?.name} contre {cardFor(receive).name}. Elles seront réservées jusqu’à l’acceptation, au refus ou à l’annulation.</p>:<p>Choisis la carte demandée et un à trois exemplaires disponibles de ta collection.</p>}<button type="button" className={styles.primaryButton} disabled={!valid} onClick={()=>onAction({type:"propose",give,receive,partnerId},"Offre de démonstration réservée. Un aperçu du courrier est disponible ; aucun message réel n’a été envoyé.")}>Proposer cet échange de démonstration</button><button type="button" className={styles.textButton} onClick={()=>setOpen(false)}>Fermer sans envoyer</button></div>
    </section>:null}
    {state.history.length?<section className={styles.history}><h3>Historique de cet essai</h3><ul>{state.history.map((h,index)=><li key={index}><span>{h.give.map(id=>cardFor(id).name).join(" + ")} ⇄ {cardFor(h.receive).name}</span><strong>{h.outcome==="accepted"?"Accepté":h.outcome==="cancelled"?"Annulé":"Refusé"}</strong></li>)}</ul></section>:null}
  </section>;
}
