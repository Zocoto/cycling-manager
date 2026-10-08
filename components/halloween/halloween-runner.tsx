"use client";

import { HalloweenLink as Link, useHalloweenPilot } from "./halloween-presentation";
import { DemonicWheel } from "./halloween-wheel";
import { useEffect, useRef, useState } from "react";
import { createRunnerPreview, runnerSnapshot, RUNNER_DAILY_PODIUM, RUNNER_HEIGHT, RUNNER_STEP, RUNNER_TITLE, RUNNER_TAGLINE, RUNNER_WIDTH, stepRunnerPreview } from "@/lib/game/halloween-runner";
import { drawRunnerPreview } from "./halloween-runner-art";
import { HALLOWEEN_FINAL_FRAME_PREVIEW } from "@/lib/game/halloween-final-reward-preview";
import { HalloweenFinalReward } from "./halloween-final-reward";
import { HalloweenFinalPrizeLabel, HalloweenFinalPrizeList } from "./halloween-final-prizes";

import { halloweenRequest } from "./halloween-client";
import { MAX_RUN_TICKS, type HalloweenState, type HalloweenCommand } from "@/lib/game/halloween-event";

type Phase = "ready" | "running" | "paused" | "ended";
const EMPTY_HUD = runnerSnapshot(createRunnerPreview());

export function HalloweenRunner({ state, onRefresh, onNotice }: { state: HalloweenState; onRefresh: () => void; onNotice: (message: string) => void }) {
  const session = useRef<HalloweenState["activeRun"]>(null);
  const commands = useRef<HalloweenCommand[]>([]);
  const previousDuck = useRef(false);
  const finishing = useRef(false);
  const [busy, setBusy] = useState(false);
  const pilot = useHalloweenPilot();
  const canvas = useRef<HTMLCanvasElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const simulation = useRef(createRunnerPreview());
  const jumpRequested = useRef(false);
  const duckRequested = useRef(false);
  const [phase, setPhase] = useState<Phase>("ready");
  const [hud, setHud] = useState(EMPTY_HUD);
  const [ranking, setRanking] = useState<"day" | "event">("event");
  const [canvasAvailable, setCanvasAvailable] = useState(true);

  useEffect(() => {
    if (!state.activeRun) return;
    session.current = state.activeRun;
    simulation.current = createRunnerPreview(state.activeRun.seed);
    try {
      const raw = localStorage.getItem("cs-halloween-run:" + state.activeRun.id);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Number.isInteger(saved.ticks) && saved.ticks >= 0 && saved.ticks <= MAX_RUN_TICKS && Array.isArray(saved.commands)) {
          let index = 0, duck = false;
          for (let tick = 0; tick < saved.ticks && !simulation.current.ended; tick++) {
            const command = saved.commands[index]?.tick === tick ? saved.commands[index++] : undefined;
            if (command?.duck !== undefined) duck = command.duck;
            stepRunnerPreview(simulation.current, command?.jump === true, duck);
          }
          commands.current = saved.commands;
          previousDuck.current = duck;
        }
      }
    } catch { /* A damaged local checkpoint never grants another daily attempt. */ }
    setHud(runnerSnapshot(simulation.current));
    setPhase(simulation.current.ended ? "ended" : "paused");
  // Server ownership and quotas, not this checkpoint, authorize the session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finishRun() {
    if (!session.current || finishing.current) return;
    finishing.current = true;
    setBusy(true);
    try {
      const result = await halloweenRequest("finish", { runId: session.current.id, proof: { ticks: simulation.current.tick, commands: commands.current } }, session.current.id);
      onNotice(String(result.message) + (typeof result.coins === "number" ? " " + result.coins + " roues démoniaques." : ""));
      try { localStorage.removeItem("cs-halloween-run:" + session.current.id); } catch {}
      onRefresh();
    } catch (error) { onNotice(error instanceof Error ? error.message : "La sauvegarde a échoué. Réessayez."); }
    finally { finishing.current = false; setBusy(false); }
  }

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
        if (jumpRequested.current || duckRequested.current !== previousDuck.current) {
          commands.current.push({ tick: simulation.current.tick, ...(jumpRequested.current ? { jump: true } : {}), ...(duckRequested.current !== previousDuck.current ? { duck: duckRequested.current } : {}) });
          previousDuck.current = duckRequested.current;
        }
        stepRunnerPreview(simulation.current, jumpRequested.current, duckRequested.current);
        if (simulation.current.tick >= MAX_RUN_TICKS) simulation.current.ended = true;
        jumpRequested.current = false;
        accumulator -= RUNNER_STEP;
      }
      drawRunnerPreview(ctx, simulation.current, false);
      if (now - published >= 100 || simulation.current.ended) {
        const snapshot = runnerSnapshot(simulation.current);
        setHud(snapshot);
        if (session.current) try { localStorage.setItem("cs-halloween-run:" + session.current.id, JSON.stringify({ ticks: simulation.current.tick, commands: commands.current })); } catch {}
        published = now;
        if (snapshot.ended) {
          setPhase("ended");
          void finishRun();
          return;
        }
      }
      frame = requestAnimationFrame(animate);
    }
    const pause = () => { jumpRequested.current = false; duckRequested.current = false; setHud(runnerSnapshot(simulation.current)); setPhase("paused"); };
    const hidden = () => { if (document.hidden) pause(); };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", pause);
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", hidden); window.removeEventListener("blur", pause); duckRequested.current = false; jumpRequested.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function start() {
    if (busy || state.state !== "open") return;
    if (!canvas.current?.getContext("2d")) { setCanvasAvailable(false); return; }
    setBusy(true);
    try {
      const result = await halloweenRequest("start");
      session.current = result as NonNullable<HalloweenState["activeRun"]>;
      simulation.current = createRunnerPreview(Number(result.seed));
      commands.current = []; previousDuck.current = false;
      jumpRequested.current = false; duckRequested.current = false;
      setHud(runnerSnapshot(simulation.current)); setPhase("running");
      onRefresh();
      controls.current?.focus();
    } catch(error) { onNotice(error instanceof Error ? error.message : "Essai indisponible."); }
    finally { setBusy(false); }
  }
  function jump() { if (phase === "running") jumpRequested.current = true; }
  const scores = ranking === "event" ? state.ranking : state.dailyRanking;

  return <section className="halloween-runner-board">
    <div className="halloween-section-heading"><div><p className="halloween-eyebrow">{pilot ? "Cycling Hollow" : "Événement Halloween · prototype jouable"}</p><h2>{RUNNER_TITLE}</h2><p><strong>{RUNNER_TAGLINE}.</strong> Même vitesse, toujours plus rapide. Vos erreurs permettent à la citrouille de revenir.</p></div><Link href="/jeu/halloween?onglet=boutique" prefetch={false} className="halloween-button">Boutique · roues démoniaques →</Link></div>
    <div className="halloween-runner-layout">
      <section className="halloween-card halloween-runner-game">
        <div className="halloween-runner-hud" aria-label="Progression de la poursuite"><div><span>Distance</span><strong>{hud.distance} <small>m</small></strong></div><div><span>Roues démoniaques</span><strong className="halloween-runner-wheels"><DemonicWheel size={24} />{hud.coins}</strong></div><div><span>Score</span><strong>{hud.score}</strong></div><div><span>Poursuivant</span><strong>{hud.lead > 105 ? "À distance" : hud.lead > 45 ? "Tout proche" : "Sur vos talons"}</strong></div></div>
        <div className="halloween-runner-speed"><span>Vitesse <strong>×{hud.speed.toFixed(2)}</strong></span><span>{hud.stumbling ? "Choc ! Vous ralentissez, la citrouille se rapproche" : hud.slowed ? "Pieu ramassé · poursuivant ralenti pendant 3 s" : hud.ducking ? "Position baissée" : "↑ Sauter · ↓ Se baisser"}</span></div>
        <div className="halloween-runner-surface">
          <canvas ref={canvas} width={RUNNER_WIDTH} height={RUNNER_HEIGHT} onPointerDown={jump} aria-label="Cycling Hollow : sautez les crânes, citrouilles, tombes et mains de zombies. Baissez-vous sous les chauves-souris, toiles et arches. Les pieux repoussent le poursuivant.">Votre navigateur ne permet pas d’afficher ce jeu.</canvas>
          {phase !== "running" ? <div className="halloween-runner-overlay"><span className="halloween-eyebrow">{phase === "ready" ? "La route vous attend" : phase === "paused" ? "Poursuite en pause" : "La citrouille vous a rattrapé"}</span><strong>{phase === "ready" ? "Un vélo. Une nuit. Une poursuite." : phase === "paused" ? "Reprenez quand vous êtes prêt." : `${hud.score} points`}</strong><span>{phase === "ready" ? "Avance automatique · sautez au bon moment" : phase === "paused" ? pilot ? "Votre essai n’est pas perdu." : "Votre essai de démonstration n’est pas perdu." : `${hud.distance} m + ${hud.coins} roues démoniaques × 25`}</span></div> : null}
        </div>
        <div ref={controls} tabIndex={0} className="halloween-runner-controls" aria-label="Commandes du jeu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) duckRequested.current = false; }} onKeyDown={(event) => { if (phase !== "running") return; if (event.code === "Space" || event.code === "ArrowUp") { event.preventDefault(); if (!event.repeat) jump(); } if (event.code === "ArrowDown") { event.preventDefault(); duckRequested.current = true; } }} onKeyUp={(event) => { if (event.code === "ArrowDown") { event.preventDefault(); duckRequested.current = false; } }}>
          {phase === "running" ? <><button type="button" className="halloween-button" onClick={jump}>Sauter ↑</button><button type="button" className="halloween-button halloween-duck-button" aria-pressed={hud.ducking} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); duckRequested.current = true; }} onPointerUp={() => { duckRequested.current = false; }} onPointerCancel={() => { duckRequested.current = false; }} onLostPointerCapture={() => { duckRequested.current = false; }} onKeyDown={(event) => { if (event.code === "Space" || event.code === "Enter") { event.preventDefault(); event.stopPropagation(); duckRequested.current = true; } }} onKeyUp={(event) => { if (event.code === "Space" || event.code === "Enter") { event.preventDefault(); duckRequested.current = false; } }}>Se baisser ↓ <small>maintenir</small></button><button type="button" className="halloween-subtle-button" onClick={() => { setHud(runnerSnapshot(simulation.current)); setPhase("paused"); }}>Pause</button></> : phase === "paused" ? <><button type="button" className="halloween-button" onClick={() => { jumpRequested.current = false; duckRequested.current = false; setPhase("running"); controls.current?.focus(); }}>Reprendre la poursuite</button>{!pilot ? <button type="button" className="halloween-subtle-button" onClick={start}>Recommencer la démo</button> : null}</> : <button type="button" disabled={busy || state.state !== "open"} className="halloween-button" onClick={start}>{phase === "ready" ? pilot ? "Jouer la poursuite" : "Tester la poursuite" : pilot ? "Rejouer la poursuite" : "Rejouer le prototype"}</button>}
          <span>PC : espace / ↑ pour sauter, maintenir ↓ pour se baisser. Mobile : deux boutons. Relâchez pour vous relever.</span>
        </div>
        {phase === "ended" ? <button type="button" disabled={busy} className="halloween-button" onClick={finishRun}>{busy ? "Vérification du score…" : "Enregistrer / vérifier le résultat"}</button> : null}
        {!canvasAvailable ? <p role="alert">Canvas indisponible dans ce navigateur : aucun essai n’a été consommé.</p> : null}
        {phase === "ended" ? <div role="status" className="halloween-runner-result"><strong>{hud.coins} roues démoniaques récoltées{!pilot ? " · fictives" : ""}</strong><span>{hud.hits} obstacle{hud.hits > 1 ? "s" : ""} touché{hud.hits > 1 ? "s" : ""} · {hud.elapsed} s de poursuite. Aucune pénalité sur votre équipe.</span></div> : null}
        <p className="halloween-secondary">{!pilot ? "Démo rejouable, sans sauvegarde. Proposition : " : ""}Un essai quotidien + un essai bonus maximum par jour si vous avez gagné un ticket dans Trick or Treat. Le ticket expire à la fin de l’événement ; seul votre meilleur score est classé.{!pilot ? " Ce test ne crédite aucune roue démoniaque et ne consomme aucun ticket." : ""}</p>
      </section>
      <aside className="halloween-runner-aside">
        <section className="halloween-card"><p className="halloween-eyebrow">{pilot ? "Comment jouer" : "Les règles proposées"}</p><h3>Plus loin, plus vite.</h3><ul><li>Sautez les crânes, citrouilles, tombes larges et mains de zombies.</li><li>Restez baissé pendant les passages longs : toiles et arches du cimetière. Attention aux enchaînements saut / passage bas.</li><li>Ramassez un pieu : le poursuivant ralentit pendant 3 secondes et vous reprenez de l’avance.</li><li>Les deux vélos accélèrent ensemble : environ ×2,6 à 20 secondes, ×4,7 à une minute. Seuls les chocs vous font perdre de l’avance, jamais des roues démoniaques.</li><li>La partie s’arrête quand la citrouille rejoint votre vélo. Les poursuites exceptionnellement longues sont enregistrées après 30 minutes.</li></ul><p className="halloween-runner-formula">Score = mètres parcourus + roues démoniaques × 25</p><p className="halloween-secondary">Ramassez des roues démoniaques à dépenser en boutique. Même parcours quotidien pour tous.{!pilot ? " Économie à équilibrer après les essais." : ""}</p><Link href="/jeu/halloween?onglet=bonbons" prefetch={false} className="halloween-text-link">Trick or Treat · mise de 5 roues démoniaques →</Link></section>
      </aside>
    </div>
    <section className="halloween-card halloween-runner-ranking" aria-label="Classements de Cycling Hollow">
      <div className="halloween-section-heading"><div><p className="halloween-eyebrow">{pilot ? "Vos classements" : "Classement d’exemple · aucun vrai joueur"}</p><h3>Le peloton de minuit</h3></div><div className="halloween-filter">{([["day", "Aujourd’hui"], ["event", "Classement général de l’événement"]] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={ranking === key} onClick={() => setRanking(key)}>{label}</button>)}</div></div>
      {ranking === "event" ? <><HalloweenFinalReward /><HalloweenFinalPrizeList /></> : null}
      <div className="halloween-runner-table-wrap"><table><thead><tr><th>Rang</th><th>DS</th><th>Distance</th><th>Roues démoniaques</th><th>Score</th><th>{ranking === "day" ? "Bonus podium" : "Récompense finale"}</th></tr></thead><tbody>{scores.map((entry, index) => <tr key={entry.userId}><td>{index + 1}</td><th scope="row">{entry.name}</th><td>{entry.distance} m</td><td>{entry.coins}</td><td><strong>{entry.score}</strong></td><td>{ranking === "day" ? index < 3 ? `+${RUNNER_DAILY_PODIUM[index]} roues démoniaques` : "—" : <HalloweenFinalPrizeLabel rank={index + 1} />}</td></tr>)}</tbody></table></div>
      <p className="halloween-secondary">{ranking === "day" ? `${pilot ? "" : "Proposition : "}Clôture à minuit, heure de Paris. Podium +15 / +10 / +5 roues démoniaques, puis nouveau classement. Vos roues démoniaques restent acquises.` : `Le meilleur score de chaque joueur reste conservé pendant tout l’événement. À égalité : plus grande distance, puis record atteint en premier. Le premier reçoit ${HALLOWEEN_FINAL_FRAME_PREVIEW.name} et le skin unique à la clôture, après validation des scores. Les cinq premiers reçoivent leur lot final une seule fois.`}{!pilot ? " Dans cet aperçu, les records restent seulement en mémoire jusqu’à un rechargement." : ""}</p>
    </section>
    {!pilot ? <details className="halloween-card halloween-runner-safety"><summary>Avant une ouverture aux joueurs : essai quotidien, déconnexion et anti-triche</summary><p>La version réelle devra réserver un essai côté serveur, rejouer les commandes sur un parcours signé et vérifier le résultat avant tout crédit. Une déconnexion devra permettre de reprendre cet essai, sans en créer un second. Les récompenses du podium devront être distribuées une seule fois, même après une relance du traitement. L’archivage journalier gardera les preuves des scores ; seule la vue du classement sera remise à zéro.</p><p>Rien de cela n’est activé ici : pas de classement serveur, pas d’objet créé, pas de modification du compte.</p></details> : null}
  </section>;
}
