"use client";

import { useActionState, useMemo, useState } from "react";

import { createAmateurTeam } from "@/app/jeu/directeur-sportif/actions";
import { initialAmateurTeamCreationState } from "@/app/jeu/directeur-sportif/amateur-team-state";
import {
  AMATEUR_JERSEY_PATTERNS,
  AMATEUR_JERSEY_PATTERN_LABELS,
  DEFAULT_AMATEUR_JERSEY,
  type AmateurJerseyConfig,
  type AmateurJerseyPattern,
} from "@/lib/amateur-team";

import { AmateurTeamJersey } from "./amateur-team-jersey";
import {
  CountrySelect,
  type CountryOption,
} from "./country-select";

type AmateurTeamCreationFormProps = {
  countries: CountryOption[];
  initialCountryId?: string | null;
  initialTeamName?: string | null;
  existingTeam?: boolean;
};

export function AmateurTeamCreationForm({
  countries,
  initialCountryId = null,
  initialTeamName = null,
  existingTeam = false,
}: AmateurTeamCreationFormProps) {
  const [state, formAction, pending] = useActionState(
    createAmateurTeam,
    initialAmateurTeamCreationState
  );
  const [teamName, setTeamName] = useState(initialTeamName ?? "");
  const [countryId, setCountryId] = useState(initialCountryId ?? "");
  const [pattern, setPattern] = useState<AmateurJerseyPattern>(
    DEFAULT_AMATEUR_JERSEY.pattern
  );
  const [primaryColor, setPrimaryColor] = useState(
    DEFAULT_AMATEUR_JERSEY.primaryColor
  );
  const [secondaryColor, setSecondaryColor] = useState(
    DEFAULT_AMATEUR_JERSEY.secondaryColor
  );
  const [accentColor, setAccentColor] = useState(
    DEFAULT_AMATEUR_JERSEY.accentColor
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

  const countryIsLocked = Boolean(existingTeam && initialCountryId);

  return (
    <div
      id="equipe-amateur"
      data-tutorial-id="team-creation-form"
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]"
    >
      <form action={formAction} className="space-y-7">
        {state.message ? (
          <div
            role={state.status === "error" ? "alert" : "status"}
            className={
              state.status === "error"
                ? "rounded-xl border border-[#D5B13E]/45 bg-[#FFF9DE] px-4 py-3 text-sm font-semibold text-[#705E23]"
                : "rounded-xl border border-[#42CDA8]/45 bg-[#42CDA8]/12 px-4 py-3 text-sm font-semibold text-[#176951]"
            }
          >
            {state.message}
          </div>
        ) : null}

        <div>
          <label htmlFor="teamName" className="block text-sm font-bold text-[#183F37]">
            Nom de l’équipe amateur
          </label>
          <input
            id="teamName"
            name="teamName"
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
            minLength={3}
            maxLength={40}
            required
            disabled={pending}
            className="mt-2 min-h-12 w-full rounded-lg border border-[#315B3E]/25 bg-white px-4 font-semibold text-[#082A2A] outline-none focus:border-[#42B99A] focus:ring-2 focus:ring-[#42B99A]/25 disabled:opacity-60"
          />
          <FieldErrors errors={state.fieldErrors.teamName} />
          <p className="mt-2 text-xs leading-5 text-[#60756E]">
            Cette identité sera restaurée automatiquement quand aucun sponsor n’est actif.
          </p>
        </div>

        <div>
          <label htmlFor="teamCountryId" className="block text-sm font-bold text-[#183F37]">
            Pays d’affiliation de l’équipe
          </label>
          <div className="mt-2">
            <CountrySelect
              id="teamCountryId"
              countries={countries}
              value={countryId}
              onChange={setCountryId}
              placeholder="Sélectionnez un pays"
              listAriaLabel="Liste des pays d’affiliation"
              describedBy={
                state.fieldErrors.countryId?.length
                  ? "teamCountryId-error"
                  : "teamCountryId-help"
              }
              disabled={pending}
              invalid={Boolean(state.fieldErrors.countryId?.length)}
              locked={countryIsLocked}
            />
          </div>
          <input type="hidden" name="countryId" value={countryId} />
          <FieldErrors
            id="teamCountryId-error"
            errors={state.fieldErrors.countryId}
          />
          <p
            id="teamCountryId-help"
            className="mt-2 text-xs leading-5 text-[#60756E]"
          >
            Choix définitif : il détermine les sept coureurs initiaux et la priorité géographique des sponsors.
          </p>
        </div>

        <fieldset>
          <legend className="text-sm font-bold text-[#183F37]">Motif du maillot</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {AMATEUR_JERSEY_PATTERNS.map((availablePattern) => (
              <button
                key={availablePattern}
                type="button"
                disabled={pending}
                aria-pressed={pattern === availablePattern}
                onClick={() => setPattern(availablePattern)}
                className={
                  pattern === availablePattern
                    ? "flex min-h-24 items-center gap-3 rounded-xl border-2 border-[#278B70] bg-[#DFF4EC] px-3 py-2 text-left text-sm font-black text-[#176951]"
                    : "flex min-h-24 items-center gap-3 rounded-xl border border-[#315B3E]/20 bg-white px-3 py-2 text-left text-sm font-bold text-[#48665F] transition hover:border-[#278B70]/50"
                }
              >
                <AmateurTeamJersey
                  jersey={{
                    ...jersey,
                    pattern: availablePattern,
                  }}
                  className="h-20 w-16 shrink-0 drop-shadow-md"
                />
                <span>{AMATEUR_JERSEY_PATTERN_LABELS[availablePattern]}</span>
              </button>
            ))}
          </div>
          <input type="hidden" name="jerseyPattern" value={pattern} />
          <FieldErrors errors={state.fieldErrors.jerseyPattern} />
        </fieldset>

        <fieldset>
          <legend className="text-sm font-bold text-[#183F37]">Couleurs du maillot</legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <ColorField label="Principale" name="primaryColor" value={primaryColor} onChange={setPrimaryColor} disabled={pending} />
            <ColorField label="Secondaire" name="secondaryColor" value={secondaryColor} onChange={setSecondaryColor} disabled={pending} />
            <ColorField label="Accent" name="accentColor" value={accentColor} onChange={setAccentColor} disabled={pending} />
          </div>
          <FieldErrors
            errors={[
              ...(state.fieldErrors.primaryColor ?? []),
              ...(state.fieldErrors.secondaryColor ?? []),
              ...(state.fieldErrors.accentColor ?? []),
            ]}
          />
        </fieldset>

        <div className="rounded-xl border border-[#D5B13E]/35 bg-[#FFF9DE] px-4 py-4 text-sm leading-6 text-[#705E23]">
          Le pays reste définitif et le nom constitue l’identité fondatrice de l’équipe. Le maillot pourra ensuite évoluer librement depuis l’atelier dédié.
        </div>

        <button
          type="submit"
          disabled={pending || teamName.trim().length < 3 || !countryId}
          className="min-h-12 w-full rounded-lg bg-[#F2C94C] px-5 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#071A17] shadow-lg transition hover:bg-[#FFD968] disabled:cursor-not-allowed disabled:bg-[#B8C5BE] disabled:text-[#60756E] disabled:shadow-none"
        >
          {pending
            ? "Fondation en cours..."
            : existingTeam
              ? "Valider l’identité amateur"
              : "Fonder mon équipe amateur"}
        </button>
      </form>

      <aside className="rounded-2xl border border-[#315B3E]/15 bg-[#0B302B] p-6 text-center text-[#FFFDF4] shadow-[0_18px_45px_rgba(19,60,46,0.16)] lg:sticky lg:top-6 lg:self-start">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#7CCF9C]">Aperçu immédiat</p>
        <div className="mt-5 flex justify-center">
          <AmateurTeamJersey jersey={jersey} teamName={teamName} className="h-64 w-56 drop-shadow-xl" />
        </div>
        <p className="mt-4 break-words text-lg font-black">
          {teamName.trim() || "Votre future équipe"}
        </p>
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
  return (
    <label className="rounded-xl border border-[#315B3E]/15 bg-[#F8FBF9] p-3">
      <span className="block text-xs font-bold text-[#48665F]">{label}</span>
      <span className="mt-2 flex items-center gap-3">
        <input
          type="color"
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          disabled={disabled}
          className="h-10 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <span className="font-mono text-xs font-bold text-[#183F37]">{value.toUpperCase()}</span>
      </span>
    </label>
  );
}

function FieldErrors({
  id,
  errors,
}: {
  id?: string;
  errors?: string[];
}) {
  return errors?.length ? (
    <div id={id} className="mt-2">
      {errors.map((error) => (
        <p key={error} className="text-sm font-semibold text-[#80640C]">
          {error}
        </p>
      ))}
    </div>
  ) : null;
}
