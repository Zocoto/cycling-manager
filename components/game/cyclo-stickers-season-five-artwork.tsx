import { useId } from "react";

/** Flat inks and simple engraved shapes, shared by the cover and the sachet. */
export function CycloStickersSeasonFiveArtwork({ className = "" }: { className?: string }) {
  const id = useId().replaceAll(":", "");
  return <svg className={className} viewBox="0 0 640 440" role="img" aria-label="Cycl’o Quizz et Cumbre : les souvenirs de la saison 5">
    <defs>
      <clipPath id={`${id}-frame`}><path d="M0 0h640v440H0z" /></clipPath>
      <pattern id={`${id}-ink`} width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="#e7d5a6" opacity=".15" /></pattern>
    </defs>
    <g clipPath={`url(#${id}-frame)`}>
      <path d="M0 0h640v440H0z" fill="#173b36" />
      <circle cx="482" cy="103" r="66" fill="#d3ad65" />
      <path d="m120 308 171-216 73 85 51-61 225 219v105H0Z" fill="#43675b" />
      <path d="m219 182 72-90 73 85-39-19-34 9-24-12Z" fill="#e7dec0" />
      <path d="m380 158 35-42 58 57-33-11-18 8-18-21Z" fill="#bdc5a4" />
      <path d="M0 355 174 287 319 336 492 255 640 306v134H0Z" fill="#294e43" />
      <path d="M-20 422c174 6 214-103 358-76s208-5 325-66" fill="none" stroke="#c29b62" strokeWidth="43" />
      <path d="M-20 422c174 6 214-103 358-76s208-5 325-66" fill="none" stroke="#e7d5a6" strokeWidth="1.5" strokeDasharray="20 22" />
      <path d="M0 0h640v440H0z" fill={`url(#${id}-ink)`} />
      <g transform="translate(31 48) rotate(-8 83 111)">
        <path d="M7 7h151v197H7Z" fill="#102d2a" opacity=".35" transform="translate(6 7)" />
        <path d="M7 7h151v197H7Z" fill="#f1e4be" stroke="#b9975d" strokeWidth="3" />
        <path d="M17 17h131v177H17Z" fill="none" stroke="#8a9a78" />
        <path d="M32 37h99M32 45h75" stroke="#294e43" strokeWidth="2" />
        <circle cx="82" cy="93" r="29" fill="#d5b773" />
        <path d="M72 82c0-13 25-13 25 0 0 9-14 8-14 19m0 11h.1" fill="none" stroke="#294e43" strokeWidth="5" strokeLinecap="round" />
        {[0, 1, 2, 3].map(index => <g key={index} transform={`translate(0 ${index * 11})`}><circle cx="37" cy="139" r="2.5" fill={index === 2 ? "#a86f46" : "#70856b"} /><path d="M47 139h79" stroke="#70856b" strokeWidth="2" /></g>)}
      </g>
      <g transform="translate(437 199)">
        <path d="M0 13h35v90l-17-13-18 13Z" fill="#c48485" />
        <path d="M43 0h35v104l-18-13-17 13Z" fill="#e2bb54" />
        <path d="M86 20h35v84l-18-13-17 13Z" fill="#b95940" />
        <path d="M7 23h21M50 10h21M93 30h21" stroke="#f7e6ba" strokeWidth="1.5" />
        <path d="M-8 111h137" stroke="#e4cc91" strokeWidth="2" />
      </g>
      <g transform="translate(244 155)" strokeLinecap="round" strokeLinejoin="round">
        <g fill="#173b36" stroke="#f0dfb5" strokeWidth="3"><circle cx="47" cy="176" r="44" /><circle cx="211" cy="176" r="44" /></g>
        <g fill="none" stroke="#819281" strokeWidth="1"><path d="M3 176h88m-44-44v88m133-44h62m-31-44v88" /><path d="m16 145 62 62m0-62-62 62m164-62 62 62m0-62-62 62" /></g>
        <path d="m47 176 48-77 28 77H47l61-56h77l-62 56m62-56 26 56m-26-56-5-24" fill="none" stroke="#d9ba76" strokeWidth="5" />
        <path d="m96 99-6-13m-12-1h30m72 11h24q12 0 10 12l-5 8" fill="none" stroke="#efdfb8" strokeWidth="4" />
        <path d="m106 94 31 36-15 41m-20-78-15 43 33 31" fill="none" stroke="#cb9c72" strokeWidth="12" />
        <path d="m102 91 31 32-16 12-28-34m14-11-7 27-18-6 13-29Z" fill="#122b2a" />
        <path d="m94 81c7-26 25-40 47-36l37 21-17 30-29-16-29 12Z" fill="#a76b46" stroke="#e4c486" strokeWidth="1.5" />
        <path d="m125 53 32 16-6 11-36-16Z" fill="#e5cf98" />
        <path d="m161 82 18 21 23-3m-49-32 22 17 24-3" fill="none" stroke="#cb9c72" strokeWidth="8" />
        <path d="m161 50 7-14 12 5-7 17Z" fill="#cb9c72" />
        <circle cx="178" cy="27" r="14" fill="#cb9c72" />
        <path d="M164 25c0-20 30-20 33-1l-3 6-14-5-15 4Z" fill="#ead9b0" stroke="#173b36" strokeWidth="2" />
        <path d="m118 166 20 8-2 7-25-7m10-7 11 14 18 2" fill="none" stroke="#ede3ca" strokeWidth="7" />
      </g>
      <path d="M17 17h61m-61 0v35M623 17h-61m61 0v35M17 423h61m-61 0v-35M623 423h-61m61 0v-35" fill="none" stroke="#d9bc7c" strokeWidth="1.5" />
      <path d="M61 405h119m278 0h121" stroke="#d9bc7c" strokeWidth="1" />
      <circle cx="320" cy="405" r="3" fill="#d9bc7c" />
    </g>
  </svg>;
}
