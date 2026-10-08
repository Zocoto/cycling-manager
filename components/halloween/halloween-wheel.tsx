import { DEMONIC_WHEEL_COLORS as colors, DEMONIC_WHEEL_SPOKES } from "@/lib/game/halloween-wheel-art";

/** A bicycle tire, red rim and eight spokes, not a solid coin. */
export function DemonicWheelMark() {
  return <g data-demonic-wheel="red-black" strokeLinecap="round" strokeLinejoin="round">
    <path d="m7 11-2-7 8 3m14 0 8-3-2 7" fill={colors.rim} stroke={colors.tire} strokeWidth="1.2" />
    <circle cx="20" cy="21" r="16" fill={colors.tire} />
    <circle cx="20" cy="21" r="12.5" fill={colors.center} stroke={colors.rim} strokeWidth="2.2" />
    {DEMONIC_WHEEL_SPOKES.map(([x, y], index) => <path key={index} d={`M${20 + x * 3} ${21 + y * 3}L${20 + x * 11.3} ${21 + y * 11.3}`} stroke={colors.spoke} strokeWidth="1.2" />)}
    <circle cx="20" cy="21" r="3" fill={colors.tire} stroke={colors.rim} strokeWidth="1.5" />
    <path d="M11 10q4-3 8-3" fill="none" stroke={colors.spoke} strokeWidth="1" />
  </g>;
}

export function DemonicWheel({ size = 32, className = "" }: { size?: number; className?: string }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 40 40" width={size} height={size} className={`halloween-demonic-wheel ${className}`}><DemonicWheelMark /></svg>;
}
