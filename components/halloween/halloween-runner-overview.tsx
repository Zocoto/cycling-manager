"use client";

import Link from "next/link";
import { useState } from "react";
import type { HalloweenState } from "@/lib/game/halloween-event";
import { RUNNER_DAILY_PODIUM } from "@/lib/game/halloween-runner";
import { HalloweenFinalReward } from "./halloween-final-reward";
import { HalloweenFinalPrizeLabel, HalloweenFinalPrizeList } from "./halloween-final-prizes";

export function HalloweenRunnerOverview({ state }: { state: HalloweenState }) {
  const [ranking, setRanking] = useState<"day" | "event">("event");
  const scores = ranking === "event" ? state.ranking : state.dailyRanking;
  return <section className="halloween-runner-board">
    <div className="halloween-section-heading"><div><p className="halloween-eyebrow">Cycling Hollow</p><h2>Le peloton de minuit</h2><p>Un essai quotidien, et un essai bonus avec un ticket. Votre meilleur score reste classé.</p></div><Link href="/jeu/halloween/poursuite" prefetch={false} className="halloween-button">Jouer la poursuite →</Link></div>
    <details className="halloween-card"><summary>Comment jouer</summary><ul>
      <li>Sautez les crânes, citrouilles, tombes et mains de zombies.</li>
      <li>Maintenez « Se baisser » sous les chauves-souris, toiles et arches. Relâchez pour vous relever.</li>
      <li>Un pieu ralentit le poursuivant pendant 3 secondes. Les chocs vous font perdre de l’avance, pas de roues déjà ramassées.</li>
      <li>Les deux vélos accélèrent ensemble. Score = mètres parcourus + roues × 25.</li>
    </ul></details>
    <section className="halloween-card halloween-runner-ranking" aria-label="Classements de Cycling Hollow">
      <div className="halloween-section-heading"><h3>Les classements</h3><div className="halloween-filter">{([["day", "Aujourd’hui"], ["event", "Classement général de l’événement"]] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={ranking === key} onClick={() => setRanking(key)}>{label}</button>)}</div></div>
      {ranking === "event" ? <><HalloweenFinalReward /><HalloweenFinalPrizeList /></> : null}
      <div className="halloween-runner-table-wrap"><table><thead><tr><th>Rang</th><th>DS</th><th>Distance</th><th>Roues démoniaques</th><th>Score</th><th>{ranking === "day" ? "Bonus podium" : "Récompense finale"}</th></tr></thead><tbody>{scores.map((entry, index) => <tr key={entry.userId}><td>{index + 1}</td><th scope="row">{entry.name}</th><td>{entry.distance} m</td><td>{entry.coins}</td><td><strong>{entry.score}</strong></td><td>{ranking === "day" ? index < 3 ? `+${RUNNER_DAILY_PODIUM[index]} roues démoniaques` : "—" : <HalloweenFinalPrizeLabel rank={index + 1} />}</td></tr>)}</tbody></table></div>
      {!scores.length ? <p>Aucun score enregistré pour le moment.</p> : null}
      <p className="halloween-secondary">{ranking === "day" ? "Clôture à minuit, heure de Paris. Podium +15 / +10 / +5 roues. Vos roues restent acquises." : "Meilleur score de chaque joueur. À égalité : distance, puis record atteint en premier. Les cinq premiers reçoivent leur lot final une seule fois à la clôture, après validation des scores."}</p>
    </section>
  </section>;
}
