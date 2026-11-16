"use client";

import { createContext, useActionState, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { updateRiderSquadStatusesAction, updateRiderSquadStatusAction } from "@/app/jeu/effectif/actions";
import { useUnsavedManagementChanges } from "./use-management-draft";
import { acknowledgeSquadStatusSave, createSquadStatusDrafts, discardSquadStatusDrafts, getSquadStatusUpdates, rebaseSquadStatusDrafts, squadStatusRevision, updateSquadStatusDraft, type SquadStatusDraftState } from "@/lib/game/squad-status-drafts";
import { INITIAL_SQUAD_STATUSES_SAVE_STATE, type SavedSquadStatus, type SquadStatusesSaveState } from "@/lib/game/squad-status-editor";
import {
  canLeadCloseGuard,
  getSquadStatusLabel,
  isSquadStatus,
  SQUAD_STATUS_OPTIONS,
  type SquadStatus,
} from "@/lib/game/squad-status";

type LeaderOption = { id: string; label: string };

const SquadStatusContext = createContext<{
  valuesByRiderId: SquadStatusDraftState["valuesByRiderId"];
  leaderOptions: readonly LeaderOption[];
  pending: boolean;
  updateStatus: (riderId: string, status: SquadStatus | null, protectedLeaderId?: string | null) => void;
} | null>(null);

const EMPTY_RIDER_OPTIONS: readonly LeaderOption[] = [];

/** One shared draft map for the desktop and mobile copies; the only form is a sibling of the rows. */
export function SquadStatusesBulkEditor({
  initialStatuses,
  riderOptions = EMPTY_RIDER_OPTIONS,
  children,
}: {
  initialStatuses: SavedSquadStatus[];
  riderOptions?: readonly LeaderOption[];
  children: ReactNode;
}) {
  const revision=squadStatusRevision(initialStatuses);
  const [drafts,setDrafts]=useState(()=>createSquadStatusDrafts(initialStatuses,revision));
  if(drafts.serverRevision!==revision) setDrafts(rebaseSquadStatusDrafts(drafts,initialStatuses,revision));
  const [saveState,formAction,pending]=useActionState<SquadStatusesSaveState,FormData>(async(previous,formData)=>{
    let result:SquadStatusesSaveState;
    try { result=await updateRiderSquadStatusesAction(previous,formData); }
    catch (error) { unstable_rethrow(error); return {status:"error",message:"La validation n’a pas pu être confirmée. Vos réglages sont conservés : réessayez après avoir vérifié votre connexion.",savedStatuses:[]}; }
    setDrafts(current=>acknowledgeSquadStatusSave(current,result,drafts.confirmedByRiderId));
    return result;
  },INITIAL_SQUAD_STATUSES_SAVE_STATE);
  const updateStatus=useCallback((riderId: string, status: SquadStatus | null, protectedLeaderId?: string | null)=>{
    setDrafts(current=>updateSquadStatusDraft(current,riderId,status,protectedLeaderId));
  },[]);
  const updates=getSquadStatusUpdates(drafts);
  const leaderOptions = useMemo(
    () => riderOptions.filter(rider => canLeadCloseGuard(drafts.valuesByRiderId[rider.id]?.squadStatus)),
    [riderOptions, drafts.valuesByRiderId],
  );
  const hasInvalidGuard = updates.some(update => update.squadStatus === "close_guard" && (
    update.riderId === update.protectedLeaderId ||
    !leaderOptions.some(leader => leader.id === update.protectedLeaderId)
  ));
  useUnsavedManagementChanges(updates.length>0);
  const context=useMemo(()=>({valuesByRiderId:drafts.valuesByRiderId,leaderOptions,pending,updateStatus}),[drafts.valuesByRiderId,leaderOptions,pending,updateStatus]);

  return <SquadStatusContext.Provider value={context}>
    {saveState.status!=="idle"&&saveState.message?<p role={saveState.status==="error"?"alert":"status"} aria-live="polite" className={`m-4 rounded-xl border p-3 text-sm font-bold ${saveState.status==="error"?"border-[#D9A247]/35 bg-[#FFF8E5] text-[#71580A]":"border-[#278B70]/25 bg-[#EAF7EE] text-[#176951]"}`}>{saveState.message}</p>:null}
    {children}
    <form action={formAction} data-squad-status-save="bulk">
      <input type="hidden" name="updates" value={JSON.stringify(updates)}/>
      {updates.length>0?<>
        <div aria-hidden="true" className="h-28 sm:h-24"/>
        <div data-squad-status-dock className="mobile-dock-clearance fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[80] mx-auto max-w-3xl sm:inset-x-6">
          <div className="flex flex-col gap-3 rounded-[1.35rem] border border-white/20 bg-[#0B302B]/95 p-3 text-white shadow-[0_22px_65px_rgba(7,26,23,0.38)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-4">
            <div className="flex min-w-0 items-center gap-3 px-1"><span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F2C94C] text-sm font-black text-[#0B302B]">{updates.length}</span><div className="min-w-0" aria-live="polite"><p className="text-sm font-black">{updates.length===1?"1 statut modifié":`${updates.length} statuts modifiés`}</p><p className="text-[11px] font-semibold text-[#CDE2DA]">{hasInvalidGuard ? "Choisissez un leader éligible pour chaque garde rapprochée." : "Continuez vos réglages ou validez-les en une fois."}</p></div></div>
            <div className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex">
              <button type="button" disabled={pending} onClick={()=>setDrafts(current=>discardSquadStatusDrafts(current))} className="min-h-11 rounded-xl px-3 text-xs font-black uppercase tracking-[0.08em] text-[#CDE2DA] transition hover:bg-white/10 hover:text-white disabled:cursor-wait">Annuler</button>
              <button type="submit" disabled={pending || hasInvalidGuard} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#F2C94C] px-4 text-center text-xs font-black uppercase tracking-[0.08em] text-[#0B302B] transition hover:bg-[#FFE071] disabled:cursor-not-allowed disabled:bg-[#91A59D] disabled:text-white sm:min-w-56">{pending?"Enregistrement…":"Valider les statuts"}</button>
            </div>
          </div>
        </div>
      </>:null}
    </form>
  </SquadStatusContext.Provider>;
}

export function SquadStatusEditor({
  riderId,
  status,
  protectedLeaderId = null,
  leaderOptions = EMPTY_RIDER_OPTIONS,
  returnTo,
  compact = false,
  tone = "light",
  riderName,
}: {
  riderId: string;
  status: SquadStatus | null;
  protectedLeaderId?: string | null;
  leaderOptions?: readonly LeaderOption[];
  returnTo: string;
  compact?: boolean;
  tone?: "light" | "dark";
  riderName?: string;
}) {
  const editor=useContext(SquadStatusContext);
  const [localChoice, setLocalChoice] = useState({ squadStatus: status, protectedLeaderId });
  const draftChoice = editor?.valuesByRiderId[riderId];
  const selected = draftChoice ?? localChoice;
  const isCloseGuard = selected.squadStatus === "close_guard";
  const availableLeaders = isCloseGuard
    ? (editor?.leaderOptions ?? leaderOptions).filter(leader => leader.id !== riderId)
    : EMPTY_RIDER_OPTIONS;
  const selectedLeader = availableLeaders.find(leader => leader.id === selected.protectedLeaderId);
  const disabled = Boolean(editor && (editor.pending || !draftChoice));
  const dark = tone === "dark";
  const labelClass = dark
    ? "mb-1.5 block text-[10px] font-black uppercase tracking-wider text-[#9BE0BC]"
    : "mb-1.5 block text-[10px] font-black uppercase tracking-wider text-[#60756E]";
  const selectClass = [
    "min-h-9 w-full min-w-0 rounded-lg border px-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[#42B99A] disabled:opacity-70",
    dark ? "border-white/15 bg-[#102A25] text-white" : "border-[#315B3E]/15 bg-white text-[#183F37]",
  ].join(" ");
  const fields=(
    <div className={compact ? "grid w-full min-w-0 gap-1.5" : "grid min-w-0 flex-1 gap-2 sm:flex sm:flex-wrap sm:items-end"}>
      <label className={compact ? "min-w-0 flex-1" : "min-w-52 flex-1"}>
        {compact ? (
          <span className="sr-only">Statut effectif</span>
        ) : (
          <span className={labelClass}>
            Statut effectif
          </span>
        )}
        <select
          name="squadStatus"
          value={selected.squadStatus ?? ""}
          disabled={disabled}
          onChange={event => {
            const value = event.target.value;
            if (value !== "" && !isSquadStatus(value)) return;
            const squadStatus = value || null;
            if (editor) editor.updateStatus(riderId, squadStatus);
            else setLocalChoice({ squadStatus, protectedLeaderId: squadStatus === "close_guard" ? selected.protectedLeaderId : null });
          }}
          aria-label={riderName?`Statut de ${riderName}`:"Statut dans l’effectif"}
          title={getSquadStatusLabel(selected.squadStatus)}
          className={selectClass}
        >
          <option value="">Non défini</option>
          {SQUAD_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {isCloseGuard ? (
        <label className={compact ? "min-w-0" : "min-w-52 flex-1"}>
          <span className={compact ? "mb-1 block px-0.5 text-[10px] font-bold text-[#60756E]" : labelClass}>
            Leader protégé
          </span>
          <select
            name="protectedLeaderId"
            value={selectedLeader?.id ?? ""}
            disabled={disabled || availableLeaders.length === 0}
            required
            title={selectedLeader?.label}
            className={selectClass}
            onChange={event => {
              const target = event.target.value || null;
              if (editor) editor.updateStatus(riderId, "close_guard", target);
              else setLocalChoice({ squadStatus: "close_guard", protectedLeaderId: target });
            }}
          >
            <option value="">{availableLeaders.length > 0 ? "Choisir un leader" : "Aucun leader éligible"}</option>
            {availableLeaders.map(leader => <option key={leader.id} value={leader.id}>{leader.label}</option>)}
          </select>
        </label>
      ) : null}
    </div>
  );
  if(editor)return <div className={compact?"flex w-full min-w-0 xl:w-40":"flex flex-wrap items-end gap-2"}>{fields}</div>;
  return (
    <form action={updateRiderSquadStatusAction} className={compact?"flex min-w-52 items-center gap-1.5":"flex flex-wrap items-end gap-2"}>
      <input type="hidden" name="riderId" value={riderId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {fields}
      <button
        type="submit"
        disabled={isCloseGuard && !selectedLeader}
        aria-label="Enregistrer le statut dans l’effectif"
        className={[
          "min-h-9 rounded-lg px-3 text-[10px] font-black uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-60",
          dark
            ? "bg-[#F2C94C] text-[#183F37] hover:bg-[#FFDB63]"
            : "bg-[#176951] text-white hover:bg-[#0F5944]",
        ].join(" ")}
      >
        {compact ? "Valider" : "Enregistrer"}
      </button>
    </form>
  );
}
