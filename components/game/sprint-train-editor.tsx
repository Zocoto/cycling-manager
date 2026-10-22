"use client";

import { orderSprintTrain, readSprintTrainOrder } from "@/lib/game/sprint-train";
import type { RacePreparationRider } from "@/services/race-calendar";
import type { RaceRole } from "@/lib/game/race-simulation";

export function SprintTrainEditor({ riders, roles, order, onChange, disabled }: {
  riders: RacePreparationRider[];
  roles: Record<string, RaceRole>;
  order: string[];
  onChange: (order: string[]) => void;
  disabled: boolean;
}) {
  const helpers = riders.filter((rider) => roles[rider.riderId] === "leadout")
    .map((rider) => ({ ...rider, id: rider.riderId }));
  const ordered = orderSprintTrain(helpers, order);
  const manual = readSprintTrainOrder(order).length > 0;
  const sprinter = riders.find((rider) => ["sprinter", "leader_sprinter"].includes(roles[rider.riderId]));
  const move = (index: number, direction: number) => {
    const next = ordered.map((rider) => rider.id);
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return <section className="border-t border-[#315B3E]/10 bg-[#F8FBF9] p-5 sm:p-7" aria-label="Préparation du sprint final">
    <input type="hidden" name="sprintTrainOrder" value={JSON.stringify(manual ? ordered.map((rider) => rider.id) : [])} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-base font-black text-[#0B302B]">Préparation du sprint final</h3>
        <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-[#66877C]">
          Du premier relais au dernier poisson pilote, tous les lanceurs désignés participent. Aucun nombre imposé.
        </p>
      </div>
      <button type="button" disabled={disabled || !manual} onClick={() => onChange([])}
        className="rounded-full border border-[#278B70]/30 px-3 py-2 text-xs font-black text-[#176951] disabled:opacity-50">
        Ordre automatique
      </button>
    </div>
    {ordered.length ? <>
      <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-[#397A67]">
        {manual ? "Ordre personnalisé" : "Ordre automatique · aperçu avant course"}
      </p>
      <ol className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {ordered.map((rider, index) => <li key={rider.id} className="flex items-center justify-between gap-2 rounded-xl border border-[#315B3E]/12 bg-white p-3">
          <div className="min-w-0">
            <span className="block text-[10px] font-bold text-[#66877C]">{index === ordered.length - 1 ? "Dernier lanceur" : `Relais ${index + 1}`}</span>
            <span className="block truncate text-xs font-black text-[#0B302B]">{rider.firstName} {rider.lastName}</span>
            <span className="text-[10px] font-semibold text-[#66877C]">PLA {rider.ratings.flat} · SPR {rider.ratings.sprint} · ACC {rider.ratings.acceleration}</span>
          </div>
          <div className="flex shrink-0 gap-1">
            <button type="button" aria-label={`Avancer ${rider.firstName} ${rider.lastName} dans le train`}
              disabled={disabled || index === 0} onClick={() => move(index, -1)}
              className="min-h-9 min-w-9 rounded-lg border border-[#315B3E]/15 text-[#176951] disabled:opacity-25">↑</button>
            <button type="button" aria-label={`Reculer ${rider.firstName} ${rider.lastName} dans le train`}
              disabled={disabled || index === ordered.length - 1} onClick={() => move(index, 1)}
              className="min-h-9 min-w-9 rounded-lg border border-[#315B3E]/15 text-[#176951] disabled:opacity-25">↓</button>
          </div>
        </li>)}
      </ol>
    </> : <p className="mt-3 text-xs font-semibold text-[#66877C]">Désignez des poissons pilotes dans les rôles pour composer votre train.</p>}
    <p className="mt-3 text-sm font-black text-[#0B302B]">
      {sprinter ? `Sprinteur : ${sprinter.firstName} ${sprinter.lastName}` : "Désignez votre sprinteur dans les rôles en course."}
    </p>
    <p className="mt-2 text-xs font-semibold leading-5 text-[#66877C]">
      L’ordre automatique tient compte de l’énergie restante dans le final. Les coureurs lâchés ou épuisés sont écartés ; les autres consignes restent prioritaires. Sans sprint, ce réglage est sans effet.
    </p>
  </section>;
}
