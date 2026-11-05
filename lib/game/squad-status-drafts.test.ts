import { expect, it } from "vitest";
import type { SquadStatus } from "./squad-status";
import type { SavedSquadStatus } from "./squad-status-editor";
import { acknowledgeSquadStatusSave, createSquadStatusDrafts, discardSquadStatusDrafts, getSquadStatusUpdates, rebaseSquadStatusDrafts, squadStatusRevision, updateSquadStatusDraft } from "./squad-status-drafts";

const initial:SavedSquadStatus[]=[{riderId:"a",squadStatus:"lieutenant"},{riderId:"b",squadStatus:null}];

it("submits each changed rider once with the original expected role and permits clearing a role",()=>{
  let state=createSquadStatusDrafts(initial);
  expect(getSquadStatusUpdates(state)).toEqual([]);
  state=updateSquadStatusDraft(state,"a",null);
  state=updateSquadStatusDraft(state,"a",null);
  state=updateSquadStatusDraft(state,"b","co_leader");
  expect(getSquadStatusUpdates(state)).toEqual([{riderId:"a",squadStatus:null,expectedStatus:"lieutenant"},{riderId:"b",squadStatus:"co_leader",expectedStatus:null}]);
  state=updateSquadStatusDraft(state,"a","lieutenant");
  expect(getSquadStatusUpdates(state)).toEqual([{riderId:"b",squadStatus:"co_leader",expectedStatus:null}]);
  expect(getSquadStatusUpdates(discardSquadStatusDrafts(state))).toEqual([]);
});

it("acknowledges successful saves and keeps every pending choice on failure",()=>{
  const state=updateSquadStatusDraft(createSquadStatusDrafts(initial),"a","absolute_leader");
  expect(acknowledgeSquadStatusSave(state,{status:"error",message:"Conflict",savedStatuses:[]})).toBe(state);
  const saved=acknowledgeSquadStatusSave(state,{status:"success",message:"Saved",savedStatuses:[{riderId:"a",squadStatus:"absolute_leader"}]});
  expect(getSquadStatusUpdates(saved)).toEqual([]);
  const next=updateSquadStatusDraft(saved,"a","road_captain");
  expect(getSquadStatusUpdates(next)[0].expectedStatus).toBe("absolute_leader");
  expect(discardSquadStatusDrafts(next).valuesByRiderId.a).toBe("absolute_leader");
});

it("does not swallow a newer edit when a request completes",()=>{
  const changed=updateSquadStatusDraft(createSquadStatusDrafts(initial),"a","co_leader");
  const acknowledged=acknowledgeSquadStatusSave(changed,{status:"success",message:"Saved",savedStatuses:[{riderId:"a",squadStatus:"absolute_leader"}]});
  expect(getSquadStatusUpdates(acknowledged)).toEqual([{riderId:"a",squadStatus:"co_leader",expectedStatus:"absolute_leader"}]);
});

it("does not let a late save acknowledgement mask a different server refresh",()=>{
  const submitted=updateSquadStatusDraft(createSquadStatusDrafts(initial),"a","absolute_leader");
  const refreshed=rebaseSquadStatusDrafts(submitted,[{riderId:"a",squadStatus:"road_captain"},initial[1]]);
  const acknowledged=acknowledgeSquadStatusSave(refreshed,{status:"success",message:"Saved",savedStatuses:[{riderId:"a",squadStatus:"absolute_leader"}]},submitted.confirmedByRiderId);
  expect(acknowledged.confirmedByRiderId.a).toBe("road_captain");
  expect(getSquadStatusUpdates(acknowledged)).toEqual([{riderId:"a",squadStatus:"absolute_leader",expectedStatus:"road_captain"}]);
  expect(discardSquadStatusDrafts(acknowledged).valuesByRiderId.a).toBe("road_captain");
  const matching=rebaseSquadStatusDrafts(submitted,[{riderId:"a",squadStatus:"absolute_leader"},initial[1]]);
  expect(getSquadStatusUpdates(acknowledgeSquadStatusSave(matching,{status:"success",message:"Saved",savedStatuses:[{riderId:"a",squadStatus:"absolute_leader"}]},submitted.confirmedByRiderId))).toEqual([]);
});

it("preserves pending expectations across revalidation and discards to the latest confirmed server roles",()=>{
  const changed=updateSquadStatusDraft(createSquadStatusDrafts(initial),"a","absolute_leader");
  expect(squadStatusRevision(initial)).toBe(squadStatusRevision([...initial].reverse()));
  const refreshed=rebaseSquadStatusDrafts(changed,[{riderId:"a",squadStatus:"road_captain"},{riderId:"b",squadStatus:"domestique"}]);
  expect(getSquadStatusUpdates(refreshed)).toEqual([{riderId:"a",squadStatus:"absolute_leader",expectedStatus:"lieutenant"}]);
  expect(refreshed.valuesByRiderId.b).toBe("domestique");
  expect(discardSquadStatusDrafts(refreshed).valuesByRiderId.a).toBe("road_captain");
  expect(getSquadStatusUpdates(rebaseSquadStatusDrafts(changed,[initial[1]]))).toEqual([]);
});

it("ignores unknown riders and non-status values",()=>{
  const state=createSquadStatusDrafts(initial);
  expect(updateSquadStatusDraft(state,"unknown","absolute_leader")).toBe(state);
  expect(updateSquadStatusDraft(state,"a","forged" as SquadStatus)).toBe(state);
});
