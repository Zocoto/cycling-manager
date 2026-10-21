import type { FinancialDirectorEffect } from "@/services/team-finances";

const EFFECT_LABELS: Record<FinancialDirectorEffect["effect"], string> = {
  daily_income: "Revenu quotidien",
  staff_salary: "Salaires du staff",
  rider_salary: "Salaires des coureurs",
  main_sponsor: "Sponsor principal",
  secondary_sponsor: "Sponsors secondaires",
  race_prize: "Primes de course",
};

function isExpenseSaving(effect: FinancialDirectorEffect) {
  return effect.effect === "staff_salary" || effect.effect === "rider_salary";
}

function positiveEffects(effects: readonly FinancialDirectorEffect[]) {
  return effects.filter((effect) => Number.isFinite(effect.amount) && effect.amount > 0);
}

function sumAmounts(effects: readonly FinancialDirectorEffect[]) {
  return effects.reduce((cents, effect) => cents + Math.round(effect.amount * 100), 0) / 100;
}

export function FinancialDirectorImpact({
  effects,
  currency,
}: {
  effects: readonly FinancialDirectorEffect[];
  currency: string;
}) {
  const visibleEffects = positiveEffects(effects);
  if (visibleEffects.length === 0) return null;

  const groups = [
    {
      key: "daily",
      label: "Revenus quotidiens",
      detail: "Des recettes supplémentaires, versées chaque jour prévu au contrat.",
      effects: visibleEffects.filter((effect) => effect.effect === "daily_income"),
    },
    {
      key: "income",
      label: "Bonus sur recettes",
      detail: "Des bonus ajoutés aux versements connus des sponsors et des courses.",
      effects: visibleEffects.filter((effect) => effect.effect !== "daily_income" && !isExpenseSaving(effect)),
    },
    {
      key: "savings",
      label: "Économies sur charges",
      detail: "Les dépenses restent brutes ; le DF reverse une économie séparée.",
      effects: visibleEffects.filter(isExpenseSaving),
    },
  ].filter((group) => group.effects.length > 0);

  return (
    <section className="mt-7 overflow-hidden rounded-[2rem] border border-[#7A68A6]/25 bg-[#F8F6FC] shadow-[0_12px_35px_rgba(64,42,101,0.06)]" aria-label="Apport du Directeur financier">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#7A68A6]/15 px-5 py-5 sm:px-8">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#756092]">Direction financière</p>
          <h2 className="mt-1 text-xl font-black text-[#183F37]">L’apport du DF, en toute transparence</h2>
          <p className="mt-2 max-w-3xl text-xs font-semibold leading-5 text-[#60756E]">
            Les apports comptabilisés sont déjà dans le solde ; les apports prévus sont inclus une seule fois dans la projection. Les économies sont des crédits en recettes, pas une réduction des dépenses affichées.
          </p>
        </div>
        <div className="rounded-xl border border-[#7A68A6]/15 bg-white px-4 py-3">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#756092]">Apport total de la saison</p>
          <p className="mt-1 text-xl font-black text-[#176951]">+{formatCurrency(sumAmounts(visibleEffects), currency)}</p>
        </div>
      </div>
      <div className={`grid gap-4 p-5 sm:p-6 ${groups.length > 1 ? "lg:grid-cols-2" : ""} ${groups.length === 3 ? "xl:grid-cols-3" : ""}`}>
        {groups.map((group) => (
          <article key={group.key} className="rounded-2xl border border-[#7A68A6]/15 bg-white p-4">
            <h3 className="text-sm font-black text-[#183F37]">{group.label}</h3>
            <p className="mt-1 text-xs font-semibold leading-5 text-[#60756E]">{group.detail}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="font-bold text-[#60756E]">Déjà comptabilisé</dt>
                <dd className="mt-1 text-base font-black text-[#176951]">+{formatCurrency(sumAmounts(group.effects.filter((effect) => effect.status === "posted")), currency)}</dd>
              </div>
              <div>
                <dt className="font-bold text-[#60756E]">Encore prévu</dt>
                <dd className="mt-1 text-base font-black text-[#756092]">+{formatCurrency(sumAmounts(group.effects.filter((effect) => effect.status === "pending")), currency)}</dd>
              </div>
            </dl>
            {group.key === "daily" ? <DailyIncomeRate effects={group.effects} currency={currency} /> : null}
            {group.key === "savings" ? <SavingsCalculation effects={group.effects} currency={currency} /> : null}
            {group.key !== "daily" ? (
              <ul className="mt-4 space-y-2 border-t border-[#7A68A6]/10 pt-3">
                {[...new Set(group.effects.map((effect) => effect.effect))].map((kind) => {
                  const matching = group.effects.filter((effect) => effect.effect === kind);
                  const rates = [...new Set(matching.flatMap((effect) => effect.bonusPercentage === null ? [] : [formatPercentage(effect.bonusPercentage)]))];
                  return (
                    <li key={kind} className="flex flex-wrap items-start justify-between gap-2 text-xs font-bold">
                      <span className="text-[#60756E]">{EFFECT_LABELS[kind]}{rates.length === 1 ? ` · ${rates[0]}` : rates.length > 1 ? " · taux selon versement" : ""}</span>
                      <span className="text-[#176951]">+{formatCurrency(sumAmounts(matching), currency)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
      <p className="px-5 pb-5 text-xs font-semibold leading-5 text-[#60756E] sm:px-8">
        Prévision selon les contrats et affixes actuels, hors primes de course encore inconnues. Les montants déjà comptabilisés conservent les bonus réellement accordés à leur date de versement.
      </p>
    </section>
  );
}

function DailyIncomeRate({ effects, currency }: { effects: readonly FinancialDirectorEffect[]; currency: string }) {
  const pending = effects.filter((effect) => effect.status === "pending");
  const amounts = [...new Set(pending.map((effect) => effect.amount))];
  if (amounts.length !== 1) return null;
  return <p className="mt-4 border-t border-[#7A68A6]/10 pt-3 text-xs font-bold text-[#60756E]">{formatCurrency(amounts[0], currency)} / jour · {new Set(pending.map((effect) => effect.dayNumber)).size} jour(s) prévu(s)</p>;
}

function SavingsCalculation({ effects, currency }: { effects: readonly FinancialDirectorEffect[]; currency: string }) {
  const baseBySource = new Map<string, number>();
  for (const effect of effects) {
    if (effect.baseAmount !== null && Number.isFinite(effect.baseAmount) && effect.baseAmount > 0) {
      baseBySource.set(effect.sourceTransactionId ?? effect.id, Math.round(effect.baseAmount * 100));
    }
  }
  const grossAmount = [...baseBySource.values()].reduce((sum, cents) => sum + cents, 0) / 100;
  if (grossAmount === 0) return null;
  const savings = sumAmounts(effects);

  return (
    <dl className="mt-4 space-y-2 rounded-xl bg-[#F3F8F5] p-3 text-xs font-bold">
      <div className="flex justify-between gap-3"><dt className="text-[#60756E]">Charges concernées avant DF</dt><dd className="text-[#A44736]">−{formatCurrency(grossAmount, currency)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-[#60756E]">Crédit d’économie DF</dt><dd className="text-[#176951]">+{formatCurrency(savings, currency)}</dd></div>
      <div className="flex justify-between gap-3 border-t border-[#315B3E]/10 pt-2"><dt className="text-[#183F37]">Coût net indicatif</dt><dd className="text-[#183F37]">{formatCurrency(Math.max(0, Math.round(grossAmount * 100) - Math.round(savings * 100)) / 100, currency)}</dd></div>
    </dl>
  );
}

export function FinancialDirectorSourceImpact({
  effects,
  baseAmount,
  currency,
  expense,
}: {
  effects: readonly FinancialDirectorEffect[];
  baseAmount: number;
  currency: string;
  expense: boolean;
}) {
  const visibleEffects = positiveEffects(effects);
  if (visibleEffects.length === 0) return null;
  const netCents = Math.round(Math.abs(baseAmount) * 100) + (expense ? -1 : 1) * Math.round(sumAmounts(visibleEffects) * 100);

  return (
    <div className="mt-3 rounded-xl border border-[#176951]/15 bg-[#EAF7EE] px-3 py-2 text-xs font-semibold text-[#176951]">
      {visibleEffects.map((effect) => (
        <div key={effect.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-0.5">
          <p>
            <span className="font-black">DF · {expense ? "économie" : "bonus"}</span>
            {effect.bonusPercentage === null ? null : ` ${formatPercentage(effect.bonusPercentage)}`}
            {effect.baseAmount !== null && effect.baseAmount > 0 ? ` sur ${formatCurrency(effect.baseAmount, currency)}` : ""}
            <span className="text-[#60756E]"> · {effect.status === "posted" ? "comptabilisé" : "prévu"}</span>
          </p>
          <p className="font-black">+{formatCurrency(effect.amount, currency)}</p>
        </div>
      ))}
      <p className="mt-1 border-t border-[#176951]/10 pt-1.5 text-[#60756E]">
        {expense ? "Coût net indicatif" : "Recette avec bonus DF"} : <span className="font-black text-[#183F37]">{formatCurrency(Math.max(0, netCents) / 100, currency)}</span>. Crédit affiché séparément dans les recettes.
      </p>
    </div>
  );
}

export function getFinancialDirectorTransactionLabel(effect: FinancialDirectorEffect): string {
  if (effect.effect === "daily_income") return "DF · revenu quotidien";
  if (isExpenseSaving(effect)) return "DF · crédit d’économie";
  return "DF · bonus sur recettes";
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value) + " %";
}
