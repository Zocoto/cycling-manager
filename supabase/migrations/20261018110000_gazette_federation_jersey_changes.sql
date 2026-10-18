begin;
set local application_name = 'gazette-jersey-migration-20261018';
set local lock_timeout = '2s';
set local statement_timeout = '10s';

-- Only the evening publication reads this history; no trigger or gameplay job.
create index if not exists federation_jersey_history_publication_idx
  on public.national_federation_jersey_history (published_at);
create index if not exists federation_champion_jersey_history_publication_idx
  on public.national_federation_champion_jersey_history (published_at);

create or replace function public.get_cyclogazette_jersey_changes(
  p_issue_date date, p_until timestamptz
) returns table (
  country_id uuid, country_code text, country_name text, jersey_kind text,
  version integer, design jsonb, previous_design jsonb, published_at timestamptz,
  rider_id uuid, rider_name text, avatar_profile_key text, avatar_seed text,
  championship_type text
)
language sql stable security definer set search_path = '' as $$
  -- A Paris editorial day closes at 20:00. A publication after closing is
  -- included in the next issue, including across DST and season boundaries.
  with bounds as materialized (
    select ((p_issue_date - 1) + time '20:00') at time zone 'Europe/Paris' as starts_at,
      least(p_until, (p_issue_date + time '20:00') at time zone 'Europe/Paris') as ends_at
  ), changes as materialized (
    select distinct on (h.country_id) h.country_id, 'national_team'::text as jersey_kind,
      h.version, h.design, h.published_at
    from public.national_federation_jersey_history h cross join bounds b
    where h.published_at > b.starts_at and h.published_at <= b.ends_at
    order by h.country_id, h.published_at desc, h.version desc
  ), champion_changes as materialized (
    select distinct on (h.country_id) h.country_id, 'national_champion'::text as jersey_kind,
      h.version, h.design, h.published_at
    from public.national_federation_champion_jersey_history h cross join bounds b
    where h.published_at > b.starts_at and h.published_at <= b.ends_at
    order by h.country_id, h.published_at desc, h.version desc
  ), candidates as (
    select c.*, previous.design as previous_design from changes c cross join bounds b
    left join lateral (
      select h.design from public.national_federation_jersey_history h
      where h.country_id = c.country_id and h.published_at <= b.starts_at
      order by h.version desc limit 1
    ) previous on true
    union all
    select c.*, previous.design as previous_design from champion_changes c cross join bounds b
    left join lateral (
      select h.design from public.national_federation_champion_jersey_history h
      where h.country_id = c.country_id and h.published_at <= b.starts_at
      order by h.version desc limit 1
    ) previous on true
  )
  select c.country_id, nation.iso_alpha2, nation.name, c.jersey_kind,
    c.version, c.design, c.previous_design, c.published_at,
    model.id, concat_ws(' ', model.first_name, model.last_name),
    model.avatar_profile_key, model.avatar_seed::text, model.championship_type
  from candidates c
  join public.countries nation on nation.id = c.country_id
  left join lateral (
    select rider.id, rider.first_name, rider.last_name, rider.avatar_profile_key,
      rider.avatar_seed, title.championship_type
    from public.rider_national_championship_titles title
    join public.riders rider on rider.id = title.rider_id
    where c.jersey_kind = 'national_champion' and title.country_id = c.country_id
      and title.relinquished_at is null and title.won_at <= p_until
      and rider.country_id = c.country_id and rider.status in ('active', 'free_agent')
    order by (title.championship_type = 'road') desc, title.won_at desc, rider.id
    limit 1
  ) champion on true
  left join lateral (
    select rider.id, rider.first_name, rider.last_name, rider.avatar_profile_key,
      rider.avatar_seed, null::text as championship_type
    from public.riders rider
    where c.jersey_kind = 'national_team' and rider.country_id = c.country_id
      and rider.status in ('active', 'free_agent')
    order by rider.id limit 1
  ) national_rider on true
  left join lateral (
    select champion.* where champion.id is not null
    union all
    select national_rider.* where national_rider.id is not null
  ) model on true
  order by c.published_at desc, c.country_id, c.jersey_kind;
$$;
revoke all on function public.get_cyclogazette_jersey_changes(date,timestamptz) from public, anon, authenticated;
grant execute on function public.get_cyclogazette_jersey_changes(date,timestamptz) to service_role;
comment on function public.get_cyclogazette_jersey_changes(date,timestamptz) is
  'Read-only daily jersey candidates and prior design for the Gazette closing. No changes to jerseys, riders or historical issues.';
notify pgrst, 'reload schema';
commit;
