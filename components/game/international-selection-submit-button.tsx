"use client";

import { useFormStatus } from "react-dom";

export function InternationalSelectionSubmitButton({
  children,
  pendingLabel,
  variant,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant: "confirm" | "decline";
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={
        variant === "confirm"
          ? "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#176951] px-5 py-3 text-sm font-black text-white transition hover:bg-[#0B302B] disabled:cursor-wait disabled:bg-[#8EAAA2]"
          : "inline-flex min-h-11 items-center justify-center rounded-xl border border-[#B94848]/25 bg-[#FFF1EF] px-5 py-3 text-sm font-black text-[#9A3434] transition hover:bg-[#FFE3DF] disabled:cursor-wait disabled:opacity-60"
      }
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
