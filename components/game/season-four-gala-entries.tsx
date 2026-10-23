"use client";
import Image from "next/image";
import { useState } from "react";
import Link from "@/components/ui/app-link";
import type { GalaProgram, GalaProfile } from "@/lib/game/season-four-gala";
import type { GalaPublicEntries } from "@/lib/game/season-four-gala-registration";
import styles from "./season-four-gala.module.css";

export function SeasonFourGalaEntries({ program, profile, count }: { program: GalaProgram; profile: GalaProfile; count: number }) {
  const [result, setResult] = useState<GalaPublicEntries | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  async function load(nextPage: number) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/game/gala-s4/entries?program=${program}&profile=${profile}&page=${nextPage}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("Impossible de charger les engagés. Réessayez.");
      const data: GalaPublicEntries = await response.json();
      setResult(previous => ({ ...data, teams: nextPage ? [...(previous?.teams ?? []), ...data.teams] : data.teams }));
      setPage(nextPage);
    } catch { setError("Impossible de charger les engagés. Réessayez."); } finally { setBusy(false); }
  }
  return <details className={styles.courseDetails} onToggle={event => { if (event.currentTarget.open && !result && !busy) void load(0); }}>
    <summary>Maillots & engagés <small>{count} équipe(s)</small><span aria-hidden="true">＋</span></summary>
    {busy ? <p role="status" className={styles.entriesNote}>Chargement des engagés…</p> : null}
    {error ? <p role="alert" className={styles.entriesNote}>{error} <button type="button" onClick={() => void load(result ? page + 1 : 0)}>Réessayer</button></p> : null}
    {result?.total === 0 ? <p className={styles.entriesNote}>Aucune équipe inscrite pour le moment. Soyez les premiers !</p> : null}
    {result?.favorites?.length ? <div className={styles.entriesNote}><strong>Les noms à suivre</strong><p>Repères indicatifs selon la spécialité de la course, sans équipement.</p>{result.favorites.map(rider => <p key={`${rider.name}:${rider.team}`}>{rider.name} · {rider.team}</p>)}</div> : null}
    {result?.teams.map(team => <div className={styles.teamRow} key={team.teamId}>
      {team.jerseyImagePath ? <Image src={team.jerseyImagePath} width={52} height={52} alt={`Maillot de ${team.name}`} /> : null}
      <div><Link href={`/jeu/equipes/${team.teamId}`}><strong>{team.name}</strong></Link><small>{team.riders.map(rider => rider.name).join(" · ")}</small></div>
    </div>)}
    {result?.hasMore && !busy ? <button className={styles.entriesMore} type="button" onClick={() => void load(page + 1)}>Voir les équipes suivantes</button> : null}
  </details>;
}
