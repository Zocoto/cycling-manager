import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260930130000_repair_gouille_referrals_and_harden_assignment.sql",
  ),
  "utf8",
);

const registrationAction = readFileSync(
  join(process.cwd(), "app/(public)/inscription/actions.ts"),
  "utf8",
);

const registrationForm = readFileSync(
  join(process.cwd(), "components/auth/registration-form.tsx"),
  "utf8",
);

describe("referral assignment reliability", () => {
  it("rejoue l’attribution lors des arrivées tardives de métadonnées", () => {
    expect(migration).toContain("private.assign_referral_from_auth_user");
    expect(migration).toContain(
      "after insert or update of raw_user_meta_data, email_confirmed_at",
    );
    expect(migration).toContain("on conflict (referred_director_id) do nothing");
    expect(migration).toContain("v_existing_referrer_id = v_referrer_director_id");
  });

  it("n’expose la finalisation de secours qu’au service role", () => {
    expect(migration).toContain("public.finalize_registration_referral");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
    expect(registrationAction).toContain('admin.rpc(');
    expect(registrationAction).toContain('"finalize_registration_referral"');
  });

  it("valide un code saisi manuellement avant de créer le compte", () => {
    expect(registrationForm).toContain(
      'label="Code de parrainage (facultatif)"',
    );
    expect(registrationAction).toContain("getPublicReferralInvitation");
    expect(registrationAction).toContain(
      "Le code de parrainage n’est pas reconnu.",
    );
  });

  it("conserve une invitation pendant les navigations de la session", () => {
    expect(registrationForm).toContain("REFERRAL_SESSION_STORAGE_KEY");
    expect(registrationForm).toContain("window.sessionStorage.setItem(");
    expect(registrationForm).toContain("window.sessionStorage.getItem(");
    expect(registrationForm).toContain(
      "window.sessionStorage.removeItem(REFERRAL_SESSION_STORAGE_KEY)",
    );
  });

  it("borne le rattrapage manuel de Gouille au compte non ambigu", () => {
    expect(migration).toContain("lower(director.username) = 'tymeo2202'");
    expect(migration).not.toContain("luca ferraguzzi");
    expect(migration).not.toContain("like 'lucho%'");
    expect(migration).not.toContain("like 'lucas%'");
    expect(migration).toContain("if v_candidate_count <> 1 then");
    expect(migration).toContain("referral.referrer_director_id = v_gouille_id");
    expect(migration).toContain("Aucune attribution appliquee");
  });
});
