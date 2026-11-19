"use client";

import Image from "next/image";
import { useActionState, useState } from "react";

import { publishMediaCenterArticleAction } from "@/app/jeu/gazette/actions";
import Link from "@/components/ui/app-link";
import type { TeamMediaCenterOverview } from "@/services/team-media-center";
import { useLocale } from "@/components/i18n/locale-provider";
import {
  getMediaCenterArticlePlainText,
  MEDIA_CENTER_MAX_BODY_LENGTH,
  MEDIA_CENTER_MIN_BODY_LENGTH,
  type MediaCenterArticleActionState,
} from "@/lib/game/media-center-article";
import { MediaCenterArticleEditor, type MediaCenterDraftBlock } from "./media-center-article-editor";
import { MediaCenterArticleContent } from "./media-center-article-content";

export function MediaCenterComposer({
  overview,
  success,
  updated = false,
  errorMessage,
}: {
  overview: TeamMediaCenterOverview;
  success: boolean;
  updated?: boolean;
  errorMessage: string | null;
}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const [state, action, pending] = useActionState<MediaCenterArticleActionState, FormData>(
    publishMediaCenterArticleAction,
    { error: null },
  );
  const [title, setTitle] = useState("");
  const [includeSponsor, setIncludeSponsor] = useState(false);
  const [draft, setDraft] = useState<MediaCenterDraftBlock[]>([
    { id: 0, block: { type: "text", font: "default", content: [] } },
  ]);
  const [uploading, setUploading] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const latestArticle = overview.recentArticles[0];

  function editLatestArticle() {
    if (!latestArticle || latestArticle.status !== "queued") return;
    setEditingArticleId(latestArticle.id);
    setTitle(latestArticle.title);
    setIncludeSponsor(Boolean(latestArticle.sponsorName));
    setDraft((latestArticle.blocks?.length ? latestArticle.blocks : [{
      type: "text" as const,
      font: "default" as const,
      content: [{ text: latestArticle.body }],
    }]).map((block, id) => ({ id, block })));
  }
  const blocks = draft.map(({ block }) => block).filter((block) =>
    block.type === "image" || block.content.some(({ text }) => text.trim()),
  );
  const bodyLength = getMediaCenterArticlePlainText(blocks).length;
  const canSend = !pending && !uploading && title.trim().length >= 5
    && bodyLength >= MEDIA_CENTER_MIN_BODY_LENGTH && bodyLength <= MEDIA_CENTER_MAX_BODY_LENGTH;
  const formError = state.error ?? errorMessage;
  return (
    <section className="mx-auto mb-5 max-w-[1380px] overflow-hidden rounded-[1.7rem] border border-[#315B3E]/15 bg-[#F8FBF9] shadow-[0_16px_44px_rgba(36,31,24,.12)]">
      <div className="grid lg:grid-cols-[320px_1fr]">
        <div className="relative min-h-52 overflow-hidden bg-[#071A17]">
          <Image
            src="/images/infrastructure/media-center.webp"
            alt={isEnglish ? "Media Center newsroom" : "Salle de rédaction du Média Center"}
            fill
            sizes="320px"
            className="object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071A17] via-transparent to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#9BE0BC]">
              {isEnglish ? "Level" : "Infrastructure niveau"} {overview.buildingLevel}{isEnglish ? " infrastructure" : ""}
            </p>
            <h2 className="mt-1 text-2xl font-black">Média Center</h2>
            <p className="mt-2 text-xs font-semibold text-[#D6DFD2]">
              {isEnglish
                ? "An SD column published in the next Cyclogazette."
                : "Une tribune de DS publiée dans la prochaine Cyclogazette."}
            </p>
          </div>
        </div>
        <div className="p-6 sm:p-8">
          {success ? (
            <Alert tone="success">
              {updated
                ? isEnglish ? "Changes saved. Your article is awaiting publication." : "Modifications enregistrées. Votre article attend le bouclage."
                : overview.hasFanClub
                ? isEnglish
                  ? "Column sent to the newsroom. Reputation, popularity and new supporters have been credited."
                  : "Tribune transmise à la rédaction. Réputation, popularité et nouveaux supporters ont été crédités."
                : isEnglish
                  ? "Column sent to the newsroom. Reputation and rider popularity have been credited. New supporters require a Fan Club headquarters."
                  : "Tribune transmise à la rédaction. Réputation et popularité des coureurs ont été créditées. Les nouveaux supporters nécessitent un Siège du Fan Club."}
            </Alert>
          ) : null}
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          {overview.buildingLevel < 1 ? (
            <div>
              <h3 className="text-2xl font-black text-[#183F37]">
                {isEnglish ? "Have your say in the Gazette" : "Prenez la parole dans la Gazette"}
              </h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#60756E]">
                {isEnglish
                  ? "Build the Media Center to write columns, strengthen community-manager work and grow the whole team's popularity."
                  : "Construisez le Média Center pour rédiger des tribunes, renforcer le travail des community managers et faire progresser la popularité de toute l’équipe."}
              </p>
              <Link
                href="/jeu/infrastructures"
                className="mt-5 inline-flex rounded-xl bg-[#176951] px-5 py-3 text-sm font-black text-white"
              >
                {isEnglish ? "Build the Media Center" : "Construire le Média Center"}
              </Link>
            </div>
          ) : overview.canSubmit || editingArticleId ? (
            <form action={action} onSubmit={(event) => { if (!canSend) event.preventDefault(); }}>
              <input type="hidden" name="articleId" value={editingArticleId ?? ""} />
              <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.16em] text-[#278B70]">
                    {isEnglish ? "Column by" : "Tribune de"} {overview.teamName}
                  </p>
                  <h3 className="mt-1 text-2xl font-black text-[#183F37]">
                    {editingArticleId
                      ? isEnglish ? "Edit your article" : "Modifier votre article"
                      : isEnglish ? "Submit an article" : "Proposer un article"}
                  </h3>
                </div>
                <span className="rounded-full bg-[#EAF5F3] px-3 py-2 text-xs font-black text-[#176951]">
                  {isEnglish ? `1 every ${overview.publicationIntervalDays} days` : `1 tous les ${overview.publicationIntervalDays} jours`}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-[#60756E]">
                {isEnglish
                  ? "Your team earns €1,000 for each reader who reacts to your article."
                  : "Chaque lecteur qui réagit à votre article rapporte 1 000 € à votre équipe."}
              </p>
              <input
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={pending}
                required
                minLength={5}
                maxLength={100}
                aria-label={isEnglish ? "Your column title" : "Titre de votre tribune"}
                placeholder={isEnglish ? "Your column title" : "Titre de votre tribune"}
                className="mt-5 w-full rounded-xl border border-[#315B3E]/20 bg-white px-4 py-3 text-sm font-bold"
              />
              <MediaCenterArticleEditor
                key={editingArticleId ?? "new"}
                draft={draft}
                setDraft={setDraft}
                title={title}
                isEnglish={isEnglish}
                bodyLength={bodyLength}
                bodyMinimum={MEDIA_CENTER_MIN_BODY_LENGTH}
                bodyMaximum={MEDIA_CENTER_MAX_BODY_LENGTH}
                disabled={pending}
                onUploadingChange={setUploading}
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                {overview.canIncludeSponsor ? (
                  <label className="flex items-center gap-2 text-xs font-bold text-[#60756E]">
                    <input
                      type="checkbox"
                      name="includeSponsor"
                      checked={includeSponsor}
                      onChange={(event) => setIncludeSponsor(event.target.checked)}
                      disabled={pending}
                      className="h-4 w-4 accent-[#176951]"
                    />
                    {isEnglish ? "Add a feature for" : "Ajouter un encart pour"} {overview.sponsorName}
                  </label>
                ) : (
                  <span className="text-xs font-semibold text-[#82918C]">
                    {isEnglish ? "Sponsor features unlock at level 3." : "Les encarts sponsor se débloquent au niveau 3."}
                  </span>
                )}
                <button type="submit" disabled={!canSend} className="rounded-xl bg-[#176951] px-5 py-3 text-sm font-black text-white hover:bg-[#0B302B] disabled:cursor-not-allowed disabled:opacity-50">
                  {pending
                    ? isEnglish ? "Sending…" : "Envoi en cours…"
                    : editingArticleId
                      ? isEnglish ? "Save changes" : "Enregistrer les modifications"
                      : isEnglish ? "Send to the newsroom" : "Envoyer à la rédaction"}
                </button>
                {editingArticleId ? (
                  <button type="button" disabled={pending || uploading} onClick={() => setEditingArticleId(null)} className="rounded-xl border border-[#315B3E]/20 px-5 py-3 text-sm font-bold text-[#176951]">
                    {isEnglish ? "Cancel" : "Annuler"}
                  </button>
                ) : null}
              </div>
              {!overview.hasFanClub ? (
                <p className="mt-4 rounded-xl border border-[#E2A63B]/35 bg-[#FFF9E8] px-4 py-3 text-xs font-bold leading-5 text-[#6D5A27]">
                  {isEnglish
                    ? "Build the Fan Club headquarters to turn these publications into new supporters."
                    : "Construisez le Siège du Fan Club pour que ces publications rapportent aussi de nouveaux supporters."}
                </p>
              ) : null}
            </form>
          ) : (
            <div>
              <h3 className="text-2xl font-black text-[#183F37]">
                {isEnglish ? "The newsroom is working on your latest column" : "La rédaction travaille sur votre dernière tribune"}
              </h3>
              <p className="mt-3 text-sm font-semibold text-[#60756E]">
                {isEnglish ? "You can submit again in" : "Nouvelle proposition possible dans"}{" "}
                {overview.nextSubmissionInDays} {isEnglish ? "day(s)." : "jour(s)."}
              </p>
            </div>
          )}
          {latestArticle && !editingArticleId ? (
            <details key={latestArticle.id} open={success || undefined} className="mt-5 rounded-xl border border-[#315B3E]/20 bg-white p-4 text-[#183F37]">
              <summary className="cursor-pointer font-bold">
                {isEnglish ? "Preview your latest article" : "Aperçu de votre dernier article"} · {latestArticle.status === "queued"
                  ? isEnglish ? "Awaiting publication" : "En attente de publication"
                  : isEnglish ? "Published" : "Publié"}
              </summary>
              <article className="mt-4">
                <p className="text-xs font-bold uppercase text-[#176951]">{isEnglish ? "Guest column" : "Carte blanche"} · {overview.teamName}</p>
                <h3 className="mt-2 font-serif text-2xl font-black [overflow-wrap:anywhere]">{latestArticle.title}</h3>
                <MediaCenterArticleContent blocks={latestArticle.blocks ?? undefined} body={latestArticle.body} className="mt-4 text-sm leading-6" />
              </article>
              {latestArticle.status === "queued" ? (
                <button type="button" onClick={editLatestArticle} className="mt-4 min-h-11 rounded-xl bg-[#176951] px-5 py-3 text-sm font-bold text-white">
                  {isEnglish ? "Edit before publication" : "Modifier avant publication"}
                </button>
              ) : null}
            </details>
          ) : null}
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
      role={tone === "error" ? "alert" : "status"}
      className={`mb-4 rounded-xl border px-4 py-3 text-sm font-bold ${tone === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-900"}`}
    >
      {children}
    </div>
  );
}
