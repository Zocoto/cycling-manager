"use client";

import { useActionState, useState } from "react";
import { saveNationalChampionshipRoadChoiceAction } from "@/app/jeu/federations/national-championship-actions";
import { RaceStageProfile } from "@/components/game/race-stage-profile";
import {
  isNationalChampionshipRoadPreset,
  NATIONAL_CHAMPIONSHIP_ROAD_PRESETS,
  type NationalChampionshipRouteChoice,
} from "@/lib/game/national-championship-road-route";
import { getStageDistance } from "@/lib/game/race-profiles";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "long", timeZone: "UTC",
});

export function NationalChampionshipRoutePanel({ choice }: { choice: NationalChampionshipRouteChoice | null }) {
  if (!choice) return null;
  return <NationalChampionshipRouteChoiceForm key={`${choice.countryCode}-${choice.targetGameYear}`} choice={choice} />;
}

function NationalChampionshipRouteChoiceForm({ choice }: { choice: NationalChampionshipRouteChoice }) {
  const nextPreset = choice.nextPreset ?? "hilly";
  const [preset, setPreset] = useState(nextPreset);
  const [actionState, action, pending] = useActionState(saveNationalChampionshipRoadChoiceAction, {
    status: "idle" as const, message: "",
  });
  const canEdit = choice.viewerIsPresident && choice.window === "open";
  const previewPreset = canEdit ? preset : nextPreset;
  const segments = choice.presets[previewPreset];

  return (
    <section id="championnat-national" aria-labelledby="national-championship-route-title" className="scroll-mt-24 rounded-2xl border border-[#315B3E]/15 bg-white p-4 sm:p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">Saison {choice.targetGameYear}</p>
      <h2 id="national-championship-route-title" className="mt-1 text-xl font-black text-[#183F37]">Parcours du championnat national</h2>
      <p className="mt-2 text-sm font-semibold text-[#60756E]">Saison en cours · {NATIONAL_CHAMPIONSHIP_ROAD_PRESETS[choice.currentPreset]}</p>
      <p className="mt-1 text-sm font-semibold text-[#60756E]">
        Course en ligne professionnelle. Le président élu choisit du J22 au J28, jusqu’à 23 h 59 (heure de Paris).
      </p>

      {canEdit ? (
        <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="countryCode" value={choice.countryCode} />
          <input type="hidden" name="targetGameYear" value={choice.targetGameYear} />
          <label className="min-w-48 flex-1 text-sm font-bold text-[#183F37]">
            Profil de la prochaine saison
            <select
              name="preset"
              value={preset}
              onChange={(event) => {
                if (isNationalChampionshipRoadPreset(event.target.value)) setPreset(event.target.value);
              }}
              disabled={pending}
              className="mt-1 block min-h-11 w-full rounded-xl border border-[#315B3E]/25 bg-white px-3 font-semibold"
            >
              {Object.entries(NATIONAL_CHAMPIONSHIP_ROAD_PRESETS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-[#176951] px-4 text-sm font-black text-white hover:bg-[#0B302B] disabled:opacity-50">
            {pending ? "Enregistrement…" : "Enregistrer le profil"}
          </button>
        </form>
      ) : null}

      <p className="mt-3 text-xs font-bold text-[#60756E]">
        {choice.window === "upcoming" ? (
          <>Ouverture le {dateFormatter.format(new Date(`${choice.opensOn}T00:00:00Z`))}</>
        ) : choice.window === "closed" ? "Choix clôturé" : (
          <>Clôture le {dateFormatter.format(new Date(`${choice.closesOn}T00:00:00Z`))}</>
        )}
        {" · "}{choice.nextPreset ? "Profil enregistré" : "Vallonné par défaut"}
      </p>
      {actionState.message ? (
        <p role={actionState.status === "error" ? "alert" : "status"} className={`mt-2 text-sm font-bold ${actionState.status === "error" ? "text-[#A62B3D]" : "text-[#176951]"}`}>
          {actionState.message}
        </p>
      ) : null}

      <div className="mt-4 rounded-xl border border-[#315B3E]/10 bg-[#F6FAF7] p-3">
        <p className="mb-2 text-sm font-black text-[#183F37]">{NATIONAL_CHAMPIONSHIP_ROAD_PRESETS[previewPreset]} · {getStageDistance(segments)} km</p>
        <RaceStageProfile segments={segments} showLegend />
      </div>
    </section>
  );
}
