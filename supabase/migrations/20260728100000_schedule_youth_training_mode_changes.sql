begin;

alter table public.youth_academy_riders
  add column pending_training_mode text,
  add column pending_training_mode_after_season_id uuid
    references public.seasons(id) on delete set null,
  add column pending_training_mode_after_day_number smallint;

alter table public.youth_academy_riders
  add constraint youth_academy_riders_pending_training_mode_allowed check (
    pending_training_mode is null
    or pending_training_mode in ('automatic', 'manual')
  ),
  add constraint youth_academy_riders_pending_training_mode_consistent check (
    (
      pending_training_mode is null
      and pending_training_mode_after_season_id is null
      and pending_training_mode_after_day_number is null
    )
    or (
      pending_training_mode is not null
      and pending_training_mode_after_season_id is not null
      and pending_training_mode_after_day_number between 1 and 29
    )
  );

create or replace function public.activate_due_youth_training_modes(
  p_team_id uuid,
  p_current_season_id uuid,
  p_current_day_number integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_current_day_number not between 1 and 28 then
    raise exception 'Le jour de saison transmis est invalide.';
  end if;

  update public.youth_academy_riders as academy
  set
    training_mode = academy.pending_training_mode,
    automatic_since_season_id = case
      when academy.pending_training_mode = 'automatic'
        then p_current_season_id
      else null
    end,
    automatic_since_day_number = case
      when academy.pending_training_mode = 'automatic'
        then p_current_day_number
      else null
    end,
    pending_training_mode = null,
    pending_training_mode_after_season_id = null,
    pending_training_mode_after_day_number = null,
    updated_at = now()
  where academy.team_id = p_team_id
    and academy.status in ('active', 'recruited')
    and academy.pending_training_mode is not null
    and (
      academy.pending_training_mode_after_season_id
        <> p_current_season_id
      or academy.pending_training_mode_after_day_number
        <= p_current_day_number
    );
end;
$$;

create or replace function public.save_current_youth_training_settings(
  p_academy_rider_id uuid,
  p_training_priority text,
  p_training_mode text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_academy record;
  v_current_season_id uuid;
  v_current_day_id uuid;
  v_current_day_number smallint;
  v_team_id uuid;
  v_training_started boolean;
begin
  if p_training_priority not in (
    'climber',
    'puncheur',
    'northern_classics',
    'rouleur',
    'breakaway',
    'sprinter'
  ) then
    raise exception 'La priorité d’entraînement junior est invalide.';
  end if;

  if p_training_mode not in ('automatic', 'manual') then
    raise exception 'Le mode d’entraînement junior est invalide.';
  end if;

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

  select academy.team_id
  into v_team_id
  from public.youth_academy_riders as academy
  where academy.id = p_academy_rider_id
    and academy.status in ('active', 'recruited')
    and public.current_user_manages_team(academy.team_id);

  if v_team_id is null then
    raise exception 'Ce jeune ne fait pas partie de votre école.';
  end if;

  perform public.activate_due_youth_training_modes(
    v_team_id,
    v_current_season_id,
    v_current_day_number
  );

  select academy.*
  into v_academy
  from public.youth_academy_riders as academy
  where academy.id = p_academy_rider_id
    and academy.status in ('active', 'recruited')
    and academy.team_id = v_team_id
  for update;

  v_training_started :=
    extract(hour from now() at time zone 'Europe/Paris') >= 8
    or exists (
      select 1
      from public.youth_academy_training_sessions as session
      where session.academy_rider_id = v_academy.id
        and session.season_day_id = v_current_day_id
    )
    or exists (
      select 1
      from public.youth_academy_training_attempts as attempt
      where attempt.academy_rider_id = v_academy.id
        and attempt.season_day_id = v_current_day_id
        and attempt.status = 'started'
        and attempt.expires_at > now()
    );

  if p_training_mode = v_academy.training_mode then
    update public.youth_academy_riders
    set
      training_priority = p_training_priority,
      pending_training_mode = null,
      pending_training_mode_after_season_id = null,
      pending_training_mode_after_day_number = null,
      updated_at = now()
    where id = v_academy.id;
  elsif v_training_started then
    update public.youth_academy_riders
    set
      training_priority = p_training_priority,
      pending_training_mode = p_training_mode,
      pending_training_mode_after_season_id = v_current_season_id,
      pending_training_mode_after_day_number =
        v_current_day_number + 1,
      updated_at = now()
    where id = v_academy.id;
  else
    update public.youth_academy_riders
    set
      training_priority = p_training_priority,
      training_mode = p_training_mode,
      automatic_since_season_id = case
        when p_training_mode = 'automatic'
          then v_current_season_id
        else null
      end,
      automatic_since_day_number = case
        when p_training_mode = 'automatic'
          then v_current_day_number
        else null
      end,
      pending_training_mode = null,
      pending_training_mode_after_season_id = null,
      pending_training_mode_after_day_number = null,
      updated_at = now()
    where id = v_academy.id;
  end if;
end;
$$;

alter function public.start_current_youth_training_attempt(uuid)
  rename to start_current_youth_training_attempt_immediate;

create or replace function public.start_current_youth_training_attempt(
  p_academy_rider_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_current_season_id uuid;
  v_current_day_number smallint;
begin
  perform public.sync_active_season_day();

  select academy.team_id
  into v_team_id
  from public.youth_academy_riders as academy
  where academy.id = p_academy_rider_id
    and academy.status in ('active', 'recruited')
    and public.current_user_manages_team(academy.team_id);

  if v_team_id is null then
    raise exception 'Ce jeune ne fait pas partie de votre école.';
  end if;

  select season.id, coalesce(season.current_day_number, 1)
  into v_current_season_id, v_current_day_number
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  perform public.activate_due_youth_training_modes(
    v_team_id,
    v_current_season_id,
    v_current_day_number
  );

  return public.start_current_youth_training_attempt_immediate(
    p_academy_rider_id
  );
end;
$$;

revoke all on function public.activate_due_youth_training_modes(
  uuid,
  uuid,
  integer
) from public, anon, authenticated;
grant execute on function public.activate_due_youth_training_modes(
  uuid,
  uuid,
  integer
) to service_role;

revoke all on function public.start_current_youth_training_attempt_immediate(
  uuid
) from public, anon, authenticated, service_role;

revoke all on function public.start_current_youth_training_attempt(uuid)
  from public, anon;
grant execute on function public.start_current_youth_training_attempt(uuid)
  to authenticated, service_role;

comment on column public.youth_academy_riders.pending_training_mode is
  'Mode choisi pour la prochaine journée d’entraînement lorsque celle du jour a déjà commencé.';
comment on function public.activate_due_youth_training_modes(
  uuid,
  uuid,
  integer
) is
  'Active les choix auto/manuels différés au début de la prochaine journée de jeu.';
comment on function public.save_current_youth_training_settings(
  uuid,
  text,
  text
) is
  'Enregistre le profil immédiatement et le mode pour la prochaine séance puis les suivantes.';
comment on function public.start_current_youth_training_attempt(uuid) is
  'Active toute programmation arrivée à échéance puis ouvre le minijeu manuel courant.';

notify pgrst, 'reload schema';

commit;
