import type {
  RiderClimatePreference,
  RiderClimateProfile,
} from "@/lib/game/race-weather";

export const RIDER_CLIMATE_LABELS = {
  sun: "Soleil",
  heat: "Forte chaleur",
  cold: "Froid",
  rain: "Pluie",
  snow: "Neige",
  storm: "Orage",
} as const satisfies Record<RiderClimatePreference, string>;

export function RiderClimateProfileCard({
  profile,
}: {
  profile: RiderClimateProfile;
}) {
  return (
    <section
      aria-labelledby="rider-climate-profile-title"
      className="rounded-2xl border border-[#315B3E]/12 bg-white p-4 shadow-[0_12px_34px_rgba(19,60,46,0.07)]"
    >
      <h2
        id="rider-climate-profile-title"
        className="text-lg font-black text-[#183F37]"
      >
        Affinités météo
      </h2>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <ClimateAffinity
          preference={profile.strength}
          label="Favorite"
          tone="strength"
        />
        <ClimateAffinity
          preference={profile.weakness}
          label="Difficile"
          tone="weakness"
        />
      </div>
    </section>
  );
}

function ClimateAffinity({
  preference,
  label,
  tone,
}: {
  preference: RiderClimatePreference;
  label: string;
  tone: "strength" | "weakness";
}) {
  const palette =
    tone === "strength"
      ? {
          container: "border-[#42B99A]/25 bg-[#E5F4ED]",
          icon: "bg-[#176951] text-white",
          eyebrow: "text-[#278B70]",
          title: "text-[#183F37]",
        }
      : {
          container: "border-[#C94F4F]/20 bg-[#FFF0EE]",
          icon: "bg-[#8A2F2F] text-white",
          eyebrow: "text-[#B54242]",
          title: "text-[#702E2E]",
        };

  return (
    <div className={`min-w-0 rounded-xl border p-2.5 ${palette.container}`}>
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${palette.icon}`}
        >
          <RiderClimateIcon preference={preference} className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p
            className={`text-[9px] font-black uppercase tracking-[0.13em] ${palette.eyebrow}`}
          >
            {label}
          </p>
          <p className={`text-xs font-black ${palette.title}`}>
            {RIDER_CLIMATE_LABELS[preference]}
          </p>
        </div>
      </div>
    </div>
  );
}

export function RiderClimateIcon({
  preference,
  className = "h-5 w-5",
}: {
  preference: RiderClimatePreference;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {preference === "sun" ? (
        <>
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
        </>
      ) : preference === "heat" ? (
        <>
          <path d="M9 14.7V5a3 3 0 0 1 6 0v9.7a5 5 0 1 1-6 0Z" />
          <path d="M12 6v10M17.5 5.5h2M17.5 9h3" />
        </>
      ) : preference === "cold" ? (
        <>
          <path d="M9 14.7V5a3 3 0 0 1 6 0v9.7a5 5 0 1 1-6 0Z" />
          <path d="M12 11v5M17.5 6.5h3" />
        </>
      ) : preference === "rain" ? (
        <>
          <path d="M6.5 14.5h10a3.5 3.5 0 0 0 .5-7A5.5 5.5 0 0 0 6.4 9 2.8 2.8 0 0 0 6.5 14.5Z" />
          <path d="m8 17-1 2M12 17l-1 2M16 17l-1 2" />
        </>
      ) : preference === "snow" ? (
        <>
          <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />
          <path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2M5 10.5l3-.5.5-3M19 13.5l-3 .5-.5 3M5 13.5l3 .5.5 3M19 10.5l-3-.5-.5-3" />
        </>
      ) : (
        <>
          <path d="M6.5 13.5h10a3.5 3.5 0 0 0 .5-7A5.5 5.5 0 0 0 6.4 8 2.8 2.8 0 0 0 6.5 13.5Z" />
          <path d="m13 14.5-3 4h2l-1 3 4-5h-2l1-2" />
        </>
      )}
    </svg>
  );
}
