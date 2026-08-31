import type { ReactNode } from "react";

import Link from "@/components/ui/app-link";

type GameSectionTabColumns = 2 | 3 | 4 | 5 | 6;

const COLUMN_CLASSES: Record<GameSectionTabColumns, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 xl:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  6: "sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6",
};

type GameSectionTabsProps = {
  ariaLabel: string;
  columns: GameSectionTabColumns;
  children: ReactNode;
  className?: string;
  role?: "navigation" | "tablist";
  "data-tutorial-id"?: string;
};

type GameSectionTabContentProps = {
  active: boolean;
  label: string;
  description?: ReactNode;
  badge?: ReactNode;
};

export function GameSectionTabs({
  ariaLabel,
  columns,
  children,
  className = "",
  role = "navigation",
  "data-tutorial-id": tutorialId,
}: GameSectionTabsProps) {
  return (
    <nav
      aria-label={ariaLabel}
      data-tutorial-id={tutorialId}
      role={role === "tablist" ? "tablist" : undefined}
      className={`grid rounded-2xl border border-[#315B3E]/14 bg-white p-2 shadow-[0_14px_40px_rgba(19,60,46,0.09)] ${COLUMN_CLASSES[columns]} ${className}`}
    >
      {children}
    </nav>
  );
}

export function GameSectionTabLink({
  href,
  active,
  label,
  description,
  badge,
  title,
  prefetchOnIntent = false,
}: GameSectionTabContentProps & {
  href: string;
  title?: string;
  prefetchOnIntent?: boolean;
}) {
  return (
    <Link
      href={href}
      title={title}
      prefetchOnIntent={prefetchOnIntent}
      aria-current={active ? "page" : undefined}
      className={getTabClassName(active)}
    >
      <GameSectionTabContent
        active={active}
        label={label}
        description={description}
        badge={badge}
      />
    </Link>
  );
}

export function GameSectionTabButton({
  id,
  active,
  label,
  description,
  badge,
  ariaControls,
  onClick,
}: GameSectionTabContentProps & {
  id: string;
  ariaControls: string;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={ariaControls}
      onClick={onClick}
      className={getTabClassName(active)}
    >
      <GameSectionTabContent
        active={active}
        label={label}
        description={description}
        badge={badge}
      />
    </button>
  );
}

function GameSectionTabContent({
  active,
  label,
  description,
  badge,
}: GameSectionTabContentProps) {
  return (
    <>
      <span className="min-w-0">
        <span className="block text-sm font-black">{label}</span>
        {description ? (
          <span
            className={`mt-1 block text-xs font-semibold ${
              active ? "text-[#ABD5C2]" : "text-[#789087]"
            }`}
          >
            {description}
          </span>
        ) : null}
      </span>
      {badge ? (
        <span className="inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-[#C63F3F] px-1.5 text-[10px] font-black text-white">
          {badge}
        </span>
      ) : null}
    </>
  );
}

function getTabClassName(active: boolean) {
  return `flex min-w-0 items-start justify-between gap-3 rounded-xl px-5 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-inset ${
    active
      ? "bg-[#123F36] text-white shadow-[0_10px_25px_rgba(18,63,54,0.18)]"
      : "text-[#183F37] hover:bg-[#F0F7F3]"
  }`;
}
