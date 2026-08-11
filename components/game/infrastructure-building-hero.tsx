import Image from "next/image";

import type { TeamInfrastructureDefinition } from "@/lib/game/infrastructure";

export function InfrastructureBuildingHero({
  definition,
  currency,
  levelLabel,
  secondaryLabel,
  description = definition.summary,
}: {
  definition: TeamInfrastructureDefinition;
  currency: string;
  levelLabel: string;
  secondaryLabel?: string;
  description?: string;
}) {
  const startingCost = definition.levels[0]?.cost ?? 0;

  return (
    <div className="relative isolate min-h-[260px] overflow-hidden bg-[#071A17] text-white sm:min-h-[300px]">
      <Image
        src={definition.illustration.src}
        alt={definition.illustration.alt}
        fill
        sizes="(max-width: 768px) 100vw, 1400px"
        className="object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,26,23,0.96)_0%,rgba(7,26,23,0.82)_42%,rgba(7,26,23,0.28)_76%,rgba(7,26,23,0.08)_100%),linear-gradient(0deg,rgba(7,26,23,0.78)_0%,transparent_62%)]"
      />

      <div className="relative flex min-h-[260px] flex-col justify-between gap-8 p-6 sm:min-h-[300px] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <span className="rounded-full border border-[#F2C94C]/40 bg-[#071A17]/65 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#FFE897] backdrop-blur-sm">
            À partir de {formatMoney(startingCost, currency)}
          </span>
          <div className="flex flex-wrap justify-end gap-2">
            <span className="rounded-full border border-white/20 bg-[#071A17]/65 px-4 py-2 text-xs font-black backdrop-blur-sm">
              {levelLabel}
            </span>
            {secondaryLabel ? (
              <span className="rounded-full border border-[#F2C94C]/40 bg-[#F2C94C]/20 px-4 py-2 text-xs font-black text-[#FFE897] backdrop-blur-sm">
                {secondaryLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div className="max-w-3xl">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F2C94C]">
            {definition.domain}
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] sm:text-4xl">
            {definition.name}
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#D6DFD2] sm:text-base">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
