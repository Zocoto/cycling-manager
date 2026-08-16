import {
  createRiderRecruitmentAlertAction,
  createStaffRecruitmentAlertAction,
  deleteRecruitmentAlertAction,
} from "@/app/jeu/messagerie/actions";
import Link from "@/components/ui/app-link";
import {
  RIDER_ALERT_METRICS,
  describeRecruitmentAlert,
  formatPotentialStars,
  type RecruitmentAlertOverview,
} from "@/lib/game/recruitment-alerts";
import {
  STAFF_ROLES,
  STAFF_ROLE_DEFINITIONS,
  TRAINER_SPECIALTIES,
  TRAINER_SPECIALTY_LABELS,
} from "@/lib/game/staff";

const MAX_ALERTS = 12;

export function RecruitmentAlertPanel({
  overview,
  closeHref,
}: {
  overview: RecruitmentAlertOverview;
  closeHref: string;
}) {
  const limitReached = overview.alerts.length >= MAX_ALERTS;

  return (
    <section className="mt-7 rounded-[1.75rem] border border-[#176951]/18 bg-white p-5 shadow-[0_16px_45px_rgba(18,74,60,0.09)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
            Cellule recrutement
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
            Alertes du marché
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5C746E]">
            Les critères se cumulent. Dès qu’un nouveau coureur des enchères
            matinales ou un nouveau staff correspond, vous recevez un courrier
            privé avec un accès direct à sa fiche.
          </p>
        </div>
        <Link
          href={closeHref}
          className="inline-flex min-h-10 items-center rounded-xl border border-[#176951]/18 bg-[#F7FBFA] px-4 text-xs font-black text-[#48665F] transition hover:border-[#176951]/35 hover:text-[#176951]"
        >
          Fermer
        </Link>
      </div>

      <div className="mt-6 rounded-2xl border border-[#176951]/12 bg-[#F3F8F6] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-black text-[#183F37]">
            Vos alertes actives
          </h3>
          <span className="rounded-full bg-[#176951]/10 px-3 py-1 text-xs font-black text-[#176951]">
            {overview.alerts.length}/{MAX_ALERTS}
          </span>
        </div>

        {overview.alerts.length > 0 ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {overview.alerts.map((alert) => (
              <article
                key={alert.id}
                className="flex items-start gap-3 rounded-xl border border-[#176951]/12 bg-white p-4"
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#176951] text-sm font-black text-white"
                >
                  {alert.type === "rider" ? "C" : "S"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-[#183F37]">
                    {alert.type === "rider" ? "Coureur" : "Staff"}
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[#60756E]">
                    {describeRecruitmentAlert(alert)}
                  </p>
                </div>
                <form action={deleteRecruitmentAlertAction}>
                  <input type="hidden" name="alertId" value={alert.id} />
                  <button
                    type="submit"
                    aria-label={`Supprimer l’alerte ${alert.type === "rider" ? "coureur" : "staff"}`}
                    title="Supprimer cette alerte"
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#C94F4F]/18 text-sm font-black text-[#A63F3F] transition hover:bg-[#FFF0EE]"
                  >
                    ×
                  </button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm font-semibold text-[#60756E]">
            Aucune alerte enregistrée pour le moment.
          </p>
        )}
      </div>

      {limitReached ? (
        <p className="mt-5 rounded-xl border border-[#D39B12]/25 bg-[#FFF9DF] px-4 py-3 text-sm font-bold text-[#705B00]">
          La limite de {MAX_ALERTS} alertes est atteinte. Supprimez-en une pour
          créer une nouvelle recherche.
        </p>
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <AlertFormCard
            eyebrow="Enchères quotidiennes"
            title="Alerte coureur"
            detail="Le seuil porte soit sur le niveau général, soit sur une statistique précise. Nationalité et talent potentiel peuvent s’y ajouter."
          >
            <form
              action={createRiderRecruitmentAlertAction}
              className="mt-5 grid gap-4 sm:grid-cols-2"
            >
              <AlertField label="Nationalité">
                <select name="countryId" className={inputClassName}>
                  <option value="">Toutes</option>
                  {overview.countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </AlertField>
              <AlertField label="Niveau ciblé">
                <select name="metric" defaultValue="overall" className={inputClassName}>
                  {RIDER_ALERT_METRICS.map((metric) => (
                    <option key={metric.key} value={metric.key}>
                      {metric.label}
                    </option>
                  ))}
                </select>
              </AlertField>
              <AlertField label="Seuil minimum">
                <input
                  name="minimumRating"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Ex. 62"
                  className={inputClassName}
                />
              </AlertField>
              <AlertField label="Talent potentiel minimum">
                <select name="minimumPotentialSteps" className={inputClassName}>
                  <option value="">Tous</option>
                  {Array.from({ length: 8 }, (_, index) => index + 1).map(
                    (steps) => (
                      <option key={steps} value={steps}>
                        {formatPotentialStars(steps)} ou plus
                      </option>
                    ),
                  )}
                </select>
              </AlertField>
              <FormFooter label="Créer l’alerte coureur" />
            </form>
          </AlertFormCard>

          <AlertFormCard
            eyebrow="Marché du staff"
            title="Alerte staff"
            detail="Le métier, les étoiles, la nationalité et la spécialité d’entraîneur se combinent librement."
          >
            <form
              action={createStaffRecruitmentAlertAction}
              className="mt-5 grid gap-4 sm:grid-cols-2"
            >
              <AlertField label="Métier">
                <select name="staffRole" className={inputClassName}>
                  <option value="">Tous</option>
                  {STAFF_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {STAFF_ROLE_DEFINITIONS[role].label}
                    </option>
                  ))}
                </select>
              </AlertField>
              <AlertField label="Étoiles minimum">
                <select name="minimumStaffLevel" className={inputClassName}>
                  <option value="">Tous les niveaux</option>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <option key={level} value={level}>
                      {level} étoile{level > 1 ? "s" : ""} ou plus
                    </option>
                  ))}
                </select>
              </AlertField>
              <AlertField label="Nationalité">
                <select name="countryId" className={inputClassName}>
                  <option value="">Toutes</option>
                  {overview.countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </AlertField>
              <AlertField label="Spécialité entraîneur">
                <select name="trainerSpecialty" className={inputClassName}>
                  <option value="">Toutes</option>
                  {TRAINER_SPECIALTIES.map((specialty) => (
                    <option key={specialty} value={specialty}>
                      {TRAINER_SPECIALTY_LABELS[specialty]}
                    </option>
                  ))}
                </select>
              </AlertField>
              <FormFooter label="Créer l’alerte staff" />
            </form>
          </AlertFormCard>
        </div>
      )}
    </section>
  );
}

function AlertFormCard({
  eyebrow,
  title,
  detail,
  children,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-[#176951]/14 bg-[#FBFDFC] p-5 sm:p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-xl font-black text-[#183F37]">{title}</h3>
      <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">
        {detail}
      </p>
      {children}
    </article>
  );
}

function AlertField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-[10px] font-black uppercase tracking-wider text-[#48665F]">
      {label}
      {children}
    </label>
  );
}

function FormFooter({ label }: { label: string }) {
  return (
    <div className="sm:col-span-2">
      <p className="mb-3 text-[11px] font-semibold leading-5 text-[#78947D]">
        Renseignez au moins un critère. Les champs laissés vides ne limitent pas
        la recherche.
      </p>
      <button
        type="submit"
        className="inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-[#176951] px-5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-[#176951]/15 transition hover:-translate-y-0.5 hover:bg-[#0F5641]"
      >
        {label}
      </button>
    </div>
  );
}

const inputClassName =
  "mt-2 min-h-11 w-full rounded-xl border border-[#176951]/18 bg-white px-3 text-sm font-bold normal-case tracking-normal text-[#183F37] outline-none transition focus:border-[#278B70] focus:ring-2 focus:ring-[#278B70]/10";
