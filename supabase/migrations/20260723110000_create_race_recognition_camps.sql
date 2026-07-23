begin;

create table public.team_race_recognition_camps (
  id uuid primary key default gen_random_uuid(),

  team_season_id uuid not null
    references public.team_seasons(id)
    on delete cascade,

  season_id uuid not null
    references public.seasons(id)
    on delete cascade,

  target_stage_id uuid not null
    references public.stages(id)
    on delete cascade,

  start_day_number smallint not null,
  end_day_number smallint not null,

  status text not null default 'planned',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint team_race_recognition_camps_day_range
    check (
      start_day_number between 1 and 27
      and end_day_number = start_day_number + 1
      and end_day_number <= 28
    ),

  constraint team_race_recognition_camps_status_allowed
    check (status in ('planned', 'completed', 'cancelled')),

  constraint team_race_recognition_camps_target_unique
    unique (team_season_id, target_stage_id)
);

create index team_race_recognition_camps_schedule_idx
  on public.team_race_recognition_camps (
    team_season_id,
    start_day_number,
    end_day_number
  );

alter table public.team_race_recognition_camps enable row level security;

create or replace function public.schedule_current_team_recognition_camp(
  p_target_stage_id uuid,
  p_start_day_number integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_target record;
  v_edition_start_day integer;
  v_edition_end_day integer;
  v_end_day_number integer;
  v_camp_id uuid;
begin
  if p_target_stage_id is null then
    raise exception 'L’étape ciblée est invalide.';
  end if;

  if p_start_day_number is null or p_start_day_number not between 1 and 27 then
    raise exception 'La date de début du stage est invalide.';
  end if;

  select
    assignment.team_id,
    season.id as season_id,
    coalesce(season.current_day_number, 1) as current_day_number,
    team_season.id as team_season_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1
  for update of team_season;

  if v_context is null then
    raise exception 'Votre équipe active est introuvable.';
  end if;

  select
    stage.id as stage_id,
    stage.status as stage_status,
    target_day.day_number as target_day_number,
    edition.id as edition_id,
    edition.display_name as edition_name,
    edition.status as edition_status,
    race.race_format
  into v_target
  from public.stages as stage
  join public.season_days as target_day
    on target_day.id = stage.season_day_id
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
   and edition.season_id = v_context.season_id
  join public.races as race
    on race.id = edition.race_id
  where stage.id = p_target_stage_id;

  if v_target is null then
    raise exception 'Cette étape n’appartient pas à la saison active.';
  end if;

  if v_target.stage_status = 'cancelled' or v_target.edition_status = 'cancelled' then
    raise exception 'Cette étape a été annulée et ne peut pas être préparée.';
  end if;

  if v_target.target_day_number <= v_context.current_day_number then
    raise exception 'L’étape ciblée doit se dérouler après la journée actuelle.';
  end if;

  v_end_day_number := p_start_day_number + 1;

  if p_start_day_number <= v_context.current_day_number then
    raise exception 'Le stage doit commencer après la journée actuelle.';
  end if;

  if v_end_day_number > 28 then
    raise exception 'La saison se termine avant la fin des deux jours de stage.';
  end if;

  if v_end_day_number >= v_target.target_day_number then
    raise exception 'Les deux jours de préparation doivent être terminés avant l’étape ciblée.';
  end if;

  select
    min(edition_day.day_number),
    max(edition_day.day_number)
  into
    v_edition_start_day,
    v_edition_end_day
  from public.stages as edition_stage
  join public.season_days as edition_day
    on edition_day.id = edition_stage.season_day_id
  where edition_stage.race_edition_id = v_target.edition_id
    and edition_stage.status <> 'cancelled';

  if v_edition_start_day is null or v_edition_end_day is null then
    raise exception 'Le calendrier de la course ciblée est incomplet.';
  end if;

  if
    p_start_day_number <= v_edition_end_day
    and v_end_day_number >= v_edition_start_day
  then
    if v_target.race_format = 'stage_race' then
      raise exception
        'Impossible : le stage J%–J% chevauche % (J%–J%), le tour qui englobe l’étape ciblée.',
        p_start_day_number,
        v_end_day_number,
        v_target.edition_name,
        v_edition_start_day,
        v_edition_end_day;
    end if;

    raise exception
      'Impossible : le stage J%–J% chevauche la course ciblée % (J%).',
      p_start_day_number,
      v_end_day_number,
      v_target.edition_name,
      v_edition_start_day;
  end if;

  if not exists (
    select 1
    from public.season_days as start_day
    join public.season_days as end_day
      on end_day.season_id = start_day.season_id
     and end_day.day_number = v_end_day_number
    where start_day.season_id = v_context.season_id
      and start_day.day_number = p_start_day_number
  ) then
    raise exception 'Les journées choisies ne figurent pas dans le calendrier de la saison.';
  end if;

  insert into public.team_race_recognition_camps (
    team_season_id,
    season_id,
    target_stage_id,
    start_day_number,
    end_day_number,
    status
  )
  values (
    v_context.team_season_id,
    v_context.season_id,
    v_target.stage_id,
    p_start_day_number,
    v_end_day_number,
    'planned'
  )
  on conflict (team_season_id, target_stage_id)
  do update
  set
    start_day_number = excluded.start_day_number,
    end_day_number = excluded.end_day_number,
    status = 'planned',
    updated_at = now()
  returning id into v_camp_id;

  return v_camp_id;
end;
$$;

revoke all on table public.team_race_recognition_camps from public, anon, authenticated;
revoke all on function public.schedule_current_team_recognition_camp(uuid, integer)
  from public, anon;

grant execute on function public.schedule_current_team_recognition_camp(uuid, integer)
  to authenticated;
grant all privileges on table public.team_race_recognition_camps to service_role;

comment on table public.team_race_recognition_camps is
  'Stages de reconnaissance de deux jours programmés par une équipe avant une étape cible.';
comment on function public.schedule_current_team_recognition_camp(uuid, integer) is
  'Programme ou reprogramme un stage de reconnaissance de deux jours et bloque tout chevauchement avec la course ciblée.';

commit;
