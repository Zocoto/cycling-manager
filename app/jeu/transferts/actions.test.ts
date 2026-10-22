import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: vi.fn(), auth: vi.fn(), rpc: vi.fn(), from: vi.fn(),
  single: vi.fn(), path: vi.fn(), redirect: vi.fn(), after: vi.fn(), candidates: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.path }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/services/push-notifications", () => ({ dispatchDuePushNotifications: vi.fn() }));
vi.mock("@/services/transfer-market", () => ({ getCurrentTeamDirectTransferTradeCandidates: mocks.candidates }));

import {
  cancelDirectTransferOfferAction,
  loadDirectTransferTradeCandidatesAction,
  respondToDirectTransferOfferAction,
  submitDirectTransferOfferAction,
} from "./actions";

const target = "00000000-0000-4000-8000-000000000100";
const outgoing = "00000000-0000-4000-8000-000000000200";
const offerId = "00000000-0000-4000-8000-000000000300";
const forged = "00000000-0000-4000-8000-000000000999";
function form(values: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ riderId: target, amount: "500", ...values })) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((path: string) => { throw new Error(path); });
  mocks.auth.mockResolvedValue({ data: { user: { id: "authenticated-user" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  mocks.single.mockResolvedValue({ data: { rider_id: target, offered_rider_id: outgoing }, error: null });
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: mocks.single };
  mocks.from.mockReturnValue(query);
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.auth }, rpc: mocks.rpc, from: mocks.from });
  mocks.candidates.mockResolvedValue([{ id: outgoing, firstName: "Jean", lastName: "Sortant", currentSalary: 5000, salaryPerSeason: 7000 }]);
});

describe("direct transfer offers, cash and rider exchange", () => {
  it("preserves the historical cash-only RPC and optional private note", async () => {
    await expect(submitDirectTransferOfferAction(form({ message: "  Projet sportif  " }))).rejects.toThrow("succes=");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("submit_direct_transfer_offer_with_message", {
      p_rider_id: target, p_amount: 500, p_message: "Projet sportif",
    });
    expect(mocks.path).toHaveBeenCalledWith(`/jeu/coureurs/${target}`);
  });

  it.each(["0", "500", "12300"])("allows a trade with %s € and sends only validated IDs, amount and note", async amount => {
    await expect(submitDirectTransferOfferAction(form({ amount, offeredRiderId: outgoing, sellerTeamId: forged, offeredRiderSalary: "1" }))).rejects.toThrow("succes=");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("submit_direct_transfer_trade_offer", {
      p_rider_id: target, p_offered_rider_id: outgoing, p_amount: Number(amount), p_message: null,
    });
    expect(mocks.path).toHaveBeenCalledWith(`/jeu/coureurs/${outgoing}`);
    expect(mocks.path).not.toHaveBeenCalledWith(`/jeu/coureurs/${forged}`);
  });

  it.each<Record<string, string>>([
    { amount: "0" }, { amount: "499" }, { amount: "NaN", offeredRiderId: outgoing },
    { amount: "Infinity", offeredRiderId: outgoing }, { amount: "100000001", offeredRiderId: outgoing },
    { amount: "-1", offeredRiderId: outgoing }, { offeredRiderId: "not-an-id" },
    { offeredRiderId: target }, { riderId: "bad" },
  ])("rejects invalid offers before any mutation: %j", async values => {
    await expect(submitDirectTransferOfferAction(form(values))).rejects.toThrow("erreur=");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.path).not.toHaveBeenCalled();
  });

  it.each(["x".repeat(501), "https://external.invalid/offre"])("keeps private-message validation for exchanges", async message => {
    await expect(submitDirectTransferOfferAction(form({ offeredRiderId: outgoing, message }))).rejects.toThrow("erreur=");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("fails closed without a live authenticated session", async () => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null });
    await expect(submitDirectTransferOfferAction(form({ offeredRiderId: outgoing }))).rejects.toThrow("/connexion");
    await expect(respondToDirectTransferOfferAction(form({ offerId, decision: "accept" }))).rejects.toThrow("/connexion");
    await expect(loadDirectTransferTradeCandidatesAction()).rejects.toThrow("/connexion");
    await expect(cancelDirectTransferOfferAction(form({ offerId }))).rejects.toThrow("/connexion");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.candidates).not.toHaveBeenCalled();
  });

  it("does not report success or revalidate after a rejected exchange", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "Ce coureur est inscrit à une course non terminée." } });
    await expect(submitDirectTransferOfferAction(form({ offeredRiderId: outgoing }))).rejects.toThrow("erreur=");
    expect(mocks.path).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it.each(["accept", "reject"])("uses the existing decision RPC and server-read rider IDs for %s", async decision => {
    await expect(respondToDirectTransferOfferAction(form({ offerId, decision, riderId: forged, offeredRiderId: forged }))).rejects.toThrow("succes=");
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("direct_transfer_offers");
    expect(mocks.from.mock.results[0].value.eq).toHaveBeenCalledWith("id", offerId);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("respond_to_direct_transfer_offer", { p_offer_id: offerId, p_accept: decision === "accept" });
    expect(mocks.path).toHaveBeenCalledWith(`/jeu/coureurs/${target}`);
    expect(mocks.path).toHaveBeenCalledWith(`/jeu/coureurs/${outgoing}`);
    expect(mocks.path).not.toHaveBeenCalledWith(`/jeu/coureurs/${forged}`);
  });

  it("keeps cash-only offer acceptance working with no offered rider", async () => {
    mocks.single.mockResolvedValue({ data: { rider_id: target, offered_rider_id: null }, error: null });
    await expect(respondToDirectTransferOfferAction(form({ offerId, decision: "accept" }))).rejects.toThrow("succes=");
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.path).toHaveBeenCalledWith(`/jeu/coureurs/${target}`);
  });

  it.each([
    { data: null, error: null },
    { data: null, error: { message: "RLS denied" } },
  ])("rejects an inaccessible offer before mutating it", async response => {
    mocks.single.mockResolvedValue(response);
    await expect(respondToDirectTransferOfferAction(form({ offerId, decision: "accept" }))).rejects.toThrow("erreur=");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not revalidate on an atomic acceptance failure", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "Le coureur n’est plus disponible." } });
    await expect(respondToDirectTransferOfferAction(form({ offerId, decision: "accept" }))).rejects.toThrow("erreur=");
    expect(mocks.path).not.toHaveBeenCalled();
  });

  it("withdraws an own pending offer and invalidates both real rider sheets without notifications", async () => {
    await expect(cancelDirectTransferOfferAction(form({ offerId, riderId: forged, offeredRiderId: forged }))).rejects.toThrow("succes=");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("cancel_current_direct_transfer_offer", { p_offer_id: offerId });
    expect(mocks.path).toHaveBeenCalledWith(`/jeu/coureurs/${target}`);
    expect(mocks.path).toHaveBeenCalledWith(`/jeu/coureurs/${outgoing}`);
    expect(mocks.path).not.toHaveBeenCalledWith(`/jeu/coureurs/${forged}`);
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("keeps repeated withdrawal idempotent when the RPC confirms a canceled offer", async () => {
    await expect(cancelDirectTransferOfferAction(form({ offerId }))).rejects.toThrow("succes=");
    await expect(cancelDirectTransferOfferAction(form({ offerId }))).rejects.toThrow("succes=");
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it.each(["Offre déjà acceptée.", "Seul l’acheteur peut retirer cette offre."])("does not pretend withdrawal succeeded if the RPC refuses it: %s", async message => {
    mocks.rpc.mockResolvedValue({ error: { message } });
    await expect(cancelDirectTransferOfferAction(form({ offerId }))).rejects.toThrow("erreur=");
    expect(mocks.path).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("does not mutate an inaccessible offer on withdrawal", async () => {
    mocks.single.mockResolvedValue({ data: null, error: null });
    await expect(cancelDirectTransferOfferAction(form({ offerId }))).rejects.toThrow("erreur=");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("loads trade options only for the authenticated identity, never client parameters", async () => {
    const result = await loadDirectTransferTradeCandidatesAction();
    expect(result.candidates).toHaveLength(1);
    expect(mocks.candidates).toHaveBeenCalledExactlyOnceWith("authenticated-user");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.path).not.toHaveBeenCalled();
  });

  it("makes a candidate-load failure optional without leaking private error details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.candidates.mockRejectedValue(new Error("database internal secret"));
    const result = await loadDirectTransferTradeCandidatesAction();
    expect(result.candidates).toEqual([]);
    expect(result.error).toContain("réessayer");
    expect(result.error).not.toContain("secret");
    expect(mocks.path).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
