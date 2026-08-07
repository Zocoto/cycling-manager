begin;

alter table public.team_sponsor_contracts
  add column if not exists previous_registration_country_id uuid
    references public.countries(id) on delete set null;

-- Sauvegarde le pays d'origine des contrats déjà actifs avant la correction.
update public.team_sponsor_contracts as contract
set previous_registration_country_id = team_season.registration_country_id
from public.seasons as current_season,
  public.team_seasons as team_season
where current_season.status = 'active'
  and contract.role = 'principal'
  and team_season.team_id = contract.team_id
  and team_season.season_id = current_season.id
  and contract.status = 'active'
  and contract.previous_registration_country_id is null;

-- Répare aussi immédiatement les contrats principaux déjà actifs.
update public.team_seasons as team_season
set registration_country_id = sponsor.country_id
from public.team_sponsor_contracts as contract
join public.sponsors as sponsor
  on sponsor.id = contract.sponsor_id
join public.seasons as contract_start
  on contract_start.id = contract.start_season_id,
  public.seasons as team_season_year
where contract.team_id = team_season.team_id
  and contract.role = 'principal'
  and team_season_year.id = team_season.season_id
  and contract.status = 'active'
  and team_season_year.game_year between contract_start.game_year
    and contract_start.game_year + contract.contract_duration_seasons - 1;

create or replace function private.capture_team_sponsor_previous_country()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role = 'principal'
    and new.status = 'active'
    and new.previous_registration_country_id is null
    and (tg_op = 'insert' or old.status is distinct from 'active') then
    select team_season.registration_country_id
    into new.previous_registration_country_id
    from public.team_seasons as team_season
    where team_season.team_id = new.team_id
      and team_season.season_id = new.start_season_id;
  end if;
  return new;
end;
$$;

create or replace function private.sync_team_sponsor_country()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  sponsor_country_id uuid;
begin
  if new.role <> 'principal' then
    return new;
  end if;

  if new.status = 'active' then
    select sponsor.country_id into sponsor_country_id
    from public.sponsors as sponsor
    where sponsor.id = new.sponsor_id;

    update public.team_seasons as team_season
    set registration_country_id = sponsor_country_id
    from public.seasons as contract_start,
      public.seasons as team_season_year
    where team_season.team_id = new.team_id
      and contract_start.id = new.start_season_id
      and team_season_year.id = team_season.season_id
      and team_season_year.game_year between contract_start.game_year
        and contract_start.game_year + new.contract_duration_seasons - 1;
  elsif tg_op = 'update'
    and old.status = 'active'
    and new.previous_registration_country_id is not null then
    update public.team_seasons as team_season
    set registration_country_id = new.previous_registration_country_id
    from public.seasons as contract_start,
      public.seasons as team_season_year
    where team_season.team_id = new.team_id
      and contract_start.id = new.start_season_id
      and team_season_year.id = team_season.season_id
      and team_season_year.game_year between contract_start.game_year
        and contract_start.game_year + new.contract_duration_seasons - 1;
  end if;

  return new;
end;
$$;

drop trigger if exists capture_team_sponsor_previous_country
  on public.team_sponsor_contracts;
create trigger capture_team_sponsor_previous_country
before insert or update of status, sponsor_id
on public.team_sponsor_contracts
for each row execute function private.capture_team_sponsor_previous_country();

drop trigger if exists sync_team_sponsor_country
  on public.team_sponsor_contracts;
create trigger sync_team_sponsor_country
after insert or update of status, sponsor_id
on public.team_sponsor_contracts
for each row execute function private.sync_team_sponsor_country();

alter table public.post_race_interviews
  drop constraint if exists post_race_interviews_status_allowed;
alter table public.post_race_interviews
  add constraint post_race_interviews_status_allowed
    check (status in ('pending', 'submitted', 'closed'));

create or replace function public.close_expired_post_race_interviews()
returns void
language sql
security definer
set search_path = public
as $$
  update public.post_race_interviews as interview
  set status = 'closed', updated_at = now()
  from public.stages as stage
  join public.season_days as season_day
    on season_day.id = stage.season_day_id
  where interview.stage_id = stage.id
    and interview.status = 'pending'
    and (
      season_day.calendar_date < (now() at time zone 'Europe/Paris')::date
      or (
        season_day.calendar_date = (now() at time zone 'Europe/Paris')::date
        and (now() at time zone 'Europe/Paris')::time >= time '20:00'
      )
    );
$$;

select public.close_expired_post_race_interviews();

revoke all on function public.close_expired_post_race_interviews() from public;
grant execute on function public.close_expired_post_race_interviews() to service_role;

notify pgrst, 'reload schema';

commit;
