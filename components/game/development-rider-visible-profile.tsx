import { PotentialStars } from "@/components/game/potential-stars";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { RIDER_RATING_AXES } from "@/lib/game/rider-profile";
import type { RiderJerseyAppearance } from "@/lib/rider-jersey";
import type { DevelopmentRider } from "@/services/development-team";

export function DevelopmentRiderVisibleProfile({
  rider,
  jersey,
  avatarClassName = "h-14 w-14",
}: {
  rider: DevelopmentRider;
  jersey?: RiderJerseyAppearance;
  avatarClassName?: string;
}) {
  return (
    <span className="block">
      <span className="flex items-center gap-3 pr-9">
        <RiderAvatar
          riderId={rider.id}
          profileKey={rider.profileKey}
          seed={rider.avatarSeed}
          age={rider.age}
          jersey={jersey}
          label={`${rider.firstName} ${rider.lastName}`}
          className={`${avatarClassName} shrink-0 border-2 border-white`}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black text-[#183F37]">
            {rider.firstName} {rider.lastName}
          </span>
          <span className="mt-0.5 block text-[10px] font-bold text-[#60756E]">
            {rider.countryCode} · {rider.age} ans · {rider.sportingProfile}
          </span>
          <span className="mt-2 flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[#60756E]">
              Potentiel
            </span>
            <PotentialStars potentialSteps={rider.potentialSteps} compact />
          </span>
        </span>
      </span>

      <span className="mt-3 block rounded-xl border border-[#D5B43B]/30 bg-[#FFF8D8] px-3 py-2">
        <span className="block text-[8px] font-black uppercase tracking-[0.12em] text-[#806114]">
          Talent natif
        </span>
        {rider.nativeSpecialAbility ? (
          <>
            <span className="mt-0.5 block text-xs font-black text-[#183F37]">
              {rider.nativeSpecialAbility.name}
            </span>
            <span className="mt-0.5 block text-[9px] font-semibold leading-4 text-[#6D6549]">
              {rider.nativeSpecialAbility.effect}
            </span>
          </>
        ) : (
          <span className="mt-0.5 block text-[10px] font-bold text-[#6D6549]">
            Aucun talent natif révélé
          </span>
        )}
      </span>

      <span className="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-7">
        {RIDER_RATING_AXES.map((axis) => (
          <span
            key={axis.key}
            title={axis.label}
            className={`rounded-lg px-1 py-1.5 text-center ${
              axis.importance === "primary"
                ? "bg-[#DDF1E8] text-[#176951]"
                : "bg-white/85 text-[#526A62]"
            }`}
          >
            <span className="block text-[8px] font-black uppercase tracking-[0.06em]">
              {axis.shortLabel}
            </span>
            <span className="mt-0.5 block text-xs font-black">
              {rider.ratings[axis.key]}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}
