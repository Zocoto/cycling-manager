import Image from "next/image";
import { RiderAvatar } from "./rider-avatar";
import { CARD_RARITY_LABELS, getCollectorCardRarity, type CollectorCard } from "@/lib/game/collector-album";
import styles from "./cyclo-stickers-games.module.css";

export function CycloStickersSpecialCard({card,season}:{card:CollectorCard;season:number}) {
  return <article className={`${styles.sticker} ${card.kind==="games"?styles.holographic:""}`} data-intro-sticker={card.number} data-sticker-kind={card.kind} aria-label={`${card.stickerTitle} · ${card.name}`}>
    <header><span>CS / {card.number}</span><span>{CARD_RARITY_LABELS[getCollectorCardRarity(card)]}</span></header>
    <div className={styles.specialPortrait}>
      {card.kind==="team" ? <>{card.jersey.imagePath?<Image src={card.jersey.imagePath} width={180} height={180} sizes="180px" alt={`Maillot de ${card.name}, saison ${season}`} className={styles.teamJersey}/>:null}<span className={styles.teamWatermark}>TOP<br/>05</span></> : <RiderAvatar profileKey={card.avatarProfileKey} seed={card.avatarSeed} riderId={card.id} age={card.age} jersey={card.jersey} presentation="jersey" className={styles.championAvatar} label={card.specimen?"Spécimen avec le maillot distinctif":`Portrait de ${card.name} avec son maillot distinctif`}/>}
      {card.kind==="games"?<span className={styles.prismSeal} aria-hidden="true">✦<small>ÉPREUVE<br/>EN LIGNE</small></span>:null}
    </div>
    <p className={styles.specialTitle}>{card.stickerTitle}</p><h3>{card.name}</h3>
    {card.kind!=="team"&&!card.specimen?<dl className={styles.championStats}>{([["mountain","MO"],["hills","VAL"],["flat","PLA"],["timeTrial","CLM"],["cobbles","PAV"],["sprint","SPR"]] as const).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{card.ratings[key]}</dd></div>)}</dl>:null}
    <footer>{card.specimen?"Spécimen · titre S4 à figer":`Palmarès S${season} · données de test`}</footer>
  </article>;
}
