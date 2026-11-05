import { beforeEach, expect, it, vi } from "vitest";
import type { SquadStatusesSaveState } from "@/lib/game/squad-status-editor";

const runtime=vi.hoisted(()=>({
  states:[] as unknown[],cursor:0,context:null as unknown,pending:false,
  result:null as SquadStatusesSaveState|null,
  action:null as null|((previous:SquadStatusesSaveState,data:FormData)=>Promise<SquadStatusesSaveState>),
  save:vi.fn(),single:vi.fn(),unsaved:vi.fn(),
}));
vi.mock("react",async importOriginal=>({
  ...await importOriginal<typeof import("react")>(),
  useContext:()=>runtime.context,
  useMemo:(factory:()=>unknown)=>factory(),
  useCallback:(callback:unknown)=>callback,
  useState:(initial:unknown)=>{
    const index=runtime.cursor++;
    if(!(index in runtime.states))runtime.states[index]=typeof initial==="function"?initial():initial;
    return [runtime.states[index],(update:unknown)=>{runtime.states[index]=typeof update==="function"?update(runtime.states[index]):update;}];
  },
  useActionState:(action:NonNullable<typeof runtime.action>,initial:SquadStatusesSaveState)=>{
    runtime.action=action;
    return [runtime.result??initial,async(data:FormData)=>{
      runtime.pending=true;
      try {runtime.result=await action(runtime.result??initial,data);return runtime.result;}
      finally {runtime.pending=false;}
    },runtime.pending];
  },
}));
vi.mock("@/app/jeu/effectif/actions",()=>({updateRiderSquadStatusesAction:runtime.save,updateRiderSquadStatusAction:runtime.single}));
vi.mock("./use-management-draft",()=>({useUnsavedManagementChanges:runtime.unsaved}));
import { SquadStatusEditor, SquadStatusesBulkEditor } from "./squad-status-editor";

type Element={type:unknown;props:Record<string,unknown>};
function all(node:unknown):Element[]{
  if(Array.isArray(node))return node.flatMap(all);
  if(!node||typeof node!=="object"||!("props" in node))return [];
  const element=node as Element;
  return [element,...all(element.props.children)];
}
function find(node:unknown,predicate:(element:Element)=>boolean){
  const element=all(node).find(predicate);if(!element)throw new Error("Expected rendered control");return element;
}
const initialStatuses=[{riderId:"a",squadStatus:"lieutenant" as const},{riderId:"b",squadStatus:null}];
function render(){
  runtime.cursor=0;
  const tree=SquadStatusesBulkEditor({initialStatuses,children:null});
  runtime.context=tree.props.value;
  return tree;
}
function selector(riderId:string){return find(SquadStatusEditor({riderId,status:null,returnTo:"/jeu/effectif",compact:true}),element=>element.type==="select");}
function change(riderId:string,value:string){(selector(riderId).props.onChange as (event:{target:{value:string}})=>void)({target:{value}});}
function payload(tree:unknown){return JSON.parse(find(tree,element=>element.type==="input"&&element.props.name==="updates").props.value as string);}
function submit(tree:unknown){
  const data=new FormData();data.set("updates",JSON.stringify(payload(tree)));
  return (find(tree,element=>element.type==="form").props.action as (data:FormData)=>Promise<unknown>)(data);
}

beforeEach(()=>{vi.clearAllMocks();runtime.states=[];runtime.cursor=0;runtime.context=null;runtime.result=null;runtime.pending=false;runtime.action=null;runtime.save.mockReset();});

it("syncs duplicate controls, counts unique pending riders and clears dirty state when reset to original",()=>{
  let tree=render();expect(all(tree).some(element=>"data-squad-status-dock" in element.props)).toBe(false);
  change("a","absolute_leader");tree=render();
  expect(selector("a").props.value).toBe("absolute_leader");
  expect(selector("a").props.value).toBe("absolute_leader");
  change("a","absolute_leader");change("b","domestique");tree=render();
  expect(payload(tree)).toEqual([{riderId:"a",squadStatus:"absolute_leader",expectedStatus:"lieutenant"},{riderId:"b",squadStatus:"domestique",expectedStatus:null}]);
  expect(all(tree).some(element=>"data-squad-status-dock" in element.props)).toBe(true);
  expect(runtime.save).not.toHaveBeenCalled();expect(runtime.single).not.toHaveBeenCalled();
  change("a","lieutenant");render();change("b","");tree=render();
  expect(payload(tree)).toEqual([]);
  expect(all(tree).some(element=>"data-squad-status-dock" in element.props)).toBe(false);
  expect(runtime.unsaved).toHaveBeenLastCalledWith(false);
});

it("saves every pending role in one action and removes the dock only after confirmation",async()=>{
  render();change("a","absolute_leader");change("b","co_leader");const tree=render();
  runtime.save.mockImplementation(async(_previous:unknown,data:FormData)=>({status:"success",message:"Saved",savedStatuses:JSON.parse(String(data.get("updates"))).map(({riderId,squadStatus}:{riderId:string;squadStatus:string|null})=>({riderId,squadStatus}))}));
  await submit(tree);const saved=render();
  expect(runtime.save).toHaveBeenCalledTimes(1);expect(runtime.single).not.toHaveBeenCalled();
  expect(JSON.parse(String(runtime.save.mock.calls[0][1].get("updates")))).toHaveLength(2);
  expect(payload(saved)).toEqual([]);expect(selector("a").props.value).toBe("absolute_leader");
  expect(all(saved).some(element=>"data-squad-status-dock" in element.props)).toBe(false);
});

it.each(["server","network"])("retains all choices after a %s failure and disables controls while saving",async mode=>{
  render();change("a","absolute_leader");change("b","co_leader");const tree=render();
  let finish!:(state:SquadStatusesSaveState)=>void;let reject!:(error:Error)=>void;
  runtime.save.mockImplementation(()=>new Promise<SquadStatusesSaveState>((resolve,fail)=>{finish=resolve;reject=fail;}));
  const saving=submit(tree);const pending=render();
  expect(selector("a").props.disabled).toBe(true);
  expect(all(pending).filter(element=>element.type==="button").every(element=>element.props.disabled===true)).toBe(true);
  if(mode==="server")finish({status:"error",message:"Conflict",savedStatuses:[]});else reject(new Error("Offline"));
  await saving;const failed=render();
  expect(payload(failed)).toHaveLength(2);expect(selector("a").props.value).toBe("absolute_leader");
  expect(selector("a").props.disabled).toBe(false);
  expect(all(failed).some(element=>element.props.role==="alert")).toBe(true);
  (find(failed,element=>element.type==="button"&&element.props.children==="Annuler").props.onClick as ()=>void)();
  const cancelled=render();expect(payload(cancelled)).toEqual([]);expect(selector("a").props.value).toBe("lieutenant");
  expect(runtime.save).toHaveBeenCalledTimes(1);
});

it("preserves Next authentication redirects instead of turning them into a network error",async()=>{
  render();change("a","co_leader");const tree=render();
  const redirect=Object.assign(new Error("NEXT_REDIRECT"),{digest:"NEXT_REDIRECT;replace;/connexion;307;"});
  runtime.save.mockRejectedValue(redirect);
  await expect(submit(tree)).rejects.toBe(redirect);
});
