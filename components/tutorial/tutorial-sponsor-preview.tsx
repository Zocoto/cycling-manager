"use client";

import { useTutorial } from "@/components/tutorial/tutorial-provider";
import { ONBOARDING_TUTORIAL_KEY } from "@/lib/tutorial/onboarding";

const DEMO_OBJECTIVES = [
  "Obtenir 5 victoires pendant la saison",
  "Terminer dans le Top 10 d’une course ciblée",
  "Conserver au moins 5 coureurs français",
] as const;

export function TutorialSponsorPreview() {
  const { activeTutorial } = useTutorial();

  const currentStep =
    activeTutorial?.definition.steps[
      activeTutorial.currentStepIndex
    ];

  if (
    activeTutorial?.definition.key !==
      ONBOARDING_TUTORIAL_KEY ||
    currentStep?.key !==
      "sponsoring-demo-offer"
  ) {
    return null;
  }

  return (
    <article
      data-tutorial-id="sponsoring-demo-offer"
      className="relative mt-8 overflow-hidden rounded-2xl border border-[#278B70]/30 bg-white shadow-[0_22px_55px_rgba(19,60,46,0.12)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#315B3E]/10 bg-[#0B302B] px-6 py-4 text-white">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9BE0BC]">
            Aperçu du sponsoring
          </p>
          <h2 className="mt-1 text-xl font-black">
            Offre fictive — aucune action enregistrée
          </h2>
        </div>

        <span className="rounded-full bg-[#F2C94C] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#40320A]">
          Démonstration
        </span>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:p-8">
        <div className="flex min-h-44 items-center justify-center rounded-2xl border border-[#278B70]/20 bg-[#E9F5F0] p-6 text-center">
          <div>
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#176951] text-3xl font-black text-white shadow-lg">
              H
            </span>
            <p className="mt-4 text-lg font-black text-[#0B302B]">
              Horizon Mobilités
            </p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[#60756E]">
              France · Mobilité
            </p>
          </div>
        </div>

        <div>
          <div className="grid gap-3 sm:grid-cols-2">
            <DemoMetric
              label="Budget annuel"
              value="850 000 €"
              detail="Versé par saison"
            />
            <DemoMetric
              label="Durée"
              value="2 saisons"
              detail="Contrat principal"
            />
          </div>

          <div className="mt-5 rounded-xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-[#278B70]">
              Objectifs proposés
            </p>
            <ul className="mt-3 space-y-2">
              {DEMO_OBJECTIVES.map(
                (objective) => (
                  <li
                    key={objective}
                    className="flex items-start gap-3 text-sm font-bold leading-6 text-[#35554D]"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#F2C94C]"
                    />
                    {objective}
                  </li>
                ),
              )}
            </ul>
          </div>

          <button
            type="button"
            disabled
            className="mt-5 min-h-11 w-full cursor-not-allowed rounded-xl bg-[#B8C5BE] px-5 text-sm font-black text-[#60756E]"
          >
            Aperçu uniquement — signature impossible
          </button>
        </div>
      </div>
    </article>
  );
}

function DemoMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-[#278B70]/18 bg-[#E9F5F0] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#278B70]">
        {label}
      </p>
      <p className="mt-2 text-xl font-black text-[#0B302B]">
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold text-[#60756E]">
        {detail}
      </p>
    </div>
  );
}
