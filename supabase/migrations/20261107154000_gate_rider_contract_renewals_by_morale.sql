begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- Match the rider profile: latest condition in the active season up to the
-- current game day, or neutral morale when that condition is unavailable.
create function private.rider_renewal_morale_allows(
  p_rider_id uuid,
  p_season_id uuid,
  p_current_day_number integer
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select condition.morale
    from public.season_days as day
    join public.rider_condition_states as condition
      on condition.season_day_id = day.id and condition.rider_id = p_rider_id
    where day.season_id = p_season_id
      and day.day_number <= coalesce(p_current_day_number, 1)
    order by day.day_number desc
    limit 1
  ), 60) >= 40;
$$;

revoke all on function private.rider_renewal_morale_allows(uuid, uuid, integer)
  from public, anon, authenticated, service_role;

-- Keep the existing authorization, salary, locks and successor handling.
-- Patch only renewal entry points so activation of signed contracts is exempt.
do $migration$
declare
  signature regprocedure;
  definition text;
  context_anchor constant text := E'season.game_year\n  into v_context';
  guard_anchor text;
  guard_replacement text;
  individual_guard constant text := $guard$
  if not private.rider_renewal_morale_allows(
    p_rider_id, v_context.season_id, v_context.current_day_number
  ) then
    raise exception 'Ce coureur ne souhaite pas prolonger avec l’équipe. Remontez son moral à au moins 40 sur 100 pour qu’il accepte de signer.';
  end if;

$guard$;
begin
  foreach signature in array array[
    'public.renew_current_team_rider(uuid)'::regprocedure,
    'public.renew_current_team_rider_until(uuid,integer)'::regprocedure,
    'public.renew_all_current_team_riders()'::regprocedure
  ] loop
    definition := replace(pg_get_functiondef(signature), chr(13), '');

    if signature = 'public.renew_all_current_team_riders()'::regprocedure then
      guard_anchor := '        and contract_end.game_year <= v_context.game_year';
      guard_replacement := guard_anchor || $filter$
        and private.rider_renewal_morale_allows(
          contract.rider_id, v_context.season_id, v_context.current_day_number
        )$filter$;
    else
      guard_anchor := case
        when signature = 'public.renew_current_team_rider(uuid)'::regprocedure
          then E'  select next_season.id\n  into v_next_season_id'
        else '  v_start_year := v_active_end_year + 1;'
      end;
      guard_replacement := ltrim(individual_guard, chr(10)) || guard_anchor;
    end if;

    if cardinality(string_to_array(definition, context_anchor)) <> 2
       or cardinality(string_to_array(definition, guard_anchor)) <> 2 then
      raise exception 'Unexpected definition of %', signature;
    end if;

    definition := replace(definition, context_anchor,
      E'season.game_year, season.current_day_number\n  into v_context');
    execute replace(definition, guard_anchor, guard_replacement);
  end loop;
end;
$migration$;

commit;
