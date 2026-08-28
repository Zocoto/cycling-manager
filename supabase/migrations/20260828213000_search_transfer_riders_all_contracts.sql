begin;

create or replace function public.search_transfer_riders(
  p_season_id uuid,
  p_contract_status text default 'all',
  p_country_code text default null,
  p_minimum_age integer default null,
  p_maximum_age integer default null,
  p_rating text default null,
  p_minimum_rating numeric default null,
  p_profile text default null,
  p_team_id uuid default null,
  p_limit integer default 48,
  p_offset integer default 0
)
returns table (
  rider_id uuid,
  team_id uuid,
  team_name text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with settings as (
    select coalesce((
      select infrastructure.level
      from public.team_infrastructures as infrastructure
      where infrastructure.team_id = p_team_id
        and infrastructure.infrastructure_code = 'recruitment_data_room'
      limit 1
    ), 0) as data_room_level
  ),
  candidates as (
    select
      rider.id as rider_id,
      contract.team_id,
      team_season.display_name as team_name,
      rider.first_name,
      rider.last_name,
      rating.mountain,
      rating.hills,
      rating.flat,
      rating.time_trial,
      rating.cobbles,
      rating.sprint,
      rating.acceleration,
      rating.downhill,
      rating.endurance,
      rating.resistance,
      rating.recovery,
      rating.breakaway,
      rating.prologue,
      round((
        rating.mountain + rating.hills + rating.flat + rating.time_trial +
        rating.cobbles + rating.sprint + rating.acceleration + rating.downhill +
        rating.endurance + rating.resistance + rating.recovery +
        rating.breakaway + rating.prologue
      )::numeric / 13, 1) as overall,
      case p_rating
        when 'mountain' then rating.mountain
        when 'hills' then rating.hills
        when 'flat' then rating.flat
        when 'timeTrial' then rating.time_trial
        when 'cobbles' then rating.cobbles
        when 'sprint' then rating.sprint
        when 'acceleration' then rating.acceleration
        when 'downhill' then rating.downhill
        when 'endurance' then rating.endurance
        when 'resistance' then rating.resistance
        when 'recovery' then rating.recovery
        when 'breakaway' then rating.breakaway
        when 'prologue' then rating.prologue
        else round((
          rating.mountain + rating.hills + rating.flat + rating.time_trial +
          rating.cobbles + rating.sprint + rating.acceleration + rating.downhill +
          rating.endurance + rating.resistance + rating.recovery +
          rating.breakaway + rating.prologue
        )::numeric / 13, 1)
      end as selected_rating,
      profile.labels as profile_labels,
      profile.scores as profile_scores,
      settings.data_room_level
    from public.rider_season_ratings as rating
    join public.riders as rider
      on rider.id = rating.rider_id
    join public.countries as country
      on country.id = rider.country_id
    left join public.rider_contracts as contract
      on contract.rider_id = rider.id
     and contract.status = 'active'
    left join public.team_seasons as team_season
      on team_season.team_id = contract.team_id
     and team_season.season_id = p_season_id
    cross join lateral (
      select
        coalesce(
          array_agg(candidate.label order by candidate.score desc, candidate.priority),
          '{}'::text[]
        ) as labels,
        coalesce(
          array_agg(candidate.score order by candidate.score desc, candidate.priority),
          '{}'::numeric[]
        ) as scores
      from (
        values
          (
            'Coureur de tour'::text,
            rating.mountain >= 62 and rating.time_trial >= 62,
            (rating.mountain + rating.time_trial)::numeric / 2,
            1
          ),
          (
            'Grimpeur'::text,
            not (rating.mountain >= 62 and rating.time_trial >= 62)
              and rating.mountain >= 62,
            rating.mountain::numeric,
            2
          ),
          (
            'Rouleur'::text,
            not (rating.mountain >= 62 and rating.time_trial >= 62)
              and rating.time_trial >= 62,
            rating.time_trial::numeric,
            3
          ),
          ('Puncheur'::text, rating.hills >= 62, rating.hills::numeric, 4),
          ('Sprinteur'::text, rating.sprint >= 62, rating.sprint::numeric, 5),
          ('Coureur de pavés'::text, rating.cobbles >= 62, rating.cobbles::numeric, 6),
          ('Baroudeur'::text, rating.breakaway >= 62, rating.breakaway::numeric, 7)
      ) as candidate(label, qualifies, score, priority)
      where candidate.qualifies
    ) as profile
    cross join settings
    where rating.season_id = p_season_id
      and country.is_active
      and (
        (
          p_contract_status in ('all', 'free')
          and rider.status = 'free_agent'
          and contract.id is null
          and not exists (
            select 1
            from public.transfer_market_listings as listing
            where listing.rider_id = rider.id
              and listing.status = 'open'
          )
        )
        or (
          p_contract_status in ('all', 'contracted')
          and rider.status = 'active'
          and contract.id is not null
        )
      )
      and (p_country_code is null or country.iso_alpha2 = upper(p_country_code))
      and (p_minimum_age is null or rating.age >= p_minimum_age)
      and (p_maximum_age is null or rating.age <= p_maximum_age)
  ),
  scouted as (
    select
      candidate.*,
      public.transfer_scouting_maximum(
        candidate.rider_id,
        p_season_id,
        p_rating,
        candidate.selected_rating,
        candidate.data_room_level
      ) as selected_scouting_maximum,
      public.transfer_scouting_maximum(
        candidate.rider_id,
        p_season_id,
        'overall',
        candidate.overall,
        candidate.data_room_level
      ) as overall_scouting_maximum
    from candidates as candidate
  ),
  filtered as (
    select candidate.*
    from scouted as candidate
    where (
      p_minimum_rating is null
      or candidate.selected_scouting_maximum >= p_minimum_rating
    )
      and (
        p_profile is null
        or (
          p_profile = 'Coureur équilibré'
          and cardinality(candidate.profile_labels) = 0
        )
        or (
          p_profile <> 'Coureur équilibré'
          and (
            candidate.profile_labels[1] = p_profile
            or (
              candidate.profile_labels[2] = p_profile
              and candidate.profile_scores[1] - candidate.profile_scores[2] <= 4
            )
          )
        )
      )
  )
  select
    filtered.rider_id,
    filtered.team_id,
    filtered.team_name,
    count(*) over () as total_count
  from filtered
  order by
    filtered.overall_scouting_maximum desc,
    filtered.last_name,
    filtered.first_name,
    filtered.rider_id
  limit least(greatest(coalesce(p_limit, 48), 1), 60)
  offset least(greatest(coalesce(p_offset, 0), 0), 6000);
$$;

comment on function public.search_transfer_riders(
  uuid, text, text, integer, integer, text, numeric, text, uuid, integer, integer
) is
  'Recherche serveur paginée de tous les coureurs, libres ou sous contrat, pour le Bureau des transferts.';

commit;
