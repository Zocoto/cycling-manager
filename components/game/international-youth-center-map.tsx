"use client";

import { useMemo, useState } from "react";

import { startInfrastructureProjectAction } from "@/app/jeu/infrastructures/actions";
import { InfrastructureSubmitButton } from "@/components/game/infrastructure-submit-button";
import Link from "@/components/ui/app-link";
import { projectCountryCoordinate } from "@/data/country-map-coordinates";
import { getInternationalCenterLevelDefinition } from "@/lib/game/infrastructure";
import { calculateConstructionWithArchitect } from "@/lib/game/staff";
import type {
  InfrastructureArchitect,
  InfrastructureCountry,
  InfrastructureProject,
} from "@/services/team-infrastructures";

export function InternationalYouthCenterMap({
  countries,
  architects,
  activeProject,
  isUnlocked,
  balance,
  currency,
}: {
  countries: InfrastructureCountry[];
  architects: InfrastructureArchitect[];
  activeProject: InfrastructureProject | null;
  isUnlocked: boolean;
  balance: number;
  currency: string;
}) {
  const [search, setSearch] = useState("");
  const [selectedCountryId, setSelectedCountryId] = useState(
    countries.find((country) => country.code === "FR")?.id ??
      countries[0]?.id ??
      "",
  );
  const [architectContractId, setArchitectContractId] = useState("");
  const selected =
    countries.find((country) => country.id === selectedCountryId) ??
    countries[0];
  const filtered = useMemo(() => {
    const query = normalize(search);
    return query
      ? countries
          .filter(
            (country) =>
              normalize(country.name).includes(query) ||
              country.code.toLocaleLowerCase("fr").includes(query),
          )
          .slice(0, 12)
      : countries.slice(0, 8);
  }, [countries, search]);

  if (!selected) return null;

  const nextLevel = getInternationalCenterLevelDefinition(
    selected.currentTeamLevel + 1,
  );
  const selectedArchitect =
    architects.find(
      (architect) => architect.contractId === architectContractId,
    ) ?? null;
  const quote = nextLevel
    ? calculateConstructionWithArchitect({
        baseCost: nextLevel.cost,
        baseDurationDays: nextLevel.durationDays,
        architectLevel: selectedArchitect?.level,
        architectSpecialty: selectedArchitect?.specialty,
      })
    : null;
  const blockReason = !isUnlocked
    ? "Le niveau 10 de Directeur Sportif est requis."
    : activeProject
      ? "Un autre chantier est déjà en cours."
      : !nextLevel
        ? "Votre centre a atteint cinq étoiles."
        : quote && balance < quote.cost
          ? "Trésorerie insuffisante pour ce chantier."
          : null;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.78fr)]">
      <section className="overflow-hidden rounded-[1.75rem] border border-[#315B3E]/15 bg-[#0B302B] shadow-[0_18px_45px_rgba(11,48,43,0.15)]">
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#72D4B7]">
              École de cyclisme internationale
            </p>
            <h2 className="mt-1 text-xl font-black text-white">
              Construire un centre dans le monde
            </h2>
          </div>
          <label className="relative block sm:w-72">
            <span className="sr-only">Rechercher un pays</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
              placeholder="Rechercher un pays…"
              className="min-h-11 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-bold text-white outline-none placeholder:text-[#D6DFD2]/60 focus:border-[#F2C94C] focus:ring-2 focus:ring-[#F2C94C]/20"
            />
          </label>
        </div>

        <div className="relative aspect-[2/1] min-h-[330px] overflow-hidden bg-[radial-gradient(circle_at_50%_45%,#176951_0%,#0B302B_58%,#071A17_100%)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[length:100%_100%] bg-center bg-no-repeat"
            style={{
              backgroundImage: 'url("/images/scouting-world-map.svg")',
            }}
          />
          <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-[#071A17]/65 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#D6DFD2] backdrop-blur-md">
            {countries.reduce(
              (total, country) => total + country.centers.length,
              0,
            )}{" "}
            centres construits
          </div>
          {countries.map((country) => {
            const point = projectCountryCoordinate({
              latitude: country.latitude,
              longitude: country.longitude,
            });
            const isSelected = country.id === selected.id;
            const hasCenter = country.centers.length > 0;
            return (
              <button
                key={country.id}
                type="button"
                title={`${country.name} · ${country.globalBonusPercentage} %`}
                aria-label={`Sélectionner ${country.name}`}
                onClick={() => setSelectedCountryId(country.id)}
                className={`group absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  isSelected ? "z-20" : "z-10 hover:z-20"
                }`}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              >
                <span
                  className={`block rounded-full border transition ${
                    isSelected
                      ? "h-4 w-4 border-white bg-[#F2C94C] shadow-[0_0_0_7px_rgba(242,201,76,0.2),0_0_22px_rgba(242,201,76,0.65)]"
                      : hasCenter
                        ? "h-3 w-3 border-white/80 bg-[#F2C94C] shadow-[0_0_12px_rgba(242,201,76,0.65)]"
                        : "h-2 w-2 border-[#C9F0E4]/60 bg-[#72D4B7]/80 shadow-[0_0_7px_rgba(114,212,183,0.4)] group-hover:h-3 group-hover:w-3"
                  }`}
                />
                {isSelected ? (
                  <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#F2C94C]/50 bg-[#071A17]/90 px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-white shadow-lg backdrop-blur-md">
                    {country.code} · {country.name}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex min-h-16 flex-wrap items-center gap-2 border-t border-white/10 bg-[#071A17]/55 px-5 py-3">
          {filtered.map((country) => (
            <button
              key={country.id}
              type="button"
              onClick={() => setSelectedCountryId(country.id)}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] transition ${
                country.id === selected.id
                  ? "border-[#F2C94C] bg-[#F2C94C] text-[#071A17]"
                  : "border-white/15 bg-[#071A17]/70 text-[#D6DFD2] hover:border-[#72D4B7]"
              }`}
            >
              {country.code} · {country.name}
              {country.centers.length ? ` · ${country.centers.length}` : ""}
            </button>
          ))}
        </div>
      </section>

      <aside className="rounded-[1.75rem] border border-[#315B3E]/15 bg-[#FFFDF4] p-6 shadow-[0_18px_45px_rgba(11,48,43,0.1)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">
              Pays sélectionné
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#071A17]">
              {selected.name}
            </h2>
          </div>
          <span
            className={`fi fi-${selected.code.toLowerCase()} mt-1 h-8 w-11 rounded shadow-sm`}
            aria-label={selected.code}
          />
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3">
          <Metric
            label="Étoiles mondiales"
            value={String(selected.totalQualityStars)}
          />
          <Metric
            label="Chance partagée"
            value={`+${selected.globalBonusPercentage} %`}
            accent
          />
        </dl>

        <div className="mt-5 rounded-2xl border border-[#315B3E]/10 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#60756E]">
            Camps déjà construits
          </p>
          {selected.centers.length ? (
            <ul className="mt-3 space-y-3">
              {selected.centers.map((center) => (
                <li
                  key={center.id}
                  className="rounded-xl border border-[#315B3E]/10 bg-[#F3F8F6] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/jeu/equipes/${center.teamId}`}
                        className="text-sm font-black text-[#183F37] hover:text-[#176951]"
                      >
                        {center.teamName}
                      </Link>
                      <p className="mt-1 text-[10px] font-bold text-[#60756E]">
                        {center.directorIdentifier ? (
                          <Link
                            href={`/jeu/directeurs-sportifs/${encodeURIComponent(
                              center.directorIdentifier,
                            )}`}
                            className="hover:text-[#176951]"
                          >
                            DS · {center.directorName}
                          </Link>
                        ) : (
                          <>DS · {center.directorName}</>
                        )}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-xs font-black text-[#E2A63B]">
                      {"★".repeat(center.qualityLevel)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm font-semibold text-[#60756E]">
              Aucun centre n’a encore été construit dans ce pays.
            </p>
          )}
        </div>

        {nextLevel && quote ? (
          <form
            action={startInfrastructureProjectAction}
            className="mt-5 space-y-4"
          >
            <input
              type="hidden"
              name="infrastructureCode"
              value="international_youth_center"
            />
            <input type="hidden" name="countryId" value={selected.id} />
            <div className="rounded-2xl bg-[#0B302B] p-4 text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9BE0BC]">
                Prochaine amélioration
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-black">
                    Niveau {nextLevel.level}{" "}
                    <span className="text-[#F2C94C]">
                      {"★".repeat(nextLevel.level)}
                    </span>
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#BFD1C6]">
                    +{nextLevel.bonusPercentage} % dans ce pays grâce à
                    votre centre
                  </p>
                </div>
              </div>
            </div>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#60756E]">
                Architecte du chantier
              </span>
              <select
                name="architectContractId"
                value={architectContractId}
                onChange={(event) =>
                  setArchitectContractId(event.target.value)
                }
                className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/15 bg-white px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70]"
              >
                <option value="">Sans architecte</option>
                {architects.map((architect) => (
                  <option
                    key={architect.contractId}
                    value={architect.contractId}
                  >
                    {architect.firstName} {architect.lastName} · N
                    {architect.level} · {architect.specialtyLabel}
                  </option>
                ))}
              </select>
            </label>
            <dl className="grid grid-cols-2 gap-3">
              <Metric
                label="Coût définitif"
                value={formatMoney(quote.cost, currency)}
              />
              <Metric
                label="Durée définitive"
                value={`${quote.durationDays} jours`}
              />
            </dl>
            {selectedArchitect ? (
              <p className="text-xs font-bold text-[#176951]">
                Architecte : −{quote.costReductionPercentage} % sur le
                coût et −{quote.durationReductionPercentage} % sur le délai.
              </p>
            ) : null}
            <InfrastructureSubmitButton disabled={Boolean(blockReason)}>
              {selected.currentTeamLevel
                ? "Améliorer ce centre"
                : "Construire ce centre"}
            </InfrastructureSubmitButton>
            {blockReason ? (
              <p className="text-xs font-bold text-[#B54242]">
                {blockReason}
              </p>
            ) : null}
          </form>
        ) : (
          <p className="mt-5 rounded-2xl bg-[#F2C94C]/20 p-4 text-sm font-black text-[#71580A]">
            Votre centre a atteint la qualité maximale de cinq étoiles.
          </p>
        )}
      </aside>
    </div>
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${
        accent
          ? "border-[#F2C94C]/60 bg-[#F2C94C]/15"
          : "border-[#315B3E]/10 bg-white"
      }`}
    >
      <dt className="text-[9px] font-black uppercase tracking-[0.13em] text-[#60756E]">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-black text-[#071A17]">{value}</dd>
    </div>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("fr");
}
