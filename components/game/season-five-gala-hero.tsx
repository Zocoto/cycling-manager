"use client";

import { useId } from "react";

/** Decorative, static artwork: no images to download or animation to run. */
export function SeasonFiveGalaHero({ className }: { className?: string }) {
  const id = useId();
  const paint = (name: string) => `url(#${id}-${name})`;

  return (
    <div className={className} aria-hidden="true" data-gala-s5-hero>
      <svg viewBox="0 0 660 440" fill="none" focusable="false"
        style={{ display: "block", width: "100%", height: "auto" }}>
        <defs>
          <radialGradient id={`${id}-halo`}>
            <stop stopColor="#B8A36C" stopOpacity=".15" />
            <stop offset="1" stopColor="#B8A36C" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-ridge`} x1="350" y1="169" x2="350" y2="363" gradientUnits="userSpaceOnUse">
            <stop stopColor="#324D3D" /><stop offset="1" stopColor="#142A20" />
          </linearGradient>
          <linearGradient id={`${id}-road`} x1="400" y1="330" x2="379" y2="448" gradientUnits="userSpaceOnUse">
            <stop stopColor="#5F6650" stopOpacity=".2" /><stop offset="1" stopColor="#101D16" stopOpacity=".05" />
          </linearGradient>
        </defs>

        {/* A winter landscape in the same forest green and champagne palette. */}
        <ellipse cx="403" cy="210" rx="290" ry="210" fill={paint("halo")} />
        <circle cx="536" cy="118" r="36" fill="#D8C58E" fillOpacity=".07" />
        <circle cx="536" cy="118" r="34" stroke="#D8C58E" strokeOpacity=".17" />
        <path d="M35 292L126 204L179 249L282 133L362 218L417 181L509 268L566 212L660 284"
          stroke="#9EB3A0" strokeOpacity=".15" strokeWidth="1.2" />
        <path d="M42 326L149 249L211 286L300 187L381 274L452 223L558 305L623 270L660 291V440H42Z"
          fill={paint("ridge")} />
        <path d="M244 247L300 187L336 225L309 213L300 219L290 210L275 232L269 227Z"
          fill="#A9B8A4" fillOpacity=".19" />
        <path d="M0 368C110 308 152 328 243 319C355 307 393 316 478 294C544 277 595 295 660 311V440H0Z"
          fill="#12281E" />
        <path d="M0 405C137 360 210 398 335 366C467 333 520 363 660 332V440H0Z" fill="#0B1C14" />

        <g fill="#244231" stroke="#7E977C" strokeOpacity=".09" strokeWidth=".8">
          <Pine x={108} y={270} scale={.92} />
          <Pine x={162} y={277} scale={.57} />
          <Pine x={584} y={205} scale={1.36} />
          <Pine x={626} y={251} scale={1.04} />
          <Pine x={561} y={260} scale={.63} />
        </g>
        <g fill="#0D2117">
          <Pine x={63} y={330} scale={1.05} />
          <Pine x={644} y={315} scale={1.18} />
        </g>
        <path d="M191 440C267 405 397 396 660 402V440Z" fill={paint("road")} />
        <path d="M149 409C316 397 438 397 631 404" stroke="#D8C28A" strokeOpacity=".16" />
        <path d="M79 397H148M116 388H195M181 420H240" stroke="#B7BB9E" strokeOpacity=".15" strokeLinecap="round" />

        {/* Warm bulbs are geometry, without a costly glow filter. */}
        <path d="M28 33Q329 135 641 31" stroke="#B1A06B" strokeOpacity=".63" strokeWidth="1.1" />
        {[
          [75, 48], [142, 67], [211, 81], [281, 87], [352, 87],
          [422, 81], [491, 68], [559, 51], [620, 37],
        ].map(([x, y]) => (
          <g key={x}>
            <path d={`M${x} ${y}v6`} stroke="#A69A6C" strokeWidth="1" />
            <circle cx={x} cy={y + 10} r="10" fill="#EACD8B" fillOpacity=".045" />
            <circle cx={x} cy={y + 10} r="5.6" fill="#EACD8B" fillOpacity=".09" />
            <ellipse cx={x} cy={y + 10} rx="2.3" ry="3.1" fill="#F3DBA5" />
          </g>
        ))}
        <g fill="#D8D8BD" fillOpacity=".3">
          <circle cx="198" cy="151" r="1" /><circle cx="572" cy="172" r="1.1" />
          <circle cx="115" cy="158" r=".8" /><circle cx="354" cy="119" r=".8" />
          <circle cx="603" cy="121" r=".8" /><circle cx="238" cy="233" r="1" />
        </g>

      </svg>
    </div>
  );
}

function Pine({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M0 0L-12 24L-6 22L-22 43L-12 40L-31 63L-17 59L-37 81Q0 91 37 81L17 59L31 63L12 40L22 43L6 22L12 24Z" />
      <path d="M0 64V91" stroke="#596343" strokeOpacity=".4" strokeWidth="3" />
    </g>
  );
}
