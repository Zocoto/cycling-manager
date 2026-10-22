"use client";
import { getLooseAlbumCardCount, type AlbumPilotAction, type AlbumPilotState, type CollectorAlbumSnapshot } from "@/lib/game/collector-album";
import { CycloStickersSpecialCard } from "./cyclo-stickers-special-card";
import styles from "./cyclo-stickers-games.module.css";

export function CycloStickersIntroduction({snapshot,state,ready,onAction}:{snapshot:CollectorAlbumSnapshot;state:AlbumPilotState;ready:boolean;onAction:(action:AlbumPilotAction,text:string)=>void}) {
  const extras=snapshot.cards.filter(card=>card.kind);
  return <section className={styles.introduction} aria-label="Les grandes figures de la saison">
    <header className={styles.introHeading}><p>LES PAGES D’OUVERTURE · ÉDITION S4</p><h2>La saison de tous les champions.</h2><span>Les équipes, les maillots et la vignette qui fait briller l’album. {extras.filter(card=>state.pasted.includes(card.number)).length} / {extras.length} stickers d’introduction collés.</span></header>
    <p className={styles.sourceNote}>Aperçu privé : identités et notes S3. Les spécimens ne désignent pas les futurs champions S4. Les titres définitifs seront figés après la clôture de S4.</p>
    {(["team","continental","world","games"] as const).map(kind=><section className={styles.introChapter} key={kind}>
      <h3>{kind==="team"?"Les cinq équipes au sommet":kind==="continental"?"Les champions des cinq continents":kind==="world"?"Les maillots arc-en-ciel":"Le champion des Jeux"}</h3>
      <div className={`${styles.stickerGrid} ${kind==="games"?styles.gamesGrid:""}`}>{extras.filter(card=>card.kind===kind).map(card=>{
        const pasted=state.pasted.includes(card.number);
        const available=getLooseAlbumCardCount(state,card.number)>0;
        return <div key={card.id} className={pasted?styles.pasted:styles.unpasted}>
          <CycloStickersSpecialCard card={card} season={snapshot.sourceSeason}/>
          <button type="button" disabled={!ready||(!pasted&&!available)} aria-pressed={pasted} onClick={()=>onAction(pasted?{type:"unpaste",card:card.number}:{type:"paste",card:card.number},pasted?"Vignette décollée pour le test.":"Vignette d’introduction collée dans l’album.")}>{pasted?"Décoller pour le test":available?"Coller ce sticker":"À collectionner"}</button>
        </div>;
      })}</div>
    </section>)}
  </section>;
}
