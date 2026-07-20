import Link from "next/link";

export function RankingBadge({
  rank,
  points,
  label = "Classement général",
  href = "/jeu/classements",
  dark = false,
}: {
  rank: number | null;
  points: number;
  label?: string;
  href?: string;
  dark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        dark
          ? "inline-flex items-center gap-3 rounded-xl border border-white/12 bg-white/7 px-4 py-3 transition hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
          : "inline-flex items-center gap-3 rounded-xl border border-[#315B3E]/12 bg-[#F3F8F5] px-4 py-3 transition hover:border-[#278B70]/40 hover:bg-[#EAF5F3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
      }
    >
      <span className={dark ? "text-2xl font-black text-[#F2C94C]" : "text-2xl font-black text-[#176951]"}>
        {rank ? `#${rank}` : "—"}
      </span>
      <span>
        <span className={dark ? "block text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#9BE0BC]" : "block text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#278B70]"}>
          {label}
        </span>
        <span className={dark ? "mt-1 block text-xs font-bold text-[#D6DFD2]" : "mt-1 block text-xs font-bold text-[#60756E]"}>
          {new Intl.NumberFormat("fr-FR").format(points)} points UCI
        </span>
      </span>
    </Link>
  );
}
