"use client";

import { useState } from "react";

type ExportSummary = {
  filename: string;
  season: string;
  teams: string;
  riders: string;
  contracts: string;
  ratingRange: string;
  countryFallbacks: string;
  generatedAt: string;
};

export function PcmExportPanel() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ExportSummary | null>(null);

  async function handleExport() {
    if (isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/pcm-export", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "X-CS-Requested-With": "pcm-export-admin",
        },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          payload?.error ?? "La génération du fichier PCM26 a échoué.",
        );
      }

      const blob = await response.blob();
      const filename = readFilename(response) ?? "Cyclostratege-PCM26.cdb";
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
        teams: response.headers.get("X-CS-Teams") ?? "—",
        riders: response.headers.get("X-CS-Riders") ?? "—",
        contracts: response.headers.get("X-CS-Contracts") ?? "—",
        ratingRange: response.headers.get("X-CS-Rating-Range") ?? "—",
        countryFallbacks:
          response.headers.get("X-CS-Country-Fallbacks") ?? "—",
        generatedAt:
          response.headers.get("X-CS-Generated-At") ?? new Date().toISOString(),
      });
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "La génération du fichier PCM26 a échoué.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="mt-8 overflow-hidden rounded-[1.75rem] border border-[#B9CEC7] bg-white shadow-[0_20px_55px_rgba(20,67,56,0.09)]">
      <div className="border-b border-[#D7E4DF] bg-[#123D34] px-5 py-6 text-white sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#9BE0CA]">
              Export sécurisé
            </p>
            <h2 className="mt-1 text-2xl font-black">Base Cyclostratège pour PCM26</h2>
          </div>
          <span className="rounded-full border border-[#9BE0CA]/35 bg-[#9BE0CA]/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#C8F0E4]">
            Accès Roger Letesteur
          </span>
        </div>
      </div>

      <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <div>
          <h3 className="text-lg font-black text-[#123D34]">Contenu du fichier</h3>
          <ul className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-[#49665E] sm:grid-cols-2">
            <ScopeItem>Équipes actives de la saison en cours</ScopeItem>
            <ScopeItem>Coureurs sous contrat et contrats actifs</ScopeItem>
            <ScopeItem>13 notes natives converties entre 50 et 85</ScopeItem>
            <ScopeItem>Taille, poids, âge, nationalité et division</ScopeItem>
            <ScopeItem>Courses et étapes de la base officielle PCM26</ScopeItem>
          </ul>

          <div className="mt-6 rounded-2xl border border-[#E1C66B]/45 bg-[#FFF8DF] px-4 py-3 text-sm font-semibold leading-6 text-[#6C5713]">
            Les bonus de forme, d’équipement et de préparation ne sont pas inclus.
            Les maillots et autres assets graphiques restent à installer séparément.
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-5 rounded-2xl border border-[#D98A8A] bg-[#FFF1F1] px-4 py-3 text-sm font-bold text-[#8F2929]"
            >
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleExport}
            disabled={isGenerating}
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#176951] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#176951]/20 transition hover:bg-[#0F5742] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65"
          >
            {isGenerating
              ? "Extraction et contrôle en cours…"
              : "Générer et télécharger la base PCM26"}
          </button>
          <p className="mt-3 text-xs font-semibold leading-5 text-[#6A817A]">
            La base est relue et contrôlée avant le téléchargement. Compter quelques
            secondes selon la charge du serveur.
          </p>

          <details className="mt-5 rounded-2xl border border-[#CFE0DA] bg-white px-4 py-3 text-sm text-[#49665E]">
            <summary className="cursor-pointer font-black text-[#123D34]">
              Où placer le fichier ?
            </summary>
            <p className="mt-3 font-semibold leading-6">
              Remplace le fichier <code>OfficialRelease.cdb</code> du dossier de ton
              mod Cyclostratège dans <code>AppData\Roaming\Pro Cycling Manager 2026\Mod</code>,
              puis sélectionne ce mod dans PCM26.
            </p>
          </details>
        </div>

        <aside className="rounded-2xl border border-[#CFE0DA] bg-[#F3F9F7] p-5">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#278B70]">
            Dernier export de cette session
          </p>
          {summary ? (
            <dl className="mt-4 space-y-3 text-sm">
              <SummaryRow label="Saison" value={`S${summary.season}`} />
              <SummaryRow label="Équipes" value={summary.teams} />
              <SummaryRow label="Coureurs" value={summary.riders} />
              <SummaryRow label="Contrats" value={summary.contracts} />
              <SummaryRow label="Notes PCM" value={summary.ratingRange} />
              <SummaryRow
                label="Nationalités de repli"
                value={summary.countryFallbacks}
              />
              <div className="border-t border-[#CFE0DA] pt-3">
                <dt className="font-bold text-[#6A817A]">Fichier</dt>
                <dd className="mt-1 break-all font-black text-[#123D34]">
                  {summary.filename}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-[#6A817A]">Généré le</dt>
                <dd className="mt-1 font-black text-[#123D34]">
                  {formatGeneratedAt(summary.generatedAt)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm font-semibold leading-6 text-[#6A817A]">
              Aucun export généré depuis l’ouverture de cette page.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

function ScopeItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 rounded-xl bg-[#F4F8F6] px-3 py-2.5">
      <span aria-hidden="true" className="font-black text-[#278B70]">
        ✓
      </span>
      <span>{children}</span>
    </li>
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
  const disposition = response.headers.get("Content-Disposition");
  return disposition?.match(/filename="([^"]+)"/)?.[1] ?? null;
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
