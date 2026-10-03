"use client";

import Link from "@/components/ui/app-link";
import { useEffect, useRef, useState } from "react";
import { createRunnerPreview, runnerSnapshot, RUNNER_DAILY_PODIUM, RUNNER_HEIGHT, RUNNER_STEP, RUNNER_TITLE, RUNNER_WIDTH, stepRunnerPreview, type RunnerSnapshot } from "@/lib/game/halloween-runner-preview";
import { drawRunnerPreview } from "./halloween-runner-art";

type Phase = "ready" | "running" | "paused" | "ended";
const EMPTY_HUD = runnerSnapshot(createRunnerPreview());
const EXAMPLE_SCORES = [
  { name: "Maillot cuivré", score: 3940, distance: 2240, coins: 68 },
  { name: "Roue de minuit", score: 3310, distance: 1860, coins: 58 },
  { name: "Échappée fantôme", score: 2950, distance: 1700, coins: 50 },
];

export function HalloweenRunner() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const simulation = useRef(createRunnerPreview());
  const jumpRequested = useRef(false);
  const [phase, setPhase] = useState<Phase>("ready");
  const [hud, setHud] = useState(EMPTY_HUD);
  const [best, setBest] = useState<RunnerSnapshot | null>(null);
  const [ranking, setRanking] = useState<"day" | "event">("day");
  const [canvasAvailable, setCanvasAvailable] = useState(true);

  useEffect(() => {
    const surface = canvas.current;
    const ctx = surface?.getContext("2d");
    if (!ctx) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    surface!.width = RUNNER_WIDTH * ratio;
    surface!.height = RUNNER_HEIGHT * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawRunnerPreview(ctx, simulation.current, phase === "ready");
    if (phase !== "running") return;
    let frame = 0;
    let last = 0;
    let published = 0;
    let accumulator = 0;
    function animate(now: number) {
      if (!ctx) return;
      if (!last) last = now;
      const delta = Math.min(.1, (now - last) / 1000);
      last = now;
      // Discard long stalls instead of advancing seconds of unseen collisions at once.
      accumulator += delta;
      while (accumulator >= RUNNER_STEP && !simulation.current.ended) {
        stepRunnerPreview(simulation.current, jumpRequested.current);
        jumpRequested.current = false;
        accumulator -= RUNNER_STEP;
      }
      drawRunnerPreview(ctx, simulation.current, false);
      if (now - published >= 100 || simulation.current.ended) {
        const snapshot = runnerSnapshot(simulation.current);
        setHud(snapshot);
        published = now;
        if (snapshot.ended) {
          setBest((previous) => !previous || snapshot.score > previous.score ? snapshot : previous);
          setPhase("ended");
          return;
        }
      }
      frame = requestAnimationFrame(animate);
    }
    const hidden = () => { if (document.hidden) { setHud(runnerSnapshot(simulation.current)); setPhase("paused"); } };
    document.addEventListener("visibilitychange", hidden);
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", hidden); };
  }, [phase]);

  function start() {
    if (!canvas.current?.getContext("2d")) { setCanvasAvailable(false); return; }
    simulation.current = createRunnerPreview();
    jumpRequested.current = false;
    setHud(EMPTY_HUD);
    setPhase("running");
    controls.current?.focus();
  }
  function jump() { if (phase === "running") jumpRequested.current = true; }
  const scores = [...EXAMPLE_SCORES, ...(best ? [{ name: "Votre meilleur essai · démo", ...best }] : [])].sort((a, b) => b.score - a.score || b.distance - a.distance);

  return <section className="halloween-runner-board">
    <div className="halloween-section-heading"><div><p className="halloween-eyebrow">Événement Halloween · prototype jouable</p><h2>{RUNNER_TITLE}</h2><p>Gardez une longueur d’avance. La nuit finit toujours par vous rattraper.</p></div><Link href="/apercus/halloween/boutique" prefetch={false} className="halloween-button">Boutique Roue infernale →</Link></div>
    <div className="halloween-runner-layout">
      <section className="halloween-card halloween-runner-game">
        <div className="halloween-runner-hud" aria-label="Progression de la poursuite"><div><span>Distance</span><strong>{hud.distance} <small>m</small></strong></div><div><span>Pièces</span><strong>{hud.coins}</strong></div><div><span>Score</span><strong>{hud.score}</strong></div><div><span>Poursuivant</span><strong>{hud.lead > 105 ? "À distance" : hud.lead > 45 ? "Tout proche" : "Sur vos talons"}</strong></div></div>
        <div className="halloween-runner-surface">
          <canvas ref={canvas} width={RUNNER_WIDTH} height={RUNNER_HEIGHT} onPointerDown={jump} aria-label="Poursuite à vélo de profil : sautez les troncs et les rochers, ramassez les pièces en l’air.">Votre navigateur ne permet pas d’afficher ce prototype.</canvas>
          {phase !== "running" ? <div className="halloween-runner-overlay"><span className="halloween-eyebrow">{phase === "ready" ? "La route vous attend" : phase === "paused" ? "Poursuite en pause" : "La citrouille vous a rattrapé"}</span><strong>{phase === "ready" ? "Un vélo. Une nuit. Une seule chance." : phase === "paused" ? "Reprenez quand vous êtes prêt." : `${hud.score} points`}</strong><span>{phase === "ready" ? "Avance automatique · sautez au bon moment" : phase === "paused" ? "Votre essai de démonstration n’est pas perdu." : `${hud.distance} m + ${hud.coins} pièces × 25`}</span></div> : null}
        </div>
        <div ref={controls} tabIndex={0} className="halloween-runner-controls" aria-label="Commandes du jeu" onKeyDown={(event) => { if (phase === "running" && (event.code === "Space" || event.code === "ArrowUp")) { event.preventDefault(); if (!event.repeat) jump(); } }}>
          {phase === "running" ? <><button type="button" className="halloween-button" onClick={jump}>Sauter ↑</button><button type="button" className="halloween-subtle-button" onClick={() => { setHud(runnerSnapshot(simulation.current)); setPhase("paused"); }}>Pause</button></> : phase === "paused" ? <><button type="button" className="halloween-button" onClick={() => { jumpRequested.current = false; setPhase("running"); controls.current?.focus(); }}>Reprendre la poursuite</button><button type="button" className="halloween-subtle-button" onClick={start}>Recommencer la démo</button></> : <button type="button" className="halloween-button" onClick={start}>{phase === "ready" ? "Tester la poursuite" : "Rejouer le prototype"}</button>}
          <span>PC : espace / ↑ · Mobile : touchez la piste ou « Sauter ».</span>
        </div>
        {!canvasAvailable ? <p role="alert">Canvas indisponible dans ce navigateur : aucun essai n’a été consommé.</p> : null}
        {phase === "ended" ? <div role="status" className="halloween-runner-result"><strong>{hud.coins} pièces récoltées · fictives</strong><span>{hud.hits} obstacle{hud.hits > 1 ? "s" : ""} touché{hud.hits > 1 ? "s" : ""} · {hud.elapsed} s de poursuite. Aucune pénalité sur votre équipe.</span></div> : null}
        <p className="halloween-secondary">Démo rejouable, sans sauvegarde. Le vrai événement sera limité à un essai par jour. Ce test ne crédite aucune pièce.</p>
      </section>
      <aside className="halloween-runner-aside">
        <section className="halloween-card"><p className="halloween-eyebrow">Les règles proposées</p><h3>Plus loin, plus vite.</h3><ul><li>Les pièces ramassées pourront être dépensées dans la boutique.</li><li>Un obstacle fait perdre de l’avance, pas de pièces déjà ramassées.</li><li>La vitesse augmente et les obstacles se rapprochent. Le poursuivant finit toujours par revenir.</li></ul><p className="halloween-runner-formula">Score = mètres parcourus + pièces × 25</p><p className="halloween-secondary">Même parcours quotidien pour tous. Paramètres et économie à équilibrer après les essais.</p></section>
        <section className="halloween-card halloween-runner-trophy"><p className="halloween-eyebrow">Récompense unique · proposition</p><h3>Maillot du Cycliste sans tête</h3><p>Une tenue noire et cuivrée avec col spectral, réservée au meilleur score de tout l’événement. Le visage du DS reste visible.</p><span className="halloween-tag">Non vendue en boutique · visuel à valider</span></section>
      </aside>
    </div>
    <section className="halloween-card halloween-runner-ranking"><div className="halloween-section-heading"><div><p className="halloween-eyebrow">Classement d’exemple · aucun vrai joueur</p><h3>Le peloton de minuit</h3></div><div className="halloween-filter">{([["day", "Aujourd’hui"], ["event", "Record de l’événement"]] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={ranking === key} onClick={() => setRanking(key)}>{label}</button>)}</div></div><div className="halloween-runner-table-wrap"><table><thead><tr><th>Rang</th><th>DS</th><th>Distance</th><th>Pièces</th><th>Score</th><th>{ranking === "day" ? "Bonus podium" : "Récompense finale"}</th></tr></thead><tbody>{scores.map((entry, index) => <tr key={entry.name}><td>{index + 1}</td><th scope="row">{entry.name}</th><td>{entry.distance} m</td><td>{entry.coins}</td><td><strong>{entry.score}</strong></td><td>{ranking === "day" ? index < 3 ? `+${RUNNER_DAILY_PODIUM[index]} pièces` : "—" : index === 0 ? "Skin unique" : "—"}</td></tr>)}</tbody></table></div><p className="halloween-secondary">{ranking === "day" ? "Proposition : clôture à minuit, heure de Paris. Podium +15 / +10 / +5 pièces, puis nouveau classement. Vos pièces restent acquises." : "Le meilleur score de chaque joueur reste conservé pendant tout l’événement. À égalité : plus grande distance, puis record atteint en premier."} Dans cet aperçu, les records restent seulement en mémoire jusqu’à un rechargement.</p></section>
    <details className="halloween-card halloween-runner-safety"><summary>Avant une ouverture aux joueurs : essai quotidien, déconnexion et anti-triche</summary><p>La version réelle devra réserver un essai côté serveur, rejouer les commandes sur un parcours signé et vérifier le résultat avant tout crédit. Une déconnexion devra permettre de reprendre cet essai, sans en créer un second. Les récompenses du podium devront être distribuées une seule fois, même après une relance du traitement. L’archivage journalier gardera les preuves des scores ; seule la vue du classement sera remise à zéro.</p><p>Rien de cela n’est activé ici : pas de classement serveur, pas d’objet créé, pas de modification du compte.</p></details>
  </section>;
}
