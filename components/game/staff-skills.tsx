import { getStaffNationalityAffinityDescription } from "@/lib/game/staff-talents";
import type { StaffRole } from "@/lib/game/staff";

export type StaffSkillRow = { label?: string; description: string };
export type StaffSkillTalent = { code: string; label: string; description: string };

// Shared presentational primitives: no fetching, client state, or game-rule changes.
export function StaffBaseSkills({ level, rows }: { level: number; rows: StaffSkillRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section data-staff-section="base" className="mt-4 min-w-0 rounded-2xl border border-[#315B3E]/10 bg-[#F2F8F5] p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#60756E]">
        Compétence de base · niveau {level}
      </p>
      <ul className="mt-2 space-y-1.5 text-sm font-bold leading-5 text-[#176951]">
        {rows.map((row) => (
          <li key={`${row.label ?? ""}:${row.description}`} className="flex min-w-0 gap-2">
            <span aria-hidden="true">◆</span>
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {row.label ? <span className="block text-xs font-black">{row.label}</span> : null}
              {row.description}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StaffAdditionalSkills({ talents, capacity = 3 }: {
  talents: StaffSkillTalent[]; capacity?: number;
}) {
  return (
    <section data-staff-section="talents" className="mt-3 min-w-0 rounded-2xl border border-[#E2A63B]/25 bg-[#FFF9E8] p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#8A6714]">
        Compétences supplémentaires · {talents.length}/{capacity}
      </p>
      {talents.length > 0 ? (
        <div className="mt-2 space-y-3">
          {talents.map((talent) => (
            <div key={talent.code}>
              <p className="text-xs font-black text-[#5E4A18] [overflow-wrap:anywhere]">{talent.label}</p>
              <p className="mt-0.5 min-w-0 text-xs font-bold leading-5 text-[#6D5A27] [overflow-wrap:anywhere]">
                {talent.description}
              </p>
            </div>
          ))}
        </div>
      ) : <p className="mt-2 text-xs font-semibold leading-5 text-[#6D5A27]">Aucune compétence supplémentaire.</p>}
    </section>
  );
}

export function StaffNationalityAffinity({ description = getStaffNationalityAffinityDescription() }: { description?: string }) {
  return (
    <section data-staff-section="affinity" className="mt-3 min-w-0 rounded-2xl border border-[#42B99A]/20 bg-[#EFF9F5] px-4 py-3">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#278B70]">Bonus d’affinité nationale</p>
      <p className="mt-1 text-[10px] font-black leading-5 text-[#176951] [overflow-wrap:anywhere]">
        {description}
      </p>
    </section>
  );
}

export function StaffSkills({ role, level, effects, talents, nationalityAffinity, talentCapacity = 3 }: {
  role?: StaffRole;
  level: number; effects: string[]; talents: StaffSkillTalent[];
  nationalityAffinity: boolean; talentCapacity?: number;
}) {
  return <>
    <StaffBaseSkills level={level} rows={effects.map(description => ({ description }))} />
    <StaffAdditionalSkills talents={talents} capacity={talentCapacity} />
    {role === "youth_coach" ? (
      <StaffNationalityAffinity description="+5 % supplémentaires pour chaque junior de la même nationalité" />
    ) : nationalityAffinity ? <StaffNationalityAffinity /> : null}
  </>;
}
