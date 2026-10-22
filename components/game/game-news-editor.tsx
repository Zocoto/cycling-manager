"use client";

import { useActionState, useId, useRef, useState } from "react";
import Image from "next/image";
import {
  EMPTY_GAME_NEWS_DOCUMENT,
  GAME_NEWS_EMOJIS,
  type GameNewsDocument,
  type GameNewsEditorArticle,
  type GameNewsEditorState,
} from "@/lib/game/game-product-news";
import { GameNewsBody } from "./game-news-body";
import { GameNewsIllustrationPicker } from "./game-news-illustration-picker";
import { GAME_NEWS_IMAGE_PREFIX } from "@/lib/game/game-news-images";

export type GameNewsEditorAction = (
  previous: GameNewsEditorState,
  formData: FormData,
) => Promise<GameNewsEditorState>;

export function preserveSavedNewsArticle(previous: GameNewsEditorState, next: GameNewsEditorState): GameNewsEditorState {
  return {
    ...next,
    article: next.article ?? previous.article,
  };
}

const fieldClass = "mt-1.5 w-full min-w-0 rounded-xl border border-[#D8E3DE] bg-white px-3 py-2.5 text-sm font-medium text-[#183F37] outline-none transition focus:border-[#B67A44] focus:ring-2 focus:ring-[#B67A44]/15 disabled:opacity-60";
const toolbarClass = "rounded-lg border border-[#D8E3DE] bg-white px-2.5 py-1.5 text-xs font-bold text-[#315B3E] transition hover:border-[#B67A44] hover:bg-[#FFF8EE] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B67A44] disabled:opacity-50";

/** Inserts text without discarding the user's current selection or draft. */
export function insertGameNewsFormatting(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
  suffix = "",
  placeholder = "",
) {
  const start = Math.max(0, Math.min(value.length, selectionStart));
  const end = Math.max(start, Math.min(value.length, selectionEnd));
  const selected = value.slice(start, end) || placeholder;
  const insertion = `${prefix}${selected}${suffix}`;
  return {
    value: value.slice(0, start) + insertion + value.slice(end),
    selectionStart: start + prefix.length,
    selectionEnd: start + prefix.length + selected.length,
  };
}

export function GameNewsEditor({
  initialArticle,
  newDraftId,
  action,
}: {
  initialArticle: GameNewsEditorArticle | null;
  newDraftId?: string;
  action: GameNewsEditorAction;
}) {
  const [draft, setDraft] = useState<GameNewsDocument>(initialArticle?.draft ?? EMPTY_GAME_NEWS_DOCUMENT);
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [showPreview, setShowPreview] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [state, formAction, pending] = useActionState<GameNewsEditorState, FormData>(async (previous, formData) => preserveSavedNewsArticle(previous, await action(previous, formData)), {
    status: "idle",
    message: null,
    article: initialArticle ?? undefined,
  });
  const editorId = useId();
  const frenchBody = useRef<HTMLTextAreaElement>(null);
  const englishBody = useRef<HTMLTextAreaElement>(null);
  const [newDraftIdValue] = useState(newDraftId);
  const article = state.article ?? initialArticle;
  const activeTitle = language === "fr" ? draft.title : draft.title_en;
  const activeSummary = language === "fr" ? draft.summary : draft.summary_en;
  const activeBody = language === "fr" ? draft.body : draft.body_en;

  function update(field: keyof GameNewsDocument, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }));
  }

  function insert(prefix: string, suffix = "", placeholder = "") {
    const area = language === "fr" ? frenchBody.current : englishBody.current;
    const formatted = insertGameNewsFormatting(
      activeBody,
      area?.selectionStart ?? activeBody.length,
      area?.selectionEnd ?? activeBody.length,
      prefix,
      suffix,
      placeholder,
    );
    update(language === "fr" ? "body" : "body_en", formatted.value);
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(formatted.selectionStart, formatted.selectionEnd);
    });
  }

  return (
    <form action={formAction} onSubmit={(event) => { if (imageUploading) event.preventDefault(); }} className="min-w-0 space-y-5" data-game-news-editor="true">
      <input type="hidden" name="id" value={article?.id ?? newDraftIdValue ?? ""} />
      <input type="hidden" name="revision" value={article?.revision ?? 0} />

      <section className="rounded-2xl border border-[#D8E3DE] bg-white p-4 shadow-[0_8px_28px_rgba(19,60,46,0.04)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A66F3D]">Le carnet des nouveautés</p>
            <h2 className="mt-1 text-xl font-black text-[#183F37]">{article?.id ? "Modifier l’actualité" : "Écrire une actualité"}</h2>
          </div>
          <span className="rounded-full bg-[#EFF5F1] px-3 py-1.5 text-xs font-bold text-[#315B3E]">{article?.published ? "Actualité déjà publiée" : "Brouillon privé"}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#60756E]">
          {article?.published
            ? "Votre version publiée reste visible pendant les modifications. Seul le bouton Publier mettra à jour l’actualité pour les joueurs."
            : "Préparez votre annonce à votre rythme. Un brouillon n’apparaît ni sur l’accueil ni dans le jeu."}
        </p>

        <div className="mt-5">
          <label className="block text-xs font-bold text-[#315B3E]">Rubrique
            <input name="category" value={draft.category} onChange={(event) => update("category", event.target.value)} list={`${editorId}-categories`} maxLength={60} disabled={pending} className={fieldClass} />
            <datalist id={`${editorId}-categories`}><option value="Nouveauté" /><option value="Mise à jour" /><option value="Événement" /><option value="Communauté" /><option value="Maintenance" /></datalist>
          </label>
        </div>
        <GameNewsIllustrationPicker value={draft.image_path} alt={draft.image_alt} disabled={pending} onChange={(path) => update("image_path", path)} onBusyChange={setImageUploading} />
        <label className="mt-4 block text-xs font-bold text-[#315B3E]">Description de l’illustration · accessibilité
          <input name="image_alt" value={draft.image_alt} onChange={(event) => update("image_alt", event.target.value)} maxLength={180} disabled={pending} className={fieldClass} />
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-b border-[#E7EEE9] pb-3" role="group" aria-label="Langue de rédaction">
          <button type="button" aria-pressed={language === "fr"} onClick={() => setLanguage("fr")} className={toolbarClass}>Français · obligatoire</button>
          <button type="button" aria-pressed={language === "en"} onClick={() => setLanguage("en")} className={toolbarClass}>English · facultatif</button>
        </div>
        {language === "en" ? <p className="mt-3 text-xs leading-5 text-[#60756E]">Sans traduction anglaise complète, la version française reste disponible.</p> : null}

        {(["fr", "en"] as const).map((locale) => {
          const titleKey = locale === "fr" ? "title" : "title_en";
          const summaryKey = locale === "fr" ? "summary" : "summary_en";
          const bodyKey = locale === "fr" ? "body" : "body_en";
          return (
            <div key={locale} hidden={language !== locale} className="mt-4 space-y-4">
              <label htmlFor={`${editorId}-title-${locale}`} className="block text-xs font-bold text-[#315B3E]">Titre {locale === "en" ? "anglais" : "français"}
                <input id={`${editorId}-title-${locale}`} name={titleKey} value={draft[titleKey]} onChange={(event) => update(titleKey, event.target.value)} maxLength={160} disabled={pending} className={fieldClass} />
              </label>
              {locale === "en" ? <label className="block text-xs font-bold text-[#315B3E]">Rubrique anglaise
                <input name="category_en" value={draft.category_en} onChange={(event) => update("category_en", event.target.value)} maxLength={60} disabled={pending} className={fieldClass} />
              </label> : null}
              <label htmlFor={`${editorId}-summary-${locale}`} className="block text-xs font-bold text-[#315B3E]">Résumé pour le fil d’actualité
                <textarea id={`${editorId}-summary-${locale}`} name={summaryKey} value={draft[summaryKey]} onChange={(event) => update(summaryKey, event.target.value)} maxLength={500} rows={3} disabled={pending} className={`${fieldClass} resize-y`} />
              </label>
              <div>
                <label htmlFor={`${editorId}-body-${locale}`} className="block text-xs font-bold text-[#315B3E]">Texte de l’annonce</label>
                <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Mise en forme du texte">
                  <button type="button" disabled={pending} onClick={() => insert("**", "**", "texte en gras")} className={toolbarClass}>Gras</button>
                  <button type="button" disabled={pending} onClick={() => insert("\n\n- ", "", "Élément de liste")} className={toolbarClass}>Liste</button>
                  <button type="button" disabled={pending} onClick={() => insert("[", "](https://)", "Texte du lien")} className={toolbarClass}>Lien</button>
                  {GAME_NEWS_EMOJIS.map(({emoji, label, code}) => <button key={code} type="button" disabled={pending} title={`${label} · :${code}:`} aria-label={`Insérer ${label}`} onClick={() => insert(`${emoji} `)} className={toolbarClass}>{emoji}</button>)}
                </div>
                <textarea ref={locale === "fr" ? frenchBody : englishBody} id={`${editorId}-body-${locale}`} name={bodyKey} value={draft[bodyKey]} onChange={(event) => update(bodyKey, event.target.value)} maxLength={30000} rows={13} disabled={pending} className={`${fieldClass} resize-y leading-7`} />
                <p className="mt-2 text-[11px] leading-5 text-[#789087]">Gras, listes, liens et emojis sont pris en charge. Les raccourcis comme :tada:, :warning: et :loudspeaker: fonctionnent aussi. Aucun code HTML n’est exécuté.</p>
              </div>
            </div>
          );
        })}
        <details className="mt-5 rounded-xl border border-[#E7EEE9] p-3">
          <summary className="cursor-pointer text-xs font-bold text-[#315B3E]">Bouton de destination · facultatif</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-[#315B3E]">Destination HTTPS ou chemin du site
              <input name="link_url" value={draft.link_url} onChange={(event) => update("link_url", event.target.value)} maxLength={500} disabled={pending} placeholder="/jeu/calendrier" className={fieldClass} />
            </label>
            <label className="text-xs font-bold text-[#315B3E]">Texte du bouton
              <input name="link_label" value={draft.link_label} onChange={(event) => update("link_label", event.target.value)} maxLength={80} disabled={pending} className={fieldClass} />
            </label>
          </div>
        </details>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" aria-expanded={showPreview} aria-controls={`${editorId}-preview`} onClick={() => setShowPreview((previous) => !previous)} className="rounded-xl border border-[#C7D8CE] px-4 py-2.5 text-sm font-bold text-[#315B3E] hover:bg-[#EFF5F1]">{showPreview ? "Masquer l’aperçu" : "Prévisualiser"}</button>
        <div className="flex flex-wrap gap-2">
          <button type="submit" name="intent" value="save_draft" formNoValidate disabled={pending || imageUploading} className="rounded-xl border border-[#C7D8CE] bg-white px-4 py-2.5 text-sm font-bold text-[#315B3E] hover:bg-[#EFF5F1] disabled:opacity-50">Enregistrer le brouillon</button>
          <button type="submit" name="intent" value="publish" disabled={pending || imageUploading} className="rounded-xl bg-[#183F37] px-5 py-2.5 text-sm font-black text-white hover:bg-[#315B3E] disabled:opacity-50">{pending ? "Enregistrement…" : "Publier"}</button>
        </div>
      </div>

      {state.message ? <div role={state.status === "error" || state.status === "conflict" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm font-semibold leading-6 ${state.status === "success" ? "border-[#C6E3D5] bg-[#EFF8F3] text-[#176951]" : "border-[#F0D4B2] bg-[#FFF6E8] text-[#8A4B16]"}`}>
        <p>{state.message}</p>
        {state.status === "conflict" ? <p className="mt-1">Votre texte est conservé dans cet éditeur. Comparez-le à la dernière version avant de reprendre la modification ; ne rechargez pas sans le copier.</p> : null}
      </div> : null}

      <section id={`${editorId}-preview`} hidden={!showPreview} aria-label="Aperçu de l’actualité" className="rounded-2xl border border-[#D8E3DE] bg-[#FBFCFA] p-5 sm:p-7">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A66F3D]">Aperçu · {language === "fr" ? "Français" : "English"}</p>
        {draft.image_path ? <div className="relative mt-4 h-48 overflow-hidden rounded-xl bg-[#0B302B] sm:h-72"><Image src={draft.image_path} alt={draft.image_alt} unoptimized={draft.image_path.startsWith(GAME_NEWS_IMAGE_PREFIX)} fill sizes="(max-width:768px) 100vw, 1000px" className="object-cover" /></div> : null}
        <h3 className="mt-3 break-words text-2xl font-black text-[#183F37]">{activeTitle || "Le titre de votre actualité"}</h3>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#60756E]">{activeSummary}</p>
        <div className="mt-5"><GameNewsBody body={activeBody} connected /></div>
      </section>
    </form>
  );
}
