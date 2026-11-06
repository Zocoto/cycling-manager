// Offline only: inspect a reviewed CDB and regenerate the compact Steam registry.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {cdbToSql} from 'cdb-converter';
import initSqlJs from 'sql.js';

const input=process.argv.slice(2),options=new Map();let write=false;
const allowed=new Set(['--database','--sha256','--manifest','--title']);
for(let index=0;index<input.length;index++){
  const key=input[index];
  if(key==='--write'){assert.equal(write,false,'Duplicate --write');write=true;continue;}
  assert.ok(allowed.has(key)&&!options.has(key),'Unknown or duplicate argument: '+key);
  const value=input[++index];assert.ok(value&&!value.startsWith('--'),'Missing argument: '+key);options.set(key,value);
}
for(const key of allowed)assert.ok(options.has(key),'Required: '+key);
const reviewedHash=options.get('--sha256').toLowerCase();assert.match(reviewedHash,/^[a-f0-9]{64}$/);
const manifest=options.get('--manifest');assert.match(manifest,/^\d{9,30}$/);
const title=options.get('--title');assert.ok(title.trim()&&title.length<=180&&!/[\r\n\0]/.test(title),'Invalid public mod title');
const database=path.resolve(options.get('--database')),bytes=readFileSync(database);
const actualHash=createHash('sha256').update(bytes).digest('hex');assert.equal(actualHash,reviewedHash,'CDB differs from the reviewed published release');
const require=createRequire(import.meta.url),SQL=await initSqlJs({locateFile:()=>require.resolve('sql.js/dist/sql-wasm.wasm')});
const db=cdbToSql(bytes,SQL,{preciseTypes:true});
let registry;
try{
  const rows=query=>{const result=db.exec(query)[0];return result?result.values.map(values=>Object.fromEntries(result.columns.map((column,index)=>[column,values[index]]))):[];};
  const teams=rows('select IDteam from DYN_team where IDteam>0 order by IDteam').map(row=>Number(row.IDteam));
  const teamSet=new Set(teams);assert.equal(teamSet.size,teams.length);assert.ok(teamSet.has(243),'Observer team absent');
  const sourceRiders=rows('select IDcyclist,fkIDteam,fkIDcontract from DYN_cyclist where IDcyclist>0 order by IDcyclist');
  const contracts=new Map(rows('select IDcontract_cyclist,fkIDcyclist,fkIDteam from DYN_contract_cyclist').map(row=>[row.IDcontract_cyclist,row]));
  assert.ok(sourceRiders.length>=7,'Published CDB has no usable roster');
  const riders={};
  for(const rider of sourceRiders){
    assert.ok(Number.isSafeInteger(rider.IDcyclist)&&rider.IDcyclist>0);
    assert.ok(teamSet.has(rider.fkIDteam),'Rider has no valid team: '+rider.IDcyclist);
    const contract=contracts.get(rider.fkIDcontract);assert.ok(contract,'Rider has no linked contract: '+rider.IDcyclist);
    assert.equal(contract.fkIDcyclist,rider.IDcyclist,'Contract rider mismatch');assert.equal(contract.fkIDteam,rider.fkIDteam,'Contract club mismatch');
    assert.ok(!Object.hasOwn(riders,String(rider.IDcyclist)),'Duplicate rider');riders[String(rider.IDcyclist)]=rider.fkIDteam;
  }
  for(let id=9001;id<=9007;id++)assert.equal(riders[String(id)],243,'Observer rider absent');
  const sourceRaces=rows('select r.IDrace,r.gene_sz_filename,rr.gene_i_max_team,rr.gene_i_min_riders,rr.gene_i_max_riders from STA_race r join STA_race_rules rr on rr.fkIDrace=r.IDrace where r.IDrace in(25,173,4,105) order by r.IDrace');
  assert.equal(sourceRaces.length,4,'Missing or duplicate gala rules');
  const expected={4:['topclas_roubaix',25],25:['top_tdf',23],105:['c0_classiquedunkerque',18],173:['topclas_maastricht',25]},races={};
  for(const race of sourceRaces){const [filename,maxTeams]=expected[race.IDrace];assert.equal(race.gene_sz_filename,filename);assert.equal(race.gene_i_max_team,maxTeams);assert.equal(race.gene_i_min_riders,7);assert.equal(race.gene_i_max_riders,8);races[String(race.IDrace)]={filename,maxTeams,minRiders:7,maxRiders:8};}
  registry={formatVersion:1,title,workshopId:'3811779261',steamManifestId:manifest,databaseSha256:actualHash,teams,riders,races};
}finally{db.close();}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'assets','pcm','gala-s4-steam-compatibility.json');
if(write)writeFileSync(output,JSON.stringify(registry)+'\n');
console.log(JSON.stringify({mode:write?'written':'preview',databaseSha256:actualHash,title,steamManifestId:manifest,teams:registry.teams.length,riders:Object.keys(registry.riders).length,races:Object.keys(registry.races).length,output,productionTouched:false}));
