import Link from "@/components/ui/app-link";

export function DashboardInventoryShortcut({
  totalUnits,
  availableUnits,
}: {
  totalUnits: number;
  availableUnits: number;
}) {
  const totalLabel = formatInventoryUnits(totalUnits);
  const availableLabel = formatAvailableUnits(availableUnits);

  return (
    <Link
      href="/jeu/inventaire"
      className="group min-w-24 flex-1 rounded-2xl border border-[#315B3E]/15 bg-white/75 px-3 py-2.5 shadow-[0_12px_30px_rgba(19,60,46,0.08)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[#278B70]/35 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] sm:min-w-64 sm:flex-none sm:p-3.5"
    >
      <span className="flex h-full flex-col items-center justify-center gap-1.5 sm:flex-row sm:justify-start sm:gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#0B302B] text-[#9BE0BC] sm:h-10 sm:w-10 sm:rounded-xl">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="h-5 w-5 sm:h-6 sm:w-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 8 12 4l8 4-8 4-8-4Z" />
            <path d="m4 8 1 9 7 3 7-3 1-9M12 12v8" />
          </svg>
        </span>

        <span className="min-w-0 text-center sm:flex-1 sm:text-left">
          <span className="flex items-center justify-center gap-4 sm:justify-between">
            <span className="text-xs font-black text-[#183F37] sm:text-sm">
              Inventaire
            </span>
            <span className="hidden text-[#176951] transition-transform group-hover:translate-x-0.5 sm:inline">
              →
            </span>
          </span>

          <span className="mt-0.5 block text-[10px] font-bold leading-tight text-[#60756E] sm:hidden">
            <span className="block whitespace-nowrap">{totalLabel}</span>
            <span className="mt-0.5 block whitespace-nowrap">
              {availableLabel}
            </span>
          </span>
          <span className="mt-1 hidden text-xs font-bold text-[#60756E] sm:block">
            {totalLabel} · {availableLabel}
          </span>
        </span>
      </span>
    </Link>
  );
}

function formatInventoryUnits(value: number) {
  return `${value} objet${value > 1 ? "s" : ""}`;
}

function formatAvailableUnits(value: number) {
  return `${value} disponible${value > 1 ? "s" : ""}`;
}
