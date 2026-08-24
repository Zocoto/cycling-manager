begin;

create or replace function public.save_current_youth_training_settings_bulk(
  p_changes jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
set statement_timeout = '0'
as $$
declare
  v_change_count integer;
  v_current_season_id uuid;
  v_current_day_id uuid;
  v_current_day_number smallint;
  v_team_id uuid;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'La liste des entraînements juniors à modifier est invalide.';
  end if;

  v_change_count := jsonb_array_length(p_changes);
  if v_change_count not between 1 and 100 then
    raise exception 'La liste des entraînements juniors à modifier est invalide.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_changes) as entry(value)
    where jsonb_typeof(entry.value) <> 'object'
      or coalesce(entry.value ->> 'academyRiderId', '') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(entry.value ->> 'trainingPriority', '') not in (
        'climber', 'puncheur', 'northern_classics',
        'rouleur', 'breakaway', 'sprinter'
      )
      or coalesce(entry.value ->> 'trainingMode', '') not in (
        'automatic', 'manual'
      )
  ) then
    raise exception 'Un réglage d’entraînement junior est invalide.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_changes) as change(
      "academyRiderId" uuid,
      "trainingPriority" text,
      "trainingMode" text
    )
    group by change."academyRiderId"
    having change."academyRiderId" is null or count(*) > 1
  ) then
    raise exception 'Un jeune ne peut apparaître qu’une fois dans la validation.';
  end if;

  -- La date de saison et les modes arrivés à échéance sont synchronisés une
  -- seule fois pour tout le lot, au lieu d’être réécrits pour chaque junior.
  perform public.sync_active_season_day();

  select season.id, day.id, day.day_number
  into v_current_season_id, v_current_day_id, v_current_day_number
  from public.seasons as season
  join public.season_days as day
    on day.season_id = season.id
   and day.day_number = coalesce(season.current_day_number, 1)
  where season.status = 'active'
  limit 1;

  if v_current_season_id is null then
    raise exception 'Aucune saison active n’est disponible.';
  end if;

  select assignment.team_id
  into v_team_id
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_team_id is null then
    raise exception 'Aucune équipe active ne peut être gérée par ce compte.';
  end if;

  if (
    select count(*)
    from public.youth_academy_riders as academy
    where academy.team_id = v_team_id
      and academy.status in ('active', 'recruited')
      and academy.id in (
        select change."academyRiderId"
        from jsonb_to_recordset(p_changes) as change(
          "academyRiderId" uuid,
          "trainingPriority" text,
          "trainingMode" text
        )
      )
  ) <> v_change_count then
    raise exception 'Un jeune transmis ne fait pas partie de votre école.';
  end if;

  perform public.activate_due_youth_training_modes(
    v_team_id,
    v_current_season_id,
    v_current_day_number
  );

  -- Verrouillage déterministe : deux validations simultanées ne peuvent pas
  -- se croiser ni écraser une programmation plus récente.
  perform 1
  from public.youth_academy_riders as academy
  where academy.id in (
    select change."academyRiderId"
    from jsonb_to_recordset(p_changes) as change(
      "academyRiderId" uuid,
      "trainingPriority" text,
      "trainingMode" text
    )
  )
  order by academy.id
  for update;

  with requested as (
    select *
    from jsonb_to_recordset(p_changes) as change(
      "academyRiderId" uuid,
      "trainingPriority" text,
      "trainingMode" text
    )
  ),
  resolved as (
    select
      requested."academyRiderId" as academy_rider_id,
      requested."trainingPriority" as training_priority,
      requested."trainingMode" as training_mode,
      academy.training_mode as current_training_mode,
      (
        extract(hour from now() at time zone 'Europe/Paris') >= 8
        or exists (
          select 1
          from public.youth_academy_training_sessions as session
          where session.academy_rider_id = academy.id
            and session.season_day_id = v_current_day_id
        )
        or exists (
          select 1
          from public.youth_academy_training_attempts as attempt
          where attempt.academy_rider_id = academy.id
            and attempt.season_day_id = v_current_day_id
            and attempt.status = 'started'
            and attempt.expires_at > now()
        )
      ) as training_started
    from requested
    join public.youth_academy_riders as academy
      on academy.id = requested."academyRiderId"
  )
  update public.youth_academy_riders as academy
  set
    training_priority = resolved.training_priority,
    training_mode = case
      when resolved.training_mode = resolved.current_training_mode
        or resolved.training_started
        then academy.training_mode
      else resolved.training_mode
    end,
    automatic_since_season_id = case
      when resolved.training_mode = resolved.current_training_mode
        or resolved.training_started
        then academy.automatic_since_season_id
      when resolved.training_mode = 'automatic'
        then v_current_season_id
      else null
    end,
    automatic_since_day_number = case
      when resolved.training_mode = resolved.current_training_mode
        or resolved.training_started
        then academy.automatic_since_day_number
      when resolved.training_mode = 'automatic'
        then v_current_day_number
      else null
    end,
    pending_training_mode = case
      when resolved.training_mode <> resolved.current_training_mode
        and resolved.training_started
        then resolved.training_mode
      else null
    end,
    pending_training_mode_after_season_id = case
      when resolved.training_mode <> resolved.current_training_mode
        and resolved.training_started
        then v_current_season_id
      else null
    end,
    pending_training_mode_after_day_number = case
      when resolved.training_mode <> resolved.current_training_mode
        and resolved.training_started
        then v_current_day_number + 1
      else null
    end,
    updated_at = now()
  from resolved
  where academy.id = resolved.academy_rider_id;

  return v_change_count;
end;
$$;

revoke all on function public.save_current_youth_training_settings_bulk(jsonb)
  from public, anon;
grant execute on function public.save_current_youth_training_settings_bulk(jsonb)
  to authenticated, service_role;

comment on function public.save_current_youth_training_settings_bulk(jsonb) is
  'Synchronise une fois la journée puis applique atomiquement les programmations juniors par une écriture ensembliste.';

notify pgrst, 'reload schema';

commit;
