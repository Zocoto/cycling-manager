"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { createDevelopmentTeamAction } from "@/app/jeu/centre-de-formation/development-actions";
import {
  AMATEUR_JERSEY_PATTERNS,
  AMATEUR_JERSEY_PATTERN_LABELS,
  type AmateurJerseyConfig,
  type AmateurJerseyPattern,
} from "@/lib/amateur-team";
import type { DevelopmentRider } from "@/services/development-team";

import { AmateurTeamJersey } from "./amateur-team-jersey";
import { RiderAvatar } from "./rider-avatar";

type Props = {
  teamName: string;
  riders: DevelopmentRider[];
  defaultJersey: AmateurJerseyConfig;
};

const MAXIMUM_ROSTER_SIZE = 11;

const PALETTES = [
  ["Forêt", "#176951", "#FFFDF4", "#F2C94C"],
  ["Azur", "#174B8A", "#EDF5FF", "#EF5B65"],
  ["Carbone", "#1D2628", "#F47C20", "#F4EBD0"],
  ["Prune", "#542A68", "#F1E5F5", "#5DD3C3"],
] as const;

export function DevelopmentTeamBuilder({
  teamName,
  riders,
  defaultJersey,
}: Props) {
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>());
  const [pattern, setPattern] = useState<AmateurJerseyPattern>(
    defaultJersey.pattern,
  );
  const [primaryColor, setPrimaryColor] = useState(defaultJersey.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(
    defaultJersey.secondaryColor,
  );
  const [accentColor, setAccentColor] = useState(defaultJersey.accentColor);
  const jersey = useMemo(
    () => ({ pattern, primaryColor, secondaryColor, accentColor }),
    [accentColor, pattern, primaryColor, secondaryColor],
  );

  function toggleRider(riderId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(riderId)) {
        next.delete(riderId);
      } else if (next.size < MAXIMUM_ROSTER_SIZE) {
        next.add(riderId);
      }
      return next;
    });
  }

  return (
    <form action={createDevelopmentTeamAction} className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="rounded-[1.75rem] border border-[#315B3E]/12 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
                Étape 1 · Effectif fondateur
              </p>
              <h3 className="mt-2 text-2xl font-black text-[#071A17]">
                Choisissez jusqu’à onze juniors
              </h3>
              <p className="mt-2 text-sm font-semibold text-[#60756E]">
                Cet effectif sera verrouillé pour toute la saison. L’entraînement
                restera piloté depuis l’École de cyclisme.
              </p>
            </div>
            <span className="rounded-full bg-[#0B302B] px-4 py-2 text-sm font-black text-white">
              {selectedIds.size}/{MAXIMUM_ROSTER_SIZE}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {riders.map((rider) => {
              const selected = selectedIds.has(rider.id);
              const disabled = !selected && selectedIds.size >= MAXIMUM_ROSTER_SIZE;
              const leadingRatings = [
                ["MO", rider.ratings.mountain],
                ["HIL", rider.ratings.hills],
                ["TT", rider.ratings.timeTrial],
              ] as const;
              return (
                <label
                  key={rider.id}
                  className={`relative flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${
                    selected
                      ? "border-[#176951] bg-[#E5F4ED] shadow-[inset_0_0_0_1px_#176951]"
                      : disabled
                        ? "cursor-not-allowed border-[#315B3E]/8 bg-[#F4F7F5] opacity-55"
                        : "border-[#315B3E]/12 bg-[#FAFCFB] hover:border-[#176951]/45 hover:bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="riderIds"
                    value={rider.id}
                    checked={selected}
                    disabled={disabled}
                    onChange={() => toggleRider(rider.id)}
                    className="sr-only"
                  />
                  <RiderAvatar
                    riderId={rider.id}
                    profileKey={rider.profileKey}
                    seed={rider.avatarSeed}
                    age={rider.age}
                    label={`${rider.firstName} ${rider.lastName}`}
                    className="h-14 w-14 shrink-0 border-2 border-white"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-[#183F37]">
                      {rider.firstName} {rider.lastName}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-bold text-[#60756E]">
                      {rider.countryCode} · {rider.age} ans · {rider.sportingProfile}
                    </span>
                    <span className="mt-2 flex gap-1.5">
                      {leadingRatings.map(([label, value]) => (
                        <span
                          key={label}
                          className="rounded-md bg-white/85 px-1.5 py-1 text-[9px] font-black text-[#315B3E]"
                        >
                          {label} {value}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black ${
                      selected
                        ? "bg-[#176951] text-white"
                        : "border border-[#315B3E]/20 bg-white text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <aside className="rounded-[1.75rem] bg-[#0B302B] p-5 text-center text-white shadow-[0_22px_55px_rgba(7,26,23,0.2)] xl:sticky xl:top-5 xl:self-start">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9BE0CA]">
            Identité annoncée
          </p>
          <AmateurTeamJersey
            jersey={jersey}
            teamName={teamName}
            className="mx-auto mt-3 h-52 w-44 drop-shadow-2xl"
          />
          <p className="mt-2 text-xl font-black">{teamName}</p>
          <p className="mt-1 text-xs font-semibold text-[#B9D5CA]">
            Saison junior · {selectedIds.size} coureur{selectedIds.size > 1 ? "s" : ""}
          </p>
        </aside>
      </section>

      <section className="rounded-[1.75rem] border border-[#315B3E]/12 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
          Étape 2 · Maillot de développement
        </p>
        <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {AMATEUR_JERSEY_PATTERNS.map((availablePattern) => (
                <button
                  key={availablePattern}
                  type="button"
                  onClick={() => setPattern(availablePattern)}
                  aria-pressed={pattern === availablePattern}
                  className={`rounded-xl border p-2 text-center transition ${
                    pattern === availablePattern
                      ? "border-[#176951] bg-[#E5F4ED]"
                      : "border-[#315B3E]/12 bg-[#FAFCFB] hover:border-[#176951]/40"
                  }`}
                >
                  <AmateurTeamJersey
                    jersey={{ ...jersey, pattern: availablePattern }}
                    className="mx-auto h-16 w-14"
                  />
                  <span className="mt-1 block text-[9px] font-black text-[#315B3E]">
                    {AMATEUR_JERSEY_PATTERN_LABELS[availablePattern]}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {PALETTES.map(([name, primary, secondary, accent]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setPrimaryColor(primary);
                    setSecondaryColor(secondary);
                    setAccentColor(accent);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-[#315B3E]/12 px-3 py-2 text-xs font-black text-[#315B3E]"
                >
                  <span className="flex -space-x-1">
                    {[primary, secondary, accent].map((color) => (
                      <span
                        key={color}
                        className="h-4 w-4 rounded-full border border-white"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                  {name}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <ColorField label="Principale" name="primaryColor" value={primaryColor} onChange={setPrimaryColor} />
              <ColorField label="Secondaire" name="secondaryColor" value={secondaryColor} onChange={setSecondaryColor} />
              <ColorField label="Accent" name="accentColor" value={accentColor} onChange={setAccentColor} />
            </div>
          </div>
          <input type="hidden" name="jerseyPattern" value={pattern} />
          <CreateButton disabled={selectedIds.size === 0} />
        </div>
      </section>
    </form>
  );
}

function ColorField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-xl border border-[#315B3E]/12 bg-[#F8FBF9] p-3">
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#60756E]">
        {label}
      </span>
      <span className="mt-2 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-10 w-11 cursor-pointer border-0 bg-transparent p-0"
        />
        <input
          type="text"
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          pattern="#[0-9A-Fa-f]{6}"
          maxLength={7}
          required
          className="min-w-0 flex-1 rounded-lg border border-[#315B3E]/15 bg-white px-2 py-2 font-mono text-xs font-black uppercase text-[#183F37]"
        />
      </span>
    </label>
  );
}

function CreateButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="min-h-14 rounded-xl bg-[#F2C94C] px-7 text-sm font-black uppercase tracking-[0.08em] text-[#071A17] shadow-lg transition hover:bg-[#FFD968] disabled:cursor-not-allowed disabled:bg-[#B8C5BE] disabled:text-[#60756E] disabled:shadow-none"
    >
      {pending ? "Création…" : "Fonder la Development Team"}
    </button>
  );
}
