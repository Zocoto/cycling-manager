"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  charterFanClubCarsAction,
  purchaseFanClubCarAction,
  purchaseFanClubStockAction,
  sellFanClubCarAction,
  updateFanClubSalePriceAction,
  type FanClubActionResult,
} from "@/app/jeu/fan-club/actions";
import {
  estimateDailyProductSalesForecast,
  getAvailableCarsForRace,
  type FanClubManagementState,
  type FanClubTripAllocation,
} from "@/lib/game/fan-club-management";
import {
  calculateCarResalePrice,
  FAN_CLUB_CAR_MODELS,
  FAN_CLUB_FLEET_CAPACITY_BY_HEADQUARTERS_LEVEL,
  FAN_CLUB_PRODUCTS,
  FAN_CLUB_SHOP_LEVELS,
  getAvailableTravelingSupporters,
  getCurrentWholesalePrice,
  getWholesaleTrendPercent,
  type FanClubLiveData,
  type FanClubPilotRider,
  type FanClubPilotTab,
} from "@/lib/game/fan-club-pilot";

const BASE_TABS: ReadonlyArray<{ id: FanClubPilotTab; label: string }> = [
  { id: "overview", label: "Vue d’ensemble" },
  { id: "riders", label: "Popularité des coureurs" },
  { id: "travel", label: "Déplacements" },
];

const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const decimalEuroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type ExecuteAction = (
  action: () => Promise<FanClubActionResult>,
) => void;

export function FanClub({
  headquartersLevel,
  shopLevel,
  data,
  management,
}: {
  headquartersLevel: number;
  shopLevel: number;
  data: FanClubLiveData;
  management: FanClubManagementState;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FanClubPilotTab>("overview");
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();
  const tabs = shopLevel > 0
    ? [...BASE_TABS, { id: "store" as const, label: "Magasin" }]
    : BASE_TABS;

  const execute: ExecuteAction = (action) => {
    setFeedback("");
    startTransition(async () => {
      const result = await action();
      setFeedback(result.message);
      if (result.ok) router.refresh();
    });
  };

  return (
    <div className="mt-7">
      <nav
        role="tablist"
        aria-label="Rubriques du Fan Club"
        className="flex gap-1 overflow-x-auto border-b border-[#315B3E]/15"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={getTabId(tab.id)}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={getPanelId(tab.id)}
            onClick={() => {
              setActiveTab(tab.id);
              setFeedback("");
            }}
            className={[
              "min-h-12 shrink-0 border-b-2 px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-inset",
              activeTab === tab.id
                ? "border-[#176951] text-[#0B302B]"
                : "border-transparent text-[#5C746C] hover:border-[#42B99A]/45 hover:text-[#176951]",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="pt-6">
        {activeTab === "overview" ? (
          <Panel tab="overview">
            <OverviewPanel
              data={data}
              management={management}
              shopLevel={shopLevel}
              onNavigate={setActiveTab}
            />
          </Panel>
        ) : null}
        {activeTab === "riders" ? (
          <Panel tab="riders"><RidersPanel riders={data.riders} /></Panel>
        ) : null}
        {activeTab === "travel" ? (
          <Panel tab="travel">
            <TravelPanel
              data={data}
              management={management}
              headquartersLevel={headquartersLevel}
              execute={execute}
              isPending={isPending}
              feedback={feedback}
            />
          </Panel>
        ) : null}
        {activeTab === "store" && shopLevel > 0 ? (
          <Panel tab="store">
            <StorePanel
              data={data}
              management={management}
              shopLevel={shopLevel}
              execute={execute}
              isPending={isPending}
              feedback={feedback}
            />
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

function Panel({ tab, children }: { tab: FanClubPilotTab; children: React.ReactNode }) {
  return (
    <section id={getPanelId(tab)} role="tabpanel" aria-labelledby={getTabId(tab)}>
      {children}
    </section>
  );
}

function OverviewPanel({
  data,
  management,
  shopLevel,
  onNavigate,
}: {
  data: FanClubLiveData;
  management: FanClubManagementState;
  shopLevel: number;
  onNavigate: (tab: FanClubPilotTab) => void;
}) {
  const totalStock = management.inventory.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const availableProducts = FAN_CLUB_PRODUCTS.filter(
    (product) => product.requiredShopLevel <= shopLevel,
  );
  const stockByProduct = new Map(
    management.inventory.map((item) => [item.productId, item.quantity]),
  );
  const stockSummary = availableProducts
    .map((product) => `${product.name} : ${stockByProduct.get(product.id) ?? 0}`)
    .join(" · ");

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
      <Surface>
        <Heading
          eyebrow="Popularité individuelle"
          title="Coureurs les plus suivis"
          action={<TextButton onClick={() => onNavigate("riders")}>Voir l’effectif</TextButton>}
        />
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#315B3E]/12 text-xs font-black uppercase tracking-[0.1em] text-[#6F817A]">
                <th className="px-2 py-3">Coureur</th>
                <th className="px-2 py-3">Popularité</th>
                <th className="px-2 py-3">Dernier mouvement</th>
              </tr>
            </thead>
            <tbody>
              {data.riders.slice(0, 5).map((rider) => (
                <tr key={rider.id} className="border-b border-[#315B3E]/10 last:border-0">
                  <td className="px-2 py-4"><RiderIdentity rider={rider} /></td>
                  <td className="px-2 py-4">
                    <strong className="text-[#9A7000]">{rider.popularity} / 100</strong>
                    <span className={[
                      "ml-2 text-xs font-black",
                      rider.trend >= 0 ? "text-[#176951]" : "text-[#B34A42]",
                    ].join(" ")}>{formatTrend(rider.trend)}</span>
                  </td>
                  <td className="px-2 py-4 font-bold text-[#536B63]">{rider.currentDriver}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>

      <div className="space-y-6">
        <Surface>
          <Heading
            eyebrow="Calcul en direct"
            title="Origine des supporters"
            detail="L’audience évolue avec la réputation de l’équipe, la popularité de l’effectif et les résultats de la saison."
          />
          <dl className="mt-5 divide-y divide-[#315B3E]/10 text-sm">
            <AudienceLine label="Socle du Fan Club" value={data.supporterBreakdown.foundation} />
            <AudienceLine label="Réputation de l’équipe" value={data.supporterBreakdown.reputation} />
            <AudienceLine label="Popularité des coureurs" value={data.supporterBreakdown.riders} />
            <AudienceLine label="Résultats de la saison" value={data.supporterBreakdown.recentResults} />
            <AudienceLine label="Bonus du Siège" value={data.supporterBreakdown.headquartersBonus} />
          </dl>
        </Surface>
        {data.races[0] ? (
          <DecisionCard
            eyebrow={`Prochaine course · ${data.races[0].timing}`}
            title={data.races[0].name}
            description="Affectez les cars disponibles à cette course ou choisissez une autre épreuve du calendrier."
            buttonLabel="Gérer les déplacements"
            onClick={() => onNavigate("travel")}
          />
        ) : null}
        {shopLevel > 0 ? (
          <DecisionCard
            eyebrow={`${availableProducts.length} référence${availableProducts.length > 1 ? "s" : ""} disponible${availableProducts.length > 1 ? "s" : ""}`}
            title={`${totalStock.toLocaleString("fr-FR")} article${totalStock > 1 ? "s" : ""} en stock`}
            description={stockSummary}
            buttonLabel="Ouvrir le magasin"
            onClick={() => onNavigate("store")}
          />
        ) : null}
      </div>
    </div>
  );
}

function RidersPanel({ riders }: { riders: ReadonlyArray<FanClubPilotRider> }) {
  const [selectedRiderId, setSelectedRiderId] = useState(riders[0]?.id ?? "");
  const rider = riders.find((candidate) => candidate.id === selectedRiderId) ?? riders[0];
  if (!rider) return <Surface><Heading eyebrow="Effectif" title="Aucun coureur actif" /></Surface>;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.72fr)_minmax(360px,1.28fr)]">
      <Surface>
        <Heading
          eyebrow="Effectif"
          title="Popularité des coureurs"
          detail="Le score agrège les résultats, le panache, la fidélité et la dynamique actuelle."
        />
        <div className="mt-5 divide-y divide-[#315B3E]/10">
          {riders.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              aria-pressed={candidate.id === rider.id}
              onClick={() => setSelectedRiderId(candidate.id)}
              className={[
                "flex w-full items-center justify-between gap-4 px-2 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]",
                candidate.id === rider.id ? "bg-[#FFF5CF]" : "hover:bg-[#F5FAF7]",
              ].join(" ")}
            >
              <RiderIdentity rider={candidate} />
              <span className="text-right">
                <strong className="block text-lg text-[#9A7000]">{candidate.popularity} / 100</strong>
                <span className="text-xs font-bold text-[#6F817A]">{candidate.status}</span>
              </span>
            </button>
          ))}
        </div>
      </Surface>

      <Surface ariaLive>
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 place-items-center rounded-full border-[7px] border-[#F2C94C] bg-[#0B302B] text-2xl font-black text-[#F2C94C]">
              {rider.popularity}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#278B70]">{rider.status}</p>
              <h2 className="mt-1 text-2xl font-black text-[#183F37]">{rider.name}</h2>
              <p className="mt-1 text-sm font-bold text-[#60736C]">{formatTrend(rider.trend)} · {rider.currentDriver}</p>
            </div>
          </div>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {rider.factors.map((factor) => (
            <article key={factor.label} className="rounded-xl border border-[#315B3E]/15 bg-[#F8FBF9] p-4">
              <div className="flex justify-between gap-3 text-xs font-black text-[#536B63]">
                <span>{factor.label}</span><span>{factor.value} / {factor.maximum}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#DDE9E2]">
                <div className="h-full rounded-full bg-[#42B99A]" style={{ width: `${Math.min(100, factor.value / factor.maximum * 100)}%` }} />
              </div>
            </article>
          ))}
        </div>
        <div className="mt-6 rounded-xl border border-[#D29F32]/25 bg-[#FFF5D8] p-4">
          <p className="text-xs font-black uppercase tracking-[0.13em] text-[#76530D]">Impact d’un départ</p>
          <p className="mt-2 text-sm font-bold leading-6 text-[#76530D]">{rider.departureImpact}</p>
        </div>
      </Surface>
    </div>
  );
}

function TravelPanel({
  data,
  management,
  headquartersLevel,
  execute,
  isPending,
  feedback,
}: {
  data: FanClubLiveData;
  management: FanClubManagementState;
  headquartersLevel: number;
  execute: ExecuteAction;
  isPending: boolean;
  feedback: string;
}) {
  const [raceId, setRaceId] = useState(data.races[0]?.id ?? "");
  const [modelId, setModelId] = useState("regional");
  const [requestedCars, setRequestedCars] = useState(1);
  const race = data.races.find((candidate) => candidate.id === raceId) ?? data.races[0];
  const model = FAN_CLUB_CAR_MODELS.find((candidate) => candidate.id === modelId) ?? FAN_CLUB_CAR_MODELS[0];
  const fleetLimit = FAN_CLUB_FLEET_CAPACITY_BY_HEADQUARTERS_LEVEL[headquartersLevel] ?? 2;
  const totalCars = Object.values(management.fleet).reduce((sum, value) => sum + value, 0);
  const raceTrips = management.trips.filter((trip) => trip.raceId === race?.id);
  const allocatedByModel = Object.fromEntries(
    FAN_CLUB_CAR_MODELS.map((candidate) => [
      candidate.id,
      raceTrips.find((trip) => trip.modelId === candidate.id)?.carCount ?? 0,
    ]),
  );
  const availableCars = getAvailableCarsForRace({
    owned: management.fleet[model.id] ?? 0,
    allocated: allocatedByModel[model.id] ?? 0,
  });
  const cars = Math.min(Math.max(1, requestedCars), Math.max(1, availableCars));
  const allocatedSeats = raceTrips.reduce((total, trip) => {
    const tripModel = FAN_CLUB_CAR_MODELS.find((candidate) => candidate.id === trip.modelId);
    return total + (tripModel?.capacity ?? 0) * trip.carCount;
  }, 0);
  const supporterLimit = getAvailableTravelingSupporters(data.supporterCount);
  const remainingSupporters = Math.max(0, supporterLimit - allocatedSeats);
  const seats = availableCars > 0 ? cars * model.capacity : 0;
  const travelers = Math.min(remainingSupporters, seats);
  const cost = race
    ? Math.round(cars * (race.distanceKm * 2 * model.operatingCostPerKm + 250))
    : 0;

  return (
    <div className="space-y-6">
      <Surface>
        <Heading
          eyebrow="Patrimoine du Fan Club"
          title={`Parc de cars · ${totalCars} / ${fleetLimit}`}
          detail="Un car peut être engagé une fois par course. Il reste disponible pour toutes les autres épreuves du calendrier."
        />
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {FAN_CLUB_CAR_MODELS.map((candidate) => {
            const owned = management.fleet[candidate.id] ?? 0;
            const unlocked = candidate.requiredHeadquartersLevel <= headquartersLevel;
            return (
              <article key={candidate.id} className="rounded-2xl border border-[#315B3E]/15 bg-[#F8FBF9] p-5">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#278B70]">{owned} dans le parc</p>
                <h3 className="mt-2 text-lg font-black text-[#183F37]">{candidate.name}</h3>
                <p className="mt-2 text-xs font-semibold leading-5 text-[#60736C]">{candidate.capacity} places · {candidate.description}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <Metric label="Achat" value={euroFormatter.format(candidate.purchasePrice)} />
                  <Metric label="Revente" value={euroFormatter.format(calculateCarResalePrice(candidate))} />
                </dl>
                {!unlocked ? <p className="mt-3 text-xs font-black text-[#76530D]">Siège niveau {candidate.requiredHeadquartersLevel} requis</p> : null}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <ActionButton
                    disabled={isPending || !unlocked || totalCars >= fleetLimit}
                    onClick={() => execute(() => purchaseFanClubCarAction(candidate.id))}
                  >Acheter</ActionButton>
                  <ActionButton
                    secondary
                    disabled={isPending || owned <= 0}
                    onClick={() => execute(() => sellFanClubCarAction(candidate.id))}
                  >Vendre</ActionButton>
                </div>
              </article>
            );
          })}
        </div>
      </Surface>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.62fr)]">
        <Surface>
          <Heading
            eyebrow="Affrètement multi-course"
            title="Préparer un déplacement"
            detail="Choisissez n’importe quelle course à venir où votre inscription est acceptée. Jusqu’à 40 % des supporters peuvent être mobilisés par épreuve."
          />
          {data.races.length > 0 ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <SelectField
                label="Épreuve ciblée"
                value={race?.id ?? ""}
                onChange={(value) => { setRaceId(value); setRequestedCars(1); }}
                options={data.races.map((candidate) => ({ value: candidate.id, label: `${candidate.name} · ${candidate.timing}` }))}
              />
              <SelectField
                label="Modèle à envoyer"
                value={model.id}
                onChange={(value) => { setModelId(value); setRequestedCars(1); }}
                options={FAN_CLUB_CAR_MODELS.filter((candidate) => (management.fleet[candidate.id] ?? 0) > 0).map((candidate) => ({
                  value: candidate.id,
                  label: `${candidate.name} · ${getAvailableCarsForRace({ owned: management.fleet[candidate.id] ?? 0, allocated: allocatedByModel[candidate.id] ?? 0 })} disponible(s) ici`,
                }))}
              />
            </div>
          ) : <p className="mt-5 rounded-xl bg-[#EAF5F3] p-4 text-sm font-bold text-[#536B63]">Aucune course à venir n’est actuellement ouverte à l’affrètement.</p>}
          <label className="mt-6 block">
            <span className="flex justify-between gap-3 text-sm font-black text-[#183F37]">
              Cars à ajouter <strong className="text-[#176951]">{availableCars > 0 ? cars : 0} / {availableCars}</strong>
            </span>
            <input
              type="range"
              min={1}
              max={Math.max(1, availableCars)}
              value={cars}
              disabled={availableCars <= 0}
              onChange={(event) => setRequestedCars(Number(event.target.value))}
              className="mt-3 w-full accent-[#D29F32]"
            />
          </label>
        </Surface>

        <aside className="rounded-[1.5rem] bg-[linear-gradient(145deg,#071A17,#176951)] p-6 text-white shadow-[0_18px_45px_rgba(7,26,23,0.18)]">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9BE0BC]">Déplacement réel</p>
          <h2 className="mt-3 text-2xl font-black">{race?.name ?? "Aucune course"}</h2>
          <dl className="mt-5 divide-y divide-white/10 border-y border-white/10 text-sm">
            <PreviewLine label="Déjà affectés" value={`${raceTrips.reduce((sum, trip) => sum + trip.carCount, 0)} car(s)`} />
            <PreviewLine label="Supporters encore mobilisables" value={remainingSupporters.toLocaleString("fr-FR")} />
            <PreviewLine label="Places ajoutées" value={seats.toLocaleString("fr-FR")} />
            <PreviewLine label="Voyageurs supplémentaires" value={travelers.toLocaleString("fr-FR")} />
            <PreviewLine label="Coût du trajet" value={euroFormatter.format(cost)} />
          </dl>
          <button
            type="button"
            disabled={isPending || !race || availableCars <= 0 || travelers <= 0}
            onClick={() => race && execute(() => charterFanClubCarsAction({ raceId: race.id, modelId: model.id, carCount: cars }))}
            className="mt-6 min-h-11 w-full rounded-xl bg-[#F2C94C] px-4 text-sm font-black text-[#30270C] transition hover:bg-[#FFDC67] disabled:cursor-not-allowed disabled:opacity-45"
          >{isPending ? "Enregistrement…" : "Confirmer l’affrètement"}</button>
          <StatusMessage message={feedback} dark />
        </aside>
      </div>

      <Surface>
        <Heading
          eyebrow="Suivi des cars envoyés"
          title="Déplacements enregistrés"
          detail="Cette vue conserve les cars déjà engagés, course par course."
        />
        {management.trips.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {management.trips.map((trip) => <TripCard key={trip.id} trip={trip} />)}
          </div>
        ) : <p className="mt-5 text-sm font-bold text-[#60736C]">Aucun car n’a encore été envoyé.</p>}
      </Surface>
    </div>
  );
}

function StorePanel({
  data,
  management,
  shopLevel,
  execute,
  isPending,
  feedback,
}: {
  data: FanClubLiveData;
  management: FanClubManagementState;
  shopLevel: number;
  execute: ExecuteAction;
  isPending: boolean;
  feedback: string;
}) {
  const products = FAN_CLUB_PRODUCTS.filter((product) => product.requiredShopLevel <= shopLevel);
  const inventoryByProduct = new Map(management.inventory.map((item) => [item.productId, item]));
  const [prices, setPrices] = useState<Record<string, number>>(() => Object.fromEntries(
    products.map((product) => [product.id, inventoryByProduct.get(product.id)?.salePrice ?? product.suggestedSalePrice]),
  ));
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState(20);
  const level = FAN_CLUB_SHOP_LEVELS.find((candidate) => candidate.level === shopLevel) ?? FAN_CLUB_SHOP_LEVELS[0];
  const totalStock = management.inventory.reduce((sum, item) => sum + item.quantity, 0);
  const capacityLeft = Math.max(0, level.capacity - totalStock);
  const selectedProduct = products.find((product) => product.id === productId) ?? products[0];

  return (
    <div className="space-y-6">
      <Surface>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <Heading
            eyebrow="Boutique officielle"
            title="Stock et prix de vente"
            detail="Les ventes sont réglées automatiquement à chaque nouvelle journée de jeu. Le prix influe fortement sur la demande, tandis que les résultats, la ferveur et une part d’aléatoire rendent chaque journée différente."
          />
          <button type="button" onClick={() => setPurchaseOpen((open) => !open)} className="min-h-11 rounded-xl bg-[#176951] px-4 text-sm font-black text-white transition hover:bg-[#0B5541]">Acheter du stock</button>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[840px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#315B3E]/12 text-xs font-black uppercase tracking-[0.1em] text-[#6F817A]">
                <th className="px-2 py-3">Article</th><th className="px-2 py-3">Stock restant</th><th className="px-2 py-3">Prix choisi</th><th className="px-2 py-3">Marge / unité</th><th className="px-2 py-3">Prévision aléatoire</th><th className="px-2 py-3">Demande</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const inventory = inventoryByProduct.get(product.id);
                const stock = inventory?.quantity ?? 0;
                const price = prices[product.id] ?? product.suggestedSalePrice;
                const averageCost = inventory?.averageUnitCost ?? 0;
                const forecast = estimateDailyProductSalesForecast({
                  product,
                  salePrice: price,
                  supporterCount: data.supporterCount,
                  fervor: data.fervor,
                  popularityIndex: data.popularityIndex,
                  recentResultsMultiplier: data.recentResultsMultiplier,
                });
                return (
                  <tr key={product.id} className="border-b border-[#315B3E]/10 last:border-0">
                    <td className="px-2 py-4 font-black text-[#183F37]">{product.name}</td>
                    <td className="px-2 py-4 font-black text-[#9A7000]">{stock}</td>
                    <td className="px-2 py-4">
                      <div className="flex items-center gap-2">
                        <input
                          aria-label={`Prix de vente de ${product.name}`}
                          type="number" min={0.5} max={999} step={0.5} value={price}
                          onChange={(event) => setPrices((current) => ({ ...current, [product.id]: Math.max(0.5, Number(event.target.value)) }))}
                          className="w-24 rounded-lg border border-[#315B3E]/20 bg-[#F6FAF7] px-3 py-2 font-black text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/25"
                        />
                        <button
                          type="button" disabled={isPending || price === inventory?.salePrice}
                          onClick={() => execute(() => updateFanClubSalePriceAction({ productId: product.id, salePrice: price }))}
                          className="min-h-9 rounded-lg bg-[#176951] px-3 text-xs font-black text-white disabled:opacity-40"
                        >Valider</button>
                      </div>
                    </td>
                    <td className={[
                      "px-2 py-4 font-black",
                      price - averageCost >= 0 ? "text-[#176951]" : "text-[#B34A42]",
                    ].join(" ")}>{decimalEuroFormatter.format(price - averageCost)}</td>
                    <td className="px-2 py-4 font-black text-[#536B63]">{Math.min(stock, forecast.low)} à {Math.min(stock, forecast.high)} / jour</td>
                    <td className="px-2 py-4"><DemandBadge assessment={forecast.assessment} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#EAF5F3] px-4 py-3 text-sm font-bold text-[#536B63]">
          <span>Stock total : <strong className="text-[#176951]">{totalStock} / {level.capacity}</strong></span>
          <span>Capacité disponible : <strong className="text-[#176951]">{capacityLeft}</strong></span>
        </div>
        <StatusMessage message={feedback} />
      </Surface>

      {purchaseOpen && selectedProduct ? (
        <Surface ariaLive>
          <Heading
            eyebrow="Approvisionnement"
            title="Acheter des articles"
            detail="Seuls les articles actuellement disponibles dans votre magasin sont proposés."
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {products.map((product) => {
              const trend = getWholesaleTrendPercent(product);
              return (
                <button
                  key={product.id} type="button" aria-pressed={product.id === selectedProduct.id}
                  onClick={() => setProductId(product.id)}
                  className={[
                    "rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]",
                    product.id === selectedProduct.id ? "border-[#D29F32] bg-[#FFF5D8] ring-2 ring-[#F2C94C]/35" : "border-[#315B3E]/15 bg-[#F8FBF9] hover:border-[#278B70]/35",
                  ].join(" ")}
                >
                  <span className="block font-black text-[#183F37]">{product.name}</span>
                  <span className="mt-3 block text-lg font-black text-[#9A7000]">{decimalEuroFormatter.format(getCurrentWholesalePrice(product))}</span>
                  <span className={[
                    "mt-1 block text-xs font-black",
                    trend >= 0 ? "text-[#176951]" : "text-[#B34A42]",
                  ].join(" ")}>{trend >= 0 ? "+" : ""}{trend.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % sur 7 jours</span>
                </button>
              );
            })}
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.5fr)]">
            <div className="rounded-2xl border border-[#315B3E]/15 bg-[#F8FBF9] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#278B70]">Cours des sept derniers jours</p>
              <h3 className="mt-1 text-xl font-black text-[#183F37]">{selectedProduct.name}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#60736C]">{selectedProduct.description}</p>
              <PriceCourse product={selectedProduct} />
            </div>
            <aside className="rounded-2xl bg-[#0B302B] p-5 text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9BE0BC]">Bon de commande</p>
              <label className="mt-4 block">
                <span className="text-xs font-black text-[#D6DFD2]">Quantité</span>
                <input type="number" min={1} max={Math.max(1, capacityLeft)} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.floor(Number(event.target.value))))} className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-white/10 px-4 font-black text-white outline-none focus:border-[#F2C94C]" />
              </label>
              <dl className="mt-5 divide-y divide-white/10 border-y border-white/10 text-sm">
                <PreviewLine label="Prix unitaire" value={decimalEuroFormatter.format(getCurrentWholesalePrice(selectedProduct))} />
                <PreviewLine label="Total" value={decimalEuroFormatter.format(quantity * getCurrentWholesalePrice(selectedProduct))} />
              </dl>
              <button
                type="button" disabled={isPending || capacityLeft <= 0 || quantity > capacityLeft}
                onClick={() => execute(() => purchaseFanClubStockAction({ productId: selectedProduct.id, quantity }))}
                className="mt-5 min-h-11 w-full rounded-xl bg-[#F2C94C] px-4 text-sm font-black text-[#30270C] transition hover:bg-[#FFDC67] disabled:opacity-45"
              >{isPending ? "Enregistrement…" : "Acheter ce stock"}</button>
            </aside>
          </div>
        </Surface>
      ) : null}

      <Surface>
        <Heading
          eyebrow="Ventes réalisées"
          title="Dernières journées de boutique"
          detail="Les quantités vendues varient avec vos prix, la ferveur, les résultats et les fluctuations propres à chaque journée."
        />
        {management.recentSales.length > 0 ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[660px] border-collapse text-left text-sm">
              <thead><tr className="border-b border-[#315B3E]/12 text-xs font-black uppercase tracking-[0.1em] text-[#6F817A]"><th className="px-2 py-3">Journée</th><th className="px-2 py-3">Article</th><th className="px-2 py-3">Vendus</th><th className="px-2 py-3">Recette</th><th className="px-2 py-3">Conjoncture</th></tr></thead>
              <tbody>{management.recentSales.map((sale) => {
                const product = FAN_CLUB_PRODUCTS.find((candidate) => candidate.id === sale.productId);
                return <tr key={sale.id} className="border-b border-[#315B3E]/10 last:border-0"><td className="px-2 py-4 font-bold text-[#536B63]">{sale.seasonName} · J{sale.dayNumber}</td><td className="px-2 py-4 font-black text-[#183F37]">{product?.name ?? "Article"}</td><td className="px-2 py-4 font-black text-[#9A7000]">{sale.unitsSold}</td><td className="px-2 py-4 font-black text-[#176951]">{decimalEuroFormatter.format(sale.revenue)}</td><td className="px-2 py-4 font-bold text-[#536B63]">{sale.demandFactor >= 1.15 ? "Journée porteuse" : sale.demandFactor <= 0.8 ? "Journée calme" : "Demande normale"}</td></tr>;
              })}</tbody>
            </table>
          </div>
        ) : <p className="mt-5 text-sm font-bold text-[#60736C]">Aucune vente enregistrée pour le moment. Les premières ventes seront calculées au prochain changement de journée.</p>}
      </Surface>
    </div>
  );
}

function TripCard({ trip }: { trip: FanClubTripAllocation }) {
  const model = FAN_CLUB_CAR_MODELS.find((candidate) => candidate.id === trip.modelId);
  const status = trip.raceStatus === "completed" ? "Terminée" : trip.raceStatus === "cancelled" ? "Annulée" : "À venir";
  return (
    <article className="rounded-xl border border-[#315B3E]/15 bg-[#F8FBF9] p-4">
      <div className="flex items-start justify-between gap-3">
        <div><p className="font-black text-[#183F37]">{trip.raceName}</p><p className="mt-1 text-xs font-bold text-[#60736C]">{model?.name ?? "Car"} · {trip.carCount} engagé{trip.carCount > 1 ? "s" : ""}</p></div>
        <span className="rounded-full bg-[#EAF5F3] px-2.5 py-1 text-[10px] font-black uppercase text-[#176951]">{status}</span>
      </div>
      <p className="mt-3 text-sm font-black text-[#9A7000]">{euroFormatter.format(trip.tripCost)}</p>
    </article>
  );
}

function DemandBadge({ assessment }: { assessment: ReturnType<typeof estimateDailyProductSalesForecast>["assessment"] }) {
  const labels = { attractive: "Forte", balanced: "Équilibrée", expensive: "Faible", "very-expensive": "Très faible" } as const;
  return <span className={[
    "inline-flex rounded-full px-2.5 py-1 text-xs font-black",
    assessment === "attractive" ? "bg-[#DDF3E9] text-[#176951]" : assessment === "balanced" ? "bg-[#FFF1B8] text-[#76530D]" : "bg-[#FBE5E2] text-[#B34A42]",
  ].join(" ")}>{labels[assessment]}</span>;
}

function PriceCourse({ product }: { product: (typeof FAN_CLUB_PRODUCTS)[number] }) {
  const minimum = Math.min(...product.wholesaleHistory);
  const maximum = Math.max(...product.wholesaleHistory);
  const range = Math.max(0.01, maximum - minimum);
  const points = product.wholesaleHistory.map((price, index) => `${index / (product.wholesaleHistory.length - 1) * 100},${34 - (price - minimum) / range * 28}`).join(" ");
  return <svg viewBox="0 0 100 40" role="img" aria-label={`Évolution du cours de ${product.name} sur sept jours`} className="mt-5 h-32 w-full overflow-visible" preserveAspectRatio="none"><line x1="0" y1="34" x2="100" y2="34" stroke="#BFD1C6" strokeWidth="0.6" /><polyline points={points} fill="none" stroke="#176951" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Surface({ children, ariaLive = false }: { children: React.ReactNode; ariaLive?: boolean }) {
  return <section aria-live={ariaLive ? "polite" : undefined} className="rounded-[1.5rem] border border-[#315B3E]/15 bg-white p-5 shadow-[0_14px_36px_rgba(19,60,46,0.08)] sm:p-6">{children}</section>;
}
function Heading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#278B70]">{eyebrow}</p><h2 className="mt-1 text-xl font-black text-[#183F37] sm:text-2xl">{title}</h2>{detail ? <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#60736C]">{detail}</p> : null}</div>{action}</div>;
}
function RiderIdentity({ rider }: { rider: FanClubPilotRider }) {
  return <span className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#0B302B] text-xs font-black text-[#F2C94C]">{rider.initials}</span><span><span className="block font-black text-[#183F37]">{rider.name}</span><span className="mt-0.5 block text-xs font-bold text-[#71837C]">{rider.role} · {rider.country}</span></span></span>;
}
function AudienceLine({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center justify-between gap-4 py-3"><dt className="font-bold text-[#60736C]">{label}</dt><dd className="font-black text-[#176951]">+{value.toLocaleString("fr-FR")}</dd></div>;
}
function DecisionCard({ eyebrow, title, description, buttonLabel, onClick }: { eyebrow: string; title: string; description: string; buttonLabel: string; onClick: () => void }) {
  return <aside className="overflow-hidden rounded-[1.5rem] bg-[linear-gradient(145deg,#071A17,#176951)] p-6 text-white shadow-[0_18px_45px_rgba(7,26,23,0.18)]"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F2C94C]">{eyebrow}</p><h2 className="mt-3 text-2xl font-black">{title}</h2><p className="mt-3 text-sm font-semibold leading-6 text-[#D6DFD2]">{description}</p><button type="button" onClick={onClick} className="mt-5 min-h-11 rounded-xl bg-[#F2C94C] px-4 text-sm font-black text-[#30270C]">{buttonLabel}</button></aside>;
}
function TextButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="min-h-10 rounded-xl px-2 text-sm font-black text-[#176951]">{children} →</button>;
}
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: ReadonlyArray<{ value: string; label: string }> }) {
  return <label className="block"><span className="text-sm font-black text-[#183F37]">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/20 bg-[#F6FAF7] px-4 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/25">{options.length > 0 ? options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>) : <option value="">Aucun car disponible</option>}</select></label>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-bold text-[#6F817A]">{label}</dt><dd className="mt-1 font-black text-[#183F37]">{value}</dd></div>;
}
function PreviewLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 py-3"><dt className="font-bold text-[#BFD1C6]">{label}</dt><dd className="text-right font-black text-white">{value}</dd></div>;
}
function ActionButton({ children, disabled, secondary = false, onClick }: { children: React.ReactNode; disabled: boolean; secondary?: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={[
    "min-h-10 rounded-xl px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-45",
    secondary ? "border border-[#176951]/25 bg-white text-[#176951] hover:bg-[#EAF5F3]" : "bg-[#176951] text-white hover:bg-[#0B5541]",
  ].join(" ")}>{children}</button>;
}
function StatusMessage({ message, dark = false }: { message: string; dark?: boolean }) {
  return <p className={[
    "mt-4 min-h-5 text-sm font-bold",
    dark ? "text-[#9BE0BC]" : "text-[#176951]",
  ].join(" ")} role="status">{message}</p>;
}
function getTabId(tab: FanClubPilotTab): string { return `fan-club-tab-${tab}`; }
function getPanelId(tab: FanClubPilotTab): string { return `fan-club-panel-${tab}`; }
function formatTrend(value: number): string { return value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : "Stable"; }
