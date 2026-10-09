import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode, type SVGProps } from "react";
import Image from "next/image";

import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";
import { DEFAULT_SPORTING_DIRECTOR_AVATAR, encodeSportingDirectorAvatar } from "@/lib/sporting-director-avatar";
import type { HalloweenPreviewArt } from "@/lib/game/halloween-catalog";
import { HALLOWEEN_FINAL_FRAME_IMAGE } from "@/lib/game/halloween-final-frame";

const INK = "#302723";
const ORANGE = "#D97B3E";
const CREAM = "#F5E5C9";
const common = { fill: "none", stroke: CREAM, strokeWidth: 4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function SpiderWeb({ className = "" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 60 60" fill="none" className={className}>
    <g stroke="currentColor" strokeWidth="1.2" opacity=".7">
      <path d="M3 3h54M3 3v54M3 3l45 45M3 3l51 21M3 3l21 51" />
      <path d="M3 15q4-2 8-1t5-11M3 27q8-5 17-4t8-20M3 40q14-7 24-6t13-31M3 53q16-8 31-8t18-42" />
    </g>
  </svg>;
}

export function Candy({ color = ORANGE, className = "" }: { color?: string; className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 64 40" width="64" height="40" className={className}>
    <path d="m21 15-15-7 2 12-2 12 15-7m22-10 15-7-2 12 2 12-15-7" fill={color} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
    <rect x="18" y="10" width="29" height="20" rx="10" fill={color} stroke={INK} strokeWidth="1.8" />
    <path d="m30 12-6 16m16-16-6 16" stroke={CREAM} strokeWidth="2" opacity=".55" />
  </svg>;
}

/** Reuse the actual avatar drawing; this private composition never changes saved avatars. */
function nativeSvg(avatarKey: string): ReactElement<SVGProps<SVGSVGElement>> {
  const tree = SportingDirectorAvatar({ avatarKey });
  function find(node: ReactNode): ReactElement<SVGProps<SVGSVGElement>> | null {
    for (const child of Children.toArray(node)) {
      if (!isValidElement(child)) continue;
      if (child.type === "svg") return child as ReactElement<SVGProps<SVGSVGElement>>;
      const result = find((child.props as { children?: ReactNode }).children);
      if (result) return result;
    }
    return null;
  }
  const svg = find(tree);
  if (!svg) throw new Error("Le portrait natif est indisponible pour cet aperçu.");
  return svg;
}

export function NativeAvatarPreview({
  art, avatarKey = "director_m_01", ghost = false, className = "",
}: { art?: HalloweenPreviewArt; avatarKey?: string; ghost?: boolean; className?: string }) {
  const id = `halloween-portrait-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const base = nativeSvg(avatarKey);
  const children = Children.toArray(base.props.children);
  return <svg role="img" aria-label={`Avatar du jeu${art ? ` · accessoire ${art}` : " · sans accessoire"}`} viewBox="0 0 120 120" className={`halloween-native-avatar ${className}`} data-halloween-portrait={art ?? "original"}>
    <defs><clipPath id={id}><circle cx="60" cy="60" r="59" /></clipPath></defs>
    <g clipPath={`url(#${id})`}>
      {art === "moon" ? <>
        <circle cx="60" cy="60" r="60" fill="#3A3540" />
        <circle cx="87" cy="24" r="12" fill="#F2DCA9" />
        <path d="M0 95 24 68l22 17 25-31 49 36v30H0Z" fill="#504653" />
        <path d="M85 56c5-6 9-5 13-1l5-5-2 9-5 2-7-1-4-4Z" fill="#28222C" />
      </> : children.slice(0, 3)}
      {children.slice(3)}
      {art === "vlad" || art === "vampire" ? <g data-halloween-accessory="vlad">
        <path d="M9 120c3-20 17-33 33-39L60 103l18-22c16 6 30 19 33 39Z" fill="#24212A" />
        <path d="m41 81-11-17-5 26 23 30H57L46 91Zm38 0 11-17 5 26-23 30H63L74 91Z" fill="#602A3A" />
        <path d="m42 82 18 21 18-21-11 38H53Z" fill="#F4E9D7" />
        <path d="m29 66 9 16 18 30-10 7-21-29Zm62 0-9 16-18 30 10 7 21-29Z" fill="#2D2732" />
        <circle cx="60" cy="99" r="4.2" fill="#D0A255" />
        <path d="M60 96v6m-3-3h6" stroke="#70522C" strokeWidth="1" />
      </g> : null}
      {art === "vampire" ? <g data-halloween-accessory="vampire">
        <path d="m51 69 3 7 3-7m7 0 3 7 3-7" fill="#FFF5DD" stroke="#7E3E43" strokeWidth=".6" />
        <path d="m45 46 8-1m13 0 8 1" fill="none" stroke="#9C4F50" strokeWidth="1.6" />
      </g> : null}
      {art === "mummy" ? <g data-halloween-accessory="mummy" fill="#E8DEC9" stroke="#AA9C88" strokeWidth=".8">
        <path d="M35 24q26-18 51 1l-2 9q-25-13-50 0Z" /><path d="m33 34 52-4 2 10-54 3Z" />
        <path d="m32 51 56 4-2 10-54-4Z" /><path d="m34 63 51-1-2 10-47 2Z" />
        <path d="m37 76 43-5-7 13-16 4-17-7Z" /><path d="m23 98 34-8 38 7 9 13-83 2Z" /><path d="m16 114 89-8 5 14H12Z" />
        <path d="m37 32 40-3m-37 9 37-3m-38 22 40 4m-37 8 34-3m-17 16 11-3m-36 23 27-3m-30 17 62-5" fill="none" />
      </g> : null}
      {art === "cap" ? <g data-halloween-accessory="cap">
        <path d="M31 26C34 7 83 6 89 26L84 33H34Z" fill={ORANGE} stroke="#A65E32" strokeWidth="1.5" />
        <path d="m33 29-8 7c17 4 44 4 66-4l-7-4Z" fill="#B9602D" />
        <path d="m54 19 3 3h-6Zm11 0 3 3h-6ZM53 25q7 5 15-1" fill={INK} stroke={INK} strokeWidth="1" />
      </g> : null}
      {art === "bat" ? <path data-halloween-accessory="bat" d="M82 99c-5-7-12-5-14-8v10l7-1 6 5 6-5 7 1V91c-3 4-8 1-12 8Z" fill="#302B38" stroke="#C6AA89" strokeWidth=".8" /> : null}
      {art === "trident" ? <g data-halloween-accessory="trident" fill="none" stroke="#A7433E" strokeLinecap="round" strokeLinejoin="round">
        <path d="M98 117V74m-9-15v11q0 7 9 7t9-7V59m-9-6v24" strokeWidth="3" />
        <path d="m86 61 3-6 3 6m3-6 3-6 3 6m3 6 3-6 3 6" strokeWidth="2" />
        <circle cx="98" cy="88" r="4" stroke="#D4AF71" strokeWidth="1.4" />
      </g> : null}
      {art === "scarf" ? <g data-halloween-accessory="scarf">
        <path d="M42 84q17 15 36 0l3 8q-20 16-41 1Z" fill="#E6DCCC" stroke="#B4A99A" strokeWidth="1" />
        <path d="m69 94 10 3-1 21-12-2Z" fill="#E6DCCC" /><path d="m68 115 9 1m-8-9 9 1" stroke="#847D77" strokeWidth="1.3" />
      </g> : null}
    </g>
    <circle cx="60" cy="60" r="58.5" fill="none" stroke={art === "wheel" ? "#C88352" : "#D9D2C6"} strokeWidth={art === "wheel" ? 3 : 1} />
    {art === "wheel" ? <g stroke="#B97C55" strokeWidth="1.4"><path d="M60 2v6m0 104v6M2 60h6m104 0h6M19 19l5 5m72 72 5 5M19 101l5-5m72-72 5-5" /></g> : null}
    {art === "web" ? <svg x="71" y="0" width="48" height="48" viewBox="0 0 60 60" color="#B58A63"><SpiderWeb /></svg> : null}
    {ghost ? <g data-halloween-accessory="ghost" transform="translate(84 77)">
      <path d="M0 18V8C0-3 20-3 20 8v18l-5-4-5 4-5-4-5 4Z" fill="#F5EFE3" stroke="#B9AB98" strokeWidth="1.2" />
      <circle cx="6" cy="9" r="1.5" fill={INK} /><circle cx="14" cy="9" r="1.5" fill={INK} />
    </g> : null}
  </svg>;
}

export function HalloweenChild() {
  const avatar = encodeSportingDirectorAvatar({ ...DEFAULT_SPORTING_DIRECTOR_AVATAR,
    skinTone: "fair", faceShape: "round", hairStyle: "crop", facialHair: "none", glasses: "none", cheekStyle: "freckles", mouthShape: "smile" });
  const svg = nativeSvg(avatar);
  // Keep the native face/neck/hair, not the adult director's jacket and shirt.
  const children = Children.toArray(svg.props.children).filter((_, index) => index >= 3 && index !== 4 && index !== 5);
  return <svg role="img" aria-label="Un enfant déguisé en cycliste tend un bonbon orange et un bonbon violet, un dans chaque main." viewBox="0 0 320 270" className="halloween-child">
    <path d="M109 121 94 253h132l-17-132Z" fill="#342F36" />
    <path d="M145 108h30v24h-30Z" fill="#DDAA91" />
    <path d="M110 129q21-16 37-10l13 12 13-12q18-5 39 10l-10 59H118Z" fill={ORANGE} stroke="#B96735" strokeWidth="1.5" />
    <path d="m110 130-37 32 13 17 42-23m84-26 35 32-13 17-42-23" fill={ORANGE} stroke="#B96735" strokeWidth="1.5" />
    <path d="m76 158-18-5-18 3q-5 3-1 7l20 2-21 1q-5 3 0 6l22 2-17 2q-4 3 1 6l19-1q-4 5 0 7l14-4 13-10Z" fill="#EDC09F" stroke="#D69A75" strokeWidth="1.4" />
    <path d="m244 158 18-5 18 3q5 3 1 7l-20 2 21 1q5 3 0 6l-22 2 17 2q4 3-1 6l-19-1q4 5 0 7l-14-4-13-10Z" fill="#EDC09F" stroke="#D69A75" strokeWidth="1.4" />
    <path d="M159 132v52M148 120l12 12 13-12" fill="none" stroke="#443530" strokeWidth="2.2" />
    <path d="M117 184h86l-5 38h-27l-11-20-10 20h-28Z" fill="#3A3539" />
    <path d="m122 222 5 39h22l1-39m21 0 2 39h22l3-39" fill="#EDC09F" />
    <path d="M127 242h22v21h-21m45-21h22v21h-21" fill="#F2E8D6" />
    <path d="M128 259h22v8h-27m51-8h22l5 8h-27" fill="#332F34" />
    {cloneElement(svg, { x: 103, y: 15, width: 114, height: 112, viewBox: "24 8 72 77", className: undefined, "aria-hidden": true }, children)}
    <path d="M115 42C115 7 205 7 205 42l-10 7q-36-12-70 0Z" fill="#35353A" stroke="#222328" strokeWidth="1.8" />
    <path d="M133 24 130 38m18-20-1 18m14-19v18m14-17 2 18m11-12 3 13" stroke="#191C1D" strokeWidth="5" strokeLinecap="round" />
    <g transform="translate(45 144)"><Candy /></g>
    <g transform="translate(211 144)"><Candy color="#857086" /></g>
    <circle cx="181" cy="163" r="7" fill="#F0C590" />
    <path d="m178 161 1.5 2-3 0Zm6 0 1.5 2-3 0ZM177 165q4 3 8-1" fill={INK} stroke={INK} strokeWidth=".7" />
  </svg>;
}

/** A small, static native drawing: scenery stays behind the unchanged child. */
export function HalloweenCandyScene({ children }: { children?: ReactNode } = {}) {
  return <div className="halloween-candy-scene" data-halloween-scene="candy">
    <svg aria-hidden="true" focusable="false" viewBox="0 0 420 315" className="halloween-candy-backdrop">
      <rect width="420" height="315" fill="#3D3540" />
      <circle cx="78" cy="55" r="24" fill="#E8D7BA" />
      <circle cx="71" cy="49" r="4" fill="#D5C3A8" />
      <circle cx="88" cy="61" r="6" fill="#D5C3A8" />
      <g fill="#28252E" stroke="#28252E" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M262 48q-8-10-18-7l5 7 5-1 8 6 8-6 5 1 5-7q-10-3-18 7Z" />
        <path d="M330 79q-6-8-14-5l4 5 4-1 6 5 6-5 4 1 4-5q-8-3-14 5Z" />
      </g>
      <path d="M0 209q67-36 129-11t122-6q87-39 169-5v128H0Z" fill="#4E424A" />
      <g fill="#302C34" stroke="#24232B" strokeWidth="1.6" strokeLinejoin="round">
        <path d="m74 195 3-43 24-22 29 24-3 41Z" />
        <path d="m70 153 32-30 34 32-9-2-27-20-23 24Z" fill="#29262F" />
        <path d="m115 143 1-16 7 1-1 19Z" />
        <path d="M320 226v-17q0-13 17-13t17 13v17Z" />
        <path d="M363 231v-11q0-10 12-10t12 10v11Z" />
      </g>
      <path d="M93 154h8v12h-8Zm18 20h6v11h-6Z" fill="#BE9661" />
      <g fill="none" stroke="#29262E" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M25 259 31 159 23 110 27 48M30 169 54 142l8-37M26 130 6 107V78M27 87 47 63l-1-24M30 181 10 165M389 259l-8-103 13-66-6-52M382 174l-26-27-10-33M389 125l26-21 5-35M391 85l-23-17-1-30" />
      </g>
      <path d="M0 258q83-20 151-6t132-5q79-18 137 3v65H0Z" fill="#62514C" />
      <path d="M163 252q37-14 72 0l42 63H113Z" fill="#776253" />
      <ellipse cx="210" cy="289" rx="74" ry="9" fill="#41383A" />
      <g transform="translate(35 261)" stroke="#784934" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M13 4q-3-7 3-10" fill="none" stroke="#ACA080" strokeWidth="3" strokeLinecap="round" />
        <path d="M13 3C-8-4-10 27 13 27 36 27 34-4 13 3Z" fill={ORANGE} />
        <path d="M11 4q-7 12 0 22m5-22q7 12 0 22" fill="none" />
        <path d="m5 12 4-4 2 5m5-1 4-4 2 5M7 18q6 5 12-1" fill={INK} stroke={INK} strokeWidth="1" />
      </g>
      <g transform="translate(363 271) scale(.8)" stroke="#784934" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M13 4q0-8 5-9" fill="none" stroke="#ACA080" strokeWidth="3" strokeLinecap="round" />
        <path d="M13 3C-8-4-10 27 13 27 36 27 34-4 13 3Z" fill="#BD7043" />
        <path d="M11 4q-7 12 0 22m5-22q7 12 0 22" fill="none" />
        <path d="m5 12 4-4 2 5m5-1 4-4 2 5M7 18q6 5 12-1" fill={INK} stroke={INK} strokeWidth="1" />
      </g>
      <path d="M0 25h34M0 0l39 40M0 0v45M0 0l50 18M0 0l18 50M0 17q9-4 14-3t4-14M0 33q16-7 25-5t9-28" fill="none" stroke="#B3A090" strokeWidth="1" opacity=".45" />
    </svg>
    <HalloweenChild />
    {children}
  </div>;
}

export function HalloweenItemIllustration({ art, name }: { art: HalloweenPreviewArt; name: string }) {
  if (art === "headless-frame") {
    return <div className="halloween-item-art halloween-frame-art" data-halloween-art={art}>
      <Image src={HALLOWEEN_FINAL_FRAME_IMAGE} alt={`${name} : cadre noir profond et fourche dans la brume`} width={1280} height={800} sizes="(max-width: 700px) 90vw, (max-width: 950px) 80vw, 40vw" />
    </div>;
  }
  return <div className="halloween-item-art" data-halloween-art={art}>
    <svg viewBox="0 0 320 112" role="img" aria-label={`Illustration de ${name}`}>
      <rect width="320" height="112" fill="#302823" />
      <circle cx="29" cy="18" r="54" fill="#5C4030" opacity=".45" />
      <circle cx="293" cy="100" r="76" fill="#D97B3E" opacity=".08" />
      <path d="M18 88c47-14 78 5 117-4 42-10 73-33 167-31" fill="none" stroke="#E8B17C" strokeWidth="2" strokeDasharray="5 7" opacity=".18" />
      <g transform="translate(112 8)">{itemDrawing(art)}</g>
    </svg>
  </div>;
}

function itemDrawing(art: HalloweenPreviewArt): ReactNode {
  switch (art) {
    case "youth-fountain": return <g {...common}><path d="M38 16h20v18l15 16v29c0 12-50 12-50 0V50l15-16Z" fill="#715163" /><path d="M36 16V7h24v9M31 29h34" stroke="#D7B785" /><path d="M26 65q22-9 44 0v14c0 8-44 8-44 0Z" fill="#B86D3F" stroke="#B86D3F" strokeWidth="1" /><circle cx="48" cy="57" r="15" fill="#3B3034" stroke="#D7B785" strokeWidth="2" /><path d="M55 46a13 13 0 1 0 5 15M55 46h-9m9 0v9M48 50v8l-6 4" stroke={CREAM} strokeWidth="2.5" /><path d="M82 8v13m-6-6h12M9 66v11m-5-5h10" stroke={ORANGE} strokeWidth="2" /></g>;
    case "witches-star": return <g {...common}><path d="m48 9 12 25 28 4-20 20 5 28-25-13-25 13 5-28-20-20 28-4Z" fill="#AE7543" /><path d="m48 22 7 17 18 3-13 13 3 18-15-8-15 8 3-18-13-13 18-3Z" fill="#DEC396" stroke="#DEC396" strokeWidth="1" /><path d="m48 41-10 8 10 13 10-13Z" fill="#715163" stroke="#715163" strokeWidth="1" /><path d="M85 14v13m-6-6h12M7 70v11m-5-5h10" stroke={ORANGE} strokeWidth="2" /></g>;
    case "bonus-run": return <g {...common}><path d="M14 25h68v13a8 8 0 0 0 0 16v24H14V54a8 8 0 0 0 0-16Z" fill="#6E5041" /><path d="M69 30v9m0 8v9m0 8v9" stroke="#B99573" strokeWidth="2" /><circle cx="30" cy="61" r="9" stroke={CREAM} strokeWidth="2" /><circle cx="55" cy="61" r="9" stroke={CREAM} strokeWidth="2" /><path d="m30 61 10-17 7 17H30m10-17h12l3 17m-18-22h7m4 0h9" stroke={CREAM} strokeWidth="2" /><path d="M80 4v13m-6-6h12" stroke={ORANGE} strokeWidth="3" /></g>;
    case "slimming-tea": return <g {...common}><path d="M28 36h47v35c0 23-47 23-47 0Z" fill="#715163" /><path d="M75 43h8c18 0 17 23-8 23M20 91h62" stroke={CREAM} /><path d="M40 10q-9 10 0 19m18-22q-9 10 0 19" stroke="#C5B6C9" strokeWidth="2" /><path d="M40 52q11-14 22 0v18l-6-3-5 3-5-3-6 3Z" fill={CREAM} stroke={CREAM} strokeWidth="1" /><circle cx="47" cy="54" r="1.6" fill={INK} stroke={INK} /><circle cx="55" cy="54" r="1.6" fill={INK} stroke={INK} /><path d="M8 52v22m-5-6 5 7 5-7" stroke={ORANGE} strokeWidth="2" /></g>;
    case "growth-syrup": return <g {...common}><path d="M32 24h23l8 12v49H25V36Z" fill="#705B45" /><path d="M32 24V9h23v15M25 41h38" /><path d="M30 57h27v22H30Z" fill="#A86036" stroke="#A86036" strokeWidth="1" /><path d="M43 60v15m-5-9 5-6 5 6" stroke={CREAM} strokeWidth="2" /><path d="M77 13v72m-7-63h7m-11 13h11m-7 13h7m-11 13h11m-7 13h7" stroke={ORANGE} strokeWidth="2.5" /><path d="m87 30 4-6 4 6m-4-6v18" stroke={CREAM} strokeWidth="2" /></g>;
    case "immortality": return <g {...common}><path d="M24 14h46l7 67-9 8H25L18 22Z" fill="#554452" /><path d="M25 14v67h52M30 24h29M30 32h21" stroke="#AA8871" strokeWidth="2" /><path d="M32 49c-11-12-20 6-9 12s14-3 21-11 23-5 21 5-15 9-22-5" stroke={ORANGE} strokeWidth="4" /><circle cx="51" cy="76" r="9" fill="#8E403D" stroke="#8E403D" /><path d="m51 69 4 7-4 5-4-5Z" fill={CREAM} stroke={CREAM} strokeWidth="1" /></g>;
    case "resurrection": return <g {...common}><path d="m30 12-12 19 5 53h50l5-53-12-19Z" fill="#68605B" /><path d="m30 12 8 21-6 22 9 22m25-65-8 21 6 22-9 22" stroke="#BBA48A" strokeWidth="4" /><path d="M36 42h24v27H36Z" fill="#3B383B" strokeWidth="2" /><path d="M48 46v18m-8-9h16" stroke={ORANGE} strokeWidth="4" /><path d="M81 13v14m-7-7h14" stroke={ORANGE} strokeWidth="2" /></g>;
    case "elixir": return <g {...common}><path d="M38 12h20v23c31 20 23 53-10 53S7 55 38 35Z" fill="#59444F" /><path d="M38 12V5h20v7M34 25h28" stroke={CREAM} /><path d="M24 61q25-10 49 0c-1 26-48 30-49 0Z" fill="#AA653D" stroke="#AA653D" strokeWidth="2" /><path d="M58 42a11 11 0 1 0 6 18 10 10 0 0 1-6-18Z" fill={CREAM} stroke={CREAM} strokeWidth="1" /><path d="m75 16 3 6 6 2-6 3-3 6-2-6-6-3 6-2Z" fill={ORANGE} stroke={ORANGE} strokeWidth="1" /></g>;
    case "builder-seal": return <g {...common}><path d="m31 61-7 30 23-11 23 11-7-30Z" fill="#7A4038" /><circle cx="48" cy="42" r="29" fill="#8E6545" /><circle cx="48" cy="42" r="22" stroke="#D8AF7C" strokeWidth="2" /><path d="m35 30 7-6 14 14-8 8Zm16 11 12 18m-28-1 26-27" stroke={CREAM} strokeWidth="4" /><path d="M13 16h14M20 9v14" stroke={ORANGE} strokeWidth="2" /></g>;
    case "vampire": return <g {...common}><path d="m16 28 19-13 12 16 14-16 20 13-15 57H30Z" fill="#5E3946" /><path d="m32 31 6 14 6-14m10 0 6 14 6-14" fill={CREAM} /><circle cx="47" cy="65" r="7" fill={ORANGE} stroke={ORANGE} /></g>;
    case "mummy": return <g {...common}><ellipse cx="48" cy="48" rx="27" ry="36" fill="#AD9982" /><path d="m23 27 47-5m-48 15 51-3m-52 22 52 3m-49 8 44 5m-37 9 30 2" /><path d="M27 43h42" stroke={INK} strokeWidth="10" /><circle cx="38" cy="43" r="2" fill={ORANGE} stroke={ORANGE} /><circle cx="58" cy="43" r="2" fill={ORANGE} stroke={ORANGE} /></g>;
    case "juice": case "leaking-bottle": return <g {...common}>
      <path d="M38 19h21l4 12v49a10 10 0 0 1-10 10H38a10 10 0 0 1-10-10V31l10-12Z" fill={art === "juice" ? "#AC6236" : "#625B56"} />
      <path d="M38 19v-8h21v8M29 42h33" />
      {art === "juice" ? <><path d="m39 56 5 6H34Zm17 0 5 6H51Z" fill={INK} stroke={INK} strokeWidth="2" /><path d="M36 72q11 9 23-1" stroke={INK} strokeWidth="3" /></> : <><path d="m55 57-8 8 6 5-10 9" stroke={ORANGE} /><path d="M73 64q-9 12-1 13t1-13Zm7 20q-8 12 0 12t0-12Z" fill="#B6BDC1" stroke="#B6BDC1" strokeWidth="2" /></>}
    </g>;
    case "bandage": return <g {...common}><path d="M22 30q26-15 52 0v43q-26 18-52 0Z" fill="#7A6958" /><ellipse cx="48" cy="30" rx="26" ry="13" fill={CREAM} /><ellipse cx="48" cy="30" rx="11" ry="5" stroke="#7A6958" /><path d="M24 43q25 13 47 0M24 55q25 13 47 0M24 67q25 13 47 0M71 48l13 10-9 24-15-7" /></g>;
    case "trident": return <g {...common} stroke={ORANGE}><path d="M48 90V29M23 20v21q0 15 25 15t25-15V20M48 9v47" /><path d="m17 23 6-11 6 11M42 12l6-11 6 11m13 11 6-11 6 11" /><circle cx="48" cy="73" r="9" stroke={CREAM} strokeWidth="2" /><path d="M48 64v18m-9-9h18" stroke={CREAM} strokeWidth="2" /></g>;
    case "cap": return <g {...common}><path d="M18 53q0-34 54-34l8 30-8 9H18Z" fill="#AA6338" /><path d="m19 50-9 13q36 9 76-7l-9-7Z" fill="#73452E" /><path d="m46 31 5 5H41Zm16 0 5 5H57ZM44 42q10 6 21-1" strokeWidth="2" fill={INK} stroke={INK} /></g>;
    case "bat": return <g {...common}><path d="M48 42C35 20 19 36 8 15v34l17-2 21 27 21-27 21 2V15C74 36 59 20 48 42Z" fill="#534756" /><circle cx="44" cy="49" r="2" fill={ORANGE} stroke={ORANGE} /><circle cx="53" cy="49" r="2" fill={ORANGE} stroke={ORANGE} /></g>;
    case "wheel": case "curse": return <g {...common} stroke={art === "curse" ? "#BAA8CA" : ORANGE}><circle cx="48" cy="50" r="32" /><circle cx="48" cy="50" r="6" /><path d="M48 18v26m0 12v26M16 50h26m12 0h26M26 28l18 18m8 8 18 18M26 72l18-18m8-8 18-18" strokeWidth="2" />{art === "curse" ? <><path d="M48 8V1M33 86l-9 9 24-8 24 8-9-9" /><path d="M38 37q10-11 20 0v19l-5-3-5 3-5-3-5 3Z" fill="#BAA8CA" strokeWidth="2" /><circle cx="44" cy="42" r="1.5" fill={INK} /><circle cx="52" cy="42" r="1.5" fill={INK} /></> : null}</g>;
    case "web": return <g stroke={CREAM} strokeWidth="2.5" fill="none"><path d="M8 8h80M8 8v80M8 8l74 74M8 8l80 33M8 8l33 80" /><path d="M8 25q5-3 12-2t6-15M8 45q13-7 25-5t14-32M8 65q19-11 34-9t23-48M8 85q29-15 44-13t35-64" /></g>;
    case "scarf": return <g {...common}><path d="M20 28q26 20 53 0v21q-27 17-53 0Z" fill="#918173" /><path d="M58 48h16v38H53Z" fill="#918173" /><path d="m55 79 17 1M24 39q22 14 45 0M55 86v9m8-9v9m8-9v9" strokeWidth="2" /></g>;
    case "vlad": return <g {...common}><path d="m29 25-9-17-8 75 35 8 36-8-8-75-11 17-17 16Z" fill="#4B3C48" /><path d="m29 25 18 16 17-16-9 58H40Z" fill="#9B7E75" /><circle cx="47" cy="45" r="5" fill={ORANGE} stroke={ORANGE} /></g>;
    case "moon": return <g {...common}><circle cx="48" cy="47" r="36" fill="#4B3D54" /><circle cx="62" cy="29" r="10" fill={CREAM} /><path d="m19 69 17-21 18 20 11-14 17 16" stroke="#B7AABD" /><path d="M46 89q13-19 8-24" stroke={ORANGE} /></g>;
    case "scouting": return <g {...common}><path d="m18 37-14-9 3 21-3 16 14-8m60-20 14-9-3 21 3 16-14-8" fill="#665672" /><rect x="16" y="31" width="64" height="34" rx="17" fill="#665672" /><path d="M31 48q17-20 34 0-17 20-34 0Z" /><circle cx="48" cy="48" r="6" fill={ORANGE} stroke={ORANGE} /></g>;
    case "hourglass": return <g {...common}><path d="M23 9h49M23 87h49M28 10c0 25 20 28 20 38S28 65 28 86M67 10c0 25-19 28-19 38s19 17 19 38" /><path d="m34 22 14 15 13-15Zm-1 56 15-19 16 19Z" fill={ORANGE} stroke={ORANGE} strokeWidth="2" /></g>;
    case "chocolate": return <g {...common}><rect x="23" y="12" width="49" height="75" rx="6" fill="#594031" /><path d="M25 37h45M25 61h45M47 14v71" strokeWidth="2" /><path d="M18 66h59l-3 26H21Z" fill="#6F526E" /><path d="m45 73 4 6-4 5-4-5Z" fill={ORANGE} stroke={ORANGE} strokeWidth="2" /></g>;
    case "salt": return <g {...common}><path d="M35 19h25l8 67H27Z" fill="#82715A" /><path d="M35 19V9h25v10M38 40h18M38 48h18M39 57h16" /><path d="m75 37 5 5m-4-15v10m-6-5h11" stroke={ORANGE} /></g>;
    case "stone-candy": return <g {...common}><path d="m22 35-15-8 1 20-1 16 15-8m52-20 15-8-1 20 1 16-15-8" fill="#69625D" /><path d="m24 28 38-2 15 16-6 23-39 7-14-18Z" fill="#69625D" /><path d="m50 30-11 13 13 8-9 17" stroke="#B3A79E" strokeWidth="2" /></g>;
    case "bell": return <g {...common}><path d="M27 66V40q0-23 21-23t21 23v26l8 9H19Z" fill="#6F6260" /><path d="M38 80q10 16 21 0M48 17V8" stroke={ORANGE} /><path d="M38 38q0-10 10-10t10 10v17l-5-3-5 3-5-3-5 3Z" fill={CREAM} strokeWidth="2" /><circle cx="44" cy="38" r="1.5" fill={INK} stroke={INK} /><circle cx="52" cy="38" r="1.5" fill={INK} stroke={INK} /></g>;
  }
}
