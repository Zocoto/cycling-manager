import { useId } from "react";
import { RoadPerspectiveCyclist } from "./collector-album-road-cyclist";

/** Five spot-colour ribbons, a stadium and a road: original printed artwork. */
export function CycloStickersGamesArtwork({className=""}:{className?:string}) {
  const id=useId().replaceAll(":","");
  return <svg viewBox="0 0 640 440" className={className} role="img" aria-label="Les Jeux quadriennaux, souvenir cycliste de la saison 4">
    <defs><pattern id={`${id}-grain`} width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1" cy="2" r=".6" fill="#163b51" opacity=".18"/></pattern><linearGradient id={`${id}-sky`} x2="0" y2="1"><stop stopColor="#f7efcf"/><stop offset="1" stopColor="#dddfc1"/></linearGradient></defs>
    <path d="M0 0h640v440H0Z" fill={`url(#${id}-sky)`}/><circle cx="485" cy="94" r="63" fill="#e4b94d"/>
    <path d="M0 246 115 113 222 213 319 93 492 254 572 175 640 237V440H0Z" fill="#91a8a1"/><path d="m270 150 49-57 46 51-47-17Z" fill="#f4efd7"/>
    <path d="M407 224v-53l53-35 118 16 35 52v40" fill="#e8dbb1" stroke="#254b5c" strokeWidth="3"/><path d="m407 171 101 9 105 24m-142-48v78m25-70v70m24-66v66m24-61v61m24-57v57" fill="none" stroke="#8b9b8d" strokeWidth="3"/>
    <path d="M0 318 330 216 640 278v162H0" fill="#345c66"/><path d="m0 398 333-156 307 93" fill="none" stroke="#ede4c3" strokeWidth="3" strokeDasharray="30 23"/>
    {["#1579a4","#dcb03f","#263e49","#37886d","#bc4c40"].map((color,index)=><path key={color} d={`M${-100+index*25} 450Q${148+index*14} ${90+index*16} ${368+index*40} -30`} fill="none" stroke={color} strokeWidth="16" opacity=".9"/>)}
    <RoadPerspectiveCyclist x={342} y={389} scale={.9} jersey="#f8f1d7" headingDeg={10}/><RoadPerspectiveCyclist x={446} y={336} scale={.58} jersey="#bd4d3d" headingDeg={-16}/>
    <path d="M0 0h640v440H0Z" fill={`url(#${id}-grain)`}/><path d="M18 20h73M18 25h40m465 388h96m-52 6h52" stroke="#294b59" opacity=".6"/>
    <text x="32" y="59" fill="#294b59" fontFamily="Georgia,serif" fontSize="16" fontStyle="italic">Une saison, toutes les couleurs du vélo.</text>
  </svg>;
}
