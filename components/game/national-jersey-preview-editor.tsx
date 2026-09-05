"use client";

import { useActionState, useEffect, useId, useState } from "react";

import {
  initialNationalJerseyPublishState,
  publishNationalFederationJersey,
} from "@/app/jeu/federations/actions";
import {
  NationalJerseyDesignArtwork,
  NATIONAL_JERSEY_SHIRT_PATH,
} from "@/components/game/national-jersey-design-artwork";
import {
  decodeNationalJerseyDraft,
  DEFAULT_NATIONAL_JERSEY_DRAFT,
  getNationalJerseyDraftStorageKey,
  NATIONAL_JERSEY_MAX_ELEMENTS,
  normalizeNationalJerseyDraft,
  type NationalJerseyDraft,
  type NationalJerseyElement,
  type NationalJerseyElementKind,
  type NationalJerseyElementShape,
  type PublishedNationalJersey,
} from "@/lib/game/national-jersey-preview";

type NationalJerseyPreviewEditorProps = {
  countryCode: string;
  countryName: string;
  publishedJersey: PublishedNationalJersey | null;
  canPublish: boolean;
};

const SHAPES: Array<{ value: NationalJerseyElementShape; label: string }> = [
  { value: "rectangle", label: "Rectangle" },
  { value: "roundel", label: "Rond / ovale" },
  { value: "shield", label: "Blason" },
  { value: "diamond", label: "Losange" },
  { value: "hexagon", label: "Hexagone" },
];

const ELEMENT_LABELS: Record<NationalJerseyElementKind, string> = {
  flag: "Drapeau",
  emblem: "Emblème national",
  band: "Bande de couleur",
  shape: "Forme libre",
};

export function NationalJerseyPreviewEditor({
  countryCode,
  countryName,
  publishedJersey,
  canPublish,
}: NationalJerseyPreviewEditorProps) {
  const [draft, setDraft] = useState<NationalJerseyDraft>(
    publishedJersey?.design ?? DEFAULT_NATIONAL_JERSEY_DRAFT,
  );
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );
  const [storageStatus, setStorageStatus] = useState<
    "idle" | "restored" | "saved" | "unavailable"
  >("idle");
  const [publishState, publishAction, publishPending] = useActionState(
    publishNationalFederationJersey,
    initialNationalJerseyPublishState,
  );
  const generatedId = useId().replaceAll(":", "");
  const effectivePublishedJersey = publishState.publishedDesign
    ? {
        design: publishState.publishedDesign,
        version: publishState.version ?? publishedJersey?.version ?? 1,
        publishedAt: new Date().toISOString(),
        activationGameYear:
          publishState.activationGameYear ??
          publishedJersey?.activationGameYear ??
          3,
        isActive: false,
      }
    : publishedJersey;
  const selectedElement =
    draft.elements.find((element) => element.id === selectedElementId) ?? null;

  useEffect(() => {
    const restorationTimer = window.setTimeout(() => {
      try {
        const storedDraft = decodeNationalJerseyDraft(
          window.localStorage.getItem(
            getNationalJerseyDraftStorageKey(countryCode),
          ),
        );
        if (!storedDraft) return;

        setDraft(storedDraft);
        setSelectedElementId(storedDraft.elements.at(-1)?.id ?? null);
        setStorageStatus("restored");
      } catch {
        setStorageStatus("unavailable");
      }
    }, 0);

    return () => window.clearTimeout(restorationTimer);
  }, [countryCode]);

  function updateDraft(patch: Partial<NationalJerseyDraft>) {
    setDraft((current) => normalizeNationalJerseyDraft({ ...current, ...patch }));
    setStorageStatus("idle");
  }

  function addElement(kind: NationalJerseyElementKind) {
    if (draft.elements.length >= NATIONAL_JERSEY_MAX_ELEMENTS) return;

    const element = createNationalJerseyElement(kind);
    updateDraft({ elements: [...draft.elements, element] });
    setSelectedElementId(element.id);
  }

  function updateSelectedElement(patch: Partial<NationalJerseyElement>) {
    if (!selectedElementId) return;
    updateDraft({
      elements: draft.elements.map((element) =>
        element.id === selectedElementId ? { ...element, ...patch } : element,
      ),
    });
  }

  function moveSelectedElement(offset: -1 | 1) {
    if (!selectedElementId) return;
    const currentIndex = draft.elements.findIndex(
      (element) => element.id === selectedElementId,
    );
    const targetIndex = currentIndex + offset;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= draft.elements.length) {
      return;
    }
    const nextElements = [...draft.elements];
    [nextElements[currentIndex], nextElements[targetIndex]] = [
      nextElements[targetIndex],
      nextElements[currentIndex],
    ];
    updateDraft({ elements: nextElements });
  }

  function removeSelectedElement() {
    if (!selectedElementId) return;
    const currentIndex = draft.elements.findIndex(
      (element) => element.id === selectedElementId,
    );
    const nextElements = draft.elements.filter(
      (element) => element.id !== selectedElementId,
    );
    updateDraft({ elements: nextElements });
    setSelectedElementId(
      nextElements[Math.min(Math.max(0, currentIndex - 1), nextElements.length - 1)]
        ?.id ?? null,
    );
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
    setSelectedElementId(null);
    try {
      window.localStorage.removeItem(
        getNationalJerseyDraftStorageKey(countryCode),
      );
      setStorageStatus("idle");
    } catch {
      setStorageStatus("unavailable");
    }
  }

  function reusePublishedJersey() {
    if (!effectivePublishedJersey) return;
    setDraft(effectivePublishedJersey.design);
    setSelectedElementId(effectivePublishedJersey.design.elements.at(-1)?.id ?? null);
    setStorageStatus("idle");
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.07)]">
      <div className="grid gap-6 bg-[var(--federation-primary)] p-6 text-white sm:p-8 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-center">
        <JerseyArtwork
          countryCode={countryCode}
          countryName={countryName}
          draft={draft}
          generatedId={generatedId}
        />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--federation-accent)]">
              Atelier du maillot national
            </p>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/85">
              Toutes fédérations
            </span>
          </div>
          <h2 className="mt-3 text-3xl font-black">
            Composez librement l’identité de {countryName}
          </h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#D6DFD2]">
            Le brouillon démarre sur un maillot blanc. Drapeau, emblème, formes
            et bandes peuvent se superposer, pivoter et dépasser du patron :
            seule leur partie située dans le maillot sera conservée à l’écran.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveDraftLocally}
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/15"
            >
              Garder le brouillon
            </button>
            {effectivePublishedJersey ? (
              <button
                type="button"
                onClick={reusePublishedJersey}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/15"
              >
                Modifier à partir de ce maillot
              </button>
            ) : null}
            <button
              type="button"
              onClick={resetDraft}
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/15"
            >
              Repartir de zéro
            </button>
          </div>
          <p aria-live="polite" className="mt-3 text-xs font-bold text-[var(--federation-accent)]">
            {storageStatus === "saved"
              ? "Brouillon enregistré sur cet appareil."
              : storageStatus === "restored"
                ? "Brouillon local restauré."
                : storageStatus === "unavailable"
                  ? "Stockage local indisponible : le brouillon reste temporaire."
                  : effectivePublishedJersey
                    ? effectivePublishedJersey.isActive
                      ? `Version officielle ${effectivePublishedJersey.version} actuellement utilisée.`
                      : `Maillot composé pour la Saison ${effectivePublishedJersey.activationGameYear}. Une seule composition future est active.`
                    : "Le maillot actuel reste inchangé tant que vous ne publiez pas."}
          </p>
        </div>
      </div>

      <div className="grid gap-7 p-6 sm:p-8 xl:grid-cols-[minmax(19rem,0.72fr)_minmax(0,1.28fr)]">
        <div className="space-y-6">
          <EditorGroup title="Fond du maillot">
            <ColorControl
              label="Couleur de base"
              value={draft.baseColor}
              onChange={(baseColor) => updateDraft({ baseColor })}
            />
          </EditorGroup>

          <EditorGroup title={`Ajouter un élément · ${draft.elements.length}/${NATIONAL_JERSEY_MAX_ELEMENTS}`}>
            <div className="grid grid-cols-2 gap-2">
              <AddElementButton label="Drapeau" icon="⚑" onClick={() => addElement("flag")} />
              <AddElementButton label="Emblème" icon="♜" onClick={() => addElement("emblem")} />
              <AddElementButton label="Bande" icon="▬" onClick={() => addElement("band")} />
              <AddElementButton label="Forme" icon="◆" onClick={() => addElement("shape")} />
            </div>
          </EditorGroup>

          <EditorGroup title="Calques">
            {draft.elements.length > 0 ? (
              <ol className="space-y-2">
                {[...draft.elements].reverse().map((element, reverseIndex) => (
                  <li key={element.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedElementId(element.id)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs font-black transition ${
                        selectedElementId === element.id
                          ? "border-[var(--federation-secondary)] bg-[#DDF3E7] text-[var(--federation-secondary)]"
                          : "border-[#315B3E]/12 bg-[#F8FBF9] text-[#4F665E] hover:border-[var(--federation-secondary)]/40"
                      }`}
                    >
                      <span>{ELEMENT_LABELS[element.kind]}</span>
                      <span className="text-[9px] uppercase tracking-[0.1em] opacity-65">
                        calque {draft.elements.length - reverseIndex}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-xl border border-dashed border-[#315B3E]/20 bg-[#F8FBF9] px-4 py-6 text-center text-xs font-bold text-[#789087]">
                Aucun élément : le maillot est entièrement blanc.
              </p>
            )}
          </EditorGroup>
        </div>

        <div>
          <EditorGroup title="Placement et apparence">
            {selectedElement ? (
              <div className="space-y-5 rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-[#183F37]">
                      {ELEMENT_LABELS[selectedElement.kind]}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#789087]">
                      Les calques supérieurs recouvrent les précédents.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <LayerButton label="Descendre" onClick={() => moveSelectedElement(-1)}>↓</LayerButton>
                    <LayerButton label="Monter" onClick={() => moveSelectedElement(1)}>↑</LayerButton>
                    <LayerButton label="Supprimer" danger onClick={removeSelectedElement}>×</LayerButton>
                  </div>
                </div>

                {selectedElement.kind !== "band" ? (
                  <EditorSelect
                    label="Forme du cadre"
                    value={selectedElement.shape}
                    options={SHAPES}
                    onChange={(shape) =>
                      updateSelectedElement({ shape: shape as NationalJerseyElementShape })
                    }
                  />
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <ColorControl
                    label={selectedElement.kind === "shape" || selectedElement.kind === "band" ? "Couleur" : "Contour / motif"}
                    value={selectedElement.color}
                    onChange={(color) => updateSelectedElement({ color })}
                  />
                  <ColorControl
                    label="Accent"
                    value={selectedElement.secondaryColor}
                    onChange={(secondaryColor) =>
                      updateSelectedElement({ secondaryColor })
                    }
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <EditorRange label="Horizontal" value={selectedElement.x} minimum={-60} maximum={180} display={`${Math.round(selectedElement.x)}`} onChange={(x) => updateSelectedElement({ x })} />
                  <EditorRange label="Vertical" value={selectedElement.y} minimum={-60} maximum={190} display={`${Math.round(selectedElement.y)}`} onChange={(y) => updateSelectedElement({ y })} />
                  <EditorRange label="Largeur" value={selectedElement.width} minimum={4} maximum={220} display={`${Math.round(selectedElement.width)}`} onChange={(width) => updateSelectedElement({ width })} />
                  <EditorRange label="Hauteur" value={selectedElement.height} minimum={4} maximum={220} display={`${Math.round(selectedElement.height)}`} onChange={(height) => updateSelectedElement({ height })} />
                  <EditorRange label="Rotation" value={selectedElement.rotation} minimum={-180} maximum={180} display={`${Math.round(selectedElement.rotation)}°`} onChange={(rotation) => updateSelectedElement({ rotation })} />
                  <EditorRange label="Opacité" value={selectedElement.opacity} minimum={0.15} maximum={1} step={0.05} display={`${Math.round(selectedElement.opacity * 100)} %`} onChange={(opacity) => updateSelectedElement({ opacity })} />
                </div>
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-[#315B3E]/20 bg-[#F8FBF9] px-5 py-12 text-center text-sm font-semibold text-[#60756E]">
                Ajoutez ou sélectionnez un élément pour régler sa position, sa
                taille, sa rotation et son ordre de superposition.
              </p>
            )}
          </EditorGroup>

          <form action={publishAction} className="mt-6 rounded-2xl bg-[var(--federation-primary)] p-5 text-white">
            <input type="hidden" name="countryCode" value={countryCode} />
            <input type="hidden" name="design" value={JSON.stringify(draft)} />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black">Publication officielle</p>
                <p className="mt-1 max-w-xl text-xs font-semibold leading-5 text-[#BFD1C6]">
                  La validation remplace l’unique composition en attente. Elle
                  ne s’activera qu’au début de la saison suivante ; le maillot
                  de la saison en cours reste inchangé.
                </p>
              </div>
              <button
                type="submit"
                disabled={!canPublish || publishPending}
                className="shrink-0 rounded-xl bg-[var(--federation-accent)] px-5 py-3 text-sm font-black text-[#19352E] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {publishPending ? "Publication…" : "Valider et publier"}
              </button>
            </div>
            <p
              aria-live="polite"
              className={`mt-3 text-xs font-bold ${publishState.status === "error" ? "text-[#FFB0B6]" : "text-[var(--federation-accent)]"}`}
            >
              {!canPublish
                ? "La validation est réservée aux équipes affiliées à cette fédération."
                : publishState.message || "Votre brouillon n’affecte pas le maillot publié avant validation."}
            </p>
          </form>
        </div>
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
            <path d={NATIONAL_JERSEY_SHIRT_PATH} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${jerseyClipId})`}>
          <NationalJerseyDesignArtwork
            countryCode={countryCode}
            design={draft}
            idPrefix={`${generatedId}-draft`}
          />
        </g>
        <path d={NATIONAL_JERSEY_SHIRT_PATH} fill="none" stroke="#071A17" strokeWidth="3" strokeLinejoin="round" />
        <path d="M39 9c4 7 10 10 21 10S77 16 81 9" fill="none" stroke="#071A17" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function createNationalJerseyElement(
  kind: NationalJerseyElementKind,
): NationalJerseyElement {
  const id = `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const common = {
    id,
    kind,
    shape: "rectangle" as NationalJerseyElementShape,
    color: "#111111",
    secondaryColor: "#F2C94C",
    x: 60,
    y: 78,
    width: 58,
    height: 52,
    rotation: 0,
    opacity: 1,
  };

  if (kind === "band") return { ...common, width: 170, height: 18 };
  if (kind === "emblem") return { ...common, shape: "shield", width: 48, height: 58 };
  if (kind === "shape") return { ...common, shape: "roundel", width: 46, height: 46 };
  return common;
}

function EditorGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-black uppercase tracking-[0.16em] text-[var(--federation-secondary)]">{title}</h3>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

function AddElementButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-12 items-center gap-2 rounded-xl border border-[#315B3E]/12 bg-[#F8FBF9] px-3 text-xs font-black text-[#183F37] transition hover:border-[var(--federation-secondary)]/45 hover:bg-[#EEF8F3]">
      <span className="text-lg text-[var(--federation-secondary)]" aria-hidden="true">{icon}</span>
      {label}
    </button>
  );
}

function LayerButton({ label, onClick, danger = false, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={`grid h-9 w-9 place-items-center rounded-lg border text-base font-black transition ${danger ? "border-[#EF5B65]/30 bg-[#EF5B65]/8 text-[#B9343F] hover:bg-[#EF5B65]/15" : "border-[#315B3E]/15 bg-white text-[var(--federation-secondary)] hover:bg-[#DDF3E7]"}`}>
      {children}
    </button>
  );
}

function EditorSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-[#183F37]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-[#315B3E]/18 bg-white px-4 py-3 text-sm font-black text-[#183F37] outline-none focus:border-[var(--federation-secondary)] focus:ring-2 focus:ring-[#42B99A]/25">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block rounded-xl border border-[#315B3E]/12 bg-white p-3 text-center">
      <input type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} className="mx-auto h-11 w-full cursor-pointer rounded-lg border-0 bg-transparent p-0" />
      <span className="mt-2 block text-[10px] font-black uppercase tracking-[0.1em] text-[#60756E]">{label}</span>
    </label>
  );
}

function EditorRange({ label, value, minimum, maximum, step = 1, display, onChange }: { label: string; value: number; minimum: number; maximum: number; step?: number; display: string; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-3 text-sm font-black text-[#183F37]">
        <span>{label}</span>
        <span className="rounded-full bg-[#DDF3E7] px-3 py-1 text-xs text-[var(--federation-secondary)]">{display}</span>
      </span>
      <input type="range" value={value} min={minimum} max={maximum} step={step} onChange={(event) => onChange(Number(event.target.value))} className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#DDE8E2] accent-[var(--federation-secondary)]" />
    </label>
  );
}
