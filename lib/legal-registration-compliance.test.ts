import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const registrationForm = read("components/auth/registration-form.tsx");
const registrationAction = read("app/(public)/inscription/actions.ts");
const registrationState = read(
  "app/(public)/inscription/registration-state.ts",
);
const privacyPage = read("app/(public)/confidentialite/page.tsx");
const termsPage = read("app/(public)/conditions-utilisation/page.tsx");
const legalNoticePage = read("app/(public)/mentions-legales/page.tsx");
const footer = read("components/layout/public-footer.tsx");
const migration = read(
  "supabase/migrations/20260829210000_record_registration_legal_acceptance.sql",
);
const serviceRoleGrantMigration = read(
  "supabase/migrations/20260830103500_grant_legal_acceptance_to_service_role.sql",
);

describe("information et acceptation légales à l’inscription", () => {
  it("demande une acceptation explicite sans confondre information et consentement", () => {
    expect(registrationState).toContain('"legalAcceptance"');
    expect(registrationForm).toContain('name="legalAcceptance"');
    expect(registrationForm).toContain('value="accepted"');
    expect(registrationForm).toContain("required");
    expect(registrationForm).toContain("J’accepte les");
    expect(registrationForm).toContain(
      "je reconnais avoir pris connaissance de la",
    );
    expect(registrationForm).not.toContain(
      "J’accepte la politique de confidentialité",
    );
  });

  it("valide le choix côté serveur et enregistre les versions acceptées", () => {
    expect(registrationAction).toContain(
      '(value) => value === "accepted"',
    );
    expect(registrationAction).toContain(
      '.from("user_legal_acceptances")',
    );
    expect(registrationAction).toContain(
      "terms_version: legalConfig.termsVersion",
    );
    expect(registrationAction).toContain(
      "privacy_notice_version: legalConfig.privacyNoticeVersion",
    );
  });

  it("conserve une preuve horodatée minimale et non modifiable par le membre", () => {
    expect(migration).toContain("accepted_at timestamptz not null default now()");
    expect(migration).toContain(
      "revoke insert, update, delete on table public.user_legal_acceptances from authenticated",
    );
    expect(migration).not.toMatch(/ip_address|user_agent|fingerprint/i);
  });

  it("autorise le serveur à enregistrer la preuve sans pouvoir la modifier", () => {
    expect(serviceRoleGrantMigration).toMatch(
      /grant select, insert\s+on table public\.user_legal_acceptances\s+to service_role/i,
    );
    expect(serviceRoleGrantMigration).toMatch(
      /revoke update, delete\s+on table public\.user_legal_acceptances\s+from service_role/i,
    );
  });

  it("met à disposition les informations prévues par le RGPD", () => {
    for (const information of [
      "Responsable du traitement",
      "finalités et bases légales",
      "Informations obligatoires",
      "Destinataires et sous-traitants",
      "Transferts hors de l’Espace économique européen",
      "Durées de conservation",
      "Vos droits",
      "Cookies et mesure de performance",
      "CNIL",
    ]) {
      expect(privacyPage).toContain(information);
    }

    for (const processor of ["Supabase", "Vercel", "Brevo"]) {
      expect(privacyPage).toContain(processor);
    }
  });

  it("rend les documents accessibles depuis le formulaire et le pied de page", () => {
    for (const path of [
      "/conditions-utilisation",
      "/confidentialite",
      "/mentions-legales",
    ]) {
      expect(registrationForm).toContain(path);
      expect(footer).toContain(path);
    }
    expect(termsPage).toContain("Conditions d’utilisation");
    expect(legalNoticePage).toContain("Vercel Inc.");
    expect(legalNoticePage).toMatch(
      /édité à titre[\s\S]*?non professionnel/,
    );
  });
});

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}
