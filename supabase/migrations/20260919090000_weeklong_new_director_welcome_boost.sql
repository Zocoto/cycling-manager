begin;

-- The window starts when this migration is applied, not when the code is
-- merged. Eligibility follows the account's registration date, so a player
-- who signs up during the week may finish creating their team afterwards.
create table private.new_director_welcome_campaigns (
  code text primary key,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  extra_starting_cash numeric(14, 2) not null,
  scout_level smallint not null,
  constraint new_director_welcome_campaign_window check (ends_at > starts_at),
  constraint new_director_welcome_campaign_cash check (extra_starting_cash > 0),
  constraint new_director_welcome_campaign_scout_level check (scout_level between 1 and 5)
);

insert into private.new_director_welcome_campaigns (
  code, starts_at, ends_at, extra_starting_cash, scout_level
) select
  'welcome_week_2026_09',
  activation.started_at,
  activation.started_at + interval '7 days',
  5000,
  3
from (select clock_timestamp() as started_at) as activation;

-- The grant register also makes the award auditable and prevents a second
-- grant if this trigger is ever replayed for the same career or account.
create table private.new_director_welcome_grants (
  generation_id uuid primary key references public.initial_career_generations(id) on delete cascade,
  auth_user_id uuid not null unique,
  team_id uuid not null unique references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  campaign_code text not null references private.new_director_welcome_campaigns(code),
  extra_starting_cash numeric(14, 2) not null,
  scout_member_id uuid unique references public.staff_members(id) on delete set null,
  scout_contract_id uuid unique references public.staff_contracts(id) on delete set null,
  granted_at timestamptz not null default now()
);

create or replace function private.grant_new_director_welcome_boost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign private.new_director_welcome_campaigns%rowtype;
  v_auth_user_id uuid;
  v_registered_at timestamptz;
  v_team_country_id uuid;
  v_currency_code text;
  v_name_profile_code text;
  v_first_name text;
  v_last_name text;
  v_talent_code text;
  v_scout_member_id uuid;
  v_scout_contract_id uuid;
begin
  select campaign.* into v_campaign
  from private.new_director_welcome_campaigns as campaign
  where campaign.code = 'welcome_week_2026_09';

  if not found then
    return new;
  end if;

  select director.auth_user_id, account.created_at, team.home_country_id,
    team_season.currency_code, profile.name_profile_code
  into v_auth_user_id, v_registered_at, v_team_country_id,
    v_currency_code, v_name_profile_code
  from public.sporting_directors as director
  join auth.users as account on account.id = director.auth_user_id
  join public.teams as team on team.id = new.team_id
  join public.team_seasons as team_season
    on team_season.team_id = new.team_id
   and team_season.season_id = new.season_id
  join public.country_rider_generation_profiles as profile
    on profile.country_id = team.home_country_id
  where director.id = new.sporting_director_id;

  if not found
    or v_registered_at < v_campaign.starts_at
    or v_registered_at >= v_campaign.ends_at
  then
    return new;
  end if;

  if exists (
    select 1 from private.new_director_welcome_grants as award
    where award.generation_id = new.id
      or award.auth_user_id = v_auth_user_id
      or award.team_id = new.team_id
  ) then
    return new;
  end if;

  select part.value into v_first_name
  from public.rider_name_parts as part
  where part.profile_code = v_name_profile_code
    and part.name_type = 'first_name'
  order by random()
  limit 1;

  select part.value into v_last_name
  from public.rider_name_parts as part
  where part.profile_code = v_name_profile_code
    and part.name_type = 'last_name'
  order by random()
  limit 1;

  -- The initial roster has already been inserted for this same country.
  -- It is a safe fallback if a name library is ever incomplete.
  if v_first_name is null then
    select rider.first_name into v_first_name
    from public.rider_contracts as contract
    join public.riders as rider on rider.id = contract.rider_id
    where contract.team_id = new.team_id
      and contract.start_season_id = new.season_id
    order by random()
    limit 1;
  end if;

  if v_last_name is null then
    select rider.last_name into v_last_name
    from public.rider_contracts as contract
    join public.riders as rider on rider.id = contract.rider_id
    where contract.team_id = new.team_id
      and contract.start_season_id = new.season_id
    order by random()
    limit 1;
  end if;

  select talent.code into v_talent_code
  from public.staff_talent_catalog as talent
  where talent.role = 'scout'
    and talent.is_active
  order by random()
  limit 1;

  if v_first_name is null or v_last_name is null or v_talent_code is null then
    raise exception 'Impossible de générer le scout de bienvenue pour cette équipe.';
  end if;

  insert into private.new_director_welcome_grants (
    generation_id, auth_user_id, team_id, season_id, campaign_code,
    extra_starting_cash
  ) values (
    new.id, v_auth_user_id, new.team_id, new.season_id, v_campaign.code,
    v_campaign.extra_starting_cash
  );

  update public.team_seasons as team_season
  set opening_cash_balance = team_season.opening_cash_balance + v_campaign.extra_starting_cash,
      cash_balance = team_season.cash_balance + v_campaign.extra_starting_cash
  where team_season.team_id = new.team_id
    and team_season.season_id = new.season_id;

  if not found then
    raise exception 'La saison de l’équipe initiale est introuvable pour le bonus de bienvenue.';
  end if;

  insert into public.staff_members (
    country_id, first_name, last_name, role, level
  ) values (
    v_team_country_id, v_first_name, v_last_name, 'scout', v_campaign.scout_level
  ) returning id into v_scout_member_id;

  insert into public.staff_member_talents (
    staff_member_id, slot_number, talent_code, unlocked_by
  ) values (
    v_scout_member_id, 1, v_talent_code, 'generation'
  );

  -- The hire costs nothing; as for other gifted staff, ordinary salaries
  -- remain payable under the existing staff-contract rules.
  insert into public.staff_contracts (
    staff_member_id, team_id, start_season_id, salary_per_season,
    currency_code, signing_fee, status
  ) values (
    v_scout_member_id, new.team_id, new.season_id,
    public.calculate_staff_salary('scout', v_campaign.scout_level),
    v_currency_code, 0, 'active'
  ) returning id into v_scout_contract_id;

  update private.new_director_welcome_grants
  set scout_member_id = v_scout_member_id,
      scout_contract_id = v_scout_contract_id
  where generation_id = new.id;

  return new;
end;
$$;

create trigger initial_career_weekly_signup_boost
after insert on public.initial_career_generations
for each row execute function private.grant_new_director_welcome_boost();

revoke all on table private.new_director_welcome_campaigns,
  private.new_director_welcome_grants from public, anon, authenticated;
revoke all on function private.grant_new_director_welcome_boost()
  from public, anon, authenticated;

comment on table private.new_director_welcome_campaigns is
  'Fenêtre de sept jours à partir du déploiement pour les inscriptions bénéficiant du bonus de bienvenue.';
comment on table private.new_director_welcome_grants is
  'Attributions uniques du bonus de 5 000 EUR et du scout national de niveau 3.';

commit;
