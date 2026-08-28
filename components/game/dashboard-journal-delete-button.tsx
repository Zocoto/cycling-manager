"use client";

import { useFormStatus } from "react-dom";

export function DashboardJournalDeleteButton({
  label,
  compact = false,
  confirmation,
  variant = "danger",
  fullWidth = false,
}: {
  label: string;
  compact?: boolean;
  confirmation?: string;
  variant?: "neutral" | "danger";
  fullWidth?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      title={label}
      aria-label={label}
      onClick={(event) => {
        if (confirmation && !window.confirm(confirmation)) {
          event.preventDefault();
        }
      }}
      className={
        compact
          ? "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#81948E] transition hover:bg-[#FDE8E9] hover:text-[#B62D39] disabled:cursor-wait disabled:opacity-45"
          : `${fullWidth ? "flex w-full" : "inline-flex"} min-h-9 items-center rounded-lg px-3 text-left text-[11px] font-black transition disabled:cursor-wait disabled:opacity-45 ${
              variant === "danger"
                ? "justify-start text-[#A12A34] hover:bg-[#FDE8E9]"
                : "justify-start text-[#315B3E] hover:bg-[#EDF5F2]"
            }`
      }
    >
      {pending ? (
        <span aria-hidden="true">…</span>
      ) : compact ? (
        <TrashIcon />
      ) : (
        label
      )}
    </button>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
    </svg>
  );
}
