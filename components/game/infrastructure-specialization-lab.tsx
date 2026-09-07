"use client";

import { useMemo, useState } from "react";

import {
  FEDERATION_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS,
  TEAM_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS,
  type InfrastructureSpecializationOption,
  type InfrastructureSpecializationScope,
} from "@/lib/game/infrastructure-specializations";

const PROPOSALS_BY_SCOPE = {
  team: TEAM_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS,
  federation: FEDERATION_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS,
} as const;

export function InfrastructureSpecializationLab() {
  const [scope, setScope] =
    useState<InfrastructureSpecializationScope>("team");
  const [buildingCode, setBuildingCode] = useState(
    TEAM_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS[0].buildingCode,
  );
  const [draftChoices, setDraftChoices] = useState<Record<string, string>>({});
  const proposals = PROPOSALS_BY_SCOPE[scope];
  const proposal = useMemo(
    () =>
      proposals.find((candidate) => candidate.buildingCode === buildingCode) ??
      proposals[0],
    [buildingCode, proposals],
  );
  const selectedCode = draftChoices[proposal.buildingCode] ?? "";
  const selectedOption = proposal.options.find(
    (candidate) => candidate.code === selectedCode,
  );

  function changeScope(nextScope: InfrastructureSpecializationScope) {
    setScope(nextScope);
    setBuildingCode(PROPOSALS_BY_SCOPE[nextScope][0].buildingCode);
  }

  return (
    <div className="space-y-6" data-persistence="local-only">
      <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_18px_55px_rgba(19,60,46,0.09)] sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#397A67]">
              Périmètre à comparer
            </p>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#66877C]">
              Chaque bâtiment propose trois orientations exclusives dotées du
              même budget de puissance. Les valeurs affichées correspondent au
              niveau 5.
            </p>
          </div>
          <div className="inline-flex rounded-2xl bg-[#EAF5F0] p-1">
            <ScopeButton
              active={scope === "team"}
              onClick={() => changeScope("team")}
            >
              Équipe · {TEAM_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS.length}
            </ScopeButton>
            <ScopeButton
              active={scope === "federation"}
              onClick={() => changeScope("federation")}
            >
              Fédération · {FEDERATION_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS.length}
            </ScopeButton>
          </div>
        </div>

        <label className="mt-6 block text-[10px] font-black uppercase tracking-[0.16em] text-[#397A67]">
          Bâtiment étudié
          <select
            value={proposal.buildingCode}
            onChange={(event) => setBuildingCode(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/18 bg-white px-4 text-sm font-black normal-case tracking-normal text-[#0B302B] outline-none focus:border-[#278B70] sm:max-w-xl"
          >
            {proposals.map((candidate) => (
              <option
                key={candidate.buildingCode}
                value={candidate.buildingCode}
              >
                {candidate.buildingName}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_18px_55px_rgba(19,60,46,0.09)]">
        <header className="bg-[linear-gradient(135deg,#0B302B,#176951)] px-5 py-6 text-white sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9BE0BC]">
                {scope === "team" ? "Installation d’équipe" : "Installation fédérale"}
              </p>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                {proposal.buildingName}
              </h2>
              <p className="mt-2 text-sm font-bold text-[#CBE6D8]">
                {proposal.domain} · {proposal.unlockRule}
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-right">
              <p className="text-[9px] font-black uppercase tracking-wide text-[#9BE0BC]">
                Échelle proposée
              </p>
              <p className="mt-1 text-sm font-black">N3 60 % · N4 80 % · N5 100 %</p>
            </div>
          </div>
        </header>

        <div className="grid gap-4 p-5 lg:grid-cols-3 sm:p-8">
          {proposal.options.map((candidate) => (
            <SpecializationCard
              key={candidate.code}
              option={candidate}
              selected={candidate.code === selectedCode}
              onSelect={() =>
                setDraftChoices((current) => ({
                  ...current,
                  [proposal.buildingCode]: candidate.code,
                }))
              }
            />
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#B98B18]/25 bg-[#FFF9E8] p-5 shadow-[0_14px_40px_rgba(113,88,10,0.08)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8A6B11]">
              Synthèse locale
            </p>
            <h3 className="mt-2 text-xl font-black text-[#3D351D]">
              {selectedOption
                ? `${proposal.buildingName} · ${selectedOption.name}`
                : "Aucune orientation sélectionnée"}
            </h3>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#756A47]">
              {selectedOption
                ? selectedOption.identity
                : "Sélectionnez une carte pour comparer son identité et ses limites. Votre choix disparaîtra au rechargement de la page."}
            </p>
          </div>
          <span className="rounded-full border border-[#B98B18]/30 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wide text-[#71580A]">
            Non enregistré · Aucun effet
          </span>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <PrincipleCard
          number="01"
          title="Choix lisible"
          text="Une seule branche par bâtiment, afin que deux équipes de même niveau puissent conserver une identité différente."
        />
        <PrincipleCard
          number="02"
          title="Puissance égale"
          text="Chaque branche consomme 100 points de budget d’effet ; la différence vient de la situation où le bonus devient utile."
        />
        <PrincipleCard
          number="03"
          title="Réorientation cadrée"
          text="Proposition pour la version finale : un changement par saison, sept jours de transition et 10 % du coût cumulé du bâtiment."
        />
      </section>
    </div>
  );
}

function ScopeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-10 rounded-xl px-4 text-xs font-black transition ${
        active
          ? "bg-[#0B302B] text-white shadow-sm"
          : "text-[#397A67] hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

function SpecializationCard({
  option: specialization,
  selected,
  onSelect,
}: {
  option: InfrastructureSpecializationOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={`flex min-h-full flex-col rounded-2xl border p-5 transition ${
        selected
          ? "border-[#278B70] bg-[#EAF5F0] shadow-[0_14px_35px_rgba(39,139,112,0.16)]"
          : "border-[#315B3E]/12 bg-[#F8FBF9]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#397A67]">
            Orientation
          </p>
          <h3 className="mt-2 text-lg font-black text-[#0B302B]">
            {specialization.name}
          </h3>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-[#176951]">
          {specialization.powerBudget}/100
        </span>
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-[#66877C]">
        {specialization.identity}
      </p>
      <dl className="mt-5 space-y-3 text-xs">
        <EffectRow label="Effet principal" value={specialization.primaryEffect} />
        <EffectRow label="Effet secondaire" value={specialization.secondaryEffect} />
        <EffectRow label="Limite" value={specialization.guardrail} danger />
      </dl>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={`mt-6 min-h-11 rounded-xl px-4 text-xs font-black transition ${
          selected
            ? "bg-[#176951] text-white"
            : "border border-[#176951]/25 bg-white text-[#176951] hover:border-[#176951]/50"
        }`}
      >
        {selected ? "Orientation retenue localement" : "Comparer cette orientation"}
      </button>
    </article>
  );
}

function EffectRow({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-3 ${
        danger
          ? "border-[#C8574A]/18 bg-[#FFF0ED]"
          : "border-[#315B3E]/10 bg-white"
      }`}
    >
      <dt className={`text-[9px] font-black uppercase tracking-wide ${danger ? "text-[#934137]" : "text-[#397A67]"}`}>
        {label}
      </dt>
      <dd className="mt-1 font-bold leading-5 text-[#315B3E]">{value}</dd>
    </div>
  );
}

function PrincipleCard({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-2xl border border-[#315B3E]/12 bg-white p-5">
      <p className="text-[10px] font-black tracking-[0.18em] text-[#278B70]">
        {number}
      </p>
      <h3 className="mt-2 text-sm font-black text-[#0B302B]">{title}</h3>
      <p className="mt-2 text-xs font-semibold leading-5 text-[#66877C]">{text}</p>
    </article>
  );
}
