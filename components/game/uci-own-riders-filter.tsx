"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";

export function UciOwnRidersFilter({
  checked,
  disabled,
}: {
  checked: boolean;
  disabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticChecked, setOptimisticChecked] = useOptimistic(checked);

  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-black text-[#183F37] has-disabled:cursor-default has-disabled:opacity-60">
      <input
        type="checkbox"
        checked={optimisticChecked}
        disabled={disabled || isPending}
        onChange={(event) => {
          const nextChecked = event.currentTarget.checked;
          startTransition(() => {
            setOptimisticChecked(nextChecked);
            router.replace(
              `/jeu/classements?circuit=uci&vue=individuel${nextChecked ? "&mes_coureurs=1" : ""}`,
              { scroll: false },
            );
          });
        }}
        className="h-5 w-5 shrink-0 accent-[#176951] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#278B70]"
      />
      Mes coureurs
    </label>
  );
}
