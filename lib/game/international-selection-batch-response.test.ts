import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const migration = read(
  "supabase/migrations/20260904021000_bulk_international_selection_responses.sql",
).toLowerCase();
const page = read("app/jeu/selections-internationales/page.tsx");
const action = read("app/jeu/selections-internationales/actions.ts");
const service = read("services/international-championship-selections.ts");

describe("bulk international selection responses", () => {
  it("shows the latest rider form in every invitation", () => {
    expect(migration).toContain(
      "get_international_selection_forms_for_auth_user",
    );
    expect(migration).toContain("coalesce(latest_condition.form, 75)");
    expect(service).toContain("currentForm");
    expect(page).toContain("Forme {selection.currentForm}/100");
  });

  it("opens the shared rider statistics preview from every invitation", () => {
    expect(page).toContain(
      'href={`/jeu/coureurs/${selection.riderId}`}',
    );
    expect(page).toContain(
      "Voir les statistiques de ${selection.riderName}",
    );
  });

  it("collects every DS choice and sends one global action", () => {
    expect(page).toContain("answerInternationalSelectionsAction");
    expect(page).toContain('name={`decision:${selection.candidateId}`}');
    expect(page).toContain("Enregistrer les {pendingCount} décision");
    expect(action).toContain('formData.get(`decision:${candidateId}`)');
    expect(service).toContain(
      '"respond_to_international_selections_with_conflict_ack"',
    );
  });

  it("prevalidates ownership and applies the whole batch atomically", () => {
    expect(migration).toContain("v_eligible_count <> v_decision_count");
    expect(migration).toContain("director.auth_user_id = auth.uid()");
    expect(migration).toContain("candidate.response_status = 'pending'");
    expect(migration).toContain(
      "perform public.respond_to_international_selection_with_conflict_ack(",
    );
    expect(migration).toContain(
      "une convocation ne peut apparaître qu’une fois dans le lot",
    );
  });

  it("keeps conflict acknowledgements isolated per rider", () => {
    expect(page).toContain(
      'name={`acknowledgedConflict:${selection.candidateId}`}',
    );
    expect(action).toContain(
      '.getAll(`acknowledgedConflict:${candidateId}`)',
    );
    expect(migration).toContain(
      "respond_to_international_selection_with_conflict_ack",
    );
  });
});
