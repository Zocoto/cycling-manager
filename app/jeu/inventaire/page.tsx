import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { DailyRewardRedemptionForm } from "@/components/game/daily-reward-redemption-form";
import { GameHeader } from "@/components/game/game-header";
import { TutorialLaunchButton } from "@/components/tutorial/tutorial-launch-button";
import { TutorialRouteResume } from "@/components/tutorial/tutorial-route-resume";
import {
  InventoryEquipmentForm,
  type InventoryRiderOption,
} from "@/components/game/inventory-equipment-form";
import { InventoryConsumableForm } from "@/components/game/inventory-consumable-form";
import { InventoryEquipmentSaleForm } from "@/components/game/inventory-equipment-sale-form";
import { buildInventoryReturnPath } from "@/lib/game/filtered-page-paths";
import {
  INVENTORY_CATEGORY_DEFINITIONS,
  getInventoryCategory,
  getInventoryRarityLabel,
  isAssignableInventoryCategory,
  isInventoryCategory,
  dailyRewardsToInventoryItems,
  summarizeInventory,
  type InventoryCategory,
  type TeamInventoryItem,
} from "@/lib/game/inventory";
import type {
  DailyRewardAcademyRider,
  DailyRewardAbility,
  DailyRewardCountry,
  DailyRewardInventoryItem,
  DailyRewardRace,
} from "@/lib/game/daily-rewards";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EQUIPMENT_TUTORIAL_GLASSES_CATALOG_KEY,
  EQUIPMENT_TUTORIAL_INVENTORY_ROUTE,
  EQUIPMENT_TUTORIAL_KEY,
} from "@/lib/tutorial/equipment";
import { getAuthenticatedTutorialProgress } from "@/lib/tutorial/progress";
import { getGameHeaderData } from "@/services/game-header-data";
import { getCurrentDailyRewardOverview } from "@/services/daily-rewards";
import { getCurrentTeamInventoryOverview } from "@/services/team-inventory";
import { getCurrentTeamItemTargetRiders } from "@/services/item-target-values";

export const metadata: Metadata = {
  title: "Inventaire de l’équipe",
  description: "Consultez les objets et le matériel possédés par votre équipe.",
};

type InventoryPageProps = {
  searchParams: Promise<{
    categorie?: string | string[];
    erreur?: string | string[];
    equipement?: string | string[];
    succes?: string | string[];
  }>;
};

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
  const query = await searchParams;
  const rawCategory = readQuery(query.categorie);
  const category = isInventoryCategory(rawCategory) ? rawCategory : null;
  const errorMessage = readQuery(query.erreur).slice(0, 300);
  const successMessage = readQuery(query.succes).slice(0, 300);
  const equipmentConfirmed = readQuery(query.equipement) === "confirme";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");

  const [
    headerData,
    overview,
    dailyRewardOverview,
    rosterResult,
    equipmentTutorialProgress,
  ] =
    await Promise.all([
      getGameHeaderData(supabase, user.id),
      getCurrentTeamInventoryOverview(user.id),
      getCurrentDailyRewardOverview(supabase).catch((error: unknown) => {
        console.error(
          "Impossible de charger les cadeaux dans l’inventaire :",
          error,
        );
        return null;
      }),
      getCurrentTeamItemTargetRiders(supabase)
        .then((data) => ({ data, error: null }))
        .catch((error: unknown) => ({
          data: [] as InventoryRiderOption[],
          error,
        })),
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

  if (rosterResult.error) {
    console.error(
      "Impossible de récupérer l’effectif pour l’inventaire :",
      rosterResult.error,
    );
  }

  const riders = ((rosterResult.data ?? []) as InventoryRiderOption[]).sort(
    (left, right) =>
      left.lastName.localeCompare(right.lastName, "fr") ||
      left.firstName.localeCompare(right.firstName, "fr"),
  );
  const inventoryItems = [
    ...overview.items,
    ...dailyRewardsToInventoryItems(dailyRewardOverview?.inventory ?? []),
  ].sort(
    (left, right) =>
      Number(right.availableQuantity > 0) -
        Number(left.availableQuantity > 0) ||
      left.name.localeCompare(right.name, "fr"),
  );
  const inventorySummary = summarizeInventory(inventoryItems);

  const equipmentByRiderAndSlot = buildEquipmentByRiderAndSlot(inventoryItems);
  const pendingEquipmentByRiderAndSlot = buildEquipmentByRiderAndSlot(
    inventoryItems,
    true,
  );

  const visibleItems = category
    ? inventoryItems.filter((item) => item.category === category)
    : inventoryItems;
  const returnPath = buildInventoryReturnPath(category);

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      {equipmentTutorialProgress?.status === "in_progress" &&
      equipmentTutorialProgress.current_route ===
        EQUIPMENT_TUTORIAL_INVENTORY_ROUTE &&
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

      <section className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-12">
        <BackToOfficeLink />

        {successMessage || equipmentConfirmed ? (
          <p className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-900">
            {successMessage || "Le matériel a bien été attribué au coureur."}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="mt-5 rounded-2xl border border-[#C94F4F]/25 bg-[#FFF0EE] px-5 py-4 text-sm font-bold text-[#8A2F2F]">
            {errorMessage}
          </p>
        ) : null}

        <header
          data-tutorial-id="equipment-inventory-overview"
          className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#0B302B_58%,#176951)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.2)] sm:px-10 sm:py-10"
        >
          <div
            aria-hidden="true"
            className="absolute -right-12 -top-20 h-72 w-72 rounded-full border-[46px] border-white/5"
          />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">
                Réserve de l’équipe · {overview.seasonName}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                  Inventaire
                </h1>
                <TutorialLaunchButton
                  tutorialKey={EQUIPMENT_TUTORIAL_KEY}
                  iconOnly
                />
              </div>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2]">
                Retrouvez au même endroit les objets gagnés par{" "}
                {overview.teamName} et chaque pièce achetée dans la rubrique
                Matériel.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur sm:gap-4 sm:p-4">
              <HeroMetric
                label="Objets"
                value={String(inventorySummary.totalUnits)}
              />
              <HeroMetric
                label="Libres"
                value={String(inventorySummary.availableUnits)}
              />
              <HeroMetric
                label="Références"
                value={String(inventorySummary.references)}
              />
            </div>
          </div>
        </header>

        <section
          data-tutorial-id="equipment-inventory-categories"
          className="mt-7 rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-7"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
                Rangement
              </p>
              <h2 className="mt-2 text-2xl font-black text-[#183F37]">
                Catégories d’objets
              </h2>
            </div>
            {category ? (
              <Link
                href="/jeu/inventaire"
                className="text-sm font-black text-[#176951] hover:text-[#0B302B]"
              >
                Afficher tout
              </Link>
            ) : null}
          </div>

          <nav
            aria-label="Catégories de l’inventaire"
            className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          >
            {INVENTORY_CATEGORY_DEFINITIONS.map((definition) => {
              const count = inventoryItems
                .filter((item) => item.category === definition.category)
                .reduce((total, item) => total + item.quantity, 0);
              const isActive = category === definition.category;

              return (
                <Link
                  key={definition.category}
                  href={`/jeu/inventaire?categorie=${definition.category}`}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive
                      ? "group flex items-center gap-3 rounded-2xl border border-[#176951] bg-[#0B302B] p-3 text-white shadow-lg"
                      : "group flex items-center gap-3 rounded-2xl border border-[#315B3E]/15 bg-[#F8FBF9] p-3 text-[#315B3E] transition hover:-translate-y-0.5 hover:border-[#278B70]/40 hover:bg-[#EAF5F3]"
                  }
                >
                  <span
                    className={
                      isActive
                        ? "grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-[#9BE0BC]"
                        : "grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#42B99A]/12 text-[#278B70]"
                    }
                  >
                    <InventoryCategoryIcon category={definition.category} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black">
                      {definition.label}
                    </span>
                    <span
                      className={
                        isActive
                          ? "mt-0.5 block text-xs font-bold text-[#BFD1C6]"
                          : "mt-0.5 block text-xs font-bold text-[#60756E]"
                      }
                    >
                      {formatObjectCount(count)}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </section>

        <section className="mt-8" aria-labelledby="inventory-list-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
                {category
                  ? getInventoryCategory(category).label
                  : "Toutes les catégories"}
              </p>
              <h2
                id="inventory-list-title"
                className="mt-2 text-2xl font-black text-[#183F37]"
              >
                {formatReferenceCount(visibleItems.length)}
              </h2>
            </div>
            <p className="max-w-xl text-sm font-semibold leading-6 text-[#60756E]">
              Le nombre disponible tient compte du matériel déjà équipé ou
              programmé sur un coureur.
            </p>
          </div>

          {visibleItems.length > 0 ? (
            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visibleItems.map((item) => (
                <InventoryItemCard
                  key={item.id}
                  item={item}
                  riders={riders}
                  equipmentByRiderAndSlot={equipmentByRiderAndSlot}
                  pendingEquipmentByRiderAndSlot={
                    pendingEquipmentByRiderAndSlot
                  }
                  returnPath={returnPath}
                  currency={overview.currency}
                  dailyRewardAbilities={dailyRewardOverview?.abilities ?? []}
                  dailyRewardRaces={dailyRewardOverview?.eligibleRaces ?? []}
                  dailyRewardAcademyRiders={
                    dailyRewardOverview?.academyRiders ?? []
                  }
                  dailyRewardCountries={dailyRewardOverview?.countries ?? []}
                />
              ))}
            </div>
          ) : (
            <InventoryEmptyState category={category} />
          )}
        </section>
      </section>
    </main>
  );
}

function InventoryItemCard({
  item,
  riders,
  equipmentByRiderAndSlot,
  pendingEquipmentByRiderAndSlot,
  returnPath,
  currency,
  dailyRewardAbilities,
  dailyRewardRaces,
  dailyRewardAcademyRiders,
  dailyRewardCountries,
}: {
  item: TeamInventoryItem;
  riders: InventoryRiderOption[];
  equipmentByRiderAndSlot: Map<string, string>;
  pendingEquipmentByRiderAndSlot: Map<string, string>;
  returnPath: string;
  currency: string;
  dailyRewardAbilities: DailyRewardAbility[];
  dailyRewardRaces: DailyRewardRace[];
  dailyRewardAcademyRiders: DailyRewardAcademyRider[];
  dailyRewardCountries: DailyRewardCountry[];
}) {
  const category = getInventoryCategory(item.category);
  const recruitmentReward =
    item.dailyReward ?? buildRecruitmentRewardFromInventory(item);

  return (
    <article
      data-tutorial-id={
        item.catalogKey === EQUIPMENT_TUTORIAL_GLASSES_CATALOG_KEY
          ? "equipment-welcome-gift"
          : undefined
      }
      className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_42px_rgba(19,60,46,0.09)]"
    >
      {item.imagePath ? (
        <div className="relative aspect-[16/7] overflow-hidden bg-[#071A17]">
          <Image
            src={item.imagePath}
            alt={`Univers visuel ${item.supplierName ?? item.name}`}
            fill
            sizes="(min-width:1280px) 30vw, (min-width:768px) 50vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
          {item.supplierName ? (
            <p className="absolute bottom-4 left-5 text-[10px] font-black uppercase tracking-[0.17em] text-[#DDF3E7]">
              {item.supplierName}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex h-28 items-center justify-center bg-[radial-gradient(circle_at_center,#176951,#071A17)] text-[#9BE0BC]">
          <span className="grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-white/10">
            <InventoryCategoryIcon category={item.category} large />
          </span>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#278B70]">
              {category.shortLabel}
            </p>
            <h3 className="mt-1 text-xl font-black text-[#183F37]">
              {item.name}
            </h3>
          </div>
          <span className={rarityClassName(item.rarity)}>
            {getInventoryRarityLabel(item.rarity)}
          </span>
        </div>

        <p className="mt-3 text-sm font-semibold leading-6 text-[#60756E]">
          {item.description}
        </p>
        <div className="mt-4 rounded-xl border border-[#42B99A]/20 bg-[#EAF5F3] px-4 py-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
            Effet
          </p>
          <p className="mt-1 text-sm font-black leading-5 text-[#183F37]">
            {item.effectSummary}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#315B3E]/10 pt-4">
          <ItemMetric label="Possédé" value={item.quantity} />
          <ItemMetric
            label="Disponible"
            value={item.availableQuantity}
            accent
          />
          <ItemMetric
            label={item.pendingQuantity > 0 ? "Programmé" : "Utilisé"}
            value={
              item.pendingQuantity > 0
                ? item.pendingQuantity
                : item.equippedQuantity
            }
          />
        </div>

        {recruitmentReward ? (
          <DailyRewardRedemptionForm
            item={recruitmentReward}
            riders={riders}
            abilities={dailyRewardAbilities}
            eligibleRaces={dailyRewardRaces}
            academyRiders={dailyRewardAcademyRiders}
            countries={dailyRewardCountries}
            returnPath={returnPath}
          />
        ) : item.equipmentSlot ? (
          <>
            <EquipmentOwnerSummary item={item} riders={riders} />
            <InventoryEquipmentForm
              equipmentItemId={item.sourceId}
              slot={item.equipmentSlot}
              availableQuantity={item.availableQuantity}
              riders={riders.map((rider) => ({
                ...rider,
                currentEquipmentName:
                  equipmentByRiderAndSlot.get(
                    equipmentRiderSlotKey(rider.id, item.equipmentSlot!),
                  ) ?? null,
                pendingEquipmentName:
                  pendingEquipmentByRiderAndSlot.get(
                    equipmentRiderSlotKey(rider.id, item.equipmentSlot!),
                  ) ?? null,
              }))}
              returnPath={returnPath}
            />
            <InventoryEquipmentSaleForm
              equipmentItemId={item.sourceId}
              itemName={item.name}
              resalePrice={item.resalePrice ?? 0}
              availableQuantity={item.availableQuantity}
              currency={currency}
              returnPath={returnPath}
            />
          </>
        ) : item.isConsumable &&
          isAssignableInventoryCategory(item.category) ? (
          <InventoryConsumableForm
            inventoryItemId={item.sourceId}
            category={item.category}
            availableQuantity={item.availableQuantity}
            effectPayload={item.effectPayload}
            riders={riders}
            returnPath={returnPath}
          />
        ) : (
          <p className="mt-5 text-xs font-bold text-[#60756E]">
            {item.isConsumable ? "Objet à usage individuel" : "Objet permanent"}
          </p>
        )}
      </div>
    </article>
  );
}

function buildRecruitmentRewardFromInventory(
  item: TeamInventoryItem,
): DailyRewardInventoryItem | null {
  const effectKind = item.effectPayload?.effectKind;
  if (
    effectKind !== "instant_youth_promotion" &&
    effectKind !== "custom_staff_recruitment"
  ) {
    return null;
  }

  return {
    id: item.sourceId,
    key: item.catalogKey ?? item.sourceId,
    name: item.name,
    description: item.description,
    effectSummary: item.effectSummary,
    importance: effectKind === "custom_staff_recruitment" ? 10 : 8,
    effectKind,
    iconKey: item.iconKey,
    payload: item.effectPayload ?? {},
    quantity: item.availableQuantity,
    acquiredAt: item.acquiredAt ?? "",
    expiresAfterGameYear: Number.MAX_SAFE_INTEGER,
  };
}

function EquipmentOwnerSummary({
  item,
  riders,
}: {
  item: TeamInventoryItem;
  riders: InventoryRiderOption[];
}) {
  const riderNameById = new Map(
    riders.map((rider) => [
      rider.id,
      rider.name,
    ]),
  );
  const equippedNames = item.equippedRiderIds
    .map((riderId) => riderNameById.get(riderId))
    .filter((name): name is string => Boolean(name));
  const pendingNames = item.pendingRiderIds
    .map((riderId) => riderNameById.get(riderId))
    .filter((name): name is string => Boolean(name));

  return (
    <div className="mt-4 space-y-1.5 rounded-xl border border-[#315B3E]/10 bg-[#F8FBF9] px-4 py-3 text-xs font-bold leading-5 text-[#48665F]">
      <p>
        <span className="font-black text-[#183F37]">Équipé sur :</span>{" "}
        {equippedNames.length > 0 ? equippedNames.join(", ") : "aucun coureur"}
      </p>
      {pendingNames.length > 0 ? (
        <p className="text-[#8A6516]">
          <span className="font-black">Programmé pour :</span>{" "}
          {pendingNames.join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function buildEquipmentByRiderAndSlot(
  items: TeamInventoryItem[],
  pending = false,
) {
  const equipmentByRiderAndSlot = new Map<string, string>();

  for (const item of items) {
    if (!item.equipmentSlot) continue;

    const riderIds = pending ? item.pendingRiderIds : item.equippedRiderIds;

    for (const riderId of riderIds) {
      equipmentByRiderAndSlot.set(
        equipmentRiderSlotKey(riderId, item.equipmentSlot),
        item.name,
      );
    }
  }

  return equipmentByRiderAndSlot;
}

function equipmentRiderSlotKey(
  riderId: string,
  slot: NonNullable<TeamInventoryItem["equipmentSlot"]>,
) {
  return `${riderId}:${slot}`;
}
function InventoryEmptyState({
  category,
}: {
  category: InventoryCategory | null;
}) {
  const definition = category ? getInventoryCategory(category) : null;

  return (
    <div className="mt-5 rounded-[2rem] border border-dashed border-[#315B3E]/25 bg-white/70 px-6 py-12 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#DDF3E7] text-[#176951]">
        <InventoryCategoryIcon category={category ?? "other"} large />
      </span>
      <h3 className="mt-5 text-xl font-black text-[#183F37]">
        {definition
          ? `Aucun objet “${definition.label}”`
          : "L’inventaire est vide"}
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-[#60756E]">
        {definition?.description ??
          "Les objets obtenus et le matériel acheté apparaîtront automatiquement ici."}
      </p>
      {category === "equipment" || category === null ? (
        <Link
          href="/jeu/materiel"
          className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#176951] hover:text-[#0B302B]"
        >
          Ouvrir la boutique Matériel <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </div>
  );
}

function InventoryCategoryIcon({
  category,
  large = false,
}: {
  category: InventoryCategory;
  large?: boolean;
}) {
  const className = large ? "h-9 w-9" : "h-6 w-6";

  if (category === "special_ability") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className={className}
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="12" cy="10" r="6" />
        <path d="m8 15-1 7 5-3 5 3-1-7" />
        <path d="m12 6 1.2 2.4 2.6.4-1.9 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-1.9-1.9 2.6-.4L12 6Z" />
      </svg>
    );
  }
  if (category === "potential_boost") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className={className}
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M4 19 10 13l4 3 6-8" />
        <path d="M15 8h5v5" />
        <path d="M4 5v14h16" />
      </svg>
    );
  }
  if (category === "rating_boost") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className={className}
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M12 3v18M3 12h18" />
        <path d="m6 6 12 12M18 6 6 18" />
        <circle cx="12" cy="12" r="8" />
      </svg>
    );
  }
  if (category === "equipment") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className={className}
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="7" cy="17" r="4" />
        <circle cx="18" cy="17" r="4" />
        <path d="m7 17 4-8 3 8H7Zm4-8h5l2 8M9 6h4" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 8 12 4l8 4-8 4-8-4Z" />
      <path d="m4 8 1 9 7 3 7-3 1-9M12 12v8" />
    </svg>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-20">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9BE0BC]">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-[#F2C94C]">{value}</p>
    </div>
  );
}

function ItemMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#78947D]">
        {label}
      </p>
      <p
        className={
          accent
            ? "mt-1 text-lg font-black text-[#176951]"
            : "mt-1 text-lg font-black text-[#183F37]"
        }
      >
        {value}
      </p>
    </div>
  );
}

function rarityClassName(rarity: TeamInventoryItem["rarity"]) {
  if (rarity === "epic")
    return "shrink-0 rounded-full bg-[#6D4BB7]/12 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#6D4BB7]";
  if (rarity === "rare")
    return "shrink-0 rounded-full bg-[#D29F32]/15 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#8A6516]";
  if (rarity === "uncommon")
    return "shrink-0 rounded-full bg-[#42B99A]/15 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#176951]";
  return "shrink-0 rounded-full bg-[#78947D]/12 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#48665F]";
}

function readQuery(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function formatObjectCount(value: number): string {
  return `${value} objet${value > 1 ? "s" : ""}`;
}

function formatReferenceCount(value: number): string {
  return `${value} référence${value > 1 ? "s" : ""}`;
}
