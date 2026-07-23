export function getRiderRatingColorClasses(value: number): string {
  if (value > 90) {
    return "border-[#B52D2D]/25 bg-[#D84B4B] text-white";
  }

  if (value > 80) {
    return "border-[#C67817]/25 bg-[#F4B04D] text-[#5B3100]";
  }

  if (value >= 70) {
    return "border-[#286C40]/25 bg-[#3F8F5A] text-white";
  }

  if (value >= 60) {
    return "border-[#65B478]/30 bg-[#A9DFB7] text-[#174E2A]";
  }

  if (value >= 50) {
    return "border-[#9FD5AC]/35 bg-[#DDF3E3] text-[#2C6A3F]";
  }

  return "border-[#D9E3DE] bg-white text-[#60756E]";
}
