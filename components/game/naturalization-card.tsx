import type { NaturalizationEligibility } from "@/lib/game/naturalization";
import { NaturalizationSubmitButton } from "@/components/game/naturalization-submit-button";

export function NaturalizationCard({
  eligibility,
  subjectName,
  subjectId,
  subjectIdField,
  action,
  compact = false,
}: {
  eligibility: NaturalizationEligibility;
  subjectName: string;
  subjectId: string;
  subjectIdField: "riderId" | "academyRiderId";
  action: (formData: FormData) => Promise<void>;
  compact?: boolean;
}) {
  const progress = Math.min(
    100,
    Math.max(
      0,
      (eligibility.elapsedDays / eligibility.requiredDays) * 100,
    ),
  );

  return (
    <section
      aria-label={`Naturalisation de ${subjectName}`}
      className={`rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] ${
        compact ? "p-3" : "p-5 shadow-[0_10px_30px_rgba(19,60,46,0.06)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#278B70]">
            Nationalité sportive
          </p>
          <h3
            className={`mt-1 font-black text-[#183F37] ${
              compact ? "text-sm" : "text-lg"
            }`}
          >
            Naturalisation
          </h3>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] ${
            eligibility.eligible
              ? "bg-[#DDF3E7] text-[#176951]"
              : eligibility.reason === "champion_locked"
                ? "bg-[#FFF0EE] text-[#9A3434]"
                : "bg-[#ECEFEA] text-[#60756E]"
          }`}
        >
          {getStatusLabel(eligibility)}
        </span>
      </div>

      <div
        className={`mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-xl border border-[#315B3E]/10 bg-white ${
          compact ? "p-2.5" : "p-3"
        }`}
      >
        <CountryIdentity
          label="Actuelle"
          name={eligibility.currentCountry.name}
          code={eligibility.currentCountry.code}
          align="left"
        />
        <span aria-hidden="true" className="font-black text-[#278B70]">
          →
        </span>
        <CountryIdentity
          label="Équipe"
          name={eligibility.targetCountry.name}
          code={eligibility.targetCountry.code}
          align="right"
        />
      </div>

      {eligibility.reason === "tenure_incomplete" ? (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-3 text-[9px] font-black uppercase tracking-[0.1em] text-[#60756E]">
            <span>Ancienneté</span>
            <span>
              {eligibility.elapsedDays}/{eligibility.requiredDays} jours
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#315B3E]/10">
            <div
              className="h-full rounded-full bg-[#F2C94C]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      <p
        className={`mt-3 font-semibold leading-5 text-[#60756E] ${
          compact ? "text-[10px]" : "text-xs"
        }`}
      >
        {getStatusMessage(eligibility)}
      </p>

      {eligibility.eligible ? (
        <form action={action} className="mt-3">
          <input
            type="hidden"
            name={subjectIdField}
            value={subjectId}
          />
          <NaturalizationSubmitButton
            subjectName={subjectName}
            targetCountryName={eligibility.targetCountry.name}
            compact={compact}
          />
        </form>
      ) : (
        <button
          type="button"
          disabled
          className={`mt-3 w-full cursor-not-allowed rounded-xl bg-[#DADFD9] font-black uppercase tracking-[0.11em] text-[#6F7D77] ${
            compact ? "px-3 py-2.5 text-[9px]" : "px-4 py-3 text-[10px]"
          }`}
        >
          {getDisabledButtonLabel(eligibility)}
        </button>
      )}
    </section>
  );
}

function CountryIdentity({
  label,
  name,
  code,
  align,
}: {
  label: string;
  name: string;
  code: string;
  align: "left" | "right";
}) {
  return (
    <span className={`min-w-0 ${align === "right" ? "text-right" : ""}`}>
      <span className="block text-[8px] font-black uppercase tracking-[0.1em] text-[#8A9B95]">
        {label}
      </span>
      <span
        className={`mt-1 flex items-center gap-1.5 ${
          align === "right" ? "justify-end" : ""
        }`}
      >
        <span className={`fi fi-${code.toLowerCase()} shrink-0 rounded-sm`} />
        <span className="truncate text-[10px] font-black text-[#183F37]">
          {name}
        </span>
      </span>
    </span>
  );
}

function getStatusLabel(eligibility: NaturalizationEligibility): string {
  if (eligibility.eligible) return "Disponible";
  if (eligibility.reason === "champion_locked") return "Pays définitif";
  if (eligibility.reason === "same_nationality") return "Déjà acquise";
  if (eligibility.reason === "tenure_incomplete") return "En attente";
  return "Indisponible";
}

function getStatusMessage(eligibility: NaturalizationEligibility): string {
  if (eligibility.eligible) {
    return `L’ancienneté requise est atteinte. La nationalité du coureur peut devenir ${eligibility.targetCountry.name}.`;
  }
  if (eligibility.reason === "champion_locked") {
    return "Ce coureur a déjà remporté un championnat national route ou CLM. Il reste définitivement attaché à son pays d’origine.";
  }
  if (eligibility.reason === "same_nationality") {
    return `Le coureur possède déjà la nationalité de l’équipe (${eligibility.targetCountry.name}).`;
  }
  if (eligibility.reason === "tenure_incomplete") {
    return `${eligibility.remainingDays} jour${eligibility.remainingDays > 1 ? "s" : ""} de présence dans la structure manque${eligibility.remainingDays > 1 ? "nt" : ""} encore.`;
  }
  return "La naturalisation n’est pas disponible dans la situation actuelle.";
}

function getDisabledButtonLabel(
  eligibility: NaturalizationEligibility,
): string {
  if (eligibility.reason === "tenure_incomplete") {
    return `Disponible dans ${eligibility.remainingDays} j`;
  }
  if (eligibility.reason === "champion_locked") return "Naturalisation bloquée";
  if (eligibility.reason === "same_nationality") return "Nationalité identique";
  return "Naturalisation indisponible";
}
