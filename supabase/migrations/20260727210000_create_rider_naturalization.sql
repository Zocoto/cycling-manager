begin;

-- Le jour de prise d'effet permet de compter l'ancienneté en jours de jeu,
-- y compris pour les transferts réalisés en cours de saison.
alter table public.rider_contracts
  add column if not exists joined_day_number smallint;

update public.rider_contracts
set joined_day_number = 1
where joined_day_number is null;

alter table public.rider_contracts
  alter column joined_day_number set not null;

alter table public.rider_contracts
  drop constraint if exists rider_contracts_joined_day_range;
alter table public.rider_contracts
  add constraint rider_contracts_joined_day_range
    check (joined_day_number between 1 and 28);

create or replace function public.set_rider_contract_joined_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start_season public.seasons%rowtype;
begin
  if new.joined_day_number is not null then
    return new;
  end if;

  select season.*
  into v_start_season
  from public.seasons as season
  where season.id = new.start_season_id;

  new.joined_day_number := case
    when v_start_season.status = 'active' and new.status = 'active'
      then coalesce(v_start_season.current_day_number, 1)
    else 1
  end;

  return new;
end;
$$;

drop trigger if exists set_rider_contract_joined_day
on public.rider_contracts;

create trigger set_rider_contract_joined_day
before insert
on public.rider_contracts
for each row
execute function public.set_rider_contract_joined_day();

create table public.rider_naturalizations (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  rider_id uuid references public.riders(id) on delete cascade,
  academy_rider_id uuid references public.youth_academy_riders(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  sporting_director_id uuid references public.sporting_directors(id) on delete set null,
  season_id uuid not null references public.seasons(id) on delete restrict,
  day_number smallint not null,
  from_country_id uuid not null references public.countries(id) on delete restrict,
  to_country_id uuid not null references public.countries(id) on delete restrict,
  elapsed_tenure_days integer not null,
  created_at timestamptz not null default now(),

  constraint rider_naturalizations_subject_type_allowed
    check (subject_type in ('professional', 'youth')),
  constraint rider_naturalizations_subject_shape
    check (
      (subject_type = 'professional' and rider_id is not null and academy_rider_id is null)
      or
      (subject_type = 'youth' and rider_id is null and academy_rider_id is not null)
    ),
  constraint rider_naturalizations_country_change
    check (from_country_id <> to_country_id),
  constraint rider_naturalizations_day_range
    check (day_number between 1 and 28),
  constraint rider_naturalizations_tenure_non_negative
    check (elapsed_tenure_days >= 0)
);

create index rider_naturalizations_rider_idx
  on public.rider_naturalizations (rider_id, created_at desc)
  where rider_id is not null;

create index rider_naturalizations_academy_idx
  on public.rider_naturalizations (academy_rider_id, created_at desc)
  where academy_rider_id is not null;

alter table public.rider_naturalizations enable row level security;

create policy rider_naturalizations_read_authenticated
on public.rider_naturalizations
for select
to authenticated
using (true);

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
  v_tenure_start_year integer;
  v_tenure_start_day integer;
  v_elapsed_days integer;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez être connecté pour naturaliser un coureur.';
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
      message = 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  select
    rider.country_id,
    current_country.name as current_country_name,
    current_country.iso_alpha2 as current_country_code,
    start_season.game_year as contract_start_year,
    contract.joined_day_number as contract_start_day
  into v_rider
  from public.riders as rider
  join public.countries as current_country
    on current_country.id = rider.country_id
  join public.rider_contracts as contract
    on contract.rider_id = rider.id
   and contract.team_id = v_context.team_id
   and contract.status = 'active'
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
  join public.seasons as end_season
    on end_season.id = contract.end_season_id
   and end_season.game_year >= v_context.game_year
  where rider.id = p_rider_id
    and rider.status = 'active'
    and start_season.game_year <= v_context.game_year;

  if v_rider is null then
    raise exception using
      errcode = '42501',
      message = 'Ce coureur professionnel n’appartient pas à votre équipe.';
  end if;

  if v_rider.country_id = v_context.target_country_id then
    raise exception using
      errcode = 'P0001',
      message = 'Ce coureur possède déjà la nationalité de votre équipe.';
  end if;

  if exists (
    select 1
    from public.rider_national_championship_titles as title
    where title.rider_id = p_rider_id
      and title.championship_type in ('road', 'time_trial')
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Un ancien champion national route ou CLM reste définitivement attaché à son pays d’origine.';
  end if;

  with recursive contract_periods as (
    select
      start_season.game_year as start_game_year,
      end_season.game_year as end_game_year,
      contract.joined_day_number
    from public.rider_contracts as contract
    join public.seasons as start_season
      on start_season.id = contract.start_season_id
    join public.seasons as end_season
      on end_season.id = contract.end_season_id
    where contract.rider_id = p_rider_id
      and contract.team_id = v_context.team_id
      and contract.status in ('active', 'completed')
      and start_season.game_year <= v_context.game_year
  ),
  continuous_tenure as (
    select
      v_rider.contract_start_year as start_game_year,
      v_rider.contract_start_day as joined_day_number
    union
    select
      period.start_game_year,
      period.joined_day_number
    from continuous_tenure as tenure
    join contract_periods as period
      on period.start_game_year < tenure.start_game_year
     and period.end_game_year >= tenure.start_game_year - 1
  )
  select tenure.start_game_year, tenure.joined_day_number
  into v_tenure_start_year, v_tenure_start_day
  from continuous_tenure as tenure
  order by tenure.start_game_year, tenure.joined_day_number
  limit 1;

  v_elapsed_days := greatest(
    0,
    (v_context.game_year - v_tenure_start_year) * 28
      + v_context.current_day_number
      - v_tenure_start_day
  );

  if v_elapsed_days < 84 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Ce coureur pourra être naturalisé dans %s jour%s de jeu.',
        84 - v_elapsed_days,
        case when 84 - v_elapsed_days > 1 then 's' else '' end
      );
  end if;

  update public.riders
  set country_id = v_context.target_country_id
  where id = p_rider_id
    and country_id = v_rider.country_id;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'La nationalité du coureur a changé entre-temps. Rechargez la page.';
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
  v_elapsed_days integer;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez être connecté pour naturaliser un junior.';
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
      message = 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  select
    academy.country_id,
    current_country.name as current_country_name,
    current_country.iso_alpha2 as current_country_code,
    joined_season.game_year as joined_game_year,
    academy.joined_day_number
  into v_rider
  from public.youth_academy_riders as academy
  join public.countries as current_country
    on current_country.id = academy.country_id
  join public.seasons as joined_season
    on joined_season.id = academy.joined_season_id
  where academy.id = p_academy_rider_id
    and academy.team_id = v_context.team_id
    and academy.status in ('active', 'recruited');

  if v_rider is null then
    raise exception using
      errcode = '42501',
      message = 'Ce junior n’appartient pas à votre école de cyclisme.';
  end if;

  if v_rider.country_id = v_context.target_country_id then
    raise exception using
      errcode = 'P0001',
      message = 'Ce junior possède déjà la nationalité de votre équipe.';
  end if;

  v_elapsed_days := greatest(
    0,
    (v_context.game_year - v_rider.joined_game_year) * 28
      + v_context.current_day_number
      - v_rider.joined_day_number
  );

  if v_elapsed_days < 28 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Ce junior pourra être naturalisé dans %s jour%s de jeu.',
        28 - v_elapsed_days,
        case when 28 - v_elapsed_days > 1 then 's' else '' end
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
      message = 'La nationalité du junior a changé entre-temps. Rechargez la page.';
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

revoke all
on function public.naturalize_current_team_professional_rider(uuid)
from public, anon;

revoke all
on function public.naturalize_current_team_youth_rider(uuid)
from public, anon;

grant execute
on function public.naturalize_current_team_professional_rider(uuid)
to authenticated;

grant execute
on function public.naturalize_current_team_youth_rider(uuid)
to authenticated;

comment on table public.rider_naturalizations is
  'Historique des changements de nationalité sportive des professionnels et juniors.';

comment on column public.rider_contracts.joined_day_number is
  'Jour de jeu où le contrat a pris effet, utilisé pour calculer l’ancienneté de naturalisation.';

commit;
