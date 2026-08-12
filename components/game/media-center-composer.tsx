import Image from "next/image";

import { publishMediaCenterArticleAction } from "@/app/jeu/gazette/actions";
import Link from "@/components/ui/app-link";
import type { TeamMediaCenterOverview } from "@/services/team-media-center";

export function MediaCenterComposer({
  overview,
  success,
  errorMessage,
}: {
  overview: TeamMediaCenterOverview;
  success: boolean;
  errorMessage: string | null;
}) {
  return (
    <section className="mx-auto mb-5 max-w-[1380px] overflow-hidden rounded-[1.7rem] border border-[#315B3E]/15 bg-[#F8FBF9] shadow-[0_16px_44px_rgba(36,31,24,.12)]">
      <div className="grid lg:grid-cols-[320px_1fr]">
        <div className="relative min-h-52 overflow-hidden bg-[#071A17]">
          <Image
            src="/images/infrastructure/media-center.webp"
            alt="Salle de rédaction du Média Center"
            fill
            sizes="320px"
            className="object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071A17] via-transparent to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#9BE0BC]">
              Infrastructure niveau {overview.buildingLevel}
            </p>
            <h2 className="mt-1 text-2xl font-black">Média Center</h2>
            <p className="mt-2 text-xs font-semibold text-[#D6DFD2]">
              Une tribune de DS publiée dans la prochaine Cyclogazette.
            </p>
          </div>
        </div>
        <div className="p-6 sm:p-8">
          {success ? (
            <Alert tone="success">
              Tribune transmise à la rédaction. Réputation, popularité et
              nouveaux supporters ont été crédités.
            </Alert>
          ) : null}
          {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}
          {overview.buildingLevel < 1 ? (
            <div>
              <h3 className="text-2xl font-black text-[#183F37]">
                Prenez la parole dans la Gazette
              </h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#60756E]">
                Construisez le Média Center pour rédiger des tribunes, renforcer
                le travail des community managers et faire progresser la
                popularité de toute l’équipe.
              </p>
              <Link
                href="/jeu/infrastructures"
                className="mt-5 inline-flex rounded-xl bg-[#176951] px-5 py-3 text-sm font-black text-white"
              >
                Construire le Média Center
              </Link>
            </div>
          ) : overview.canSubmit ? (
            <form action={publishMediaCenterArticleAction}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.16em] text-[#278B70]">
                    Tribune de {overview.teamName}
                  </p>
                  <h3 className="mt-1 text-2xl font-black text-[#183F37]">
                    Proposer un article
                  </h3>
                </div>
                <span className="rounded-full bg-[#EAF5F3] px-3 py-2 text-xs font-black text-[#176951]">
                  1 tous les {overview.publicationIntervalDays} jours
                </span>
              </div>
              <input
                name="title"
                required
                minLength={5}
                maxLength={100}
                placeholder="Titre de votre tribune"
                className="mt-5 w-full rounded-xl border border-[#315B3E]/20 bg-white px-4 py-3 text-sm font-bold"
              />
              <textarea
                name="body"
                required
                minLength={40}
                maxLength={1600}
                rows={5}
                placeholder="Votre analyse, votre projet d’équipe ou votre regard sur le peloton…"
                className="mt-3 w-full resize-y rounded-xl border border-[#315B3E]/20 bg-white px-4 py-3 text-sm font-semibold leading-6"
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                {overview.canIncludeSponsor ? (
                  <label className="flex items-center gap-2 text-xs font-bold text-[#60756E]">
                    <input
                      type="checkbox"
                      name="includeSponsor"
                      className="h-4 w-4 accent-[#176951]"
                    />
                    Ajouter un encart pour {overview.sponsorName}
                  </label>
                ) : (
                  <span className="text-xs font-semibold text-[#82918C]">
                    Les encarts sponsor se débloquent au niveau 3.
                  </span>
                )}
                <button className="rounded-xl bg-[#176951] px-5 py-3 text-sm font-black text-white hover:bg-[#0B302B]">
                  Envoyer à la rédaction
                </button>
              </div>
            </form>
          ) : (
            <div>
              <h3 className="text-2xl font-black text-[#183F37]">
                La rédaction travaille sur votre dernière tribune
              </h3>
              <p className="mt-3 text-sm font-semibold text-[#60756E]">
                Nouvelle proposition possible dans{" "}
                {overview.nextSubmissionInDays} jour(s).
              </p>
              {overview.recentArticles[0] ? (
                <p className="mt-4 rounded-xl bg-[#EAF5F3] p-4 text-sm font-black text-[#176951]">
                  « {overview.recentArticles[0].title} » ·{" "}
                  {overview.recentArticles[0].status === "published"
                    ? "publiée"
                    : "en attente du bouclage"}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Alert({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mb-4 rounded-xl border px-4 py-3 text-sm font-bold ${tone === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-900"}`}
    >
      {children}
    </div>
  );
}
