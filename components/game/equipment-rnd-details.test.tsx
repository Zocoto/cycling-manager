import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EquipmentRndStats, EquipmentRndEngineerSummary, EquipmentRndVisual } from "./equipment-rnd-details";
import { normalizeEquipmentEffects } from "@/lib/game/equipment";
vi.mock("next/image",()=>({default:({src,alt}:{src:string;alt:string})=>createElement("img",{src,alt})}));
describe("R&D stats and engineer details",()=>{
  it("distinguishes last change from cumulative gains, including new and negative stats",()=>{
    const html=renderToStaticMarkup(<EquipmentRndStats effects={normalizeEquipmentEffects({ratingBonuses:{mountain:3,endurance:2,flat:-1}})} previous={normalizeEquipmentEffects({ratingBonuses:{mountain:3,endurance:1}})} origin={normalizeEquipmentEffects({ratingBonuses:{mountain:2}})} />);
    expect(html).toContain("R&amp;D +1");expect(html).toContain("R&amp;D +2");expect(html).toContain("dernier +1");expect(html).toContain("dernier -1");expect(html).toContain("text-emerald-800");expect(html).toContain("text-red-800");
  });
  it("shows frozen before/after values including contextual TT bonuses",()=>{
    const html=renderToStaticMarkup(<EquipmentRndStats compare previous={normalizeEquipmentEffects({ratingBonuses:{mountain:1},timeTrialRatingBonuses:{timeTrial:2}})} effects={normalizeEquipmentEffects({ratingBonuses:{mountain:1,endurance:2},timeTrialRatingBonuses:{timeTrial:2}})} />);
    expect(html).toContain("Avant");expect(html).toContain("Après");expect(html).toContain("Évolution");expect(html).toContain("CLM (CLM)");expect(html).toContain("+2");
    expect(renderToStaticMarkup(<EquipmentRndStats compare previous={null} effects={normalizeEquipmentEffects({})} />)).toContain("indisponibles");
  });
  it("shows a real equipment visual and national/federal benefits",()=>{
    const html=renderToStaticMarkup(<EquipmentRndEngineerSummary engineer={{contractId:"e",name:"Ada Lab",level:2,specialties:["research_success"],specialty:"research_success",countryName:"France",countryCode:"FR",nationalityMultiplier:1.1,federalMultiplier:1.05,setbackProtected:true}} />);
    expect(html).toContain("France");expect(html).toContain("+7 points de réussite");expect(html).toContain("+10%");expect(html).toContain("+5%");expect(html).toContain("Revers sans malus");
    expect(html).toContain("Compétence de base");expect(html).toContain("Succès modéré : 10 %");
    expect(renderToStaticMarkup(<EquipmentRndVisual imagePath="/images/equipment/products/echelon-altitude-rs.webp" name="Cadre" slot="frame" />)).toContain("echelon-altitude-rs.webp");
  });
  it("does not invent a new base skill for a historical launch", () => {
    const html = renderToStaticMarkup(<EquipmentRndEngineerSummary engineer={{contractId:"old",name:"Historical",level:5,specialties:[],specialty:null,moderateSuccessChancePercentage:0}} />);
    expect(html).not.toContain("Succès modéré");
  });
});
