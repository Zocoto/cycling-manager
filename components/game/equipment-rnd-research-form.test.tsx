import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe,it,expect,vi } from "vitest";
import { EquipmentRndResearchForm } from "./equipment-rnd-research-form";
import { normalizeEquipmentEffects } from "@/lib/game/equipment";
vi.mock("@/app/jeu/materiel/laboratoire/actions",()=>({startEquipmentRndAction:async()=>{}}));
vi.mock("next/image",()=>({default:({src,alt}:{src:string;alt:string})=>createElement("img",{src,alt})}));
const item={id:"item",name:"Prototype Alpine",slot:"frame" as const,channel:"research_prototype",bonusTotal:6,baseDurationDays:12,availableQuantity:1,imagePath:"/images/equipment/products/echelon-altitude-rs.webp",effects:normalizeEquipmentEffects({ratingBonuses:{mountain:3,endurance:3}}),originEffects:normalizeEquipmentEffects({ratingBonuses:{mountain:2,endurance:1}}),previousEffects:normalizeEquipmentEffects({ratingBonuses:{mountain:3,endurance:2}})};
const engineer={contractId:"engineer",name:"Ada Lab",level:4,specialties:["research_success" as const],specialty:"research_success" as const,nationalityMultiplier:1.1,federalMultiplier:1.04,exceptionalChancePercentage:1};
describe("R&D configurable research",()=>{
  it("puts real item stats and staff/national benefits in the choices and recap",()=>{
    const html=renderToStaticMarkup(<EquipmentRndResearchForm items={[item]} engineers={[engineer]} labLevel={6} labEfficiencyBonusPercentage={10}/>);
    expect(html).toContain("+3 MON · +3 END");expect(html).toContain("10 % affinité");expect(html).toContain("+14 points de réussite");expect(html).toContain("92");expect(html).toContain("R&amp;D +2");expect(html).toContain("conserve son nom");expect(html).not.toContain('name="prototypeName"');
    expect(html).toContain('name="researchFocus"');expect(html).toContain("Montagne");expect(html).toContain("Vallons");expect(html).toContain("Pavés");expect(html).toContain("Plaine");
  });
  it("asks for a name only on a new piece and does not invent a guaranteed outcome",()=>{
    const html=renderToStaticMarkup(<EquipmentRndResearchForm items={[{...item,channel:"commercial"}]} engineers={[engineer]} labLevel={6} labEfficiencyBonusPercentage={10}/>);
    expect(html).toContain('name="prototypeName"');expect(html).toContain("% de revers");expect(html).toContain("statistique tirée");
  });
  it("disables launch until both choices are present",()=>{
    const html=renderToStaticMarkup(<EquipmentRndResearchForm items={[item,{...item,id:"other"}]} engineers={[engineer]} labLevel={6} labEfficiencyBonusPercentage={10}/>);
    expect(html).toContain("disabled");expect(html).toContain("Choisissez une pièce");
  });
});
