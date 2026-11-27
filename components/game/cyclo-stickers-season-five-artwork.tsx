import { useId } from "react";
import { CycloStickersQuizHostArtwork } from "./cyclo-stickers-quiz-host-artwork";

const grandTours = [
  { key: "corsa-delle-regioni", first: "CORSA", second: "DELLE REGIONI", color: "#D8A1AC" },
  { key: "boucle-des-provinces", first: "BOUCLE", second: "DES PROVINCES", color: "#E3C555" },
  { key: "ruta-de-las-sierras", first: "RUTA", second: "DE LAS SIERRAS", color: "#BB6550" },
] as const;
const jerseyShape = "M538 311C554 281 578 261 605 267L652 280L688 303L668 340L640 328L575 364L530 342Z";

/** Editorial vector plate. The kit follows Cumbre's selected néon jersey;
 * the chat mascot keeps its original face. No card or sporting data is created. */
export function CycloStickersSeasonFiveArtwork({ className = "" }: { className?: string }) {
  const id = useId().replaceAll(":", "");
  return <svg className={className} viewBox="0 0 960 660" role="img" aria-labelledby={`${id}-title ${id}-description`}>
    <title id={`${id}-title`}>Cumbre, trois Grands Tours remportés, et Quizz’o Stratège avec sa carte jaune.</title>
    <desc id={`${id}-description`}>Un coureur au maillot crème, vert et lime de Cumbre Coca Rush. Trois trophées célèbrent la Corsa delle Regioni, la Boucle des Provinces et la Ruta de las Sierras. Le personnage du Cycl’o Quizz présente sa carte de questions.</desc>
    <defs>
      <clipPath id={`${id}-frame`}><path d="M0 0h960v660H0z" /></clipPath>
      <clipPath id={`${id}-jersey`}><path d={jerseyShape} /></clipPath>
      <linearGradient id={`${id}-sky`} x2="0" y2="1"><stop stopColor="#102E2B" /><stop offset="1" stopColor="#31584A" /></linearGradient>
      <linearGradient id={`${id}-mountains`} x2="0" y2="1"><stop stopColor="#78917B" /><stop offset="1" stopColor="#365D4D" /></linearGradient>
      <linearGradient id={`${id}-gold`} x2="1" y2="1"><stop stopColor="#F0D89B" /><stop offset=".48" stopColor="#C8A562" /><stop offset="1" stopColor="#E4C88A" /></linearGradient>
    </defs>
    <g clipPath={`url(#${id}-frame)`}>
      <path d="M0 0h960v660H0z" fill={`url(#${id}-sky)`} />
      <path d="M30 144H930M30 132H930" stroke="#BC9A5D" strokeOpacity=".26" />
      <circle cx="797" cy="223" r="68" fill="#DDC487" opacity=".84" />
      <path d="m-60 470 252-240 97 67 191-150 87 119 97-77 210 178 146-78v299H-60Z" fill="#335A4C" />
      <path d="m155 453 325-306 87 119 97-77 211 178 145 202H108Z" fill={`url(#${id}-mountains)`} />
      <path d="m392 231 88-84 87 119-60-35-30 21-22-32-33 31Z" fill="#E2DCC0" />
      <path d="m621 229 43-40 75 64-44-10-19 15-15-27-24 15Z" fill="#C8CDB1" />
      <path d="m480 147-3 105-60 58 31-9-113 176M664 189l-3 42 58 115-8 76" fill="none" stroke="#D1D3B6" strokeOpacity=".3" strokeWidth="2" />
      <path d="M0 421 179 363 323 427 496 381 641 419 842 340 960 373v223H0Z" fill="#254C40" />
      <path d="M0 515c183-93 332-13 495-23s310-107 497-64v133H0Z" fill="#193E34" />
      <path d="M-40 580c248-111 411-9 604-57s269-101 437-59" fill="none" stroke="#B99761" strokeWidth="66" />
      <path d="M-40 580c248-111 411-9 604-57s269-101 437-59" fill="none" stroke="#E8D6A5" strokeWidth="2" strokeDasharray="23 28" opacity=".65" />
      <g fill="#F3E8CB" textAnchor="middle">
        <text x="480" y="76" fontFamily="Georgia,serif" fontWeight="700" fontSize="59" letterSpacing="1">LE TRIPLÉ CUMBRE</text>
        <text x="480" y="114" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="24" letterSpacing="3">3 GRANDS TOURS · 3 VICTOIRES</text>
      </g>
      <g transform="translate(54 210) scale(1.7)"><CycloStickersQuizHostArtwork /></g>
      <g textAnchor="middle" fill="#EAD7A6">
        <text x="168" y="498" fontFamily="Georgia,serif" fontStyle="italic" fontWeight="700" fontSize="25">Quizz’o Stratège</text>
        <path d="M85 513h166" stroke="#C8A562" strokeWidth="1" />
        <text x="168" y="538" fontFamily="Arial,sans-serif" fontSize="13" fontWeight="700" letterSpacing="2">LE RENDEZ-VOUS DU CHAT</text>
      </g>
      <g strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="615" cy="539" rx="253" ry="13" fill="#0E3029" opacity=".24" />
        <path d="m577 347-44 61 37 38" fill="none" stroke="#A77752" strokeWidth="22" />
        <path d="m579 350-29 38-21-17 34-40Z" fill="#0F2E25" />
        <path d="m652 305 56 32 38-8" fill="none" stroke="#A77752" strokeWidth="15" />
        {[460, 775].map(x => <g key={x}>
          <circle cx={x} cy="450" r="82" fill="#12362E" stroke="#102C26" strokeWidth="11" />
          <circle cx={x} cy="450" r="80" fill="none" stroke="#D6C79C" strokeWidth="3" />
          {Array.from({ length: 12 }, (_, index) => <path key={index} d={`M${x} 450h79`} transform={`rotate(${index * 30} ${x} 450)`} stroke="#8B9A83" strokeWidth="1" opacity=".8" />)}
          <circle cx={x} cy="450" r="6" fill="#D9C791" />
        </g>)}
        <path d="m460 450 83-95 54 95H460l121-82h151l-135 82m135-82 43 82m-43-82-12-38" fill="none" stroke="#092C23" strokeWidth="13" />
        <path d="m460 450 83-95 54 95H460l121-82h151l-135 82m135-82 43 82m-43-82-12-38" fill="none" stroke="#C8F044" strokeWidth="7" />
        <path d="m543 355-9-19m-27 0h57m156-6h42q22 0 19 18l-11 10" fill="none" stroke="#EFE5C6" strokeWidth="7" />
        <path d="m582 410-8 20 11 7 9-20Z" fill="#F2E8CE" stroke="#B0B48C" strokeWidth="1.5" />
        <circle cx="597" cy="450" r="13" fill="#153B2E" stroke="#D1CFAB" strokeWidth="2" />
        <path d="m597 450 19 14m-19-14-18-14m33 30h14m-54-33h15" stroke="#1D3428" strokeWidth="5" />
        <path d="m606 342 34 47-30 67" fill="none" stroke="#C4976B" strokeWidth="24" />
        <path d="m577 341 34-14 30 53-23 16Z" fill="#153E2E" />
        <path d="m606 352 14 24" stroke="#C8F044" strokeWidth="3" />
        <path d="m605 452 23 10 10 13-43-5-5-9Z" fill="#F4E8CF" stroke="#38503B" strokeWidth="2" />
        <path d="m622 463-13 1m20 4-11-1" stroke="#9DA582" strokeWidth="2" />
        <path d="m566 439 23 9 7 11-39-4-6-8Z" fill="#E0D7BA" stroke="#38503B" strokeWidth="2" />
        <g data-sponsor-jersey="cumbre-coca-rush-bold">
          <path d={jerseyShape} fill="#F4E8CF" />
          <g clipPath={`url(#${id}-jersey)`}>
            <path d="M530 342 519 296l59-40 40 15-37 37-17 47Z" fill="#123F31" />
            <path d="m645 273 60 22-29 53-36-20-16-22Z" fill="#123F31" />
            <path d="m536 335 52-26-24 24 45-13-26 28 54-23-31 43-60-5Z" fill="#4B2A1C" />
            <path d="m540 302 38-28-15 24 30-14-19 28 39-15-24 27 32-9-27 31 1-18-30 13 15-22-30 11 14-22-30 13Z" fill="#C8F044" />
            <path d="m632 285 34 11-20 6 30 4-29 21 7-16-29 8 15-17-24 3Z" fill="#C8F044" />
            <path d="m545 348 37-24-14 16 31-12-20 23 38-12-20 20" fill="none" stroke="#F4E8CF" strokeWidth="3" />
            <path d="m569 292 38-18 30 15-22-4-8 6-8-9-18 13Z" fill="#123F31" />
            <path d="M584 285c-9 0-14 6-17 13 10 1 16-5 17-13Z" fill="#C8F044" stroke="#123F31" strokeWidth="1" />
            <path d="m557 307 86-12 10 27-86 16Z" fill="#F4E8CF" />
            <g transform="rotate(-10 608 315)" fontFamily="Arial,sans-serif" fontWeight="900" fontStyle="italic" textAnchor="middle">
              <text x="607" y="315" fontSize="20" fill="#4B2A1C">CUMBRE</text>
              <text x="608" y="327" fontSize="9.3" letterSpacing=".3" fill="#123F31">COCA <tspan fill="#639A22">RUSH</tspan></text>
            </g>
            <path d="m532 319 28 16m102-9 13 7" stroke="#C8F044" strokeWidth="3" />
            <path d="m594 274 7 63" stroke="#D5D5B4" strokeWidth="1" opacity=".6" />
          </g>
          <path d={jerseyShape} fill="none" stroke="#163E30" strokeWidth="2" />
        </g>
        <path d="m681 310 29 47 47-9" fill="none" stroke="#C4976B" strokeWidth="17" />
        <path d="m754 344 15-3 8 7-2 7-18 2" fill="#F1E5C4" stroke="#183D2E" strokeWidth="2" />
        <path d="m675 286 15-23 20 8-11 29Z" fill="#BB8C61" />
        <path d="M690 232c0-18 20-29 38-17 13 9 18 24 6 38l-3 16-15 7-18-14Z" fill="#C4976B" />
        <path d="m731 250 11 5-10 4m-7 9 7-1" fill="none" stroke="#805B3F" strokeWidth="2" />
        <path d="M685 234c-1-25 27-37 47-23 10 6 13 14 13 24l-13 3-10-10-18 7-12 8Z" fill="#123F31" stroke="#D7D9B7" strokeWidth="2" />
        <path d="m696 219 26-5m-27 10 30-4" stroke="#C8F044" strokeWidth="3" />
        <path d="m704 241 30-3-2 9-19 4Z" fill="#1A3630" stroke="#E7DBAE" strokeWidth="1.5" />
        <path d="m699 241-8-3m11 3 6-4" stroke="#E7DBAE" strokeWidth="2" />
      </g>
      <g data-grand-tour-victories="3">
        {grandTours.map((tour, index) => <g key={tour.key} transform={`translate(${290 + index * 208} 566)`} data-grand-tour={tour.key}>
          <path d="M0 0h196v66H0z" fill="#12382E" stroke="#BD9E60" strokeOpacity=".65" />
          <path d="M0 0h5v66H0z" fill={tour.color} />
          <circle cx="37" cy="31" r="24" fill={tour.color} />
          <g transform="translate(20 11)" fill={`url(#${id}-gold)`} stroke="#71552F" strokeWidth="1.2" strokeLinejoin="round">
            <path d="M6 3H28V15C28 25 6 25 6 15ZM6 6H0V12Q0 21 10 20M28 6H34V12Q34 21 24 20M17 25V33M8 36H26L24 32H10Z" />
            <text x="17" y="17" fill="#654925" stroke="none" fontFamily="Georgia,serif" textAnchor="middle" fontWeight="700" fontSize="13">1</text>
          </g>
          <g fill="#F0E4C3" fontFamily="Arial,sans-serif" fontWeight="700">
            <text x="70" y="28" fontSize="18" letterSpacing="1">{tour.first}</text>
            <text x="70" y="46" fontSize="11.4" letterSpacing=".7">{tour.second}</text>
          </g>
        </g>)}
      </g>
      <path d="M20 20h55m-55 0v55M940 20h-55m55 0v55M20 640h55m-55 0v-55M940 640h-55m55 0v-55" fill="none" stroke="#CFB176" strokeWidth="1.5" />
      <path d="M42 576h201M42 583h201" stroke="#C8A562" strokeOpacity=".65" />
      <text x="142" y="612" textAnchor="middle" fill="#E2C991" fontFamily="Georgia,serif" fontSize="20" fontStyle="italic">Souvenirs de S5</text>
    </g>
  </svg>;
}
