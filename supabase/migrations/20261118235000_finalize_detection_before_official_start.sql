begin;
set local lock_timeout = '750ms';
set local statement_timeout = '12s';

create function private.due_free_agent_detection_editions(
  p_now timestamptz, p_edition_ids uuid[], p_limit integer
)
returns table (race_edition_id uuid, first_departure timestamptz)
language sql stable set search_path = ''
as $$
  select edition.id, first_stage.departure_at
  from public.race_editions as edition
  join public.seasons as season on season.id = edition.season_id and season.status = 'active'
  join public.races as race on race.id = edition.race_id and race.competition_type = 'standard'
  join public.race_categories as category on category.id = edition.race_category_id
    and category.code in ('local', 'regional', 'national', 'continental', 'world')
  join public.stages as first_stage on first_stage.race_edition_id = edition.id
    and first_stage.stage_number = 1 and first_stage.status = 'planned'
  where (p_edition_ids is null or edition.id = any(p_edition_ids))
    and edition.detection_teams_finalized_at is null
    and edition.status in ('planned', 'registration_open', 'registration_closed')
    and coalesce(edition.withdrawal_closes_at, edition.registration_closes_at) <= p_now
    and first_stage.departure_at > p_now
    and (p_edition_ids is not null or exists (
      select 1 from public.race_registrations registration
      where registration.race_edition_id = edition.id
        and registration.status = 'accepted' and registration.team_season_id is not null
        and exists (
          select 1 from public.race_rosters roster
          where roster.race_registration_id = registration.id
            and roster.status in ('selected', 'confirmed')
        )
    ))
    and not exists (
      select 1 from public.official_stage_simulations simulation
      where simulation.race_edition_id = edition.id
    )
    and not exists (
      select 1 from public.stages stage
      join public.official_stage_simulation_claims claim on claim.stage_id = stage.id
      where stage.race_edition_id = edition.id
        and claim.claimed_at >= p_now - interval '120 seconds'
    )
    and not exists (
      select 1 from public.stages stage
      join public.stage_results result on result.stage_id = stage.id
      where stage.race_edition_id = edition.id
    )
    and not exists (
      select 1 from public.race_results result where result.race_edition_id = edition.id
    )
  order by first_stage.departure_at,
    coalesce(edition.withdrawal_closes_at, edition.registration_closes_at), edition.id
  limit p_limit;
$$;

revoke all on function private.due_free_agent_detection_editions(timestamptz, uuid[], integer)
  from public, anon, authenticated, service_role;

create function public.get_due_free_agent_detection_edition_ids(p_now timestamptz)
returns table (race_edition_id uuid)
language sql stable security definer
set search_path = ''
set statement_timeout = '4s'
as $$
  select due.race_edition_id
  from private.due_free_agent_detection_editions(p_now, null, 32) as due;
$$;

-- Reuse the installed roster generator and its eligibility/priority rules.
-- Both settlement endpoints share the same bounded transactional writer.
do $migration$
declare
  v_source text := replace(pg_catalog.pg_get_functiondef(
    'public.settle_due_free_agent_detection_teams(timestamptz)'::regprocedure
  ), chr(13), '');
  v_patch record;
  v_original text;
  v_replacement text;
  v_conflicts constant text := $pattern$\s+and exists \(\s+select 1\s+from public\.stages as target_stage\s+join public\.stages as other_stage\s+on other_stage\.season_day_id = target_stage\.season_day_id\s+and other_stage\.day_slot = target_stage\.day_slot\s+and other_stage\.race_edition_id = other_edition\.id\s+where target_stage\.race_edition_id = v_edition\.id\s+\)$pattern$;
begin
  if position('Local detection geography precedes sporting level.' in v_source) = 0 then
    raise exception 'Unexpected detection-team geography. No changes applied.';
  end if;

  for v_patch in select * from (values
    ($old$public.settle_due_free_agent_detection_teams(p_now timestamp with time zone DEFAULT now())$old$,
     $new$private.fill_free_agent_detection_teams(p_now timestamp with time zone, p_edition_ids uuid[])$new$),
    ($old$  v_real_team_count integer;$old$,
     $new$  v_real_team_count integer;
  v_has_human boolean;
  v_conflicting_edition_ids uuid[];$new$),
    ($old$      edition.id,
      edition.season_id,$old$,
     $new$      edition.id,
      edition.season_id,
      due.first_departure,$new$),
    ($old$    from public.race_editions as edition
    join public.races as race$old$,
     $new$    from private.due_free_agent_detection_editions(
      p_now, p_edition_ids, case when p_edition_ids is null then 4 else 8 end
    ) as due
    join public.race_editions as edition on edition.id = due.race_edition_id
    join public.races as race$new$),
    ($old$    where edition.detection_teams_finalized_at is null
      and edition.status in (
        'planned',
        'registration_open',
        'registration_closed'
      )
      and coalesce(
        edition.withdrawal_closes_at,
        edition.registration_closes_at
      ) is not null
      and coalesce(
        edition.withdrawal_closes_at,
        edition.registration_closes_at
      ) <= p_now
      and exists (
        select 1
        from public.stages as first_stage
        where first_stage.race_edition_id = edition.id
          and first_stage.stage_number = 1
          and first_stage.status = 'planned'
          and first_stage.departure_at > p_now
          and not exists (
            select 1 from public.official_stage_simulations as simulation where simulation.stage_id = first_stage.id
          )
          and not exists (
            -- Official simulation claims become reclaimable after 120 seconds.
            select 1 from public.official_stage_simulation_claims as claim
            where claim.stage_id = first_stage.id and claim.claimed_at >= p_now - interval '120 seconds'
          )
          and not exists (
            select 1 from public.stage_results as result where result.stage_id = first_stage.id
          )
      )
    order by
      coalesce(edition.withdrawal_closes_at, edition.registration_closes_at),
      edition.id$old$,
     $new$    where edition.detection_teams_finalized_at is null
      and edition.status in ('planned', 'registration_open', 'registration_closed')
    order by due.first_departure,
      coalesce(edition.withdrawal_closes_at, edition.registration_closes_at), edition.id$new$),
    ($old$    select count(*)::integer
    into v_real_team_count
    from public.race_registrations as registration$old$,
     $new$    select count(*)::integer, coalesce(bool_or(
      case when v_edition.category_code = 'local'
        then private.is_cyclogazette_human_team(team.team_id) else true end
    ), false)
    into v_real_team_count, v_has_human
    from public.race_registrations as registration
    join public.team_seasons as team on team.id = registration.team_season_id$new$),
    ($old$    if v_real_team_count = 0 then$old$,
     $new$    if not v_has_human then$new$),
    ($old$    v_processed := v_processed + 1;$old$,
     $new$    if v_edition.first_departure <= clock_timestamp() then continue; end if;
    v_processed := v_processed + 1;$new$),
    ($old$    v_candidate_ids := array[]::uuid[];
    v_candidate_limit$old$,
     $new$    select coalesce(array_agg(distinct other.race_edition_id), array[]::uuid[])
    into v_conflicting_edition_ids
    from public.stages as target
    join public.stages as other on other.season_day_id = target.season_day_id
      and other.day_slot = target.day_slot and other.race_edition_id <> v_edition.id
    where target.race_edition_id = v_edition.id;

    v_candidate_ids := array[]::uuid[];
    v_candidate_limit$new$),
    ($old$      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(v_candidate.id::text, 0)
      );$old$,
     $new$      if not pg_catalog.pg_try_advisory_xact_lock(
        pg_catalog.hashtextextended(v_candidate.id::text, 0)
      ) then
        continue;
      end if;$new$),
    ($old$    if v_teams_to_create = 0 then
      update public.race_editions
      set detection_teams_finalized_at = p_now
      where id = v_edition.id;
      continue;
    end if;$old$,
     $new$    if v_teams_to_create = 0 then
      if v_edition.category_code <> 'local' then
        update public.race_editions
        set detection_teams_finalized_at = p_now
        where id = v_edition.id;
      end if;
      continue;
    end if;$new$),
    ($old$    select array_agg(available.slot_number order by available.slot_number)$old$,
     $new$    if v_edition.first_departure <= clock_timestamp() then continue; end if;

    select array_agg(available.slot_number order by available.slot_number)$new$),
    ($old$          and existing.detection_team_number = slot.slot_number
      )$old$,
     $new$          and existing.detection_team_number = slot.slot_number
          and existing.status = 'accepted'
          and exists (
            select 1 from public.race_rosters as roster
            where roster.race_registration_id = existing.id
              and roster.status in ('selected', 'confirmed')
          )
      )$new$),
    ($old$    update public.race_editions
    set detection_teams_finalized_at = p_now
    where id = v_edition.id;
  end loop;$old$,
     $new$    -- A local waiting for free riders stays eligible up to its first start.
    if v_edition.category_code <> 'local' or v_teams_to_create = v_missing_team_count then
      update public.race_editions
      set detection_teams_finalized_at = p_now
      where id = v_edition.id;
    end if;
  end loop;$new$)
  ) as patches(source, replacement)
  loop
    v_original := replace(v_patch.source, chr(13), '');
    v_replacement := replace(v_patch.replacement, chr(13), '');
    if (length(v_source) - length(replace(v_source, v_original, ''))) / length(v_original) <> 1 then
      raise exception 'Unexpected detection-team settlement definition at %. No changes applied.',
        left(v_original, 90);
    end if;
    v_source := replace(v_source, v_original, v_replacement);
  end loop;

  -- Precompute the edition conflicts once; both initial selection and the
  -- post-advisory-lock recheck still inspect live accepted/pending rosters.
  if (select count(*) from regexp_matches(v_source, v_conflicts, 'g')) <> 2 then
    raise exception 'Unexpected detection-team conflict probes. No changes applied.';
  end if;
  v_source := regexp_replace(v_source, v_conflicts, '', 'g');
  v_original := 'and other_edition.id <> v_edition.id';
  if (length(v_source) - length(replace(v_source, v_original, ''))) / length(v_original) <> 2 then
    raise exception 'Unexpected detection-team conflicting editions. No changes applied.';
  end if;
  v_source := replace(v_source, v_original, 'and other_edition.id = any(v_conflicting_edition_ids)');
  execute v_source;
end;
$migration$;

revoke all on function private.fill_free_agent_detection_teams(timestamptz, uuid[])
  from public, anon, authenticated, service_role;

create or replace function public.settle_due_free_agent_detection_teams(p_now timestamptz default now())
returns table (
  processed_editions integer, created_teams integer, selected_riders integer,
  skipped_without_managed_team integer, editions_with_insufficient_pool integer
)
language sql security definer set search_path = ''
set statement_timeout = '6s'
as $$
  select * from private.fill_free_agent_detection_teams(p_now, null);
$$;

create function public.settle_free_agent_detection_teams_for_editions(
  p_edition_ids uuid[], p_now timestamptz
)
returns table (
  processed_editions integer, created_teams integer, selected_riders integer,
  skipped_without_managed_team integer, editions_with_insufficient_pool integer
)
language plpgsql security definer set search_path = ''
set statement_timeout = '6s'
set lock_timeout = '500ms'
as $$
begin
  if p_edition_ids is null or cardinality(p_edition_ids) not between 1 and 8
    or array_position(p_edition_ids, null) is not null or p_now is null then
    raise exception 'Invalid detection-team settlement batch.' using errcode = '22023';
  end if;

  -- A concurrent maintenance pass may hold this edition. Wait briefly for its
  -- commit before the caller reads the roster, or report the lock contention.
  perform edition.id
  from private.due_free_agent_detection_editions(p_now, p_edition_ids, 8) as due
  join public.race_editions as edition on edition.id = due.race_edition_id
  order by edition.id
  for update of edition;

  return query select * from private.fill_free_agent_detection_teams(p_now, p_edition_ids);
end;
$$;

revoke all on function public.get_due_free_agent_detection_edition_ids(timestamptz),
  public.settle_free_agent_detection_teams_for_editions(uuid[], timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.get_due_free_agent_detection_edition_ids(timestamptz),
  public.settle_free_agent_detection_teams_for_editions(uuid[], timestamptz) to service_role;

comment on function public.settle_due_free_agent_detection_teams(timestamptz) is
  'Compatibility settlement. Fills up to four due editions and never edits a started or locked race.';

notify pgrst, 'reload schema';
commit;
