"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { useLocale } from "@/components/i18n/locale-provider";
import type { CyclogazetteCommunity } from "@/lib/game/cyclogazette";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function CyclogazetteCommunityPanel({
  editionId,
  community,
}: {
  editionId: string;
  community: CyclogazetteCommunity;
}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleLike() {
    startTransition(async () => {
      setError(null);
      const supabase = createSupabaseBrowserClient();
      const result = await supabase.rpc("toggle_cyclogazette_like", {
        p_edition_id: editionId,
      });
      if (result.error) {
        setError(isEnglish ? "Unable to save your like." : "Impossible d’enregistrer votre like.");
        return;
      }
      router.refresh();
    });
  }

  function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;
    startTransition(async () => {
      setError(null);
      const supabase = createSupabaseBrowserClient();
      const result = await supabase.rpc("post_cyclogazette_comment", {
        p_edition_id: editionId,
        p_message: trimmedMessage,
      });
      if (result.error) {
        setError(isEnglish ? "Unable to publish this comment." : "Impossible de publier ce commentaire.");
        return;
      }
      setMessage("");
      router.refresh();
    });
  }

  return (
    <section className="border-t-4 border-double border-[#241F18] px-5 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#A12742]">{isEnglish ? "Readers' letters" : "Le courrier des lecteurs"}</p>
          <h2 className="mt-1 font-serif text-2xl font-black">{isEnglish ? "The peloton forum" : "La tribune du peloton"}</h2>
        </div>
        <button
          type="button"
          onClick={toggleLike}
          disabled={pending}
          className={`border px-4 py-2 text-xs font-black transition ${community.likedByViewer ? "border-[#A12742] bg-[#A12742] text-white" : "border-[#806C45]/50 bg-[var(--gazette-card)] hover:border-[#A12742]"}`}
        >
          {community.likedByViewer
            ? isEnglish ? "I like this edition" : "J’aime cette édition"
            : isEnglish ? "Like" : "J’aime"} · {community.likeCount}
        </button>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <form onSubmit={submitComment} className="border border-[#806C45]/45 bg-[var(--gazette-card-soft)] p-4">
          <label htmlFor="cyclogazette-comment" className="text-[9px] font-black uppercase tracking-[0.16em] text-[#695D43]">{isEnglish ? "Your SD comment" : "Votre commentaire de DS"}</label>
          <textarea id="cyclogazette-comment" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={400} rows={3} placeholder={isEnglish ? "Your view of today's racing…" : "Votre regard sur cette journée de course…"} className="mt-2 w-full resize-y border border-[#806C45]/45 bg-[var(--gazette-input)] p-3 font-serif text-sm outline-none focus:border-[#A12742]" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-[10px] text-[#695D43]">{message.length}/400</span>
            <button type="submit" disabled={pending || !message.trim()} className="bg-[#241F18] px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#F4EBD2] disabled:opacity-45">{isEnglish ? "Publish" : "Publier"}</button>
          </div>
          {error ? <p className="mt-2 text-xs font-bold text-[#A12742]">{error}</p> : null}
        </form>
        <div className="space-y-3">
          {community.comments.length > 0 ? community.comments.map((comment) => (
            <article key={comment.id} className="border-l-2 border-[#A12742] bg-[var(--gazette-card-soft)] px-4 py-3">
              <p className="font-serif text-sm leading-5">{comment.message}</p>
              <p className="mt-2 text-[9px] font-black uppercase tracking-[0.12em] text-[#695D43]">{comment.directorName} · {formatDate(comment.createdAt, locale)}</p>
            </article>
          )) : <p className="border-y border-[#806C45]/35 py-4 font-serif text-sm italic text-[#695D43]">{isEnglish ? "The newsroom is waiting for the peloton's first comment." : "La rédaction attend le premier commentaire du peloton."}</p>}
        </div>
      </div>
    </section>
  );
}

function formatDate(value: string, locale: "fr" | "en") {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(value));
}
