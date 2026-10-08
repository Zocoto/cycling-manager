"use client";

import { useHalloweenPilot } from "./halloween-presentation";
import { HALLOWEEN_FINAL_FRAME_PREVIEW as frame, HALLOWEEN_FINAL_FRAME_STAT_LABELS, HALLOWEEN_FINAL_FRAME_PROTECTION_PERCENT } from "@/lib/game/halloween-final-reward-preview";
import { HalloweenItemIllustration } from "./halloween-art";

export function HalloweenFinalReward() {
  const pilot = useHalloweenPilot();
  return <section className="halloween-card halloween-runner-trophy halloween-final-reward" aria-label="Récompenses du vainqueur final de Cycling Hollow" data-halloween-final-reward={frame.id}>
    <p className="halloween-eyebrow">1er du classement général final{!pilot ? " · proposition" : ""}</p>
    <h3>{frame.name}</h3>
    <p className="halloween-secondary">Cadre de vélo exclusif · un seul exemplaire par événement</p>
    <div className="halloween-final-reward-content">
    <div><HalloweenItemIllustration art={frame.art} name={frame.name} />
    <dl className="halloween-frame-stats">{HALLOWEEN_FINAL_FRAME_STAT_LABELS.map(({ key, label }) => <div key={key}><dt>{label}</dt><dd>+{frame.ratingBonuses[key]}</dd></div>)}</dl></div>
    <div>
    <div className="halloween-frame-abilities"><strong>Porteur de bidon ×2 · Locomotive ×2</strong><span>−6 % de dépense d’énergie pour les équipiers du même groupe ; −32 % pour le porteur lorsqu’il travaille.</span><small>Renforce les capacités déjà acquises par le porteur.</small></div>
    <p className="halloween-frame-protection"><strong>+{HALLOWEEN_FINAL_FRAME_PROTECTION_PERCENT} % d’efficacité de protection</strong><span>Sur la contribution du coureur qui porte ce cadre, lorsqu’il protège son leader.</span></p>
    <details className="halloween-frame-details"><summary>Conditions et limites du bonus</summary><p>Le porteur doit être un équipier éligible à la protection, dans le même groupe que son leader, avec au moins {frame.leaderProtection.minimumHelperEnergy} points d’énergie. Sa contribution est multipliée par {frame.leaderProtection.helperContributionMultiplier.toLocaleString("fr-FR")}, pas celle de toute l’équipe. Les plafonds de protection actuels du moteur sont conservés.</p><p>Le cadre ne donne pas de nouvelle capacité. Plusieurs porteurs de bidon ne cumulent pas leurs effets : le meilleur bonus présent dans le groupe s’applique. Locomotive agit uniquement lorsque le porteur travaille, y compris sur les relais d’un chrono par équipes.</p><p>Les +3 REC, RES, END et DES profitent uniquement au porteur. Le cadre remplace son cadre actuel : un coureur équipé à la fois, affectation selon le gel du matériel habituel.</p><p>Objet conservé après Halloween, non échangeable et jamais disponible en boutique ou dans Trick or Treat. Attribution unique à la clôture de l’événement, après validation des scores.</p></details>
    <div className="halloween-final-skin"><h4>Également : {frame.skin.name}</h4><p>Le skin unique reste inclus : tenue noire et cuivrée avec col spectral. Le visage du DS reste visible.{!pilot ? " Visuel à valider." : ""}</p></div>
    <span className="halloween-tag">Exclusivité du vainqueur · ni vente ni tirage</span>
    </div></div>
    <p className="halloween-secondary">Le classement final retient le meilleur score de chaque DS sur tout l’événement, pas la somme des journées.{!pilot ? " Aperçu uniquement : aucun objet attribué et aucun bonus actif en course." : ""}</p>
  </section>;
}
