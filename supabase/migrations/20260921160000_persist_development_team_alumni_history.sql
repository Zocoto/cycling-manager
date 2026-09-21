begin;

-- Le roster Development Team est une table opérationnelle : un junior en sort
-- lorsqu'il est promu ou lorsque la sélection est remaniée. Cette table garde
-- désormais la trace historique de toute affiliation, indépendamment du roster.
create table public.rider_development_team_history (
  id uuid primary key default gen_random_uuid(),
  academy_rider_id uuid not null
    references public.youth_academy_riders(id) on delete restrict,
  rider_id uuid references public.riders(id) on delete set null,
  development_team_id uuid
    references public.development_teams(id) on delete set null,
  team_id uuid not null,
  season_id uuid not null references public.seasons(id) on delete restrict,
  development_team_name text not null,
  race_number smallint,
  joined_at timestamptz not null,
  left_at timestamptz,
  promoted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rider_development_team_history_membership_unique
    unique (academy_rider_id, team_id, season_id),
  constraint rider_development_team_history_name_not_empty
    check (btrim(development_team_name) <> ''),
  constraint rider_development_team_history_number_range
    check (race_number is null or race_number between 1 and 99),
  constraint rider_development_team_history_dates_valid
    check (left_at is null or left_at >= joined_at)
);

create index rider_development_team_history_rider_idx
  on public.rider_development_team_history (rider_id, season_id);

create index rider_development_team_history_academy_idx
  on public.rider_development_team_history (academy_rider_id, season_id);

alter table public.rider_development_team_history enable row level security;

create policy rider_development_team_history_read_authenticated
on public.rider_development_team_history
for select
to authenticated
using (true);

grant select on table public.rider_development_team_history to authenticated;
grant all privileges on table public.rider_development_team_history to service_role;

-- Centralise la copie du roster et la liaison avec le coureur professionnel.
-- La fonction est idempotente afin que tous les chemins de promotion puissent
-- l'appeler sans créer de doublon.
create or replace function public.sync_rider_development_team_history(
  p_academy_rider_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.rider_development_team_history (
    academy_rider_id,
    rider_id,
    development_team_id,
    team_id,
    season_id,
    development_team_name,
    race_number,
    joined_at,
    promoted_at,
    updated_at
  )
  select
    roster.academy_rider_id,
    youth.promoted_rider_id,
    development_team.id,
    development_team.team_id,
    development_team.season_id,
    development_team.display_name,
    roster.race_number,
    roster.joined_at,
    case when youth.promoted_rider_id is not null then now() else null end,
    now()
  from public.development_team_roster as roster
  join public.development_teams as development_team
    on development_team.id = roster.development_team_id
  join public.youth_academy_riders as youth
    on youth.id = roster.academy_rider_id
  where roster.academy_rider_id = p_academy_rider_id
  on conflict (academy_rider_id, team_id, season_id) do update
  set
    rider_id = coalesce(
      excluded.rider_id,
      public.rider_development_team_history.rider_id
    ),
    development_team_id = excluded.development_team_id,
    development_team_name = excluded.development_team_name,
    race_number = excluded.race_number,
    joined_at = least(
      public.rider_development_team_history.joined_at,
      excluded.joined_at
    ),
    left_at = null,
    promoted_at = coalesce(
      public.rider_development_team_history.promoted_at,
      excluded.promoted_at
    ),
    updated_at = now();

  update public.rider_development_team_history as history
  set
    rider_id = youth.promoted_rider_id,
    promoted_at = coalesce(history.promoted_at, now()),
    updated_at = now()
  from public.youth_academy_riders as youth
  where youth.id = p_academy_rider_id
    and youth.promoted_rider_id is not null
    and history.academy_rider_id = youth.id
    and history.rider_id is distinct from youth.promoted_rider_id;
end;
$$;

create or replace function public.capture_development_team_roster_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.sync_rider_development_team_history(new.academy_rider_id);
    return new;
  end if;

  update public.rider_development_team_history as history
  set
    rider_id = coalesce(youth.promoted_rider_id, history.rider_id),
    left_at = greatest(now(), history.joined_at),
    promoted_at = case
      when youth.promoted_rider_id is not null
        then coalesce(history.promoted_at, now())
      else history.promoted_at
    end,
    updated_at = now()
  from public.youth_academy_riders as youth
  where youth.id = old.academy_rider_id
    and history.academy_rider_id = old.academy_rider_id
    and history.development_team_id = old.development_team_id;

  return old;
end;
$$;

create trigger development_team_roster_history_insert
  after insert on public.development_team_roster
  for each row execute function public.capture_development_team_roster_history();

create trigger development_team_roster_history_delete
  after delete on public.development_team_roster
  for each row execute function public.capture_development_team_roster_history();

create or replace function public.link_promoted_rider_development_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_rider_development_team_history(new.id);
  return new;
end;
$$;

create trigger youth_promotion_development_history
  after update of promoted_rider_id on public.youth_academy_riders
  for each row
  when (new.promoted_rider_id is not null)
  execute function public.link_promoted_rider_development_history();

-- Rattrapage des affiliations encore visibles dans un roster, une inscription
-- ou un résultat explicitement rattaché à une Development Team. Les résultats
-- fédéraux sans équipe ne sont volontairement pas utilisés comme preuve.
with membership_evidence as (
  select
    roster.academy_rider_id,
    roster.development_team_id,
    roster.joined_at as observed_at,
    roster.race_number
  from public.development_team_roster as roster

  union all

  select
    registration_rider.academy_rider_id,
    registration.development_team_id,
    registration_rider.selected_at as observed_at,
    null::smallint as race_number
  from public.development_race_registration_riders as registration_rider
  join public.development_race_registrations as registration
    on registration.id = registration_rider.registration_id

  union all

  select
    result.academy_rider_id,
    result.development_team_id,
    result.created_at as observed_at,
    null::smallint as race_number
  from public.development_race_results as result
  where result.academy_rider_id is not null
    and result.development_team_id is not null
), consolidated as (
  select
    evidence.academy_rider_id,
    evidence.development_team_id,
    min(evidence.observed_at) as joined_at,
    max(evidence.race_number) as race_number
  from membership_evidence as evidence
  group by evidence.academy_rider_id, evidence.development_team_id
)
insert into public.rider_development_team_history (
  academy_rider_id,
  rider_id,
  development_team_id,
  team_id,
  season_id,
  development_team_name,
  race_number,
  joined_at,
  left_at,
  promoted_at
)
select
  consolidated.academy_rider_id,
  youth.promoted_rider_id,
  development_team.id,
  development_team.team_id,
  development_team.season_id,
  development_team.display_name,
  consolidated.race_number,
  consolidated.joined_at,
  case
    when current_roster.id is null then greatest(youth.updated_at, consolidated.joined_at)
    else null
  end,
  case when youth.promoted_rider_id is not null then youth.updated_at else null end
from consolidated
join public.development_teams as development_team
  on development_team.id = consolidated.development_team_id
join public.youth_academy_riders as youth
  on youth.id = consolidated.academy_rider_id
left join public.development_team_roster as current_roster
  on current_roster.development_team_id = consolidated.development_team_id
  and current_roster.academy_rider_id = consolidated.academy_rider_id
on conflict (academy_rider_id, team_id, season_id) do update
set
  rider_id = coalesce(
    excluded.rider_id,
    public.rider_development_team_history.rider_id
  ),
  development_team_id = excluded.development_team_id,
  development_team_name = excluded.development_team_name,
  race_number = coalesce(
    excluded.race_number,
    public.rider_development_team_history.race_number
  ),
  joined_at = least(
    public.rider_development_team_history.joined_at,
    excluded.joined_at
  ),
  left_at = excluded.left_at,
  promoted_at = coalesce(
    public.rider_development_team_history.promoted_at,
    excluded.promoted_at
  ),
  updated_at = now();

revoke all on function public.sync_rider_development_team_history(uuid)
  from public, anon, authenticated;
revoke all on function public.capture_development_team_roster_history()
  from public, anon, authenticated;
revoke all on function public.link_promoted_rider_development_history()
  from public, anon, authenticated;

grant execute on function public.sync_rider_development_team_history(uuid)
  to service_role;

comment on table public.rider_development_team_history is
  'Mémoire durable des affiliations Development Team, conservée après promotion et sortie du roster opérationnel.';
comment on function public.sync_rider_development_team_history(uuid) is
  'Synchronise de façon idempotente les affiliations Development Team et leur coureur professionnel issu de l académie.';

commit;
