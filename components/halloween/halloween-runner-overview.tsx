"use client";

import Link from "next/link";
import type { HalloweenState } from "@/lib/game/halloween-event";
import { HalloweenRunnerRanking } from "./halloween-runner-ranking";

export function HalloweenRunnerOverview({ state }: { state: HalloweenState }) {
  return <section className="halloween-runner-board">
    <div className="halloween-section-heading"><div><p className="halloween-eyebrow">Cycling Hollow</p><h2>Le peloton de minuit</h2><p>Un essai quotidien, et un essai bonus avec un ticket. Votre meilleur score reste classé.</p></div><Link href="/jeu/halloween/poursuite" prefetch={false} className="halloween-button">Jouer la poursuite →</Link></div>
    <details className="halloween-card"><summary>Comment jouer</summary><ul>
      <li>Sautez les crânes, citrouilles, tombes et mains de zombies.</li>
      <li>Maintenez « Se baisser » sous les chauves-souris, toiles et arches. Relâchez pour vous relever.</li>
      <li>Un pieu ralentit le poursuivant pendant 3 secondes. Les chocs vous font perdre de l’avance, pas de roues déjà ramassées.</li>
      <li>Les deux vélos accélèrent ensemble. Score = mètres parcourus + roues × 25.</li>
    </ul></details>
    <HalloweenRunnerRanking state={state} showPrizes />
  </section>;
}
