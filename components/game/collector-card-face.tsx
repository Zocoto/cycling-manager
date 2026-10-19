import Image from "next/image";
import { RiderAvatar } from "./rider-avatar";
import { CARD_RARITY_LABELS, getCardRarity, type CollectorCard } from "@/lib/game/collector-album";
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
