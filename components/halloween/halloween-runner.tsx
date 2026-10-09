"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { createRunnerPreview, runnerSnapshot, RUNNER_STEP, stepRunnerPreview } from "@/lib/game/halloween-runner";
import { createHalloweenRunnerControls } from "@/lib/game/halloween-runner-controls";
import { MAX_RUN_TICKS, type HalloweenState, type HalloweenCommand } from "@/lib/game/halloween-event";
import { drawRunnerPreview } from "./halloween-runner-art";
import { halloweenRequest } from "./halloween-client";
import { DemonicWheel } from "./halloween-wheel";

type Phase = "ready" | "running" | "paused" | "ended";
const EMPTY_HUD = runnerSnapshot(createRunnerPreview());

/** Opening the dedicated screen never reserves an attempt. */
export function HalloweenRunner({ state, reviewOnly = false }: { state: HalloweenState; reviewOnly?: boolean }) {
  const router = useRouter();
  const session = useRef<HalloweenState["activeRun"]>(null);
  const commands = useRef<HalloweenCommand[]>([]);
  const previousDuck = useRef(false);
  const finishing = useRef(false);
  const settled = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const simulation = useRef(createRunnerPreview());
  const input = useRef(createHalloweenRunnerControls());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [phase, setPhase] = useState<Phase>("ready");
  const [hud, setHud] = useState(EMPTY_HUD);
  const [canvasAvailable, setCanvasAvailable] = useState(true);
  const [resultSaved, setResultSaved] = useState(false);

  const saveCheckpoint = useCallback(() => {
    if (session.current && !settled.current && !reviewOnly) try {
      localStorage.setItem("cs-halloween-run:" + session.current.id, JSON.stringify({ ticks: simulation.current.tick, commands: commands.current }));
    } catch { /* Server ownership still protects the reserved attempt. */ }
  }, [reviewOnly]);

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
    // A server refresh must not reset an ongoing local simulation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finishRun() {
    if (!session.current || finishing.current || settled.current) return;
    finishing.current = true; setBusy(true); saveCheckpoint();
    try {
      if (reviewOnly) setNotice("Recette locale : aucun essai ni gain réel.");
      else {
        const result = await halloweenRequest("finish", { runId: session.current.id, proof: { ticks: simulation.current.tick, commands: commands.current } }, session.current.id);
        setNotice(String(result.message) + (typeof result.coins === "number" ? " " + result.coins + " roues démoniaques." : ""));
        try { localStorage.removeItem("cs-halloween-run:" + session.current.id); } catch {}
        router.refresh();
      }
      settled.current = true;
      setResultSaved(true);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Sauvegarde interrompue. Réessayez."); }
    finally { finishing.current = false; setBusy(false); }
  }

  useEffect(() => {
    const surface = canvas.current;
    const currentInput = input.current;
    const ctx = surface?.getContext("2d");
    if (!surface || !ctx) return;
    let width = 1, height = 1;
    const resize = () => {
      const bounds = surface.getBoundingClientRect();
      width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      surface.width = Math.round(width * ratio); surface.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawRunnerPreview(ctx, simulation.current, phase === "ready", { width, height });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    if (phase !== "running") return () => observer.disconnect();
    let frame = 0, last = 0, published = 0, savedAt = 0, accumulator = 0;
    function animate(now: number) {
      if (!ctx) return;
      if (!last) last = now;
      accumulator += Math.min(.1, (now - last) / 1000);
      last = now;
      while (accumulator >= RUNNER_STEP && !simulation.current.ended) {
        const command = currentInput.read();
        if (command.jump || command.duck !== previousDuck.current) {
          commands.current.push({ tick: simulation.current.tick, ...(command.jump ? { jump: true } : {}), ...(command.duck !== previousDuck.current ? { duck: command.duck } : {}) });
          previousDuck.current = command.duck;
        }
        stepRunnerPreview(simulation.current, command.jump, command.duck);
        if (simulation.current.tick >= MAX_RUN_TICKS) simulation.current.ended = true;
        currentInput.consumeJump(); accumulator -= RUNNER_STEP;
      }
      drawRunnerPreview(ctx, simulation.current, false, { width, height });
      if (now - savedAt >= 1000 || simulation.current.ended) { saveCheckpoint(); savedAt = now; }
      if (now - published >= 100 || simulation.current.ended) {
        const snapshot = runnerSnapshot(simulation.current);
        setHud(snapshot); published = now;
        if (snapshot.ended) { currentInput.clear(); setPhase("ended"); void finishRun(); return; }
      }
      frame = requestAnimationFrame(animate);
    }
    const pause = () => { saveCheckpoint(); currentInput.clear(); setHud(runnerSnapshot(simulation.current)); setPhase("paused"); };
    const hidden = () => { if (document.hidden) pause(); };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", pause); window.addEventListener("pagehide", pause);
    frame = requestAnimationFrame(animate);
    return () => {
      saveCheckpoint(); cancelAnimationFrame(frame); observer.disconnect();
      document.removeEventListener("visibilitychange", hidden); window.removeEventListener("blur", pause); window.removeEventListener("pagehide", pause);
      currentInput.clear();
    };
    // HUD updates don't restart the deterministic clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, saveCheckpoint]);

  async function start() {
    if (busy || state.state !== "open") return;
    if (!canvas.current?.getContext("2d")) { setCanvasAvailable(false); return; }
    setBusy(true); setNotice("");
    try {
      const result = reviewOnly ? { id: "local-review", seed: 20261031, startedAt: new Date().toISOString(), expiresAt: "" } : await halloweenRequest("start");
      session.current = result as NonNullable<HalloweenState["activeRun"]>;
      simulation.current = createRunnerPreview(Number(result.seed));
      commands.current = []; previousDuck.current = false; settled.current = false; setResultSaved(false);
      input.current.clear(); setHud(runnerSnapshot(simulation.current)); setPhase("running");
      if (!reviewOnly) router.refresh();
      controls.current?.focus({ preventScroll: true });
    } catch (error) { setNotice(error instanceof Error ? error.message : "Essai indisponible."); }
    finally { setBusy(false); }
  }
  function jump() { if (phase === "running") input.current.jump(); }
  function pause() { saveCheckpoint(); input.current.clear(); setHud(runnerSnapshot(simulation.current)); setPhase("paused"); }
  function resume() { input.current.clear(); setPhase("running"); controls.current?.focus({ preventScroll: true }); }
  function keyDown(event: KeyboardEvent) {
    if (phase !== "running") return;
    if (["Space", "ArrowUp", "ArrowDown"].includes(event.code)) event.preventDefault();
    if (!event.repeat && (event.code === "Space" || event.code === "ArrowUp")) jump();
    if (event.code === "ArrowDown") input.current.pressKey(event.code);
    if (event.code === "Escape") { event.preventDefault(); pause(); }
  }
  const backHref = reviewOnly ? "/apercus/halloween-recette" : "/jeu/halloween?onglet=classements";
  return <main className="halloween-game-console" data-halloween-console data-site-theme="halloween" data-site-theme-preserve data-phase={phase}>
    <section className="halloween-console-screen" aria-label="Écran de Cycling Hollow">
      <header className="halloween-console-top"><Link href={backHref} prefetch={false} onClick={saveCheckpoint} aria-label="Quitter la poursuite et revenir à Halloween">← Halloween</Link><h1>Cycling Hollow</h1><button type="button" onClick={pause} disabled={phase !== "running"} aria-label="Mettre la poursuite en pause">Ⅱ</button></header>
      <div className="halloween-console-hud" aria-label="Progression de la poursuite"><span><small>Distance</small><strong>{hud.distance} m</strong></span><span><small>Roues</small><strong><DemonicWheel size={18} />{hud.coins}</strong></span><span><small>Score</small><strong>{hud.score}</strong></span></div>
      <div className="halloween-console-playfield">
        <canvas ref={canvas} aria-label="Sautez les obstacles au sol et baissez-vous sous les passages aériens. Le poursuivant reste visible derrière votre vélo.">Votre navigateur ne permet pas d’afficher ce jeu.</canvas>
        {phase !== "running" ? <div className="halloween-console-overlay">
          <strong>{phase === "ready" ? "Échappez au sans-tête" : phase === "paused" ? "Poursuite en pause" : `${hud.score} points`}</strong>
          <p>{phase === "ready" ? "Sautez. Baissez-vous. Gardez l’avance." : phase === "paused" ? "Votre essai est conservé." : `${hud.distance} m · ${hud.coins} roues`}</p>
          {phase === "ready" ? <><button type="button" disabled={busy || state.state !== "open"} onClick={start}>{busy ? "Préparation…" : reviewOnly ? "Tester sans utiliser d’essai" : state.replayAvailable && state.attempts > 0 ? "Utiliser mon essai restitué" : "Jouer la poursuite"}</button><small>{state.state !== "open" ? "Les jeux sont fermés pour le moment." : state.replayAvailable ? "1 essai gratuit restitué · scores et gains conservés" : "1 essai quotidien · +1 avec un ticket"}</small></> : phase === "paused" ? <button type="button" onClick={resume}>Reprendre</button> : <>{!resultSaved ? <button type="button" disabled={busy} onClick={finishRun}>{busy ? "Vérification du score…" : "Enregistrer le résultat"}</button> : <Link href={backHref} prefetch={false}>Voir les classements →</Link>}</>}
          {!canvasAvailable ? <p role="alert">Jeu indisponible dans ce navigateur. Aucun essai consommé.</p> : null}
          {notice ? <p role="status">{notice}</p> : null}
        </div> : null}
      </div>
      <div className="halloween-console-status"><span>Vitesse ×{hud.speed.toFixed(2)}</span><span>{hud.stumbling ? "Choc !" : hud.slowed ? "Poursuivant ralenti" : hud.ducking ? "Position baissée" : hud.lead < 45 ? "Sur vos talons !" : "Gardez l’avance"}</span></div>
    </section>
    <div ref={controls} tabIndex={0} className="halloween-console-controls" aria-label="Commandes du jeu" onKeyDown={keyDown} onKeyUp={event => { if (event.code === "ArrowDown") { event.preventDefault(); input.current.releaseKey(event.code); } }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) input.current.clear(); }}>
      <div className="halloween-console-buttons">
        <button type="button" data-runner-action="jump" disabled={phase !== "running"} onPointerDown={event => { event.preventDefault(); jump(); }} onClick={event => { if (event.detail === 0) jump(); }} onKeyDown={event => { if (event.code === "Enter" || event.code === "Space") { event.preventDefault(); event.stopPropagation(); if (!event.repeat) jump(); } }}><span aria-hidden="true">↑</span><strong>Sauter</strong><small>Toucher</small></button>
        <button type="button" data-runner-action="duck" disabled={phase !== "running"} aria-pressed={hud.ducking} onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); input.current.pressPointer(event.pointerId); }} onPointerUp={event => input.current.releasePointer(event.pointerId)} onPointerCancel={event => input.current.releasePointer(event.pointerId)} onLostPointerCapture={event => input.current.releasePointer(event.pointerId)} onKeyDown={event => { if (event.code === "Space" || event.code === "Enter") { event.preventDefault(); event.stopPropagation(); input.current.pressKey(event.code); } }} onKeyUp={event => { if (event.code === "Space" || event.code === "Enter") { event.preventDefault(); input.current.releaseKey(event.code); } }}><span aria-hidden="true">↓</span><strong>Se baisser</strong><small>Maintenir</small></button>
      </div>
      <p>Relâchez pour vous relever <span>· PC : espace / ↑ et ↓</span></p>
    </div>
  </main>;
}
