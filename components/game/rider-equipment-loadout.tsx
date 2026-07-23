import Link from "@/components/ui/app-link";

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

      {pending ? <p className="mt-2 rounded-lg border border-[#F2C94C]/25 bg-[#F2C94C]/10 px-3 py-2 text-[10px] font-bold leading-4 text-[#FFE596]">Programmé : {pending.item.name} · actif {formatEffectiveDate(pending.effectiveAt)}</p> : null}

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
      viewBox="0 0 480 310"
      role="img"
      aria-label="Cycliste de route clairement représenté de profil"
      className="mx-auto w-full max-w-md"
    >
      <defs>
        <linearGradient id="riderJersey" x1="0" x2="1">
          <stop offset="0" stopColor="#8FD5B6" />
          <stop offset="1" stopColor="#D7EEE8" />
        </linearGradient>
        <linearGradient id="riderShorts" x1="0" x2="1">
          <stop offset="0" stopColor="#173D36" />
          <stop offset="1" stopColor="#2D6658" />
        </linearGradient>
      </defs>

      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <g stroke="#83AB9D" opacity="0.72">
          <circle cx="95" cy="228" r="67" strokeWidth="5" />
          <circle cx="384" cy="228" r="67" strokeWidth="5" />
          <circle cx="95" cy="228" r="5" fill="#83AB9D" stroke="none" />
          <circle cx="384" cy="228" r="5" fill="#83AB9D" stroke="none" />
          {[
            [95, 161, 95, 295],
            [28, 228, 162, 228],
            [48, 181, 142, 275],
            [48, 275, 142, 181],
            [384, 161, 384, 295],
            [317, 228, 451, 228],
            [337, 181, 431, 275],
            [337, 275, 431, 181],
          ].map(([x1, y1, x2, y2], index) => (
            <path
              key={index}
              d={`M${x1} ${y1} L${x2} ${y2}`}
              strokeWidth="1.4"
              opacity="0.34"
            />
          ))}
        </g>

        <g stroke="#A7D2C3" strokeWidth="7">
          <path d="M95 228 L178 139 L225 228 L95 228 Z" />
          <path d="M178 139 L309 144 L225 228" />
          <path d="M309 144 L384 228" />
          <path d="M309 144 L225 228" />
        </g>
        <path d="M166 130 L194 130" stroke="#D7EEE8" strokeWidth="8" />
        <path d="M178 139 L173 127" stroke="#A7D2C3" strokeWidth="5" />
        <path d="M309 144 L320 124" stroke="#A7D2C3" strokeWidth="5" />
        <path
          d="M318 124 L344 124 C352 124 354 130 348 135 L340 141 C336 145 339 151 347 151"
          stroke="#D7EEE8"
          strokeWidth="6"
        />
        <circle cx="225" cy="228" r="14" stroke="#F2C94C" strokeWidth="4" />
        <path d="M225 228 L243 216 L262 216" stroke="#F2C94C" strokeWidth="4" />
        <path d="M225 228 L208 240 L189 240" stroke="#F2C94C" strokeWidth="4" />
      </g>

      <g strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M183 124 C186 101 203 83 226 77 C244 73 262 82 271 99 L279 116 L235 145 L198 139 Z"
          fill="url(#riderJersey)"
          stroke="#D7EEE8"
          strokeWidth="3"
        />
        <path
          d="M186 121 C174 124 168 135 173 145 C179 155 194 156 204 145 L216 131 L193 113 Z"
          fill="url(#riderShorts)"
          stroke="#8FD5B6"
          strokeWidth="3"
        />
        <path
          d="M227 82 C252 87 273 102 292 119 C301 127 313 130 331 127"
          fill="none"
          stroke="#D7EEE8"
          strokeWidth="11"
        />
        <path
          d="M224 91 C245 99 262 111 278 126 C287 135 301 138 318 134"
          fill="none"
          stroke="#B9D9CE"
          strokeWidth="9"
        />
        <path d="M330 127 L341 128" stroke="#F2C94C" strokeWidth="7" />
        <path d="M317 134 L329 138" stroke="#F2C94C" strokeWidth="7" />

        <path
          d="M190 143 C208 150 223 163 232 179 C238 190 237 203 230 218"
          fill="none"
          stroke="#244E45"
          strokeWidth="17"
        />
        <path
          d="M184 143 C172 158 164 174 167 187 C171 204 188 224 207 238"
          fill="none"
          stroke="#315F54"
          strokeWidth="15"
        />
        <path d="M229 218 L250 216" stroke="#D7EEE8" strokeWidth="10" />
        <path d="M207 238 L187 241" stroke="#B9D9CE" strokeWidth="10" />
        <path d="M247 216 L265 216" stroke="#F2C94C" strokeWidth="7" />
        <path d="M187 241 L174 241" stroke="#F2C94C" strokeWidth="7" />

        <path d="M248 78 L257 64" stroke="#D7EEE8" strokeWidth="10" />
        <path
          d="M257 38 C266 26 286 23 300 32 C309 39 312 52 308 63 L300 73 C294 80 280 82 271 76 L259 68 C253 63 251 47 257 38 Z"
          fill="#D7EEE8"
        />
        <path
          d="M251 45 C254 25 272 15 292 21 C305 25 315 35 318 48 C299 42 275 41 251 45 Z"
          fill="#4A8E78"
        />
        <path d="M316 47 L329 51" stroke="#8FD5B6" strokeWidth="6" />
        <path
          d="M282 49 L305 49 L300 57 L282 57 Z"
          fill="#102D28"
          stroke="#F2C94C"
          strokeWidth="2"
        />
        <circle cx="271" cy="57" r="3.5" fill="#8AB6A7" />
        <path
          d="M306 58 L315 61 L307 66"
          fill="none"
          stroke="#87AE9F"
          strokeWidth="2.5"
        />
        <path
          d="M286 70 C293 73 301 70 304 66"
          fill="none"
          stroke="#87AE9F"
          strokeWidth="2.2"
        />
      </g>
    </svg>
  );
}
