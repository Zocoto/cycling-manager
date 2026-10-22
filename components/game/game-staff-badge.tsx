/** Visual identification only. This badge never grants a permission. */
export function GameStaffBadge({
  inverse = false,
  className = "",
}: {
  inverse?: boolean;
  className?: string;
}) {
  return (
    <span
      data-game-staff-badge="true"
      title="Membre de l’équipe du jeu Cyclo Stratège"
      aria-label="Équipe du jeu"
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 align-middle text-[8px] font-bold uppercase tracking-[0.07em] ${
        inverse
          ? "border-[#9BE0BC]/35 bg-[#9BE0BC]/8 text-[#B9EBD2]"
          : "border-[#278B70]/25 bg-[#EAF5F0]/70 text-[#176951]"
      } ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5">
        <path d="M6 1 10 2.5v3C10 8 8.5 9.8 6 11 3.5 9.8 2 8 2 5.5v-3L6 1Z" stroke="currentColor" strokeWidth="1.1" />
        <path d="m4.2 5.7 1.2 1.2 2.5-2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Équipe du jeu
    </span>
  );
}
