"use client";

import { useActionState, useId } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import type { SiteReleaseActionState, SiteReleaseManagement } from "@/lib/game/site-release";

type Action = (state: SiteReleaseActionState, form: FormData) => Promise<SiteReleaseActionState>;

export function preserveSavedSiteRelease(previous: SiteReleaseActionState, next: SiteReleaseActionState): SiteReleaseActionState {
  return { ...next, management: next.management ?? previous.management };
}

export function SiteReleaseManagementPanel({ initial, action }: { initial: SiteReleaseManagement | null; action: Action }) {
  const { locale } = useLocale();
  const english = locale === "en";
  const id = useId();
  const [state, formAction, pending] = useActionState<SiteReleaseActionState, FormData>(async (previous, form) => preserveSavedSiteRelease(previous, await action(previous, form)), { status: "idle", message: null });
  const current = state.management ?? initial;

  return <details className="mt-6 min-w-0 rounded-2xl border border-[#C7D8CE] bg-white p-4 sm:p-5">
    <summary className="cursor-pointer text-sm font-black text-[#183F37]">
      {english ? "Site version" : "Version du site"}
      {current ? <span className="ml-3 inline-flex rounded-full bg-[#EFF5F1] px-3 py-1 text-xs tabular-nums">{current.version}</span> : null}
    </summary>
    {!current ? <p role="status" className="mt-3 text-sm text-[#60756E]">{english ? "Version settings are temporarily unavailable. You can still edit your news." : "La gestion de version est temporairement indisponible. Vous pouvez continuer à rédiger vos actualités."}</p> : <>
      <p id={`${id}-help`} className="mt-3 max-w-3xl text-sm leading-6 text-[#60756E]">{english ? "Change the version displayed in the site footer without publishing news. This label does not deploy an update or change race simulations." : "Modifiez la version affichée en bas du site, sans publier d’actualité. Ce numéro ne déploie pas de mise à jour et ne change pas les simulations."}</p>
      <form key={current.revision} action={formAction} className="mt-4 flex min-w-0 flex-wrap items-end gap-3" aria-describedby={`${id}-help`}>
        <input type="hidden" name="revision" value={current.revision} />
        <label className="min-w-0 flex-[1_1_140px] text-xs font-bold text-[#315B3E]">{english ? "New version" : "Nouvelle version"}
          <input name="version" defaultValue={current.version} required maxLength={40} placeholder="0.9.2" disabled={pending} className="mt-1.5 w-full rounded-xl border border-[#D8E3DE] px-3 py-2.5 text-sm outline-none focus:border-[#B67A44]" />
        </label>
        <label className="min-w-0 flex-[3_1_240px] text-xs font-bold text-[#315B3E]">{english ? "Comment · optional" : "Commentaire · facultatif"}
          <input name="note" maxLength={180} disabled={pending} className="mt-1.5 w-full rounded-xl border border-[#D8E3DE] px-3 py-2.5 text-sm outline-none focus:border-[#B67A44]" />
        </label>
        <button type="submit" disabled={pending} className="rounded-xl bg-[#183F37] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{pending ? (english ? "Saving…" : "Enregistrement…") : (english ? "Update version" : "Mettre à jour la version")}</button>
      </form>
      {state.message ? <p role={state.status === "error" || state.status === "conflict" ? "alert" : "status"} className={`mt-3 text-sm font-semibold ${state.status === "success" ? "text-[#176951]" : "text-[#8A4B16]"}`}>{state.message}</p> : null}
      <h2 className="mt-5 text-xs font-black uppercase tracking-wider text-[#60756E]">{english ? "Recent changes" : "Dernières modifications"}</h2>
      <ol className="mt-2 divide-y divide-[#E7EEE9]">{current.history.map((entry) => <li key={entry.revision} className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-xs">
        <span className="font-black text-[#183F37]">{entry.version}</span>
        <time dateTime={entry.recorded_at} className="text-[#60756E]">{new Intl.DateTimeFormat(english ? "en-GB" : "fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(entry.recorded_at))}</time>
        {entry.note ? <span className="min-w-0 break-words text-[#60756E]">{entry.note}</span> : null}
      </li>)}</ol>
    </>}
  </details>;
}
