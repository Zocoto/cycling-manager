import Link from "next/link";

import { equipRiderAction } from "@/app/jeu/materiel/actions";
import { EquipmentSubmitButton } from "@/components/game/equipment-submit-button";
import {
  combineEquipmentEffects,
  getEquipmentCategory,
  type EquipmentEffects,
  type EquipmentSlot,
} from "@/lib/game/equipment";
import { RIDER_RATING_AXES, type RiderRatingKey } from "@/lib/game/rider-profile";
import type { PublicRiderProfile } from "@/services/public-rider-profile";
import type {
  RiderEquipmentManagement,
  TeamEquipmentCatalogItem,
} from "@/services/team-equipment";

type EquipmentItem = {
  id: string;
  name: string;
  catalogKey: string;
  effectSummary: string;
  effects: EquipmentEffects;
};

type RiderEquipmentLoadoutProps = {
  riderId: string;
  equipment: PublicRiderProfile["equipment"];
  canManage: boolean;
  management: RiderEquipmentManagement | null;
};

const LEFT_SLOTS: Array<{ slot: EquipmentSlot; label: string; icon: string }> = [
  { slot: "helmet", label: "Casque", icon: "CS" },
  { slot: "glasses", label: "Lunettes", icon: "LU" },
  { slot: "gloves", label: "Gants", icon: "GA" },
  { slot: "bib_shorts", label: "Cuissard", icon: "CU" },
];

const RIGHT_SLOTS: Array<{ slot: EquipmentSlot; label: string; icon: string }> = [
  { slot: "frame", label: "Cadre", icon: "CA" },
  { slot: "front_wheel", label: "Roue avant", icon: "AV" },
  { slot: "rear_wheel", label: "Roue arrière", icon: "AR" },
  { slot: "shoes", label: "Chaussures", icon: "CH" },
];

export function RiderEquipmentLoadout({
  riderId,
  equipment,
  canManage,
  management,
}: RiderEquipmentLoadoutProps) {
  const activeEquipment = (management?.current ?? equipment) as Partial<
    Record<EquipmentSlot, EquipmentItem>
  >;
  const combinedEffects = combineEquipmentEffects(
    Object.values(activeEquipment)
      .filter((item): item is EquipmentItem => Boolean(item))
      .map((item) => item.effects)
  );

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
          {canManage ? "Modifiable par votre équipe" : "Consultation publique"}
        </span>
      </div>

      {canManage && management ? (
        <div className={management.frozenForToday
          ? "border-b border-[#F2C94C]/20 bg-[#F2C94C]/10 px-6 py-4 text-xs font-bold leading-5 text-[#FFE596] sm:px-8"
          : "border-b border-[#42B99A]/20 bg-[#42B99A]/10 px-6 py-4 text-xs font-bold leading-5 text-[#9BE0BC] sm:px-8"}
        >
          {management.frozenForToday
            ? "Gel de l’étape du jour actif depuis 12 h : vos changements sont enregistrés maintenant et prendront effet demain à 12 h."
            : "Les changements réalisés avant 12 h seront actifs pour la course ou l’étape de 20 h."}
        </div>
      ) : null}

      <div className="grid gap-5 p-5 sm:p-8 xl:grid-cols-[minmax(0,1fr)_minmax(280px,1.15fr)_minmax(0,1fr)] xl:items-center">
        <div className="space-y-4">
          {LEFT_SLOTS.map((slot) => (
            <EquipmentSlotCard key={slot.slot} {...slot} riderId={riderId} item={activeEquipment[slot.slot]} pending={management?.pending[slot.slot]} options={management?.availableBySlot[slot.slot] ?? []} canManage={canManage && Boolean(management)} />
          ))}
        </div>

        <div className="order-first rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_50%_42%,rgba(89,173,137,0.2),transparent_58%)] p-4 md:order-none">
          <CyclistSilhouette />
          <EquipmentBonusSummary effects={combinedEffects} />
        </div>

        <div className="space-y-4">
          {RIGHT_SLOTS.map((slot) => (
            <EquipmentSlotCard key={slot.slot} {...slot} riderId={riderId} item={activeEquipment[slot.slot]} pending={management?.pending[slot.slot]} options={management?.availableBySlot[slot.slot] ?? []} canManage={canManage && Boolean(management)} />
          ))}
        </div>
      </div>

      <p className="border-t border-white/10 bg-black/10 px-6 py-4 text-xs font-semibold leading-5 text-[#9FB5A8] sm:px-8">
        Les bonus bleus sont ajoutés aux caractéristiques de base pendant les courses compatibles. Les effets de protection et de réputation sont calculés séparément.
      </p>
    </section>
  );
}

function EquipmentSlotCard({
  riderId,
  slot,
  label,
  icon,
  item,
  pending,
  options,
  canManage,
}: {
  riderId: string;
  slot: EquipmentSlot;
  label: string;
  icon: string;
  item?: EquipmentItem;
  pending?: { item: TeamEquipmentCatalogItem; effectiveAt: string };
  options: TeamEquipmentCatalogItem[];
  canManage: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.055] p-3 shadow-inner">
      <div className="flex min-h-16 items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[#8FD5B6]/25 bg-[#8FD5B6]/10 text-xs font-black text-[#A9E0C7]">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#8FD5B6]">{label}</span>
          <span className="mt-1 block truncate text-sm font-black text-white">{item?.name ?? "Emplacement vide"}</span>
          {item ? <span className="mt-1 line-clamp-2 block text-[10px] font-semibold leading-4 text-[#9FB5A8]">{item.effectSummary}</span> : null}
        </span>
      </div>

      {pending ? <p className="mt-2 rounded-lg border border-[#F2C94C]/25 bg-[#F2C94C]/10 px-3 py-2 text-[10px] font-bold leading-4 text-[#FFE596]">Programmé : {pending.item.name} · actif {formatEffectiveDate(pending.effectiveAt)}</p> : null}

      {canManage ? (
        <details className="group/slot mt-2 border-t border-white/10 pt-2">
          <summary className="cursor-pointer list-none text-[10px] font-black uppercase tracking-wider text-[#9BE0BC] marker:hidden">{item ? "Changer cette pièce" : "Équiper ce slot"}</summary>
          <div className="mt-3 space-y-2">
            {options.length > 0 ? options.map((option) => (
              <form key={option.id} action={equipRiderAction} className="rounded-xl border border-white/10 bg-black/10 p-3">
                <input type="hidden" name="riderId" value={riderId} />
                <input type="hidden" name="slot" value={slot} />
                <input type="hidden" name="equipmentItemId" value={option.id} />
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0"><span className="block truncate text-xs font-black text-white">{option.name}</span><span className="mt-1 block text-[9px] font-semibold leading-4 text-[#9FB5A8]">{option.effectSummary}</span></span>
                  <EquipmentSubmitButton mode="equip" disabled={option.id === item?.id || option.id === pending?.item.id} />
                </div>
              </form>
            )) : (
              <Link href={`/jeu/materiel?categorie=${slot}`} className="block rounded-lg border border-dashed border-[#8FD5B6]/30 px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-[#9BE0BC] hover:bg-white/5">Acheter des {getEquipmentCategory(slot).label.toLowerCase()}</Link>
            )}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function EquipmentBonusSummary({ effects }: { effects: EquipmentEffects }) {
  const ratingBonuses = getPositiveRatingBonuses(effects.ratingBonuses)
    .sort(([left], [right]) => ratingOrder(left) - ratingOrder(right));
  const timeTrialRatingBonuses = getPositiveRatingBonuses(
    effects.timeTrialRatingBonuses
  ).sort(([left], [right]) => ratingOrder(left) - ratingOrder(right));
  const hasEffects = ratingBonuses.length > 0 || timeTrialRatingBonuses.length > 0 || effects.injuryRiskReductionPct > 0 || effects.breakawayReputationBonus > 0 || effects.victoryReputationBonus > 0;

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 p-4 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#8FD5B6]">Cumul des bonus actifs</p>
      {hasEffects ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {ratingBonuses.map(([key, value]) => <span key={key} className="rounded-full border border-[#73BFFF]/35 bg-[#1D6FA5]/20 px-2.5 py-1 text-[10px] font-black text-[#8FD1FF]">{ratingLabel(key)} +{formatBonus(value)}</span>)}
          {timeTrialRatingBonuses.map(([key, value]) => <span key={`tt-${key}`} className="rounded-full border border-[#73BFFF]/35 bg-[#1D6FA5]/20 px-2.5 py-1 text-[10px] font-black text-[#8FD1FF]">{ratingLabel(key)} +{formatBonus(value)} · CLM</span>)}
          {effects.injuryRiskReductionPct > 0 ? <span className="rounded-full border border-[#9BE0BC]/30 bg-[#42B99A]/15 px-2.5 py-1 text-[10px] font-black text-[#9BE0BC]">Blessure −{formatBonus(effects.injuryRiskReductionPct)} %</span> : null}
          {effects.breakawayReputationBonus > 0 ? <span className="rounded-full border border-[#F2C94C]/30 bg-[#F2C94C]/10 px-2.5 py-1 text-[10px] font-black text-[#FFE596]">Rép. échappée +{formatBonus(effects.breakawayReputationBonus)}</span> : null}
          {effects.victoryReputationBonus > 0 ? <span className="rounded-full border border-[#F2C94C]/30 bg-[#F2C94C]/10 px-2.5 py-1 text-[10px] font-black text-[#FFE596]">Rép. victoire +{formatBonus(effects.victoryReputationBonus)}</span> : null}
        </div>
      ) : <p className="mt-2 text-[11px] font-semibold leading-5 text-[#9FB5A8]">Aucun bonus tant que les emplacements restent vides.</p>}
    </div>
  );
}

function ratingLabel(key: RiderRatingKey) { return RIDER_RATING_AXES.find((axis) => axis.key === key)?.shortLabel ?? key; }
function ratingOrder(key: RiderRatingKey) { return RIDER_RATING_AXES.findIndex((axis) => axis.key === key); }
function getPositiveRatingBonuses(bonuses: Partial<Record<RiderRatingKey, number>>) {
  return Object.entries(bonuses).flatMap(([key, value]) =>
    Number(value) > 0 ? [[key as RiderRatingKey, Number(value)] as const] : []
  );
}
function formatBonus(value: number) { return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value); }
function formatEffectiveDate(value: string) { return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }

function CyclistSilhouette() {
  return (
    <svg
      viewBox="0 0 400 270"
      role="img"
      aria-label="Silhouette réaliste d’un cycliste sur un vélo de route"
      className="mx-auto w-full max-w-sm"
    >
      <g
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g stroke="#88B9A7" strokeWidth="6" opacity="0.64">
          <circle cx="78" cy="201" r="53" />
          <circle cx="310" cy="201" r="53" />
        </g>

        <g stroke="#78A594" strokeWidth="7" opacity="0.78">
          <path d="M78 201 L151 119 L190 201 L78 201 Z" />
          <path d="M151 119 L256 123 L190 201" />
          <path d="M256 123 L263 148 L310 201" />
          <path d="M263 148 L190 201" />
          <path d="M263 148 L305 198" opacity="0.7" />
        </g>

        <g stroke="#A4CDBE" opacity="0.88">
          <path d="M141 111 L163 111" strokeWidth="7" />
          <path d="M151 119 L146 109" strokeWidth="5" />
          <path d="M256 123 L270 109" strokeWidth="5" />
          <path
            d="M269 109 L286 109 C292 109 294 114 289 118 L282 124 C278 128 281 134 287 134"
            strokeWidth="6"
          />
        </g>

        <g stroke="#B9D9CE" opacity="0.9">
          <circle cx="190" cy="201" r="12" strokeWidth="4" />
          <path d="M190 201 L205 190 L221 190" strokeWidth="4" />
          <path d="M190 201 L175 212 L159 212" strokeWidth="4" />
        </g>
      </g>

      <g strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M151 117 C159 96 175 82 195 76 C204 74 212 79 215 88 L217 94 L169 128 Z"
          fill="#D7EEE8"
          stroke="#D7EEE8"
          strokeWidth="4"
        />
        <path
          d="M151 112 C145 116 143 124 148 130 C155 136 166 134 172 126 L181 115 L160 104 Z"
          fill="#8FD5B6"
          stroke="#8FD5B6"
          strokeWidth="3"
        />

        <path
          d="M200 84 C219 87 231 97 244 109 C251 115 259 117 272 114"
          fill="none"
          stroke="#D7EEE8"
          strokeWidth="10"
        />
        <path
          d="M194 91 C208 99 221 108 234 118 C243 125 253 125 264 120"
          fill="none"
          stroke="#B9D9CE"
          strokeWidth="8"
        />
        <circle cx="273" cy="114" r="5" fill="#8FD5B6" />
        <circle cx="264" cy="120" r="4.5" fill="#8FD5B6" />

        <path
          d="M161 126 C183 132 203 143 212 157 C216 165 211 178 204 190"
          fill="none"
          stroke="#D7EEE8"
          strokeWidth="13"
        />
        <path
          d="M154 127 C143 143 138 158 143 169 C149 183 163 197 175 208"
          fill="none"
          stroke="#B9D9CE"
          strokeWidth="11"
        />
        <path d="M201 190 L218 190" stroke="#F2C94C" strokeWidth="7" />
        <path d="M172 209 L158 212" stroke="#E5C65C" strokeWidth="7" />

        <path
          d="M196 77 L204 65"
          fill="none"
          stroke="#D7EEE8"
          strokeWidth="9"
        />
        <circle cx="214" cy="49" r="19" fill="#D7EEE8" />
        <path
          d="M197 48 C201 29 219 20 236 30 C242 34 245 39 246 44 C231 39 214 40 197 48 Z"
          fill="#8FD5B6"
        />
        <path
          d="M241 43 L250 47"
          fill="none"
          stroke="#8FD5B6"
          strokeWidth="5"
        />
        <path
          d="M231 51 C232 56 229 60 225 62"
          fill="none"
          stroke="#8AB6A7"
          strokeWidth="2.5"
          opacity="0.75"
        />
      </g>

      <circle cx="190" cy="201" r="5" fill="#F2C94C" />
    </svg>
  );
}
