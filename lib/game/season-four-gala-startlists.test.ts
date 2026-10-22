import {describe,expect,it} from 'vitest';
import {GALA_EVENTS} from './season-four-gala';
import {buildSeasonFourGalaStartlists,hasContinentalNativeRatings,selectSeasonFourGalaContracts,type GalaExportSnapshot} from './season-four-gala-startlists';
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
 it.each(['mountain','hills','flat','time_trial','cobbles','sprint'] as const)('rejects a native %s rating above 75',key=>{
  const fixture=galaFixture();fixture.riders[0].native[key]=75.01;
  expect(()=>buildSeasonFourGalaStartlists(fixture,'continental:mountain')).toThrow('Plafond Continental');
 });
 it.each([null,NaN,Infinity,''])('rejects a missing or invalid native rating: %s',value=>{
  const fixture=galaFixture();fixture.riders[0].native.hills=value;
  expect(hasContinentalNativeRatings(fixture.riders[0].native)).toBe(false);
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
  const crowded=galaFixture();crowded.registrations=Array.from({length:23},(_,index)=>({id:'reg'+index,team_id:'team'+index,program:'continental'}));crowded.selections=[];
  expect(()=>buildSeasonFourGalaStartlists(crowded,'continental:mountain')).toThrow('aucune équipe n’a été retirée');
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
});
