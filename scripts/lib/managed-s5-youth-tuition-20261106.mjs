// Mirrors services/youth-development.ts scheduleTuition for one newly signed
// academy rider. Only pending bills are created; no balance is credited/debited.
import assert from 'node:assert/strict';
const uuid=value=>{
  assert.match(value??'',/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i);
  return "'"+value+"'::uuid";
};
export function managedS5YouthTuitionPostcheckSql(action,team){
  assert.equal(action.rpc,'sign_current_team_youth_candidate');
  assert.equal(action.bot_key,team.bot_key);
  const candidate=uuid(action.args.p_candidate_id),club=uuid(team.team_id),account=uuid(team.team_season_id);
  const season=uuid(team.season_id);
  return `
    if not exists(select 1 from public.youth_academy_riders a
      join public.team_seasons ts on ts.id=${account} and ts.team_id=a.team_id and ts.season_id=${season}
      where a.id=(v_result->>0)::uuid and a.candidate_id=${candidate} and a.team_id=${club}
        and a.joined_season_id=${season} and a.joined_day_number=1 and a.status in('active','recruited')
        and a.tuition_per_season>0) then raise exception 'Unexpected new academy rider';end if;
    insert into public.team_finance_transactions(team_season_id,season_day_id,day_number,amount,
      category,status,description,source_reference)
    select ${account},sd.id,d.day_number,-round(a.tuition_per_season/4,2),'training','pending',
      'Frais de scolarité — '||a.first_name||' '||a.last_name,
      'youth-tuition:'||a.id::text||':'||${season}::text||':'||d.installment::text
    from public.youth_academy_riders a cross join(values(1,7),(2,14),(3,21),(4,28))d(installment,day_number)
    join public.season_days sd on sd.season_id=${season} and sd.day_number=d.day_number
    where a.id=(v_result->>0)::uuid and a.team_id=${club}
    on conflict(team_season_id,source_reference) do nothing;
    if (select count(*) from public.team_finance_transactions f where f.team_season_id=${account}
      and f.source_reference like 'youth-tuition:'||(v_result->>0)||':'||${season}::text||':%')<>4
      or not exists(select 1 from public.youth_academy_riders a
        join lateral(select count(*) n,sum(f.amount) amount from public.team_finance_transactions f
          where f.team_season_id=${account} and f.source_reference like 'youth-tuition:'||a.id::text||':'||${season}::text||':%'
            and f.category='training' and f.status='pending' and f.day_number in(7,14,21,28)) due on true
        where a.id=(v_result->>0)::uuid and due.n=4 and due.amount=-a.tuition_per_season)
      then raise exception 'The four normal academy tuition bills are inconsistent';end if;`;
}
