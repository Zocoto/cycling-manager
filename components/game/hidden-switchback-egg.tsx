"use client";

import { useState, useTransition } from "react";

import { discoverHiddenSwitchbackAction } from "@/app/jeu/actions";

export function HiddenSwitchbackLink() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openEngraversRegister() {
    if (isPending || message) return;

    startTransition(async () => {
      const result = await discoverHiddenSwitchbackAction();
      setMessage(result.message);
    });
  }

  return (
    <div
      id="registre-des-graveurs"
      className="mt-7 flex flex-col items-end gap-1 border-t border-white/10 pt-4 text-right"
    >
      <button
        type="button"
        onClick={openEngraversRegister}
        disabled={isPending}
        className="text-[10px] font-semibold tracking-wide text-[#8FA99E]/70 underline decoration-[#8FA99E]/25 underline-offset-4 transition hover:text-[#73C9A6] focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#73C9A6]/35 disabled:cursor-wait disabled:opacity-60"
      >
        {isPending ? "Consultation du registre..." : "Registre des graveurs"}
      </button>

      {message ? (
        <p
          role="status"
          className="max-w-md text-xs font-bold leading-5 text-[#BDD1C7]"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
