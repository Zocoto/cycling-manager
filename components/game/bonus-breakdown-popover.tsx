import type { BonusBreakdown } from "@/lib/game/bonus-breakdown";

export function BonusBreakdownPopover({
  breakdown,
  label = "Bonus global",
  tone = "light",
  compact = false,
  layout = "floating",
}: {
  breakdown: BonusBreakdown;
  label?: string;
  tone?: "light" | "dark";
  compact?: boolean;
  layout?: "floating" | "inline";
}) {
  if (breakdown.items.length === 0) return null;

  const isDark = tone === "dark";
  const isInline = layout === "inline";
  const formattedTotal = formatPercentage(breakdown.totalPercentage);

  return (
    <details
      data-layout={layout}
      className={
        isInline
          ? "group/bonus block w-full"
          : "group/bonus relative inline-block"
      }
    >
      <summary
        className={`inline-flex min-h-7 list-none items-center gap-1.5 rounded-full border px-2.5 py-1 font-black transition focus-visible:outline-none focus-visible:ring-2 ${
          isInline ? "cursor-pointer" : "cursor-help"
        } ${
          compact ? "text-[9px]" : "text-[10px]"
        } ${
          isDark
            ? "border-[#9BE0BC]/25 bg-[#9BE0BC]/10 text-[#9BE0BC] hover:bg-[#9BE0BC]/15 focus-visible:ring-[#9BE0BC]"
            : "border-[#176951]/20 bg-[#EAF5F3] text-[#176951] hover:bg-[#DDF1EA] focus-visible:ring-[#278B70]"
        }`}
        aria-label={`${label} ${formattedTotal}. Ouvrir le détail du calcul.`}
      >
        <span>{label}</span>
        <span>{formattedTotal}</span>
        <span aria-hidden="true">ⓘ</span>
      </summary>

      <span
        role={isInline ? undefined : "tooltip"}
        className={`${
          isInline
            ? "mt-2 hidden w-full rounded-xl border p-3 text-left group-open/bonus:block"
            : "invisible absolute right-0 z-50 mt-2 block w-[min(320px,calc(100vw-2rem))] translate-y-1 rounded-2xl border p-4 text-left opacity-0 shadow-2xl transition group-open/bonus:visible group-open/bonus:translate-y-0 group-open/bonus:opacity-100 group-hover/bonus:visible group-hover/bonus:translate-y-0 group-hover/bonus:opacity-100 group-focus-within/bonus:visible group-focus-within/bonus:translate-y-0 group-focus-within/bonus:opacity-100"
        } ${
          isDark
            ? "border-white/15 bg-[#102A25] text-white"
            : "border-[#315B3E]/15 bg-white text-[#183F37]"
        }`}
      >
        <span className="block text-[10px] font-black uppercase tracking-[0.13em]">
          Détail du bonus · {formattedTotal}
        </span>
        <span className="mt-1 block text-[10px] font-semibold leading-4 opacity-70">
          Les familles de bonus sont empilées multiplicativement. Les lignes
          d’une même famille sont d’abord additionnées.
        </span>
        <span className="mt-3 block space-y-2">
          {breakdown.items.map((item) => (
            <span
              key={item.key}
              className={`flex items-start justify-between gap-3 border-t pt-2 first:border-t-0 first:pt-0 ${
                isDark ? "border-white/10" : "border-[#315B3E]/10"
              }`}
            >
              <span className="min-w-0">
                <span className="block text-[11px] font-black">{item.label}</span>
                {item.detail ? (
                  <span className="mt-0.5 block text-[9px] font-semibold leading-4 opacity-65">
                    {item.detail}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-[11px] font-black">
                {formatPercentage(item.percentage)}
              </span>
            </span>
          ))}
        </span>
      </span>
    </details>
  );
}

function formatPercentage(value: number): string {
  const formatted = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1,
  }).format(Math.abs(value));
  return `${value >= 0 ? "+" : "−"}${formatted} %`;
}
