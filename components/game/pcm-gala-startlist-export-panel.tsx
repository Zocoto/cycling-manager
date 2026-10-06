"use client";

import { useState } from "react";
import type { PcmGalaRaceKey } from "@/lib/game/pcm-gala-races";

type ExportSummary = {
  filename: string;
  season: string;
  events: string;
  simulations: string;
  teams: string;
  riders: string;
  generatedAt: string;
};

export function PcmGalaStartlistExportPanel({ eventKey, compact = false }: { eventKey?: PcmGalaRaceKey; compact?: boolean } = {}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ExportSummary | null>(null);

  async function handleExport() {
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);

    try {
      const endpoint = eventKey ? `/api/admin/pcm-gala-startlists?eventKey=${encodeURIComponent(eventKey)}` : "/api/admin/pcm-gala-startlists";
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-CS-Requested-With": "pcm-gala-startlists-admin" },
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "La génération des startlists a échoué.");
      }

      const blob = await response.blob();
      const filename = readFilename(response) ?? "Cyclostratege-Startlists-PCM26.zip";
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);

      setSummary({
        filename,
        season: response.headers.get("X-CS-Season") ?? "—",
        events: response.headers.get("X-CS-Events") ?? "—",
        simulations: response.headers.get("X-CS-Simulations") ?? response.headers.get("X-CS-Events") ?? "—",
        teams: response.headers.get("X-CS-Teams") ?? "—",
        riders: response.headers.get("X-CS-Riders") ?? "—",
        generatedAt: response.headers.get("X-CS-Generated-At") ?? new Date().toISOString(),
      });
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "La génération des startlists a échoué.");
    } finally {
      setIsGenerating(false);
    }
  }

  if (compact) return (
    <section aria-labelledby="gala-admin-export" className="rounded-xl border border-[#393C44] bg-[#111215] p-4 text-[#BFC3CE]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="gala-admin-export" className="text-sm font-semibold text-[#E5E7ED]">Organisation · Startlists PCM26</h2>
        <button type="button" onClick={handleExport} disabled={isGenerating} className="min-h-11 rounded-lg bg-[#D2B46B] px-4 py-2 text-xs font-semibold text-[#101114] hover:bg-[#E2C784] disabled:cursor-wait disabled:opacity-65">
          {isGenerating ? "Construction des listes…" : "Télécharger la startlist du gala"}
        </button>
      </div>
      <p className="mt-3 text-xs leading-5">Un XML par groupe, spectateur inclus. Copie un seul groupe à la fois, sans renommer le fichier, dans <code className="break-all">%APPDATA%\Pro Cycling Manager 2026\Cloud\Startlists\</code>.</p>
      {error ? <p role="alert" className="mt-3 text-xs text-[#F0B9BF]">{error}</p> : null}
      {summary ? <p role="status" className="mt-3 text-xs leading-5 text-[#D2B46B]">S{summary.season} · {summary.simulations} simulations · {summary.teams} équipes · {summary.riders} coureurs<br /><span className="break-all text-[#BFC3CE]">{summary.filename}</span></p> : null}
    </section>
  );

  return (
    <section className="mt-8 overflow-hidden rounded-[1.75rem] border border-[#B9CEC7] bg-white shadow-[0_20px_55px_rgba(20,67,56,0.09)]">
      <div className="border-b border-[#D7E4DF] bg-[#173B58] px-5 py-6 text-white sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#A9D8FA]">
              Courses de gala
            </p>
            <h2 className="mt-1 text-2xl font-black">Startlists PCM26</h2>
          </div>
          <span className="rounded-full border border-[#A9D8FA]/35 bg-[#A9D8FA]/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#D9EEFC]">
            Accès Roger Letesteur
          </span>
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <div>
          <p className="text-sm font-semibold leading-6 text-[#49665E]">
            {eventKey ? "Génère uniquement le XML natif du parcours de ce gala" : "Génère un XML natif pour chacune des trois courses"} à partir des
            inscriptions enregistrées. L’équipe spectateur Cyclostratège et sept
            coureurs Simulo sont automatiquement ajoutés à chaque liste.
          </p>
          <div className="mt-4 rounded-2xl border border-[#BCD8E9] bg-[#EFF8FD] px-4 py-3 text-sm font-semibold leading-6 text-[#315A73]">
            Les identifiants équipes et coureurs sont permanents : ces fichiers
            restent alignés avec les nouvelles extractions de la DB Cyclostratège.
          </div>
          {eventKey ? <p className="mt-4 text-sm font-semibold leading-6 text-[#49665E]">Aucune équipe exclue : au-delà de 20 équipes, l’archive contient plusieurs dossiers Groupe, chacun avec sa startlist. Charge un groupe à la fois dans PCM et enregistre une vidéo par simulation. Utilise une nouvelle extraction de la DB pour activer les sélections de 6 à 8 coureurs.</p> : null}
          {error ? (
            <p role="alert" className="mt-4 rounded-2xl border border-[#D98A8A] bg-[#FFF1F1] px-4 py-3 text-sm font-bold text-[#8F2929]">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleExport}
            disabled={isGenerating}
            className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#173B58] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#173B58]/20 transition hover:bg-[#102E46] disabled:cursor-wait disabled:opacity-65"
          >
            {isGenerating ? "Construction des listes…" : eventKey ? "Télécharger la startlist du gala" : "Télécharger les startlists gala"}
          </button>
          <details className="mt-5 rounded-2xl border border-[#CFE0DA] bg-white px-4 py-3 text-sm text-[#49665E]">
            <summary className="cursor-pointer font-black text-[#123D34]">Installation dans PCM26</summary>
            <p className="mt-3 font-semibold leading-6">
              Décompresse l’archive puis copie {eventKey ? "le fichier XML du groupe à simuler" : "les fichiers XML de la simulation choisie"} dans
              <code> %APPDATA%\Pro Cycling Manager 2026\Cloud\Startlists\</code>.
            </p>
            <p className="mt-2 font-semibold leading-6">En présence de dossiers Groupe, termine une simulation puis remplace le XML par celui du groupe suivant. Garde son nom d’origine : ne copie pas les deux groupes simultanément.</p>
          </details>
        </div>

        <aside className="rounded-2xl border border-[#CFE0DA] bg-[#F3F9F7] p-5">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#278B70]">
            Dernier export de cette session
          </p>
          {summary ? (
            <dl className="mt-4 space-y-3 text-sm">
              <SummaryRow label="Saison" value={`S${summary.season}`} />
              <SummaryRow label="Courses" value={summary.events} />
              <SummaryRow label="Simulations / groupes" value={summary.simulations} />
              <SummaryRow label="Équipes inscrites" value={summary.teams} />
              <SummaryRow label="Coureurs inscrits" value={summary.riders} />
              <div className="border-t border-[#CFE0DA] pt-3">
                <dt className="font-bold text-[#6A817A]">Fichier</dt>
                <dd className="mt-1 break-all font-black text-[#123D34]">{summary.filename}</dd>
              </div>
              <div>
                <dt className="font-bold text-[#6A817A]">Généré le</dt>
                <dd className="mt-1 font-black text-[#123D34]">{formatGeneratedAt(summary.generatedAt)}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm font-semibold leading-6 text-[#6A817A]">
              Aucun export de startlists généré depuis l’ouverture de cette page.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#DCE9E4] pb-2">
      <dt className="font-bold text-[#6A817A]">{label}</dt>
      <dd className="font-black text-[#123D34]">{value}</dd>
    </div>
  );
}

function readFilename(response: Response) {
  return response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? null;
}

function formatGeneratedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Europe/Paris",
  }).format(date);
}

