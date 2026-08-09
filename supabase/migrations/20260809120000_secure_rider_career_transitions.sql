begin;

-- A contract is the durable career line.  These fields make mid-season
-- departures and transfer prices explicit instead of reconstructing them from
-- the rider's current team.
alter table public.rider_contracts
  add column if not exists left_season_id uuid
    references public.seasons(id) on delete restrict,
  add column if not exists left_day_number smallint,
  add column if not exists transfer_fee numeric(14, 2);

alter table public.rider_contracts
  drop constraint if exists rider_contracts_left_day_range,
  drop constraint if exists rider_contracts_left_period_shape,
  drop constraint if exists rider_contracts_transfer_fee_non_negative;

alter table public.rider_contracts
  add constraint rider_contracts_left_day_range
    check (left_day_number is null or left_day_number between 1 and 28),
  add constraint rider_contracts_left_period_shape
    check ((left_season_id is null) = (left_day_number is null)),
  add constraint rider_contracts_transfer_fee_non_negative
    check (transfer_fee is null or transfer_fee >= 0);

comment on column public.rider_contracts.left_season_id is
  'Saison durant laquelle le coureur a effectivement quitte l equipe.';
comment on column public.rider_contracts.left_day_number is
  'Jour effectif de sortie, notamment lors d un transfert en cours de saison.';
comment on column public.rider_contracts.transfer_fee is
  'Montant paye par cette equipe lors de l arrivee du coureur.';

-- Progress is stored once per rider and country.  Only the current country has
-- a running clock; all others are paused counters.  No daily job is required.
create table public.rider_naturalization_country_progress (
  rider_id uuid not null references public.riders(id) on delete cascade,
  country_id uuid not null references public.countries(id) on delete cascade,
  accumulated_days integer not null default 0,
  active_since_season_id uuid references public.seasons(id) on delete restrict,
  active_since_day_number smallint,
  last_team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (rider_id, country_id),
  constraint rider_naturalization_progress_days_non_negative
    check (accumulated_days >= 0),
  constraint rider_naturalization_progress_active_day_range
    check (
      active_since_day_number is null
      or active_since_day_number between 1 and 28
    ),
  constraint rider_naturalization_progress_active_shape
    check (
      (active_since_season_id is null) = (active_since_day_number is null)
    )
);

create unique index rider_naturalization_one_running_country_idx
  on public.rider_naturalization_country_progress (rider_id)
  where active_since_season_id is not null;

alter table public.rider_naturalization_country_progress enable row level security;
grant all privileges on table public.rider_naturalization_country_progress
  to service_role;

comment on table public.rider_naturalization_country_progress is
  'Compteurs de naturalisation par pays; un seul compteur court a la fois et les autres restent memorises.';

create or replace function public.get_game_day_ordinal(
  p_season_id uuid,
  p_day_number integer
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select season.game_year * 28 + least(28, greatest(1, p_day_number))
  from public.seasons as season
  where season.id = p_season_id;
$$;

create or replace function public.get_rider_country_progress_days(
  p_rider_id uuid,
  p_country_id uuid,
  p_season_id uuid,
  p_day_number integer
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(progress.accumulated_days, 0)
    + case
        when progress.active_since_season_id is null then 0
        else greatest(
          0,
          public.get_game_day_ordinal(p_season_id, p_day_number)
            - public.get_game_day_ordinal(
                progress.active_since_season_id,
                progress.active_since_day_number
              )
        )
      end
  from public.rider_naturalization_country_progress as progress
  where progress.rider_id = p_rider_id
    and progress.country_id = p_country_id;
$$;

create or replace function public.pause_rider_naturalization_progress(
  p_rider_id uuid,
  p_season_id uuid default null,
  p_day_number integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clock record;
  v_progress public.rider_naturalization_country_progress%rowtype;
  v_elapsed integer;
begin
  if p_rider_id is null then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'rider-naturalization-progress:' || p_rider_id::text,
      0
    )
  );

  if p_season_id is not null then
    select
      season.id as season_id,
      least(28, greatest(1, coalesce(p_day_number, 1))) as day_number
    into v_clock
    from public.seasons as season
    where season.id = p_season_id;
  else
    select
      season.id as season_id,
      coalesce(season.current_day_number, 1) as day_number
    into v_clock
    from public.seasons as season
    where season.status = 'active'
    order by season.game_year desc
    limit 1;
  end if;

  if v_clock is null then
    return;
  end if;

  select progress.*
  into v_progress
  from public.rider_naturalization_country_progress as progress
  where progress.rider_id = p_rider_id
    and progress.active_since_season_id is not null
  for update;

  if v_progress is null then
    return;
  end if;

  v_elapsed := coalesce(
    public.get_rider_country_progress_days(
      p_rider_id,
      v_progress.country_id,
      v_clock.season_id,
      v_clock.day_number
    ),
    v_progress.accumulated_days
  );

  update public.rider_naturalization_country_progress
  set
    accumulated_days = greatest(0, v_elapsed),
    active_since_season_id = null,
    active_since_day_number = null,
    updated_at = now()
  where rider_id = p_rider_id
    and country_id = v_progress.country_id;
end;
$$;

create or replace function public.resume_rider_naturalization_progress(
  p_rider_id uuid,
  p_country_id uuid,
  p_team_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clock record;
  v_rider_country_id uuid;
begin
  if p_rider_id is null or p_country_id is null then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'rider-naturalization-progress:' || p_rider_id::text,
      0
    )
  );

  select
    season.id as season_id,
    coalesce(season.current_day_number, 1) as day_number
  into v_clock
  from public.seasons as season
  where season.status = 'active'
  order by season.game_year desc
  limit 1;

  if v_clock is null then
    return;
  end if;

  select rider.country_id
  into v_rider_country_id
  from public.riders as rider
  where rider.id = p_rider_id;

  perform public.pause_rider_naturalization_progress(
    p_rider_id,
    v_clock.season_id,
    v_clock.day_number
  );

  -- A rider who already represents this country, or who has ever won a
  -- national road/TT title, is no longer eligible for another counter.
  if v_rider_country_id is null
    or v_rider_country_id = p_country_id
    or exists (
      select 1
      from public.rider_national_championship_titles as title
      where title.rider_id = p_rider_id
        and title.championship_type in ('road', 'time_trial')
    )
  then
    return;
  end if;

  insert into public.rider_naturalization_country_progress (
    rider_id,
    country_id,
    accumulated_days,
    active_since_season_id,
    active_since_day_number,
    last_team_id,
    updated_at
  )
  values (
    p_rider_id,
    p_country_id,
    0,
    v_clock.season_id,
    v_clock.day_number,
    p_team_id,
    now()
  )
  on conflict (rider_id, country_id) do update set
    active_since_season_id = excluded.active_since_season_id,
    active_since_day_number = excluded.active_since_day_number,
    last_team_id = excluded.last_team_id,
    updated_at = now();
end;
$$;

-- Existing active riders keep the progress shown before this migration.  It is
-- frozen into accumulated_days, then the new lazy clock starts today.
with active_context as (
  select
    contract.rider_id,
    contract.team_id,
    team_season.registration_country_id as country_id,
    active_season.id as active_season_id,
    active_season.game_year as active_game_year,
    coalesce(active_season.current_day_number, 1) as active_day_number,
    start_season.game_year as start_game_year,
    contract.joined_day_number
  from public.rider_contracts as contract
  join public.seasons as active_season
    on active_season.status = 'active'
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
  join public.team_seasons as team_season
    on team_season.team_id = contract.team_id
   and team_season.season_id = active_season.id
  join public.riders as rider
    on rider.id = contract.rider_id
   and rider.country_id <> team_season.registration_country_id
  where contract.status = 'active'
    and not exists (
      select 1
      from public.rider_national_championship_titles as title
      where title.rider_id = contract.rider_id
        and title.championship_type in ('road', 'time_trial')
    )
)
insert into public.rider_naturalization_country_progress (
  rider_id,
  country_id,
  accumulated_days,
  active_since_season_id,
  active_since_day_number,
  last_team_id
)
select
  context.rider_id,
  context.country_id,
  greatest(
    0,
    (context.active_game_year - context.start_game_year) * 28
      + context.active_day_number
      - context.joined_day_number
  ),
  context.active_season_id,
  context.active_day_number,
  context.team_id
from active_context as context
on conflict (rider_id, country_id) do nothing;

create or replace function public.detach_departing_rider(
  p_rider_id uuid,
  p_source_team_id uuid,
  p_season_id uuid,
  p_day_number integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_rider_id is null or p_source_team_id is null then
    return;
  end if;

  -- Inventory quantities represent items owned by the team.  Assignments only
  -- reserve them, so deleting the reservation returns the item to inventory.
  delete from public.rider_equipment_pending_assignments as pending
  using public.team_seasons as team_season
  where pending.rider_id = p_rider_id
    and team_season.id = pending.team_season_id
    and team_season.team_id = p_source_team_id;

  delete from public.rider_equipment_assignments
  where rider_id = p_rider_id;

  update public.race_rosters as roster
  set status = 'withdrawn'
  from public.race_registrations as registration,
       public.team_seasons as team_season,
       public.race_editions as edition
  where roster.rider_id = p_rider_id
    and roster.status in ('selected', 'confirmed')
    and registration.id = roster.race_registration_id
    and team_season.id = registration.team_season_id
    and team_season.team_id = p_source_team_id
    and edition.id = registration.race_edition_id
    and edition.status not in ('in_progress', 'completed', 'cancelled');

  update public.rider_form_camps as camp
  set
    status = 'cancelled',
    completed_at = null
  from public.team_seasons as team_season
  where camp.rider_id = p_rider_id
    and camp.status in ('planned', 'active')
    and team_season.id = camp.team_season_id
    and team_season.team_id = p_source_team_id;

  update public.stage_reconnaissances as reconnaissance
  set
    status = 'cancelled',
    completed_at = null
  from public.team_seasons as team_season
  where reconnaissance.team_season_id = team_season.id
    and team_season.team_id = p_source_team_id
    and reconnaissance.status in ('planned', 'active')
    and not exists (
      select 1
      from public.stage_reconnaissance_riders as participant
      join public.rider_form_camps as participant_camp
        on participant_camp.id = participant.form_camp_id
      where participant.reconnaissance_id = reconnaissance.id
        and participant_camp.status <> 'cancelled'
    );

  perform public.pause_rider_naturalization_progress(
    p_rider_id,
    p_season_id,
    p_day_number
  );
end;
$$;

create or replace function public.stamp_rider_contract_departure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clock record;
begin
  if old.status not in ('active', 'planned')
    or new.status not in ('completed', 'terminated', 'cancelled')
    or new.left_season_id is not null
  then
    return new;
  end if;

  select
    season.id as season_id,
    coalesce(season.current_day_number, 1) as day_number
  into v_clock
  from public.seasons as season
  where season.status = 'active'
  order by season.game_year desc
  limit 1;

  new.left_season_id := coalesce(v_clock.season_id, old.end_season_id);
  new.left_day_number := coalesce(
    v_clock.day_number,
    case when new.status = 'completed' then 28 else 1 end
  );
  return new;
end;
$$;

create or replace function public.handle_rider_contract_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rider_id uuid := case when tg_op = 'DELETE' then old.rider_id else new.rider_id end;
  v_team_id uuid := case when tg_op = 'DELETE' then old.team_id else new.team_id end;
  v_contract_id uuid := case when tg_op = 'DELETE' then null else new.id end;
  v_left_season_id uuid := case when tg_op = 'DELETE' then old.end_season_id else new.left_season_id end;
  v_left_day_number integer := case when tg_op = 'DELETE' then 28 else new.left_day_number end;
  v_country_id uuid;
  v_is_departure boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.status = 'active' then
      select team_season.registration_country_id
      into v_country_id
      from public.seasons as season
      join public.team_seasons as team_season
        on team_season.team_id = new.team_id
       and team_season.season_id = season.id
      where season.status = 'active'
      limit 1;

      perform public.resume_rider_naturalization_progress(
        new.rider_id,
        v_country_id,
        new.team_id
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status <> 'active' and new.status = 'active' then
      select team_season.registration_country_id
      into v_country_id
      from public.seasons as season
      join public.team_seasons as team_season
        on team_season.team_id = new.team_id
       and team_season.season_id = season.id
      where season.status = 'active'
      limit 1;

      perform public.resume_rider_naturalization_progress(
        new.rider_id,
        v_country_id,
        new.team_id
      );
    end if;

    v_is_departure := old.status in ('active', 'planned')
      and new.status in ('completed', 'terminated', 'cancelled');
  else
    v_is_departure := old.status in ('active', 'planned');
  end if;

  if v_is_departure and not exists (
    select 1
    from public.rider_contracts as successor
    where successor.rider_id = v_rider_id
      and successor.status in ('active', 'planned')
      and (v_contract_id is null or successor.id <> v_contract_id)
  ) then
    perform public.detach_departing_rider(
      v_rider_id,
      v_team_id,
      v_left_season_id,
      v_left_day_number
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_rider_contract_departure_before_update
  on public.rider_contracts;
create trigger stamp_rider_contract_departure_before_update
before update of status
on public.rider_contracts
for each row execute function public.stamp_rider_contract_departure();

drop trigger if exists handle_rider_contract_transition_after_write
  on public.rider_contracts;
create trigger handle_rider_contract_transition_after_write
after insert or update or delete
on public.rider_contracts
for each row execute function public.handle_rider_contract_transition();

create or replace function public.record_transfer_fee_on_contract()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract_id uuid;
begin
  if new.status <> 'settled'
    or new.winning_team_id is null
    or new.winning_bid is null
  then
    return new;
  end if;

  select contract.id
  into v_contract_id
  from public.rider_contracts as contract
  where contract.rider_id = new.rider_id
    and contract.team_id = new.winning_team_id
    and contract.start_season_id = new.season_id
    and contract.acquisition_type = case
      when new.listing_type = 'daily' then 'daily_auction'
      else 'director_auction'
    end
  order by contract.signed_at desc nulls last, contract.created_at desc
  limit 1;

  update public.rider_contracts
  set transfer_fee = new.winning_bid
  where id = v_contract_id;

  return new;
end;
$$;

drop trigger if exists transfer_listing_record_contract_fee
  on public.transfer_market_listings;
create trigger transfer_listing_record_contract_fee
after insert or update
on public.transfer_market_listings
for each row execute function public.record_transfer_fee_on_contract();

update public.rider_contracts as contract
set transfer_fee = listing.winning_bid
from public.transfer_market_listings as listing
where listing.status = 'settled'
  and listing.winning_bid is not null
  and listing.winning_team_id = contract.team_id
  and listing.rider_id = contract.rider_id
  and listing.season_id = contract.start_season_id
  and contract.acquisition_type = case
    when listing.listing_type = 'daily' then 'daily_auction'
    else 'director_auction'
  end
  and contract.transfer_fee is null;

create or replace function public.handle_team_naturalization_country_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rider_id uuid;
begin
  if old.registration_country_id = new.registration_country_id
    or not exists (
      select 1
      from public.seasons as season
      where season.id = new.season_id
        and season.status = 'active'
    )
  then
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

  return new;
end;
$$;

drop trigger if exists team_season_switch_naturalization_country
  on public.team_seasons;
create trigger team_season_switch_naturalization_country
after update of registration_country_id
on public.team_seasons
for each row execute function public.handle_team_naturalization_country_change();

create or replace function public.align_team_country_with_principal_sponsor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_country_id uuid;
begin
  if new.role <> 'principal' or new.status <> 'active' then
    return new;
  end if;

  select sponsor.country_id
  into v_country_id
  from public.sponsors as sponsor
  where sponsor.id = new.sponsor_id;

  if v_country_id is not null then
    update public.team_seasons
    set registration_country_id = v_country_id
    where team_id = new.team_id
      and season_id = new.start_season_id
      and registration_country_id <> v_country_id;
  end if;

  return new;
end;
$$;

drop trigger if exists principal_sponsor_aligns_team_country
  on public.team_sponsor_contracts;
create trigger principal_sponsor_aligns_team_country
after insert or update
on public.team_sponsor_contracts
for each row execute function public.align_team_country_with_principal_sponsor();

-- Apply the sponsor country to contracts already active when this migration is
-- installed.  The team_seasons trigger switches the running counters at once.
update public.team_seasons as team_season
set registration_country_id = sponsor.country_id
from public.team_sponsor_contracts as contract
join public.sponsors as sponsor on sponsor.id = contract.sponsor_id
where contract.team_id = team_season.team_id
  and contract.start_season_id = team_season.season_id
  and contract.role = 'principal'
  and contract.status = 'active'
  and sponsor.country_id is not null
  and team_season.registration_country_id <> sponsor.country_id;

create or replace function public.settle_expiring_rider_contracts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    with expired as (
      update public.rider_contracts as contract
      set status = 'completed'
      where contract.end_season_id = new.id
        and contract.status = 'active'
      returning contract.rider_id
    )
    update public.riders as rider
    set status = 'free_agent'
    where rider.id in (select expired.rider_id from expired)
      and not exists (
        select 1
        from public.rider_contracts as successor
        where successor.rider_id = rider.id
          and successor.status in ('active', 'planned')
      );
  end if;

  if new.status = 'active' and old.status <> 'active' then
    update public.rider_contracts as contract
    set status = 'active'
    where contract.start_season_id = new.id
      and contract.status = 'planned';

    update public.riders as rider
    set status = 'active'
    where exists (
      select 1
      from public.rider_contracts as contract
      where contract.rider_id = rider.id
        and contract.start_season_id = new.id
        and contract.status = 'active'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists contract_lifecycle_on_season_status
  on public.seasons;
create trigger contract_lifecycle_on_season_status
after update of status
on public.seasons
for each row execute function public.settle_expiring_rider_contracts();

create or replace function public.pause_progress_after_rider_nationality_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.country_id <> new.country_id then
    perform public.pause_rider_naturalization_progress(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists rider_nationality_pauses_progress
  on public.riders;
create trigger rider_nationality_pauses_progress
after update of country_id
on public.riders
for each row execute function public.pause_progress_after_rider_nationality_change();

-- The naturalization RPC now reads the per-country memory rather than a
-- continuous stay in one specific team.
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

  if v_elapsed_days < 84 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Ce coureur pourra etre naturalise dans %s jour%s de jeu.',
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

revoke all on function public.get_game_day_ordinal(uuid, integer) from public;
revoke all on function public.get_rider_country_progress_days(uuid, uuid, uuid, integer) from public;
revoke all on function public.pause_rider_naturalization_progress(uuid, uuid, integer) from public;
revoke all on function public.resume_rider_naturalization_progress(uuid, uuid, uuid) from public;
revoke all on function public.detach_departing_rider(uuid, uuid, uuid, integer) from public;
revoke all on function public.stamp_rider_contract_departure() from public;
revoke all on function public.handle_rider_contract_transition() from public;
revoke all on function public.record_transfer_fee_on_contract() from public;
revoke all on function public.handle_team_naturalization_country_change() from public;
revoke all on function public.align_team_country_with_principal_sponsor() from public;
revoke all on function public.settle_expiring_rider_contracts() from public;
revoke all on function public.pause_progress_after_rider_nationality_change() from public;

grant execute on function public.get_rider_country_progress_days(uuid, uuid, uuid, integer)
  to service_role;

notify pgrst, 'reload schema';

commit;
