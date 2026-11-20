import type { RiderClimateProfile } from "@/lib/game/race-weather";
import type { RiderPersonalityKey } from "@/lib/game/rider-personalities";
import type { RiderFavoriteRace } from "@/services/rider-favorite-races";
import { RiderClimateProfileCard } from "@/components/game/rider-climate-profile-card";
import { RiderFavoriteRacesCard } from "@/components/game/rider-favorite-races-card";
import { RiderPersonalityCard } from "@/components/game/rider-personality";

export function RiderMentalProfile({
  personality,
  climateProfile,
  favoriteRaces,
}: {
  personality: RiderPersonalityKey | null | undefined;
  climateProfile: RiderClimateProfile;
  favoriteRaces: RiderFavoriteRace[];
}) {
  return (
    <section
      aria-labelledby="rider-mental-profile-title"
      className="min-w-0 rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.08)]"
    >
      <div className="flex items-center gap-3 rounded-t-[2rem] border-b border-[#315B3E]/10 bg-[#F3F8F5] px-5 py-4 sm:px-7">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#DCEFE6] text-[#176951]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 20s-8-4.8-8-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.2-8 10-8 10Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m7.5 12 2.5 2.5 6-6" />
          </svg>
        </span>
        <h2 id="rider-mental-profile-title" className="text-lg font-black text-[#183F37]">
          Mental et affinités
        </h2>
      </div>
      <div className="grid min-w-0 divide-y divide-[#315B3E]/10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:divide-x lg:divide-y-0">
        <div className="grid min-w-0 content-start divide-y divide-[#315B3E]/10">
          {personality ? (
            <div className="min-w-0 p-5 sm:p-7">
              <RiderPersonalityCard personality={personality} embedded />
            </div>
          ) : null}
          <div className="min-w-0 p-5 sm:p-7">
            <RiderClimateProfileCard profile={climateProfile} embedded />
          </div>
        </div>
        <div className="min-w-0 p-5 sm:p-7">
          <RiderFavoriteRacesCard races={favoriteRaces} embedded />
        </div>
      </div>
    </section>
  );
}
