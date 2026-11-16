begin;
set local lock_timeout = '5s';
set local statement_timeout = '8s';

create function private.training_ratings_all_at_cap(p_ratings jsonb, p_cap numeric)
returns boolean
language sql immutable set search_path = ''
as $$
  select count(score) = 13 and min(score) >= p_cap
  from unnest(array[
    'mountain', 'hills', 'flat', 'time_trial', 'cobbles', 'sprint',
    'acceleration', 'downhill', 'endurance', 'resistance', 'recovery',
    'breakaway', 'prologue'
  ]) as stat(key)
  cross join lateral (
    select (case when stat.key = 'time_trial'
      then coalesce(p_ratings ->> 'time_trial', p_ratings ->> 'timeTrial')
      else p_ratings ->> stat.key end)::numeric as score
  ) as rating;
$$;

revoke all on function private.training_ratings_all_at_cap(jsonb,numeric)
  from public, anon, authenticated;

create function private.apply_perfectionniste_professional_training()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_potential_steps integer;
  v_day_number integer;
  v_week_reference text;
  v_delta integer := 0;
  v_domain text;
begin
  if new.status <> 'completed' or new.progress_milli = '{}'::jsonb then
    return new;
  end if;
  if tg_table_name = 'rider_training_sessions' then
    if new.intensity <= 0 then return new; end if;
    v_domain := new.domain;
  end if;

  select rider.potential_steps into v_potential_steps
  from public.riders as rider
  where rider.id = new.rider_id and rider.personality_key = 'perfectionniste';
  if not found then return new; end if;

  select day.day_number into v_day_number
  from public.season_days as day where day.id = new.season_day_id;
  if not found then return new; end if;
  v_week_reference := 'personality:perfectionniste:training:' || new.season_id::text
    || ':' || ((v_day_number - 1) / 7)::text;

  if exists (
    select 1 from public.rider_morale_events as event
    where event.rider_id = new.rider_id and event.source_type = 'manual_adjustment'
      and event.source_reference = v_week_reference
  ) then return new; end if;

  if exists (
    select 1 from jsonb_each_text(new.rating_changes) as change where change.value::numeric > 0
  ) then
    v_delta := 1;
  elsif new.rating_changes = '{}'::jsonb
    and not exists (
      select 1 from jsonb_each_text(new.progress_milli) as progress where progress.value::numeric > 0
    )
    and exists (
      select 1 from public.rider_season_ratings as rating
      where rating.rider_id = new.rider_id and rating.season_id = new.season_id
        and private.training_ratings_all_at_cap(
          to_jsonb(rating), public.get_rider_potential_stat_cap(v_potential_steps)
        )
    )
  then
    if (
      v_domain is not null and exists (
        select 1 from public.season_days as day
        join public.rider_training_sessions as previous on previous.season_day_id = day.id
          and previous.rider_id = new.rider_id
        where day.season_id = new.season_id
          and day.day_number between v_day_number - 3 and v_day_number - 1
          and previous.status = 'completed' and previous.domain = v_domain and previous.intensity > 0
          and previous.rating_changes = '{}'::jsonb and previous.progress_milli <> '{}'::jsonb
          and not exists (
            select 1 from jsonb_each_text(previous.progress_milli) as progress where progress.value::numeric > 0
          )
      )
    ) or (
      v_domain is null and exists (
        select 1 from public.season_days as day
        join public.free_agent_training_sessions as previous on previous.season_day_id = day.id
          and previous.rider_id = new.rider_id
        where day.season_id = new.season_id
          and day.day_number between v_day_number - 3 and v_day_number - 1
          and previous.status = 'completed'
          and previous.rating_changes = '{}'::jsonb and previous.progress_milli <> '{}'::jsonb
          and not exists (
            select 1 from jsonb_each_text(previous.progress_milli) as progress where progress.value::numeric > 0
          )
      )
    ) then
      v_delta := -1;
    end if;
  end if;

  if v_delta <> 0 then
    perform public.apply_rider_morale_event(
      new.rider_id, new.season_day_id, 'manual_adjustment', v_week_reference, v_delta,
      case when v_delta > 0 then 'Caractère Perfectionniste — un palier franchi à l’entraînement'
        else 'Caractère Perfectionniste — séances répétées au plafond' end,
      jsonb_build_object('personalityKey','perfectionniste','trainingSource',tg_table_name)
    );
  end if;
  return new;
end;
$$;

create trigger apply_perfectionniste_club_training
after update of progress_milli on public.rider_training_sessions
for each row execute function private.apply_perfectionniste_professional_training();

create trigger apply_perfectionniste_free_agent_training
after insert on public.free_agent_training_sessions
for each row execute function private.apply_perfectionniste_professional_training();

revoke all on function private.apply_perfectionniste_professional_training()
  from public, anon, authenticated;

create function private.apply_perfectionniste_academy_training()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_potential_steps integer;
  v_raw_cap numeric;
  v_week_reference text;
  v_delta integer := 0;
begin
  select rider.potential_steps into v_potential_steps
  from public.youth_academy_riders as rider
  where rider.id = new.academy_rider_id and rider.personality_key = 'perfectionniste';
  if not found then return new; end if;
  v_week_reference := 'personality:perfectionniste:training:' || new.season_id::text
    || ':' || ((new.day_number - 1) / 7)::text;

  if exists (
    select 1 from public.youth_rider_morale_events as event
    where event.academy_rider_id = new.academy_rider_id and event.source_type = 'manual_adjustment'
      and event.source_reference = v_week_reference
  ) then return new; end if;

  -- Reports record raw thousandths. Compare the two rounded 0–100 notes shown
  -- to the manager and account for manual/automatic time trial key spelling.
  if exists (
    select 1 from jsonb_each_text(new.rating_changes) as change
    cross join lateral (
      select (case when change.key in ('time_trial','timeTrial')
        then coalesce(new.ratings_after ->> 'time_trial', new.ratings_after ->> 'timeTrial')
        else new.ratings_after ->> change.key end)::numeric as after_value
    ) as rating
    where change.value::numeric > 0
      and least(100, greatest(0, round(34 + rating.after_value * 8)))
        > least(100, greatest(0, round(34 + (rating.after_value - change.value::numeric) * 8)))
  ) then
    v_delta := 1;
  else
    v_raw_cap := (public.get_rider_potential_stat_cap(v_potential_steps) - 34) / 8.0;
    if new.rating_changes = '{}'::jsonb
      and private.training_ratings_all_at_cap(new.ratings_after, v_raw_cap)
      and exists (
        select 1 from public.youth_academy_training_sessions as previous
        where previous.academy_rider_id = new.academy_rider_id
          and previous.season_id = new.season_id
          and previous.day_number between new.day_number - 3 and new.day_number - 1
          and previous.training_priority = new.training_priority
          and previous.rating_changes = '{}'::jsonb
          and private.training_ratings_all_at_cap(previous.ratings_after, v_raw_cap)
      )
    then
      v_delta := -1;
    end if;
  end if;

  if v_delta <> 0 then
    perform public.apply_youth_rider_morale_event(
      new.academy_rider_id, new.season_day_id, 'manual_adjustment', v_week_reference, v_delta,
      case when v_delta > 0 then 'Caractère Perfectionniste — un palier franchi à l’entraînement'
        else 'Caractère Perfectionniste — séances répétées au plafond' end,
      jsonb_build_object('personalityKey','perfectionniste','trainingSessionId',new.id)
    );
  end if;
  return new;
end;
$$;

create trigger apply_perfectionniste_academy_training
after insert on public.youth_academy_training_sessions
for each row execute function private.apply_perfectionniste_academy_training();

revoke all on function private.apply_perfectionniste_academy_training()
  from public, anon, authenticated;

-- Reuse the official contextual disappointment model and its ledger.
do $force_tranquille$
declare
  v_signature regprocedure;
  v_definition text;
  v_replacements text[][];
  v_pair text[];
  v_marker constant text := 'v_force_tranquille_relief boolean := false;';
begin
  foreach v_signature in array array[
    'public.apply_stage_result_morale()'::regprocedure,
    'public.apply_race_result_morale()'::regprocedure
  ] loop
    v_definition := replace(pg_get_functiondef(v_signature), E'\r\n', E'\n');
    if position(v_marker in v_definition) > 0 then continue; end if;

    if v_signature = 'public.apply_stage_result_morale()'::regprocedure then
      v_replacements := array[
        array['  v_colerique_penalty boolean := false;',
          '  v_colerique_penalty boolean := false;' || E'\n  ' || v_marker],
        array['  if v_colerique_penalty then v_delta := v_delta - 1; end if;', $stage$
  if v_colerique_penalty then v_delta := v_delta - 1; end if;
  v_force_tranquille_relief := coalesce(
    v_context.personality_key = 'force_tranquille' and v_scope = 'one_day'
    and new.status = 'finished' and new.rank is not null
    and v_context.stage_type <> 'team_time_trial'
    and v_delta < 0, false
  );
  if v_force_tranquille_relief then v_delta := least(0, v_delta + 1); end if;$stage$],
        array[$stage_description$    if v_colerique_penalty then
      v_description := v_description || ' · Caractère Colérique';
    end if;$stage_description$, $stage_copy$    if v_colerique_penalty then
      v_description := v_description || ' · Caractère Colérique';
    elsif v_force_tranquille_relief then
      v_description := v_description || ' · Caractère Force tranquille';
    end if;$stage_copy$]
      ];
    else
      v_replacements := array[
        array['  v_colerique_penalty boolean := false;',
          '  v_colerique_penalty boolean := false;' || E'\n  ' || v_marker],
        array['    if v_colerique_penalty then v_delta := v_delta - 1; end if;', $gc$
    if v_colerique_penalty then v_delta := v_delta - 1; end if;
    v_force_tranquille_relief := coalesce(
      v_context.personality_key = 'force_tranquille'
      and new.status = 'classified' and new.final_rank is not null
      and v_delta < 0, false
    );
    if v_force_tranquille_relief then v_delta := least(0, v_delta + 1); end if;$gc$],
        array[$gc_description$      if v_colerique_penalty then
        v_description := v_description || ' · Caractère Colérique';
      end if;$gc_description$, $gc_copy$      if v_colerique_penalty then
        v_description := v_description || ' · Caractère Colérique';
      elsif v_force_tranquille_relief then
        v_description := v_description || ' · Caractère Force tranquille';
      end if;$gc_copy$]
      ];
    end if;

    foreach v_pair slice 1 in array v_replacements loop
      if length(v_definition) - length(replace(v_definition, v_pair[1], '')) <> length(v_pair[1]) then
        raise exception 'Unexpected result morale definition for %, anchor: %', v_signature, v_pair[1];
      end if;
      v_definition := replace(v_definition, v_pair[1], v_pair[2]);
    end loop;
    execute v_definition;
  end loop;
end;
$force_tranquille$;

commit;
