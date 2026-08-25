-- ============================================================
-- Scouting junior : réputation UCI N-1 et capacités natives rares
-- ============================================================

begin;

alter table public.youth_scouting_candidates
  add column if not exists native_special_ability_code text
    references public.special_ability_catalog(code)
    on delete restrict;

alter table public.youth_academy_riders
  add column if not exists native_special_ability_code text
    references public.special_ability_catalog(code)
    on delete restrict;

create or replace function public.get_youth_scouting_country_uci_rankings(
  p_current_season_id uuid
)
returns table (
  season_id uuid,
  season_name text,
  country_id uuid,
  uci_points bigint,
  uci_rank bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with current_season as (
    select season.game_year
    from public.seasons as season
    where season.id = p_current_season_id
  ),
  previous_season as (
    select season.id, season.name
    from public.seasons as season
    cross join current_season
    where season.game_year < current_season.game_year
    order by season.game_year desc
    limit 1
  ),
  country_points as (
    select
      previous_season.id as season_id,
      previous_season.name as season_name,
      rider.country_id,
      sum(greatest(0, coalesce(summary.points, 0)))::bigint as uci_points
    from previous_season
    join public.rider_season_summaries as summary
      on summary.season_id = previous_season.id
      and coalesce(summary.points, 0) > 0
    join public.riders as rider on rider.id = summary.rider_id
    group by previous_season.id, previous_season.name, rider.country_id
  ),
  ranked_points as (
    select
      country_points.*,
      row_number() over (
        order by country_points.uci_points desc, country_points.country_id
      )::bigint as uci_rank
    from country_points
  )
  select
    previous_season.id as season_id,
    previous_season.name as season_name,
    country.id as country_id,
    coalesce(ranked_points.uci_points, 0)::bigint as uci_points,
    ranked_points.uci_rank
  from previous_season
  cross join public.countries as country
  left join ranked_points on ranked_points.country_id = country.id
  where country.is_active
  order by ranked_points.uci_rank nulls last, country.name;
$$;

create or replace function public.copy_youth_native_ability_to_academy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.native_special_ability_code is null then
    select candidate.native_special_ability_code
    into new.native_special_ability_code
    from public.youth_scouting_candidates as candidate
    where candidate.id = new.candidate_id;
  end if;
  return new;
end;
$$;

drop trigger if exists copy_youth_native_ability_to_academy_before_insert
  on public.youth_academy_riders;
create trigger copy_youth_native_ability_to_academy_before_insert
before insert on public.youth_academy_riders
for each row
execute function public.copy_youth_native_ability_to_academy();

create or replace function public.grant_promoted_youth_native_ability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.promoted_rider_id is null
    or new.native_special_ability_code is null
    or new.promoted_rider_id is not distinct from old.promoted_rider_id then
    return new;
  end if;

  insert into public.rider_special_abilities (
    rider_id,
    ability_code,
    source_type,
    source_reference
  ) values (
    new.promoted_rider_id,
    new.native_special_ability_code,
    'academy_native',
    new.id::text
  )
  on conflict (rider_id, ability_code) do nothing;

  return new;
end;
$$;

drop trigger if exists grant_promoted_youth_native_ability_after_update
  on public.youth_academy_riders;
create trigger grant_promoted_youth_native_ability_after_update
after update of promoted_rider_id on public.youth_academy_riders
for each row
execute function public.grant_promoted_youth_native_ability();

revoke all on function public.get_youth_scouting_country_uci_rankings(uuid)
  from public, anon, authenticated;
grant execute on function public.get_youth_scouting_country_uci_rankings(uuid)
  to service_role;

revoke all on function public.copy_youth_native_ability_to_academy()
  from public, anon, authenticated;
revoke all on function public.grant_promoted_youth_native_ability()
  from public, anon, authenticated;

comment on column public.youth_scouting_candidates.native_special_ability_code is
  'Capacité native rare détectée lors de la génération du rapport.';
comment on column public.youth_academy_riders.native_special_ability_code is
  'Capacité native conservée pendant la formation puis transmise au passage professionnel.';
comment on function public.get_youth_scouting_country_uci_rankings(uuid) is
  'Retourne le classement UCI des nations de la saison précédant exactement la saison fournie.';

commit;
