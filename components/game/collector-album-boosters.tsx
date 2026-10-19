"use client";

import { useState } from "react";
import { AlbumBoosterArtwork } from "./collector-album-artwork";
import { CollectorCardFace } from "./collector-card-face";
import { ALBUM_BOOSTER_ODDS, CARD_RARITY_LABELS, drawAlbumBooster, getAlbumPilotPacks, getCardRarity, type AlbumPilotAction, type AlbumPilotState, type CollectorAlbumSnapshot } from "@/lib/game/collector-album";
import styles from "./collector-album-retro.module.css";

export function CollectorAlbumBoosters({state,snapshot,ready,onAction,onViewAlbum}: {state:AlbumPilotState;snapshot:CollectorAlbumSnapshot;ready:boolean;onAction:(action:AlbumPilotAction,text:string)=>void;onViewAlbum:()=>void}) {
  const [selectedPack,setSelectedPack]=useState<string | null>(null);
  const [error,setError]=useState("");
  const closed=getAlbumPilotPacks(snapshot.collectionSeason).filter(p=>!state.openedPacks.some(open=>open.id === p.id));
  const revealed=state.openedPacks.find(p=>p.id === selectedPack) ?? state.openedPacks.at(-1);
  const openPack=(id:string)=>{
    if(!ready || !closed.some(p=>p.id===id)) return;
    try{
      const entropy=new Uint32Array(4);
      window.crypto.getRandomValues(entropy);
      const cards=drawAlbumBooster(snapshot.cards,Array.from(entropy,n=>n/4294967296));
      onAction({type:"open-pack",id,season:snapshot.collectionSeason,cards},"Sachet de démonstration ouvert : deux cartes ont rejoint ta collection.");
      setSelectedPack(id);
      setError("");
    }catch{setError("Impossible d’ouvrir le sachet dans ce navigateur. Il n’a pas été consommé.");}
  };
  return <section className={styles.boosterDesk} aria-label="Les sachets de cartes">
    <header className={styles.sectionHeading}><p>LE KIOSQUE DU COLLECTIONNEUR · SAISON {snapshot.collectionSeason}</p><h2>Le plaisir du petit sachet.</h2><span>Le papier qui craque, deux vignettes et peut-être une belle surprise. Chaque sachet appartient à une saison précise.</span></header>
    <div className={styles.packShelf}>{closed.length ? closed.map((pack,index)=><div className={styles.packOffer} key={pack.id}><button type="button" disabled={!ready} className={styles.openPackButton} onClick={()=>openPack(pack.id)} aria-label={`Ouvrir le sachet de test ${index+1}, saison ${pack.season}`}><AlbumBoosterArtwork season={pack.season} /><span>Déchirer le sachet <span aria-hidden="true">↗</span></span></button><p>Sachet d’essai · 2 cartes</p></div>) : <p className={styles.allOpened}>Tes deux sachets d’essai sont ouverts. Tes cartes restent dans cet album ; tu peux réinitialiser la démonstration en bas de page.</p>}</div>
    {error ? <p role="alert" className={styles.testBanner}>{error}</p> : null}
    {revealed ? <section className={styles.reveal} aria-label="Cartes du sachet ouvert"><header><p>LE SACHET EST OUVERT</p><h3>Voici tes deux vignettes.</h3><span>Colle les nouvelles dans l’album. Garde les doublons pour les échanges.</span></header><div className={styles.revealedCards}>{revealed.cards.map((id,index)=>{const card=snapshot.cards.find(c=>c.number===id)!;const quantity=state.owned.filter(n=>n===id).length;return <div key={`${revealed.id}-${index}`}><CollectorCardFace card={card} season={snapshot.sourceSeason} /><p>{quantity > 1 ? `${quantity} exemplaires possédés · doublon possible` : "À retrouver parmi tes cartes à coller"}</p></div>;})}</div>{state.openedPacks.length>1 ? <div className={styles.openedHistory}>{state.openedPacks.map((pack,index)=><button type="button" key={pack.id} aria-pressed={revealed.id===pack.id} onClick={()=>setSelectedPack(pack.id)}>Revoir le sachet {index+1}</button>)}</div> : null}<button className={styles.returnToAlbum} type="button" onClick={onViewAlbum}>Ranger et coller dans l’album →</button></section> : null}
    <details className={styles.odds}><summary>Les chances, sans mystère</summary><p>Deux tirages indépendants par sachet. Les doublons sont possibles, y compris dans un même sachet. Chaque carte d’une même finition a la même chance.</p><dl>{(["bronze","silver","gold"] as const).map(rarity=>{const count=snapshot.cards.filter(c=>getCardRarity(c.rank)===rarity).length;return <div key={rarity}><dt>{CARD_RARITY_LABELS[rarity]}</dt><dd>{ALBUM_BOOSTER_ODDS[rarity]} % <small>soit {(ALBUM_BOOSTER_ODDS[rarity]/count).toLocaleString("fr-FR",{maximumFractionDigits:2})} % par carte de cette finition</small></dd></div>;})}</dl></details>
    <p className={styles.testBanner}>Deux sachets de démonstration, sans achat. Aucun tirage quotidien ni distribution dans la Gazette n’est activé. Les futures distributions resteront réservées à la Gazette.</p>
  </section>;
}
