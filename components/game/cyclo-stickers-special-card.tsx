import Image from "next/image";
import { RiderAvatar } from "./rider-avatar";
import { CARD_RARITY_LABELS, getCollectorCardRarity, type CollectorCard } from "@/lib/game/collector-album";
import { HalloweenHeadlessRider } from "@/components/halloween/halloween-night-ride";
import styles from "./cyclo-stickers-games.module.css";
import format from "./collector-card-format.module.css";

export function CycloStickersSpecialCard({card,season}:{card:CollectorCard;season:number}) {
  const legend=card.kind==="legend";
  return <article data-album-card className={`${styles.sticker} ${format.card} ${card.kind==="games"||legend?styles.holographic:""} ${legend?styles.headlessSticker:""}`} data-intro-sticker={card.number} data-sticker-kind={card.kind} aria-label={`${card.stickerTitle} · ${card.name}`}>
    <header><span>CS / {card.number}</span><span>{card.kind==="games"?"Jeux":legend?"Légende":CARD_RARITY_LABELS[getCollectorCardRarity(card)]}</span></header>
    <div className={styles.specialPortrait}>
      {legend?<HalloweenHeadlessRider/>:card.kind==="team" ? <>{card.jersey.imagePath?<Image src={card.jersey.imagePath} width={180} height={180} sizes="180px" alt={`Maillot de ${card.name}, saison ${season}`} className={styles.teamJersey}/>:null}<span className={styles.teamWatermark}>TOP<br/>05</span></> : <RiderAvatar profileKey={card.avatarProfileKey} seed={card.avatarSeed} riderId={card.id} age={card.age} jersey={card.jersey} presentation="jersey" className={styles.championAvatar} label={card.specimen?"Spécimen avec le maillot distinctif":`Portrait de ${card.name} avec son maillot distinctif`}/>}
      {card.kind==="games"?<span className={styles.prismSeal} aria-hidden="true">✦<small>ÉPREUVE<br/>EN LIGNE</small></span>:null}
    </div>
    <div className={styles.specialIdentity}><p className={styles.specialTitle}>{card.stickerTitle}</p><h3>{card.name}</h3>{legend?<p>Halloween · Saison 4</p>:null}</div>
    {card.kind!=="team"&&!legend&&!card.specimen?<dl className={styles.championStats}>{([["mountain","MO"],["hills","VAL"],["flat","PLA"],["timeTrial","CLM"],["cobbles","PAV"],["sprint","SPR"]] as const).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{card.ratings[key]}</dd></div>)}</dl>:null}
    <footer>{legend?"Souvenir de la saison 4":card.specimen?"Spécimen · titre S4 à figer":`Palmarès S${season} · données de test`}</footer>
  </article>;
}
