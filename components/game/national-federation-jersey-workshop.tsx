"use client";

import { useCallback, useState } from "react";
import { NationalJerseyPreviewEditor } from "./national-jersey-preview-editor";
import { NationalFederationJersey } from "./national-federation-jersey";
import { NATIONAL_JERSEY_KIND_LABELS, type NationalJerseyDraft, type NationalJerseyKind, type PublishedNationalJersey } from "@/lib/game/national-jersey-preview";

export function NationalFederationJerseyWorkshop({ countryCode, countryName, selectionJersey, championJersey, canEdit, previewOnly = false }: {
  countryCode: string; countryName: string; selectionJersey: PublishedNationalJersey | null; championJersey: PublishedNationalJersey | null; canEdit: boolean; previewOnly?: boolean;
}) {
  const [kind, setKind] = useState<NationalJerseyKind>("national_team");
  const [drafts, setDrafts] = useState<Partial<Record<NationalJerseyKind, NationalJerseyDraft>>>({});
  const rememberDraft = useCallback((draft: NationalJerseyDraft) => {
    setDrafts(current => current[kind] === draft ? current : { ...current, [kind]: draft });
  }, [kind]);
  const kits = { national_team: selectionJersey, national_champion: championJersey };
  return <section aria-label="Les deux maillots de la fédération" className="space-y-5">
    <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">Identités de la fédération</p>
      <h2 className="mt-2 text-2xl font-black text-[#183F37]">Maillots de la fédération</h2>
      <p className="mt-2 text-sm font-semibold text-[#60756E]">Une tenue pour représenter le pays. Une autre pour honorer ses champions. Chaque composition est indépendante.</p></div>
    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Choisir le maillot à composer">
      {(["national_team", "national_champion"] as const).map((value) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)}
        className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${kind === value ? "border-[#278B70] bg-[#E1F3E9] ring-2 ring-[#278B70]/15" : "border-[#315B3E]/15 bg-white hover:bg-[#F8FBF9]"}`}>
        <NationalFederationJersey countryCode={countryCode} countryName={countryName} kind={value} design={kits[value]?.design} className="h-20 w-16 shrink-0 drop-shadow-md" />
        <span><span className="block text-base font-black text-[#183F37]">{NATIONAL_JERSEY_KIND_LABELS[value]}</span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-[#60756E]">{value === "national_team" ? "Rendez-vous internationaux · nom du pays, devise et texte libre" : "Champions sur route et CLM · porté au sein de leur club"}</span>
          <span className="mt-2 block text-[10px] font-black uppercase tracking-wider text-[#278B70]">{kind === value ? "Atelier ouvert" : "Ouvrir cet atelier →"}</span></span>
      </button>)}
    </div>
    <NationalJerseyPreviewEditor key={kind} countryCode={countryCode} countryName={countryName} jerseyKind={kind} publishedJersey={kits[kind]} canEdit={canEdit} previewOnly={previewOnly} initialDraft={drafts[kind]} onDraftChange={rememberDraft} />
  </section>;
}
