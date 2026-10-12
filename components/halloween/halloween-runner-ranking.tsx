"use client";

import { useState } from "react";
import type { HalloweenState } from "@/lib/game/halloween-event";
import { RUNNER_DAILY_PODIUM } from "@/lib/game/halloween-runner";
import { SpiderWeb } from "./halloween-art";
import { DemonicWheel } from "./halloween-wheel";
import { HalloweenFinalReward } from "./halloween-final-reward";
import { HalloweenFinalPrizeLabel, HalloweenFinalPrizeList } from "./halloween-final-prizes";

export function HalloweenRunnerRanking({ state, showPrizes = false }: { state: HalloweenState; showPrizes?: boolean }) {
  const [ranking, setRanking] = useState<"day" | "event">("event");
  const scores = ranking === "event" ? state.ranking : state.dailyRanking;
  return <>
    {showPrizes && ranking === "event" ? <><HalloweenFinalReward /><HalloweenFinalPrizeList /></> : null}
    <section className="halloween-card halloween-runner-ranking" aria-label="Classements de Cycling Hollow">
      <header className="halloween-ranking-header">
        <SpiderWeb className="halloween-ranking-web" />
        <div><p className="halloween-eyebrow">Cycling Hollow · les records de la nuit</p><h3>Le classement hanté</h3><p>Un meilleur score. Une place dans le peloton de minuit.</p></div>
        <span className="halloween-ranking-seal" aria-hidden="true">☾</span>
      </header>
      <div className="halloween-filter halloween-ranking-filters" aria-label="Période du classement">{([["event", "Classement général"], ["day", "Aujourd’hui"]] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={ranking === key} onClick={() => setRanking(key)}>{label}</button>)}</div>
      <p className="halloween-ranking-scroll-hint">Faites glisser le tableau pour voir les scores et les récompenses →</p>
      <div className="halloween-runner-table-wrap" role="region" aria-label="Tableau des scores, défilement horizontal sur téléphone" tabIndex={0}><table>
        <caption className="halloween-ranking-caption">{ranking === "event" ? "Meilleurs scores de l’événement" : "Meilleurs scores du jour"} · essais validés {ranking === "event" ? "sur l’événement" : "aujourd’hui"}</caption>
        <thead><tr><th>Rang</th><th>DS</th><th>Essais</th><th>Distance</th><th>Roues démoniaques</th><th>Score</th><th>{ranking === "day" ? "Bonus podium" : "Récompense finale"}</th></tr></thead>
        <tbody>{scores.map((entry, index) => <tr key={entry.userId} data-podium={index < 3 ? index + 1 : undefined}>
          <td><span className="halloween-ranking-rank">{index + 1}</span></td><th scope="row">{entry.name}</th>
          <td><span className="halloween-ranking-attempts">{entry.attempts ?? "—"}</span></td><td>{entry.distance.toLocaleString("fr-FR")} m</td>
          <td><span className="halloween-ranking-wheels"><DemonicWheel size={18} />{entry.coins}</span></td><td><strong className="halloween-ranking-score">{entry.score.toLocaleString("fr-FR")}</strong></td>
          <td>{ranking === "day" ? index < 3 ? `+${RUNNER_DAILY_PODIUM[index]} roues démoniaques` : "—" : <HalloweenFinalPrizeLabel rank={index + 1} />}</td>
        </tr>)}</tbody>
      </table></div>
      {!scores.length ? <p className="halloween-ranking-empty">La nuit attend ses premiers records. Lancez la poursuite !</p> : null}
      <p className="halloween-secondary">{ranking === "day" ? "Essais terminés et validés aujourd’hui. Clôture à minuit, heure de Paris. Podium +15 / +10 / +5 roues." : "Essais terminés et validés sur toute l’édition. Seul le meilleur score compte. À égalité : distance, puis record atteint en premier. Les cinq premiers reçoivent leur lot final à la clôture, après validation."}</p>
    </section>
  </>;
}
