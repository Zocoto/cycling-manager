"use client";

import { useActionState, useMemo, useState } from "react";

import { updateAmateurTeamJersey } from "@/app/jeu/maillot/actions";
import { initialJerseyEditorState } from "@/app/jeu/maillot/state";
import {
  AMATEUR_JERSEY_PATTERNS,
  AMATEUR_JERSEY_PATTERN_LABELS,
  type AmateurJerseyConfig,
  type AmateurJerseyPattern,
} from "@/lib/amateur-team";
import { createAmateurRiderJersey } from "@/lib/rider-jersey";

import { AmateurTeamJersey } from "./amateur-team-jersey";
import { RiderAvatar } from "./rider-avatar";

type AmateurJerseyEditorProps = {
  initialJersey: AmateurJerseyConfig;
  teamName: string;
  activeSponsorName?: string | null;
};

const PALETTES = [
  {
    name: "Forêt",
    primaryColor: "#176951",
    secondaryColor: "#FFFDF4",
    accentColor: "#F2C94C",
  },
  {
    name: "Grand tour",
    primaryColor: "#173F8A",
    secondaryColor: "#EAF2FF",
    accentColor: "#EF5B65",
  },
  {
    name: "Classique rouge",
    primaryColor: "#9E2A2B",
    secondaryColor: "#FFF7E6",
    accentColor: "#F2C94C",
  },
  {
    name: "Aube violette",
    primaryColor: "#4B2E83",
    secondaryColor: "#E9DFF7",
    accentColor: "#62D6C5",
  },
  {
    name: "Orange carbone",
    primaryColor: "#1D2628",
    secondaryColor: "#F47C20",
    accentColor: "#F4EBD0",
  },
] as const;

export function AmateurJerseyEditor({
  initialJersey,
  teamName,
  activeSponsorName = null,
}: AmateurJerseyEditorProps) {
  const [state, formAction, pending] = useActionState(
    updateAmateurTeamJersey,
    initialJerseyEditorState
  );
  const [pattern, setPattern] = useState<AmateurJerseyPattern>(
    initialJersey.pattern
  );
  const [primaryColor, setPrimaryColor] = useState(
    initialJersey.primaryColor
  );
  const [secondaryColor, setSecondaryColor] = useState(
    initialJersey.secondaryColor
  );
  const [accentColor, setAccentColor] = useState(
    initialJersey.accentColor
  );

  const jersey = useMemo<AmateurJerseyConfig>(
    () => ({
      pattern,
      primaryColor,
      secondaryColor,
      accentColor,
    }),
    [accentColor, pattern, primaryColor, secondaryColor]
  );
  const savedJersey = state.savedJersey ?? initialJersey;
  const hasChanges =
    jersey.pattern !== savedJersey.pattern ||
    jersey.primaryColor !== savedJersey.primaryColor ||
    jersey.secondaryColor !== savedJersey.secondaryColor ||
    jersey.accentColor !== savedJersey.accentColor;
  const avatarJersey = useMemo(
    () => createAmateurRiderJersey(jersey),
    [jersey]
  );

  function applyPalette(palette: (typeof PALETTES)[number]) {
    setPrimaryColor(palette.primaryColor);
    setSecondaryColor(palette.secondaryColor);
    setAccentColor(palette.accentColor);
  }

  function resetDesign() {
    setPattern(savedJersey.pattern);
    setPrimaryColor(savedJersey.primaryColor);
    setSecondaryColor(savedJersey.secondaryColor);
    setAccentColor(savedJersey.accentColor);
  }

  return (
    <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
      <form action={formAction} className="space-y-7">
        {state.message ? (
          <div
            role={state.status === "error" ? "alert" : "status"}
            aria-live="polite"
            className={
              state.status === "error"
                ? "rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900"
                : "rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900"
            }
          >
            {state.message}
          </div>
        ) : null}

        {activeSponsorName ? (
          <div className="rounded-xl border border-[#F2C94C]/45 bg-[#FFF8D9] px-4 py-4 text-sm font-semibold leading-6 text-[#705A08]">
            {activeSponsorName} fournit actuellement le maillot visible en course et sur les avatars. Vos changements restent enregistrés sur l’identité amateur et reprendront automatiquement effet à la fin du contrat.
          </div>
        ) : (
          <div className="rounded-xl border border-[#42CDA8]/35 bg-[#EAF8F3] px-4 py-4 text-sm font-semibold leading-6 text-[#176951]">
            Toute sauvegarde est immédiatement reprise par les avatars des coureurs de {teamName}.
          </div>
        )}

        <fieldset>
          <legend className="text-sm font-black text-[#183F37]">
            Motif du maillot
          </legend>
          <p className="mt-1 text-sm font-medium text-[#60756E]">
            Douze constructions graphiques, toutes adaptées au grand maillot et aux portraits.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AMATEUR_JERSEY_PATTERNS.map((availablePattern) => {
              const selected = pattern === availablePattern;
              return (
                <button
                  key={availablePattern}
                  type="button"
                  disabled={pending}
                  aria-pressed={selected}
                  onClick={() => setPattern(availablePattern)}
                  className={`group flex min-h-28 items-center gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951] ${
                    selected
                      ? "border-[#176951] bg-[#E0F3EC] shadow-[inset_0_0_0_1px_#176951]"
                      : "border-[#315B3E]/15 bg-white hover:-translate-y-0.5 hover:border-[#176951]/45 hover:shadow-sm"
                  }`}
                >
                  <AmateurTeamJersey
                    jersey={{ ...jersey, pattern: availablePattern }}
                    className="h-24 w-20 shrink-0 drop-shadow-md"
                  />
                  <span>
                    <span className="block text-sm font-black text-[#183F37]">
                      {AMATEUR_JERSEY_PATTERN_LABELS[availablePattern]}
                    </span>
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-[#688176]">
                      {selected ? "Sélectionné" : "Aperçu"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <input type="hidden" name="jerseyPattern" value={pattern} />
          <FieldErrors errors={state.fieldErrors.jerseyPattern} />
        </fieldset>

        <fieldset>
          <legend className="text-sm font-black text-[#183F37]">
            Palette libre
          </legend>
          <p className="mt-1 text-sm font-medium text-[#60756E]">
            Utilisez le sélecteur ou saisissez directement une couleur hexadécimale.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <ColorField
              label="Principale"
              name="primaryColor"
              value={primaryColor}
              onChange={setPrimaryColor}
              disabled={pending}
            />
            <ColorField
              label="Secondaire"
              name="secondaryColor"
              value={secondaryColor}
              onChange={setSecondaryColor}
              disabled={pending}
            />
            <ColorField
              label="Accent"
              name="accentColor"
              value={accentColor}
              onChange={setAccentColor}
              disabled={pending}
            />
          </div>
          <FieldErrors
            errors={[
              ...(state.fieldErrors.primaryColor ?? []),
              ...(state.fieldErrors.secondaryColor ?? []),
              ...(state.fieldErrors.accentColor ?? []),
            ]}
          />
        </fieldset>

        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#315B3E]">
            Palettes rapides
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PALETTES.map((palette) => (
              <button
                key={palette.name}
                type="button"
                disabled={pending}
                onClick={() => applyPalette(palette)}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#315B3E]/15 bg-white px-3 text-xs font-black text-[#315B3E] transition hover:border-[#176951]/45 hover:bg-[#F3FAF7]"
              >
                <span className="flex -space-x-1" aria-hidden="true">
                  {[palette.primaryColor, palette.secondaryColor, palette.accentColor].map(
                    (color) => (
                      <span
                        key={color}
                        className="h-5 w-5 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                    )
                  )}
                </span>
                {palette.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-[#315B3E]/15 pt-6">
          <button
            type="submit"
            disabled={pending || !hasChanges}
            className="min-h-12 rounded-xl bg-[#F2C94C] px-6 text-sm font-extrabold uppercase tracking-[0.08em] text-[#071A17] shadow-lg transition hover:bg-[#FFD968] disabled:cursor-not-allowed disabled:bg-[#B8C5BE] disabled:text-[#60756E] disabled:shadow-none"
          >
            {pending
              ? "Enregistrement…"
              : hasChanges
                ? "Appliquer ce maillot"
                : "Maillot enregistré"}
          </button>
          <button
            type="button"
            disabled={pending || !hasChanges}
            onClick={resetDesign}
            className="min-h-12 rounded-xl border border-[#315B3E]/20 bg-white px-5 text-sm font-black text-[#315B3E] transition hover:bg-[#F3F7F4] disabled:opacity-50"
          >
            Annuler les changements
          </button>
        </div>
      </form>

      <aside className="rounded-[1.75rem] bg-[#0B302B] p-6 text-center text-white shadow-[0_24px_60px_rgba(7,26,23,0.22)] xl:sticky xl:top-6 xl:self-start">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#7CCF9C]">
          Aperçu en direct
        </p>
        <div className="mt-5 flex justify-center">
          <AmateurTeamJersey
            jersey={jersey}
            teamName={teamName}
            className="h-72 w-60 drop-shadow-2xl"
          />
        </div>
        <h2 className="mt-3 text-xl font-black">{teamName}</h2>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#9BE0BC]">
            Rendu sur les coureurs
          </p>
          <div className="mt-3 flex items-center justify-center gap-3">
            {[19, 27, 34].map((age, index) => (
              <RiderAvatar
                key={age}
                profileKey={index === 1 ? "africa_west" : "europe_west"}
                seed={`${teamName}-${age}`}
                riderId={`jersey-preview-${age}`}
                age={age}
                jersey={avatarJersey}
                label={`Aperçu du maillot sur un coureur de ${age} ans`}
                className="h-20 w-20 border-2 border-white/15"
              />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function ColorField({
  label,
  name,
  value,
  onChange,
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const safePickerValue = /^#[0-9A-F]{6}$/.test(value)
    ? value
    : "#000000";

  return (
    <label className="rounded-xl border border-[#315B3E]/15 bg-[#F8FBF9] p-3">
      <span className="block text-xs font-bold text-[#48665F]">{label}</span>
      <span className="mt-2 flex items-center gap-2">
        <input
          type="color"
          value={safePickerValue}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          disabled={disabled}
          aria-label={`Sélectionner la couleur ${label.toLowerCase()}`}
          className="h-11 w-12 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <input
          type="text"
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          disabled={disabled}
          required
          maxLength={7}
          pattern="#[0-9A-Fa-f]{6}"
          spellCheck={false}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#315B3E]/20 bg-white px-2 font-mono text-xs font-black uppercase text-[#183F37] outline-none focus:border-[#176951] focus:ring-2 focus:ring-[#176951]/20"
        />
      </span>
    </label>
  );
}

function FieldErrors({ errors }: { errors?: string[] }) {
  return errors?.length ? (
    <div className="mt-2">
      {errors.map((error) => (
        <p key={error} className="text-sm font-semibold text-red-800">
          {error}
        </p>
      ))}
    </div>
  ) : null;
}
