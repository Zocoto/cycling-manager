begin;
set local lock_timeout = '2s';
set local statement_timeout = '20s';

-- Final settlement preserves published junior stages. Keep the previous
-- scoring rules for the remaining stages of tours already in progress.
alter table public.development_race_editions
  add column rider_personalities_enabled boolean not null default true;

update public.development_race_editions as edition
set rider_personalities_enabled = false
where edition.status = 'planned'
  and exists (
    select 1 from public.development_race_results as result
    where result.race_edition_id = edition.id and result.result_scope = 'stage'
  );

create function private.junior_imprevisible_score_delta(
  p_edition_id uuid, p_stage_number integer, p_stage_type text,
  p_personality_key text, p_rider_id uuid, p_enabled boolean
)
returns numeric
language sql
stable
set search_path = ''
as $$
  select case
    when p_enabled is not true or p_stage_type is distinct from 'road'
      or p_personality_key is distinct from 'imprevisible' then 0
    when exists (
      select 1 from public.development_race_stages as stage
      where stage.race_edition_id = p_edition_id
        and stage.stage_number > p_stage_number and stage.stage_type = 'road'
    ) then 0
    else case
      floor(public.development_hash_unit('junior-imprevisible:' || p_edition_id::text || ':' || p_rider_id::text) * 3)
      when 0 then -.025
      when 1 then 0
      else .025
    end
  end;
$$;

revoke all on function private.junior_imprevisible_score_delta(uuid, integer, text, text, uuid, boolean)
  from public, anon, authenticated, service_role;

-- Extend the real-rider score of each settlement entry point. Guard the
-- replacements so a change in the base engines cannot silently skip a path.
do $migration$
declare
  v_patch record;
  v_definition text;
  v_updated text;
begin
  for v_patch in
    select * from (values
      (
        'public.simulate_development_race_pre_federation_juniors(uuid)',
        $anchor$+ (public.development_hash_unit(v_edition.id::text || ':' || v_stage.id::text || ':' || youth.id::text) - .5) * .72$anchor$,
        'v_edition.id, v_stage.stage_number, v_stage.stage_type, youth.personality_key, youth.id, v_edition.rider_personalities_enabled'
      ),
      (
        'public.simulate_development_race_stage(uuid,uuid)',
        $anchor$+ (public.development_hash_unit(
          v_edition.id::text || ':' || v_stage.id::text || ':' || youth.id::text
        ) - .5) * .72$anchor$,
        'v_edition.id, v_stage.stage_number, v_stage.stage_type, youth.personality_key, youth.id, v_edition.rider_personalities_enabled'
      ),
      (
        'public.simulate_development_race(uuid)',
        $anchor$+ (public.development_hash_unit(
          v_edition.id::text || ':' || stage.id::text || ':' || academy.id::text
        ) - .5) * .72$anchor$,
        'v_edition.id, stage.stage_number, stage.stage_type, academy.personality_key, academy.id, v_edition.rider_personalities_enabled'
      ),
      (
        'public.settle_due_lightweight_junior_national_championships()',
        $anchor$+ (public.development_hash_unit(
          edition.id::text || ':' || academy.id::text || ':junior-cn'
        ) - .5) * 1.35$anchor$,
        'edition.id, stage.stage_number, stage.stage_type, academy.personality_key, academy.id, edition.rider_personalities_enabled'
      )
    ) as patch(signature, anchor, arguments)
  loop
    v_definition := replace(pg_get_functiondef(v_patch.signature::regprocedure), chr(13), '');
    if length(v_definition) - length(replace(v_definition, v_patch.anchor, '')) <> length(v_patch.anchor) then
      raise exception 'Expected one real junior score to extend in %', v_patch.signature;
    end if;

    v_updated := replace(v_definition, v_patch.anchor, v_patch.anchor
      || E'\n        + private.junior_imprevisible_score_delta(' || v_patch.arguments || ')');
    execute v_updated;
  end loop;
end;
$migration$;

create index development_race_results_academy_stage_idx
  on public.development_race_results (academy_rider_id, race_edition_id, stage_id)
  where result_scope = 'stage' and academy_rider_id is not null;

create function private.apply_junior_globe_trotteur_morale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start record;
  v_reference text;
begin
  if not exists (
    select 1 from public.youth_academy_riders as rider
    where rider.id = new.academy_rider_id and rider.personality_key = 'globe_trotteur'
  ) then
    return new;
  end if;

  select edition.season_id, country.id as country_id, country.iso_alpha2 as country_code,
    day.id as season_day_id, day.calendar_date, stage.stage_number
  into v_start
  from public.development_race_editions as edition
  join public.development_race_stages as stage on stage.race_edition_id = edition.id and stage.id = new.stage_id
  join public.season_days as day on day.season_id = edition.season_id and day.day_number = stage.day_number
  join public.countries as country on country.iso_alpha2 = edition.country_code
  where edition.id = new.race_edition_id and edition.rider_personalities_enabled;
  if not found then
    return new;
  end if;

  -- Share the morale ledger lock to make the career visit and seasonal cap
  -- checks safe against a retry or simultaneous results.
  perform pg_advisory_xact_lock(hashtextextended(new.academy_rider_id::text, 1));
  v_reference := 'personality:globe_trotteur:' || v_start.country_id::text;

  if exists (
    select 1 from public.youth_rider_morale_events as event
    where event.academy_rider_id = new.academy_rider_id and event.source_type = 'development_result'
      and event.source_reference = v_reference
  ) or (
    select count(*)
    from public.youth_rider_morale_events as event
    join public.season_days as day on day.id = event.season_day_id
    where event.academy_rider_id = new.academy_rider_id and event.source_type = 'development_result'
      and day.season_id = v_start.season_id and event.source_reference like 'personality:globe_trotteur:%'
  ) >= 3 then
    return new;
  end if;

  if exists (
    select 1
    from public.development_race_results as previous
    join public.development_race_editions as edition on edition.id = previous.race_edition_id
    join public.development_race_stages as stage on stage.id = previous.stage_id
    join public.season_days as day on day.season_id = edition.season_id and day.day_number = stage.day_number
    where previous.academy_rider_id = new.academy_rider_id and previous.result_scope = 'stage'
      and edition.country_code = v_start.country_code
      and (day.calendar_date, stage.stage_number, stage.id)
        < (v_start.calendar_date, v_start.stage_number, new.stage_id)
  ) then
    return new;
  end if;

  perform public.apply_youth_rider_morale_event(
    new.academy_rider_id, v_start.season_day_id, 'development_result', v_reference, 1,
    'Caractère Globe-trotteur · Premier départ dans ce pays',
    jsonb_build_object(
      'personalityKey', 'globe_trotteur', 'countryId', v_start.country_id,
      'developmentRaceEditionId', new.race_edition_id, 'developmentRaceStageId', new.stage_id
    )
  );
  return new;
end;
$$;

revoke all on function private.apply_junior_globe_trotteur_morale() from public, anon, authenticated, service_role;

create trigger development_race_results_apply_personality_morale
after insert on public.development_race_results
for each row
when (new.result_scope = 'stage' and new.academy_rider_id is not null)
execute function private.apply_junior_globe_trotteur_morale();

commit;
