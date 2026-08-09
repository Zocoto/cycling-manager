import { renewAllTeamRiderContractsAction } from "@/app/jeu/effectif/actions";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { TransferSubmitButton } from "@/components/game/transfer-submit-button";
import Link from "@/components/ui/app-link";
import type { TeamContractRiderStatus } from "@/lib/game/team-contract-management";
import type { RiderJerseyAppearance } from "@/lib/rider-jersey";
import type {
  TeamContractManagementOverview,
  TeamContractManagementRider,
} from "@/services/team-contract-management";

export function TeamContractManagement({
  overview,
  jersey,
  jerseyByRiderId,
}: {
  overview: TeamContractManagementOverview;
  jersey: RiderJerseyAppearance;
  jerseyByRiderId?: ReadonlyMap<string, RiderJerseyAppearance>;
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_18px_50px_rgba(19,60,46,0.1)]">
      <header className="relative overflow-hidden bg-[linear-gradient(135deg,#071A17,#0B302B_55%,#176951)] px-5 py-6 text-white sm:px-8 sm:py-8">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:30px_30px]"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9BE0BC]">
              {overview.currentSeasonName} → {overview.nextSeasonName}
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
              Gestion contractuelle
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#D6DFD2]">
              Préparez la saison suivante en une seule opération. Les contrats
              déjà sécurisés et les départs programmés restent inchangés.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ContractMetric
              label="À prolonger"
              value={String(overview.eligibleCount)}
              accent
            />
            <ContractMetric
              label="Sécurisés"
              value={String(overview.securedCount)}
            />
            <ContractMetric
              label="Départs"
              value={String(overview.leavingCount)}
            />
            <ContractMetric
              label="Masse N+1"
              value={formatCompactMoney(
                overview.projectedNextPayroll,
                overview.currency,
              )}
            />
          </div>
        </div>
      </header>

      <div className="border-b border-[#315B3E]/12 bg-[#F3F8F6] px-5 py-5 sm:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]">
              Prolongation groupée
            </p>
            <p className="mt-1 text-sm font-bold text-[#183F37]">
              {overview.eligibleCount > 0
                ? `${formatRiderCount(overview.eligibleCount)} concerné${overview.eligibleCount > 1 ? "s" : ""} · ${formatMoney(overview.estimatedRenewalPayroll, overview.currency)} estimés pour ${overview.nextSeasonName}`
                : "Aucun contrat n’arrive à échéance sans solution."}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#60756E]">
              Le salaire définitif est recalculé au moment de la signature selon
              le niveau et les résultats du coureur.
            </p>
          </div>
          <form action={renewAllTeamRiderContractsAction}>
            <TransferSubmitButton
              pendingLabel="Prolongation de l’effectif…"
              disabled={overview.eligibleCount === 0}
              tone="green"
            >
              {overview.eligibleCount > 0
                ? overview.eligibleCount === 1
                  ? "Prolonger le contrat"
                  : `Prolonger les ${overview.eligibleCount} contrats`
                : "Contrats à jour"}
            </TransferSubmitButton>
          </form>
        </div>
      </div>

      {overview.riders.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left">
            <thead className="bg-white">
              <tr className="border-b border-[#315B3E]/12 text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">
                <th className="px-5 py-3 sm:px-8">Coureur</th>
                <th className="px-4 py-3">Échéance actuelle</th>
                <th className="px-4 py-3 text-right">Salaire actuel</th>
                <th className="px-4 py-3">Saison suivante</th>
                <th className="px-5 py-3 text-right sm:px-8">Décision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#315B3E]/10">
              {overview.riders.map((rider) => (
                <ContractRiderRow
                  key={rider.id}
                  rider={rider}
                  jersey={jerseyByRiderId?.get(rider.id) ?? jersey}
                  nextSeasonName={overview.nextSeasonName}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-6 py-14 text-center">
          <p className="text-lg font-black text-[#183F37]">
            Aucun coureur sous contrat actif
          </p>
          <p className="mt-2 text-sm font-semibold text-[#60756E]">
            Les décisions contractuelles apparaîtront dès qu’un coureur
            rejoindra l’équipe.
          </p>
        </div>
      )}
    </section>
  );
}

function ContractRiderRow({
  rider,
  jersey,
  nextSeasonName,
}: {
  rider: TeamContractManagementRider;
  jersey: RiderJerseyAppearance;
  nextSeasonName: string;
}) {
  const status = getContractStatusPresentation(rider.status);

  return (
    <tr className="bg-white transition hover:bg-[#F7FBF9]">
      <td className="px-5 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <RiderAvatar
            profileKey={rider.avatarProfileKey}
            seed={rider.avatarSeed}
            riderId={rider.id}
            age={rider.age}
            jersey={jersey}
            label={`Portrait de ${rider.firstName} ${rider.lastName}`}
            className="h-11 w-11 shrink-0"
          />
          <div className="min-w-0">
            <Link
              href={`/jeu/coureurs/${rider.id}`}
              className="block truncate text-sm font-black text-[#183F37] transition hover:text-[#176951]"
            >
              {rider.firstName} {rider.lastName}
            </Link>
            <p className="mt-1 flex items-center gap-2 text-[10px] font-bold text-[#60756E]">
              <span
                className={`fi fi-${rider.countryCode.toLowerCase()} rounded-sm`}
                role="img"
                aria-label={`Drapeau ${rider.countryName}`}
              />
              {rider.age} ans · Niveau {Math.round(rider.overall)}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <p className="text-sm font-black text-[#183F37]">
          {rider.currentContractEndSeasonName}
        </p>
        <p className="mt-1 text-[10px] font-bold text-[#789087]">
          Contrat actif
        </p>
      </td>
      <td className="px-4 py-4 text-right">
        <p className="text-sm font-black tabular-nums text-[#183F37]">
          {formatMoney(rider.currentSalary, rider.currentCurrency)}
        </p>
        <p className="mt-1 text-[10px] font-bold text-[#789087]">par saison</p>
      </td>
      <td className="px-4 py-4">
        {rider.nextSalary !== null ? (
          <>
            <p className="text-sm font-black tabular-nums text-[#183F37]">
              {formatMoney(rider.nextSalary, rider.nextCurrency)}
            </p>
            <p className="mt-1 text-[10px] font-bold text-[#789087]">
              {rider.status === "eligible"
                ? `Estimation · ${nextSeasonName}`
                : `Signé jusqu’à ${rider.nextContractEndSeasonName ?? nextSeasonName}`}
            </p>
          </>
        ) : (
          <p className="text-sm font-black text-[#8A9993]">—</p>
        )}
      </td>
      <td className="px-5 py-4 text-right sm:px-8">
        <span
          className={`inline-flex rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] ${status.className}`}
        >
          {status.label}
        </span>
        <p className="mt-2 max-w-52 text-pretty text-[10px] font-semibold leading-4 text-[#60756E] ml-auto">
          {status.detail}
        </p>
      </td>
    </tr>
  );
}

function ContractMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-24 rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-center">
      <p
        className={`text-lg font-black tabular-nums ${accent ? "text-[#F2C94C]" : "text-white"}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[8px] font-black uppercase tracking-[0.11em] text-[#BFD1C6]">
        {label}
      </p>
    </div>
  );
}

function getContractStatusPresentation(status: TeamContractRiderStatus) {
  if (status === "eligible") {
    return {
      label: "À prolonger",
      detail: "Sera inclus dans la prolongation groupée.",
      className: "border-[#D7A51E]/30 bg-[#FFF4D6] text-[#8A6516]",
    };
  }
  if (status === "renewed") {
    return {
      label: "Déjà prolongé",
      detail: "Le contrat de la saison suivante est signé.",
      className: "border-[#42B99A]/30 bg-[#DDF3E7] text-[#176951]",
    };
  }
  if (status === "covered") {
    return {
      label: "Déjà couvert",
      detail: "Le contrat actuel couvre encore la saison suivante.",
      className: "border-[#4E8FD3]/25 bg-[#E8F1FB] text-[#24578B]",
    };
  }
  return {
    label: "Départ programmé",
    detail: "Un contrat futur existe déjà dans une autre équipe.",
    className: "border-[#C94F4F]/25 bg-[#FFF0EE] text-[#8A2F2F]",
  };
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value).toLocaleString("fr-FR")} ${currency}`;
  }
}

function formatCompactMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return formatMoney(value, currency);
  }
}

function formatRiderCount(value: number) {
  return `${value} coureur${value > 1 ? "s" : ""}`;
}
