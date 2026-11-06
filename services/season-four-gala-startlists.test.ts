import {beforeEach,describe,expect,it,vi} from 'vitest';
import {unzipSync,strFromU8} from 'fflate';
const state=vi.hoisted(()=>({tables:{} as Record<string,Record<string,unknown>[]>,calls:[] as string[],selects:[] as string[],validate:vi.fn()}));
vi.mock('@/lib/supabase/admin',()=>({createSupabaseAdminClient:()=>({from:(table:string)=>{
 state.calls.push(table);let rows=[...(state.tables[table]??[])];let range:[number,number]|null=null;
 const query={select:(columns:string)=>{state.selects.push(columns);return query;},eq:(key:string,value:unknown)=>{rows=rows.filter(row=>row[key]===value);return query;},in:(key:string,values:unknown[])=>{rows=rows.filter(row=>values.includes(row[key]));return query;},order:()=>query,range:(from:number,to:number)=>{range=[from,to];return query;},abortSignal:()=>query,
 single:async()=>({data:rows[0]??null,error:null}),then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:range?rows.slice(range[0],range[1]+1):rows,error:null}).then(resolve)};return query;
}})}));
vi.mock('@/lib/game/season-four-gala-steam',async(importOriginal)=>({...await importOriginal<typeof import('@/lib/game/season-four-gala-steam')>(),validateSeasonFourGalaSteamCompatibility:state.validate}));
import {generateSeasonFourGalaStartlistExport,getSeasonFourGalaExportStatus,loadSeasonFourGalaStartlistSnapshot} from './season-four-gala-startlists';

beforeEach(()=>{
 state.calls=[];state.selects=[];state.validate.mockReset();
 state.tables={seasons:[{id:'s4',game_year:4,status:'completed'},{id:'s5',game_year:5,status:'active'}],
  season_gala_registrations:[{id:'reg',season_id:'s4',team_id:'team',program:'continental'}],
  season_gala_registration_riders:['mountain','hills','sprint'].flatMap(profile=>Array.from({length:7},(_,i)=>({registration_id:'reg',profile,rider_id:'r'+i,position:i+1}))),
  teams:[{id:'team',pcm_export_id:244}],team_seasons:[{team_id:'team',season_id:'s4',display_name:'My club'}],
  riders:Array.from({length:7},(_,i)=>({id:'r'+i,pcm_export_id:10001+i,first_name:'Rider',last_name:String(i)})),
  rider_season_ratings:Array.from({length:7},(_,i)=>({rider_id:'r'+i,season_id:'s4',mountain:75,hills:75,flat:75,time_trial:75,cobbles:75,sprint:75,effective_hills:99})),
  rider_contracts:Array.from({length:7},(_,i)=>({id:'c'+i,rider_id:'r'+i,team_id:'team',start_season_id:'s4',end_season_id:'s4',status:'completed'}))};
});
describe('S4 gala export wiring',()=>{
 it('never emits an archive after the Steam compatibility guard rejects the requested lineup',async()=>{
  state.validate.mockImplementation(()=>{throw new Error('Steam incompatible');});
  await expect(generateSeasonFourGalaStartlistExport('continental:sprint')).rejects.toThrow('Steam incompatible');
 });
 it('keeps programme-identifiable ZIPs with the same unchanged native mountain XML name inside',async()=>{
  const continental=await generateSeasonFourGalaStartlistExport('continental:mountain');
  state.tables.season_gala_registrations[0].program='world-tour';
  state.tables.season_gala_registration_riders=state.tables.season_gala_registration_riders.filter(row=>row.profile!=='sprint');
  const wt=await generateSeasonFourGalaStartlistExport('world-tour:mountain');
  expect(wt.filename).not.toBe(continental.filename);
  for(const result of [continental,wt])expect(Object.keys(unzipSync(result.data)).filter(n=>n.endsWith('.xml'))).toEqual(['top_tdf.xml']);
 });
 it('generates six explicitly empty models without reading player records',async()=>{
  const result=await generateSeasonFourGalaStartlistExport(undefined,true);const files=unzipSync(result.data);
  expect(Object.keys(files).filter(file=>file.endsWith('.xml'))).toHaveLength(6);
  expect(state.calls).toEqual([]);expect(state.validate).not.toHaveBeenCalled();expect(result.template).toBe(true);
  const manifest=JSON.parse(strFromU8(files['manifest.json']));expect(manifest.template).toBe(true);expect(manifest.ratingPolicy.bonusesIncluded).toBe(false);
  expect(strFromU8(files['LISEZ-MOI.txt'])).toContain('étape 18 uniquement');
 });
 it('exports registered riders only from S4 when S5 is active, with the native XML name',async()=>{
  const result=await generateSeasonFourGalaStartlistExport('continental:sprint');
  expect(result).toMatchObject({filename:'Cyclostratege-Gala-S4-continental-sprint-Startlist.zip',contentType:'application/zip',teamCount:1,riderCount:7,template:false});
  const files=unzipSync(result.data);expect(Object.keys(files).filter(n=>n.endsWith('.xml'))).toEqual(['c0_schelde.xml']);
  expect(strFromU8(files['c0_schelde.xml'])).toContain('<cyclist id="10001" />');
  expect(state.validate).toHaveBeenCalledOnce();expect(state.validate.mock.calls[0][1]).toBe('continental:sprint');
  const manifest=JSON.parse(strFromU8(files['manifest.json']));expect(manifest.events[0].file).toBe('c0_schelde.xml');
  expect(manifest.databaseReference.databaseSha256).toBe('ba1aac4ed4cff59768e82e44bf47f9427511730106c95a5ae6656ff775870258');
  expect(strFromU8(files['LISEZ-MOI.txt'])).toContain('aucun suffixe (1)');
  expect(state.calls).not.toContain('pcm_gala_registrations');
  expect(state.calls).not.toContain('rider_equipment_assignments');
  expect(state.selects).toContain('rider_id,mountain,hills,flat,time_trial,cobbles,sprint');
 });
 it('returns real programme counts and never turns demo clubs into registrations',async()=>{
  expect((await getSeasonFourGalaExportStatus()).counts).toMatchObject({'continental:mountain':1,'world-tour:mountain':0});
  state.tables.season_gala_registration_riders=state.tables.season_gala_registration_riders.filter(row=>row.profile==='mountain');
  expect((await getSeasonFourGalaExportStatus()).counts).toMatchObject({'continental:mountain':1,'continental:hills':0,'continental:sprint':0});
  state.tables.season_gala_registrations=[];
  expect((await loadSeasonFourGalaStartlistSnapshot()).riders).toEqual([]);
  await expect(generateSeasonFourGalaStartlistExport('world-tour:mountain')).rejects.toThrow('Aucune inscription');
 });
 it('keeps registered riders above 75 without lowering their native rating or reading equipment',async()=>{
  state.tables.rider_season_ratings[0].hills=76;
  expect((await generateSeasonFourGalaStartlistExport('continental:sprint')).riderCount).toBe(7);
  expect((await loadSeasonFourGalaStartlistSnapshot()).riders[0].native.hills).toBe(76);
  expect(state.tables.rider_season_ratings[0].hills).toBe(76);
  expect(state.calls).not.toContain('rider_equipment_assignments');
 });
 it('uses the recorded registration club after a transfer, independently of current contracts',async()=>{
  state.tables.rider_contracts[0].team_id='new-team';
  const snapshot=await loadSeasonFourGalaStartlistSnapshot();
  expect(snapshot.riders[0].team_id).toBe('team');
  expect(state.tables.rider_contracts[0].team_id).toBe('new-team');
  expect(state.calls).not.toContain('rider_contracts');
  expect((await generateSeasonFourGalaStartlistExport('continental:sprint')).riderCount).toBe(7);
 });
});
