import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EquipmentRndWorkbench } from "./equipment-rnd-workbench";
import { normalizeEquipmentEffects } from "@/lib/game/equipment";
import type { EquipmentRndProject, TeamEquipmentRndOverview } from "@/services/team-equipment-rnd";

vi.mock("next/image", () => ({ default: ({ src, alt }: {src:string;alt:string}) => createElement("img", {src,alt}) }));
vi.mock("@/components/ui/app-link", () => ({ default: ({children,href}: {children:React.ReactNode;href:string}) => createElement("a",{href},children) }));
vi.mock("@/app/jeu/materiel/laboratoire/actions", () => ({ startEquipmentRndAction: async () => {} }));

const engineer = { contractId:"e",name:"Ada",level:2,specialties:[],specialty:null,moderateSuccessChancePercentage:10 };
const project: EquipmentRndProject = {
  id:"p",requestedPrototypeName:null,engineerContractId:"e",itemName:"Frame",prototypeName:"Alpine",
  engineerName:"Ada",engineer,staffSnapshotAvailable:true,labLevel:1,ratingKey:"mountain",successRate:50,
  outcome:"improvement",ratingDelta:2,researchCost:0,startsGameDayIndex:1,completesGameDayIndex:2,status:"completed",
  focus:"mountain",imagePath:null,slot:"frame",beforeEffects:normalizeEquipmentEffects({ratingBonuses:{mountain:1}}),
  afterEffects:normalizeEquipmentEffects({ratingBonuses:{mountain:2,endurance:1}}),originEffects:null,completedAt:null,
};
const overview: TeamEquipmentRndOverview = {
  teamName:"Lab",currentDayNumber:3,currentGameDayIndex:3,balance:0,currency:"EUR",labLevel:1,
  labEfficiencyBonusPercentage:0,researchableItems:[],cappedItemCount:0,engineers:[],availableEngineers:[],
  researchCapacity:0,activeProjects:[],recentProjects:[project],
};

describe("R&D history outcome labels", () => {
  it("shows moderate success with the actual split gains", () => {
    const html=renderToStaticMarkup(<EquipmentRndWorkbench overview={overview} />);
    expect(html).toContain("Succès modéré +2");expect(html).toContain("MON");expect(html).toContain("END");
    expect(html).toContain("Succès modéré : 10 %");
  });
  it("keeps historical laboratory gains distinct from the new base skill", () => {
    const html=renderToStaticMarkup(<EquipmentRndWorkbench overview={{...overview,recentProjects:[{...project,staffSnapshotAvailable:false}]}} />);
    expect(html).toContain("Amélioration +2");expect(html).not.toContain("Succès modéré +2");
    expect(html).not.toContain("Succès modéré : 10 %");
  });
});
