"use client";

import Image from "next/image";
import { useState } from "react";
import { RiderAvatar } from "./rider-avatar";
import { SvgCountryFlag } from "./svg-country-flag";
import { CARD_RARITY_LABELS, getCardRarity, type CollectorCard, type CollectorHonour } from "@/lib/game/collector-album";
import { createWorldChampionRiderJersey } from "@/lib/rider-jersey";
import styles from "./collector-album.module.css";
import print from "./collector-card-print.module.css";
import { CycloStickersSpecialCard } from "./cyclo-stickers-special-card";
import format from "./collector-card-format.module.css";

const PRIMARY_STATS = [["mountain", "MO"], ["hills", "VAL"], ["flat", "PLA"], ["timeTrial", "CLM"], ["cobbles", "PAV"], ["sprint", "SPR"]] as const;

export function CollectorCardFace({ card, season }: { card: CollectorCard; season: number }) {
  const rarity = getCardRarity(card.rank);
  const [backId,setBackId]=useState<string|null>(null);
  if (card.kind) return <CycloStickersSpecialCard card={card} season={season}/>;
  const back=backId===card.id;
  const worldTitle=card.worldTitles?.includes("road")?"road":card.worldTitles?.includes("time_trial")?"time_trial":null;
  const championJersey=worldTitle?createWorldChampionRiderJersey({championshipType:worldTitle}):card.jersey;
  return <article data-album-card className={`${styles.card} ${styles[rarity]} ${print.sticker} ${format.card} ${worldTitle?print.worldChampion:""}`} aria-label={`${card.name}, carte ${CARD_RARITY_LABELS[rarity]}`}>
    {back ? <CollectorCardBack card={card} season={season} /> : <>
    <div className={`${styles.cardTop} ${print.imprint}`}><span className={print.catalogueNumber}>CS / {String(card.number).padStart(2,"0")}</span><svg className={print.cycleMark} viewBox="0 0 54 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="12" cy="15" r="8"/><circle cx="42" cy="15" r="8"/><path d="m12 15 9-13 8 13H12L25 6h12l5 9M18 2h7m7 0h4l1 4"/></g></svg></div>
    <div data-album-portrait-panel className={`${styles.art} ${print.printedArt}`}>
      <svg className={print.flagBackdrop} viewBox="0 0 280 170" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <SvgCountryFlag countryCode={card.countryCode} x={0} y={0} width={280} height={170} preserveAspectRatio="xMidYMid slice" />
      </svg>
      <svg className={styles.contours} viewBox="0 0 280 160" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1"><path d="M-20 140 40 100 80 110 130 30 170 80 210 45 300 105M-20 152 40 112 80 122 130 42 170 92 210 57 300 117M-20 164 40 124 80 134 130 54 170 104 210 69 300 129M-20 176 40 136 80 146 130 66 170 116 210 81 300 141" /></g></svg>
      <span className={styles.rankWatermark} aria-hidden="true">{String(card.rank).padStart(2,"0")}</span>
      <RiderAvatar riderId={card.id} profileKey={card.avatarProfileKey} seed={card.avatarSeed} age={card.age} jersey={championJersey} label={`Portrait de ${card.name}`} className={`${styles.portrait} ${print.portraitPrint}`} />
      {card.jersey.imagePath ? <Image src={card.jersey.imagePath} alt={`Maillot de ${card.teamName}, saison ${season}`} width={72} height={84} sizes="72px" className={styles.jersey} /> : null}
      <span className={`${styles.country} ${print.countryLabel}`}>{card.countryCode.toUpperCase()} <span aria-hidden="true">/</span> {card.age} ans</span>
      <span className={print.editionSeal} aria-hidden="true">S{season}</span>
    </div>
    <div data-album-identity className={`${styles.cardIdentity} ${print.nameplate}`}><p>{card.profile}</p><h3>{card.name}</h3><span>{card.teamName}</span></div>
    {worldTitle?<p className={print.worldTitle}>Champion du monde · {worldTitle==="road"?"Route":"CLM"} · S{season}</p>:null}
    <dl data-album-stats className={`${styles.stats} ${print.statStrip}`}>{PRIMARY_STATS.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{card.ratings[key]}</dd></div>)}</dl>
    <div className={styles.achievements}><span><strong>{card.rank === 1 ? "1er" : `${card.rank}e`}</strong> UCI S{season}</span><span><strong>{card.victories}</strong> victoires</span></div>
    <footer className={styles.cardFoot}><span>{card.points.toLocaleString("fr-FR")} pts UCI</span><span>ÉDITION S{season}</span></footer>
    </>}
    <button type="button" className={print.turnCard} aria-label={back?`Revoir le portrait de ${card.name}`:`Voir le palmarès de ${card.name}`} aria-pressed={back} onClick={()=>setBackId(back?null:card.id)}>{back?"← Le portrait":"Le palmarès au dos ↻"}</button>
  </article>;
}

export function formatCollectorHonour(honour: CollectorHonour): string {
  if(honour.kind==="race")return honour.rank===1?"Victoire":`${honour.rank}e place`;
  if(honour.kind==="stages")return honour.count===1?"1 victoire d’étape":`${honour.count} victoires d’étapes`;
  return honour.kind==="mountain"?"Meilleur grimpeur":honour.kind==="sprint"?"Classement par points":"Meilleur jeune";
}

export function CollectorCardBack({card,season}:{card:CollectorCard;season:number}) {
  return <section className={print.cardBack} aria-label={`Palmarès de ${card.name}, saison ${season}`}>
    <header><span>CS / {String(card.number).padStart(2,"0")} · SAISON {season}</span><h3>{card.name}</h3><p>Les grandes lignes d’une saison.</p></header>
    <div className={print.backSummary}><strong>{card.rank===1?"1er":`${card.rank}e`} UCI</strong><span>{card.points.toLocaleString("fr-FR")} pts · {card.victories} victoires</span></div>
    <div className={print.honoursScroll} tabIndex={0} role="region" aria-label="Grands résultats et maillots distinctifs">
      {card.honours?.length?<ul>{card.honours.map(h=><li key={`${h.raceEditionId}:${h.kind}:${h.rank??0}`}><span className={print.honourMark} aria-hidden="true">{h.kind==="race"?(h.rank===1?"★":h.rank):h.kind==="stages"?"↗":"◆"}</span><div><strong>{h.raceName}</strong><span>{formatCollectorHonour(h)}</span></div></li>)}</ul>:<p>Aucun résultat dans cette sélection de grandes épreuves.</p>}
    </div>
    <footer>Résultats et notes figés en fin de saison {season}.<br/>Victoires, podiums majeurs, top 10 des Grands Tours et Monuments, étapes et maillots des grandes épreuves.</footer>
  </section>;
}
