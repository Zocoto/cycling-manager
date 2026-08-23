import type { ReactNode } from "react";

export function ProfileDisclosure({
  title,
  description,
  tutorialId,
  children,
}: {
  title: string;
  description: string;
  tutorialId?: string;
  children: ReactNode;
}) {
  return (
    <details
      data-tutorial-id={tutorialId}
      className="group mt-4 overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-white shadow-[0_12px_34px_rgba(19,60,46,0.07)] sm:mt-5"
    >
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 marker:hidden transition hover:bg-[#F5FAF7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#278B70] sm:px-6 sm:py-4">
        <span className="min-w-0">
          <span className="block text-base font-black text-[#183F37] sm:text-lg">
            {title}
          </span>
          <span className="mt-0.5 block text-xs font-semibold leading-5 text-[#60756E]">
            {description}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#E8F7F1] px-3 py-2 text-[10px] font-black text-[#176951] sm:text-xs">
          <span className="group-open:hidden">Dérouler</span>
          <span className="hidden group-open:inline">Replier</span>
          <span
            aria-hidden="true"
            className="text-base transition-transform group-open:rotate-180"
          >
            ⌄
          </span>
        </span>
      </summary>
      <div className="min-w-0 border-t border-[#315B3E]/10 bg-[#F8FBF9] p-3 sm:p-5">
        {children}
      </div>
    </details>
  );
}

export function ProfileDisclosureSkeleton({ title }: { title: string }) {
  return (
    <div
      aria-busy="true"
      className="mt-4 flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-[#315B3E]/12 bg-white px-4 py-3 sm:mt-5 sm:px-6 sm:py-4"
    >
      <div>
        <p className="text-base font-black text-[#183F37] sm:text-lg">
          {title}
        </p>
        <div className="mt-2 h-2.5 w-44 animate-pulse rounded-full bg-[#E1ECE7]" />
      </div>
      <div className="h-9 w-24 animate-pulse rounded-full bg-[#E8F7F1]" />
    </div>
  );
}
