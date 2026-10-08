import type { HalloweenAvatarArt } from "@/lib/game/halloween-avatar";
export function HalloweenAvatarBackground({ arts }: { arts: HalloweenAvatarArt[] }) {
  if (!arts.includes("moon")) return null;
  return <g data-halloween-art="moon"><circle cx="60" cy="60" r="60" fill="#3A3540"/><circle cx="87" cy="24" r="12" fill="#F2DCA9"/><path d="M0 95 24 68l22 17 25-31 49 36v30H0Z" fill="#504653"/></g>;
}
export function HalloweenAvatarOverlay({ arts }: { arts: HalloweenAvatarArt[] }) {
  const vlad = arts.includes("vlad") || arts.includes("vampire");
  return <g data-halloween-avatar={arts.join(",")}>
    {vlad ? <g><path d="M9 120c3-20 17-33 33-39L60 103l18-22c16 6 30 19 33 39Z" fill="#24212A"/><path d="m41 81-11-17-5 26 23 30H57L46 91Zm38 0 11-17 5 26-23 30H63L74 91Z" fill="#602A3A"/><path d="m42 82 18 21 18-21-11 38H53Z" fill="#F4E9D7"/><circle cx="60" cy="99" r="4.2" fill="#D0A255"/></g> : null}
    {arts.includes("headless") ? <g><path d="M9 120q5-30 33-39l18 21 18-21q28 9 33 39" fill="#20222C"/><path d="m28 65 15 17 17 20 17-20 15-17-7 32-15 23H50L35 97Z" fill="#C77E4C"/><path d="m31 70 14 17 15 20 15-20 14-17-6 25-18 23H55L37 95Z" fill="#272531"/></g> : null}
    {arts.includes("vampire") ? <path d="m51 69 3 7 3-7m7 0 3 7 3-7" fill="#FFF5DD" stroke="#7E3E43" strokeWidth=".6"/> : null}
    {arts.includes("mummy") ? <g fill="#E8DEC9" stroke="#AA9C88" strokeWidth=".8"><path d="M35 24q26-18 51 1l-2 9q-25-13-50 0Z"/><path d="m33 34 52-4 2 10-54 3Zm-1 17 56 4-2 10-54-4Zm2 12 51-1-2 10-47 2Zm3 13 43-5-7 13-16 4-17-7Zm-14 22 34-8 38 7 9 13-83 2Zm-7 16 89-8 5 14H12Z"/></g> : null}
    {arts.includes("cap") ? <g><path d="M31 26C34 7 83 6 89 26L84 33H34Z" fill="#D97B3E" stroke="#A65E32" strokeWidth="1.5"/><path d="m33 29-8 7c17 4 44 4 66-4l-7-4Z" fill="#B9602D"/><path d="m54 19 3 3h-6Zm11 0 3 3h-6ZM53 25q7 5 15-1" fill="#302723"/></g> : null}
    {arts.includes("bat") ? <path d="M82 99c-5-7-12-5-14-8v10l7-1 6 5 6-5 7 1V91c-3 4-8 1-12 8Z" fill="#302B38" stroke="#C6AA89" strokeWidth=".8"/> : null}
    {arts.includes("trident") ? <g fill="none" stroke="#A7433E" strokeLinecap="round"><path d="M98 117V74m-9-15v11q0 7 9 7t9-7V59m-9-6v24" strokeWidth="3"/><path d="m86 61 3-6 3 6m3-6 3-6 3 6m3 6 3-6 3 6" strokeWidth="2"/><circle cx="98" cy="88" r="4" stroke="#D4AF71" strokeWidth="1.4"/></g> : null}
    {arts.includes("scarf") ? <g fill="#E6DCCC" stroke="#B4A99A"><path d="M42 84q17 15 36 0l3 8q-20 16-41 1Z"/><path d="m69 94 10 3-1 21-12-2Z"/></g> : null}
    {arts.includes("wheel") ? <g fill="none" stroke="#C88352"><circle cx="60" cy="60" r="58.5" strokeWidth="3"/><path d="M60 2v6m0 104v6M2 60h6m104 0h6M19 19l5 5m72 72 5 5M19 101l5-5m72-72 5-5" strokeWidth="1.4"/></g> : null}
    {arts.includes("web") ? <g fill="none" stroke="#B58A63" strokeWidth="1"><path d="M75 4h39M114 4v39M114 4 78 40M114 4 82 18M114 4 100 40M105 4q0 9 9 9m-19-9q0 19 19 19m-29-19q0 29 29 29"/></g> : null}
  </g>;
}
