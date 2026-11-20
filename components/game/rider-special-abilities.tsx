import { SpecialAbilityMedallion } from "@/components/game/special-ability-medallion";
import { SPECIAL_ABILITY_CATALOG, type RiderSpecialAbility } from "@/lib/game/special-abilities";

export function RiderSpecialAbilities({
  abilities,
}: {
  abilities: RiderSpecialAbility[];
}) {
  const unlockedAbilities = new Set(abilities);
  const catalog = [
    ...SPECIAL_ABILITY_CATALOG.filter(({ code }) => unlockedAbilities.has(code)),
    ...SPECIAL_ABILITY_CATALOG.filter(({ code }) => !unlockedAbilities.has(code)),
  ];

  return (
    <section
      data-tutorial-id="rider-profile-abilities"
      aria-labelledby="rider-special-abilities-title"
      className="min-w-0 rounded-[2rem] border border-[#315B3E]/12 bg-[linear-gradient(120deg,#F1F8F4,white_65%)] p-5 shadow-[0_12px_34px_rgba(19,60,46,0.07)] sm:p-7"
    >
      <div className="grid min-w-0 items-center gap-5 xl:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <div className="min-w-0">
          <h2 id="rider-special-abilities-title" className="text-lg font-black text-[#183F37]">
            Capacités spéciales
          </h2>
          <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">
            {abilities.length > 0
              ? `${abilities.length} capacité${abilities.length > 1 ? "s" : ""} débloquée${abilities.length > 1 ? "s" : ""}. Survolez ou sélectionnez un médaillon pour voir son effet.`
              : "Les capacités connues restent grisées tant que le coureur ne les a pas débloquées. Survolez ou sélectionnez un médaillon pour voir son effet."}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-3" aria-label="Catalogue des capacités spéciales">
          {catalog.map((ability) => (
            <SpecialAbilityMedallion
              key={ability.code}
              ability={ability}
              unlocked={unlockedAbilities.has(ability.code)}
              tooltipLayout="responsive"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
