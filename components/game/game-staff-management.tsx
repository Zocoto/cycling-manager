"use client";

import { useActionState, useId } from "react";
import type { GameStaffActionState, GameStaffMember } from "@/lib/game/game-product-news";

export type GameStaffManagementAction = (previous: GameStaffActionState, formData: FormData) => Promise<GameStaffActionState>;

function StaffFeedback({ state }: { state: GameStaffActionState }) {
  if (!state.message) return null;
  return <p role={state.status === "error" ? "alert" : "status"} className={`mt-3 rounded-xl px-3 py-2.5 text-sm font-semibold leading-6 ${state.status === "error" ? "bg-[#FFF6E8] text-[#8A4B16]" : "bg-[#EFF8F3] text-[#176951]"}`}>{state.message}</p>;
}

export function GameStaffManagement({
  members: initialMembers,
  searchAction,
  roleAction,
}: {
  members: GameStaffMember[];
  searchAction: GameStaffManagementAction;
  roleAction: GameStaffManagementAction;
}) {
  const searchId = useId();
  const [searchState, searchFormAction, searching] = useActionState<GameStaffActionState, FormData>(searchAction, { status: "idle", message: null });
  const [roleState, roleFormAction, saving] = useActionState<GameStaffActionState, FormData>(async (previous, formData) => {
    const result = await roleAction(previous, formData);
    return { ...result, members: result.members ?? previous.members };
  }, { status: "idle", message: null, members: initialMembers });
  const members = roleState.members ?? initialMembers;
  const existingMembers = new Set(members.map((member) => member.userId));
  const candidates = searchState.candidates ?? [];

  return (
    <section data-game-staff-management="true" className="min-w-0 rounded-2xl border border-[#D8E3DE] bg-white p-4 shadow-[0_8px_28px_rgba(19,60,46,0.04)] sm:p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A66F3D]">Accès réservés</p>
      <h2 className="mt-1 text-xl font-black text-[#183F37]">L’équipe Cyclo Stratège</h2>
      <p className="mt-3 text-sm leading-6 text-[#60756E]">Les membres de l’équipe disposent de l’éditeur d’actualités, du simulateur et des outils d’extraction. Ce rôle ne donne pas accès à la gestion des autres membres.</p>

      <ul className="mt-5 space-y-2" aria-label="Membres de l’équipe Cyclo Stratège">
        {members.map((member) => (
          <li key={member.userId} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E7EEE9] bg-[#FBFCFA] px-3 py-3">
            <div className="min-w-0">
              <p className="break-words text-sm font-black text-[#183F37]">{member.displayName}</p>
              <p className="mt-0.5 text-[11px] font-bold text-[#789087]">{member.role === "owner" ? "Fondateur · accès protégé" : "Équipe Cyclo Stratège"}</p>
            </div>
            {member.role !== "owner" ? <form action={roleFormAction}>
              <input type="hidden" name="user_id" value={member.userId} />
              <input type="hidden" name="enabled" value="false" />
              <button type="submit" disabled={saving} aria-label={`Retirer le rôle de ${member.displayName}`} className="rounded-lg border border-[#E9D8CF] px-3 py-2 text-xs font-bold text-[#97593C] hover:bg-[#FFF5EF] disabled:opacity-50">Retirer le rôle</button>
            </form> : null}
          </li>
        ))}
        {members.length === 0 ? <li className="text-sm text-[#789087]">Aucun membre délégué pour le moment.</li> : null}
      </ul>
      <StaffFeedback state={roleState} />

      <form action={searchFormAction} className="mt-6 border-t border-[#E7EEE9] pt-5">
        <label htmlFor={searchId} className="block text-xs font-bold text-[#315B3E]">Rechercher un Directeur Sportif</label>
        <div className="mt-2 flex flex-wrap gap-2">
          <input id={searchId} name="query" type="search" required minLength={2} maxLength={60} autoComplete="off" placeholder="Nom ou pseudo · 2 caractères minimum" className="min-w-0 flex-1 rounded-xl border border-[#D8E3DE] bg-white px-3 py-2.5 text-sm text-[#183F37] outline-none focus:border-[#B67A44] focus:ring-2 focus:ring-[#B67A44]/15" />
          <button type="submit" disabled={searching} className="rounded-xl bg-[#183F37] px-4 py-2.5 text-sm font-black text-white hover:bg-[#315B3E] disabled:opacity-50">{searching ? "Recherche…" : "Rechercher"}</button>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-[#789087]">La recherche est lancée uniquement avec le bouton. Aucun accès n’est accordé automatiquement.</p>
      </form>
      <StaffFeedback state={searchState} />
      {candidates.length > 0 ? <ul className="mt-3 space-y-2" aria-label="Résultats de recherche de Directeurs Sportifs">
        {candidates.map((candidate) => <li key={candidate.userId} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E7EEE9] px-3 py-3">
          <div className="min-w-0">
            <p className="break-words text-sm font-bold text-[#183F37]">{candidate.displayName}</p>
            <p className="break-words text-xs text-[#789087]">@{candidate.username}</p>
          </div>
          {existingMembers.has(candidate.userId) ? <span className="rounded-full bg-[#EFF5F1] px-3 py-1.5 text-[11px] font-bold text-[#315B3E]">Déjà dans l’équipe</span> : <form action={roleFormAction}>
            <input type="hidden" name="user_id" value={candidate.userId} />
            <input type="hidden" name="enabled" value="true" />
            <button type="submit" disabled={saving} aria-label={`Nommer ${candidate.displayName} dans l’équipe`} className="rounded-lg border border-[#C7D8CE] px-3 py-2 text-xs font-bold text-[#315B3E] hover:bg-[#EFF5F1] disabled:opacity-50">Nommer dans l’équipe</button>
          </form>}
        </li>)}
      </ul> : null}
    </section>
  );
}
