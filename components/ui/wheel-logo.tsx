type WheelLogoProps = {
  className?: string;
};

export function WheelLogo({ className = "" }: WheelLogoProps) {
  return (
    <span
      aria-hidden="true"
      className={`relative block h-9 w-9 shrink-0 rounded-full border-2 border-[#F2C94C] bg-[#071A17]/75 shadow-[0_0_18px_rgba(242,201,76,0.18)] ${className}`}
    >
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[#F2C94C]/75" />

      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[#F2C94C]/75" />

      <span className="absolute left-[14%] top-[14%] h-[72%] w-px rotate-45 bg-[#F2C94C]/55" />

      <span className="absolute right-[14%] top-[14%] h-[72%] w-px -rotate-45 bg-[#F2C94C]/55" />

      <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#071A17] bg-[#F2C94C]" />
    </span>
  );
}