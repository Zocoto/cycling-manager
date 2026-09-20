import Image from "next/image";

import Link from "@/components/ui/app-link";
import {
  RacePreparationWorkspace,
  type RacePreparationWorkspaceEdition,
} from "@/components/game/race-preparation-workspace";
import {
  chooseFederationEquipmentOfferAction,
  disabledFederationTacticalAction,
  saveFederationRacePreparationAction,
  saveFederationTimeTrialPreparationAction,
} from "@/app/jeu/federations/equipment-actions";
import type { FederationEquipmentState } from "@/services/federation-equipment";

const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const SLOT_LABELS: Record<string, string> = {
  frame: "Cadre",
  front_wheel: "Roue avant",
  rear_wheel: "Roue arrière",
  helmet: "Casque",
  shoes: "Chaussures",
  gloves: "Gants",
  glasses: "Lunettes",
  bib_shorts: "Cuissard",
};

export function FederationEquipmentPreparationPanel({
  countryCode,
  gameYear,
  selectedView,
  equipmentState,
  preparationEditions,
  nowIso,
  initialSlug,
  errorMessage,
  saved,
  choiceConfirmed,
}: {
  countryCode: string;
  gameYear: number;
  selectedView: "equipment" | "preparation";
  equipmentState: FederationEquipmentState;
  preparationEditions: RacePreparationWorkspaceEdition[];
  nowIso: string;
  initialSlug?: string;
  errorMessage?: string;
  saved: boolean;
  choiceConfirmed: boolean;
}) {
  const baseHref = `/jeu/federations/${countryCode.toLowerCase()}?onglet=equipment`;

  return (
    <section>
      <div className="grid gap-2 rounded-2xl border border-[#315B3E]/14 bg-white p-2 shadow-sm sm:grid-cols-2">
        <SubTab
          href={`${baseHref}&volet=equipment`}
          active={selectedView === "equipment"}
          label="Équipement national"
          description="Une offre fixe pour toute la saison"
        />
        <SubTab
          href={`${baseHref}&volet=preparation`}
          active={selectedView === "preparation"}
          label="Préparation des courses"
          description="Rôles et stratégies des sélections"
        />
      </div>

      {errorMessage ? (
        <p className="mt-5 rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-bold text-red-900">
          {errorMessage}
        </p>
      ) : null}
      {choiceConfirmed ? (
        <p className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-900">
          Le contrat équipementier est signé et verrouillé pour toute la saison.
        </p>
      ) : null}
      {saved ? (
        <p className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-900">
          Le plan de la sélection a bien été enregistré.
        </p>
      ) : null}

      {selectedView === "equipment" ? (
        <EquipmentOffers
          countryCode={countryCode}
          state={equipmentState}
        />
      ) : (
        <PreparationPanel
          countryCode={countryCode}
          gameYear={gameYear}
          state={equipmentState}
          editions={preparationEditions}
          nowIso={nowIso}
          initialSlug={initialSlug}
        />
      )}
    </section>
  );
}

function EquipmentOffers({
  countryCode,
  state,
}: {
  countryCode: string;
  state: FederationEquipmentState;
}) {
  const selectedOffer = state.contract
    ? state.offers.find((offer) => offer.key === state.contract?.offerKey)
    : null;

  return (
    <div className="mt-5 space-y-5">
      <header className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-7 text-white shadow-[0_20px_50px_rgba(7,26,23,0.16)] sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9BE0BC]">
              Contrat saisonnier
            </p>
            <h2 className="mt-2 text-2xl font-black">Choisir la dotation des sélections</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#D6DFD2]">
              L’offre est indivisible et définitive. Elle équipe automatiquement les coureurs professionnels et juniors uniquement lorsqu’ils représentent leur nation ; leur matériel de club reprend effet sur toutes les autres courses.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/8 px-5 py-3 text-right">
            <p className="text-[9px] font-black uppercase tracking-wide text-[#9BE0BC]">Trésorerie disponible</p>
            <p className="mt-1 text-xl font-black tabular-nums">
              {state.balance === null ? "—" : moneyFormatter.format(state.balance)}
            </p>
          </div>
        </div>
      </header>

      {state.contract ? (
        <article className="rounded-3xl border border-[#278B70]/25 bg-[#EAF5F0] p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#278B70]">Contrat actif · choix verrouillé</p>
              <h3 className="mt-1 text-xl font-black text-[#0B302B]">{state.contract.offerName}</h3>
              <p className="mt-1 text-xs font-semibold text-[#66877C]">
                {moneyFormatter.format(state.contract.pricePaid)} engagés pour la saison.
              </p>
            </div>
            {selectedOffer?.supplier.logoPath ? (
              <span className="relative h-14 w-36 rounded-xl bg-white p-2 shadow-sm">
                <Image src={selectedOffer.supplier.logoPath} alt={selectedOffer.supplier.name} fill className="object-contain p-2" sizes="144px" />
              </span>
            ) : null}
          </div>
          <EquipmentList items={state.contract.items} />
        </article>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {state.offers.map((offer) => {
          const selected = offer.key === state.contract?.offerKey;
          const affordable = state.balance !== null && state.balance >= offer.seasonPrice;
          return (
            <article
              key={offer.key}
              className={`overflow-hidden rounded-3xl border bg-white shadow-[0_14px_35px_rgba(19,60,46,0.08)] ${selected ? "border-[#278B70]/45 ring-2 ring-[#278B70]/15" : "border-[#315B3E]/14"}`}
            >
              <div
                className="flex min-h-28 items-center justify-between gap-4 px-5 py-5 text-white sm:px-6"
                style={{ background: `linear-gradient(135deg, ${offer.supplier.primaryColor}, ${offer.supplier.secondaryColor})` }}
              >
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.17em] text-white/70">{offer.supplier.name}</p>
                  <h3 className="mt-1 text-xl font-black">{offer.name}</h3>
                  <p className="mt-2 text-lg font-black tabular-nums text-[#F7DA72]">{moneyFormatter.format(offer.seasonPrice)}</p>
                </div>
                {offer.supplier.logoPath ? (
                  <span className="relative h-16 w-36 shrink-0 rounded-xl bg-white/95 p-2 shadow-lg">
                    <Image src={offer.supplier.logoPath} alt="" fill className="object-contain p-2" sizes="144px" />
                  </span>
                ) : null}
              </div>
              <div className="p-5 sm:p-6">
                <p className="min-h-10 text-xs font-semibold leading-5 text-[#66877C]">{offer.description}</p>
                <EquipmentList items={offer.items} />
                {!state.contract && state.canManage ? (
                  <form action={chooseFederationEquipmentOfferAction} className="mt-5">
                    <input type="hidden" name="countryCode" value={countryCode} />
                    <input type="hidden" name="offerKey" value={offer.key} />
                    <button
                      type="submit"
                      disabled={!affordable}
                      className="min-h-11 w-full rounded-xl bg-[#176951] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#0F5542] disabled:cursor-not-allowed disabled:bg-[#AABCB5]"
                    >
                      {affordable ? "Signer cette offre pour la saison" : "Budget fédéral insuffisant"}
                    </button>
                  </form>
                ) : !state.contract ? (
                  <p className="mt-5 rounded-xl bg-[#F4F8F6] px-4 py-3 text-center text-xs font-bold text-[#66877C]">
                    Le choix appartient au président de la fédération.
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function PreparationPanel({
  countryCode,
  gameYear,
  state,
  editions,
  nowIso,
  initialSlug,
}: {
  countryCode: string;
  gameYear: number;
  state: FederationEquipmentState;
  editions: RacePreparationWorkspaceEdition[];
  nowIso: string;
  initialSlug?: string;
}) {
  return (
    <div className="mt-5 space-y-5">
      <div className="rounded-2xl border border-[#315B3E]/14 bg-white px-5 py-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#397A67]">Matériel verrouillé</p>
        <p className="mt-1 text-sm font-black text-[#0B302B]">
          {state.contract ? state.contract.offerName : "Aucun équipementier encore choisi"}
        </p>
        <p className="mt-1 text-xs font-semibold leading-5 text-[#66877C]">
          Les rôles et stratégies restent modifiables par le président jusqu’au départ. Le matériel n’est pas personnalisable depuis cette console.
        </p>
      </div>

      {editions.length > 0 ? (
        <RacePreparationWorkspace
          action={saveFederationRacePreparationAction}
          tacticalAction={disabledFederationTacticalAction}
          timeTrialAction={saveFederationTimeTrialPreparationAction}
          editions={editions}
          gameYear={gameYear}
          tacticalCenterLevel={0}
          tacticalBriefingsByStageId={{}}
          tacticalError={false}
          nowIso={nowIso}
          initialSlug={initialSlug}
          equipmentError={false}
          mode="federation"
          federationCountryCode={countryCode}
          readOnly={!state.canManage}
        />
      ) : (
        <div className="rounded-[2rem] border border-dashed border-[#315B3E]/25 bg-white px-6 py-14 text-center shadow-sm">
          <h3 className="text-xl font-black text-[#0B302B]">Aucune sélection à préparer</h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#66877C]">
            Une course apparaît ici dès qu’une liste professionnelle est publiée, liée au calendrier et qu’au moins un coureur a confirmé sa convocation.
          </p>
        </div>
      )}
    </div>
  );
}

function EquipmentList({ items }: { items: FederationEquipmentState["offers"][number]["items"] }) {
  return (
    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.slotType} className="rounded-xl border border-[#315B3E]/10 bg-[#F8FBF9] px-3 py-3">
          <p className="text-[9px] font-black uppercase tracking-wide text-[#397A67]">{SLOT_LABELS[item.slotType] ?? item.slotType}</p>
          <p className="mt-1 text-xs font-black text-[#0B302B]">{item.name}</p>
          <p className="mt-1 text-[10px] font-bold text-[#278B70]">{item.effectSummary}</p>
        </li>
      ))}
    </ul>
  );
}

function SubTab({ href, active, label, description }: { href: string; active: boolean; label: string; description: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-xl px-5 py-4 transition ${active ? "bg-[#123F36] text-white shadow-md" : "text-[#183F37] hover:bg-[#F0F7F3]"}`}
    >
      <span className="block text-sm font-black">{label}</span>
      <span className={`mt-1 block text-xs font-semibold ${active ? "text-white/70" : "text-[#789087]"}`}>{description}</span>
    </Link>
  );
}
