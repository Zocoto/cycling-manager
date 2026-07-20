import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EquipmentSubmitButton } from "@/components/game/equipment-submit-button";
import { GameHeader } from "@/components/game/game-header";
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_SLOTS,
  getEquipmentCategory,
  type EquipmentSlot,
} from "@/lib/game/equipment";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getCurrentTeamEquipmentOverview,
  type TeamEquipmentCatalogItem,
} from "@/services/team-equipment";
import { purchaseEquipmentAction } from "./actions";

export const metadata: Metadata = {
  title: "Gestion du matériel",
  description: "Achetez, stockez et attribuez le matériel de votre équipe.",
};

type MaterialPageProps = {
  searchParams: Promise<{
    categorie?: string | string[];
    achat?: string | string[];
    erreur?: string | string[];
  }>;
};

export default async function MaterialPage({ searchParams }: MaterialPageProps) {
  const query = await searchParams;
  const rawCategory = readQuery(query.categorie);
  const category = isEquipmentSlot(rawCategory) ? rawCategory : null;
  const success = readQuery(query.achat) === "confirme";
  const errorMessage = readQuery(query.erreur);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) redirect("/connexion");

  await supabase.rpc("settle_current_team_finances");
  const [headerData, overview] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getCurrentTeamEquipmentOverview(user.id),
  ]);

  if (!overview) redirect("/jeu");

  const visibleItems = category
    ? overview.catalog.filter((item) => item.slot === category)
    : overview.catalog;
  const ownedReferences = overview.catalog.filter(
    (item) => item.ownedQuantity > 0
  ).length;
  const ownedPieces = overview.catalog.reduce(
    (total, item) => total + item.ownedQuantity,
    0
  );

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/jeu"
          className="inline-flex items-center gap-2 text-sm font-extrabold text-[#176951] transition hover:text-[#0B302B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951]"
        >
          <span aria-hidden="true">←</span>
          Retour au bureau du DS
        </Link>

        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.2)] sm:px-10 sm:py-10">
          <div aria-hidden="true" className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[44px] border-white/5" />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">
                Performance · protection · image
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
                Gestion du matériel
              </h1>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2]">
                Constituez l’inventaire de {overview.teamName}, puis attribuez chaque pièce depuis la fiche du coureur. Les bonus sportifs se cumulent pendant les courses.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <HeroMetric label="Solde" value={formatCurrency(overview.balance, overview.currency)} />
              <HeroMetric label="Références" value={String(ownedReferences)} />
              <HeroMetric label="Pièces" value={String(ownedPieces)} />
            </div>
          </div>
        </header>

        {success ? (
          <div className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-900">
            Le matériel a été ajouté à l’inventaire de votre équipe.
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mt-5 rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-bold text-red-900">
            {errorMessage.slice(0, 300)}
          </div>
        ) : null}

        <section className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.7fr)]">
          <article className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">Rubrique active</p>
                <h2 className="mt-2 text-2xl font-black text-[#183F37]">Matériel commercial</h2>
              </div>
              <span className="rounded-full bg-[#DDF3E7] px-4 py-2 text-xs font-black uppercase tracking-wider text-[#176951]">Catalogue ouvert</span>
            </div>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
              Chaque achat débite immédiatement la trésorerie. Une référence achetée peut être attribuée à un seul coureur par exemplaire.
            </p>
          </article>

          <article className="relative overflow-hidden rounded-[2rem] border border-[#D29F32]/25 bg-[#0B302B] p-6 text-white shadow-[0_16px_45px_rgba(7,26,23,0.14)] sm:p-8">
            <span className="absolute right-5 top-5 rounded-full bg-[#F2C94C]/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#F2C94C]">Maintenance</span>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#9BE0BC]">Prochaine évolution</p>
            <h2 className="mt-2 text-2xl font-black text-white">Partenariat équipementier</h2>
            <p className="mt-4 text-sm font-semibold leading-6 text-[#BFD1C6]">
              Les contrats exclusifs, dotations automatiques et objectifs de marque seront développés dans une prochaine version.
            </p>
          </article>
        </section>

        <section className="mt-7 rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">Filtres visuels</p>
              <h2 className="mt-2 text-2xl font-black text-[#183F37]">Choisir une catégorie</h2>
            </div>
            {category ? (
              <Link href="/jeu/materiel" className="text-sm font-black text-[#176951] hover:text-[#0B302B]">Voir tout le catalogue</Link>
            ) : null}
          </div>

          <nav aria-label="Catégories de matériel" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            {EQUIPMENT_CATEGORIES.map((entry) => (
              <Link
                key={entry.slot}
                href={`/jeu/materiel?categorie=${entry.slot}`}
                aria-current={category === entry.slot ? "page" : undefined}
                className={category === entry.slot
                  ? "group rounded-2xl border border-[#176951] bg-[#0B302B] p-3 text-center text-white shadow-lg"
                  : "group rounded-2xl border border-[#315B3E]/15 bg-[#F8FBF9] p-3 text-center text-[#315B3E] transition hover:-translate-y-0.5 hover:border-[#278B70]/40 hover:bg-[#EAF5F3]"}
              >
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-[#42B99A]/12 text-[#278B70] group-aria-[current=page]:text-[#9BE0BC]">
                  <EquipmentCategoryIcon slot={entry.slot} />
                </span>
                <span className="mt-2 block text-xs font-black">{entry.label}</span>
              </Link>
            ))}
          </nav>
        </section>

        <section className="mt-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">{category ? getEquipmentCategory(category).label : "Toutes les catégories"}</p>
              <h2 className="mt-2 text-2xl font-black text-[#183F37]">{visibleItems.length} références disponibles</h2>
            </div>
            <p className="max-w-xl text-right text-xs font-semibold leading-5 text-[#60756E]">
              Les modifications faites après 12 h sont enregistrées immédiatement mais ne deviennent actives que le lendemain à midi.
            </p>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((item) => (
              <EquipmentProductCard
                key={item.id}
                item={item}
                currency={overview.currency}
                balance={overview.balance}
                activeCategory={category}
              />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function EquipmentProductCard({
  item,
  currency,
  balance,
  activeCategory,
}: {
  item: TeamEquipmentCatalogItem;
  currency: string;
  balance: number;
  activeCategory: EquipmentSlot | null;
}) {
  const cannotAfford = balance <= 0 || balance < item.price;

  return (
    <article className="flex overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_42px_rgba(19,60,46,0.09)]">
      <div className="flex w-full flex-col">
        <div className="relative aspect-[16/10] overflow-hidden bg-[#071A17]">
          <Image src={item.imagePath} alt={`Univers visuel ${item.supplierName}`} fill sizes="(min-width:1280px) 30vw, (min-width:768px) 50vw, 100vw" className="object-cover transition duration-500 hover:scale-[1.03]" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-5 pb-4 pt-12 text-white">
            <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#9BE0BC]">{item.supplierName}</p>
            <h3 className="mt-1 text-xl font-black">{item.name}</h3>
          </div>
          <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#176951]">{getEquipmentCategory(item.slot).shortLabel}</span>
          <span className="absolute right-4 top-4 rounded-full bg-[#F2C94C] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#071A17]">{rarityLabel(item.rarity)}</span>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <p className="text-sm font-semibold leading-6 text-[#60756E]">{item.description}</p>
          <div className="mt-4 rounded-xl border border-[#42B99A]/20 bg-[#EAF5F3] px-4 py-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#278B70]">Effet en course</p>
            <p className="mt-1 text-sm font-black leading-5 text-[#183F37]">{item.effectSummary}</p>
          </div>

          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-2xl font-black text-[#183F37]">{formatCurrency(item.price, currency)}</p>
              <p className="mt-1 text-xs font-bold text-[#60756E]">Possédé : {item.ownedQuantity} · Libre : {item.availableQuantity}</p>
            </div>
            {item.ownedQuantity > 0 ? (
              <span className="rounded-full bg-[#DDF3E7] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#176951]">Inventaire</span>
            ) : null}
          </div>

          <form action={purchaseEquipmentAction} className="mt-5">
            <input type="hidden" name="equipmentItemId" value={item.id} />
            <input type="hidden" name="category" value={activeCategory ?? ""} />
            <EquipmentSubmitButton mode="purchase" disabled={cannotAfford} />
          </form>
        </div>
      </div>
    </article>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-24"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9BE0BC]">{label}</p><p className="mt-1 text-lg font-black text-[#F2C94C]">{value}</p></div>;
}

function EquipmentCategoryIcon({ slot }: { slot: EquipmentSlot }) {
  const common = "h-9 w-9";
  if (slot === "helmet") return <svg viewBox="0 0 48 48" fill="none" className={common} stroke="currentColor" strokeWidth="2.7"><path d="M8 27C8 15 15 8 25 8c9 0 15 7 15 17v5H18l-4 7H8V27Z"/><path d="M18 30c1 6 5 9 11 9 5 0 8-2 10-6"/><path d="M14 20h25"/></svg>;
  if (slot === "glasses") return <svg viewBox="0 0 48 48" fill="none" className={common} stroke="currentColor" strokeWidth="2.7"><path d="M5 18h7l3 13c1 4 7 5 10 1l2-4 2 4c3 4 9 3 10-1l3-13h3"/><path d="M16 20h10M28 20h12"/></svg>;
  if (slot === "gloves") return <svg viewBox="0 0 48 48" fill="none" className={common} stroke="currentColor" strokeWidth="2.7"><path d="M13 22V9c0-3 4-3 4 0v10-12c0-3 4-3 4 0v12-13c0-3 4-3 4 0v13-10c0-3 4-3 4 0v15l4-5c3-3 7 1 5 4L29 40H16l-7-12c-2-4 3-7 6-3l3 4"/></svg>;
  if (slot === "bib_shorts") return <svg viewBox="0 0 48 48" fill="none" className={common} stroke="currentColor" strokeWidth="2.7"><path d="M15 6h6l3 15 3-15h6l5 19-5 17h-8l-1-12-1 12h-8l-5-17 5-19Z"/><path d="M14 23h20"/></svg>;
  if (slot === "shoes") return <svg viewBox="0 0 48 48" fill="none" className={common} stroke="currentColor" strokeWidth="2.7"><path d="M8 29c8 0 11-6 14-16l7 2c0 8 4 12 11 15v8H9c-5 0-5-9-1-9Z"/><path d="M20 22l8 2M17 27l10 2"/></svg>;
  if (slot === "frame") return <svg viewBox="0 0 48 48" fill="none" className={common} stroke="currentColor" strokeWidth="2.7"><circle cx="12" cy="35" r="8"/><circle cx="38" cy="35" r="8"/><path d="m12 35 9-18 8 18H12Zm9-18 12 2 5 16M29 35l4-16"/></svg>;
  return <svg viewBox="0 0 48 48" fill="none" className={common} stroke="currentColor" strokeWidth="2.7"><circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="4"/><path d="M24 7v13M24 28v13M7 24h13M28 24h13M12 12l9 9M27 27l9 9M36 12l-9 9M21 27l-9 9"/></svg>;
}

function rarityLabel(rarity: TeamEquipmentCatalogItem["rarity"]) {
  if (rarity === "premium") return "Premium";
  if (rarity === "performance") return "Performance";
  return "Accessible";
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function readQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isEquipmentSlot(value: string): value is EquipmentSlot {
  return EQUIPMENT_SLOTS.includes(value as EquipmentSlot);
}
