import type { FinanceIncomeAnalysis } from "@/lib/game/finance-income-analysis";

const CHART_SIZE = 260;
const CHART_CENTER = CHART_SIZE / 2;
const CHART_RADIUS = 88;

export function FinanceIncomeAnalysisPanel({
  analysis,
  currency,
  seasonName,
}: {
  analysis: FinanceIncomeAnalysis;
  currency: string;
  seasonName: string;
}) {
  const largestIncome = analysis.breakdown[0] ?? null;

  return (
    <div className="mt-7 space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <IncomeMetric
          label="Recettes de la saison"
          value={formatCurrency(analysis.totalAmount, currency)}
          detail={`Total encaissé et prévu · ${seasonName}`}
        />
        <IncomeMetric
          label="Déjà encaissé"
          value={formatCurrency(analysis.postedAmount, currency)}
          detail="Recettes effectivement reçues par l’équipe"
        />
        <IncomeMetric
          label="Encore à recevoir"
          value={formatCurrency(analysis.pendingAmount, currency)}
          detail="Versements planifiés et apports prévisibles du DF"
          accent="gold"
        />
        <IncomeMetric
          label="Part des sponsors"
          value={formatPercentage(analysis.sponsorPercentage)}
          detail={`${formatCurrency(analysis.sponsorAmount, currency)} de sponsoring`}
          accent="mint"
        />
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_18px_50px_rgba(19,60,46,0.09)]">
        <div className="border-b border-[#315B3E]/10 px-5 py-6 sm:px-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">
            Origine des revenus
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#183F37] sm:text-3xl">
            D’où vient l’argent de l’équipe ?
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
            Le graphique regroupe les recettes encaissées, planifiées et les apports prévisibles du DF,
            hors allocation de départ et mouvements annulés. Il présente les
            revenus bruts, avant déduction des charges. Les estimations du DF supposent des contrats inchangés.
          </p>
        </div>

        {analysis.breakdown.length > 0 ? (
          <div className="grid gap-7 p-5 sm:p-8 lg:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.35fr)] lg:items-center">
            <div className="mx-auto w-full max-w-[360px]">
              <IncomeDonut analysis={analysis} currency={currency} />
              {largestIncome ? (
                <div className="mt-5 rounded-2xl border border-[#F2C94C]/35 bg-[#FFF9DB] p-4 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#8A6B16]">
                    Première source de revenus
                  </p>
                  <p className="mt-1 text-lg font-black text-[#403200]">
                    {largestIncome.label} ·{" "}
                    {formatPercentage(largestIncome.percentage)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#715700]">
                    {formatCurrency(largestIncome.amount, currency)} de recettes
                  </p>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {analysis.breakdown.map((item) => (
                <article
                  key={item.key}
                  className="rounded-2xl border border-[#315B3E]/10 bg-[#F7FAF8] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-black text-[#183F37]">
                        <span
                          aria-hidden="true"
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.label}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold leading-4 text-[#789087]">
                        {item.description}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#176951] shadow-sm">
                      {formatPercentage(item.percentage)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3 border-t border-[#315B3E]/8 pt-3">
                    <div>
                      <p className="text-lg font-black text-[#071A17]">
                        {formatCurrency(item.amount, currency)}
                      </p>
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#789087]">
                        {item.transactionCount} mouvement
                        {item.transactionCount > 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="text-right text-[10px] font-bold leading-4 text-[#60756E]">
                      <p>Encaissé {formatCurrency(item.postedAmount, currency)}</p>
                      {item.pendingAmount > 0 ? (
                        <p className="text-[#8A6B16]">
                          Prévu {formatCurrency(item.pendingAmount, currency)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-5 py-12 text-center sm:px-8">
            <p className="text-lg font-black text-[#183F37]">
              Aucune recette enregistrée pour le moment
            </p>
            <p className="mt-2 text-sm font-semibold text-[#60756E]">
              Le camembert se complétera dès qu’une recette sera enregistrée.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function IncomeDonut({
  analysis,
  currency,
}: {
  analysis: FinanceIncomeAnalysis;
  currency: string;
}) {
  const segments = analysis.breakdown.reduce<{
    offset: number;
    items: Array<
      (typeof analysis.breakdown)[number] & {
        dashOffset: number;
        visiblePercentage: number;
      }
    >;
  }>(
    (state, item) => {
      const gap = Math.min(0.7, item.percentage * 0.18);
      return {
        offset: state.offset + item.percentage,
        items: [
          ...state.items,
          {
            ...item,
            dashOffset: -state.offset,
            visiblePercentage: Math.max(0, item.percentage - gap),
          },
        ],
      };
    },
    { offset: 0, items: [] },
  ).items;

  return (
    <svg
      viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
      role="img"
      aria-label={`Répartition de ${formatCurrency(analysis.totalAmount, currency)} de recettes par source`}
      className="mx-auto block h-auto w-full drop-shadow-[0_14px_24px_rgba(7,26,23,0.14)]"
    >
      <circle
        cx={CHART_CENTER}
        cy={CHART_CENTER}
        r={CHART_RADIUS}
        fill="#F7FAF8"
        stroke="#E1EBE6"
        strokeWidth="38"
      />
      {segments.map((item) => {
        return (
          <circle
            key={item.key}
            cx={CHART_CENTER}
            cy={CHART_CENTER}
            r={CHART_RADIUS}
            fill="none"
            stroke={item.color}
            strokeWidth="38"
            pathLength="100"
            strokeDasharray={`${item.visiblePercentage} ${100 - item.visiblePercentage}`}
            strokeDashoffset={item.dashOffset}
            transform={`rotate(-90 ${CHART_CENTER} ${CHART_CENTER})`}
          >
            <title>
              {item.label} : {formatCurrency(item.amount, currency)} ·{" "}
              {formatPercentage(item.percentage)}
            </title>
          </circle>
        );
      })}
      <circle
        cx={CHART_CENTER}
        cy={CHART_CENTER}
        r="61"
        fill="#FFFDF4"
      />
      <text
        x={CHART_CENTER}
        y="119"
        textAnchor="middle"
        fill="#60756E"
        fontSize="10"
        fontWeight="800"
        letterSpacing="1.2"
      >
        RECETTES DE SAISON
      </text>
      <text
        x={CHART_CENTER}
        y="144"
        textAnchor="middle"
        fill="#071A17"
        fontSize="20"
        fontWeight="900"
      >
        {formatCompactCurrency(analysis.totalAmount, currency)}
      </text>
    </svg>
  );
}

function IncomeMetric({
  label,
  value,
  detail,
  accent = "default",
}: {
  label: string;
  value: string;
  detail: string;
  accent?: "default" | "gold" | "mint";
}) {
  const valueClass =
    accent === "gold"
      ? "text-[#F2C94C]"
      : accent === "mint"
        ? "text-[#9BE0BC]"
        : "text-white";
  return (
    <article className="rounded-2xl border border-[#315B3E]/15 bg-[#0B302B] p-5 text-[#FFFDF4] shadow-[0_12px_30px_rgba(7,26,23,0.12)]">
      <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[#9BE0BC]">
        {label}
      </p>
      <p className={`mt-3 text-2xl font-black ${valueClass}`}>{value}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-[#BFD1C6]">
        {detail}
      </p>
    </article>
  );
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercentage(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value / 100);
}
