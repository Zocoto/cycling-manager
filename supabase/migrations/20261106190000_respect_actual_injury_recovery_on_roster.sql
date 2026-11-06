begin;
set local lock_timeout='500ms';
set local statement_timeout='5s';

-- A season break can heal a rider before the old medical estimate. Keep the
-- historical unavailability interval, but end it at that recorded recovery.
-- Active injuries retain their estimate even if a stale recovery timestamp is
-- present; recovered rows without a timestamp conservatively keep the estimate.
-- Patch only this predicate so camps, conflict guards and the explicit audited
-- international-selection restoration exception remain byte-for-byte intact.
do $actual_recovery$
declare
  v_definition text;
  v_old constant text := '      and injury.expected_recovery_at > coalesce(';
  v_new constant text := $predicate$      -- roster-actual-injury-recovery-v1
      and case when injury.status = 'recovered' then
        least(injury.expected_recovery_at,
          coalesce(injury.recovered_at, injury.expected_recovery_at))
        else injury.expected_recovery_at end > coalesce($predicate$;
begin
  select replace(pg_get_functiondef(
    'public.enforce_rider_health_availability_on_roster()'::regprocedure
  ), E'\r\n', E'\n') into v_definition;
  if position('-- roster-actual-injury-recovery-v1' in v_definition)>0 then
    if position(v_new in v_definition)=0 or position(v_old in v_definition)>0 then
      raise exception 'Incomplete actual injury recovery roster guard; migration stopped.';
    end if;
    return;
  end if;
  if array_length(string_to_array(v_definition,v_old),1)<>2
    or position('international-selection-stage-race-withdrawals-2026-09-03' in v_definition)=0
    or position('from public.rider_form_camps as camp' in v_definition)=0
    or position('and injury.started_at < coalesce(' in v_definition)=0
  then
    raise exception 'Unexpected roster health guard definition; migration stopped.';
  end if;
  execute replace(v_definition,v_old,v_new);
end;
$actual_recovery$;

notify pgrst,'reload schema';
commit;
