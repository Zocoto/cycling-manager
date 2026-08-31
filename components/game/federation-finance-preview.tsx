"use client";

import { useMemo, useState } from "react";

import {
  calculateFederationFinancePreview,
  type FederationObjectiveLevel,
} from "@/lib/game/federation-finance-preview";

type FederationFinancePreviewProps = {
  initialNationRank: number;
  initialDivision: 1 | 2 | 3 | 4;
  memberTeamCount: number;
};

const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat("fr-FR");
const compactMoneyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const OBJECTIVE_OPTIONS: Array<{
  value: FederationObjectiveLevel;
  label: string;
  bonus: string;
}> = [
  { value: "none", label: "Non atteint", bonus: "+0 %" },
  { value: "bronze", label: "Socle", bonus: "+3 %" },
  { value: "silver", label: "Solide", bonus: "+6 %" },
  { value: "gold", label: "Exemplaire", bonus: "+10 %" },
];

export function FederationFinancePreview({
  initialNationRank,
  initialDivision,
  memberTeamCount,
}: FederationFinancePreviewProps) {
  const [nationRank, setNationRank] = useState(initialNationRank);
  const [division, setDivision] = useState(initialDivision);
  const [raceDays, setRaceDays] = useState(10);
  const [averageStarters, setAverageStarters] = useState(120);
  const [donations, setDonations] = useState(memberTeamCount * 25_000);
  const [objectiveLevel, setObjectiveLevel] =
    useState<FederationObjectiveLevel>("silver");

  const preview = useMemo(
    () =>
      calculateFederationFinancePreview({
        nationRank,
        division,
        raceDays,
        averageStarters,
        donations,
        objectiveLevel,
      }),
    [nationRank, division, raceDays, averageStarters, donations, objectiveLevel],
  );

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.07)]">
      <div className="grid gap-5 bg-[#123F36] p-6 text-white sm:p-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9BE0BC]">
              Simulateur budgétaire S3
            </p>
            <span className="rounded-full border border-[#F2C94C]/35 bg-[#F2C94C]/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#FFE790]">
              Prévision sans transaction
            </span>
          </div>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">
            {moneyFormatter.format(preview.totalRevenue)}
          </h2>
          <p className="mt-2 text-sm font-semibold text-[#D6DFD2]">
            Recettes annuelles simulées · valeurs de travail révisables avant
            l’activation
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <BudgetEnvelope
            label="Réserve"
            value={preview.reserveEnvelope}
            ratio="35 %"
          />
          <BudgetEnvelope
            label="Bâtiments"
            value={preview.infrastructureEnvelope}
            ratio="40 %"
          />
          <BudgetEnvelope
            label="Solidarité"
            value={preview.solidarityEnvelope}
            ratio="25 % max."
          />
        </div>
      </div>

      <div className="grid gap-8 p-6 sm:p-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#278B70]">
            Hypothèses ajustables
          </p>
          <div className="mt-5 space-y-5">
            <RangeControl
              label="Classement UCI précédent"
              value={nationRank}
              displayValue={`#${nationRank}`}
              minimum={1}
              maximum={173}
              onChange={setNationRank}
            />
            <RangeControl
              label="Journées de course dans le pays"
              value={raceDays}
              displayValue={`${raceDays} jour${raceDays > 1 ? "s" : ""}`}
              minimum={0}
              maximum={40}
              onChange={setRaceDays}
            />
            <RangeControl
              label="Partants moyens par journée"
              value={averageStarters}
              displayValue={integerFormatter.format(averageStarters)}
              minimum={0}
              maximum={200}
              step={5}
              onChange={setAverageStarters}
            />
            <RangeControl
              label="Dons volontaires estimés"
              value={donations}
              displayValue={moneyFormatter.format(donations)}
              minimum={0}
              maximum={Math.max(500_000, memberTeamCount * 150_000)}
              step={25_000}
              onChange={setDonations}
            />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-[#60756E]">
                Division Nations Cup
              </span>
              <select
                value={division}
                onChange={(event) =>
                  setDivision(Number(event.target.value) as 1 | 2 | 3 | 4)
                }
                className="mt-2 w-full rounded-xl border border-[#315B3E]/18 bg-[#F8FBF9] px-4 py-3 text-sm font-black text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#42B99A]/25"
              >
                {[1, 2, 3, 4].map((value) => (
                  <option key={value} value={value}>
                    Division {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-[#60756E]">
                Objectifs fédéraux
              </span>
              <select
                value={objectiveLevel}
                onChange={(event) =>
                  setObjectiveLevel(
                    event.target.value as FederationObjectiveLevel,
                  )
                }
                className="mt-2 w-full rounded-xl border border-[#315B3E]/18 bg-[#F8FBF9] px-4 py-3 text-sm font-black text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#42B99A]/25"
              >
                {OBJECTIVE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} · {option.bonus}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#278B70]">
            Composition de la prévision
          </p>
          <dl className="mt-5 divide-y divide-[#315B3E]/10 overflow-hidden rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9]">
            <FinanceLine
              label="Socle commun"
              detail="Même base pour chaque fédération active"
              value={preview.commonGrant}
            />
            <FinanceLine
              label="Dotation UCI"
              detail={`Calculée sur le rang #${nationRank} de la saison précédente`}
              value={preview.uciGrant}
            />
            <FinanceLine
              label="Nations Cup"
              detail={`Hypothèse de maintien en Division ${division}`}
              value={preview.nationsCupGrant}
            />
            <FinanceLine
              label="Courses du pays"
              detail={`${raceDays} journées · ${Math.round(preview.courseFillRate * 100)} % de remplissage`}
              value={preview.raceRevenue}
            />
            <FinanceLine
              label="Bonus d’objectifs"
              detail="Plafonné à 10 % des dotations structurelles"
              value={preview.objectiveBonus}
            />
            <FinanceLine
              label="Dons des équipes"
              detail="Hypothèse uniquement, aucun débit en Saison 2"
              value={preview.donations}
            />
          </dl>
          <div className="mt-4 rounded-2xl border border-[#D5AC18]/25 bg-[#FFF9DE] p-4 text-xs font-bold leading-5 text-[#75631C]">
            Les recettes de course utilisent les partants réellement présents,
            pas les seuls inscrits. Les trois enveloppes sont des garde-fous de
            simulation : le règlement économique final restera à valider avant
            la Saison 3.
          </div>
        </div>
      </div>
    </section>
  );
}

function RangeControl({
  label,
  value,
  displayValue,
  minimum,
  maximum,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  displayValue: string;
  minimum: number;
  maximum: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-4 text-sm font-black text-[#183F37]">
        <span>{label}</span>
        <span className="shrink-0 rounded-full bg-[#DDF3E7] px-3 py-1 text-xs text-[#176951]">
          {displayValue}
        </span>
      </span>
      <input
        type="range"
        min={minimum}
        max={maximum}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#DDE8E2] accent-[#176951]"
      />
    </label>
  );
}

function FinanceLine({
  label,
  detail,
  value,
}: {
  label: string;
  detail: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-4">
      <div>
        <dt className="font-black text-[#183F37]">{label}</dt>
        <dd className="mt-1 text-xs font-semibold text-[#60756E]">{detail}</dd>
      </div>
      <dd className="shrink-0 text-sm font-black text-[#176951]">
        {moneyFormatter.format(value)}
      </dd>
    </div>
  );
}

function BudgetEnvelope({
  label,
  value,
  ratio,
}: {
  label: string;
  value: number;
  ratio: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/15 bg-white/10 p-3">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#BFD1C6]">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-black text-white">
        <span className="sm:hidden">{compactMoneyFormatter.format(value)}</span>
        <span className="hidden sm:inline">{moneyFormatter.format(value)}</span>
      </p>
      <p className="mt-1 text-[9px] font-bold text-[#9BE0BC]">{ratio}</p>
    </div>
  );
}
