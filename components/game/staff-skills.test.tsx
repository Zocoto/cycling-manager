import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STAFF_ROLES, describeStaffEffect } from "@/lib/game/staff";
import { getStaffAcademyTalentCapacity } from "@/lib/game/staff-academy";
import { describeStaffTalent, getStaffTalentCodes, STAFF_TALENT_DEFINITIONS } from "@/lib/game/staff-talents";
import { StaffCardHeader } from "./staff-card-header";
import { StaffBaseSkills, StaffSkills } from "./staff-skills";

describe("shared staff presentation audit", () => {
  for (const role of STAFF_ROLES) it(`${role}: same header, talent panel and affinity layout at every level`, () => {
    for (const level of [1, 2, 3, 4, 5]) {
      const code = getStaffTalentCodes(role)[0];
      const effects = describeStaffEffect({ role, level, trainerSpecialty: "mountain", architectSpecialty: "balanced" });
      const talents = [{ code, label: STAFF_TALENT_DEFINITIONS[code].label, description: describeStaffTalent(code, level) }];
      const markup = renderToStaticMarkup(<>
        <StaffCardHeader member={{ role, level, firstName: "Camille", lastName: "Nom très long sans troncature",
          countryCode: "FR", countryName: "France", trainerSpecialty: null, architectSpecialty: null }} />
        <StaffSkills role={role} level={level} effects={effects} talents={talents} nationalityAffinity
          talentCapacity={getStaffAcademyTalentCapacity(role, level)} />
      </>);
      expect(markup).toContain(`Niveau ${level} sur 5`);
      expect(markup).toContain("Nom très long sans troncature");
      expect(markup.match(/data-staff-section="talents"/g)).toHaveLength(1);
      expect(markup.match(/data-staff-section="affinity"/g)).toHaveLength(1);
      expect(markup).toContain(`Compétences supplémentaires · 1/${getStaffAcademyTalentCapacity(role, level)}`);
      expect(markup).toContain("bg-[#FFF9E8]");
      expect(markup).toContain("[overflow-wrap:anywhere]");
      expect(markup.includes('data-staff-section="base"')).toBe(effects.length > 0);
      expect(markup).not.toContain("un affixe au recrutement");
      expect(markup).not.toContain("Talents R&amp;D actifs");
    }
  });

  it("keeps youth-coach nationality information outside its only base skill", () => {
    for (const nationalityAffinity of [false, true]) {
      const markup = renderToStaticMarkup(<StaffSkills role="youth_coach" level={2}
        effects={describeStaffEffect({ role: "youth_coach", level: 2, trainerSpecialty: "hills" })}
        talents={[]} nationalityAffinity={nationalityAffinity} />);
      const base = markup.match(/<section data-staff-section="base"[\s\S]*?<\/section>/)?.[0] ?? "";
      const affinity = markup.match(/<section data-staff-section="affinity"[\s\S]*?<\/section>/)?.[0] ?? "";
      expect(base).toContain("+4 % d’efficacité sur les entraînements juniors vallons");
      expect(base.match(/<li\b/g)).toHaveLength(1);
      expect(base).not.toContain("nationalité");
      expect(markup).not.toContain("Effet collectif");
      expect(affinity).toContain("Bonus d’affinité nationale");
      expect(affinity).toContain("+5 % supplémentaires pour chaque junior de la même nationalité");
      expect(affinity).not.toContain("+10 %");
      expect(markup.match(/data-staff-section="affinity"/g)).toHaveLength(1);
    }
  });

  it("shows finance base income separately without inventing an R&D base effect", () => {
    expect(describeStaffEffect({ role: "research_engineer", level: 5 })).toEqual([]);
    const effects=describeStaffEffect({ role: "financial_director", level: 5 });
    const code="finance_daily_income" as const;
    const markup=renderToStaticMarkup(<StaffSkills role="financial_director" level={5} effects={effects}
      talents={[{code,label:STAFF_TALENT_DEFINITIONS[code].label,description:describeStaffTalent(code,5)}]}
      nationalityAffinity={false} />);
    expect(markup).toContain("+2900 € par jour");
    expect(markup).toContain("Optimisation des charges");
    expect(markup).toContain("−10 %");
    expect(markup.match(/data-staff-section="base"/g)).toHaveLength(1);
    expect(markup.match(/data-staff-section="talents"/g)).toHaveLength(1);
    expect(renderToStaticMarkup(<StaffBaseSkills level={3} rows={[]} />)).toBe("");
  });

  it("handles historical staff with no talent without a special per-profession layout", () => {
    const markup = renderToStaticMarkup(<StaffSkills level={1} effects={[]} talents={[]} nationalityAffinity={false} />);
    expect(markup).toContain("Compétences supplémentaires · 0/3");
    expect(markup).toContain("Aucune compétence supplémentaire.");
    expect(markup).not.toContain('data-staff-section="affinity"');
    expect(markup).not.toContain("régularisé");
  });

  it("uses the exact same shared components in both market and employed-staff cards", () => {
    const source = readFileSync(resolve(process.cwd(), "app/jeu/staff/page.tsx"), "utf8");
    expect(source.match(/<StaffCardHeader member=\{member\}/g)).toHaveLength(2);
    expect(source.match(/<StaffSkills\s/g)).toHaveLength(2);
    expect(source).not.toContain("isResearchEngineer");
    expect(source).not.toContain("function StaffTalentBlock");
  });

  it("reuses the presentation in the academy, training and medical-center summaries", () => {
    for (const [file, component] of [
      ["components/game/staff-academy-card.tsx", "<StaffAdditionalSkills"],
      ["components/game/trainer-overview-card.tsx", "<StaffSkills"],
      ["app/jeu/centre-de-soin/page.tsx", "<StaffAdditionalSkills"],
    ]) expect(readFileSync(resolve(process.cwd(), file), "utf8")).toContain(component);
  });
});
