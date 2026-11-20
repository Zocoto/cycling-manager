(() => {
  "use strict";

  // An original, code-drawn paper village. Each window belongs to a building;
  // positions are deliberately shuffled, rather than presented as a day grid.
  const windows = [
    [17, 103, 381, 65, 77], [3, 214, 381, 65, 77], [21, 155, 492, 66, 95],
    [8, 443, 320, 65, 73], [24, 551, 320, 74, 73], [11, 516, 414, 60, 75],
    [1, 761, 400, 66, 76], [19, 867, 400, 66, 76], [6, 813, 491, 68, 79],
    [13, 1154, 302, 63, 68], [22, 1125, 424, 55, 78], [4, 1207, 424, 55, 78],
    [15, 109, 692, 69, 82], [7, 225, 692, 69, 82], [23, 324, 744, 48, 91],
    [10, 478, 653, 79, 95], [2, 593, 653, 78, 82], [18, 692, 745, 59, 84],
    [12, 878, 675, 72, 80], [20, 995, 675, 72, 80], [5, 1064, 746, 53, 85],
    [9, 1230, 686, 63, 80], [16, 1139, 554, 61, 48], [14, 1212, 554, 61, 48],
  ];
  const esc = (value) => String(value).replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  const scene = `<svg class="advent-fresco" viewBox="0 0 1400 900" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="av-sky" x2="0" y2="1"><stop stop-color="#183e3b"/><stop offset=".75" stop-color="#749484"/><stop offset="1" stop-color="#c0c8b0"/></linearGradient>
      <linearGradient id="av-snow" x2="0" y2="1"><stop stop-color="#f9f2db"/><stop offset="1" stop-color="#dce4d5"/></linearGradient>
      <pattern id="av-paper" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M1 2h1M6 7h1" stroke="#fdf7e2" stroke-width=".7" opacity=".13"/></pattern>
      <pattern id="av-bricks" width="32" height="19" patternUnits="userSpaceOnUse"><path d="M0 0h32M0 19h32M16 0v9M0 9h32M7 9v10M26 9v10" fill="none" stroke="#784939" stroke-width="1" opacity=".22"/></pattern>
      <g id="av-fir"><path d="M-5 10h10v26H-5z" fill="#765b44"/><path d="M0-76-27-28h13L-39 8h16L-49 35H49L24 8h15L14-28h13z" fill="#214b3b"/><path d="m0-76-27 48h19l8-8 8 8h19zM-31-3-39 8h18l21-9 20 9h19L31-3 15 0 0-10-14 0zM-40 23l-9 12h98l-9-12-25 4L0 18l-15 9z" fill="#f2efdb"/></g>
      <g id="av-bicycle" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="-24" cy="15" r="19" stroke="#26453e" stroke-width="4"/><circle cx="29" cy="15" r="19" stroke="#26453e" stroke-width="4"/><path d="m-24 15 17-29 13 29H-24l14-16 34-1 5 17M-12-15h12M18-13l4-5h9" stroke="#a64b44" stroke-width="5"/><path d="m-22 15 6-5M28 15l9 4" stroke="#bbbd9c" stroke-width="1.2"/><circle cx="6" cy="15" r="4" stroke="#eac681" stroke-width="3"/></g>
      <g id="av-cyclist"><use href="#av-bicycle"/><path d="m5-28-12 13 12 15 10-13-13-7" fill="none" stroke="#dcb477" stroke-width="9" stroke-linecap="round"/><path d="m7-30 12 7 4 12" fill="none" stroke="#f0dbac" stroke-width="5" stroke-linecap="round"/><path d="m4-1 2 16M14-13l-8 14" stroke="#283b35" stroke-width="6" stroke-linecap="round"/><circle cx="17" cy="-38" r="8" fill="#dba77e"/><path d="M9-40q5-13 17-3" fill="#772e39" stroke="#772e39" stroke-width="5" stroke-linecap="round"/><path d="m7-25-12 8" stroke="#872e3c" stroke-width="11" stroke-linecap="round"/><path d="m-2-27-17-5" stroke="#efcc7d" stroke-width="4"/></g>
      <g id="av-wreath"><circle r="20" fill="none" stroke="#285c42" stroke-width="11"/><path d="m-12 14 12 6 12-6-2 18-10-6-10 6z" fill="#a64543"/><circle cx="-15" cy="-10" r="3" fill="#d4b663"/><circle cx="16" cy="-4" r="3" fill="#b84a43"/><circle cx="2" cy="-18" r="3" fill="#e2bd6d"/></g>
      <g id="av-lamp"><path d="M0 0v73m-9 0H9" stroke="#345344" stroke-width="6"/><path d="M-14-24h28L9 0H-9z" fill="#f1cf7a" stroke="#345344" stroke-width="4"/><path d="m-16-25 16-13 16 13" fill="#345344"/><circle cy="-14" r="22" fill="#f3d48b" opacity=".1"/></g>
    </defs>
    <rect width="1400" height="900" fill="url(#av-sky)"/>
    <circle cx="1188" cy="109" r="39" fill="#f8e4a8"/><circle cx="1175" cy="96" r="35" fill="#264d44"/>
    <g fill="#f1dfb5"><path d="m727 65 3 9 9 3-9 3-3 9-3-9-9-3 9-3zM1050 161l2 7 7 2-7 2-2 7-2-7-7-2 7-2zM1320 54l2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/>
      <circle cx="833" cy="129" r="2"/><circle cx="964" cy="66" r="2"/><circle cx="1101" cy="94" r="2"/><circle cx="674" cy="147" r="2"/><circle cx="1289" cy="175" r="2"/><circle cx="772" cy="189" r="2"/></g>
    <text x="69" y="80" fill="#e4c27f" font-family="system-ui,sans-serif" font-size="15" font-weight="700" letter-spacing="6">LE VILLAGE</text>
    <text x="64" y="150" fill="#fff1d2" font-family="Georgia,serif" font-size="70" font-style="italic">de l’Avent</text>
    <path d="M0 337 154 195l84 94 130-119 126 148 136-107 125 101 167-138 135 154 130-101 113 107v160H0z" fill="#4f7567"/>
    <path d="m368 170-64 58 45-8 19 19 19-28 34 18zM922 174l-64 54 49-4 16 15 19-15 43 8zM154 195l-54 52 36-5 15 15 17-17 34 9zM631 211l-51 41 32-2 17 14 17-19 30 6zM1187 227l-38 31 30-3 9 9 13-11 27 12z" fill="#dde5d4"/>
    <path d="M0 378q182-51 350 11t361-12 344 15 345-7v515H0z" fill="url(#av-snow)"/>
    <path d="M0 428q223 45 409-18t421 29 570-10" fill="none" stroke="#c0d0bf" stroke-width="14"/>
    <path d="M0 551C229 481 337 501 458 534S724 629 864 567s239-53 536-12M0 884c182-54 296-33 397-15s211 13 321-18 345 24 682-29" fill="none" stroke="#b5c5b8" stroke-width="48"/>
    <path d="M0 551C229 481 337 501 458 534S724 629 864 567s239-53 536-12M0 884c182-54 296-33 397-15s211 13 321-18 345 24 682-29" fill="none" stroke="#e9e8d8" stroke-width="36"/>
    <path d="M31 548c181-44 264-35 369-19M850 573q141-63 263-36" stroke="#99b4a5" stroke-width="2" stroke-dasharray="4 10" fill="none"/>
    <g opacity=".8"><use href="#av-fir" transform="translate(55 313) scale(.7)"/><use href="#av-fir" transform="translate(696 316) scale(.9)"/><use href="#av-fir" transform="translate(1024 345) scale(.85)"/><use href="#av-fir" transform="translate(1334 350) scale(.9)"/></g>
    <g stroke="#6d5b42" stroke-width="3" stroke-linejoin="round">
      <path d="M66 347h274v243H66z" fill="#c79870"/><path d="M66 347h274v243H66z" fill="url(#av-bricks)"/><path d="m43 350 157-97 162 97z" fill="#7a4140"/><path d="m43 350 157-97 162 97-32-6-131-70-128 71z" fill="#f4f0dd" stroke="none"/>
      <path d="M278 285v-42h29v61" fill="#ae7459"/><path d="M274 244h38" stroke="#f7f1dd" stroke-width="10"/>
      <path d="M88 356h229" stroke="#e9cc9f" stroke-width="7"/>
      <path d="M407 294h265v198H407z" fill="#e2c69b"/><path d="m391 296 145-87 153 87z" fill="#355347"/><path d="m391 296 145-87 153 87-30-5-122-62-114 62z" fill="#f5f0df" stroke="none"/>
      <path d="M407 396h265M430 305v185M649 305v185" stroke="#a37c56" stroke-width="9"/>
      <path d="M732 372h247v202H732z" fill="#a95147"/><path d="m714 374 141-102 144 102z" fill="#405747"/><path d="m714 374 141-102 144 102-31-8-112-74-109 74z" fill="#faf2dd" stroke="none"/>
      <path d="M747 484h217" stroke="#d8ad7b" stroke-width="7"/>
      <path d="M1101 281h184v230h-184z" fill="#e0ccaa"/><path d="M1134 231h118v153h-118z" fill="#d1b88d"/><path d="m1114 234 77-71 82 71z" fill="#4b5f4a"/><path d="m1114 234 77-71 82 71-31-8-51-42-48 42z" fill="#f6efdd" stroke="none"/><path d="M1191 162v-25" stroke="#e7c47c"/><path d="M1180 140h22" stroke="#e7c47c"/>
      <path d="M1101 404h184" stroke="#a48e67" stroke-width="8"/>
    </g>
    <g fill="#f2e6c9" stroke="#6b543c" stroke-width="2"><rect x="105" y="464" width="165" height="22" rx="4"/><rect x="452" y="296" width="178" height="22" rx="4"/><rect x="770" y="377" width="166" height="20" rx="3"/></g>
    <g fill="#5b4730" text-anchor="middle" font-family="Georgia,serif" font-size="14"><text x="188" y="480">Auberge du Grand Braquet</text><text x="541" y="312">L’atelier des lutins</text><text x="853" y="392">Le Relais du col</text></g>
    <use href="#av-wreath" transform="translate(671 355) scale(.7)"/>
    <path d="M1043 525v-74m-22 0h73l-13 27h-60z" fill="#f1dec0" stroke="#6f654c" stroke-width="3"/><text x="1051" y="469" text-anchor="middle" fill="#345849" font-family="system-ui,sans-serif" font-size="12" font-weight="700">COL 24</text>
    <use href="#av-cyclist" transform="translate(339 525) scale(.8)"/><use href="#av-cyclist" transform="translate(933 545) scale(.62)"/>
    <use href="#av-lamp" transform="translate(373 442) scale(.85)"/>
    <g transform="translate(1114 536)"><rect width="179" height="71" rx="14" fill="#446c56" stroke="#284e40" stroke-width="3"/><path d="M4 67h169" stroke="#e8ca85" stroke-width="5"/><circle cx="33" cy="75" r="12" fill="#2a423b"/><circle cx="146" cy="75" r="12" fill="#2a423b"/><path d="M11-4h143" stroke="#f7f0dc" stroke-width="9" stroke-linecap="round"/><text x="91" y="-15" text-anchor="middle" fill="#305345" font-family="system-ui,sans-serif" font-weight="800" font-size="12" letter-spacing="2">LE CAR DU PELOTON</text></g>
    <g stroke="#75573e" stroke-width="3" stroke-linejoin="round">
      <path d="M75 662h310v182H75z" fill="#e7cda4"/><path d="m54 665 172-94 178 94z" fill="#9b4945"/><path d="m54 665 172-94 178 94-34-9-144-64-136 64z" fill="#fff3dc" stroke="none"/>
      <path d="M92 672v171M307 672v171M75 789h310" stroke="#b38f65" stroke-width="8"/>
      <path d="M444 623h329v211H444z" fill="#b95f50"/><path d="m423 626 184-87 188 87z" fill="#355a47"/><path d="m423 626 184-87 188 87-32-7-156-59-151 59z" fill="#f9f0d9" stroke="none"/>
      <path d="M454 633h310" stroke="#efcda1" stroke-width="7"/><path d="M445 761h328" stroke="#955140" stroke-width="5"/>
      <path d="M841 646h291v189H841z" fill="#c4a276"/><path d="m824 648 164-93 164 93z" fill="#6b443a"/><path d="m824 648 164-93 164 93-32-7-132-63-132 63z" fill="#faf0d9" stroke="none"/>
      <path d="M853 658v177M1120 658v177M841 771h291" stroke="#866549" stroke-width="7"/>
      <path d="M1193 660h145v172h-145z" fill="#a54c45"/><path d="m1175 663 91-78 91 78z" fill="#3c5947"/><path d="m1175 663 91-78 91 78-23-5-68-51-66 51z" fill="#f6edd8" stroke="none"/>
    </g>
    <g fill="#fbedd2" stroke="#6f5339" stroke-width="2"><rect x="121" y="789" width="165" height="26" rx="4"/><rect x="499" y="770" width="163" height="25" rx="4"/><rect x="873" y="782" width="155" height="24" rx="4"/></g>
    <g fill="#61472d" text-anchor="middle" font-family="Georgia,serif" font-size="16"><text x="204" y="807">Maison du Père Braquet</text><text x="580" y="788">Café du Peloton</text><text x="950" y="800">La Manufacture</text></g>
    <use href="#av-wreath" transform="translate(1267 631) scale(.75)"/>
    <path d="M450 635q52 25 104 0t105 0 105 0M81 674q49 24 98 0t98 0 98 0" fill="none" stroke="#3f6549" stroke-width="7"/>
    <g fill="#e4b967"><circle cx="484" cy="644" r="5"/><circle cx="535" cy="640" r="5"/><circle cx="586" cy="628" r="5"/><circle cx="638" cy="638" r="5"/><circle cx="694" cy="646" r="5"/><circle cx="743" cy="641" r="5"/><circle cx="114" cy="681" r="5"/><circle cx="160" cy="678" r="5"/><circle cx="209" cy="667" r="5"/><circle cx="262" cy="675" r="5"/><circle cx="314" cy="682" r="5"/></g>
    <use href="#av-fir" transform="translate(34 779) scale(.9)"/><use href="#av-fir" transform="translate(810 746) scale(.72)"/><use href="#av-fir" transform="translate(1374 742) scale(1.1)"/>
    <use href="#av-bicycle" transform="translate(413 817) scale(.68)"/><use href="#av-cyclist" transform="translate(842 863) scale(.82)"/>
    <g stroke="#b5bba5" stroke-width="2" fill="none"><path d="M85 865v-29m0 12h198m-173-12v29m48-29v29m48-29v29m48-29v29M1158 848v-26m0 12h176m-146-12v26m49-26v26m48-26v26"/></g>
    <g fill="#fff9e6" opacity=".72">${Array.from({ length: 69 }, (_, i) => `<circle cx="${(i * 193 + 19) % 1400}" cy="${(i * 83 + 35) % 900}" r="${i % 5 === 0 ? 2.4 : 1.4}"/>`).join("")}</g>
    <rect width="1400" height="900" fill="url(#av-paper)"/>
    <path d="M8 8h1384v884H8z" fill="none" stroke="#f3dfb5" stroke-width="2" opacity=".5"/>
  </svg>`;

  function parcelIcon(kind) {
    if (kind === "grelots") return `<svg viewBox="0 0 52 52" aria-hidden="true"><path d="M12 32c3-6 3-9 3-15a11 11 0 0 1 22 0c0 6 0 9 3 15l3 5H9z" fill="#efc873" stroke="#9b6c2c" stroke-width="2"/><path d="M21 42q5 7 10 0M26 5V2M21 15q1-5 6-5" fill="none" stroke="#9b6c2c" stroke-width="3" stroke-linecap="round"/><path d="m9 8 3 3m30-3-3 3" stroke="#e3b363" stroke-width="2"/></svg>`;
    return `<svg viewBox="0 0 52 52" aria-hidden="true"><path d="M8 21h36v25H8z" fill="#b05149" stroke="#e8c779" stroke-width="2"/><path d="M5 17h42v9H5z" fill="#d4b46c"/><path d="M22 18h8v28h-8z" fill="#f1d696"/><path d="M26 17C9 17 10 1 20 6l6 11c1-19 21-13 12-5z" fill="none" stroke="#edcf87" stroke-width="4" stroke-linejoin="round"/></svg>`;
  }

  function render({ container, advent = [], day = 1, opened = [], itemById } = {}) {
    const target = typeof container === "string" ? document.querySelector(container) : container;
    if (!target) return;
    const claimedDays = opened instanceof Set ? opened : new Set(opened);
    const controls = windows.map(([number, x, y, width, height]) => {
      const entry = advent[number - 1];
      if (!entry) return "";
      const claimed = claimedDays.has(number);
      const available = number <= day;
      const item = entry.kind === "item" ? itemById?.get?.(entry.itemId) : null;
      const reward = entry.kind === "grelots" ? `${entry.amount} Grelots` : item?.name ?? entry.title;
      const caption = claimed ? `Récupéré · ${reward}` : available ? "À ouvrir" : "Bientôt";
      return `<button type="button" class="advent-window ${claimed ? "is-open" : available ? "is-ready" : "is-locked"}"
        style="--x:${x / 14}%;--y:${y / 9}%;--w:${width / 14}%;--h:${height / 9}%;--door-hue:${number % 3}"
        data-action="advent" data-id="${number}" ${!available && !claimed ? "disabled" : ""}
        title="${esc(`${number} décembre · ${caption}`)}" aria-label="${esc(`${number} décembre · ${caption}`)}">
        <span class="advent-window-reward">${parcelIcon(entry.kind)}</span>
        <span class="advent-window-day">${number}</span>
        <span class="advent-window-status">${claimed ? "✓" : available ? "ouvrir" : ""}</span>
      </button>`;
    }).join("");
    target.innerHTML = `<div class="advent-village-legend" aria-label="Légende du calendrier">
      <span><i class="ready" aria-hidden="true"></i> Fenêtre dorée · à ouvrir</span>
      <span><i class="claimed" aria-hidden="true"></i> Volets ouverts · cadeau récupéré</span>
      <span class="advent-pan-hint">Fais glisser le village pour l’explorer ↔</span>
    </div>
    <div class="advent-panorama" tabindex="0" role="region" aria-label="Village de l’Avent illustré. 24 fenêtres numérotées. Défilement horizontal sur petit écran.">
      <div class="advent-village-scene">${scene}<div class="advent-windows">${controls}</div></div>
    </div>`;
  }

  window.noelAdvent = { render };
})();
