"use client";
import { getLooseAlbumCardCount, type AlbumPilotAction, type AlbumPilotState, type CollectorAlbumSnapshot } from "@/lib/game/collector-album";
import { getAlbumIntroductionLeaves } from "@/lib/game/collector-album-layout";
import { CollectorCardFace } from "./collector-card-face";
import { CycloStickersGamesArtwork } from "./cyclo-stickers-games-artwork";
import styles from "./cyclo-stickers-games.module.css";
import spread from "./collector-album-spread.module.css";
import album from "./collector-album.module.css";
import book from "./collector-album-book.module.css";
import format from "./collector-card-format.module.css";

export function CycloStickersIntroduction({snapshot,state,ready,onAction,leaf=0,singlePage=false,onTurn,previousDisabled=true,nextDisabled=false}:{
  snapshot:CollectorAlbumSnapshot;state:AlbumPilotState;ready:boolean;
  onAction:(action:AlbumPilotAction,text:string)=>void;leaf?:number;singlePage?:boolean;
  onTurn?:(direction:-1|1)=>void;previousDisabled?:boolean;nextDisabled?:boolean;
}) {
  const leaves=getAlbumIntroductionLeaves(snapshot.cards);
  const first=singlePage?leaf:Math.floor(leaf/2)*2;
  const titles=["Les équipes au sommet","Les champions des continents","Les maillots distinctifs","Les souvenirs de la saison"];
  return <>
    <div className={book.pageEdges}><button type="button" aria-label="Feuille précédente" disabled={previousDisabled} onClick={()=>onTurn?.(-1)}>← Feuille précédente</button><span>Édition S{snapshot.presentationSeason??snapshot.sourceSeason} · Pages d’ouverture · {first+1}{singlePage?"":`–${first+2}`} / 4</span><button type="button" aria-label="Feuille suivante" disabled={nextDisabled} onClick={()=>onTurn?.(1)}>Feuille suivante →</button></div>
    <header className={spread.chapterHeading}>
      <div className={spread.chapterCopy}><p className={spread.publisher}>LA CYCLOGAZETTE · COLLECTION SAISON 4</p><p className={spread.chapterIndex}>LES PAGES D’OUVERTURE</p><h2>Une saison à garder.</h2><p className={spread.subtitle}>Des champions aux nuits du peloton.</p><p className={styles.openingStory}>Les Jeux ont couronné leur champion. Sous la lune, l’Équipier sans tête a laissé sa trace. Retrouve les équipes et les maillots qui ont fait la saison 4, avant de feuilleter les pages des coureurs.</p></div>
      <div className={spread.chapterPostcard}><CycloStickersGamesArtwork/><span>☾ <span>La légende de l’Équipier sans tête</span></span></div>
    </header>
    <p className={styles.sourceNote}>Aperçu privé : identités et notes S3. Les spécimens ne désignent pas les futurs champions S4. Les titres définitifs seront figés après la clôture de S4.</p>
    <div className={spread.leaves}>{leaves.slice(first,first+(singlePage?1:2)).map((cards,index)=><div className={spread.leaf} key={first+index} data-opening-leaf={first+index+1}>
      <div className={spread.leafHeader}><span>{titles[first+index]}</span><span>COLLECTION S4</span></div>
      <div className={`${spread.slots} ${format.grid}`}>{cards.map(card=>{
        const pasted=state.pasted.includes(card.number),available=getLooseAlbumCardCount(state,card.number)>0;
        return <div key={card.id} className={`${spread.slotWrap} ${format.slot}`} data-album-slot={card.number}>
          {pasted?<><CollectorCardFace card={card} season={snapshot.sourceSeason}/><button type="button" className={album.textButton} onClick={()=>onAction({type:"unpaste",card:card.number},"Vignette décollée pour le test.")}>Décoller pour le test</button></>:<div className={`${album.emptySlot} ${spread.emptySlot} ${format.empty}`}>
            <span className={album.slotNumber}>{card.number}</span><span aria-hidden="true">{card.kind==="legend"?"☾":"★"}</span><h3>{card.name}</h3><p>{card.stickerTitle}</p><button type="button" className={album.primaryButton} disabled={!ready||!available} onClick={()=>onAction({type:"paste",card:card.number},"Vignette d’introduction collée dans l’album.")}>{available?"Coller cette carte":"À collectionner"}</button>
          </div>}
        </div>;
      })}</div>
      <div className={spread.folio}><span>CYCLO-STICKERS · SAISON 4</span><strong>{String(first+index+2).padStart(2,"0")}</strong></div>
    </div>)}</div>
    <footer className={spread.bookFooter}><button type="button" aria-label="Pages précédentes" disabled={previousDisabled} onClick={()=>onTurn?.(-1)}>← <span>Pages précédentes</span></button><span>Les souvenirs de S4<small>{state.pasted.filter(number=>number>50).length} / {snapshot.cards.filter(card=>card.kind).length} vignettes collées</small></span><button type="button" aria-label="Pages suivantes" disabled={nextDisabled} onClick={()=>onTurn?.(1)}><span>{first+(singlePage?1:2)>=4?"Les coureurs":"Pages suivantes"}</span> →</button></footer>
  </>;
}
