import Link from "@/components/ui/app-link";

type BackToOfficeLinkProps = {
  className?: string;
};

export function BackToOfficeLink({
  className = "",
}: BackToOfficeLinkProps) {
  return (
    <Link
      href="/jeu"
      className={`inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#176951]/20 bg-white/85 px-4 text-sm font-black text-[#176951] shadow-sm transition hover:-translate-y-0.5 hover:border-[#176951]/35 hover:bg-white hover:text-[#0B302B] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-offset-2 ${className}`}
    >
      <BackArrowIcon />
      Retour au bureau du DS
    </Link>
  );
}

function BackArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4 shrink-0"
      fill="none"
    >
      <path
        d="M16 10H4m0 0 4.5-4.5M4 10l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
