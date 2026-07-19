import type { RiderEquipmentSlot } from "@/services/public-rider-profile";

type EquipmentItem = {
  id: string;
  name: string;
  catalogKey: string;
};

type RiderEquipmentLoadoutProps = {
  equipment: Partial<Record<RiderEquipmentSlot, EquipmentItem>>;
  canManage: boolean;
};

const LEFT_SLOTS: Array<{ slot: RiderEquipmentSlot; label: string; icon: string }> = [
  { slot: "helmet", label: "Casque", icon: "⌒" },
  { slot: "gloves", label: "Gants", icon: "◇" },
  { slot: "bib_shorts", label: "Cuissard", icon: "▾" },
];

const RIGHT_SLOTS: Array<{ slot: RiderEquipmentSlot; label: string; icon: string }> = [
  { slot: "frame", label: "Cadre", icon: "△" },
  { slot: "wheels", label: "Roues", icon: "◎" },
  { slot: "shoes", label: "Chaussures", icon: "◒" },
];

export function RiderEquipmentLoadout({
  equipment,
  canManage,
}: RiderEquipmentLoadoutProps) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-[#102D28] text-white shadow-[0_22px_55px_rgba(7,26,23,0.18)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-6 py-5 sm:px-8">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#8FD5B6]">
            Équipement
          </p>
          <h2 className="mt-2 text-xl font-black">Configuration du coureur</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-[#BFD1C6]">
          {canManage ? "Gestion par votre équipe" : "Consultation publique"}
        </span>
      </div>

      <div className="grid gap-5 p-5 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(260px,1.3fr)_minmax(0,1fr)] md:items-center">
        <div className="space-y-4">
          {LEFT_SLOTS.map((slot) => (
            <EquipmentSlot key={slot.slot} {...slot} item={equipment[slot.slot]} />
          ))}
        </div>

        <div className="order-first rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_50%_42%,rgba(89,173,137,0.2),transparent_58%)] p-4 md:order-none">
          <CyclistSilhouette />
          <p className="mt-2 text-center text-[11px] font-semibold leading-5 text-[#9FB5A8]">
            Silhouette de placement · bonus d’équipement à définir
          </p>
        </div>

        <div className="space-y-4">
          {RIGHT_SLOTS.map((slot) => (
            <EquipmentSlot key={slot.slot} {...slot} item={equipment[slot.slot]} />
          ))}
        </div>
      </div>

      <p className="border-t border-white/10 bg-black/10 px-6 py-4 text-xs font-semibold leading-5 text-[#9FB5A8] sm:px-8">
        Le catalogue, l’acquisition, la rareté et les effets sportifs seront activés lors d’une livraison dédiée.
      </p>
    </section>
  );
}

function EquipmentSlot({
  label,
  icon,
  item,
}: {
  slot: RiderEquipmentSlot;
  label: string;
  icon: string;
  item?: EquipmentItem;
}) {
  return (
    <div className="flex min-h-20 items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.055] p-3 shadow-inner">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[#8FD5B6]/25 bg-[#8FD5B6]/10 text-xl font-black text-[#A9E0C7]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#8FD5B6]">
          {label}
        </span>
        <span className="mt-1 block truncate text-sm font-black text-white">
          {item?.name ?? "Emplacement vide"}
        </span>
      </span>
    </div>
  );
}

function CyclistSilhouette() {
  return (
    <svg
      viewBox="0 0 360 260"
      role="img"
      aria-label="Silhouette d’un cycliste et de son vélo"
      className="mx-auto w-full max-w-sm"
    >
      <g fill="none" stroke="#88B9A7" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity="0.62">
        <circle cx="82" cy="194" r="54" />
        <circle cx="280" cy="194" r="54" />
        <path d="M82 194 L145 105 L190 194 L82 194 Z" />
        <path d="M145 105 L225 119 L190 194" />
        <path d="M225 119 L280 194" />
        <path d="M211 99 L238 99" />
        <path d="M136 102 L126 88" />
      </g>
      <g fill="none" stroke="#D7EEE8" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="174" cy="46" r="21" fill="#D7EEE8" stroke="none" />
        <path d="M163 72 L137 112 L183 128 L221 115" />
        <path d="M146 91 L205 79 L228 111" />
        <path d="M183 128 L151 170 L190 194" />
        <path d="M183 128 L225 156 L250 194" />
      </g>
      <path d="M151 32 Q174 14 198 35" fill="none" stroke="#8FD5B6" strokeWidth="8" strokeLinecap="round" />
      <circle cx="190" cy="194" r="7" fill="#F2C94C" />
    </svg>
  );
}
