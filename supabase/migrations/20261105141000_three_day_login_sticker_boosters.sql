begin;
set local statement_timeout = '8s';
set local lock_timeout = '500ms';

-- Keep the existing stock, Paris-day hooks, source references and owner locks.
-- Only future connection milestones change. No attendance or reward backfill.
do $migration$
declare
  v_definition text;
  v_old text := 'if mod(v_days,7)=0 then';
  v_new text := E'-- three_day_stickers_v1\n  if mod(v_days,3)=0 then';
begin
  select pg_get_functiondef('private.record_weekly_login_booster_connection(uuid,uuid,date)'::regprocedure)
    into v_definition;
  if position('three_day_stickers_v1' in v_definition) = 0 then
    if (length(v_definition) - length(replace(v_definition,v_old,''))) / length(v_old) <> 1 then
      raise exception 'Login booster milestone changed; review required';
    end if;
    execute replace(v_definition,v_old,v_new);
  end if;
end;
$migration$;

commit;
