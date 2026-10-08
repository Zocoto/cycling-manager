import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), account: vi.fn(), createAdmin: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createAdmin,
}));

import { SEASON_FINALE_GALA_RESULTS_EVENT_ID } from "@/lib/game/season-finale-gala-results-data";
import { buildGalaRewardEmailText, sendSeasonFinaleGalaRewardEmails } from "./season-finale-gala-email";

const claims = [1, 2].map((index) => ({
  id: `outbox-${index}`,
  auth_user_id: `account-${index}`,
  manager_name: `Manager ${index}`,
  subject: "Gala : votre récompense / Your prize",
  body: `Votre lot ${index} a été ajouté à votre inventaire. <Équipement> & victoire`,
  idempotency_key: `gala-s3-test-manager-${index}`,
}));

function claimOnlyFirst() {
  mocks.rpc.mockImplementation((name: string) => Promise.resolve({
    data: name === "claim_pcm_gala_reward_emails" ? claims.slice(0, 1) : true,
    error: null,
  }));
}

function marks() {
  return mocks.rpc.mock.calls
    .filter(([name]) => name === "mark_pcm_gala_reward_email")
    .map(([, parameters]) => parameters);
}

describe("mails transactionnels des récompenses du gala, doubles simulés uniquement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("BREVO_API_KEY", "test-secret-not-a-production-key");
    vi.stubEnv("BREVO_TRANSACTIONAL_SENDER_EMAIL", "gala@test.invalid");
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.createAdmin.mockReturnValue({ rpc: mocks.rpc, auth: { admin: { getUserById: mocks.account } } });
    mocks.rpc.mockImplementation((name: string) => Promise.resolve({
      data: name === "claim_pcm_gala_reward_emails" ? claims : true,
      error: null,
    }));
    mocks.account.mockImplementation((id: string) => Promise.resolve({
      data: { user: { email: `${id}@test.invalid` } }, error: null,
    }));
    mocks.fetch.mockImplementation(async (_url: string, options: RequestInit) => {
      const payload = JSON.parse(String(options.body));
      return Response.json({ messageId: `accepted-${payload.headers["Idempotency-Key"]}` }, { status: 201 });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("réserve uniquement le gala publié et envoie deux mails avec des clés de dédoublonnage stables", async () => {
    const summary = await sendSeasonFinaleGalaRewardEmails();
    expect(summary).toEqual({ claimed: 2, sent: 2, failed: 0, uncertain: 0 });
    expect(mocks.rpc).toHaveBeenCalledWith("claim_pcm_gala_reward_emails", {
      p_event_id: SEASON_FINALE_GALA_RESULTS_EVENT_ID, p_limit: 10,
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    for (const [index, [url, options]] of mocks.fetch.mock.calls.entries()) {
      expect(url).toBe("https://api.brevo.com/v3/smtp/email");
      expect(options).toMatchObject({ method: "POST", cache: "no-store" });
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(options.headers).toEqual({ accept: "application/json", "content-type": "application/json", "api-key": "test-secret-not-a-production-key" });
      const payload = JSON.parse(options.body);
      expect(payload.headers).toEqual({ "Idempotency-Key": claims[index].idempotency_key });
      expect(payload.to).toEqual([{ email: `${claims[index].auth_user_id}@test.invalid`, name: claims[index].manager_name }]);
      expect(payload.sender).toEqual({ name: "Cyclo Stratège", email: "gala@test.invalid" });
      expect(payload.textContent).toContain("https://cyclostratege.fr/jeu/gala-fin-de-saison");
      expect(payload.htmlContent).toContain("&lt;Équipement&gt; &amp; victoire");
      expect(payload.htmlContent).not.toContain("<Équipement>");
    }
    expect(marks()).toEqual(claims.map((claim) => ({
      p_email_id: claim.id, p_status: "sent", p_message_id: `accepted-${claim.idempotency_key}`, p_error: null,
    })));
    expect(JSON.stringify(summary)).not.toContain("secret");
    expect(JSON.stringify(summary)).not.toContain("@test.invalid");
  });

  it("n'envoie rien une seconde fois quand l'outbox n'a plus de mail à réserver", async () => {
    await sendSeasonFinaleGalaRewardEmails();
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    expect(await sendSeasonFinaleGalaRewardEmails()).toEqual({ claimed: 0, sent: 0, failed: 0, uncertain: 0 });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.account).toHaveBeenCalledTimes(2);
  });

  it.each([400, 403, 422, 429])("marque HTTP %i comme échec certain, jamais comme envoyé", async (status) => {
    claimOnlyFirst();
    mocks.fetch.mockResolvedValue(new Response("provider body must remain private", { status }));
    expect(await sendSeasonFinaleGalaRewardEmails()).toEqual({ claimed: 1, sent: 0, failed: 1, uncertain: 0 });
    expect(marks()).toEqual([{ p_email_id: "outbox-1", p_status: "failed", p_error: `Provider HTTP ${status}`, p_message_id: null }]);
  });

  it.each([408, 500, 502, 503])("marque HTTP %i comme incertain sans déclarer le mail envoyé", async (status) => {
    claimOnlyFirst();
    mocks.fetch.mockResolvedValue(new Response("provider body must remain private", { status }));
    expect(await sendSeasonFinaleGalaRewardEmails()).toEqual({ claimed: 1, sent: 0, failed: 0, uncertain: 1 });
    expect(marks()).toEqual([{ p_email_id: "outbox-1", p_status: "uncertain", p_error: `Provider HTTP ${status}`, p_message_id: null }]);
  });

  it("traite un timeout comme résultat incertain, sans tentative automatique supplémentaire", async () => {
    claimOnlyFirst();
    mocks.fetch.mockRejectedValue(new DOMException("Sensitive network detail", "TimeoutError"));
    expect(await sendSeasonFinaleGalaRewardEmails()).toEqual({ claimed: 1, sent: 0, failed: 0, uncertain: 1 });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(marks()).toEqual([{ p_email_id: "outbox-1", p_status: "uncertain", p_message_id: null, p_error: "Delivery outcome requires manual verification" }]);
    expect(JSON.stringify(marks())).not.toContain("Sensitive");
  });

  it.each(["missing-id", "invalid-json"])("ne déclare jamais envoyé un accusé incomplet : %s", async (kind) => {
    claimOnlyFirst();
    mocks.fetch.mockResolvedValue(kind === "missing-id" ? Response.json({}, { status: 201 }) : new Response("invalid JSON", { status: 201 }));
    expect(await sendSeasonFinaleGalaRewardEmails()).toEqual({ claimed: 1, sent: 0, failed: 0, uncertain: 1 });
    expect(marks().map((mark) => mark.p_status)).toEqual(["uncertain"]);
  });

  it("ne compte pas un succès quand l'enregistrement persistant retourne false", async () => {
    mocks.rpc.mockImplementation((name: string) => Promise.resolve({
      data: name === "claim_pcm_gala_reward_emails" ? claims.slice(0, 1) : false,
      error: null,
    }));
    const summary = await sendSeasonFinaleGalaRewardEmails();
    expect(summary.sent).toBe(0);
    expect(summary.claimed).toBe(1);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(marks().map((mark) => mark.p_status)).toEqual(["sent", "uncertain"]);
  });

  it("ne marque pas un refus fournisseur comme enregistré si la base retourne false", async () => {
    mocks.rpc.mockImplementation((name: string) => Promise.resolve({
      data: name === "claim_pcm_gala_reward_emails" ? claims.slice(0, 1) : false,
      error: null,
    }));
    mocks.fetch.mockResolvedValue(new Response("rejected", { status: 400 }));
    const summary = await sendSeasonFinaleGalaRewardEmails();
    expect(summary.sent).toBe(0);
    expect(summary.failed).toBe(0);
    expect(marks().map((mark) => mark.p_status)).toEqual(["failed", "uncertain"]);
  });

  it("enregistre un compte sans adresse comme échec avant tout appel fournisseur", async () => {
    claimOnlyFirst();
    mocks.account.mockResolvedValue({ data: { user: null }, error: { message: "private account details" } });
    expect(await sendSeasonFinaleGalaRewardEmails()).toEqual({ claimed: 1, sent: 0, failed: 1, uncertain: 0 });
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(marks()).toEqual([{ p_email_id: "outbox-1", p_status: "failed", p_message_id: null, p_error: "Account email unavailable" }]);
  });

  it("échoue sans accès à la base si le fournisseur n'est pas configuré", async () => {
    vi.stubEnv("BREVO_API_KEY", " ");
    await expect(sendSeasonFinaleGalaRewardEmails()).rejects.toThrow("Le service de mails n’est pas configuré.");
    expect(mocks.createAdmin).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("n'envoie rien si les réservations de l'outbox échouent", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private database details" } });
    await expect(sendSeasonFinaleGalaRewardEmails()).rejects.toThrow("Impossible de réserver les mails du gala.");
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.account).not.toHaveBeenCalled();
  });

  it("rappelle les gains d'équipement sans promettre d'argent, de points ou d'effets sur la forme", () => {
    const text = buildGalaRewardEmailText("Votre casque est disponible.");
    expect(text).toContain("Votre casque est disponible.");
    expect(text).toContain("added to your team’s inventory");
    expect(text).toContain("no money or ranking points");
    expect(text).toContain("does not change your riders’ fitness");
  });
});
