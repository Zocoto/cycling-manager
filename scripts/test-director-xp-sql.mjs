// Execute only against an isolated in-memory database; never a live project.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

if (!process.argv[2] || !/^(?:[A-Za-z]:[\\/]|\/)/.test(process.argv[2])) throw Error('Absolute local PGlite module path required');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const compiled = ts.transpileModule(readFileSync('lib/game/sporting-director-progression.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { calculateSportingDirectorProgression } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
let checks = 0;
await db.exec(`
  create schema private;
  create table public.sporting_directors(
    id integer primary key, experience_points integer not null default 0 check(experience_points >= 0),
    reputation_points numeric not null default 0, peak_reputation_points numeric not null default 0,
    constraint sporting_directors_experience_points_cap check(experience_points <= 63700)
  );
  create function public.enforce_sporting_director_progression_caps() returns trigger language plpgsql as $$
  begin new.reputation_points := greatest(0,coalesce(new.reputation_points,0));
    new.experience_points := least(new.experience_points,63700); return new; end; $$;
  create trigger enforce_sporting_director_progression_caps before insert or update of reputation_points,experience_points
    on public.sporting_directors for each row execute function public.enforce_sporting_director_progression_caps();
  create function private.track_sporting_director_peak_reputation() returns trigger language plpgsql as $$
  begin new.peak_reputation_points := greatest(coalesce(old.peak_reputation_points,0),coalesce(new.peak_reputation_points,0),coalesce(new.reputation_points,0)); return new; end; $$;
  create trigger track_sporting_director_peak_reputation before update of reputation_points,peak_reputation_points
    on public.sporting_directors for each row execute function private.track_sporting_director_peak_reputation();
  insert into public.sporting_directors values(1,63700,2500,2500),(2,175,100,100);
`);
const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const before = (await db.query('select * from public.sporting_directors order by id')).rows;
const peakBefore = await scalar("select pg_get_functiondef('private.track_sporting_director_peak_reputation()'::regprocedure) definition");
await db.exec(readFileSync('supabase/migrations/20261019110000_uncap_sporting_director_experience.sql','utf8'));
assert.deepEqual((await db.query('select * from public.sporting_directors order by id')).rows, before); checks++;
assert.deepEqual(await scalar("select pg_get_functiondef('private.track_sporting_director_peak_reputation()'::regprocedure) definition"), peakBefore); checks++;
await db.exec('update public.sporting_directors set experience_points=experience_points+2550 where id=1');
assert.deepEqual(await scalar('select experience_points,reputation_points,peak_reputation_points from public.sporting_directors where id=1'), {experience_points:66250,reputation_points:'2500',peak_reputation_points:'2500'}); checks++;
await db.exec('insert into public.sporting_directors values(3,252450,5000,5000)');
assert.equal((await scalar('select experience_points from public.sporting_directors where id=3')).experience_points,252450); checks++;
await db.exec('update public.sporting_directors set reputation_points=-1 where id=1');
assert.deepEqual(await scalar('select reputation_points,peak_reputation_points,experience_points from public.sporting_directors where id=1'),{reputation_points:'0',peak_reputation_points:'2500',experience_points:66250}); checks++;
await db.exec('update public.sporting_directors set reputation_points=3000 where id=1');
assert.equal((await scalar('select peak_reputation_points from public.sporting_directors where id=1')).peak_reputation_points,'3000'); checks++;
await assert.rejects(()=>db.exec('update public.sporting_directors set experience_points=-1 where id=1')); checks++;
await assert.rejects(()=>db.exec('update public.sporting_directors set experience_points=null where id=1')); checks++;
const cases = [-1,0,74.9,99,100,63700,64700,66249,66250,68850,113700,2147483647];
for (const level of [...Array.from({length:500},(_,i)=>i+1),1000,10000,100000]) {
  const xp=25*(level-1)*(level+2); cases.push(xp,Math.max(0,xp-1),xp+1);
}
const rows = (await db.query('select xp::text, public.calculate_staff_director_level(xp) level from unnest($1::numeric[]) xp',[cases])).rows;
for (const row of rows) { assert.equal(row.level,calculateSportingDirectorProgression(Number(row.xp)).level,`SQL/TS mismatch at ${row.xp}`); checks++; }
assert.equal((await scalar('select public.calculate_staff_director_level(null) level')).level,1); checks++;
console.log(JSON.stringify({isolatedPostgres:true,checks,sqlTsParityCases:rows.length,existingXpPreserved:true,reputationAndPeakPreserved:true,awardsAboveFormerCap:true}));
await db.close();
