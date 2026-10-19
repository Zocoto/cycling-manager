import { notFound } from "next/navigation";
import { StaffCardHeader } from "@/components/game/staff-card-header";
import { StaffSkills } from "@/components/game/staff-skills";
import { STAFF_ROLES, STAFF_ROLE_DEFINITIONS, describeStaffEffect } from "@/lib/game/staff";
import { getStaffAcademyTalentCapacity } from "@/lib/game/staff-academy";
import { describeStaffTalent, getStaffTalentCodes, STAFF_TALENT_DEFINITIONS } from "@/lib/game/staff-talents";

export const metadata = { title: "Audit local · 13 métiers du staff", robots: { index: false, follow: false } };

export default function StaffPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return <main className="min-h-screen bg-[#EAF5F3] p-4 text-[#183F37] sm:p-8">
    <h1 className="mx-auto max-w-[1500px] text-2xl font-black">Staff · 13 métiers, un même modèle</h1>
    <p className="mx-auto mt-2 max-w-[1500px] text-sm font-semibold">Aperçu local fictif · aucune lecture ou écriture dans la base de jeu.</p>
    <div className="mx-auto mt-6 grid min-w-0 max-w-[1500px] gap-5 md:grid-cols-2 xl:grid-cols-3">
      {STAFF_ROLES.map(role => {
        const code = getStaffTalentCodes(role)[0];
        const member = { role, level: 3, firstName: "Camille", lastName: "Exemple", countryCode: "FR", countryName: "France",
          trainerSpecialty: role === "trainer" || role === "youth_coach" ? "mountain" as const : null,
          architectSpecialty: role === "architect" ? "balanced" as const : null };
        return <article key={role} data-staff-role={role} className="min-w-0 max-w-full overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_42px_rgba(19,60,46,0.09)]">
          <div className="h-1.5" style={{ backgroundColor: STAFF_ROLE_DEFINITIONS[role].accent }} />
          <div className="p-5"><StaffCardHeader member={member} />
            <StaffSkills level={member.level} effects={describeStaffEffect(member)}
              talents={[{ code, label: STAFF_TALENT_DEFINITIONS[code].label, description: describeStaffTalent(code, member.level) }]}
              nationalityAffinity={role !== "trainer" && role !== "youth_coach"}
              talentCapacity={getStaffAcademyTalentCapacity(role, member.level)} />
          </div>
        </article>;
      })}
    </div>
  </main>;
}
