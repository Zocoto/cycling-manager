"use client";

import { useState } from "react";

import {
  calculateCarResalePrice,
  calculateFanClubTripPreview,
  estimateDailyProductSales,
  FAN_CLUB_CAR_MODELS,
  FAN_CLUB_FLEET_CAPACITY_BY_HEADQUARTERS_LEVEL,
  FAN_CLUB_INITIAL_AVERAGE_COST,
  FAN_CLUB_INITIAL_FLEET,
  FAN_CLUB_INITIAL_STOCK,
  FAN_CLUB_PRODUCTS,
  FAN_CLUB_SHOP_LEVELS,
  getCurrentWholesalePrice,
  getPopularityMaturityCap,
  getWholesaleTrendPercent,
  type FanClubLiveData,
  type FanClubPilotRider,
  type FanClubPilotTab,
} from "@/lib/game/fan-club-pilot";

const BASE_TABS: ReadonlyArray<{
  id: FanClubPilotTab;
  label: string;
  note?: string;
}> = [
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

export function FanClubPilot({
  headquartersLevel = 1,
  shopLevel = 1,
  data,
}: {
  headquartersLevel: number;
  shopLevel: number;
  data: FanClubLiveData;
}) {
  const [activeTab, setActiveTab] = useState<FanClubPilotTab>("overview");
  const tabs: ReadonlyArray<{
    id: FanClubPilotTab;
    label: string;
    note?: string;
  }> = shopLevel > 0
    ? [...BASE_TABS, { id: "store", label: "Magasin", note: `Niv. ${shopLevel}` }]
    : BASE_TABS;

  return (
    <div className="mt-7">
      <nav
        role="tablist"
        aria-label="Rubriques du pilote Fan Club"
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
            onClick={() => setActiveTab(tab.id)}
            className={[
              "flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-inset",
              activeTab === tab.id
                ? "border-[#176951] text-[#0B302B]"
                : "border-transparent text-[#5C746C] hover:border-[#42B99A]/45 hover:text-[#176951]",
            ].join(" ")}
          >
            {tab.label}
            {tab.note ? (
              <span className="rounded-full bg-[#FFF1B8] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#76530D]">
                {tab.note}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="pt-6">
        {activeTab === "overview" ? (
          <PilotPanel tab="overview">
            <OverviewPanel
              data={data}
              onNavigate={setActiveTab}
              shopLevel={shopLevel}
            />
          </PilotPanel>
        ) : null}
        {activeTab === "riders" ? (
          <PilotPanel tab="riders">
            <RidersPanel riders={data.riders} />
          </PilotPanel>
        ) : null}
        {activeTab === "travel" ? (
          <PilotPanel tab="travel">
            <TravelPanel
              headquartersLevel={headquartersLevel}
              supporterCount={data.supporterCount}
              races={data.races}
            />
          </PilotPanel>
        ) : null}
        {activeTab === "store" && shopLevel > 0 ? (
          <PilotPanel tab="store">
            <StorePanel
              shopLevel={shopLevel}
              supporterCount={data.supporterCount}
              fervor={data.fervor}
              popularityIndex={data.popularityIndex}
              recentResultsMultiplier={data.recentResultsMultiplier}
            />
          </PilotPanel>
        ) : null}
      </div>
    </div>
  );
}

function PilotPanel({
  tab,
  children,
}: {
  tab: FanClubPilotTab;
  children: React.ReactNode;
}) {
  return (
    <section
      id={getPanelId(tab)}
      role="tabpanel"
      aria-labelledby={getTabId(tab)}
    >
      {children}
    </section>
  );
}

function OverviewPanel({
  data,
  onNavigate,
  shopLevel,
}: {
  data: FanClubLiveData;
  onNavigate: (tab: FanClubPilotTab) => void;
  shopLevel: number;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
      <div className="space-y-6">
        <PilotSurface>
          <SectionHeading
            eyebrow="Popularité individuelle"
            title="Coureurs les plus suivis"
            action={
              <TextButton onClick={() => onNavigate("riders")}>
                Voir les historiques
              </TextButton>
            }
          />
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#315B3E]/12 text-xs font-black uppercase tracking-[0.1em] text-[#6F817A]">
                  <th className="px-2 py-3">Coureur</th>
                  <th className="px-2 py-3">Popularité</th>
                  <th className="px-2 py-3">Plafond</th>
                  <th className="px-2 py-3">Dernier mouvement</th>
                </tr>
              </thead>
              <tbody>
                {data.riders.slice(0, 3).map((rider) => (
                  <tr
                    key={rider.id}
                    className="border-b border-[#315B3E]/10 last:border-0"
                  >
                    <td className="px-2 py-4">
                      <RiderIdentity rider={rider} />
                    </td>
                    <td className="px-2 py-4">
                      <span className="font-black text-[#9A7000]">
                        {rider.popularity} / 100
                      </span>
                      <span
                        className={[
                          "ml-2 text-xs font-black",
                          rider.trend >= 0
                            ? "text-[#176951]"
                            : "text-[#B34A42]",
                        ].join(" ")}
                      >
                        {formatTrend(rider.trend)}
                      </span>
                    </td>
                    <td className="px-2 py-4 font-black text-[#536B63]">
                      {getPopularityMaturityCap(
                        rider.careerSeasons,
                        rider.phenomenalSeason,
                      )}
                    </td>
                    <td className="px-2 py-4 font-bold text-[#536B63]">
                      {rider.currentDriver}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PilotSurface>

        <PilotSurface>
          <SectionHeading
            eyebrow="Progression lente"
            title="La popularité se construit dans le temps"
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <RuleMetric label="Après 1 saison" value="60 max." />
            <RuleMetric label="Après 2 saisons" value="80 max." />
            <RuleMetric label="Après 3 saisons" value="100 max." />
          </div>
          <p className="mt-4 text-sm font-semibold leading-6 text-[#60736C]">
            Une saison phénoménale peut exceptionnellement lever ce plafond :
            titre majeur, série de victoires internationales ou domination
            sportive hors norme.
          </p>
        </PilotSurface>
      </div>

      <div className="space-y-6">
        <PilotSurface>
          <SectionHeading
            eyebrow="Calcul en direct"
            title="Origine des supporters"
            detail="L’audience est recalculée depuis la réputation du DS, la popularité de l’effectif et les résultats obtenus avec cette équipe."
          />
          <dl className="mt-5 divide-y divide-[#315B3E]/10 text-sm">
            <AudienceLine
              label="Socle du Fan Club"
              value={data.supporterBreakdown.foundation}
            />
            <AudienceLine
              label="Réputation de l’équipe"
              value={data.supporterBreakdown.reputation}
            />
            <AudienceLine
              label="Popularité des coureurs"
              value={data.supporterBreakdown.riders}
            />
            <AudienceLine
              label="Résultats de la saison"
              value={data.supporterBreakdown.recentResults}
            />
            <AudienceLine
              label="Bonus du Siège"
              value={data.supporterBreakdown.headquartersBonus}
            />
          </dl>
        </PilotSurface>
        {data.races[0] ? (
          <DecisionCard
            eyebrow={`Prochaine course · ${data.races[0].timing}`}
            title={data.races[0].name}
            description="Choisissez les cars de votre parc et envoyez jusqu’à 40 % de vos supporters disponibles."
            buttonLabel="Gérer le déplacement"
            onClick={() => onNavigate("travel")}
          />
        ) : (
          <PilotSurface>
            <SectionHeading
              eyebrow="Calendrier de l’équipe"
              title="Aucun déplacement programmé"
              detail="Une course apparaîtra ici dès que l’inscription de votre équipe sera acceptée."
            />
          </PilotSurface>
        )}
        {shopLevel > 0 ? (
          <DecisionCard
            eyebrow={`Boutique niveau ${shopLevel}`}
            title="Stock à constituer"
            description="Fixez librement le prix de vente et surveillez le rythme d’écoulement quotidien."
            buttonLabel="Ouvrir le magasin"
            onClick={() => onNavigate("store")}
          />
        ) : null}
      </div>
    </div>
  );
}

function RidersPanel({
  riders,
}: {
  riders: ReadonlyArray<FanClubPilotRider>;
}) {
  const [selectedRiderId, setSelectedRiderId] = useState(
    riders[0]?.id ?? "",
  );
  const selectedRider =
    riders.find((rider) => rider.id === selectedRiderId) ?? riders[0];
  if (!selectedRider) {
    return (
      <PilotSurface>
        <SectionHeading eyebrow="Effectif" title="Aucun coureur actif" />
      </PilotSurface>
    );
  }
  const maturityCap = getPopularityMaturityCap(
    selectedRider.careerSeasons,
    selectedRider.phenomenalSeason,
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.78fr)_minmax(360px,1.22fr)]">
      <PilotSurface>
        <SectionHeading
          eyebrow="Effectif"
          title="Barème de popularité"
          detail="Le score ne mesure pas seulement les résultats : la fidélité, le panache et l’histoire du coureur comptent durablement."
        />
        <div className="mt-5 divide-y divide-[#315B3E]/10">
          {riders.map((rider) => {
            const selected = rider.id === selectedRider.id;
            return (
              <button
                key={rider.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setSelectedRiderId(rider.id)}
                className={[
                  "flex w-full items-center justify-between gap-4 px-2 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]",
                  selected ? "bg-[#FFF5CF]" : "hover:bg-[#F5FAF7]",
                ].join(" ")}
              >
                <RiderIdentity rider={rider} />
                <span className="text-right">
                  <span className="block text-lg font-black text-[#9A7000]">
                    {rider.popularity}
                  </span>
                  <span className="text-xs font-bold text-[#6F817A]">
                    {rider.status}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </PilotSurface>

      <div className="space-y-6">
        <PilotSurface ariaLive>
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-[7px] border-[#F2C94C] bg-[#0B302B] text-2xl font-black text-[#F2C94C]">
                {selectedRider.popularity}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]">
                  Détail du score
                </p>
                <h2 className="mt-1 text-2xl font-black text-[#183F37]">
                  {selectedRider.name}
                </h2>
                <p className="mt-1 text-xs font-bold text-[#6F817A]">
                  {selectedRider.careerSeasons} saison
                  {selectedRider.careerSeasons > 1 ? "s" : ""} en carrière ·{" "}
                  {selectedRider.seasonsAtClub} au club ·{" "}
                  {selectedRider.country}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-[#D29F32]/30 bg-[#FFF5D8] px-4 py-3 text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#76530D]">
                Plafond actuel
              </p>
              <p className="mt-1 text-xl font-black text-[#513A0B]">
                {maturityCap} / 100
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-x-6 gap-y-4 md:grid-cols-2">
            {selectedRider.factors.map((factor) => (
              <div key={factor.label}>
                <div className="flex items-center justify-between gap-3 text-xs font-bold text-[#60736C]">
                  <span>{factor.label}</span>
                  <span className="font-black text-[#183F37]">
                    {factor.value} / {factor.maximum}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#DDE8E1]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#278B70,#F2C94C)]"
                    style={{
                      width: `${(factor.value / factor.maximum) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border-l-4 border-[#D29F32] bg-[#FFF5D8] px-4 py-3 text-sm font-bold leading-6 text-[#76530D]">
            <strong className="font-black text-[#513A0B]">
              Impact d’un départ :
            </strong>{" "}
            {selectedRider.departureImpact}
          </div>
        </PilotSurface>

        <PilotSurface ariaLive>
          <SectionHeading
            eyebrow="Traçabilité"
            title="Historique de popularité"
            detail="Chaque variation reste consultable afin que le DS comprenne la progression ou l’érosion du score."
          />
          <ol className="mt-5 divide-y divide-[#315B3E]/10">
            {selectedRider.history.map((entry) => (
              <li
                key={entry.id}
                className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[95px_54px_minmax(0,1fr)_70px] sm:items-center"
              >
                <span className="text-xs font-black text-[#6F817A]">
                  S{entry.season} · J{entry.day}
                </span>
                <span
                  className={[
                    "w-fit rounded-full px-2.5 py-1 text-xs font-black",
                    entry.delta >= 0
                      ? "bg-[#DDF3E7] text-[#176951]"
                      : "bg-[#FCE2DF] text-[#9F3E37]",
                  ].join(" ")}
                >
                  {formatTrend(entry.delta)}
                </span>
                <span className="text-sm font-bold leading-6 text-[#183F37]">
                  {entry.reason}
                </span>
                <span className="text-right text-sm font-black text-[#9A7000]">
                  {entry.scoreAfter} pts
                </span>
              </li>
            ))}
          </ol>
        </PilotSurface>
      </div>
    </div>
  );
}

function TravelPanel({
  headquartersLevel,
  supporterCount,
  races,
}: {
  headquartersLevel: number;
  supporterCount: number;
  races: FanClubLiveData["races"];
}) {
  const [fleet, setFleet] = useState<Record<string, number>>(
    () =>
      Object.fromEntries(
        FAN_CLUB_CAR_MODELS.map((model) => [
          model.id,
          model.requiredHeadquartersLevel <= headquartersLevel
            ? (FAN_CLUB_INITIAL_FLEET[model.id] ?? 0)
            : 0,
        ]),
      ) as Record<string, number>,
  );
  const [raceId, setRaceId] = useState(races[0]?.id ?? "");
  const [modelId, setModelId] = useState("regional");
  const [requestedCars, setRequestedCars] = useState(1);
  const [fleetStatus, setFleetStatus] = useState("");
  const [tripStatus, setTripStatus] = useState("");

  const fleetLimit =
    FAN_CLUB_FLEET_CAPACITY_BY_HEADQUARTERS_LEVEL[
      headquartersLevel
    ] ?? 0;
  const totalCars = Object.values(fleet).reduce(
    (total, quantity) => total + quantity,
    0,
  );
  const selectedRace =
    races.find((race) => race.id === raceId) ?? races[0] ?? null;
  const selectedModel =
    FAN_CLUB_CAR_MODELS.find((model) => model.id === modelId) ??
    FAN_CLUB_CAR_MODELS[0];
  const ownedSelectedModel = fleet[selectedModel.id] ?? 0;
  const preview = calculateFanClubTripPreview({
    model: selectedModel,
    requestedCars,
    ownedCars: ownedSelectedModel,
    supporterCount,
    distanceKm: selectedRace?.distanceKm ?? 0,
  });

  function purchaseCar(modelIdToBuy: string) {
    const model = FAN_CLUB_CAR_MODELS.find(
      (candidate) => candidate.id === modelIdToBuy,
    );
    if (!model) return;
    if (model.requiredHeadquartersLevel > headquartersLevel) {
      setFleetStatus(
        `Le ${model.name.toLowerCase()} requiert le Siège niveau ${model.requiredHeadquartersLevel}.`,
      );
      return;
    }
    if (totalCars >= fleetLimit) {
      setFleetStatus(
        `Le parc est plein : ${totalCars} cars sur ${fleetLimit}.`,
      );
      return;
    }
    setFleet((current) => ({
      ...current,
      [model.id]: (current[model.id] ?? 0) + 1,
    }));
    setFleetStatus(
      `Achat simulé : 1 ${model.name.toLowerCase()} ajouté au parc.`,
    );
  }

  function sellCar(modelIdToSell: string) {
    const model = FAN_CLUB_CAR_MODELS.find(
      (candidate) => candidate.id === modelIdToSell,
    );
    if (!model || (fleet[model.id] ?? 0) <= 0) return;
    setFleet((current) => ({
      ...current,
      [model.id]: Math.max(0, (current[model.id] ?? 0) - 1),
    }));
    if (model.id === selectedModel.id) {
      setRequestedCars(1);
    }
    setFleetStatus(
      `Vente simulée : ${euroFormatter.format(calculateCarResalePrice(model))} récupérés.`,
    );
  }

  return (
    <div className="space-y-6">
      <PilotSurface>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionHeading
            eyebrow="Patrimoine du Fan Club"
            title="Parc de cars"
            detail="Achetez et revendez les trois modèles. Le niveau du Siège fixe les modèles accessibles et la taille maximale du parc."
          />
          <RuleMetric
            label={`Siège niveau ${headquartersLevel}`}
            value={`${totalCars} / ${fleetLimit} cars`}
          />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {FAN_CLUB_CAR_MODELS.map((model) => {
            const unlocked =
              model.requiredHeadquartersLevel <= headquartersLevel;
            const owned = fleet[model.id] ?? 0;
            return (
              <article
                key={model.id}
                className="rounded-2xl border border-[#315B3E]/15 bg-[#F8FBF9] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#278B70]">
                      {model.capacity} places
                    </p>
                    <h3 className="mt-1 text-lg font-black text-[#183F37]">
                      {model.name}
                    </h3>
                  </div>
                  <span className="rounded-full bg-[#0B302B] px-3 py-1 text-xs font-black text-[#F2C94C]">
                    {owned} possédé{owned > 1 ? "s" : ""}
                  </span>
                </div>
                <p className="mt-3 min-h-12 text-xs font-semibold leading-5 text-[#60736C]">
                  {model.description}
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="font-bold text-[#6F817A]">Achat</dt>
                    <dd className="mt-1 font-black text-[#183F37]">
                      {euroFormatter.format(model.purchasePrice)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-bold text-[#6F817A]">Revente</dt>
                    <dd className="mt-1 font-black text-[#183F37]">
                      {euroFormatter.format(calculateCarResalePrice(model))}
                    </dd>
                  </div>
                </dl>
                {!unlocked ? (
                  <p className="mt-4 rounded-lg bg-[#FFF5D8] px-3 py-2 text-xs font-black text-[#76530D]">
                    Siège niveau {model.requiredHeadquartersLevel} requis
                  </p>
                ) : null}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => purchaseCar(model.id)}
                    disabled={!unlocked || totalCars >= fleetLimit}
                    className="min-h-10 rounded-xl bg-[#176951] px-3 text-xs font-black text-white transition hover:bg-[#0B5541] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Acheter
                  </button>
                  <button
                    type="button"
                    onClick={() => sellCar(model.id)}
                    disabled={owned <= 0}
                    className="min-h-10 rounded-xl border border-[#176951]/25 bg-white px-3 text-xs font-black text-[#176951] transition hover:bg-[#EAF5F3] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Vendre
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-4 min-h-5 text-sm font-bold text-[#176951]" role="status">
          {fleetStatus}
        </p>
      </PilotSurface>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.62fr)]">
        <PilotSurface>
          <SectionHeading
            eyebrow="Affrètement"
            title="Préparer un déplacement"
            detail="Pour chaque course, 40 % des supporters sont considérés comme disponibles. Un car peut partir même s’il n’est pas complet."
          />
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <SelectField
              label="Épreuve ciblée"
              value={raceId}
              onChange={(value) => {
                setRaceId(value);
                setTripStatus("");
              }}
              options={races.map((race) => ({
                value: race.id,
                label: `${race.name} · ${race.timing}`,
              }))}
            />
            <SelectField
              label="Modèle à envoyer"
              value={modelId}
              onChange={(value) => {
                setModelId(value);
                setRequestedCars(1);
                setTripStatus("");
              }}
              options={FAN_CLUB_CAR_MODELS.filter(
                (model) => (fleet[model.id] ?? 0) > 0,
              ).map((model) => ({
                value: model.id,
                label: `${model.name} · ${fleet[model.id]} disponible(s)`,
              }))}
            />
          </div>
          <label className="mt-6 block">
            <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-black text-[#183F37]">
              Cars engagés
              <strong className="text-[#176951]">
                {preview.cars} / {ownedSelectedModel}
              </strong>
            </span>
            <input
              type="range"
              min={ownedSelectedModel > 0 ? 1 : 0}
              max={Math.max(1, ownedSelectedModel)}
              step={1}
              value={Math.min(requestedCars, Math.max(1, ownedSelectedModel))}
              disabled={ownedSelectedModel <= 0}
              onChange={(event) => {
                setRequestedCars(Number(event.target.value));
                setTripStatus("");
              }}
              className="mt-3 w-full accent-[#D29F32]"
            />
          </label>
        </PilotSurface>

        <aside className="rounded-[1.5rem] bg-[linear-gradient(145deg,#071A17,#176951)] p-6 text-white shadow-[0_18px_45px_rgba(7,26,23,0.18)]">
          <span className="inline-flex rounded-full bg-[#42B99A]/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#9BE0BC]">
            Soutien · palier {preview.level} sur 4
          </span>
          <h2 className="mt-4 text-2xl font-black">{preview.name}</h2>
          <dl className="mt-5 divide-y divide-white/10 border-y border-white/10 text-sm">
            <PreviewLine
              label="Supporters disponibles"
              value={preview.availableSupporters.toLocaleString("fr-FR")}
            />
            <PreviewLine
              label="Places proposées"
              value={preview.seats.toLocaleString("fr-FR")}
            />
            <PreviewLine
              label="Voyageurs prévus"
              value={preview.travelers.toLocaleString("fr-FR")}
            />
            <PreviewLine
              label="Remplissage"
              value={`${preview.occupancyRate} %`}
            />
            <PreviewLine
              label="Coût du trajet"
              value={euroFormatter.format(preview.cost)}
            />
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            {preview.bonuses.map((bonus) => (
              <span
                key={bonus}
                className="rounded-lg bg-[#F2C94C]/15 px-3 py-2 text-xs font-black text-[#F2C94C]"
              >
                {bonus}
              </span>
            ))}
          </div>
          <button
            type="button"
            disabled={preview.cars <= 0}
            onClick={() =>
              setTripStatus(
                `Simulation : ${preview.cars} car(s) et ${preview.travelers} supporters envoyés.`,
              )
            }
            className="mt-6 min-h-11 w-full rounded-xl bg-[#F2C94C] px-4 text-sm font-black text-[#30270C] transition hover:bg-[#FFDC67] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Simuler le déplacement
          </button>
          <p className="mt-3 min-h-5 text-xs font-bold text-[#9BE0BC]" role="status">
            {tripStatus}
          </p>
        </aside>
      </div>
    </div>
  );
}

function StorePanel({
  shopLevel,
  supporterCount,
  fervor,
  popularityIndex,
  recentResultsMultiplier,
}: {
  shopLevel: number;
  supporterCount: number;
  fervor: number;
  popularityIndex: number;
  recentResultsMultiplier: number;
}) {
  const [stock, setStock] = useState<Record<string, number>>({
    ...FAN_CLUB_INITIAL_STOCK,
  });
  const [averageCosts, setAverageCosts] = useState<Record<string, number>>({
    ...FAN_CLUB_INITIAL_AVERAGE_COST,
  });
  const [salePrices, setSalePrices] = useState<Record<string, number>>(
    Object.fromEntries(
      FAN_CLUB_PRODUCTS.map((product) => [
        product.id,
        product.suggestedSalePrice,
      ]),
    ),
  );
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(
    FAN_CLUB_PRODUCTS[0].id,
  );
  const [purchaseQuantity, setPurchaseQuantity] = useState(20);
  const [status, setStatus] = useState("");

  const currentLevel =
    FAN_CLUB_SHOP_LEVELS.find((level) => level.level === shopLevel) ?? FAN_CLUB_SHOP_LEVELS[0];
  const totalStock = Object.values(stock).reduce(
    (total, quantity) => total + quantity,
    0,
  );
  const availableCapacity = Math.max(0, currentLevel.capacity - totalStock);
  const selectedProduct =
    FAN_CLUB_PRODUCTS.find(
      (product) => product.id === selectedProductId,
    ) ?? FAN_CLUB_PRODUCTS[0];
  const selectedProductUnlocked =
    selectedProduct.requiredShopLevel <= shopLevel;
  const selectedWholesalePrice = getCurrentWholesalePrice(selectedProduct);

  function estimateSales(productId: string): number {
    const product = FAN_CLUB_PRODUCTS.find(
      (candidate) => candidate.id === productId,
    );
    if (!product) return 0;
    return estimateDailyProductSales({
      product,
      salePrice: salePrices[product.id] ?? product.suggestedSalePrice,
      supporterCount,
      fervor,
      popularityIndex,
      recentResultsMultiplier,
    });
  }

  function buyStock() {
    const quantity = Math.max(1, Math.floor(purchaseQuantity));
    if (!selectedProductUnlocked) {
      setStatus(
        `La Boutique niveau ${selectedProduct.requiredShopLevel} est requise pour acheter cet objet.`,
      );
      return;
    }
    if (quantity > availableCapacity) {
      setStatus(
        `Capacité insuffisante : ${availableCapacity} emplacement(s) disponible(s).`,
      );
      return;
    }
    const previousQuantity = stock[selectedProduct.id] ?? 0;
    const previousAverageCost = averageCosts[selectedProduct.id] ?? 0;
    const nextQuantity = previousQuantity + quantity;
    const nextAverageCost =
      (previousQuantity * previousAverageCost +
        quantity * selectedWholesalePrice) /
      nextQuantity;
    setStock((current) => ({
      ...current,
      [selectedProduct.id]: nextQuantity,
    }));
    setAverageCosts((current) => ({
      ...current,
      [selectedProduct.id]: nextAverageCost,
    }));
    setStatus(
      `Achat simulé : ${quantity} ${selectedProduct.name.toLowerCase()} pour ${decimalEuroFormatter.format(quantity * selectedWholesalePrice)}.`,
    );
  }

  function simulateSalesDay() {
    let sold = 0;
    const nextStock = { ...stock };
    FAN_CLUB_PRODUCTS.forEach((product) => {
      const productStock = nextStock[product.id] ?? 0;
      const productSales = Math.min(productStock, estimateSales(product.id));
      nextStock[product.id] = productStock - productSales;
      sold += productSales;
    });
    setStock(nextStock);
    setStatus(
      `Fin de journée simulée : ${sold} article(s) vendu(s) et retiré(s) du stock.`,
    );
  }

  return (
    <div className="space-y-6">
      <PilotSurface>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionHeading
            eyebrow="Boutique officielle"
            title="Magasin"
            detail="Le DS choisit le prix de vente. Les stocks diminuent chaque jour selon la base de supporters, la ferveur, la popularité du club et le positionnement tarifaire."
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setPurchaseOpen((current) => !current);
                setStatus("");
              }}
              className="min-h-11 rounded-xl bg-[#176951] px-4 text-sm font-black text-white transition hover:bg-[#0B5541]"
            >
              Acheter du stock
            </button>
            <button
              type="button"
              onClick={simulateSalesDay}
              className="min-h-11 rounded-xl border border-[#176951]/25 bg-white px-4 text-sm font-black text-[#176951] transition hover:bg-[#EAF5F3]"
            >
              Simuler un jour
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#315B3E]/12 text-xs font-black uppercase tracking-[0.1em] text-[#6F817A]">
                <th className="px-2 py-3">Objet</th>
                <th className="px-2 py-3">Stock</th>
                <th className="px-2 py-3">Prix choisi</th>
                <th className="px-2 py-3">Marge / unité</th>
                <th className="px-2 py-3">Ventes / jour</th>
                <th className="px-2 py-3">Autonomie</th>
              </tr>
            </thead>
            <tbody>
              {FAN_CLUB_PRODUCTS.filter(
                (product) => product.requiredShopLevel <= shopLevel,
              ).map((product) => {
                const quantity = stock[product.id] ?? 0;
                const averageCost = averageCosts[product.id] ?? 0;
                const salePrice =
                  salePrices[product.id] ?? product.suggestedSalePrice;
                const dailySales = estimateSales(product.id);
                const margin = salePrice - averageCost;
                const coverage =
                  dailySales > 0 ? Math.ceil(quantity / dailySales) : null;
                return (
                  <tr
                    key={product.id}
                    className="border-b border-[#315B3E]/10 last:border-0"
                  >
                    <td className="px-2 py-4 font-black text-[#183F37]">
                      {product.name}
                    </td>
                    <td className="px-2 py-4 font-black text-[#9A7000]">
                      {quantity}
                    </td>
                    <td className="px-2 py-4">
                      <label className="sr-only" htmlFor={`price-${product.id}`}>
                        Prix de vente de {product.name}
                      </label>
                      <input
                        id={`price-${product.id}`}
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={salePrice}
                        onChange={(event) => {
                          setSalePrices((current) => ({
                            ...current,
                            [product.id]: Math.max(
                              0.5,
                              Number(event.target.value),
                            ),
                          }));
                          setStatus("");
                        }}
                        className="w-24 rounded-lg border border-[#315B3E]/20 bg-[#F6FAF7] px-3 py-2 font-black text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/25"
                      />
                    </td>
                    <td
                      className={[
                        "px-2 py-4 font-black",
                        margin >= 0 ? "text-[#176951]" : "text-[#B34A42]",
                      ].join(" ")}
                    >
                      {decimalEuroFormatter.format(margin)}
                    </td>
                    <td className="px-2 py-4 font-black text-[#536B63]">
                      ≈ {Math.min(quantity, dailySales)}
                    </td>
                    <td className="px-2 py-4 font-bold text-[#536B63]">
                      {coverage === null ? "—" : `${coverage} jour(s)`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#EAF5F3] px-4 py-3 text-sm font-bold text-[#536B63]">
          <span>
            Stock total :{" "}
            <strong className="font-black text-[#176951]">
              {totalStock} / {currentLevel.capacity}
            </strong>
          </span>
          <span>
            Capacité disponible :{" "}
            <strong className="font-black text-[#176951]">
              {availableCapacity}
            </strong>
          </span>
        </div>
        <p className="mt-4 min-h-5 text-sm font-bold text-[#176951]" role="status">
          {status}
        </p>
      </PilotSurface>

      {purchaseOpen ? (
        <PilotSurface ariaLive>
          <SectionHeading
            eyebrow="Marché commun à tous les joueurs"
            title="Achat de stock"
            detail="Sur ordinateur, survolez un objet pour consulter son cours. Sur téléphone, touchez sa fiche pour afficher le même détail."
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {FAN_CLUB_PRODUCTS.map((product) => {
              const selected = product.id === selectedProduct.id;
              const unlocked =
                product.requiredShopLevel <= shopLevel;
              const trend = getWholesaleTrendPercent(product);
              return (
                <button
                  key={product.id}
                  type="button"
                  aria-pressed={selected}
                  onMouseEnter={() => setSelectedProductId(product.id)}
                  onFocus={() => setSelectedProductId(product.id)}
                  onClick={() => setSelectedProductId(product.id)}
                  className={[
                    "rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]",
                    selected
                      ? "border-[#D29F32] bg-[#FFF5D8] ring-2 ring-[#F2C94C]/35"
                      : "border-[#315B3E]/15 bg-[#F8FBF9] hover:border-[#278B70]/35",
                  ].join(" ")}
                >
                  <span className="block text-[10px] font-black uppercase tracking-[0.13em] text-[#278B70]">
                    Niveau {product.requiredShopLevel}
                  </span>
                  <span className="mt-2 block font-black text-[#183F37]">
                    {product.name}
                  </span>
                  <span className="mt-3 block text-lg font-black text-[#9A7000]">
                    {decimalEuroFormatter.format(
                      getCurrentWholesalePrice(product),
                    )}
                  </span>
                  <span
                    className={[
                      "mt-1 block text-xs font-black",
                      trend >= 0 ? "text-[#176951]" : "text-[#B34A42]",
                    ].join(" ")}
                  >
                    {trend >= 0 ? "+" : ""}
                    {trend.toLocaleString("fr-FR", {
                      maximumFractionDigits: 1,
                    })}{" "}
                    % sur 7 jours
                  </span>
                  {!unlocked ? (
                    <span className="mt-3 block text-xs font-black text-[#76530D]">
                      Verrouillé
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.55fr)]">
            <div className="rounded-2xl border border-[#315B3E]/15 bg-[#F8FBF9] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#278B70]">
                    Cours des sept derniers jours
                  </p>
                  <h3 className="mt-1 text-xl font-black text-[#183F37]">
                    {selectedProduct.name}
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#60736C]">
                    {selectedProduct.description}
                  </p>
                </div>
                <span className="text-2xl font-black text-[#9A7000]">
                  {decimalEuroFormatter.format(selectedWholesalePrice)}
                </span>
              </div>
              <PriceCourse product={selectedProduct} />
            </div>

            <aside className="rounded-2xl bg-[#0B302B] p-5 text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9BE0BC]">
                Bon de commande
              </p>
              <label className="mt-4 block">
                <span className="text-xs font-black text-[#D6DFD2]">
                  Quantité
                </span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, availableCapacity)}
                  step={1}
                  value={purchaseQuantity}
                  onChange={(event) =>
                    setPurchaseQuantity(
                      Math.max(1, Number(event.target.value)),
                    )
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-white/10 px-4 font-black text-white outline-none focus:border-[#F2C94C]"
                />
              </label>
              <dl className="mt-5 divide-y divide-white/10 border-y border-white/10 text-sm">
                <PreviewLine
                  label="Prix unitaire"
                  value={decimalEuroFormatter.format(selectedWholesalePrice)}
                />
                <PreviewLine
                  label="Total"
                  value={decimalEuroFormatter.format(
                    Math.max(1, purchaseQuantity) * selectedWholesalePrice,
                  )}
                />
              </dl>
              <button
                type="button"
                disabled={!selectedProductUnlocked || availableCapacity <= 0}
                onClick={buyStock}
                className="mt-5 min-h-11 w-full rounded-xl bg-[#F2C94C] px-4 text-sm font-black text-[#30270C] transition hover:bg-[#FFDC67] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Acheter ce stock
              </button>
              {!selectedProductUnlocked ? (
                <p className="mt-3 text-xs font-black text-[#F2C94C]">
                  Boutique niveau {selectedProduct.requiredShopLevel} requise.
                </p>
              ) : null}
            </aside>
          </div>
        </PilotSurface>
      ) : null}

      <PilotSurface>
        <SectionHeading
          eyebrow="Progression du bâtiment"
          title="Paliers proposés"
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {FAN_CLUB_SHOP_LEVELS.map((level) => (
            <article
              key={level.level}
              className={[
                "rounded-xl border p-4",
                level.level === shopLevel
                  ? "border-[#D29F32] bg-[#FFF5D8]"
                  : "border-[#315B3E]/15 bg-[#F8FBF9]",
              ].join(" ")}
            >
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#278B70]">
                Niveau {level.level}
              </p>
              <p className="mt-2 text-xl font-black text-[#183F37]">
                {level.capacity.toLocaleString("fr-FR")} objets
              </p>
              <p className="mt-1 text-xs font-bold text-[#6F817A]">
                {level.productCount} type
                {level.productCount > 1 ? "s" : ""} disponible
                {level.productCount > 1 ? "s" : ""}
              </p>
            </article>
          ))}
        </div>
      </PilotSurface>
    </div>
  );
}

function PriceCourse({
  product,
}: {
  product: (typeof FAN_CLUB_PRODUCTS)[number];
}) {
  const minimum = Math.min(...product.wholesaleHistory);
  const maximum = Math.max(...product.wholesaleHistory);
  const range = Math.max(0.01, maximum - minimum);
  const points = product.wholesaleHistory
    .map((price, index) => {
      const x = (index / (product.wholesaleHistory.length - 1)) * 100;
      const y = 34 - ((price - minimum) / range) * 28;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 40"
      role="img"
      aria-label={`Évolution du cours de ${product.name} sur sept jours`}
      className="mt-5 h-32 w-full overflow-visible"
      preserveAspectRatio="none"
    >
      <line
        x1="0"
        y1="34"
        x2="100"
        y2="34"
        stroke="#BFD1C6"
        strokeWidth="0.6"
      />
      <polyline
        points={points}
        fill="none"
        stroke="#176951"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {product.wholesaleHistory.map((price, index) => {
        const x = (index / (product.wholesaleHistory.length - 1)) * 100;
        const y = 34 - ((price - minimum) / range) * 28;
        return (
          <circle
            key={`${product.id}-${index}`}
            cx={x}
            cy={y}
            r="1.6"
            fill="#F2C94C"
            stroke="#0B302B"
            strokeWidth="0.7"
          />
        );
      })}
    </svg>
  );
}

function PilotSurface({
  children,
  ariaLive = false,
}: {
  children: React.ReactNode;
  ariaLive?: boolean;
}) {
  return (
    <section
      aria-live={ariaLive ? "polite" : undefined}
      className="rounded-[1.5rem] border border-[#315B3E]/15 bg-white p-5 shadow-[0_14px_36px_rgba(19,60,46,0.08)] sm:p-6"
    >
      {children}
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#278B70]">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-black text-[#183F37] sm:text-2xl">
          {title}
        </h2>
        {detail ? (
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#60736C]">
            {detail}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function RiderIdentity({ rider }: { rider: FanClubPilotRider }) {
  return (
    <span className="flex items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#0B302B] text-xs font-black text-[#F2C94C]">
        {rider.initials}
      </span>
      <span>
        <span className="block font-black text-[#183F37]">{rider.name}</span>
        <span className="mt-0.5 block text-xs font-bold text-[#71837C]">
          {rider.role} · {rider.country}
        </span>
      </span>
    </span>
  );
}

function RuleMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-[#315B3E]/15 bg-[#F5FAF7] px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6F817A]">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-[#176951]">{value}</p>
    </article>
  );
}
function AudienceLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="font-bold text-[#60736C]">{label}</dt>
      <dd className="font-black text-[#176951]">
        +{value.toLocaleString("fr-FR")}
      </dd>
    </div>
  );
}


function DecisionCard({
  eyebrow,
  title,
  description,
  buttonLabel,
  onClick,
}: {
  eyebrow: string;
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
}) {
  return (
    <aside className="overflow-hidden rounded-[1.5rem] bg-[linear-gradient(145deg,#071A17,#176951)] p-6 text-white shadow-[0_18px_45px_rgba(7,26,23,0.18)]">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F2C94C]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-black">{title}</h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#D6DFD2]">
        {description}
      </p>
      <button
        type="button"
        onClick={onClick}
        className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#F2C94C] px-4 text-sm font-black text-[#30270C] transition hover:bg-[#FFDC67]"
      >
        {buttonLabel}
      </button>
    </aside>
  );
}

function TextButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-10 rounded-xl px-2 text-sm font-black text-[#176951] transition hover:text-[#0B302B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
    >
      {children} →
    </button>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-[#183F37]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-12 w-full rounded-xl border border-[#315B3E]/20 bg-[#F6FAF7] px-4 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/25"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="font-bold text-[#BFD1C6]">{label}</dt>
      <dd className="text-right font-black text-white">{value}</dd>
    </div>
  );
}

function getTabId(tab: FanClubPilotTab): string {
  return `fan-club-tab-${tab}`;
}

function getPanelId(tab: FanClubPilotTab): string {
  return `fan-club-panel-${tab}`;
}

function formatTrend(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return "Stable";
}
