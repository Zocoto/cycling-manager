-- Count validated runs within each ranking period without changing best-score ordering.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';
do $migration$
declare
  v_definition text;
  v_old_projection constant text := 'record.score,record.distance,record.coins from (';
  v_new_projection constant text := 'record.score,record.distance,record.coins,record.attempts from (';
  v_old_record constant text := 'user_id,score,distance,coins,finished_at from public.halloween_runs';
  v_new_record constant text := 'user_id,score,distance,coins,finished_at,count(*) over(partition by user_id) as attempts from public.halloween_runs';
begin
  v_definition := pg_catalog.pg_get_functiondef('public.get_current_halloween_state()'::regprocedure);
  if (length(v_definition)-length(replace(v_definition,v_old_projection,'')))/length(v_old_projection)=2
    and (length(v_definition)-length(replace(v_definition,v_old_record,'')))/length(v_old_record)=2 then
    execute replace(replace(v_definition,v_old_projection,v_new_projection),v_old_record,v_new_record);
  elsif (length(v_definition)-length(replace(v_definition,v_new_projection,'')))/length(v_new_projection)<>2
    or (length(v_definition)-length(replace(v_definition,v_new_record,'')))/length(v_new_record)<>2 then
    raise exception 'Unexpected Halloween ranking projection; review before adding attempts.';
  end if;
end;
$migration$;
commit;
