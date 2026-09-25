import { updateRiderSquadStatusAction } from "@/app/jeu/effectif/actions";
import {
  SQUAD_STATUS_OPTIONS,
  type SquadStatus,
} from "@/lib/game/squad-status";

export function SquadStatusEditor({
  riderId,
  status,
  returnTo,
  compact = false,
  tone = "light",
}: {
  riderId: string;
  status: SquadStatus | null;
  returnTo: string;
  compact?: boolean;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <form
      action={updateRiderSquadStatusAction}
      className={compact ? "flex min-w-36 items-center gap-1.5" : "flex flex-wrap items-end gap-2"}
    >
      <input type="hidden" name="riderId" value={riderId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className={compact ? "sr-only" : "min-w-52 flex-1"}>
        {!compact ? (
          <span className={dark ? "mb-1.5 block text-[10px] font-black uppercase tracking-wider text-[#9BE0BC]" : "mb-1.5 block text-[10px] font-black uppercase tracking-wider text-[#60756E]"}>
            Statut effectif
          </span>
        ) : null}
        <select
          name="squadStatus"
          defaultValue={status ?? ""}
          aria-label="Statut dans l’effectif"
          className={[
            "min-h-9 w-full rounded-lg border px-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[#42B99A]",
            dark
              ? "border-white/15 bg-[#102A25] text-white"
              : "border-[#315B3E]/15 bg-white text-[#183F37]",
          ].join(" ")}
        >
          <option value="">Non défini</option>
          {SQUAD_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className={[
          "min-h-9 rounded-lg px-3 text-[10px] font-black uppercase tracking-wide transition",
          dark
            ? "bg-[#F2C94C] text-[#183F37] hover:bg-[#FFDB63]"
            : "bg-[#176951] text-white hover:bg-[#0F5944]",
        ].join(" ")}
      >
        {compact ? "OK" : "Enregistrer"}
      </button>
    </form>
  );
}
