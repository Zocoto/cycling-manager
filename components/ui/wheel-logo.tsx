type WheelLogoProps = {
  className?: string;
};

export function WheelLogo({ className = "" }: WheelLogoProps) {
  return (
    <span
      aria-hidden="true"
      className={`relative block h-7 w-7 shrink-0 rounded-full border-2 border-[#69D5AE] ${className}`}
    >
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[#69D5AE]/70" />

      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[#69D5AE]/70" />

      <span className="absolute left-[14%] top-[14%] h-[72%] w-px rotate-45 bg-[#69D5AE]/60" />

      <span className="absolute right-[14%] top-[14%] h-[72%] w-px -rotate-45 bg-[#69D5AE]/60" />

      <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#69D5AE]" />
    </span>
  );
}