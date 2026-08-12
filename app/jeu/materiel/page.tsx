import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { EquipmentSubmitButton } from "@/components/game/equipment-submit-button";
import { GameHeader } from "@/components/game/game-header";
import { TutorialLaunchButton } from "@/components/tutorial/tutorial-launch-button";
import { TutorialRouteResume } from "@/components/tutorial/tutorial-route-resume";
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_EFFECT_FILTERS,
  EQUIPMENT_SLOTS,
  equipmentMatchesEffect,
  getEquipmentCategory,
  isEquipmentEffectFilterKey,
  type EquipmentEffectFilterKey,
  type EquipmentSlot,
} from "@/lib/game/equipment";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EQUIPMENT_TUTORIAL_COMMERCIAL_ROUTE,
  EQUIPMENT_TUTORIAL_GLASSES_CATALOG_KEY,
  EQUIPMENT_TUTORIAL_KEY,
} from "@/lib/tutorial/equipment";
import { getAuthenticatedTutorialProgress } from "@/lib/tutorial/progress";
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
    marque?: string | string[];
    effet?: string | string[];
    achat?: string | string[];
    erreur?: string | string[];
  }>;
};

export default async function MaterialPage({
  searchParams,
}: MaterialPageProps) {
  const query = await searchParams;
  const rawCategory = readQuery(query.categorie);
  const category = isEquipmentSlot(rawCategory) ? rawCategory : null;
  const rawSupplierKey = readQuery(query.marque);
  const rawEffectKey = readQuery(query.effet);
  const effectKey = isEquipmentEffectFilterKey(rawEffectKey)
    ? rawEffectKey
    : null;
  const success = readQuery(query.achat) === "confirme";
  const errorMessage = readQuery(query.erreur);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");

  await supabase.rpc("settle_current_team_finances");
  const [headerData, overview, equipmentTutorialProgress] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getCurrentTeamEquipmentOverview(user.id),
    getAuthenticatedTutorialProgress(supabase, EQUIPMENT_TUTORIAL_KEY).catch(
      (error: unknown) => {
        console.error(
          "Impossible de reprendre le didacticiel du matériel :",
          error,
        );
        return null;
      },
    ),
  ]);

  if (!overview) redirect("/jeu");

  const commercialCatalog = overview.catalog.filter(
    (item) =>
      item.channel === "commercial" &&
      item.catalogKey !== EQUIPMENT_TUTORIAL_GLASSES_CATALOG_KEY,
  );
  const commercialSuppliers = overview.suppliers.filter(
    (supplier) => supplier.referenceCount > 0,
  );
  const supplierKey = commercialSuppliers.some(
    (supplier) => supplier.key === rawSupplierKey,
  )
    ? rawSupplierKey
    : null;
  const categoryAndSupplierItems = commercialCatalog.filter(
    (item) =>
      (!category || item.slot === category) &&
      (!supplierKey || item.supplierKey === supplierKey),
  );
  const visibleItems = effectKey
    ? categoryAndSupplierItems.filter((item) =>
        equipmentMatchesEffect(item.effects, effectKey),
      )
    : categoryAndSupplierItems;
  const activeEffect = EQUIPMENT_EFFECT_FILTERS.find(
    (filter) => filter.key === effectKey,
  );
  const ownedReferences = overview.catalog.filter(
    (item) => item.ownedQuantity > 0,
  ).length;
  const minimumReferencesPerCategory = Math.min(
    ...EQUIPMENT_CATEGORIES.map(
      (entry) =>
        commercialCatalog.filter((item) => item.slot === entry.slot).length,
    ),
  );

  const ownedPieces = overview.catalog.reduce(
    (total, item) => total + item.ownedQuantity,
    0,
  );

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      {equipmentTutorialProgress?.status === "in_progress" &&
      equipmentTutorialProgress.current_route ===
        EQUIPMENT_TUTORIAL_COMMERCIAL_ROUTE &&
      equipmentTutorialProgress.current_step_key ? (
        <TutorialRouteResume
          tutorialKey={EQUIPMENT_TUTORIAL_KEY}
          currentStepKey={equipmentTutorialProgress.current_step_key}
        />
      ) : null}
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <BackToOfficeLink />

        <nav
          aria-label="Rubriques du matériel"
          className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-[#315B3E]/12 bg-white p-2 shadow-sm"
        >
          <Link
            href="/jeu/materiel"
            aria-current="page"
            className="rounded-xl bg-[#0B302B] px-5 py-3 text-xs font-black uppercase tracking-wider text-white"
          >
            Matériel commercial
          </Link>
          <Link
            href="/jeu/materiel/equipementier"
            className="rounded-xl px-5 py-3 text-xs font-black uppercase tracking-wider text-[#60756E] transition hover:bg-[#EAF5F3] hover:text-[#176951]"
          >
            Équipementier
          </Link>
          <Link
            href="/jeu/materiel/laboratoire"
            className="shrink-0 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-wider text-[#60756E] transition hover:bg-[#EAF5F3] hover:text-[#176951] sm:px-5 sm:text-xs"
          >
            Labo R&D
          </Link>
          <Link
            href="/jeu/materiel/equiper"
            className="rounded-xl px-5 py-3 text-xs font-black uppercase tracking-wider text-[#60756E] transition hover:bg-[#EAF5F3] hover:text-[#176951]"
          >
            Équiper l’équipe
          </Link>
        </nav>

        <header
          data-tutorial-id="equipment-commercial-overview"
          className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.2)] sm:px-10 sm:py-10"
        >
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[44px] border-white/5"
          />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">
                Performance · protection · image
              </p>
              <div className="mt-3 flex items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                  Gestion du matériel
                </h1>
                <TutorialLaunchButton
                  tutorialKey={EQUIPMENT_TUTORIAL_KEY}
                  iconOnly
                />
              </div>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2]">
                Constituez l’inventaire de {overview.teamName}, puis attribuez
                toutes les pièces depuis l’onglet Équiper l’équipe. Les bonus
                sportifs se cumulent pendant les courses.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <HeroMetric
                label="Solde"
                value={formatCurrency(overview.balance, overview.currency)}
              />
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
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
                  Rubrique active
                </p>
                <h2 className="mt-2 text-2xl font-black text-[#183F37]">
                  Matériel commercial
                </h2>
              </div>
              <span className="rounded-full bg-[#DDF3E7] px-4 py-2 text-xs font-black uppercase tracking-wider text-[#176951]">
                Catalogue ouvert
              </span>
            </div>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
              Chaque achat débite immédiatement la trésorerie. Une référence
              achetée peut être attribuée à un seul coureur par exemplaire.
            </p>
          </article>

          <article className="relative overflow-hidden rounded-[2rem] border border-[#D29F32]/25 bg-[#0B302B] p-6 text-white shadow-[0_16px_45px_rgba(7,26,23,0.14)] sm:p-8">
            <span className="absolute right-5 top-5 rounded-full bg-[#F2C94C]/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#F2C94C]">
              {commercialSuppliers.length} marques
            </span>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#9BE0BC]">
              Marché ouvert
            </p>
            <h2 className="mt-2 text-2xl font-black text-white">
              Plusieurs philosophies
            </h2>
            <p className="mt-4 text-sm font-semibold leading-6 text-[#BFD1C6]">
              Comparez une offre accessible, des spécialistes techniques et des
              gammes premium. Le catalogue réunit {commercialCatalog.length}{" "}
              références, avec au moins {minimumReferencesPerCategory} choix
              dans chaque famille.
            </p>
          </article>
        </section>

        <section
          data-tutorial-id="equipment-commercial-brands"
          className="mt-7 rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-7"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
                Galerie des marques
              </p>
              <h2 className="mt-2 text-2xl font-black text-[#183F37]">
                Choisir un équipementier
              </h2>
            </div>
            {supplierKey ? (
              <Link
                href={buildMaterialHref(category, null, effectKey)}
                className="text-sm font-black text-[#176951] hover:text-[#0B302B]"
              >
                Toutes les marques
              </Link>
            ) : null}
          </div>

          <nav
            aria-label="Équipementiers"
            className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {commercialSuppliers.map((supplier) => {
              const isActive = supplier.key === supplierKey;

              return (
                <Link
                  key={supplier.key}
                  href={buildMaterialHref(
                    category,
                    isActive ? null : supplier.key,
                    effectKey,
                  )}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive
                      ? "group overflow-hidden rounded-2xl border-2 bg-[#F8FBF9] shadow-lg"
                      : "group overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-[#F8FBF9] transition hover:-translate-y-0.5 hover:shadow-lg"
                  }
                  style={{
                    borderColor: isActive
                      ? supplier.primaryColor
                      : `${supplier.primaryColor}33`,
                  }}
                >
                  <span
                    className="relative block h-24"
                    style={{
                      background: `linear-gradient(135deg, ${supplier.primaryColor}, ${supplier.secondaryColor})`,
                    }}
                  >
                    <span className="absolute inset-3 rounded-xl bg-white shadow-sm">
                      <Image
                        src={supplier.logoPath}
                        alt={`Logo ${supplier.name}`}
                        fill
                        sizes="(min-width:1024px) 22vw, (min-width:640px) 45vw, 90vw"
                        className="object-contain p-2"
                      />
                    </span>
                  </span>
                  <span className="block p-4">
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-black text-[#183F37]">
                        {supplier.name}
                      </span>
                      <span className="rounded-full bg-[#EAF5F3] px-2 py-1 text-[9px] font-black uppercase text-[#176951]">
                        {supplier.referenceCount} réf.
                      </span>
                    </span>
                    <span className="mt-2 line-clamp-2 block text-[11px] font-semibold leading-4 text-[#60756E]">
                      {supplier.positioning}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </section>

        <section
          data-tutorial-id="equipment-commercial-filters"
          className="mt-7 rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-7"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
                Filtres visuels
              </p>
              <h2 className="mt-2 text-2xl font-black text-[#183F37]">
                Choisir une catégorie
              </h2>
            </div>
            {category ? (
              <Link
                href={buildMaterialHref(null, supplierKey, effectKey)}
                className="text-sm font-black text-[#176951] hover:text-[#0B302B]"
              >
                Toutes les catégories
              </Link>
            ) : null}
          </div>

          <nav
            aria-label="Catégories de matériel"
            className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8"
          >
            {EQUIPMENT_CATEGORIES.map((entry) => (
              <Link
                key={entry.slot}
                href={buildMaterialHref(entry.slot, supplierKey, effectKey)}
                aria-current={category === entry.slot ? "page" : undefined}
                className={
                  category === entry.slot
                    ? "group rounded-2xl border border-[#176951] bg-[#0B302B] p-3 text-center text-white shadow-lg"
                    : "group rounded-2xl border border-[#315B3E]/15 bg-[#F8FBF9] p-3 text-center text-[#315B3E] transition hover:-translate-y-0.5 hover:border-[#278B70]/40 hover:bg-[#EAF5F3]"
                }
              >
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-[#42B99A]/12 text-[#278B70] group-aria-[current=page]:text-[#9BE0BC]">
                  <EquipmentCategoryIcon slot={entry.slot} />
                </span>
                <span className="mt-2 block text-xs font-black">
                  {entry.label}
                </span>
              </Link>
            ))}
          </nav>
          <div className="mt-7 border-t border-[#315B3E]/12 pt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
                  Effet recherché
                </p>
                <p className="mt-1 text-sm font-semibold text-[#60756E]">
                  Affichez uniquement les références qui augmentent la
                  statistique ou apportent l’effet choisi.
                </p>
              </div>
              {effectKey ? (
                <Link
                  href={buildMaterialHref(category, supplierKey, null)}
                  className="text-sm font-black text-[#176951] hover:text-[#0B302B]"
                >
                  Tous les effets
                </Link>
              ) : null}
            </div>

            <nav
              aria-label="Effets du matériel"
              className="mt-4 flex flex-wrap gap-2"
            >
              {EQUIPMENT_EFFECT_FILTERS.map((filter) => {
                const isActive = effectKey === filter.key;
                const matchingCount = categoryAndSupplierItems.filter((item) =>
                  equipmentMatchesEffect(item.effects, filter.key),
                ).length;

                return (
                  <Link
                    key={filter.key}
                    href={buildMaterialHref(
                      category,
                      supplierKey,
                      isActive ? null : filter.key,
                    )}
                    aria-current={isActive ? "page" : undefined}
                    className={
                      isActive
                        ? "inline-flex items-center gap-2 rounded-xl border border-[#176951] bg-[#0B302B] px-3 py-2 text-xs font-black text-white shadow-md"
                        : filter.kind === "primary"
                          ? "inline-flex items-center gap-2 rounded-xl border border-[#278B70]/25 bg-[#F8FBF9] px-3 py-2 text-xs font-black text-[#183F37] transition hover:border-[#176951] hover:bg-[#EAF5F3]"
                          : filter.kind === "secondary"
                            ? "inline-flex items-center gap-2 rounded-xl border border-[#60756E]/15 bg-[#F4F7F5] px-3 py-2 text-xs font-bold text-[#60756E] transition hover:border-[#278B70]/45 hover:text-[#315B3E]"
                            : "inline-flex items-center gap-2 rounded-xl border border-[#D29F32]/25 bg-[#FFF8D8] px-3 py-2 text-xs font-black text-[#8A6B16] transition hover:border-[#D29F32]/60"
                    }
                  >
                    <span>{filter.shortLabel}</span>
                    <span className="font-semibold opacity-80">
                      {filter.label}
                    </span>
                    <span
                      className={
                        isActive
                          ? "rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] tabular-nums"
                          : "rounded-full bg-black/6 px-1.5 py-0.5 text-[9px] tabular-nums"
                      }
                    >
                      {matchingCount}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </section>

        <section
          data-tutorial-id="equipment-commercial-products"
          className="mt-7"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
                {category
                  ? getEquipmentCategory(category).label
                  : "Toutes les catégories"}
                {supplierKey
                  ? ` · ${commercialSuppliers.find((supplier) => supplier.key === supplierKey)?.name}`
                  : ""}
                {activeEffect ? ` · ${activeEffect.label}` : ""}
              </p>
              <h2 className="mt-2 text-2xl font-black text-[#183F37]">
                {visibleItems.length} références disponibles
              </h2>
            </div>
            <p className="max-w-xl text-right text-xs font-semibold leading-5 text-[#60756E]">
              Les changements sont immédiats, sauf de cinq minutes avant le
              départ jusqu’à la fin de la course du coureur, période pendant
              laquelle son équipement est figé.
            </p>
          </div>

          {visibleItems.length > 0 ? (
            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visibleItems.map((item) => (
                <EquipmentProductCard
                  key={item.id}
                  item={item}
                  currency={overview.currency}
                  balance={overview.balance}
                  activeCategory={category}
                  activeSupplierKey={supplierKey}
                  activeEffectKey={effectKey}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-[#315B3E]/25 bg-white px-6 py-10 text-center">
              <p className="text-sm font-black text-[#183F37]">
                Aucune référence ne correspond à ces filtres.
              </p>
              <Link
                href={
                  effectKey
                    ? buildMaterialHref(category, supplierKey, null)
                    : buildMaterialHref(category, null, null)
                }
                className="mt-3 inline-block text-sm font-black text-[#176951] hover:text-[#0B302B]"
              >
                {effectKey
                  ? "Retirer le filtre d’effet"
                  : "Comparer toutes les marques de la catégorie"}
              </Link>
            </div>
          )}
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
  activeSupplierKey,
  activeEffectKey,
}: {
  item: TeamEquipmentCatalogItem;
  currency: string;
  balance: number;
  activeCategory: EquipmentSlot | null;
  activeSupplierKey: string | null;
  activeEffectKey: EquipmentEffectFilterKey | null;
}) {
  const cannotAfford = balance <= 0 || balance < item.price;

  return (
    <article className="flex overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_42px_rgba(19,60,46,0.09)]">
      <div className="flex w-full flex-col">
        <div className="relative aspect-[16/10] overflow-hidden bg-[#071A17]">
          <Image
            src={item.imagePath}
            alt={`${item.name} par ${item.supplierName}`}
            fill
            sizes="(min-width:1280px) 30vw, (min-width:768px) 50vw, 100vw"
            className="object-cover transition duration-500 hover:scale-[1.03]"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-5 pb-4 pt-12 text-white">
            <div className="relative mb-3 h-9 w-36 overflow-hidden rounded-lg bg-white shadow-md">
              <Image
                src={item.supplierLogoPath}
                alt=""
                fill
                sizes="144px"
                className="object-contain p-1.5"
              />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#9BE0BC]">
              {item.supplierName}
            </p>
            <h3 className="mt-1 text-xl font-black">{item.name}</h3>
          </div>
          <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#176951]">
            {getEquipmentCategory(item.slot).shortLabel}
          </span>
          <span className="absolute right-4 top-4 rounded-full bg-[#F2C94C] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#071A17]">
            {rarityLabel(item.rarity)}
          </span>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <p className="text-sm font-semibold leading-6 text-[#60756E]">
            {item.description}
          </p>
          <div className="mt-4 rounded-xl border border-[#42B99A]/20 bg-[#EAF5F3] px-4 py-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
              Effet en course
            </p>
            <p className="mt-1 text-sm font-black leading-5 text-[#183F37]">
              {item.effectSummary}
            </p>
          </div>

          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-2xl font-black text-[#183F37]">
                {formatCurrency(item.price, currency)}
              </p>
              <p className="mt-1 text-xs font-bold text-[#60756E]">
                Possédé : {item.ownedQuantity} · Libre :{" "}
                {item.availableQuantity}
              </p>
            </div>
            {item.ownedQuantity > 0 ? (
              <span className="rounded-full bg-[#DDF3E7] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#176951]">
                Inventaire
              </span>
            ) : null}
          </div>

          <form action={purchaseEquipmentAction} className="mt-5">
            <input type="hidden" name="equipmentItemId" value={item.id} />
            <input type="hidden" name="category" value={activeCategory ?? ""} />
            <input
              type="hidden"
              name="supplier"
              value={activeSupplierKey ?? ""}
            />
            <input type="hidden" name="effect" value={activeEffectKey ?? ""} />
            <EquipmentSubmitButton mode="purchase" disabled={cannotAfford} />
          </form>
        </div>
      </div>
    </article>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9BE0BC]">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-[#F2C94C]">{value}</p>
    </div>
  );
}

function EquipmentCategoryIcon({ slot }: { slot: EquipmentSlot }) {
  const common = "h-9 w-9";

  if (slot === "helmet") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        fill="none"
        className={common}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M7 27C8 15 16 8 27 8c8 0 14 4 17 12l-3 8H19l-5 7H8c-1-2-2-5-1-8Z"
          fill="currentColor"
          fillOpacity="0.08"
        />
        <path d="M7 27C8 15 16 8 27 8c8 0 14 4 17 12l-3 8H19l-5 7H8c-1-2-2-5-1-8Z" />
        <path d="M11 24h31" />
        <path d="m18 12-3 12M27 9l-2 15M36 12l-3 12" />
        <path d="M17 29c1 7 5 11 12 11 5 0 9-3 11-8" />
        <path d="M40 32h-8l-4 4" />
      </svg>
    );
  }

  if (slot === "glasses") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        fill="none"
        className={common}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M7 19c5-2 11-1 16 2l-2 10c-.7 3-3 5-6 5s-5-2-6-5L7 19Z"
          fill="currentColor"
          fillOpacity="0.08"
        />
        <path
          d="M41 19c-5-2-11-1-16 2l2 10c.7 3 3 5 6 5s5-2 6-5l2-12Z"
          fill="currentColor"
          fillOpacity="0.08"
        />
        <path d="M7 19c5-2 11-1 16 2l-2 10c-.7 3-3 5-6 5s-5-2-6-5L7 19Z" />
        <path d="M41 19c-5-2-11-1-16 2l2 10c.7 3 3 5 6 5s5-2 6-5l2-12Z" />
        <path d="M22 22c1-1.5 3-1.5 4 0M7 19l-3-3M41 19l3-3" />
        <path d="M11 25c3-1 6-1 9 0M28 25c3-1 6-1 9 0" />
      </svg>
    );
  }

  if (slot === "gloves") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        fill="none"
        className={common}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M13 22V11c0-2.5 4-2.5 4 0v8V8c0-2.5 4-2.5 4 0v11V7c0-2.5 4-2.5 4 0v12V9c0-2.5 4-2.5 4 0v13l4-5c2-3 6 0 4 3l-5 8v8c0 3-2 5-5 5H17L9 28c-2-4 3-7 6-3l4 5"
          fill="currentColor"
          fillOpacity="0.08"
        />
        <path d="M13 22V11c0-2.5 4-2.5 4 0v8V8c0-2.5 4-2.5 4 0v11V7c0-2.5 4-2.5 4 0v12V9c0-2.5 4-2.5 4 0v13l4-5c2-3 6 0 4 3l-5 8v8c0 3-2 5-5 5H17L9 28c-2-4 3-7 6-3l4 5" />
        <path d="M15 33h17M18 33v8M29 33v8" />
        <path d="M19 26c3-2 6-2 9 0l-2 5h-5l-2-5Z" />
      </svg>
    );
  }

  if (slot === "bib_shorts") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        fill="none"
        className={common}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M17 15h14l5 12-3 15h-8l-1-12-1 12h-8l-3-15 5-12Z"
          fill="currentColor"
          fillOpacity="0.08"
        />
        <path d="M16 6h5l3 11 3-11h5M16 6l1 11h14L32 6" />
        <path d="M17 15h14l5 12-3 15h-8l-1-12-1 12h-8l-3-15 5-12Z" />
        <path d="M13 27h22M15 37h8M25 37h8" />
      </svg>
    );
  }

  if (slot === "shoes") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        fill="none"
        className={common}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M7 31c7 0 10-5 12-14l2-7 8 2c1 8 5 13 13 17 2 1 3 3 3 5v5H9c-4 0-6-2-6-4s2-4 4-4Z"
          fill="currentColor"
          fillOpacity="0.08"
        />
        <path d="M7 31c7 0 10-5 12-14l2-7 8 2c1 8 5 13 13 17 2 1 3 3 3 5v5H9c-4 0-6-2-6-4s2-4 4-4Z" />
        <path d="M8 39h37M19 20l11 3M16 26l15 3" />
        <circle cx="29" cy="17" r="2.5" />
        <path d="M28 39v4h7v-4" />
      </svg>
    );
  }

  if (slot === "frame") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        fill="none"
        className={common}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m9 36 10-20 10 20H9Z" />
        <path d="m19 16 14 2-4 18M29 36h10l-6-18" />
        <path d="M16 11h7M19 16l-2-7M33 18l4-9h6" />
        <circle cx="29" cy="36" r="3.5" />
        <path d="M29 32.5v7" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={common}
      stroke="currentColor"
      strokeWidth="2.7"
    >
      <circle cx="24" cy="24" r="17" />
      <circle cx="24" cy="24" r="4" />
      <path d="M24 7v13M24 28v13M7 24h13M28 24h13M12 12l9 9M27 27l9 9M36 12l-9 9M21 27l-9 9" />
    </svg>
  );
}

function rarityLabel(rarity: TeamEquipmentCatalogItem["rarity"]) {
  if (rarity === "premium") return "Premium";
  if (rarity === "performance") return "Performance";
  return "Accessible";
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function readQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function isEquipmentSlot(value: string): value is EquipmentSlot {
  return EQUIPMENT_SLOTS.includes(value as EquipmentSlot);
}

function buildMaterialHref(
  category: EquipmentSlot | null,
  supplierKey: string | null,
  effectKey: EquipmentEffectFilterKey | null,
) {
  const params = new URLSearchParams();
  if (category) params.set("categorie", category);
  if (supplierKey) params.set("marque", supplierKey);
  if (effectKey) params.set("effet", effectKey);
  const query = params.toString();
  return query ? `/jeu/materiel?${query}` : "/jeu/materiel";
}
