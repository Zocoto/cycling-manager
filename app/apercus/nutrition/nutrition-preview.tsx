"use client";

import { NutritionInterventionsEditor, NutritionInterventionFields, NutritionWeightProgramFields } from "@/components/game/nutrition-interventions-editor";

const riders = [
  { riderId: "demo-treated", name: "Robin Exemple", form: 10, applied: true },
  { riderId: "demo-tired", name: "Alex Exemple", form: 30 },
  { riderId: "demo-second", name: "Sam Exemple", form: 45 },
  { riderId: "demo-middle", name: "Morgan Exemple", form: 65 },
  { riderId: "demo-fresh", name: "Charlie Exemple", form: 84 },
  { riderId: "demo-full", name: "Taylor Exemple", form: 100 },
];
const nutritionists = [
  { contractId: "demo-expert", name: "Camille Expert", level: 5, remainingCapacity: 2, additionalFormBonus: 1 },
  { contractId: "demo-senior", name: "Claude Senior", level: 3, remainingCapacity: 1 },
  { contractId: "demo-junior", name: "Max Junior", level: 1, remainingCapacity: 1 },
];

export function NutritionPreview() {
  return <main className="min-h-screen bg-[#EAF5F3] p-4 pb-36 text-[#183F37] sm:p-8 sm:pb-36"
    onSubmitCapture={event => { event.preventDefault(); event.stopPropagation(); }}>
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-black">Nutrition · aperçu local</h1>
      <p className="mt-2 text-sm font-semibold text-[#60756E]">Coureurs fictifs · envoi du formulaire désactivé.</p>
      <NutritionInterventionsEditor riderIds={riders.map(rider => rider.riderId)} nutritionists={nutritionists}
        balance={50000} currency="EUR" appliedRiderIds={["demo-treated"]}
        weightRiders={riders.map(rider => ({ ...rider, heightCm: 180, weightKg: 68, cooldownDays: 0 }))}>
        <div className="mt-4 grid gap-4">
          {riders.map(rider => <article key={rider.riderId} data-preview-rider={rider.riderId}
            className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_12px_36px_rgba(19,60,46,0.06)]">
            <div className="flex items-center justify-between gap-3"><h2 className="font-black">{rider.name}</h2><span className="text-sm font-bold">{rider.form}/100</span></div>
            {rider.applied ? <p className="mt-4 text-sm font-semibold">Déjà supplémenté aujourd’hui</p>
              : <NutritionInterventionFields riderId={rider.riderId} riderForm={rider.form} riderWeightKg={68} recentInterventionCount={0} currency="EUR" />}
            <NutritionWeightProgramFields riderId={rider.riderId} />
          </article>)}
        </div>
      </NutritionInterventionsEditor>
    </div>
  </main>;
}
