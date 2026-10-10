import { DemonicWheelMark } from "./halloween-wheel";

function NightRider({ x, y, demon = false }: { x: number; y: number; demon?: boolean }) {
  return <g transform={`translate(${x} ${y})`} strokeLinecap="round" strokeLinejoin="round">
    {demon ? <path d="m-12-85-68 39 29-4 14 14 51-38Z" fill="#6C3C45" /> : null}
    {[-38, 40].map((wheel) => <g key={wheel}><circle cx={wheel} cy="-22" r="25" fill="#26252C" stroke="#CFC3AE" strokeWidth="4" /><path d={`M${wheel}-43v42m-21-21h42m-36-15 30 30m-30 0 30-30`} fill="none" stroke="#827A76" strokeWidth="1.3" /></g>)}
    <g fill="none" stroke={demon ? "#C97842" : "#B6BBA3"} strokeWidth="4"><path d="m-38-22 24-32 17 32h-41m24-32h42L3-22m37 0L26-62l10-5h6m-65 9h15" /></g>
    <g fill="none" strokeWidth="8"><path d="m-12-71 23 21L2-25m-14-46-12 27 12 20" stroke={demon ? "#3D3238" : "#E3AF88"} /><path d="m-10-73 17-19" stroke={demon ? "#4D3841" : "#C8834D"} strokeWidth="21" /><path d="m7-91 12 23 18 2" stroke={demon ? "#3D3238" : "#E3AF88"} strokeWidth="7" /></g>
    {demon ? <g><ellipse cx="15" cy="-111" rx="21" ry="19" fill="#D98746" stroke="#9D5D37" strokeWidth="1.5" /><path d="m7-127-3 16 3 17m16-33 3 16-3 17" fill="none" stroke="#A96538" strokeWidth="1.4" /><path d="m14-130 3-7" stroke="#9E9C76" strokeWidth="4" /><path d="m4-117 8 7H3m20-7 3 7h-9m-11 8 4 4 5-4 5 3 5-4" fill="#31232A" stroke="#31232A" strokeWidth="2" /></g> : <g><ellipse cx="16" cy="-111" rx="13" ry="16" fill="#E3AF88" /><circle cx="29" cy="-109" r="3" fill="#E3AF88" /><circle cx="22" cy="-114" r="1.6" fill="#40312E" /><path d="m21-104 5-1" stroke="#6D4C38" strokeWidth="1.4" /><path d="M0-122q13-20 32-5l-1 9q-14-7-28 1Z" fill="#E8DBC4" stroke="#B0AD93" strokeWidth="1.5" /><path d="m8-132 16 5" stroke="#7E8871" strokeWidth="3" /></g>}
  </g>;
}

/** The same approved rider, isolated for compact, static event decorations. */
export function HalloweenHeadlessRider({ decorative = false }: { decorative?: boolean }) {
  return <svg viewBox="-86 -143 156 150" role={decorative ? undefined : "img"} aria-label={decorative ? undefined : "L’équipier sans tête sur son vélo, à tête de citrouille."} aria-hidden={decorative || undefined} focusable="false" className="h-full w-full">
    <NightRider x={0} y={0} demon />
  </svg>;
}

export function HalloweenNightRide({ decorative = false }: { decorative?: boolean }) {
  return <svg viewBox="0 0 620 340" role={decorative ? undefined : "img"} aria-label={decorative ? undefined : "Deux cyclistes traversent une route nocturne sous la lune, dont un poursuivant à tête de citrouille."} aria-hidden={decorative || undefined} focusable="false">
    <rect width="620" height="340" fill="#29232E" />
    <circle cx="478" cy="65" r="57" fill="#453540" /><circle cx="478" cy="65" r="37" fill="#E8D3AD" /><circle cx="468" cy="53" r="6" fill="#D8C49F" /><circle cx="490" cy="72" r="9" fill="#D8C49F" />
    <path d="M0 221q124-95 225-31t213-29q91-47 182 4v175H0Z" fill="#3A303B" />
    <path d="M0 270q132-55 247-9t217-29q89-48 156-18v126H0Z" fill="#50404A" />
    <g fill="none" stroke="#211E27" strokeWidth="8" strokeLinecap="round"><path d="M31 260 38 136l-7-72m5 98-27-26-7-39m35 43 32-36 1-29M582 256l-11-142 8-74m-7 105 27-29 9-47m-34 45-32-28-3-31" /></g>
    <g fill="#201D26"><path d="M362 72q-9-11-21-8l6 8 5-1 10 7 10-7 5 1 6-8q-12-3-21 8Z" /><path d="M536 124q-6-7-14-5l4 5 4-1 6 5 6-5 4 1 4-5q-8-2-14 5Z" /></g>
    <path d="M0 313q150-10 278-44t342-6v77H0Z" fill="#796052" /><path d="M6 331q172-11 296-39t307-12" fill="none" stroke="#B3916D" strokeWidth="2" strokeDasharray="14 19" />
    <g transform="translate(68 23) scale(1.5)"><NightRider x={80} y={179} demon /><NightRider x={234} y={167} /></g>
    <g>{[338, 367, 396].map((x, index) => <g key={x} transform={`translate(${x - 10} ${159 - index * 4}) scale(.5)`}><DemonicWheelMark /></g>)}</g>
    <g transform="translate(535 283)"><path d="M16 2q0-8 6-10" fill="none" stroke="#9D9975" strokeWidth="3" /><path d="M16 2C-7-5-9 27 16 27S39-5 16 2Z" fill="#BC7342" stroke="#804E36" strokeWidth="1.5" /><path d="m7 12 4-4 2 5m5-1 4-4 2 5M9 18q7 6 14-1" fill="#30232A" stroke="#30232A" strokeWidth="1" /></g>
  </svg>;
}
