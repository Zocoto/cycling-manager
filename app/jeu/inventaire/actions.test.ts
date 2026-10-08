import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn(), create: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.create }));
import { sellEquipmentBatchAction } from "./actions";

const id = "33333333-3333-4333-8333-333333333333";
const saleId = "44444444-4444-4444-8444-444444444444";
const sales = [{ equipmentItemId: id, quantity: 2, unequip: [], cancelPending: [] }];
function form(value: unknown = sales) {
  const data = new FormData();
  data.set("equipmentSales", JSON.stringify(value)); data.set("saleId", saleId);
  data.set("returnPath", "/jeu/inventaire?categorie=equipment"); return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc });
  mocks.getUser.mockResolvedValue({ data: { user: { id } }, error: null });
  mocks.rpc.mockResolvedValue({ data: { resalePrice: 1000, currency: "EUR", quantitySold: 2, unequippedCount: 1 }, error: null });
});
describe("sellEquipmentBatchAction", () => {
  it("valide avant tout appel à la base", async () => {
    await expect(sellEquipmentBatchAction(form([{ ...sales[0], quantity: -1 }]))).rejects.toThrow("erreur=");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("exige une session authentifiée", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(sellEquipmentBatchAction(form())).rejects.toThrow("redirect:/connexion");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("envoie un seul lot et invalide les pages touchées", async () => {
    await expect(sellEquipmentBatchAction(form())).rejects.toThrow("succes=");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("sell_current_team_equipment_batch", { p_sales: sales, p_sale_id: saleId });
    expect(mocks.revalidate).toHaveBeenCalledWith("/jeu/inventaire");
    expect(mocks.revalidate).toHaveBeenCalledWith("/jeu/coureurs/[identifiant]", "page");
    expect(mocks.revalidate).toHaveBeenCalledWith("/jeu/finances");
  });
  it("propage le refus du lot sans annoncer une vente", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Stock insuffisant" } });
    await expect(sellEquipmentBatchAction(form())).rejects.toThrow("Stock%20insuffisant");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("signale une confirmation déjà traitée", async () => {
    mocks.rpc.mockResolvedValue({ data: { alreadySold: true, resalePrice: 1000, currency: "EUR" }, error: null });
    await expect(sellEquipmentBatchAction(form())).rejects.toThrow("Aucun+mat%C3%A9riel+suppl%C3%A9mentaire");
  });
  it("neutralise un retour extérieur et refuse un identifiant de vente invalide", async () => {
    const data = form(); data.set("returnPath", "https://example.com"); data.set("saleId", "bad");
    await expect(sellEquipmentBatchAction(data)).rejects.toThrow("redirect:/jeu/inventaire?erreur=");
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
