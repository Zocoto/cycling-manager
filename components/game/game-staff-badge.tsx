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
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 align-middle text-[9px] font-black leading-3 uppercase tracking-[0.05em] shadow-[0_1px_4px_rgba(119,82,13,0.16)] ${
        inverse
          ? "border-[#F1D06B]/80 bg-[#F2D477] text-[#35280D]"
          : "border-[#B89029]/70 bg-[#FFF0B0] text-[#4A340A]"
      } ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 12 12" fill="none" className="h-3 w-3 shrink-0">
        <path d="M6 1 10 2.5v3C10 8 8.5 9.8 6 11 3.5 9.8 2 8 2 5.5v-3L6 1Z" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.2" />
        <path d="m4.2 5.7 1.2 1.2 2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Équipe du jeu
    </span>
  );
}
