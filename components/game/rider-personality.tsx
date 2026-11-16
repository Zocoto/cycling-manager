import {
  RIDER_PERSONALITIES,
  type RiderPersonalityKey,
} from "@/lib/game/rider-personalities";

export function RiderPersonalityBadge({
  personality,
}: {
  personality: RiderPersonalityKey | null | undefined;
}) {
  if (!personality) return null;
  const { label, description } = RIDER_PERSONALITIES[personality];

  return (
    <span
      title={description}
      className="inline-flex rounded-full border border-[#278B70]/20 bg-[#EAF5F3] px-2.5 py-1 text-[11px] font-black text-[#235E50]"
    >
      {label}
    </span>
  );
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
