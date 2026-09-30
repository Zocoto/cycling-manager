"use client";

import { useState } from "react";

import { SponsorJerseyPreview } from "@/components/game/sponsor-jersey-preview";
import type {
  SecondarySponsorIdentity,
  SecondarySponsorLogoPlacement,
} from "@/lib/game/secondary-sponsor";
import type { Sponsor } from "@/types/sponsor";
import { updateSecondarySponsorLogoAction } from "./actions";

export function SecondarySponsorJerseyEditor({
  contractId,
  principalSponsor,
  jersey,
  secondarySponsor,
  initialPlacement,
}: {
  contractId: string;
  principalSponsor: Sponsor;
  jersey: Sponsor["jerseys"][number];
  secondarySponsor: SecondarySponsorIdentity;
  initialPlacement: SecondarySponsorLogoPlacement;
}) {
  const [placement, setPlacement] = useState(initialPlacement);

  return (
    <form
      action={updateSecondarySponsorLogoAction}
      className="grid gap-7 rounded-2xl border border-[#315B3E]/15 bg-white/90 p-5 shadow-[0_18px_45px_rgba(19,60,46,0.08)] lg:grid-cols-[minmax(240px,0.75fr)_minmax(300px,1.25fr)] lg:p-7"
    >
      <input type="hidden" name="contractId" value={contractId} />

      <div className="flex min-h-80 items-center justify-center rounded-2xl border border-[#315B3E]/10 bg-[#EAF5F3]/55 p-5">
        <SponsorJerseyPreview
          sponsor={principalSponsor}
          jersey={jersey}
          secondarySponsor={secondarySponsor}
          secondaryLogoPlacement={placement}
          className="h-72 w-60 drop-shadow-xl sm:h-80 sm:w-64"
        />
      </div>

      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
          Placement du logo
        </p>
        <h3 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#082A2A]">
          Ajuster {secondarySponsor.name}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#60756E]">
          Positionnez uniquement le logo secondaire. Le dessin et les couleurs
          du maillot principal restent inchangés.
        </p>

        <div className="mt-6 space-y-5">
          <EditorSlider
            name="xPercent"
            label="Position horizontale"
            value={placement.xPercent}
            minimum={15}
            maximum={85}
            step={1}
            suffix=" %"
            onChange={(value) => setPlacement((current) => ({ ...current, xPercent: value }))}
          />
          <EditorSlider
            name="yPercent"
            label="Position verticale"
            value={placement.yPercent}
            minimum={20}
            maximum={78}
            step={1}
            suffix=" %"
            onChange={(value) => setPlacement((current) => ({ ...current, yPercent: value }))}
          />
          <EditorSlider
            name="scale"
            label="Taille"
            value={placement.scale}
            minimum={0.5}
            maximum={1.8}
            step={0.05}
            formatValue={(value) => `${Math.round(value * 100)} %`}
            onChange={(value) => setPlacement((current) => ({ ...current, scale: value }))}
          />
          <EditorSlider
            name="rotationDegrees"
            label="Orientation"
            value={placement.rotationDegrees}
            minimum={-45}
            maximum={45}
            step={1}
            suffix="°"
            onChange={(value) =>
              setPlacement((current) => ({ ...current, rotationDegrees: value }))
            }
          />
        </div>

        <button
          type="submit"
          className="mt-7 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#082A2A] px-5 py-3 text-sm font-black text-white transition hover:bg-[#12473F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42B99A] focus-visible:ring-offset-2"
        >
          Enregistrer le placement
        </button>
      </div>
    </form>
  );
}

function EditorSlider({
  name,
  label,
  value,
  minimum,
  maximum,
  step,
  suffix = "",
  formatValue,
  onChange,
}: {
  name: string;
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  step: number;
  suffix?: string;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-4 text-sm font-black text-[#193F38]">
        <span>{label}</span>
        <span className="tabular-nums text-[#278B70]">
          {formatValue ? formatValue(value) : `${value}${suffix}`}
        </span>
      </span>
      <input
        type="range"
        name={name}
        min={minimum}
        max={maximum}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-[#278B70]"
      />
    </label>
  );
}
