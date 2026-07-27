import type { RiderRatingImportance } from "@/lib/game/rider-profile";

export function getRiderRatingColorClasses(
  value: number,
  importance: RiderRatingImportance = "primary",
): string {
  if (importance === "secondary") {
    if (value > 90) return "border-[#D84B4B]/18 bg-[#F8DADA] text-[#8D3A3A]";
    if (value > 80) return "border-[#D9983E]/20 bg-[#FCE8CA] text-[#80500E]";
    if (value >= 70) return "border-[#69A87B]/20 bg-[#DDEDE1] text-[#356846]";
    if (value >= 60) return "border-[#9CCBA8]/20 bg-[#E9F3EC] text-[#4B7557]";
    if (value >= 50) return "border-[#BFD9C6]/25 bg-[#F0F6F2] text-[#5A7863]";
    return "border-[#E4EAE7] bg-[#F7F9F8] text-[#82958F]";
  }

  if (value > 90) return "border-[#B52D2D]/25 bg-[#D84B4B] text-white shadow-sm";
  if (value > 80) return "border-[#C67817]/25 bg-[#F4B04D] text-[#5B3100] shadow-sm";
  if (value >= 70) return "border-[#286C40]/25 bg-[#3F8F5A] text-white shadow-sm";
  if (value >= 60) return "border-[#65B478]/30 bg-[#A9DFB7] text-[#174E2A] shadow-sm";
  if (value >= 50) return "border-[#9FD5AC]/35 bg-[#DDF3E3] text-[#2C6A3F] shadow-sm";
  return "border-[#D9E3DE] bg-white text-[#48665F] shadow-sm";
}