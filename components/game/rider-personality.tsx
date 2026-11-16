import {
  RIDER_PERSONALITIES,
  type RiderPersonalityKey,
} from "@/lib/game/rider-personalities";

export function RiderPersonalityBadge({
  personality,
  compact = false,
  showDescription = false,
}: {
  personality: RiderPersonalityKey | null | undefined;
  compact?: boolean;
  showDescription?: boolean;
}) {
  if (!personality) return null;
  const { label, description } = RIDER_PERSONALITIES[personality];

  const badge = (
    <span
      title={showDescription ? undefined : description}
      className={`inline-flex rounded-full border border-[#278B70]/20 bg-[#EAF5F3] font-black text-[#235E50] ${compact ? "px-2 py-0.5 text-[10px] leading-3.5" : "px-2.5 py-1 text-[11px]"}`}
    >
      {label}
    </span>
  );
  return showDescription ? (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {badge}
      <span className="text-[11px] leading-4 font-semibold">{description}</span>
    </span>
  ) : badge;
}

export function RiderPersonalityCard({
  personality,
}: {
  personality: RiderPersonalityKey | null | undefined;
}) {
  if (!personality) return null;
  const { label, description } = RIDER_PERSONALITIES[personality];

  return (
    <section className="rounded-2xl border border-[#278B70]/20 bg-[#EAF5F3] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#235E50]">
        Caractère
      </p>
      <h2 className="mt-1 text-lg font-black text-[#183F37]">{label}</h2>
      <p className="mt-1 text-sm font-semibold leading-5 text-[#42675E]">{description}</p>
    </section>
  );
}
