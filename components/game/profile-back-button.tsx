"use client";

import { useRouter } from "next/navigation";

type ProfileBackButtonProps = {
  fallbackHref: string;
  tone?: "default" | "team";
  className?: string;
};

type ProfileBackRouter = {
  back: () => void;
  replace: (href: string) => void;
};

export function ProfileBackButton({
  fallbackHref,
  tone = "default",
  className = "",
}: ProfileBackButtonProps) {
  const router = useRouter();
  const toneClassName =
    tone === "team"
      ? "border-[var(--team-line)] bg-white/90 text-[var(--team-primary)] hover:border-[var(--team-secondary)] hover:text-[var(--team-secondary)] focus-visible:ring-[var(--team-primary)]"
      : "border-[#176951]/20 bg-white/90 text-[#176951] hover:border-[#176951]/40 hover:text-[#0B302B] focus-visible:ring-[#278B70]";

  return (
    <button
      type="button"
      aria-label="Retour à la page précédente"
      title="Retour à la page précédente"
      onClick={() =>
        navigateBackToProfileSource(
          router,
          window.history.length,
          fallbackHref,
        )
      }
      className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-black shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${toneClassName} ${className}`}
    >
      <BackArrowIcon />
      Retour
    </button>
  );
}

export function navigateBackToProfileSource(
  router: ProfileBackRouter,
  historyLength: number,
  fallbackHref: string,
): "history" | "fallback" {
  if (historyLength > 1) {
    router.back();
    return "history";
  }

  router.replace(fallbackHref);
  return "fallback";
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
