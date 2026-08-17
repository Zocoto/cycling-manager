begin;

-- A junior's naturalization clock belongs to the country currently represented
-- by the team. Existing academy riders are initialized with their current
-- displayed tenure so this migration does not rewrite history.
alter table public.youth_academy_riders
  add column if not exists naturalization_country_id uuid
    references public.countries(id) on delete restrict,
  add column if not exists naturalization_started_season_id uuid
    references public.seasons(id) on delete restrict,
  add column if not exists naturalization_started_day_number smallint;

alter table public.youth_academy_riders
  drop constraint if exists youth_academy_naturalization_progress_shape,
  add constraint youth_academy_naturalization_progress_shape
    check (
      (
        naturalization_country_id is null
        and naturalization_started_season_id is null
        and naturalization_started_day_number is null
      )
      or (
        naturalization_country_id is not null
        and naturalization_started_season_id is not null
        and naturalization_started_day_number between 1 and 28
      )
    );

create index if not exists youth_academy_naturalization_country_idx
  on public.youth_academy_riders (team_id, naturalization_country_id)
  where status in ('active', 'recruited');

comment on column public.youth_academy_riders.naturalization_country_id is
  'Pays pour lequel le compteur junior court; un changement de pays sponsor remet ce compteur a zero.';
comment on column public.youth_academy_riders.naturalization_started_season_id is
  'Saison du dernier demarrage du compteur junior pour le pays suivi.';
comment on column public.youth_academy_riders.naturalization_started_day_number is
  'Jour du dernier demarrage du compteur junior pour le pays suivi.';

update public.youth_academy_riders as academy
set
  naturalization_country_id = team_season.registration_country_id,
  naturalization_started_season_id = academy.joined_season_id,
  naturalization_started_day_number = academy.joined_day_number
from public.seasons as season
join public.team_seasons as team_season
  on team_season.season_id = season.id
where season.status = 'active'
  and team_season.team_id = academy.team_id
  and academy.status in ('active', 'recruited');

-- A promoted junior keeps a 28-day route even after becoming professional.
-- The override is stored per country so later professional counters for another
-- country continue to use the normal professional rules.
alter table public.rider_naturalization_country_progress
  add column if not exists required_days_override smallint;

alter table public.rider_naturalization_country_progress
  drop constraint if exists rider_naturalization_required_days_override_range,
  add constraint rider_naturalization_required_days_override_range
    check (
      required_days_override is null
      or required_days_override between 0 and 84
    );

comment on column public.rider_naturalization_country_progress.required_days_override is
  'Seuil conserve pour une filiere speciale, notamment 28 jours apres promotion d un junior.';

create or replace function public.initialize_youth_naturalization_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_country_id uuid;
begin
  if new.naturalization_country_id is not null
    and new.naturalization_started_season_id is not null
    and new.naturalization_started_day_number is not null
  then
    return new;
  end if;

  select team_season.registration_country_id
  into v_country_id
  from public.team_seasons as team_season
  where team_season.team_id = new.team_id
    and team_season.season_id = new.joined_season_id
  limit 1;

  if v_country_id is null then
    select team_season.registration_country_id
    into v_country_id
    from public.seasons as season
    join public.team_seasons as team_season
      on team_season.season_id = season.id
     and team_season.team_id = new.team_id
    where season.status = 'active'
    order by season.game_year desc
    limit 1;
  end if;

  if v_country_id is not null then
    new.naturalization_country_id := v_country_id;
    new.naturalization_started_season_id := new.joined_season_id;
    new.naturalization_started_day_number := new.joined_day_number;
  end if;

  return new;
end;
$$;

drop trigger if exists initialize_youth_naturalization_progress
  on public.youth_academy_riders;
create trigger initialize_youth_naturalization_progress
before insert
on public.youth_academy_riders
for each row execute function public.initialize_youth_naturalization_progress();

-- Sponsor changes in the active season switch professional progress as before,
-- and now reset academy progress at the exact current game day.
create or replace function public.handle_team_naturalization_country_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clock record;
  v_rider_id uuid;
begin
  if old.registration_country_id is not distinct from new.registration_country_id
    or new.registration_country_id is null
  then
    return new;
  end if;

  select
    season.id as season_id,
    coalesce(season.current_day_number, 1) as day_number
  into v_clock
  from public.seasons as season
  where season.id = new.season_id
    and season.status = 'active';

  if v_clock is null then
    return new;
  end if;

  for v_rider_id in
    select contract.rider_id
    from public.rider_contracts as contract
    where contract.team_id = new.team_id
      and contract.status = 'active'
  loop
    perform public.resume_rider_naturalization_progress(
      v_rider_id,
      new.registration_country_id,
      new.team_id
    );
  end loop;

  update public.youth_academy_riders
  set
    naturalization_country_id = new.registration_country_id,
    naturalization_started_season_id = v_clock.season_id,
    naturalization_started_day_number = v_clock.day_number,
    updated_at = now()
  where team_id = new.team_id
    and status in ('active', 'recruited')
    and naturalization_country_id is distinct from new.registration_country_id;

  return new;
end;
$$;

-- A planned sponsor takes effect before its season becomes active. Catching the
-- season activation resets every remaining junior at J1, including promotions.
create or replace function public.reset_youth_naturalization_on_season_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    update public.youth_academy_riders as academy
    set
      naturalization_country_id = team_season.registration_country_id,
      naturalization_started_season_id = new.id,
      naturalization_started_day_number = coalesce(new.current_day_number, 1),
      updated_at = now()
    from public.team_seasons as team_season
    where team_season.team_id = academy.team_id
      and team_season.season_id = new.id
      and team_season.registration_country_id is not null
      and academy.status in ('active', 'recruited')
      and academy.naturalization_country_id
        is distinct from team_season.registration_country_id;
  end if;

  return new;
end;
$$;

drop trigger if exists youth_naturalization_reset_on_season_activation
  on public.seasons;
create trigger youth_naturalization_reset_on_season_activation
after update of status
on public.seasons
for each row execute function public.reset_youth_naturalization_on_season_activation();

create or replace function public.carry_youth_naturalization_after_promotion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_elapsed_days integer := 0;
begin
  if new.status <> 'promoted'
    or old.status is not distinct from 'promoted'
    or new.promoted_rider_id is null
  then
    return new;
  end if;

  select
    season.id as season_id,
    coalesce(season.current_day_number, 1) as day_number,
    team_season.registration_country_id as target_country_id,
    rider.country_id as rider_country_id
  into v_context
  from public.seasons as season
  join public.team_seasons as team_season
    on team_season.season_id = season.id
   and team_season.team_id = new.team_id
  join public.riders as rider
    on rider.id = new.promoted_rider_id
  where season.status = 'active'
  order by season.game_year desc
  limit 1;

  if v_context is null
    or v_context.target_country_id is null
    or v_context.rider_country_id = v_context.target_country_id
  then
    return new;
  end if;

  if new.naturalization_country_id = v_context.target_country_id
    and new.naturalization_started_season_id is not null
    and new.naturalization_started_day_number is not null
  then
    v_elapsed_days := greatest(
      0,
      coalesce(
        public.get_game_day_ordinal(
          v_context.season_id,
          v_context.day_number
        ) - public.get_game_day_ordinal(
          new.naturalization_started_season_id,
          new.naturalization_started_day_number
        ),
        0
      )
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'rider-naturalization-progress:' || new.promoted_rider_id::text,
      0
    )
  );

  insert into public.rider_naturalization_country_progress (
    rider_id,
    country_id,
    accumulated_days,
    active_since_season_id,
    active_since_day_number,
    last_team_id,
    required_days_override,
    updated_at
  )
  values (
    new.promoted_rider_id,
    v_context.target_country_id,
    v_elapsed_days,
    v_context.season_id,
    v_context.day_number,
    new.team_id,
    28,
    now()
  )
  on conflict (rider_id, country_id) do update set
    accumulated_days = excluded.accumulated_days,
    active_since_season_id = excluded.active_since_season_id,
    active_since_day_number = excluded.active_since_day_number,
    last_team_id = excluded.last_team_id,
    required_days_override = excluded.required_days_override,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists youth_naturalization_carried_after_promotion
  on public.youth_academy_riders;
create trigger youth_naturalization_carried_after_promotion
after update of status, promoted_rider_id
on public.youth_academy_riders
for each row execute function public.carry_youth_naturalization_after_promotion();

create or replace function public.naturalize_current_team_professional_rider(
  p_rider_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_rider record;
  v_elapsed_days integer;
  v_required_days integer;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez etre connecte pour naturaliser un coureur.';
  end if;

  if p_rider_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'Le coureur transmis est invalide.';
  end if;

  perform public.sync_active_season_day();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('naturalization:' || p_rider_id::text, 0)
  );

  select
    director.id as director_id,
    assignment.team_id,
    season.id as season_id,
    coalesce(season.current_day_number, 1) as current_day_number,
    team_season.registration_country_id as target_country_id,
    target_country.name as target_country_name,
    target_country.iso_alpha2 as target_country_code
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
   and team_season.status in ('planned', 'active')
  join public.countries as target_country
    on target_country.id = team_season.registration_country_id
   and target_country.is_active
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception using
      errcode = '42501',
      message = 'Aucune equipe active ne correspond au Directeur Sportif.';
  end if;

  select
    rider.country_id,
    current_country.name as current_country_name,
    current_country.iso_alpha2 as current_country_code
  into v_rider
  from public.riders as rider
  join public.countries as current_country on current_country.id = rider.country_id
  join public.rider_contracts as contract
    on contract.rider_id = rider.id
   and contract.team_id = v_context.team_id
   and contract.status = 'active'
  where rider.id = p_rider_id
    and rider.status = 'active';

  if v_rider is null then
    raise exception using
      errcode = '42501',
      message = 'Ce coureur professionnel n appartient pas a votre equipe.';
  end if;

  if v_rider.country_id = v_context.target_country_id then
    raise exception using
      errcode = 'P0001',
      message = 'Ce coureur possede deja la nationalite de votre equipe.';
  end if;

  if exists (
    select 1
    from public.rider_national_championship_titles as title
    where title.rider_id = p_rider_id
      and title.championship_type in ('road', 'time_trial')
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Un ancien champion national route ou CLM reste definitivement attache a son pays d origine.';
  end if;

  v_elapsed_days := coalesce(
    public.get_rider_country_progress_days(
      p_rider_id,
      v_context.target_country_id,
      v_context.season_id,
      v_context.current_day_number
    ),
    0
  );

  v_required_days := coalesce(
    (
      select progress.required_days_override
      from public.rider_naturalization_country_progress as progress
      where progress.rider_id = p_rider_id
        and progress.country_id = v_context.target_country_id
    ),
    public.get_team_professional_naturalization_days(v_context.team_id)
  );

  if v_elapsed_days < v_required_days then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Ce coureur pourra etre naturalise dans %s jour%s de jeu.',
        v_required_days - v_elapsed_days,
        case when v_required_days - v_elapsed_days > 1 then 's' else '' end
      );
  end if;

  update public.riders
  set country_id = v_context.target_country_id
  where id = p_rider_id
    and country_id = v_rider.country_id;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'La nationalite du coureur a change entre-temps. Rechargez la page.';
  end if;

  insert into public.rider_naturalizations (
    subject_type,
    rider_id,
    academy_rider_id,
    team_id,
    sporting_director_id,
    season_id,
    day_number,
    from_country_id,
    to_country_id,
    elapsed_tenure_days
  )
  values (
    'professional',
    p_rider_id,
    null,
    v_context.team_id,
    v_context.director_id,
    v_context.season_id,
    v_context.current_day_number,
    v_rider.country_id,
    v_context.target_country_id,
    v_elapsed_days
  );

  return pg_catalog.jsonb_build_object(
    'riderId', p_rider_id,
    'countryId', v_context.target_country_id,
    'countryName', v_context.target_country_name,
    'countryCode', v_context.target_country_code
  );
end;
$$;

create or replace function public.naturalize_current_team_youth_rider(
  p_academy_rider_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_rider record;
  v_elapsed_days integer := 0;
  v_required_days integer;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez etre connecte pour naturaliser un junior.';
  end if;

  if p_academy_rider_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'Le junior transmis est invalide.';
  end if;

  perform public.sync_active_season_day();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'youth-naturalization:' || p_academy_rider_id::text,
      0
    )
  );

  select
    director.id as director_id,
    assignment.team_id,
    season.id as season_id,
    season.game_year,
    coalesce(season.current_day_number, 1) as current_day_number,
    team_season.registration_country_id as target_country_id,
    target_country.name as target_country_name,
    target_country.iso_alpha2 as target_country_code
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
   and team_season.status in ('planned', 'active')
  join public.countries as target_country
    on target_country.id = team_season.registration_country_id
   and target_country.is_active
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception using
      errcode = '42501',
      message = 'Aucune equipe active ne correspond au Directeur Sportif.';
  end if;

  select
    academy.country_id,
    current_country.name as current_country_name,
    current_country.iso_alpha2 as current_country_code,
    academy.naturalization_country_id,
    academy.naturalization_started_day_number,
    progress_season.game_year as progress_start_game_year
  into v_rider
  from public.youth_academy_riders as academy
  join public.countries as current_country
    on current_country.id = academy.country_id
  left join public.seasons as progress_season
    on progress_season.id = academy.naturalization_started_season_id
  where academy.id = p_academy_rider_id
    and academy.team_id = v_context.team_id
    and academy.status in ('active', 'recruited');

  if v_rider is null then
    raise exception using
      errcode = '42501',
      message = 'Ce junior n appartient pas a votre ecole de cyclisme.';
  end if;

  if v_rider.country_id = v_context.target_country_id then
    raise exception using
      errcode = 'P0001',
      message = 'Ce junior possede deja la nationalite de votre equipe.';
  end if;

  if v_rider.naturalization_country_id = v_context.target_country_id
    and v_rider.progress_start_game_year is not null
    and v_rider.naturalization_started_day_number is not null
  then
    v_elapsed_days := greatest(
      0,
      (v_context.game_year - v_rider.progress_start_game_year) * 28
        + v_context.current_day_number
        - v_rider.naturalization_started_day_number
    );
  end if;

  v_required_days := public.get_team_youth_naturalization_days(
    v_context.team_id
  );

  if v_elapsed_days < v_required_days then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Ce junior pourra etre naturalise dans %s jour%s de jeu.',
        v_required_days - v_elapsed_days,
        case when v_required_days - v_elapsed_days > 1 then 's' else '' end
      );
  end if;

  update public.youth_academy_riders
  set
    country_id = v_context.target_country_id,
    updated_at = now()
  where id = p_academy_rider_id
    and country_id = v_rider.country_id;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'La nationalite du junior a change entre-temps. Rechargez la page.';
  end if;

  insert into public.rider_naturalizations (
    subject_type,
    rider_id,
    academy_rider_id,
    team_id,
    sporting_director_id,
    season_id,
    day_number,
    from_country_id,
    to_country_id,
    elapsed_tenure_days
  )
  values (
    'youth',
    null,
    p_academy_rider_id,
    v_context.team_id,
    v_context.director_id,
    v_context.season_id,
    v_context.current_day_number,
    v_rider.country_id,
    v_context.target_country_id,
    v_elapsed_days
  );

  return pg_catalog.jsonb_build_object(
    'academyRiderId', p_academy_rider_id,
    'countryId', v_context.target_country_id,
    'countryName', v_context.target_country_name,
    'countryCode', v_context.target_country_code
  );
end;
$$;

revoke all on function public.initialize_youth_naturalization_progress()
  from public, anon, authenticated;
revoke all on function public.reset_youth_naturalization_on_season_activation()
  from public, anon, authenticated;
revoke all on function public.carry_youth_naturalization_after_promotion()
  from public, anon, authenticated;
revoke all on function public.handle_team_naturalization_country_change()
  from public, anon, authenticated;

revoke all on function public.naturalize_current_team_professional_rider(uuid)
  from public, anon;
revoke all on function public.naturalize_current_team_youth_rider(uuid)
  from public, anon;
grant execute on function public.naturalize_current_team_professional_rider(uuid)
  to authenticated;
grant execute on function public.naturalize_current_team_youth_rider(uuid)
  to authenticated;

notify pgrst, 'reload schema';

commit;
