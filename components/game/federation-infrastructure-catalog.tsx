"use client";

import Image from "next/image";
import { useState } from "react";

import {
  FEDERATION_INFRASTRUCTURE_DEFINITIONS,
  MAX_FEDERATION_PROJECT_ARCHITECTS,
  calculateFederationConstructionPreview,
  type FederationConstructionPriority,
  type FederationInfrastructureDefinition,
} from "@/lib/game/federation-infrastructures";

type FederationInfrastructureCatalogProps = {
  currency?: string;
  managementLocked: boolean;
};

const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const PRIORITIES: Array<{
  value: FederationConstructionPriority;
  label: string;
  detail: string;
}> = [
  {
    value: "balanced",
    label: "Équilibré",
    detail: "−2 % de coût et −3 % de délai par architecte",
  },
  {
    value: "cost",
    label: "Maîtrise du budget",
    detail: "−4 % de coût par architecte",
  },
  {
    value: "time",
    label: "Livraison rapide",
    detail: "−6 % de délai par architecte",
  },
];

export function FederationInfrastructureCatalog({
  currency = "EUR",
  managementLocked,
}: FederationInfrastructureCatalogProps) {
  const [architectCount, setArchitectCount] = useState(0);
  const [priority, setPriority] =
    useState<FederationConstructionPriority>("balanced");

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.07)]">
        <div className="grid gap-6 bg-[#123F36] p-6 text-white sm:p-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)] xl:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9BE0BC]">
              Cellule des grands travaux · Préparation S3
            </p>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">
              Neuf infrastructures, cinq niveaux chacune
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#D6DFD2]">
              Les bâtiments sont financés par la trésorerie fédérale. Les
              effets sont modestes, plafonnés et figés par saison afin de ne pas
              créer de recalcul pendant les courses.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <CatalogMetric label="Bâtiments" value="9" />
            <CatalogMetric label="Niveaux" value="45" />
            <CatalogMetric label="Architectes" value="0–5" />
          </div>
        </div>

        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(260px,0.55fr)]">
          <label className="block">
            <span className="flex items-center justify-between gap-4 text-sm font-black text-[#183F37]">
              <span>Architectes mobilisés par les équipes affiliées</span>
              <span className="rounded-full bg-[#DDF3E7] px-3 py-1 text-xs text-[#176951]">
                {architectCount}/{MAX_FEDERATION_PROJECT_ARCHITECTS}
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={MAX_FEDERATION_PROJECT_ARCHITECTS}
              value={architectCount}
              onChange={(event) => setArchitectCount(Number(event.target.value))}
              className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#DDE8E2] accent-[#176951]"
            />
            <span className="mt-3 block text-xs font-semibold leading-5 text-[#60756E]">
              Jusqu’à cinq architectes issus de clubs différents pourront
              contribuer au même chantier.
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[#60756E]">
              Priorité du chantier
            </span>
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as FederationConstructionPriority)
              }
              className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/18 bg-[#F8FBF9] px-4 text-sm font-black text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#42B99A]/25"
            >
              {PRIORITIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="mt-2 block text-xs font-semibold text-[#60756E]">
              {PRIORITIES.find((option) => option.value === priority)?.detail}
            </span>
          </label>
        </div>

        <p className="border-t border-[#315B3E]/10 bg-[#FFF9DE] px-6 py-4 text-xs font-bold leading-5 text-[#75631C] sm:px-8">
          Un architecte ajouté après le lancement applique aussi sa réduction :
          l’économie obtenue est recréditée automatiquement à la fédération.
          Aucun club ne reçoit directement l’argent économisé.
        </p>
      </section>

      {FEDERATION_INFRASTRUCTURE_DEFINITIONS.map((definition) => (
        <FederationInfrastructureCard
          key={definition.code}
          definition={definition}
          architectCount={architectCount}
          priority={priority}
          currency={currency}
          managementLocked={managementLocked}
        />
      ))}
    </div>
  );
}

function FederationInfrastructureCard({
  definition,
  architectCount,
  priority,
  currency,
  managementLocked,
}: {
  definition: FederationInfrastructureDefinition;
  architectCount: number;
  priority: FederationConstructionPriority;
  currency: string;
  managementLocked: boolean;
}) {
  const [selectedLevel, setSelectedLevel] = useState(1);
  const level =
    definition.levels.find((candidate) => candidate.level === selectedLevel) ??
    definition.levels[0];
  const quote = calculateFederationConstructionPreview({
    level,
    architectCount,
    priority,
  });

  return (
    <article className="overflow-hidden rounded-[1.9rem] border border-[#315B3E]/15 bg-white shadow-[0_16px_44px_rgba(19,60,46,0.09)]">
      <div className="relative isolate min-h-[250px] overflow-hidden bg-[#071A17] text-white sm:min-h-[285px]">
        <Image
          src={definition.illustration.src}
          alt={definition.illustration.alt}
          fill
          sizes="(max-width: 768px) 100vw, 1400px"
          className="object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,26,23,0.97)_0%,rgba(7,26,23,0.84)_45%,rgba(7,26,23,0.26)_82%),linear-gradient(0deg,rgba(7,26,23,0.82)_0%,transparent_65%)]"
        />
        <div className="relative flex min-h-[250px] flex-col justify-between gap-8 p-6 sm:min-h-[285px] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span className="rounded-full border border-[#F2C94C]/40 bg-[#071A17]/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#FFE897] backdrop-blur-sm">
              Dès {formatMoney(definition.levels[0].cost, currency)}
            </span>
            <span className="rounded-full border border-white/20 bg-[#071A17]/70 px-4 py-2 text-xs font-black backdrop-blur-sm">
              Niveau 0/5 · S3
            </span>
          </div>
          <div className="max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F2C94C]">
              {definition.domain}
            </p>
            <h3 className="mt-2 text-3xl font-black tracking-[-0.03em] sm:text-4xl">
              {definition.name}
            </h3>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#D6DFD2] sm:text-base">
              {definition.summary}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-7 p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_minmax(310px,0.42fr)]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#278B70]">
            Apports niveau par niveau
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-5">
            {definition.levels.map((candidate) => (
              <button
                key={candidate.level}
                type="button"
                onClick={() => setSelectedLevel(candidate.level)}
                aria-pressed={selectedLevel === candidate.level}
                className={`rounded-xl border p-3 text-left transition ${
                  selectedLevel === candidate.level
                    ? "border-[#278B70]/55 bg-[#E5F4ED] shadow-sm"
                    : "border-[#315B3E]/10 bg-[#F6F8F6] hover:border-[#278B70]/30"
                }`}
              >
                <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">
                  Niveau {candidate.level}
                </span>
                <span className="mt-1 block text-xs font-bold leading-5 text-[#183F37]">
                  {candidate.effect}
                </span>
                <span className="mt-3 block text-[10px] font-black text-[#278B70]">
                  {formatMoney(candidate.cost, currency)} · {candidate.durationDays} j
                </span>
              </button>
            ))}
          </div>
          <p className="mt-4 rounded-xl border border-[#315B3E]/10 bg-[#F8FBF9] px-4 py-3 text-xs font-semibold leading-5 text-[#60756E]">
            <strong className="text-[#183F37]">Garde-fou :</strong>{" "}
            {definition.principle}
          </p>
        </div>

        <aside className="h-fit rounded-2xl border border-[#F2C94C]/35 bg-[#FFF9E5] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#75631C]">
            Devis prévisionnel · niveau {level.level}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <QuoteMetric label="Coût fédéral" value={formatMoney(quote.cost, currency)} />
            <QuoteMetric label="Durée" value={`${quote.durationDays} jours`} />
            <QuoteMetric
              label="Économie"
              value={quote.savedAmount > 0 ? formatMoney(quote.savedAmount, currency) : "—"}
            />
            <QuoteMetric
              label="Temps gagné"
              value={quote.savedDays > 0 ? `${quote.savedDays} jour${quote.savedDays > 1 ? "s" : ""}` : "—"}
            />
          </dl>
          <p className="mt-4 text-xs font-bold leading-5 text-[#75631C]">
            {quote.architectCount > 0
              ? `${quote.architectCount} architecte${quote.architectCount > 1 ? "s" : ""} · −${quote.costReductionPercentage} % coût · −${quote.durationReductionPercentage} % délai`
              : "Aucun architecte mobilisé sur cette estimation."}
          </p>
          <button
            type="button"
            disabled={managementLocked}
            className="mt-5 min-h-11 w-full rounded-xl bg-[#123F36] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#9AA9A3]"
          >
            {managementLocked ? "Construction disponible en S3" : `Lancer le niveau ${level.level}`}
          </button>
        </aside>
      </div>
    </article>
  );
}

function CatalogMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 p-3">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#BFD1C6]">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function QuoteMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] font-black uppercase tracking-[0.12em] text-[#806300]">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-black text-[#183F37]">{value}</dd>
    </div>
  );
}

function formatMoney(value: number, currency: string): string {
  if (currency === "EUR") return moneyFormatter.format(value);

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
