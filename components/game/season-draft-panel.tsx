"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSeasonDraft } from "@/app/jeu/draft/actions";
import { RIDER_RATING_AXES, getRiderSportingProfile } from "@/lib/game/rider-profile";
import { getSpecialAbilityDefinition } from "@/lib/game/special-abilities";
import { draftChoiceError, draftRiderAverage, draftSalary, formatDraftDate, reorderDraftPreferences, type SeasonDraftRider, type SeasonDraftView } from "@/lib/game/season-draft";
import { PotentialStars } from "./potential-stars";
import { RiderAvatar } from "./rider-avatar";

const money = (value: number) => value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const buttonClass = "min-h-10 rounded-xl bg-[#195F4C] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#114B3B] disabled:cursor-not-allowed disabled:opacity-40";

export function SeasonDraftPanel({ view, preview = false }: { view: SeasonDraftView; preview?: boolean }) {
  const router = useRouter();
  const [preferences, setPreferences] = useState(view.mine?.preferences ?? []);
  const [automatic, setAutomatic] = useState(view.mine?.autoEnabled ?? false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("score");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.parse(view.serverNow));
  const edition = view.edition;
  const mine = view.mine;
  const riders = view.riders ?? [];
  const participants = view.participants ?? [];
  const active = edition?.status === "preparing" || edition?.status === "running";
  const isMyTurn = edition?.status === "running" && mine?.status === "pending" && edition.currentPosition === mine.position;
  const remaining = edition?.deadline ? Math.max(0, Math.ceil((Date.parse(edition.deadline) - Math.max(now, Date.parse(view.serverNow))) / 1000)) : 0;
  const canEdit = !!mine && mine.status === "pending" && !!active && (!isMyTurn || remaining > 0);
  const dirty = JSON.stringify(preferences) !== JSON.stringify(mine?.preferences ?? []) || automatic !== !!mine?.autoEnabled;
  const selectedRider = riders.find(rider => rider.id === confirmation);
  const current = participants.find(participant => participant.position === edition?.currentPosition);
  const finance = view.finance;
  const salary = (rider: SeasonDraftRider) => draftSalary(rider, finance?.salaryDiscountPercent, finance?.homegrownRiderIds.includes(rider.id));
  const fullRoster = !!finance && (finance.rosterCount >= finance.rosterLimit || finance.nonHomegrownCount >= finance.nonHomegrownLimit);

  useEffect(() => {
    if (edition?.status !== "running" || !edition.deadline) return;
    const serverTime = Date.parse(view.serverNow);
    const start = performance.now();
    const timer = window.setInterval(() => setNow(serverTime + performance.now() - start), 1000);
    return () => window.clearInterval(timer);
  }, [view.serverNow, edition?.status, edition?.deadline]);

  useEffect(() => {
    if (preview || !edition || !["scheduled", "preparing", "running"].includes(edition.status)) return;
    let controller: AbortController | null = null;
    let fetching = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible" || fetching) return;
      fetching = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 5000);
      try {
        const response = await fetch("/api/season-draft/status", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) return;
        const status = await response.json();
        if (status.editionId !== edition.id || status.version !== edition.version || status.status !== edition.status) router.refresh();
      } catch { /* The current page remains usable during a transient network loss. */ }
      finally { window.clearTimeout(timeout); fetching = false; }
    };
    const timer = window.setInterval(refresh, edition.status === "running" ? 20000 : edition.status === "preparing" ? 60000 : 120000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); controller?.abort(); };
  }, [edition?.id, edition?.status, edition?.version, edition, router, preview]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr");
    return [...(view.riders ?? [])].filter(rider => (!availableOnly || !rider.selectedTeamId)
      && (!query || `${rider.firstName} ${rider.lastName} ${rider.countryName} ${getRiderSportingProfile(rider.ratings)}`.toLocaleLowerCase("fr").includes(query)))
      .sort((a, b) => sort === "potential" ? b.potentialSteps - a.potentialSteps || b.score - a.score
        : sort === "average" ? draftRiderAverage(b) - draftRiderAverage(a) || b.score - a.score
        : sort === "salary" ? a.salaryPerSeason - b.salaryPerSeason || b.score - a.score
        : sort === "age" ? a.age - b.age || b.score - a.score : b.score - a.score || a.poolRank - b.poolRank);
  }, [view.riders, search, availableOnly, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * 20, currentPage * 20);

  function submit(input: Parameters<typeof updateSeasonDraft>[0]) {
    if (preview) { setFeedback("Aperçu local : aucun recrutement n’a été effectué."); return; }
    setFeedback("");
    startTransition(async () => {
      try {
        const result = await updateSeasonDraft(input);
        if (result.error) setFeedback(result.error);
        else { setFeedback("Votre choix est enregistré."); setConfirmation(null); router.refresh(); }
      } catch { setFeedback("L’enregistrement n’a pas abouti. Actualisez la page avant de réessayer."); }
    });
  }

  return <div className="pb-28">
    <header className="relative overflow-hidden rounded-3xl border border-[#B29B62]/50 bg-[#142D2A] px-5 py-7 text-white sm:px-8">
      <span aria-hidden="true" className="absolute -right-5 -top-10 text-[190px] leading-none text-[#E9CB7D]/[.06]">↗</span>
      <p className="text-xs font-black uppercase tracking-[.2em] text-[#E9CB7D]">Un nouveau départ · {edition ? `Saison ${edition.gameYear}` : `À partir de la saison ${view.firstGameYear}`}</p>
      <h1 className="mt-2 text-3xl font-black sm:text-4xl">La draft de début de saison</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#D2E0D8]">Un coureur à recruter, sans indemnité. Les équipes les moins bien classées choisissent en premier.</p>
      <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full border border-white/20 px-3 py-2">J1 · Listes dès 8 h</span>
        <span className="rounded-full bg-[#E9CB7D] px-3 py-2 text-[#142D2A]">Sélections à 14 h · Paris</span>
        <span className="rounded-full border border-white/20 px-3 py-2">5 minutes par choix</span>
      </div>
      {edition ? <p className="mt-4 text-sm text-[#E9CB7D]">{formatDraftDate(edition.startsAt)} · {edition.status === "completed" ? "Draft terminée" : edition.status === "cancelled" ? "Édition annulée" : edition.status === "running" ? "Draft en cours" : "Préparez votre prochaine saison"}</p> : null}
    </header>

    <details className="mt-4 rounded-2xl border border-[#D5DFD5] bg-white px-5 py-4 text-sm">
      <summary className="cursor-pointer font-bold">Les règles en bref</summary>
      <ul className="mt-3 list-disc space-y-2 pl-5 leading-6 text-[#526A63]">
        <li>Un choix par équipe humaine active. Les DS inactifs depuis 7 jours sont exclus ; les participants sont figés à l’ouverture.</li>
        <li>Points UCI de la saison précédente croissants, y compris 0 point. À égalité, le joueur inscrit depuis le plus longtemps passe devant. Un nouveau joueur sans classement compte pour 0 point.</li>
        <li>Les meilleurs agents libres sont retenus selon leur spécialité (60 %), leur potentiel et leur âge (25 %), puis leur moyenne générale (15 %). Au moins 100 places dans le vivier, ou autant que d’équipes si elles sont plus nombreuses, dans la limite des coureurs libres disponibles.</li>
        <li>Toutes les notes et tous les potentiels du vivier sont révélés. Les coureurs sont réservés à la draft jusqu’à sa clôture.</li>
        <li>Votre liste reste privée. Une liste automatique validée recrute le premier choix disponible et compatible avec votre effectif et votre budget, dès votre tour.</li>
        <li>Sans choix réalisable après 5 minutes, le tour est passé : aucun recrutement ne vous est imposé.</li>
        <li>Aucune indemnité ni prime de signature. Salaire normal à votre charge, contrat jusqu’à la fin de la saison, sans revente pendant cette saison.</li>
      </ul>
    </details>

    {!edition || edition.status === "scheduled" ? <section className="mt-5 rounded-2xl border border-[#D5DFD5] bg-white p-6">
      <h2 className="text-lg font-black">Rendez-vous à J1 dès 8 h</h2>
      <p className="mt-2 text-sm leading-6 text-[#526A63]">{!view.enabled ? "Les prochaines drafts sont suspendues." : "Le vivier et l’ordre des équipes seront publiés à l’ouverture. Vous aurez ensuite jusqu’au début des sélections, à 14 h, pour préparer votre liste. Elle restera modifiable jusqu’à votre tour."}</p>
    </section> : <>
      <section aria-live="polite" className={`mt-5 rounded-2xl border p-5 ${isMyTurn ? "border-[#C1A04C] bg-[#FFF5CF]" : "border-[#D5DFD5] bg-white"}`}>
        <div className="flex flex-wrap items-center justify-between gap-4"><div>
          <h2 className="text-lg font-black">{isMyTurn ? "C’est votre tour !" : edition.status === "completed" ? "La draft est terminée" : current ? `${current.teamName} choisit` : "Les sélections commencent à 14 h"}</h2>
          <p className="mt-1 text-sm text-[#526A63]">{mine ? `Votre position : ${mine.position} sur ${edition.participantCount}` : "Vous ne figurez pas parmi les participants de cette édition."}
            {mine?.status === "picked" ? " · Votre coureur a rejoint l’équipe." : mine?.status === "passed" ? ` · ${draftChoiceError(mine.reason)}.` : ""}</p>
        </div>{edition.status === "running" && edition.deadline ? <p className="rounded-xl bg-[#173D3A] px-4 py-2 font-black tabular-nums text-white">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}<span className="ml-2 text-xs font-normal">restantes</span></p> : <span className="text-sm font-bold">{edition.poolCount} coureurs · {participants.filter(p => p.status === "picked").length} recrutements</span>}</div>
        {fullRoster && mine?.status === "pending" ? <p className="mt-3 text-sm font-bold text-[#9E4A25]">Votre effectif atteint sa capacité. Vérifiez les places disponibles avant votre choix.</p> : null}
      </section>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-[#D5DFD5] bg-white p-5 lg:sticky lg:top-4">
          <div className="flex items-center justify-between"><h2 className="font-black">Ma liste de préférences</h2><span className="text-xs font-bold text-[#75867C]">{preferences.length} choix</span></div>
          <p className="mt-2 text-xs leading-5 text-[#526A63]">Ajoutez les coureurs puis classez vos choix. Les coureurs déjà pris sont ignorés automatiquement.</p>
          <ol className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {preferences.map((id, index) => {
              const rider = riders.find(r => r.id === id);
              if (!rider) return null;
              return <li key={id} className={`rounded-xl border p-2.5 ${rider.selectedTeamId ? "border-[#E4E7E2] bg-[#F3F4F1] text-[#839187]" : "border-[#D6E2D7] bg-[#F4F8F1]"}`}>
                <div className="flex items-start gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#173D3A] text-xs font-black text-white">{index + 1}</span>
                  <span className="min-w-0 flex-1 text-xs font-bold">{rider.firstName} {rider.lastName}<span className="mt-1 block text-[11px] font-normal">{rider.selectedTeamId ? "Déjà sélectionné" : `${money(salary(rider))} / saison`}</span></span></div>
                {canEdit ? <div className="mt-2 flex justify-end gap-1"><button type="button" className="min-h-8 min-w-8 rounded-lg border border-[#C8D4C7]" disabled={pending || index === 0} aria-label={`Monter ${rider.lastName}`} onClick={() => setPreferences(ids => reorderDraftPreferences(ids, id, -1))}>↑</button>
                  <button type="button" className="min-h-8 min-w-8 rounded-lg border border-[#C8D4C7]" disabled={pending || index === preferences.length - 1} aria-label={`Descendre ${rider.lastName}`} onClick={() => setPreferences(ids => reorderDraftPreferences(ids, id, 1))}>↓</button>
                  <button type="button" className="min-h-8 rounded-lg px-2 text-xs text-[#9E4A25]" disabled={pending} aria-label={`Retirer ${rider.lastName}`} onClick={() => setPreferences(ids => ids.filter(value => value !== id))}>Retirer</button></div> : null}
              </li>;
            })}
          </ol>
          {!preferences.length ? <p className="my-5 text-center text-sm text-[#75867C]">Votre liste est encore vide.</p> : null}
          {canEdit ? <><label className="mt-4 flex items-start gap-2 border-t border-[#E1E7DD] pt-4 text-sm font-semibold"><input type="checkbox" className="mt-1 accent-[#195F4C]" checked={automatic} disabled={pending} onChange={event => setAutomatic(event.target.checked)} /><span>Autoriser le recrutement automatique selon ma liste</span></label>
            <p className="mt-2 text-xs leading-5 text-[#75867C]">En validant, vous acceptez le salaire affiché du premier choix réalisable. Sans cette autorisation, vous devrez choisir à votre tour.</p>
            <button type="button" disabled={pending} className="mt-4 min-h-10 text-xs font-semibold text-[#8B4E39] underline underline-offset-4" onClick={() => setConfirmation("pass")}>Renoncer à cette draft</button></> : null}
          {finance ? <p className="mt-4 border-t border-[#E1E7DD] pt-3 text-xs text-[#526A63]">Effectif : {finance.rosterCount}/{finance.rosterLimit} · Budget projeté disponible : {money(finance.budget)}</p> : null}
        </aside>

        <section aria-label="Coureurs de la draft" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-3"><input aria-label="Rechercher un coureur, pays ou profil" type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Coureur, pays ou profil…" className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#CAD8C8] bg-white px-4 text-sm" />
            <select aria-label="Trier les coureurs" value={sort} onChange={event => { setSort(event.target.value); setPage(1); }} className="min-h-11 rounded-xl border border-[#CAD8C8] bg-white px-3 text-sm"><option value="score">Classement de draft</option><option value="potential">Potentiel</option><option value="average">Moyenne générale</option><option value="salary">Salaire croissant</option><option value="age">Âge croissant</option></select>
            <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={availableOnly} onChange={event => { setAvailableOnly(event.target.checked); setPage(1); }} />Disponibles uniquement</label>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">{visible.map(rider => <DraftRiderCard key={rider.id} rider={rider} salary={salary(rider)} preferred={preferences.includes(rider.id)} canEdit={canEdit} canPick={!!isMyTurn && remaining > 0} pending={pending} onAdd={() => setPreferences(ids => ids.includes(rider.id) ? ids : [...ids, rider.id])} onPick={() => setConfirmation(rider.id)} />)}</div>
          {!visible.length ? <p className="rounded-2xl bg-white p-8 text-center text-sm text-[#75867C]">Aucun coureur ne correspond à ces critères.</p> : null}
          {pageCount > 1 ? <nav aria-label="Pages des coureurs" className="mt-5 flex items-center justify-center gap-4 text-sm"><button type="button" className={buttonClass} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Précédent</button><span>{currentPage} / {pageCount}</span><button type="button" className={buttonClass} disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Suivant</button></nav> : null}
        </section>
      </div>

      <details className="mt-5 rounded-2xl border border-[#D5DFD5] bg-white px-5 py-4" open={edition.status === "completed"}>
        <summary className="cursor-pointer font-black">Ordre des équipes et recrutements · {participants.filter(p => p.status !== "pending").length}/{participants.length}</summary>
        <ol className="mt-4 grid gap-2 md:grid-cols-2">{participants.map(participant => <li key={participant.teamId} className={`flex gap-3 rounded-xl p-3 text-sm ${participant.position === edition.currentPosition ? "bg-[#FFF4C9]" : "bg-[#F4F7F0]"}`}><span className="font-black">{participant.position}.</span><div className="min-w-0"><strong className="block">{participant.teamName}</strong><span className="text-xs text-[#75867C]">{participant.directorName} · {participant.previousPoints} pts la saison précédente</span><p className="mt-1 text-xs font-semibold">{participant.status === "picked" ? participant.selectedName : participant.status === "passed" ? draftChoiceError(participant.reason) : participant.position === edition.currentPosition ? "À son tour" : "En attente"}</p></div></li>)}</ol>
      </details>
    </>}

    {feedback ? <p role="status" className="sticky bottom-24 mt-4 rounded-xl border border-[#D8B757] bg-[#FFF5CF] px-5 py-3 text-sm font-semibold shadow-sm">{feedback}</p> : null}
    {canEdit && dirty ? <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#C5D4C1] bg-white/95 px-4 py-3 shadow-lg backdrop-blur"><div className="mx-auto flex max-w-[1250px] flex-wrap items-center justify-between gap-3"><p className="text-xs font-semibold">{preferences.length} choix · {automatic ? "Recrutement automatique autorisé" : "Choix manuel à votre tour"}</p><button type="button" className={buttonClass} disabled={pending || (automatic && !preferences.length)} onClick={() => submit({ kind: "preferences", editionId: edition!.id, riders: preferences, auto: automatic })}>{pending ? "Enregistrement…" : "Valider ma sélection"}</button></div></div> : null}

    {confirmation && (selectedRider || confirmation === "pass") ? <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#071E19]/70 p-4"><section role="dialog" aria-modal="true" aria-labelledby="draft-confirm-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
      <h2 id="draft-confirm-title" className="text-xl font-black">{confirmation === "pass" ? "Passer votre tour ?" : `Recruter ${selectedRider!.firstName} ${selectedRider!.lastName} ?`}</h2>
      <p className="mt-3 text-sm leading-6 text-[#526A63]">{confirmation === "pass" ? "Ce choix est définitif pour cette édition. Aucun coureur ne sera recruté." : `Sans indemnité ni prime de signature. Salaire : ${money(salary(selectedRider!))} pour la saison. Contrat jusqu’à la fin de la saison, sans revente pendant cette saison.`}</p>
      {feedback ? <p role="alert" className="mt-3 text-sm font-semibold text-[#A34032]">{feedback}</p> : null}
      <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={pending} className="min-h-10 px-3 text-sm font-semibold" onClick={() => { setConfirmation(null); setFeedback(""); }}>Annuler</button><button type="button" className={buttonClass} disabled={pending} onClick={() => submit(confirmation === "pass" ? { kind: "pass", editionId: edition!.id } : { kind: "pick", editionId: edition!.id, riderId: confirmation })}>{pending ? "Enregistrement…" : "Confirmer"}</button></div>
    </section></div> : null}
  </div>;
}

function DraftRiderCard({ rider, salary, preferred, canEdit, canPick, pending, onAdd, onPick }: {
  rider: SeasonDraftRider; salary: number; preferred: boolean; canEdit: boolean; canPick: boolean; pending: boolean; onAdd: () => void; onPick: () => void;
}) {
  return <article className={`rounded-2xl border bg-white p-4 ${rider.selectedTeamId ? "border-[#DFE4DA] opacity-65" : "border-[#CCD9C6]"}`}>
    <div className="flex items-center gap-3"><RiderAvatar riderId={rider.id} profileKey={rider.avatarProfileKey} seed={rider.avatarSeed} age={rider.age} renderMode="compact" className="h-14 w-14 shrink-0 rounded-full" />
      <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-[#8E7944]">{rider.selectedTeamId ? "Déjà sélectionné" : "Choix disponible"} · #{rider.poolRank}</p><h3 className="text-base font-black">{rider.firstName} {rider.lastName}</h3><p className="mt-0.5 text-xs text-[#75867C]">{rider.countryName} · {rider.age} ans</p></div></div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-[#EAF2E7] px-2 py-1 text-[11px] font-bold">{getRiderSportingProfile(rider.ratings)}</span><PotentialStars potentialSteps={rider.potentialSteps} compact /></div>
    <div className="mt-3 grid grid-cols-6 gap-1">{RIDER_RATING_AXES.map(axis => <div key={axis.key} className={`rounded-lg px-1 py-1.5 text-center ${axis.importance === "primary" ? "bg-[#EAF2E7]" : "bg-[#F5F6F1]"}`} title={axis.label}><span className="block text-[9px] font-bold text-[#7C8A7B]">{axis.shortLabel}</span><strong className="block text-xs">{rider.ratings[axis.key]}</strong></div>)}</div>
    <div className="mt-3 flex items-center justify-between gap-2 text-xs"><span className="text-[#75867C]">MG <strong className="text-[#173D3A]">{draftRiderAverage(rider).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</strong></span><strong>{money(salary)} / saison</strong></div>
    <p className="mt-2 text-[11px] text-[#75867C]">{rider.heightCm != null ? `${rider.heightCm} cm · ` : ""}{rider.weightKg != null ? `${rider.weightKg.toLocaleString("fr-FR")} kg · ` : ""}{rider.careerRaceDays ?? 0} jours de course</p>
    {rider.abilities.length ? <p className="mt-2 text-xs text-[#526A63]">{rider.abilities.map(code => { const ability = getSpecialAbilityDefinition(code); return <span key={code} title={ability?.effect} className="mr-1 inline-block rounded-lg bg-[#FFF6D6] px-2 py-1">{ability?.name ?? code}</span>; })}</p> : null}
    {rider.injuryUntil ? <p className="mt-2 text-xs text-[#A34F30]">Blessé jusqu’au {formatDraftDate(rider.injuryUntil)}</p> : null}
    <div className="mt-4 flex flex-wrap gap-2 border-t border-[#EDF0E8] pt-3">{rider.selectedTeamId ? <span className="text-xs font-bold text-[#75867C]">Déjà recruté</span> : <>
      {canEdit ? <button type="button" disabled={pending || preferred} className="min-h-10 flex-1 rounded-xl border border-[#B8CDB4] px-3 py-2 text-xs font-bold disabled:opacity-50" onClick={onAdd}>{preferred ? "✓ Dans ma liste" : "+ Ajouter à ma liste"}</button> : null}
      {canPick ? <button type="button" disabled={pending} className={buttonClass} onClick={onPick}>Recruter</button> : null}
    </>}</div>
  </article>;
}
