"use client";

import { HALLOWEEN_FINAL_FRAME_PREVIEW as frame, HALLOWEEN_FINAL_FRAME_STATS_SUMMARY, HALLOWEEN_FINAL_FRAME_PROTECTION_PERCENT, HALLOWEEN_FINAL_PRIZES_PREVIEW, getHalloweenFinalPrizePreview } from "@/lib/game/halloween-final-reward-preview";
import { HALLOWEEN_PREVIEW_ITEMS } from "@/lib/game/halloween-catalog";
import { useHalloweenPilot } from "./halloween-presentation";
import { DemonicWheel } from "./halloween-wheel";

/** Read-only prize presentation: no inventory, payment, account or score mutation. */
export function HalloweenFinalPrizeLabel({ rank }: { rank: number }) {
  const prize = getHalloweenFinalPrizePreview(rank);
  if (!prize) return <span>—</span>;
  const item = HALLOWEEN_PREVIEW_ITEMS.find((entry) => entry.id === prize.shopItemId);
  return <div className="halloween-final-prize-label" data-halloween-final-prize={rank}>
    <strong className="halloween-final-prize-wheels"><DemonicWheel size={20} />{prize.wheels} roues démoniaques</strong>
    {prize.exclusiveFrame ? <><strong>{frame.name}</strong><span className="halloween-final-prize-bonuses">{HALLOWEEN_FINAL_FRAME_STATS_SUMMARY}</span><span>Porteur de bidon ×2 · Locomotive ×2</span><span>+{HALLOWEEN_FINAL_FRAME_PROTECTION_PERCENT} % de protection du leader par le porteur</span><span>+ {frame.skin.name} · skin unique</span></> : item ? <><strong>+ {item.name}</strong><span>{item.kind === "consumable" ? item.description : "Cosmétique conservé après l’événement"}</span></> : null}
  </div>;
}

export function HalloweenFinalPrizeList() {
  const pilot = useHalloweenPilot();
  return <section className="halloween-final-prizes" aria-label="Lots des cinq premiers du classement général final">
    <p className="halloween-eyebrow">Classement général final{!pilot ? " · proposition" : ""}</p>
    <h3>Les cinq premiers repartent avec un trésor</h3>
    <ol className="halloween-final-prize-grid">{HALLOWEEN_FINAL_PRIZES_PREVIEW.map((prize) => <li key={prize.rank}><span className="halloween-final-prize-rank">{prize.rank === 1 ? "1er" : `${prize.rank}e`} du général</span><HalloweenFinalPrizeLabel rank={prize.rank} /></li>)}</ol>
    <p className="halloween-secondary">Lots attribués une seule fois à la clôture, après validation des scores. Le classement retient votre meilleur essai, pas le cumul des journées. Ces lots s’ajoutent au podium quotidien, qui reste à +15 / +10 / +5 roues démoniaques.{!pilot ? " Aucun lot réel n’est distribué dans cet aperçu." : ""}</p>
  </section>;
}
