"use client";

import { useCallback, useRef, useState } from "react";
import { NationalJerseyPreviewEditor } from "./national-jersey-preview-editor";
import { NationalFederationJersey } from "./national-federation-jersey";
import {
  decodeNationalJerseyDraft,
  DEFAULT_NATIONAL_JERSEY_DRAFT,
  getNationalJerseyDraftStorageKey,
  NATIONAL_JERSEY_KIND_LABELS,
  type NationalJerseyDraft,
  type NationalJerseyKind,
  type PublishedNationalJersey,
} from "@/lib/game/national-jersey-preview";

export function NationalFederationJerseyWorkshop({ countryCode, countryName, selectionJersey, championJersey, canEdit, previewOnly = false }: {
  countryCode: string; countryName: string; selectionJersey: PublishedNationalJersey | null; championJersey: PublishedNationalJersey | null; canEdit: boolean; previewOnly?: boolean;
}) {
  const [atelier, setAtelier] = useState<{
    kind: NationalJerseyKind;
    draftKey?: string;
    initialDraft?: NationalJerseyDraft;
  }>({ kind: "national_team" });
  const { kind } = atelier;
  const draftKey = getNationalJerseyDraftStorageKey(countryCode, kind);
  // Dragging a layer should only render the editor, not both jersey cards.
  const drafts = useRef(new Map<string, NationalJerseyDraft>());
  const rememberDraft = useCallback((draft: NationalJerseyDraft) => {
    drafts.current.set(draftKey, draft);
  }, [draftKey]);
  const kits = { national_team: selectionJersey, national_champion: championJersey };
  const sourceKind = kind === "national_team" ? "national_champion" : "national_team";

  function openAtelier(nextKind: NationalJerseyKind) {
    if (nextKind === kind) return;
    const nextKey = getNationalJerseyDraftStorageKey(countryCode, nextKind);
    setAtelier({ kind: nextKind, draftKey: nextKey, initialDraft: drafts.current.get(nextKey) });
  }

  function readCopySourceDraft() {
    const sourceKey = getNationalJerseyDraftStorageKey(countryCode, sourceKind);
    const source = kits[sourceKind];
    const workingDraft = drafts.current.get(sourceKey);
    if (workingDraft && (workingDraft !== DEFAULT_NATIONAL_JERSEY_DRAFT || source)) return workingDraft;

    if (source?.isActive === false) return source.design;
    try {
      const saved = decodeNationalJerseyDraft(window.localStorage.getItem(sourceKey));
      if (saved) return saved;
    } catch {
      // The published design remains usable when browser storage is unavailable.
    }
    return source?.design ?? null;
  }

  return <section aria-label="Les deux maillots de la fédération" className="space-y-5">
    <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">Identités de la fédération</p>
      <h2 className="mt-2 text-2xl font-black text-[#183F37]">Maillots de la fédération</h2>
      <p className="mt-2 text-sm font-semibold text-[#60756E]">Une tenue pour représenter le pays. Une autre pour honorer ses champions. Chaque composition est indépendante.</p></div>
    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Choisir le maillot à composer">
      {(["national_team", "national_champion"] as const).map((value) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => openAtelier(value)}
        className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${kind === value ? "border-[#278B70] bg-[#E1F3E9] ring-2 ring-[#278B70]/15" : "border-[#315B3E]/15 bg-white hover:bg-[#F8FBF9]"}`}>
        <NationalFederationJersey countryCode={countryCode} countryName={countryName} kind={value} design={kits[value]?.design} className="h-20 w-16 shrink-0 drop-shadow-md" />
        <span><span className="block text-base font-black text-[#183F37]">{NATIONAL_JERSEY_KIND_LABELS[value]}</span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-[#60756E]">{value === "national_team" ? "Rendez-vous internationaux · nom du pays, devise et texte libre" : "Champions sur route et CLM · porté au sein de leur club"}</span>
          <span className="mt-2 block text-[10px] font-black uppercase tracking-wider text-[#278B70]">{kind === value ? "Atelier ouvert" : "Ouvrir cet atelier →"}</span></span>
      </button>)}
    </div>
    <NationalJerseyPreviewEditor
      key={draftKey}
      countryCode={countryCode}
      countryName={countryName}
      jerseyKind={kind}
      publishedJersey={kits[kind]}
      canEdit={canEdit}
      previewOnly={previewOnly}
      initialDraft={atelier.draftKey === draftKey ? atelier.initialDraft : undefined}
      onDraftChange={rememberDraft}
      copySource={canEdit ? {
        buttonLabel: sourceKind === "national_team"
          ? "Copier le maillot de la sélection nationale"
          : "Copier le maillot du champion national",
        readDraft: readCopySourceDraft,
      } : undefined}
    />
  </section>;
}
