import { ARCHITECT_SPECIALTY_LABELS } from "@/lib/game/infrastructure";
import { STAFF_ROLE_DEFINITIONS, TRAINER_SPECIALTY_LABELS, type StaffRole, type TrainerSpecialty } from "@/lib/game/staff";
import type { ArchitectSpecialty } from "@/lib/game/infrastructure";

type StaffCardIdentity = {
  firstName: string; lastName: string; role: StaffRole; level: number;
  countryCode: string; countryName: string;
  trainerSpecialty: TrainerSpecialty | null; architectSpecialty: ArchitectSpecialty | null;
};

export function StaffCardHeader({ member, specialtyLabel = "Spécialité" }: { member: StaffCardIdentity; specialtyLabel?: string }) {
  const definition = STAFF_ROLE_DEFINITIONS[member.role];
  return <>
    <header className="flex min-w-0 items-start gap-3 sm:gap-4">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
        style={{ backgroundColor: definition.accent }}><StaffRoleIcon role={member.role} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]">{definition.label}</p>
            <h3 className="mt-1 text-xl font-black text-[#183F37] [overflow-wrap:anywhere]">{member.firstName} {member.lastName}</h3>
          </div>
          <LevelStars level={member.level} />
        </div>
        <p className="mt-2 text-xs font-bold text-[#60756E] [overflow-wrap:anywhere]">
          <span className={`fi fi-${member.countryCode.toLowerCase()} mr-2 rounded-sm`} role="img" aria-label={`Drapeau : ${member.countryName}`} />
          {member.countryName}
        </p>
      </div>
    </header>
    {member.trainerSpecialty ? <p className="mt-4 inline-flex rounded-full bg-[#FFF4D0] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#71580A]">
      {specialtyLabel} · {TRAINER_SPECIALTY_LABELS[member.trainerSpecialty]}
    </p> : null}
    {member.architectSpecialty ? <p className="mt-4 inline-flex rounded-full bg-[#F4E9DD] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#7A4E28]">
      Profil · {ARCHITECT_SPECIALTY_LABELS[member.architectSpecialty]}
    </p> : null}
  </>;
}

function StaffRoleIcon({ role }: { role: StaffRole }) {
  const paths: Record<StaffRole, React.ReactNode> = {
    financial_director: <><path d="M4 4h16v16H4zM8 8h8M8 12h3M8 16h3M15 12v4M13 14h4" /></>,
    trainer: (
      <>
        <path d="M5 8v8M19 8v8M2 10v4M22 10v4M5 12h14" />
      </>
    ),
    youth_coach: (
      <>
        <path d="M4 6h16v12H4zM8 21h8M12 18v3" />
        <path d="M8 10h8M8 14h5M18 3v6" />
      </>
    ),
    scout: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="m16 16 5 5M11 8v6M8 11h6" />
      </>
    ),
    doctor: (
      <>
        <path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4Z" />
      </>
    ),
    mechanic: (
      <>
        <path d="m14 6 4-4 4 4-4 4M3 21l9-9M7 17l-3-3" />
        <circle cx="14" cy="10" r="4" />
      </>
    ),
    community_manager: (
      <>
        <path d="M4 5h16v11H9l-5 4V5Z" />
        <path d="M8 9h8M8 12h5" />
      </>
    ),
    nutritionist: (
      <>
        <path d="M12 21c-5-3-7-7-7-11 4 0 7 2 7 6" />
        <path d="M12 21c5-3 7-7 7-11-4 0-7 2-7 6V6" />
      </>
    ),
    physiotherapist: (
      <>
        <path d="M7 4v7a5 5 0 0 0 10 0V4M7 7h4M13 7h4" />
        <path d="M12 16v5" />
      </>
    ),
    race_preparer: (
      <>
        <path d="M4 18 9 7l4 8 3-6 4 9" />
        <path d="M3 21h18M6 5h6M9 2v6" />
      </>
    ),
    architect: (
      <>
        <path d="M4 21 12 3l8 18M7 15h10M9 10h6" />
      </>
    ),
    research_engineer: (
      <>
        <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" />
        <path d="M8 15h8M10 18h4" />
      </>
    ),
    educator: (
      <>
        <path d="M4 5h16v12H4zM8 21h8M12 17v4" />
        <path d="m8 11 2.5 2.5L16 8" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[role]}
    </svg>
  );
}

function LevelStars({
  level,
  compact = false,
}: {
  level: number;
  compact?: boolean;
}) {
  return (
    <span
      className="inline-flex shrink-0 gap-0.5"
      aria-label={`Niveau ${level} sur 5`}
      title={`Niveau ${level} sur 5`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`${compact ? "text-[10px]" : "text-xs"} ${
            index < level ? "text-[#E2A63B]" : "text-[#D7E1DD]"
          }`}
        >
          ★
        </span>
      ))}
    </span>
  );
}

