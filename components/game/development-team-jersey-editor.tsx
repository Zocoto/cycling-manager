"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { updateDevelopmentTeamJerseyAction } from "@/app/jeu/centre-de-formation/development-actions";
import {
  AMATEUR_JERSEY_PATTERNS,
  AMATEUR_JERSEY_PATTERN_LABELS,
  type AmateurJerseyConfig,
  type AmateurJerseyPattern,
} from "@/lib/amateur-team";

import { AmateurTeamJersey } from "./amateur-team-jersey";

export function DevelopmentTeamJerseyEditor({
  teamName,
  initialJersey,
}: {
  teamName: string;
  initialJersey: AmateurJerseyConfig;
}) {
  const [pattern, setPattern] = useState<AmateurJerseyPattern>(initialJersey.pattern);
  const [primaryColor, setPrimaryColor] = useState(initialJersey.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(initialJersey.secondaryColor);
  const [accentColor, setAccentColor] = useState(initialJersey.accentColor);
  const jersey = useMemo(
    () => ({ pattern, primaryColor, secondaryColor, accentColor }),
    [accentColor, pattern, primaryColor, secondaryColor],
  );

  return (
    <form
      action={updateDevelopmentTeamJerseyAction}
      className="grid gap-6 rounded-[1.75rem] border border-[#315B3E]/12 bg-white p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_320px] sm:p-6"
    >
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
          Identité visuelle junior
        </p>
        <h3 className="mt-2 text-2xl font-black text-[#071A17]">
          Un maillot propre à la relève
        </h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
          Le nom reste lié au sponsor de la saison, mais les couleurs et le motif
          sont entièrement indépendants de l’équipe professionnelle.
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {AMATEUR_JERSEY_PATTERNS.map((availablePattern) => (
            <button
              key={availablePattern}
              type="button"
              onClick={() => setPattern(availablePattern)}
              aria-pressed={pattern === availablePattern}
              className={`flex items-center gap-2 rounded-xl border p-2 text-left transition ${
                pattern === availablePattern
                  ? "border-[#176951] bg-[#E5F4ED]"
                  : "border-[#315B3E]/12 bg-[#FAFCFB] hover:border-[#176951]/40"
              }`}
            >
              <AmateurTeamJersey
                jersey={{ ...jersey, pattern: availablePattern }}
                className="h-16 w-14 shrink-0"
              />
              <span className="text-[10px] font-black text-[#315B3E]">
                {AMATEUR_JERSEY_PATTERN_LABELS[availablePattern]}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ColorField label="Principale" name="primaryColor" value={primaryColor} onChange={setPrimaryColor} />
          <ColorField label="Secondaire" name="secondaryColor" value={secondaryColor} onChange={setSecondaryColor} />
          <ColorField label="Accent" name="accentColor" value={accentColor} onChange={setAccentColor} />
        </div>
        <input type="hidden" name="jerseyPattern" value={pattern} />
        <div className="mt-6">
          <SaveButton />
        </div>
      </div>

      <aside className="rounded-2xl bg-[#0B302B] p-5 text-center text-white">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9BE0CA]">
          Aperçu en course
        </p>
        <AmateurTeamJersey
          jersey={jersey}
          teamName={teamName}
          className="mx-auto mt-4 h-64 w-52 drop-shadow-2xl"
        />
        <p className="mt-2 text-lg font-black">{teamName}</p>
      </aside>
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
      <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-[#60756E]">
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

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 rounded-xl bg-[#F2C94C] px-6 text-sm font-black uppercase tracking-[0.08em] text-[#071A17] shadow-md disabled:opacity-60"
    >
      {pending ? "Enregistrement…" : "Enregistrer ce maillot"}
    </button>
  );
}
