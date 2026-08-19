begin;

-- Geste beta-test demande pour Valitoni : son effectif initial de saison 1 a
-- quitte l'equipe faute de renouvellement. Cette intervention recrée sept
-- nouveaux coureurs norvégiens avec les règles exactes de l'onboarding :
-- profils sportifs initiaux, variation déterministe, potentiel amateur et
-- contrat initial gratuit sur la saison active.
do $$
declare
  v_expected_director_id constant uuid := '58cd307a-1f7f-4680-a519-eb6e7ba5498e';
  v_expected_team_id constant uuid := '7f8aabc9-a95d-4387-b918-e9db63dc13ca';
  v_director_id uuid;
  v_team_id uuid;
  v_team_season_id uuid;
  v_season_id uuid;
  v_norway_country_id uuid;
  v_name_profile_code text;
  v_avatar_profile_key text;
  v_age_offset integer;
  v_rider_id uuid;
  v_created_rider_ids uuid[] := array[]::uuid[];
  v_entry record;
begin
  select
    director.id,
    team.id,
    team_season.id,
    season.id
  into strict
    v_director_id,
    v_team_id,
    v_team_season_id,
    v_season_id
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.teams as team
    on team.id = assignment.team_id
   and team.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = team.id
   and team_season.season_id = season.id
   and team_season.status = 'active'
  where director.id = v_expected_director_id
    and team.id = v_expected_team_id
    and lower(btrim(director.username)) = lower('Valitoni')
    and lower(btrim(team_season.display_name)) = lower('Vamonosss')
    and director.status = 'active'
  for update of director, team, team_season, season;

  if exists (
    select 1
    from public.rider_contracts as contract
    where contract.team_id = v_team_id
      and contract.status in ('active', 'planned')
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Vamonosss possede deja un effectif actif ou planifie.';
  end if;

  select
    country.id,
    profile.name_profile_code,
    profile.avatar_profile_key
  into strict
    v_norway_country_id,
    v_name_profile_code,
    v_avatar_profile_key
  from public.countries as country
  join public.country_rider_generation_profiles as profile
    on profile.country_id = country.id
  where country.iso_alpha2 = 'NO'
    and country.is_active = true
    and profile.name_profile_code = 'nordic';

  v_age_offset := (
    ((hashtextextended(v_director_id::text, 0) % 7) + 7) % 7
  )::integer;

  for v_entry in
    select generated.*
    from (
      values
        (1, 'William', 'Hämäläinen', 8307187161816583::bigint,
          64, 58, 45, 47, 40, 42, 50, 55, 57, 54, 58, 56, 44),
        (2, 'Stig', 'Stefánsson', 9886253372102877::bigint,
          56, 64, 49, 46, 43, 54, 62, 54, 56, 55, 55, 60, 48),
        (3, 'Magnus', 'Lindqvist', 3238574409582149::bigint,
          43, 48, 62, 64, 49, 50, 52, 49, 60, 58, 55, 48, 62),
        (4, 'Ólafur', 'Nyström', 7188309662318316::bigint,
          40, 46, 58, 48, 44, 65, 64, 47, 54, 52, 50, 42, 56),
        (5, 'Casper', 'Mäkelä', 7017038466764941::bigint,
          42, 50, 60, 51, 65, 56, 58, 50, 59, 61, 53, 54, 52),
        (6, 'Henrik', 'Gustafsson', 5190586915249321::bigint,
          52, 57, 55, 52, 50, 50, 54, 56, 61, 59, 56, 65, 50),
        (7, 'Øystein', 'Strand', 1317009797952836::bigint,
          50, 52, 56, 53, 52, 51, 52, 54, 63, 62, 61, 55, 51)
    ) as generated (
      rider_slot,
      first_name,
      last_name,
      avatar_seed,
      mountain,
      hills,
      flat,
      time_trial,
      cobbles,
      sprint,
      acceleration,
      downhill,
      endurance,
      resistance,
      recovery,
      breakaway,
      prologue
    )
    order by generated.rider_slot
  loop
    insert into public.riders (
      country_id,
      first_name,
      last_name,
      status,
      generated_name_profile_code,
      avatar_profile_key,
      avatar_seed
    )
    values (
      v_norway_country_id,
      v_entry.first_name,
      v_entry.last_name,
      'active',
      v_name_profile_code,
      v_avatar_profile_key,
      v_entry.avatar_seed
    )
    returning id into v_rider_id;

    insert into public.rider_contracts (
      rider_id,
      team_id,
      start_season_id,
      end_season_id,
      salary_per_season,
      currency,
      acquisition_type,
      status,
      signed_at
    )
    values (
      v_rider_id,
      v_team_id,
      v_season_id,
      v_season_id,
      0,
      'EUR',
      'initial',
      'active',
      now()
    );

    insert into public.rider_season_ratings (
      rider_id,
      season_id,
      age,
      mountain,
      hills,
      flat,
      time_trial,
      cobbles,
      sprint,
      acceleration,
      downhill,
      endurance,
      resistance,
      recovery,
      breakaway,
      prologue
    )
    values (
      v_rider_id,
      v_season_id,
      18 + ((v_entry.rider_slot - 1 + v_age_offset) % 7),
      v_entry.mountain,
      v_entry.hills,
      v_entry.flat,
      v_entry.time_trial,
      v_entry.cobbles,
      v_entry.sprint,
      v_entry.acceleration,
      v_entry.downhill,
      v_entry.endurance,
      v_entry.resistance,
      v_entry.recovery,
      v_entry.breakaway,
      v_entry.prologue
    );

    -- Même variation que initialize_sporting_director_career_v2.
    update public.rider_season_ratings as rating
    set
      mountain = private.randomize_initial_amateur_rating(
        rating.mountain, v_team_id, rating.rider_id, 'mountain'
      ),
      hills = private.randomize_initial_amateur_rating(
        rating.hills, v_team_id, rating.rider_id, 'hills'
      ),
      flat = private.randomize_initial_amateur_rating(
        rating.flat, v_team_id, rating.rider_id, 'flat'
      ),
      time_trial = private.randomize_initial_amateur_rating(
        rating.time_trial, v_team_id, rating.rider_id, 'time_trial'
      ),
      cobbles = private.randomize_initial_amateur_rating(
        rating.cobbles, v_team_id, rating.rider_id, 'cobbles'
      ),
      sprint = private.randomize_initial_amateur_rating(
        rating.sprint, v_team_id, rating.rider_id, 'sprint'
      ),
      acceleration = private.randomize_initial_amateur_rating(
        rating.acceleration, v_team_id, rating.rider_id, 'acceleration'
      ),
      downhill = private.randomize_initial_amateur_rating(
        rating.downhill, v_team_id, rating.rider_id, 'downhill'
      ),
      endurance = private.randomize_initial_amateur_rating(
        rating.endurance, v_team_id, rating.rider_id, 'endurance'
      ),
      resistance = private.randomize_initial_amateur_rating(
        rating.resistance, v_team_id, rating.rider_id, 'resistance'
      ),
      recovery = private.randomize_initial_amateur_rating(
        rating.recovery, v_team_id, rating.rider_id, 'recovery'
      ),
      breakaway = private.randomize_initial_amateur_rating(
        rating.breakaway, v_team_id, rating.rider_id, 'breakaway'
      ),
      prologue = private.randomize_initial_amateur_rating(
        rating.prologue, v_team_id, rating.rider_id, 'prologue'
      )
    where rating.rider_id = v_rider_id
      and rating.season_id = v_season_id;

    v_created_rider_ids := array_append(v_created_rider_ids, v_rider_id);
  end loop;

  if cardinality(v_created_rider_ids) <> 7
    or cardinality(v_created_rider_ids) <> (
      select count(distinct rider_id)
      from unnest(v_created_rider_ids) as created(rider_id)
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'La regeneration de Vamonosss ne contient pas sept coureurs distincts.';
  end if;

  if (
    select count(*)
    from public.rider_contracts as contract
    where contract.team_id = v_team_id
      and contract.status = 'active'
      and contract.rider_id = any(v_created_rider_ids)
  ) <> 7 then
    raise exception using
      errcode = 'P0001',
      message = 'Les sept contrats actifs de Vamonosss n ont pas ete crees.';
  end if;

  if (
    select count(*)
    from public.riders as rider
    join public.rider_season_ratings as rating
      on rating.rider_id = rider.id
     and rating.season_id = v_season_id
    where rider.id = any(v_created_rider_ids)
      and rider.country_id = v_norway_country_id
      and rider.status = 'active'
      and rider.generated_name_profile_code = 'nordic'
  ) <> 7 then
    raise exception using
      errcode = 'P0001',
      message = 'Les sept profils norvegiens de Vamonosss sont incomplets.';
  end if;
end;
$$;

commit;
