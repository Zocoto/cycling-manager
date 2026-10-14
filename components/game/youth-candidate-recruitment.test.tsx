import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { YouthCandidateRecruitment } from "./youth-candidate-recruitment";

const candidate = { id: "junior", firstName: "Test", lastName: "Junior", age: 18, status: "spotted" as const, signingFee: 1000 };

describe("recrutement depuis les rapports juniors", () => {
  it("propose encore la signature à 18 ans", () => {
    const html = renderToStaticMarkup(<YouthCandidateRecruitment candidate={candidate} balance={1000} />);
    expect(html).toContain("Signer le jeune");
    expect(html).toContain('name="candidateId" value="junior"');
    expect(html).toContain('data-financial-expense="1000"');
    expect(html).not.toContain('disabled=""');
  });
  it.each(["spotted", "expired"] as const)("retire le formulaire à 19 ans, même avec un statut %s", (status) => {
    const html = renderToStaticMarkup(<YouthCandidateRecruitment candidate={{ ...candidate, status, age: 19 }} balance={100000} />);
    expect(html).toContain("Indisponible · plus de 18 ans");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Signer le jeune");
    expect(html).not.toContain("À l’école");
  });
  it("préserve les autres indisponibilités", () => {
    const html = renderToStaticMarkup(<YouthCandidateRecruitment candidate={{ ...candidate, status: "expired", age: 16 }} balance={100000} />);
    expect(html).toContain("Indisponible au recrutement");
    expect(html).not.toContain("<form");
  });
  it("ne présente pas un coureur déjà recruté comme une candidature expirée", () => {
    const html = renderToStaticMarkup(<YouthCandidateRecruitment candidate={{ ...candidate, status: "signed", age: 21 }} balance={100000} />);
    expect(html).toContain("Déjà recruté");
    expect(html).not.toContain("Indisponible");
    expect(html).not.toContain("<form");
  });
  it("conserve la protection du solde insuffisant", () => {
    const html = renderToStaticMarkup(<YouthCandidateRecruitment candidate={candidate} balance={999} />);
    expect(html).toContain('disabled=""');
  });
});
