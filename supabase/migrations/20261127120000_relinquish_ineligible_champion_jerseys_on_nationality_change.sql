begin;
set local lock_timeout = '500ms';
set local statement_timeout = '8s';

-- A title records the country and result that earned it. Eligibility to wear
-- its jersey follows the rider's current sporting country, without rewriting
-- that history. World and quadrennial titles remain individual global titles.
create function private.championship_jersey_is_eligible(
  p_championship_type text,
  p_title_country_id uuid,
  p_current_country_id uuid,
  p_current_continent_code text
)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_championship_type in ('road', 'time_trial') then
      coalesce(p_title_country_id = p_current_country_id, false)
    when p_championship_type in (
      'continental_africa_road', 'continental_africa_time_trial',
      'continental_america_road', 'continental_america_time_trial',
      'continental_asia_road', 'continental_asia_time_trial',
      'continental_europe_road', 'continental_europe_time_trial',
      'continental_oceania_road', 'continental_oceania_time_trial'
    ) then
      coalesce(split_part(p_championship_type, '_', 2) = p_current_continent_code, false)
    else true
  end;
$$;

-- A delayed settlement or replay can still award the historical title after a
-- rider has moved. Retain the award while refusing an incompatible active jersey.
create function private.guard_champion_jersey_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
set lock_timeout = '500ms'
as $$
declare
  v_current_country_id uuid;
  v_current_continent_code text;
begin
  if new.championship_type in (
    'world_road', 'world_time_trial', 'quadrennial_road', 'quadrennial_time_trial'
  ) then
    return new;
  end if;

  select rider.country_id into v_current_country_id
  from public.riders as rider
  where rider.id = new.rider_id;

  select country.continent_code into v_current_continent_code
  from public.countries as country
  where country.id = v_current_country_id;

  if not private.championship_jersey_is_eligible(
    new.championship_type, new.country_id, v_current_country_id, v_current_continent_code
  ) then
    new.relinquished_at := clock_timestamp();
  end if;
  return new;
end;
$$;

create trigger guard_champion_jersey_eligibility
before insert or update of rider_id, country_id, championship_type, relinquished_at
on public.rider_national_championship_titles
for each row when (new.relinquished_at is null)
execute function private.guard_champion_jersey_eligibility();

-- The award guard deliberately reads without locking the rider: result
-- settlement can already hold a title lock while a country change holds the
-- rider lock. Read-side eligibility checks cover that concurrent snapshot edge
-- without adding an inverted lock order to race settlement.

create function private.relinquish_ineligible_champion_jerseys_on_country_change()
returns trigger
language plpgsql
security definer
set search_path = ''
set lock_timeout = '500ms'
as $$
begin
  update public.rider_national_championship_titles as title
  set relinquished_at = clock_timestamp()
  from public.countries as country
  where title.rider_id = new.id
    and title.relinquished_at is null
    and country.id = new.country_id
    and not private.championship_jersey_is_eligible(
      title.championship_type, title.country_id, new.country_id, country.continent_code
    );
  return new;
end;
$$;

-- Central coverage includes passports, ordinary naturalizations and privileged
-- nationality corrections. It also covers active academy competition proxies.
create trigger relinquish_ineligible_champion_jerseys_on_country_change
after update of country_id on public.riders
for each row when (old.country_id is distinct from new.country_id)
execute function private.relinquish_ineligible_champion_jerseys_on_country_change();

revoke all on function private.championship_jersey_is_eligible(text,uuid,uuid,text),
  private.guard_champion_jersey_eligibility(),
  private.relinquish_ineligible_champion_jerseys_on_country_change()
from public, anon, authenticated, service_role;

-- Repair only currently worn incompatible jerseys. The existing partial active
-- title indexes bound candidates; no historical results or trophies are rebuilt.
update public.rider_national_championship_titles as title
set relinquished_at = now()
from public.riders as rider
join public.countries as country on country.id = rider.country_id
where title.rider_id = rider.id
  and title.relinquished_at is null
  and not private.championship_jersey_is_eligible(
    title.championship_type, title.country_id, rider.country_id, country.continent_code
  );

commit;
