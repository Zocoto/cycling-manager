import {describe,expect,it} from 'vitest';
import {GALA_EVENTS} from './season-four-gala';
import {buildSeasonFourGalaStartlists,getSeasonFourGalaRegisteredClubs,hasContinentalNativeRatings,selectSeasonFourGalaContracts,type GalaExportSnapshot} from './season-four-gala-startlists';
import type {ContractRow} from './pcm-export/types';

export function galaFixture(count=7):GalaExportSnapshot{
 const native={mountain:75,hills:75,flat:75,time_trial:75,cobbles:75,sprint:75};
 return {season:4,registrations:[{id:'reg',team_id:'team',program:'continental'}],
  selections:['mountain','hills','sprint'].flatMap(profile=>Array.from({length:count},(_,index)=>({registration_id:'reg',profile:profile as 'mountain',rider_id:'r'+index,position:index+1}))),
  teams:[{id:'team',name:'Team',pcm_export_id:244}],riders:Array.from({length:count},(_,index)=>({id:'r'+index,pcm_export_id:10001+index,first_name:'Rider',last_name:String(index),team_id:'team',native:{...native}}))};
}
describe('gala S4 startlist policy',()=>{
 it('builds six native XML models in two folders, with exactly one simulation team',()=>{
  const result=buildSeasonFourGalaStartlists({season:4,registrations:[],selections:[],teams:[],riders:[]},undefined,true);
  expect(Object.keys(result.files)).toEqual(['World-Tour/top_tdf.xml','World-Tour/topclas_maastricht.xml','World-Tour/topclas_roubaix.xml','Continental/top_tdf.xml','Continental/topclas_maastricht.xml','Continental/c0_schelde.xml']);
  for(const xml of Object.values(result.files)){expect(xml.match(/<team id=/g)).toHaveLength(1);expect(xml.match(/<cyclist id=/g)).toHaveLength(7);}
  expect(result.teamCount).toBe(0);
 });
 it.each([7,8])('exports %s riders with permanent IDs and the simulation team',count=>{
  const result=buildSeasonFourGalaStartlists(galaFixture(count),'continental:mountain');
  expect(result.files['Continental/top_tdf.xml']).toContain('<team id="244">');
  expect(result.files['Continental/top_tdf.xml'].match(/<cyclist id=/g)).toHaveLength(count+7);
  expect(result.teamCount).toBe(1);expect(result.riderCount).toBe(count);
 });
 it.each([6,9])('rejects %s riders',count=>expect(()=>buildSeasonFourGalaStartlists(galaFixture(count),'continental:mountain')).toThrow('7 à 8'));
 it.each(['mountain','hills','flat','time_trial','cobbles','sprint'] as const)('preserves a registered rider whose native %s rating grew above 75',key=>{
  const fixture=galaFixture();fixture.riders[0].native[key]=76;
  expect(hasContinentalNativeRatings(fixture.riders[0].native)).toBe(false);
  expect(buildSeasonFourGalaStartlists(fixture,'continental:mountain').riderCount).toBe(7);
  expect(fixture.riders[0].native[key]).toBe(76);
 });
 it.each([null,NaN,Infinity,''])('rejects a missing or invalid native rating: %s',value=>{
  const fixture=galaFixture();fixture.riders[0].native.hills=value;
  expect(hasContinentalNativeRatings(fixture.riders[0].native)).toBe(false);
  expect(()=>buildSeasonFourGalaStartlists(fixture,'continental:mountain')).toThrow('Notes natives');
 });
 it('uses only native ratings, independently of equipment bonuses',()=>{
  const native={...galaFixture().riders[0].native,equipment_hills_bonus:20,effective_hills:95};
  expect(hasContinentalNativeRatings(native)).toBe(true);
 });
 it('does not cap World Tour native ratings',()=>{
  const fixture=galaFixture();fixture.registrations[0].program='world-tour';fixture.selections=fixture.selections.filter(row=>row.profile!=='sprint');fixture.riders[0].native.hills=90;
  expect(buildSeasonFourGalaStartlists(fixture,'world-tour:mountain').teamCount).toBe(1);
 });
 it('rejects a composition outside its selected programme',()=>{
  const fixture=galaFixture();fixture.selections[0].profile='cobbles';
  expect(()=>buildSeasonFourGalaStartlists(fixture,'continental:mountain')).toThrow('profil incompatible');
 });
 it('rejects a team registered twice or in two programmes',()=>{
  const fixture=galaFixture();fixture.registrations.push({...fixture.registrations[0],id:'reg2',program:'world-tour'});
  expect(()=>buildSeasonFourGalaStartlists(fixture)).toThrow('un seul programme');
 });
 it('rejects missing positions, changed ownership and reserved or missing IDs',()=>{
  for(const mutate of [
   (f:GalaExportSnapshot)=>{f.selections[0].position=8;},
   (f:GalaExportSnapshot)=>{f.riders[0].team_id='other';},
   (f:GalaExportSnapshot)=>{f.riders[0].pcm_export_id=9001;},
   (f:GalaExportSnapshot)=>{f.teams[0].pcm_export_id=243;},
   (f:GalaExportSnapshot)=>{f.riders[0].pcm_export_id=null;},
  ]){const fixture=galaFixture();mutate(fixture);expect(()=>buildSeasonFourGalaStartlists(fixture,'continental:mountain')).toThrow();}
 });
 it('rejects duplicate PCM riders and never silently truncates a list',()=>{
  const fixture=galaFixture();fixture.riders[1].pcm_export_id=fixture.riders[0].pcm_export_id;
  expect(()=>buildSeasonFourGalaStartlists(fixture,'continental:mountain')).toThrow('plusieurs fois');
  const crowded=galaFixture();crowded.registrations=Array.from({length:23},(_,index)=>({id:'reg'+index,team_id:'team'+index,program:'continental'}));crowded.selections=crowded.registrations.flatMap(registration=>crowded.selections.filter(row=>row.profile==='mountain').map(row=>({...row,registration_id:registration.id})));
  expect(()=>buildSeasonFourGalaStartlists(crowded,'continental:mountain')).toThrow('aucune équipe n’a été retirée');
 });
 it('exports only the teams that saved a lineup for this exact course',()=>{
  const fixture=galaFixture();fixture.registrations.push({id:'pending',team_id:'pending-team',program:'continental'});
  expect(buildSeasonFourGalaStartlists(fixture,'continental:mountain').teamCount).toBe(1);
  fixture.selections=fixture.selections.filter(row=>row.profile==='mountain');
  expect(buildSeasonFourGalaStartlists(fixture,'continental:mountain').riderCount).toBe(7);
  expect(()=>buildSeasonFourGalaStartlists(fixture,'continental:hills')).toThrow('Aucune inscription');
  expect(Object.keys(buildSeasonFourGalaStartlists(fixture).files)).toEqual(['Continental/top_tdf.xml']);
 });
 it('pins the source to S4 and does not produce a fake real list before registration',()=>{
  expect(()=>buildSeasonFourGalaStartlists({...galaFixture(),season:5})).toThrow('saison 4');
  expect(()=>buildSeasonFourGalaStartlists({season:4,registrations:[],selections:[],teams:[],riders:[]},GALA_EVENTS[0].key)).toThrow('Aucune inscription');
 });
 it('uses the same final S4 contracts for the database and startlists after rollover',()=>{
  const base={id:'old',rider_id:'r1',team_id:'old-team',status:'completed',start_season_id:'s3',end_season_id:'s4',salary_per_season:0};
  const contracts:ContractRow[]=[base,{...base,id:'latest',team_id:'current-team',start_season_id:'s4',joined_day_number:20},
   {...base,id:'future',team_id:'future-team',start_season_id:'s5',end_season_id:'s5'},
   {...base,id:'left',rider_id:'r2',left_season_id:'s4'}, {...base,id:'cancelled',rider_id:'r3',status:'cancelled'}];
  const picked=selectSeasonFourGalaContracts(contracts,[{id:'s3',game_year:3},{id:'s4',game_year:4},{id:'s5',game_year:5}]);
  expect(picked.map(row=>row.id)).toEqual(['latest']);
 });
 it('keeps the registration club in exhibition copies after a transfer or release, without changing source contracts',()=>{
  const base:ContractRow={id:'old',rider_id:'r1',team_id:'registered-team',status:'completed',start_season_id:'s4',end_season_id:'s4',salary_per_season:100,left_season_id:'s4'};
  const contracts=[base,{...base,id:'new',team_id:'new-team',left_season_id:null,joined_day_number:22}, {...base,id:'released',rider_id:'r2',status:'terminated'}];
  const before=structuredClone(contracts);
  const years=[{id:'s4',game_year:4}];
  const picked=selectSeasonFourGalaContracts(contracts,years,new Map([['r1','registered-team'],['r2','registered-team']]));
  expect(picked.map(row=>[row.rider_id,row.team_id]).sort()).toEqual([['r1','registered-team'],['r2','registered-team']]);
  expect(contracts).toEqual(before);
  expect(selectSeasonFourGalaContracts(contracts,years).map(row=>row.team_id)).toEqual(['new-team']);
 });
 it('recovers only terminated contracts for the exact registered club covering S4',()=>{
  const base:ContractRow={id:'released',rider_id:'r1',team_id:'registered-team',status:'terminated',start_season_id:'s4',end_season_id:'s4',salary_per_season:100,left_season_id:'s4'};
  const contracts=[base,
   {...base,id:'wrong-club',team_id:'other-team'},
   {...base,id:'not-registered',rider_id:'r2'},
   {...base,id:'future',rider_id:'r3',start_season_id:'s5',end_season_id:'s5'},
   {...base,id:'cancelled',rider_id:'r4',status:'cancelled'},
   {...base,id:'expired',rider_id:'r5',end_season_id:'s3'},
   {...base,id:'left-before-s4',rider_id:'r6',left_season_id:'s3'},
  ];
  const before=structuredClone(contracts);
  const years=[{id:'s3',game_year:3},{id:'s4',game_year:4},{id:'s5',game_year:5}];
  const clubs=new Map(['r1','r3','r4','r5','r6'].map(id=>[id,'registered-team']));
  expect(selectSeasonFourGalaContracts(contracts,years,clubs).map(row=>row.id)).toEqual(['released']);
  expect(selectSeasonFourGalaContracts(contracts,years)).toEqual([]);
  expect(contracts).toEqual(before);
 });
 it('rejects conflicting registration clubs instead of duplicating or silently moving a rider',()=>{
  const fixture=galaFixture();
  expect(getSeasonFourGalaRegisteredClubs(fixture.registrations,fixture.selections).size).toBe(7);
  expect(()=>getSeasonFourGalaRegisteredClubs([...fixture.registrations,{id:'other',team_id:'other',program:'world-tour'}],[...fixture.selections,{registration_id:'other',rider_id:'r0'}])).toThrow('plusieurs équipes');
 });
});
