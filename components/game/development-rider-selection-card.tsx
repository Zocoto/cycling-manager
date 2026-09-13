import type { DevelopmentRider } from "@/services/development-team";

import { DevelopmentRiderVisibleProfile } from "./development-rider-visible-profile";

export function DevelopmentRiderSelectionCard({
  rider,
  selected,
  disabled,
  onToggle,
}: {
  rider: DevelopmentRider;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      data-development-rider-choice
      className={`relative block cursor-pointer rounded-2xl border p-4 transition ${
        selected
          ? "border-[#176951] bg-[#E5F4ED] shadow-[inset_0_0_0_1px_#176951]"
          : disabled
            ? "cursor-not-allowed border-[#315B3E]/8 bg-[#F4F7F5] opacity-55"
            : "border-[#315B3E]/12 bg-[#FAFCFB] hover:border-[#176951]/45 hover:bg-white"
      }`}
    >
      <input
        type="checkbox"
        name="riderIds"
        value={rider.id}
        checked={selected}
        disabled={disabled}
        onChange={onToggle}
        className="sr-only"
      />

      <DevelopmentRiderVisibleProfile rider={rider} />
      <span
        aria-hidden="true"
        className={`absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full text-xs font-black ${
          selected
            ? "bg-[#176951] text-white"
            : "border border-[#315B3E]/20 bg-white text-transparent"
        }`}
      >
        ✓
      </span>
    </label>
  );
}
