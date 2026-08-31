"use client";

import { useEffect, useId, useState } from "react";

import { SvgCountryFlag } from "@/components/game/svg-country-flag";
import {
  decodeNationalJerseyDraft,
  DEFAULT_NATIONAL_JERSEY_DRAFT,
  getNationalJerseyDraftStorageKey,
  normalizeNationalJerseyDraft,
  type NationalJerseyDraft,
  type NationalJerseyFlagMotif,
  type NationalJerseyPattern,
} from "@/lib/game/national-jersey-preview";

type NationalJerseyPreviewEditorProps = {
  countryCode: string;
  countryName: string;
};

const PATTERNS: Array<{ value: NationalJerseyPattern; label: string }> = [
  { value: "classic", label: "Classique" },
  { value: "horizontal-band", label: "Bande horizontale" },
  { value: "diagonal-sash", label: "Écharpe diagonale" },
  { value: "cross", label: "Croix nationale" },
  { value: "halves", label: "Deux moitiés" },
];

const FLAG_MOTIFS: Array<{
  value: NationalJerseyFlagMotif;
  label: string;
}> = [
  { value: "none", label: "Sans drapeau" },
  { value: "full-flag", label: "Drapeau complet" },
  { value: "central-roundel", label: "Motif central rond" },
  { value: "central-shield", label: "Motif central blason" },
];

export function NationalJerseyPreviewEditor({
  countryCode,
  countryName,
}: NationalJerseyPreviewEditorProps) {
  const [draft, setDraft] = useState<NationalJerseyDraft>(
    DEFAULT_NATIONAL_JERSEY_DRAFT,
  );
  const [storageStatus, setStorageStatus] = useState<
    "idle" | "restored" | "saved" | "unavailable"
  >("idle");
  const generatedId = useId().replaceAll(":", "");

  useEffect(() => {
    const restorationTimer = window.setTimeout(() => {
      try {
        const storedDraft = decodeNationalJerseyDraft(
          window.localStorage.getItem(
            getNationalJerseyDraftStorageKey(countryCode),
          ),
        );

        if (storedDraft) {
          setDraft(storedDraft);
          setStorageStatus("restored");
        }
      } catch {
        setStorageStatus("unavailable");
      }
    }, 0);

    return () => window.clearTimeout(restorationTimer);
  }, [countryCode]);

  function updateDraft(patch: Partial<NationalJerseyDraft>) {
    setDraft((currentDraft) =>
      normalizeNationalJerseyDraft({ ...currentDraft, ...patch }),
    );
    setStorageStatus("idle");
  }

  function saveDraftLocally() {
    try {
      window.localStorage.setItem(
        getNationalJerseyDraftStorageKey(countryCode),
        JSON.stringify(draft),
      );
      setStorageStatus("saved");
    } catch {
      setStorageStatus("unavailable");
    }
  }

  function resetDraft() {
    setDraft(DEFAULT_NATIONAL_JERSEY_DRAFT);
    try {
      window.localStorage.removeItem(
        getNationalJerseyDraftStorageKey(countryCode),
      );
      setStorageStatus("idle");
    } catch {
      setStorageStatus("unavailable");
    }
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.07)]">
      <div className="grid gap-6 bg-[#123F36] p-6 text-white sm:p-8 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-center">
        <JerseyArtwork
          countryCode={countryCode}
          countryName={countryName}
          draft={draft}
          generatedId={generatedId}
        />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9BE0BC]">
              Atelier du maillot national
            </p>
            <span className="rounded-full border border-[#F2C94C]/35 bg-[#F2C94C]/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#FFE790]">
              Brouillon local · Saison 3
            </span>
          </div>
          <h2 className="mt-3 text-3xl font-black">
            Une identité propre à {countryName}
          </h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#D6DFD2]">
            Assemblez les couleurs, la structure et un motif issu du centre du
            drapeau — feuille, aigle, soleil, croix ou blason selon le pays. Ce
            brouillon ne devient jamais un maillot officiel en Saison 2.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveDraftLocally}
              className="rounded-xl bg-[#F2C94C] px-5 py-3 text-sm font-black text-[#19352E] transition hover:-translate-y-0.5 hover:bg-[#FFE071]"
            >
              Sauvegarder sur cet appareil
            </button>
            <button
              type="button"
              onClick={resetDraft}
              className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
            >
              Réinitialiser
            </button>
            <p aria-live="polite" className="text-xs font-bold text-[#9BE0BC]">
              {storageStatus === "saved"
                ? "Brouillon enregistré localement."
                : storageStatus === "restored"
                  ? "Brouillon local restauré."
                  : storageStatus === "unavailable"
                    ? "Stockage local indisponible : aperçu temporaire."
                    : "Aucune donnée envoyée au serveur."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-7 p-6 sm:p-8 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div>
          <EditorGroup title="Construction">
            <EditorSelect
              label="Style du maillot"
              value={draft.pattern}
              options={PATTERNS}
              onChange={(value) =>
                updateDraft({ pattern: value as NationalJerseyPattern })
              }
            />
            <EditorSelect
              label="Élément du drapeau"
              value={draft.flagMotif}
              options={FLAG_MOTIFS}
              onChange={(value) =>
                updateDraft({ flagMotif: value as NationalJerseyFlagMotif })
              }
            />
          </EditorGroup>

          <EditorGroup title="Palette">
            <div className="grid grid-cols-3 gap-3">
              <ColorControl
                label="Fond"
                value={draft.primaryColor}
                onChange={(primaryColor) => updateDraft({ primaryColor })}
              />
              <ColorControl
                label="Secondaire"
                value={draft.secondaryColor}
                onChange={(secondaryColor) => updateDraft({ secondaryColor })}
              />
              <ColorControl
                label="Accent"
                value={draft.accentColor}
                onChange={(accentColor) => updateDraft({ accentColor })}
              />
            </div>
          </EditorGroup>
        </div>

        <EditorGroup title="Placement du motif national">
          {draft.flagMotif === "central-roundel" ||
          draft.flagMotif === "central-shield" ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <EditorRange
                label="Position horizontale"
                value={draft.motifX}
                minimum={25}
                maximum={95}
                display={`${Math.round(draft.motifX)} %`}
                onChange={(motifX) => updateDraft({ motifX })}
              />
              <EditorRange
                label="Position verticale"
                value={draft.motifY}
                minimum={30}
                maximum={110}
                display={`${Math.round(draft.motifY)} %`}
                onChange={(motifY) => updateDraft({ motifY })}
              />
              <EditorRange
                label="Taille"
                value={draft.motifScale}
                minimum={0.6}
                maximum={1.8}
                step={0.05}
                display={`${Math.round(draft.motifScale * 100)} %`}
                onChange={(motifScale) => updateDraft({ motifScale })}
              />
              <EditorRange
                label="Rotation"
                value={draft.motifRotation}
                minimum={-45}
                maximum={45}
                display={`${Math.round(draft.motifRotation)}°`}
                onChange={(motifRotation) => updateDraft({ motifRotation })}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5 text-sm font-semibold leading-6 text-[#60756E]">
              Choisissez un motif central rond ou en forme de blason pour le
              déplacer, le redimensionner et le faire pivoter librement.
            </div>
          )}
          <p className="mt-5 rounded-xl bg-[#FFF9DE] px-4 py-3 text-xs font-bold leading-5 text-[#75631C]">
            L’éditeur réutilise uniquement les drapeaux déjà optimisés du jeu :
            aucun téléversement de fichier et aucune requête supplémentaire au
            serveur.
          </p>
        </EditorGroup>
      </div>
    </section>
  );
}

function JerseyArtwork({
  countryCode,
  countryName,
  draft,
  generatedId,
}: {
  countryCode: string;
  countryName: string;
  draft: NationalJerseyDraft;
  generatedId: string;
}) {
  const jerseyClipId = `national-jersey-${generatedId}`;
  const motifClipId = `national-motif-${generatedId}`;
  const shirtPath =
    "M39 9 19 18 5 48l19 10 8-14v78h56V44l8 14 19-10-14-30-20-9c-4 7-10 10-21 10S43 16 39 9Z";

  return (
    <div className="rounded-[1.7rem] border border-white/15 bg-[radial-gradient(circle_at_top,#FFFFFF20,transparent_65%)] p-5">
      <svg
        viewBox="0 0 120 132"
        role="img"
        aria-label={`Brouillon du maillot national de ${countryName}`}
        className="mx-auto h-56 w-full max-w-52 drop-shadow-[0_18px_18px_rgba(0,0,0,0.3)]"
      >
        <defs>
          <clipPath id={jerseyClipId}>
            <path d={shirtPath} />
          </clipPath>
          <clipPath id={motifClipId}>
            {draft.flagMotif === "central-shield" ? (
              <path d="M-17-15H17V2C17 14 9 22 0 27-9-5-17-13-17-25Z" />
            ) : (
              <circle cx="0" cy="0" r="17" />
            )}
          </clipPath>
        </defs>

        <g clipPath={`url(#${jerseyClipId})`}>
          <rect width="120" height="132" fill={draft.primaryColor} />
          <JerseyPatternArtwork draft={draft} />
          {draft.flagMotif === "full-flag" ? (
            <SvgCountryFlag
              countryCode={countryCode}
              x="5"
              y="8"
              width={110}
              height={116}
              preserveAspectRatio="xMidYMid slice"
            />
          ) : null}
          {draft.flagMotif === "central-roundel" ||
          draft.flagMotif === "central-shield" ? (
            <g
              transform={`translate(${draft.motifX} ${draft.motifY}) rotate(${draft.motifRotation}) scale(${draft.motifScale})`}
            >
              <path
                d={
                  draft.flagMotif === "central-shield"
                    ? "M-20-18H20V3C20 17 10 26 0 32-10-6-20-15-20-29Z"
                    : "M0-21a21 21 0 1 0 0 42 21 21 0 0 0 0-42Z"
                }
                fill={draft.accentColor}
                stroke={draft.secondaryColor}
                strokeWidth="2"
              />
              <image
                aria-hidden="true"
                href={`/images/flags/4x3/${countryCode.trim().toLowerCase()}.svg`}
                x="-24"
                y="-18"
                width="48"
                height="36"
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#${motifClipId})`}
              />
            </g>
          ) : null}
        </g>

        <path
          d={shirtPath}
          fill="none"
          stroke="#071A17"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M39 9c4 7 10 10 21 10S77 16 81 9"
          fill="none"
          stroke="#071A17"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function JerseyPatternArtwork({ draft }: { draft: NationalJerseyDraft }) {
  if (draft.pattern === "horizontal-band") {
    return (
      <>
        <rect y="69" width="120" height="24" fill={draft.secondaryColor} />
        <rect y="78" width="120" height="6" fill={draft.accentColor} />
      </>
    );
  }

  if (draft.pattern === "diagonal-sash") {
    return (
      <>
        <path d="M9 22 29 9l83 105-20 18Z" fill={draft.secondaryColor} />
        <path d="M20 14 26 10l84 106-7 8Z" fill={draft.accentColor} />
      </>
    );
  }

  if (draft.pattern === "cross") {
    return (
      <>
        <rect x="50" width="20" height="132" fill={draft.secondaryColor} />
        <rect y="52" width="120" height="20" fill={draft.secondaryColor} />
        <rect x="57" width="6" height="132" fill={draft.accentColor} />
      </>
    );
  }

  if (draft.pattern === "halves") {
    return (
      <>
        <rect x="60" width="60" height="132" fill={draft.secondaryColor} />
        <rect x="57" width="6" height="132" fill={draft.accentColor} />
      </>
    );
  }

  return (
    <>
      <path d="M0 0h120v25H0Z" fill={draft.secondaryColor} />
      <path d="M0 25h120v5H0Z" fill={draft.accentColor} />
      <path d="M0 116h120v16H0Z" fill={draft.secondaryColor} />
    </>
  );
}

function EditorGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 first:mt-0">
      <h3 className="text-xs font-black uppercase tracking-[0.16em] text-[#278B70]">
        {title}
      </h3>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

function EditorSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-[#183F37]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-[#315B3E]/18 bg-[#F8FBF9] px-4 py-3 text-sm font-black text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#42B99A]/25"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-xl border border-[#315B3E]/12 bg-[#F8FBF9] p-3 text-center">
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        className="mx-auto h-11 w-full cursor-pointer rounded-lg border-0 bg-transparent p-0"
      />
      <span className="mt-2 block text-[10px] font-black uppercase tracking-[0.1em] text-[#60756E]">
        {label}
      </span>
    </label>
  );
}

function EditorRange({
  label,
  value,
  minimum,
  maximum,
  step = 1,
  display,
  onChange,
}: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  step?: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-3 text-sm font-black text-[#183F37]">
        <span>{label}</span>
        <span className="rounded-full bg-[#DDF3E7] px-3 py-1 text-xs text-[#176951]">
          {display}
        </span>
      </span>
      <input
        type="range"
        value={value}
        min={minimum}
        max={maximum}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#DDE8E2] accent-[#176951]"
      />
    </label>
  );
}
