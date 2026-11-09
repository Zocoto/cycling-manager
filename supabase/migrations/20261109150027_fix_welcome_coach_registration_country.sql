begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- Team seasons store the federation affiliation in registration_country_id.
-- The original optional trigger caught the missing-column error and skipped the gift.
do $fix_welcome_coach_country$
declare
  v_definition text;
  v_old_country constant text := 'coalesce(ts.country_id,t.home_country_id)';
  v_current_country constant text := 'coalesce(ts.registration_country_id,t.home_country_id)';
begin
  select pg_get_functiondef('private.grant_welcome_coach(uuid)'::regprocedure)
    into strict v_definition;

  if (length(v_definition) - length(replace(v_definition, v_old_country, '')))
       <> length(v_old_country) then
    raise exception 'Unexpected welcome coach country expression';
  end if;

  execute replace(v_definition, v_old_country, v_current_country);
end;
$fix_welcome_coach_country$;

commit;
