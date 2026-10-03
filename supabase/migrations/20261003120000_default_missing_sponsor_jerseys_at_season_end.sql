begin;

-- A missing visual choice must never keep a signed sponsor contract out of
-- the season rollover or of the PCM/Steam export.  The player's explicit
-- choice always wins; only completely missing choices receive the neutral
-- catalogue default.
create or replace function public.assign_default_next_season_sponsor_jerseys(
  p_source_season_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.seasons%rowtype;
  v_target public.seasons%rowtype;
  v_planned_count integer := 0;
  v_continuing_count integer := 0;
begin
  select season.*
  into v_source
  from public.seasons as season
  where season.id = p_source_season_id;

  if v_source is null then
    raise exception 'La saison source est introuvable.';
  end if;

  select season.*
  into v_target
  from public.seasons as season
  where season.game_year = v_source.game_year + 1
    and season.status = 'planned';

  if v_target is null then
    return jsonb_build_object(
      'sourceSeasonId', v_source.id,
      'targetSeasonId', null,
      'plannedDefaults', 0,
      'continuingDefaults', 0
    );
  end if;

  -- New contracts store the S4 choice directly on selected_jersey_*.
  with defaulted as (
    update public.team_sponsor_contracts as contract
    set selected_jersey_id = lower(btrim(sponsor.catalog_key)) || '-classic',
        selected_jersey_style = 'classic'
    from public.sponsors as sponsor
    where sponsor.id = contract.sponsor_id
      and nullif(btrim(sponsor.catalog_key), '') is not null
      and contract.role = 'principal'
      and contract.status = 'planned'
      and contract.start_season_id = v_target.id
      and contract.selected_jersey_id is null
      and contract.selected_jersey_style is null
    returning contract.id
  )
  select count(*)::integer into v_planned_count from defaulted;

  -- Multi-season contracts retain the current shirt until rollover, so the
  -- next-season default belongs in pending_jersey_*.
  with defaulted as (
    update public.team_sponsor_contracts as contract
    set pending_jersey_id = lower(btrim(sponsor.catalog_key)) || '-classic',
        pending_jersey_style = 'classic',
        pending_jersey_season_id = v_target.id
    from public.sponsors as sponsor,
         public.seasons as start_season
    where sponsor.id = contract.sponsor_id
      and start_season.id = contract.start_season_id
      and nullif(btrim(sponsor.catalog_key), '') is not null
      and contract.role = 'principal'
      and contract.status = 'active'
      and v_target.game_year between start_season.game_year and
        start_season.game_year + contract.contract_duration_seasons - 1
      and contract.pending_jersey_id is null
      and contract.pending_jersey_style is null
      and contract.pending_jersey_season_id is null
    returning contract.id
  )
  select count(*)::integer into v_continuing_count from defaulted;

  return jsonb_build_object(
    'sourceSeasonId', v_source.id,
    'targetSeasonId', v_target.id,
    'plannedDefaults', v_planned_count,
    'continuingDefaults', v_continuing_count
  );
end;
$$;

revoke all on function public.assign_default_next_season_sponsor_jerseys(uuid)
  from public, anon, authenticated;
grant execute on function public.assign_default_next_season_sponsor_jerseys(uuid)
  to service_role;

create or replace function private.default_sponsor_jerseys_at_season_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last_day_number integer;
begin
  if old.status = 'active' and new.status = 'completed' then
    perform public.assign_default_next_season_sponsor_jerseys(old.id);
    return new;
  end if;

  if new.status <> 'active' then
    return new;
  end if;

  select max(day.day_number)::integer
  into v_last_day_number
  from public.season_days as day
  where day.season_id = new.id;

  if coalesce(new.current_day_number, 0) >= coalesce(v_last_day_number, 28)
    and (
      old.current_day_number is distinct from new.current_day_number
      or old.status is distinct from new.status
    )
  then
    perform public.assign_default_next_season_sponsor_jerseys(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists default_sponsor_jerseys_at_season_deadline
  on public.seasons;
create trigger default_sponsor_jerseys_at_season_deadline
before update of current_day_number, status on public.seasons
for each row
execute function private.default_sponsor_jerseys_at_season_deadline();

-- Curative safety for a deployment occurring after the last day has already
-- been synchronized.  This remains a no-op during the normal J21-J27 window.
do $apply_current_deadline$
declare
  v_source public.seasons%rowtype;
  v_last_day_number integer;
begin
  select season.*
  into v_source
  from public.seasons as season
  where season.status = 'active';

  if v_source is null then
    return;
  end if;

  select max(day.day_number)::integer
  into v_last_day_number
  from public.season_days as day
  where day.season_id = v_source.id;

  if coalesce(v_source.current_day_number, 0) >=
    coalesce(v_last_day_number, 28)
  then
    perform public.assign_default_next_season_sponsor_jerseys(v_source.id);
  end if;
end;
$apply_current_deadline$;

comment on function public.assign_default_next_season_sponsor_jerseys(uuid) is
  'Attribue la variante classic aux contrats principaux sans choix de maillot pour la saison suivante, sans jamais écraser un choix du DS.';

notify pgrst, 'reload schema';

commit;
