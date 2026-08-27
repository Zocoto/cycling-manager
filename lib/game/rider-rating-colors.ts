import type { RiderRatingImportance } from "@/lib/game/rider-profile";

export function getRiderRatingColorClasses(
  value: number,
  importance: RiderRatingImportance = "primary",
): string {
  if (importance === "secondary") {
    if (value >= 95) return "border-[#C85460]/20 bg-[#F2D5D8] text-[#7B2C35]";
    if (value >= 90) return "border-[#D56A5F]/20 bg-[#F6DEDA] text-[#853C36]";
    if (value >= 85) return "border-[#DC944D]/20 bg-[#F8E4D2] text-[#76501B]";
    if (value >= 80) return "border-[#DFB354]/20 bg-[#FAEDCE] text-[#725513]";
    if (value >= 75) return "border-[#5D9870]/20 bg-[#D8E9DD] text-[#376448]";
    if (value >= 70) return "border-[#72A681]/20 bg-[#E0EDE3] text-[#456D51]";
    if (value >= 65) return "border-[#8DB798]/20 bg-[#E7F2E9] text-[#4B7357]";
    if (value >= 60) return "border-[#A5C6AD]/20 bg-[#EDF5EF] text-[#496B53]";
    if (value >= 55) return "border-[#BBD1C0]/20 bg-[#F2F7F3] text-[#526F59]";
    if (value >= 50) return "border-[#CDDCD1]/25 bg-[#F5F9F6] text-[#59715F]";
    return "border-[#E4EAE7] bg-[#F7F9F8] text-[#82958F]";
  }

  if (value >= 95) return "border-[#8F2230]/25 bg-[#B93847] text-white shadow-sm";
  if (value >= 90) return "border-[#A93632]/25 bg-[#C84E47] text-white shadow-sm";
  if (value >= 85) return "border-[#B96922]/25 bg-[#E58A3F] text-[#4F2A06] shadow-sm";
  if (value >= 80) return "border-[#C68E20]/25 bg-[#F2B94B] text-[#543600] shadow-sm";
  if (value >= 75) return "border-[#235E3F]/25 bg-[#2F7650] text-white shadow-sm";
  if (value >= 70) return "border-[#34714D]/25 bg-[#478D62] text-[#001B10] shadow-sm";
  if (value >= 65) return "border-[#55976A]/30 bg-[#72B385] text-[#153E27] shadow-sm";
  if (value >= 60) return "border-[#78B486]/30 bg-[#A7D6B2] text-[#194B2E] shadow-sm";
  if (value >= 55) return "border-[#9BC9A6]/35 bg-[#CCE8D3] text-[#28573A] shadow-sm";
  if (value >= 50) return "border-[#B7D8BF]/35 bg-[#E2F1E6] text-[#356246] shadow-sm";
  return "border-[#D9E3DE] bg-white text-[#48665F] shadow-sm";
}
