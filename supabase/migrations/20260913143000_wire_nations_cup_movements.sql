-- Freeze every Nations Cup division and group for the season. The standings
-- remain live, while the next assignment is derived once at season rollover.
create table if not exists public.national_federation_nations_cup_assignments (
  country_id uuid not null references public.countries(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  division smallint not null,
  group_code text,
  source_season_id uuid references public.seasons(id) on delete set null,
  source_division smallint,
  movement text not null default 'initial',
  source_overall_rank integer,
  created_at timestamptz not null default now(),
  primary key (country_id, season_id),
  constraint nations_cup_assignment_division_valid
    check (division between 1 and 4),
  constraint nations_cup_assignment_source_division_valid
    check (source_division is null or source_division between 1 and 4),
  constraint nations_cup_assignment_movement_valid
    check (movement in ('initial', 'held', 'promoted', 'relegated')),
  constraint nations_cup_assignment_group_valid check (
    (division = 1 and group_code is null)
    or (division in (2, 3) and group_code in ('A', 'B'))
    or (division = 4 and group_code in ('A', 'B', 'C'))
  )
);

create index if not exists nations_cup_assignments_season_division_group_idx
  on public.national_federation_nations_cup_assignments (
    season_id, division, group_code
  );

alter table public.national_federation_nations_cup_assignments
  enable row level security;
revoke all on table public.national_federation_nations_cup_assignments
  from public, anon, authenticated;
grant select on table public.national_federation_nations_cup_assignments
  to authenticated;
grant all on table public.national_federation_nations_cup_assignments
  to service_role;

-- Preserve the S3 allocation exactly as it appeared before this migration.
insert into public.national_federation_nations_cup_assignments (
  country_id, season_id, division, group_code, movement, source_overall_rank
)
select
  standing.country_id,
  season.id,
  standing.division,
  standing.group_code,
  'initial',
  standing.overall_rank
from public.seasons as season
cross join lateral public.get_national_federation_nations_cup_standings(
  season.id
) as standing
where season.game_year >= 3
on conflict (country_id, season_id) do nothing;

-- Future groups use a balanced snake seeding inside their frozen division.
create or replace function public.get_nations_cup_group_code_for_seed(
  p_division_seed integer,
  p_division integer
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_group_count integer;
  v_row integer;
  v_position integer;
begin
  if p_division = 1 then return null; end if;
  v_group_count := case when p_division = 4 then 3 else 2 end;
  v_row := floor((greatest(1, p_division_seed) - 1)::numeric / v_group_count)::integer;
  v_position := (greatest(1, p_division_seed) - 1) % v_group_count;
  if v_row % 2 = 1 then
    v_position := v_group_count - 1 - v_position;
  end if;
  return chr(ascii('A') + v_position);
end;
$$;

-- The public standings now read the frozen allocation first. The account and
-- UCI fallbacks keep legacy or partially initialized seasons readable.
create or replace function public.get_national_federation_nations_cup_standings(
  p_season_id uuid
)
returns table (
  country_id uuid,
  country_code text,
  country_name text,
  uci_rank integer,
  division integer,
  group_code text,
  points integer,
  wins integer,
  podiums integer,
  events_count integer,
  overall_rank integer,
  division_rank integer,
  group_rank integer
)
language sql
stable
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
  with season_context as (
    select season.game_year
    from public.seasons as season
    where season.id = p_season_id
  ), ranked_uci as (
    select ranked.country_id, ranked.rank
    from (
      select country_points.country_id,
        row_number() over (
          order by country_points.points desc, country_points.country_id
        )::integer as rank
      from (
        select ranking.country_id, sum(ranking.uci_points)::bigint as points
        from public.get_national_championship_country_rankings(p_season_id) as ranking
        group by ranking.country_id
      ) as country_points
    ) as ranked
  ), assignments as (
    select
      country.id as country_id,
      country.iso_alpha2::text as country_code,
      country.name::text as country_name,
      coalesce(account.uci_rank, ranked_uci.rank, 173)::integer as uci_rank,
      coalesce(
        frozen.division,
        account.nations_cup_division,
        case
          when coalesce(ranked_uci.rank, 173) <= 20 then 1
          when coalesce(ranked_uci.rank, 173) <= 60 then 2
          when coalesce(ranked_uci.rank, 173) <= 100 then 3
          else 4
        end
      )::integer as division,
      frozen.group_code as frozen_group_code
    from public.countries as country
    cross join season_context
    left join ranked_uci on ranked_uci.country_id = country.id
    left join public.national_federation_accounts as account
      on account.country_id = country.id
     and account.season_id = p_season_id
    left join public.national_federation_nations_cup_assignments as frozen
      on frozen.country_id = country.id
     and frozen.season_id = p_season_id
    where country.is_active = true
  ), scored_results as (
    select
      rider.country_id,
      count(*)::integer as events_count,
      count(*) filter (where result.final_rank = 1)::integer as wins,
      count(*) filter (where result.final_rank <= 3)::integer as podiums,
      coalesce(sum(case result.final_rank
        when 1 then 50 when 2 then 40 when 3 then 32 when 4 then 26
        when 5 then 22 when 6 then 18 when 7 then 15 when 8 then 12
        when 9 then 10 when 10 then 8 when 11 then 6 when 12 then 5
        when 13 then 4 when 14 then 3 when 15 then 2 when 16 then 1
        else 0 end), 0)::integer as points,
      sum(result.final_rank)::integer as rank_sum
    from public.race_results as result
    join public.race_editions as edition
      on edition.id = result.race_edition_id
     and edition.season_id = p_season_id
    join public.races as race
      on race.id = edition.race_id
     and race.competition_type = 'nations_cup'
    join public.race_rosters as roster on roster.id = result.race_roster_id
    join public.riders as rider on rider.id = roster.rider_id
    where result.status = 'classified'
    group by rider.country_id
  ), scored as (
    select
      assignments.country_id,
      assignments.country_code,
      assignments.country_name,
      assignments.uci_rank,
      assignments.division,
      coalesce(
        assignments.frozen_group_code,
        public.get_nations_cup_group_code(
          assignments.uci_rank,
          assignments.division
        )
      ) as group_code,
      coalesce(scored_results.points, 0)::integer as points,
      coalesce(scored_results.wins, 0)::integer as wins,
      coalesce(scored_results.podiums, 0)::integer as podiums,
      coalesce(scored_results.events_count, 0)::integer as events_count,
      coalesce(scored_results.rank_sum, 9999)::integer as rank_sum
    from assignments
    left join scored_results on scored_results.country_id = assignments.country_id
  )
  select
    scored.country_id,
    scored.country_code,
    scored.country_name,
    scored.uci_rank,
    scored.division,
    scored.group_code,
    scored.points,
    scored.wins,
    scored.podiums,
    scored.events_count,
    row_number() over (
      order by scored.points desc, scored.wins desc, scored.podiums desc,
        scored.rank_sum, scored.uci_rank, scored.country_id
    )::integer as overall_rank,
    row_number() over (
      partition by scored.division
      order by scored.points desc, scored.wins desc, scored.podiums desc,
        scored.rank_sum, scored.uci_rank, scored.country_id
    )::integer as division_rank,
    row_number() over (
      partition by scored.division, scored.group_code
      order by scored.points desc, scored.wins desc, scored.podiums desc,
        scored.rank_sum, scored.uci_rank, scored.country_id
    )::integer as group_rank
  from scored
$$;

-- One source of truth for the visible zones and the rollover itself.
create or replace function public.get_nations_cup_projected_division(
  p_division integer,
  p_division_rank integer,
  p_division_size integer,
  p_group_rank integer,
  p_group_size integer
)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case
    when p_division = 1
      and p_division_size > 4
      and p_division_rank > p_division_size - 4 then 2
    when p_division = 2 and p_group_rank <= 2 then 1
    when p_division = 2
      and p_group_size > 4
      and p_group_rank > p_group_size - 2 then 3
    when p_division = 3 and p_group_rank <= 2 then 2
    when p_division = 3
      and p_group_size > 5
      and p_group_rank > p_group_size - 3 then 4
    when p_division = 4 and p_group_rank <= 2 then 3
    else p_division
  end::smallint
$$;

create or replace function public.get_national_federation_nations_cup_movement_projection(
  p_season_id uuid
)
returns table (
  country_id uuid,
  country_code text,
  country_name text,
  uci_rank integer,
  division integer,
  group_code text,
  points integer,
  wins integer,
  podiums integer,
  events_count integer,
  overall_rank integer,
  division_rank integer,
  group_rank integer,
  projected_division integer,
  movement_zone text
)
language sql
stable
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
  with sized as (
    select
      standing.*,
      count(*) over (partition by standing.division)::integer as division_size,
      count(*) over (
        partition by standing.division, standing.group_code
      )::integer as group_size
    from public.get_national_federation_nations_cup_standings(
      p_season_id
    ) as standing
  ), projected as (
    select
      sized.*,
      public.get_nations_cup_projected_division(
        sized.division,
        sized.division_rank,
        sized.division_size,
        sized.group_rank,
        sized.group_size
      )::integer as projected_division
    from sized
  )
  select
    projected.country_id,
    projected.country_code,
    projected.country_name,
    projected.uci_rank,
    projected.division,
    projected.group_code,
    projected.points,
    projected.wins,
    projected.podiums,
    projected.events_count,
    projected.overall_rank,
    projected.division_rank,
    projected.group_rank,
    projected.projected_division,
    case
      when projected.projected_division < projected.division then 'promotion'
      when projected.projected_division > projected.division then 'relegation'
      else 'safe'
    end::text as movement_zone
  from projected
  order by projected.overall_rank
$$;

create or replace function public.seed_nations_cup_assignments_for_season(
  p_target_season_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_target public.seasons%rowtype;
  v_source public.seasons%rowtype;
  v_expected_events integer := 0;
  v_completed_events integer := 0;
  v_inserted integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'nations-cup-assignment:' || p_target_season_id::text,
      0
    )
  );

  select season.* into v_target
  from public.seasons as season
  where season.id = p_target_season_id;
  if v_target.id is null or v_target.game_year < 3 then return 0; end if;

  -- Season opening creates several federation accounts in the same batch.
  -- Once every active nation is frozen, subsequent account triggers can reuse
  -- the assignment without recalculating the complete standings each time.
  if not exists (
    select 1
    from public.countries as country
    where country.is_active = true
      and not exists (
        select 1
        from public.national_federation_nations_cup_assignments as assignment
        where assignment.country_id = country.id
          and assignment.season_id = v_target.id
      )
  ) then
    update public.national_federation_accounts as account
    set nations_cup_division = assignment.division
    from public.national_federation_nations_cup_assignments as assignment
    where assignment.season_id = v_target.id
      and account.season_id = assignment.season_id
      and account.country_id = assignment.country_id
      and account.nations_cup_division is distinct from assignment.division;
    return 0;
  end if;

  select season.* into v_source
  from public.seasons as season
  where season.game_year = v_target.game_year - 1
  limit 1;

  if v_source.id is not null then
    select
      count(distinct edition.id)::integer,
      count(distinct edition.id) filter (
        where edition.status = 'completed'
      )::integer
    into v_expected_events, v_completed_events
    from public.races as race
    join public.race_editions as edition
      on edition.race_id = race.id
     and edition.season_id = v_source.id
    where race.competition_type = 'nations_cup'
      and race.status = 'active';
  end if;

  if v_source.id is not null
     and v_target.game_year >= 4
     and v_expected_events >= 5
     and v_completed_events = v_expected_events then
    with projected as (
      select projection.*
      from public.get_national_federation_nations_cup_movement_projection(
        v_source.id
      ) as projection
    ), seeded as (
      select
        projected.*,
        row_number() over (
          partition by projected.projected_division
          order by projected.overall_rank, projected.uci_rank,
            projected.country_id
        )::integer as division_seed
      from projected
    )
    insert into public.national_federation_nations_cup_assignments (
      country_id, season_id, division, group_code, source_season_id,
      source_division, movement, source_overall_rank
    )
    select
      seeded.country_id,
      v_target.id,
      seeded.projected_division,
      public.get_nations_cup_group_code_for_seed(
        seeded.division_seed,
        seeded.projected_division
      ),
      v_source.id,
      seeded.division,
      case seeded.movement_zone
        when 'promotion' then 'promoted'
        when 'relegation' then 'relegated'
        else 'held'
      end,
      seeded.overall_rank
    from seeded
    on conflict (country_id, season_id) do nothing;
    get diagnostics v_inserted = row_count;
  elsif v_source.id is not null and v_target.game_year >= 4 then
    -- A forced rollover with an incomplete Nations Cup never invents moves.
    insert into public.national_federation_nations_cup_assignments (
      country_id, season_id, division, group_code, source_season_id,
      source_division, movement, source_overall_rank
    )
    select
      standing.country_id,
      v_target.id,
      standing.division,
      standing.group_code,
      v_source.id,
      standing.division,
      'held',
      standing.overall_rank
    from public.get_national_federation_nations_cup_standings(
      v_source.id
    ) as standing
    on conflict (country_id, season_id) do nothing;
    get diagnostics v_inserted = row_count;
  else
    insert into public.national_federation_nations_cup_assignments (
      country_id, season_id, division, group_code, movement,
      source_overall_rank
    )
    select
      standing.country_id,
      v_target.id,
      standing.division,
      standing.group_code,
      'initial',
      standing.overall_rank
    from public.get_national_federation_nations_cup_standings(
      v_target.id
    ) as standing
    on conflict (country_id, season_id) do nothing;
    get diagnostics v_inserted = row_count;
  end if;

  update public.national_federation_accounts as account
  set nations_cup_division = assignment.division
  from public.national_federation_nations_cup_assignments as assignment
  where assignment.season_id = v_target.id
    and account.season_id = assignment.season_id
    and account.country_id = assignment.country_id
    and account.nations_cup_division is distinct from assignment.division;

  return v_inserted;
end;
$$;

create or replace function public.seed_nations_cup_assignments_on_activation()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if new.status = 'active'
     and old.status is distinct from 'active'
     and new.game_year >= 3 then
    perform public.seed_nations_cup_assignments_for_season(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists seed_nations_cup_assignments_on_activation
  on public.seasons;
create trigger seed_nations_cup_assignments_on_activation
after update of status on public.seasons
for each row execute function public.seed_nations_cup_assignments_on_activation();

create or replace function public.apply_nations_cup_assignment_to_account()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_division smallint;
begin
  perform public.seed_nations_cup_assignments_for_season(new.season_id);
  select assignment.division into v_division
  from public.national_federation_nations_cup_assignments as assignment
  where assignment.country_id = new.country_id
    and assignment.season_id = new.season_id;
  if v_division is not null then
    new.nations_cup_division := v_division;
  end if;
  return new;
end;
$$;

drop trigger if exists apply_nations_cup_assignment_to_account
  on public.national_federation_accounts;
create trigger apply_nations_cup_assignment_to_account
before insert on public.national_federation_accounts
for each row execute function public.apply_nations_cup_assignment_to_account();

-- Use the moved division before calculating the opening grant, not merely on
-- the persisted account row.
do $account_initializer_patch$
declare
  v_definition text;
  v_anchor text := $anchor$    v_average_starters := case$anchor$;
  v_replacement text := $replacement$    perform public.seed_nations_cup_assignments_for_season(v_season.id);
    select assignment.division into v_division
    from public.national_federation_nations_cup_assignments as assignment
    where assignment.country_id = v_country.id
      and assignment.season_id = v_season.id;

    v_average_starters := case$replacement$;
begin
  select replace(
    pg_get_functiondef(
      'public.initialize_due_national_federation_accounts()'::regprocedure
    ),
    chr(13),
    ''
  ) into v_definition;
  if position(v_anchor in v_definition) = 0 then
    raise exception 'Federation account division anchor missing.';
  end if;
  v_definition := replace(v_definition, v_anchor, v_replacement);
  execute v_definition;
end;
$account_initializer_patch$;

-- Serialize all selections of one nation and season before checking the
-- cross-event Nations Cup uniqueness rule.
do $lock_patch$
declare
  v_definition text;
  v_check_anchor text := $anchor$if v_slot.competition_code = 'nations_cup' and exists$anchor$;
  v_new_lock text := $new$
  -- This nation-wide lock must be acquired before reading the other slots.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'federation-selection:' || v_identity.country_id::text || ':' || v_season.id::text,
      0
    )
  );

$new$;
begin
  select replace(
    pg_get_functiondef(
      'public.save_national_federation_preselection(text,text,uuid[])'::regprocedure
    ),
    chr(13),
    ''
  ) into v_definition;
  if position(v_check_anchor in v_definition) = 0 then
    raise exception 'Nations Cup selection lock anchor missing.';
  end if;
  v_definition := replace(
    v_definition,
    v_check_anchor,
    v_new_lock || v_check_anchor
  );
  execute v_definition;
end;
$lock_patch$;

revoke all on function public.get_nations_cup_group_code_for_seed(integer, integer)
  from public, anon, authenticated;
revoke all on function public.get_nations_cup_projected_division(integer, integer, integer, integer, integer)
  from public, anon, authenticated;
revoke all on function public.get_national_federation_nations_cup_movement_projection(uuid)
  from public, anon;
revoke all on function public.seed_nations_cup_assignments_for_season(uuid)
  from public, anon, authenticated;
revoke all on function public.seed_nations_cup_assignments_on_activation()
  from public, anon, authenticated;
revoke all on function public.apply_nations_cup_assignment_to_account()
  from public, anon, authenticated;

grant execute on function public.get_national_federation_nations_cup_movement_projection(uuid)
  to authenticated, service_role;
grant execute on function public.seed_nations_cup_assignments_for_season(uuid)
  to service_role;

select public.seed_nations_cup_assignments_for_season(season.id)
from public.seasons as season
where season.status = 'active' and season.game_year >= 3;

comment on table public.national_federation_nations_cup_assignments is
  'Division et groupe Nations Cup figés par saison, avec provenance du mouvement annuel.';
comment on function public.get_nations_cup_projected_division(integer, integer, integer, integer, integer) is
  'Applique le barème officiel de montée et descente par division et groupe.';
comment on function public.seed_nations_cup_assignments_for_season(uuid) is
  'Fige les divisions de la nouvelle saison depuis le classement cumulé des cinq épreuves achevées.';

notify pgrst, 'reload schema';
