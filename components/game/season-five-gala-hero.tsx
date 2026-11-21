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
          <linearGradient id={`${id}-gold`} x1="368" y1="167" x2="406" y2="233" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F0D99C" /><stop offset=".43" stopColor="#D6B269" />
            <stop offset="1" stopColor="#927345" />
          </linearGradient>
          <linearGradient id={`${id}-skin`} x1="414" y1="173" x2="480" y2="239" gradientUnits="userSpaceOnUse">
            <stop stopColor="#D4B793" /><stop offset="1" stopColor="#AE8B67" />
          </linearGradient>
          <linearGradient id={`${id}-shorts`} x1="343" y1="210" x2="381" y2="268" gradientUnits="userSpaceOnUse">
            <stop stopColor="#254738" /><stop offset="1" stopColor="#12261E" />
          </linearGradient>
          <linearGradient id={`${id}-frame`} x1="336" y1="238" x2="433" y2="335" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A5B5A2" /><stop offset=".35" stopColor="#537666" />
            <stop offset="1" stopColor="#264E3E" />
          </linearGradient>
          <linearGradient id={`${id}-helmet`} x1="441" y1="124" x2="479" y2="147" gradientUnits="userSpaceOnUse">
            <stop stopColor="#567761" /><stop offset="1" stopColor="#173729" />
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

        <ellipse cx="400" cy="403" rx="159" ry="8" fill="#020905" fillOpacity=".4" />

        {/* Far leg and arm sit behind the bicycle and the near-side silhouette. */}
        <path d="M354 225C346 239 330 253 323 268C320 275 324 281 332 289L352 310L362 306L344 280L367 247Z"
          fill="#977E60" />
        <path d="M350 306L361 303L373 313Q378 315 375 320L356 319L346 313Z" fill="#C5C7B5" />
        <path d="M350 315L374 319" stroke="#69796B" strokeWidth="2.5" />
        <path d="M412 183C415 197 418 209 425 218L476 244Q482 248 487 241L435 208L429 182Z" fill="#947B5B" />

        <BicycleWheel x={292} y={331} />
        <BicycleWheel x={514} y={331} />

        {/* The two frame triangles, head tube and fork share real junctions. */}
        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="M292 331L363 244L390 332L292 331M363 244L470 244L482 280L390 332M470 244L514 331"
            stroke="#0B1912" strokeWidth="9" />
          <path d="M292 331L363 244L390 332L292 331" stroke={paint("frame")} strokeWidth="4.3" />
          <path d="M363 244H470L482 280L390 332L363 244" stroke={paint("frame")} strokeWidth="7" />
          <path d="M480 278Q494 306 514 331" stroke="#648573" strokeWidth="5" />
          <path d="M365 242H468M391 328L478 279" stroke="#C9C59E" strokeOpacity=".58" strokeWidth="1.1" />
          <path d="M363 244L356 223" stroke="#A3AC96" strokeWidth="4" />
          <path d="M343 224Q352 220 362 222L374 224Q377 225 372 228L346 228Q341 228 343 224Z" fill="#14291E" />
          <path d="M346 223H369" stroke="#C4B88E" strokeWidth="1.1" />
          <path d="M470 244L465 226H493" stroke="#8C9B85" strokeWidth="4.2" />
          <path d="M491 226Q516 225 517 238Q518 252 504 256H495" stroke="#A2AD98" strokeWidth="4" />
          <path d="M496 226Q513 226 514 238" stroke="#D1C599" strokeWidth="1.2" />
          <path d="M499 228L502 238" stroke="#182D21" strokeWidth="6" />
          <path d="M295 324L385 313Q411 314 410 333Q411 350 388 351L294 337" stroke="#98A48D" strokeOpacity=".65" strokeWidth="1.4" />
          <circle cx="292" cy="331" r="7.4" fill="#233D2C" stroke="#A5AB8F" strokeWidth="1.2" />
          <circle cx="390" cy="332" r="19.5" fill="#14271B" stroke="#A5AE96" strokeWidth="1.5" />
          <circle cx="390" cy="332" r="13" stroke="#697C63" strokeWidth="1" />
          <path d="M390 332L366 317M390 332L417 346" stroke="#C7C9AD" strokeWidth="3" />
          <path d="M357 317H372M410 346H425" stroke="#0A1811" strokeWidth="4" />
          <circle cx="390" cy="332" r="3.8" fill="#A2AC91" />
          <path d="M405 307L421 290" stroke="#C8BC8C" strokeWidth="5" />
          <path d="M407 307L410 311L424 296L422 291" stroke="#74917B" strokeWidth="2" />
        </g>

        {/* Sculpted shapes, rather than a stroke skeleton, define the rider. */}
        <path d="M364 236C381 243 400 253 412 265C418 272 420 282 419 292L417 326L408 329L404 290L389 275L350 251Z"
          fill={paint("skin")} />
        <path d="M410 326L419 324L425 333L438 338Q440 341 437 344L412 342L403 336Z" fill="#E0DDC0" />
        <path d="M409 339L437 342M417 330L424 334" stroke="#8C9A7E" strokeWidth="1.8" />
        <path d="M345 214C354 213 366 218 379 228L395 247L383 267L367 258L354 244L336 245Q335 228 345 214Z"
          fill={paint("shorts")} />
        <path d="M344 239L358 238M373 254L387 258" stroke="#C5AF74" strokeWidth="2.5" />
        <path d="M357 224Q371 232 382 247" stroke="#48634C" strokeWidth="1.4" />

        <path d="M344 213C350 193 365 179 383 170C399 162 416 159 428 170L440 186L424 204L413 197C398 202 381 215 369 233L345 225Z"
          fill={paint("gold")} />
        <path d="M345 214C365 212 390 195 410 179L420 165C409 161 397 163 383 170C365 179 351 194 345 211Z"
          fill="#F3DFAB" fillOpacity=".28" />
        <path d="M351 222C369 208 388 192 407 183" stroke="#977A48" strokeWidth="1.1" strokeOpacity=".7" />
        <path d="M370 230C383 212 400 199 413 196L424 203" stroke="#F1D797" strokeWidth="1.2" strokeOpacity=".55" />
        <path d="M372 190L378 187M369 196L374 193" stroke="#FFF0BC" strokeOpacity=".45" strokeWidth="1" />
        <path d="M408 178L424 190" stroke="#29503A" strokeWidth="6" />
        <path d="M407 177L423 189" stroke="#F1DB9C" strokeWidth="1.1" />

        <path d="M430 190L440 185C446 195 447 206 453 211L488 225L496 225L502 229L501 236L490 235L446 220C440 217 437 211 434 205Z"
          fill={paint("skin")} />
        <path d="M438 198Q441 211 448 215L484 229" stroke="#E9CEAA" strokeOpacity=".6" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M492 225L499 226L504 231L502 237L493 235L489 230Z" fill="#233D2D" />
        <path d="M498 229L501 232" stroke="#BAAF82" strokeWidth="1.5" strokeLinecap="round" />

        <path d="M426 171L438 154L450 158L444 178L437 184Z" fill="#B59672" />
        <path d="M443 137C451 131 463 133 472 141L479 149L475 154L473 162Q469 169 461 166L450 159L444 150Z"
          fill="#D1B490" />
        <path d="M475 150L478 151L474 154M464 159L471 160" stroke="#927857" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M444 146L468 149L472 153L462 156L450 151Z" fill="#183529" />
        <path d="M449 147L465 150" stroke="#D9CD9F" strokeWidth="1.1" />
        <path d="M442 142L451 160L461 168" stroke="#2E4630" strokeWidth="1.7" strokeLinecap="round" />

        <path d="M435 139C439 124 450 117 463 121C475 124 480 133 484 142L477 145L461 142L447 145Z"
          fill={paint("helmet")} stroke="#739377" strokeWidth="1" />
        <path d="M442 131C454 125 465 127 475 136" stroke="#E3C787" strokeWidth="4.4" strokeLinecap="round" />
        <path d="M449 126L454 138M459 126L465 139M469 131L474 140" stroke="#203B2B" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M439 141L455 141L476 144" stroke="#A9B895" strokeWidth="1" strokeLinecap="round" />

        {/* Small highlights connect the rider to the illuminated setting. */}
        <path d="M257 279Q292 258 326 278M480 276Q515 255 548 277" stroke="#EAD39B" strokeOpacity=".19" strokeWidth="1" />
        <path d="M201 317H240M220 307H251" stroke="#C9C8A4" strokeOpacity=".19" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function BicycleWheel({ x, y }: { x: number; y: number }) {
  return (
    <g data-gala-s5-wheel transform={`translate(${x} ${y})`}>
      <circle r="67" fill="#10251B" fillOpacity=".32" stroke="#070F0A" strokeWidth="7" />
      <circle r="62.2" stroke="#9AA78F" strokeOpacity=".78" strokeWidth="1.5" />
      <circle r="59.3" stroke="#4F6A55" strokeOpacity=".6" strokeWidth="1" />
      <g stroke="#9BA78D" strokeOpacity=".28" strokeWidth=".65">
        {Array.from({ length: 12 }, (_, index) => {
          const angle = index * Math.PI / 6;
          // Browser and server Math implementations can differ at the last bit.
          // Fixed precision keeps the decorative SVG identical during hydration.
          return <path key={index} d={`M0 0L${(Math.cos(angle) * 61).toFixed(3)} ${(Math.sin(angle) * 61).toFixed(3)}`} />;
        })}
      </g>
      <circle r="4" fill="#B8BDA1" />
      <path d="M-38-51A63.5 63.5 0 0 1 34-54" stroke="#E7D7A6" strokeOpacity=".35" strokeWidth="1.2" />
    </g>
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
