import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { ReferralShareControls } from "@/components/game/referral-share-controls";
import {
  getNextReferralMilestone,
  getReferralProgressPercent,
} from "@/lib/game/referrals";
import { getPublicSiteUrl } from "@/lib/auth/public-site-url";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getCurrentReferralOverview } from "@/services/referrals";

export const metadata: Metadata = {
  title: "Parrainage",
  description: "Invitez de nouveaux Directeurs Sportifs et gagnez des objets rares.",
};

export default async function ReferralPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");

  const [headerData, overview] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getCurrentReferralOverview(supabase, getPublicSiteUrl() ?? ""),
  ]);

  if (!overview) redirect("/jeu");

  const nextMilestone = getNextReferralMilestone(
    overview.milestones,
    overview.qualifiedCount,
  );
  const progress = getReferralProgressPercent(
    overview.qualifiedCount,
    nextMilestone,
  );

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <BackToOfficeLink />

        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17_0%,#0B302B_54%,#176951_100%)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.24)] sm:px-10 sm:py-10">
          <div aria-hidden="true" className="absolute -right-16 -top-28 h-96 w-96 rounded-full border-[64px] border-white/5" />
          <div aria-hidden="true" className="absolute bottom-0 left-0 h-1 w-full bg-linear-to-r from-[#42B99A] via-[#F2C94C] to-[#42B99A]" />

          <div className="relative max-w-5xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">
              Programme ambassadeur
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Invitez des DS. Gagnez des objets rares.
            </h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2] sm:text-base">
              Partagez votre lien personnel. Dès qu’un filleul confirme son inscription, il compte dans votre progression et rapproche votre équipe d’objets de niveau 6 à 10, de primes de carrière et d’accessoires exclusifs.
            </p>

            <ReferralShareControls inviteUrl={overview.inviteUrl} code={overview.code} />
          </div>
        </header>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(310px,0.55fr)]">
          <article className="rounded-2xl border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.09)] sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">Progression</p>
                <h2 className="mt-2 text-2xl font-black">{overview.qualifiedCount} filleul{overview.qualifiedCount === 1 ? "" : "s"} qualifié{overview.qualifiedCount === 1 ? "" : "s"}</h2>
                <p className="mt-2 text-sm leading-6 text-[#60756E]">
                  {overview.registeredCount - overview.qualifiedCount > 0
                    ? `${overview.registeredCount - overview.qualifiedCount} inscription(s) sont en cours de validation.`
                    : "Chaque nouvelle inscription apparaîtra ici immédiatement."}
                </p>
              </div>
              {nextMilestone ? (
                <div className="rounded-xl bg-[#FFF7D6] px-4 py-3 text-sm text-[#493B0B]">
                  <span className="block text-xs font-extrabold uppercase tracking-wide">Prochain gain</span>
                  <span className="mt-1 block font-black">{nextMilestone.rewardName} · {nextMilestone.count} filleuls</span>
                </div>
              ) : (
                <div className="rounded-xl bg-[#DFF4EC] px-4 py-3 text-sm font-black text-[#176951]">Tous les paliers sont débloqués</div>
              )}
            </div>

            <div className="mt-6 h-3 overflow-hidden rounded-full bg-[#DCE9E4]">
              <div className="h-full rounded-full bg-linear-to-r from-[#278B70] to-[#F2C94C] transition-[width]" style={{ width: `${progress}%` }} />
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {overview.milestones.map((milestone) => (
                <div
                  key={milestone.count}
                  className={[
                    "relative overflow-hidden rounded-xl border p-4",
                    milestone.granted
                      ? "border-[#42B99A]/50 bg-[#E8F8F2]"
                      : "border-[#315B3E]/12 bg-[#F8FBF9]",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xl font-black text-[#176951]">{milestone.count}</span>
                    <span className="rounded-full bg-[#071A17] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#F2C94C]">Niv. {milestone.rewardLevel}</span>
                  </div>
                  <p className="mt-3 text-sm font-black text-[#183F37]">{milestone.rewardName}</p>
                  <p className="mt-1 text-xs leading-5 text-[#60756E]">{milestone.rewardSummary}</p>
                  <p className="mt-3 text-[11px] font-extrabold uppercase tracking-wide text-[#278B70]">
                    {milestone.granted ? "Débloqué ✓" : `${milestone.count} filleul${milestone.count === 1 ? "" : "s"}`}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-[#D6AE3B]/35 bg-[linear-gradient(135deg,#FFF9E7,#F7F0D2)] p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#80640C]">Primes de carrière renforcées</p>
                  <h3 className="mt-1 text-lg font-black text-[#2E290D]">Du vrai carburant pour bâtir une équipe</h3>
                </div>
                <span className="text-xs font-bold text-[#80640C]">À récupérer dans Objectifs</span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <ReferralCareerBonus count="1" cash="75 000 €" xp="120 XP" reputation="5 réputation" />
                <ReferralCareerBonus count="5" cash="350 000 €" xp="600 XP" reputation="25 réputation" />
                <ReferralCareerBonus count="25" cash="2 000 000 €" xp="2 500 XP" reputation="100 réputation + 1 talent" />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/jeu/objectifs?onglet=quotidiennes" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#278B70]/25 bg-white px-4 text-sm font-extrabold text-[#176951] transition hover:border-[#278B70] hover:bg-[#DFF4EC]">
                Utiliser mes objets dans l’inventaire
              </Link>
              <Link href="/jeu/objectifs?type=secondary&groupe=referrals#objectives-list" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#176951] px-4 text-sm font-extrabold text-white transition hover:bg-[#0E5141]">
                Récupérer mes primes
              </Link>
            </div>
          </article>

          <aside className="rounded-2xl bg-[#0B302B] p-6 text-white shadow-[0_16px_45px_rgba(19,60,46,0.16)] sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#9BE0BC]">Trophée spécial</p>
            <h2 className="mt-2 text-2xl font-black">Les attributs du Parrain</h2>
            <div className="mt-5 grid h-28 place-items-center rounded-2xl border border-white/10 bg-black/20">
              <PatronOutfitIcon
                unlocked={overview.patronOutfitUnlocked}
                showHat={overview.patronHatUnlocked}
              />
            </div>
            <p className="mt-5 text-sm leading-6 text-[#D6DFD2]">
              À 5 filleuls, la tenue de cérémonie noire rejoint votre profil. À 25, le Don du peloton reçoit son fedora noir à ruban bordeaux, inspiré du Chicago des années 1920.
            </p>
            <p className="mt-4 rounded-xl bg-white/8 px-4 py-3 text-sm font-extrabold text-[#F2C94C]">
              {overview.patronHatUnlocked
                ? "Tenue et fedora débloqués — équipez-les dans votre profil"
                : overview.patronOutfitUnlocked
                  ? `${Math.max(0, 25 - overview.qualifiedCount)} filleul(s) avant le fedora du Don`
                  : `${Math.max(0, 5 - overview.qualifiedCount)} filleul(s) avant la tenue`}
            </p>
          </aside>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-8">
            <h2 className="text-2xl font-black">Vos filleuls</h2>
            {overview.referrals.length ? (
              <ul className="mt-5 divide-y divide-[#315B3E]/10">
                {overview.referrals.map((referral) => (
                  <li key={referral.id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                    <div>
                      <p className="font-extrabold text-[#183F37]">{referral.displayName}</p>
                      <p className="mt-1 text-xs text-[#60756E]">Inscrit le {formatDate(referral.registeredAt)}</p>
                    </div>
                    <span className={referral.status === "qualified" ? "rounded-full bg-[#DFF4EC] px-3 py-1.5 text-xs font-extrabold text-[#176951]" : "rounded-full bg-[#FFF7D6] px-3 py-1.5 text-xs font-extrabold text-[#80640C]"}>
                      {referral.status === "qualified" ? "Qualifié ✓" : "Validation en cours"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-[#315B3E]/25 bg-[#F8FBF9] px-5 py-8 text-center">
                <p className="font-extrabold text-[#183F37]">Votre cercle est encore vide</p>
                <p className="mt-2 text-sm leading-6 text-[#60756E]">Copiez votre lien et envoyez-le à un ami qui aime le cyclisme ou les jeux de gestion.</p>
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-8">
            <h2 className="text-2xl font-black">Comment ça marche ?</h2>
            <ol className="mt-5 space-y-4">
              <RuleStep number="1" title="Partagez votre URL" text="Le code personnel contenu dans le lien vous attribue automatiquement le nouveau DS." />
              <RuleStep number="2" title="Le filleul confirme son inscription" text="Son parrainage est qualifié immédiatement après confirmation, sans passage obligatoire par le didacticiel." />
              <RuleStep number="3" title="Le palier se déclenche" text="Chaque nouveau compte attribué fait progresser instantanément votre cercle de parrainage." />
              <RuleStep number="4" title="Les gains sont versés" text="Chaque palier n’est versé qu’une fois et l’auto-parrainage est impossible." />
            </ol>
          </article>
        </section>
      </section>
    </main>
  );
}

function RuleStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <li className="flex gap-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#176951] text-sm font-black text-white">{number}</span>
      <div><p className="font-extrabold text-[#183F37]">{title}</p><p className="mt-1 text-sm leading-6 text-[#60756E]">{text}</p></div>
    </li>
  );
}

function ReferralCareerBonus({
  count,
  cash,
  xp,
  reputation,
}: {
  count: string;
  cash: string;
  xp: string;
  reputation: string;
}) {
  return (
    <div className="rounded-xl border border-[#D6AE3B]/25 bg-white/70 px-4 py-3">
      <p className="text-xs font-black uppercase tracking-wide text-[#80640C]">{count} filleul{count === "1" ? "" : "s"}</p>
      <p className="mt-1 text-base font-black text-[#183F37]">{cash}</p>
      <p className="mt-1 text-xs font-bold leading-5 text-[#60756E]">{xp} · {reputation}</p>
    </div>
  );
}

function PatronOutfitIcon({
  unlocked,
  showHat,
}: {
  unlocked: boolean;
  showHat: boolean;
}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 90" className={unlocked ? "h-24 w-32" : "h-24 w-32 opacity-45 grayscale"}>
      <path d="M16 90C18 55 34 39 60 39C86 39 102 55 104 90Z" fill="#171514" />
      <path d="M42 45L60 72L78 45L68 39H52Z" fill="#FFFDF4" />
      <path d="M45 42L59 69L35 54Z" fill="#282522" />
      <path d="M75 42L61 69L85 54Z" fill="#282522" />
      <path d="M56 50H64L62 68H58Z" fill="#171514" />
      <circle cx="82" cy="55" r="4" fill="#A61B32" />
      {showHat ? (
        <>
          <path d="M31 35C38 30 46 28 60 28C74 28 82 30 89 35C80 39 71 40 60 40C49 40 40 39 31 35Z" fill="#11100F" stroke="#49433E" strokeWidth="1.5" />
          <path d="M42 32L46 15C51 9 69 9 74 15L78 32C68 35 52 35 42 32Z" fill="#1B1917" stroke="#49433E" strokeWidth="1.5" />
          <path d="M43 27C53 30 68 30 77 27L78 32C68 35 52 35 42 32Z" fill="#8F1730" />
        </>
      ) : null}
      {!unlocked ? <><rect x="47" y="59" width="26" height="22" rx="5" fill="#071A17" /><path d="M52 59v-7a8 8 0 0 1 16 0v7" fill="none" stroke="#F2C94C" strokeWidth="4" /></> : null}
    </svg>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "date inconnue"
    : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}
