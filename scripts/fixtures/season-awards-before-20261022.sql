-- Audited existing award functions. Schema/code only; no production player data.
CREATE OR REPLACE FUNCTION private.create_core_season_awards_before_expansion(p_season_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_season record;
  v_created integer := 0;
  v_rows integer := 0;
begin
  select id, name, game_year, status into v_season
  from public.seasons where id = p_season_id;
  if not found or (
    v_season.status <> 'completed'
    and not (
      v_season.status = 'active'
      and exists (
        select 1
        from public.seasons as final_day_season
        where final_day_season.id = p_season_id
          and final_day_season.current_day_number = 28
      )
      and exists (
        select 1
        from public.stages as final_stage
        join public.race_editions as final_edition
          on final_edition.id = final_stage.race_edition_id
        where final_edition.season_id = p_season_id
      )
      and not exists (
        select 1
        from public.stages as pending_stage
        join public.race_editions as pending_edition
          on pending_edition.id = pending_stage.race_edition_id
        where pending_edition.season_id = p_season_id
          and pending_stage.status not in ('completed', 'cancelled')
      )
      and not exists (
        select 1
        from public.race_editions as pending_edition
        where pending_edition.season_id = p_season_id
          and pending_edition.status not in ('completed', 'cancelled')
      )
    )
  ) then
    return 0;
  end if;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    rider_id, team_id, recipient_name, team_name, stat_value, stat_label
  )
  select p_season_id, 'rider_of_year', 'Coureur de l’année',
    'La référence du peloton au classement individuel de la saison.', 'rider',
    summary.rider_id, rider_team.team_id,
    btrim(rider.first_name || ' ' || rider.last_name), rider_team.team_name,
    coalesce(summary.points, 0), 'points UCI'
  from public.rider_season_summaries as summary
  join public.riders as rider on rider.id = summary.rider_id
  left join lateral (
    select team_season.team_id, team_season.display_name as team_name
    from public.race_results as result
    join public.race_rosters as roster on roster.id = result.race_roster_id
    join public.race_registrations as registration on registration.id = roster.race_registration_id
    join public.team_seasons as team_season on team_season.id = registration.team_season_id
    where roster.rider_id = summary.rider_id
      and result.status = 'classified'
      and team_season.season_id = p_season_id
    group by team_season.team_id, team_season.display_name
    order by count(*) desc, team_season.display_name
    limit 1
  ) as rider_team on true
  where summary.season_id = p_season_id
  order by coalesce(summary.points, 0) desc, summary.uci_rank nulls last,
    rider.last_name, rider.first_name, rider.id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    team_id, recipient_name, team_name, stat_value, stat_label
  )
  select p_season_id, 'team_of_year', 'Équipe de l’année',
    'Le collectif qui termine la saison au sommet du classement UCI.', 'team',
    team_season.team_id, team_season.display_name, team_season.display_name,
    team_season.points, 'points UCI'
  from public.team_seasons as team_season
  where team_season.season_id = p_season_id
    and team_season.status <> 'withdrawn'
  order by team_season.final_rank nulls last, team_season.points desc,
    team_season.display_name, team_season.id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    rider_id, team_id, recipient_name, team_name, stat_value, stat_label
  )
  select p_season_id, 'serial_winner', 'Chasseur de bouquets',
    'Le coureur qui a levé les bras le plus souvent cette saison.', 'rider',
    summary.rider_id, rider_team.team_id,
    btrim(rider.first_name || ' ' || rider.last_name), rider_team.team_name,
    coalesce(summary.victories, 0), 'victoires'
  from public.rider_season_summaries as summary
  join public.riders as rider on rider.id = summary.rider_id
  left join lateral (
    select team_season.team_id, team_season.display_name as team_name
    from public.race_results as result
    join public.race_rosters as roster on roster.id = result.race_roster_id
    join public.race_registrations as registration on registration.id = roster.race_registration_id
    join public.team_seasons as team_season on team_season.id = registration.team_season_id
    where roster.rider_id = summary.rider_id
      and team_season.season_id = p_season_id
    group by team_season.team_id, team_season.display_name
    order by count(*) desc, team_season.display_name
    limit 1
  ) as rider_team on true
  where summary.season_id = p_season_id and coalesce(summary.victories, 0) > 0
  order by coalesce(summary.victories, 0) desc, coalesce(summary.points, 0) desc,
    rider.last_name, rider.first_name, rider.id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    rider_id, team_id, recipient_name, team_name, stat_value, stat_label
  )
  select p_season_id, 'young_rider', 'Révélation de l’année',
    'Le meilleur coureur de 23 ans ou moins au classement individuel.', 'rider',
    summary.rider_id, rider_team.team_id,
    btrim(rider.first_name || ' ' || rider.last_name), rider_team.team_name,
    coalesce(summary.points, 0), 'points UCI'
  from public.rider_season_summaries as summary
  join public.rider_season_ratings as rating
    on rating.rider_id = summary.rider_id and rating.season_id = summary.season_id
  join public.riders as rider on rider.id = summary.rider_id
  left join lateral (
    select team_season.team_id, team_season.display_name as team_name
    from public.race_results as result
    join public.race_rosters as roster on roster.id = result.race_roster_id
    join public.race_registrations as registration on registration.id = roster.race_registration_id
    join public.team_seasons as team_season on team_season.id = registration.team_season_id
    where roster.rider_id = summary.rider_id
      and team_season.season_id = p_season_id
    group by team_season.team_id, team_season.display_name
    order by count(*) desc, team_season.display_name
    limit 1
  ) as rider_team on true
  where summary.season_id = p_season_id and rating.age <= 23
  order by coalesce(summary.points, 0) desc, summary.uci_rank nulls last,
    rider.last_name, rider.first_name, rider.id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    team_id, sporting_director_id, recipient_name, team_name, stat_value, stat_label
  )
  select p_season_id, 'director_of_year', 'Directeur Sportif de l’année',
    'Le DS du collectif numéro un au terme de la saison.', 'director',
    team_season.team_id, assignment.sporting_director_id,
    director.display_name, team_season.display_name,
    team_season.points, 'points équipe'
  from public.team_seasons as team_season
  join public.seasons as award_season on award_season.id = team_season.season_id
  join public.team_manager_assignments as assignment on assignment.team_id = team_season.team_id
    and assignment.role = 'general_manager'
  join public.seasons as start_season on start_season.id = assignment.start_season_id
  left join public.seasons as end_season on end_season.id = assignment.end_season_id
  join public.sporting_directors as director on director.id = assignment.sporting_director_id
  where team_season.season_id = p_season_id
    and team_season.status <> 'withdrawn'
    and award_season.game_year >= start_season.game_year
    and (end_season.game_year is null or award_season.game_year <= end_season.game_year)
    and not exists (
      select 1 from public.alpha_bot_managers as bot
      where bot.sporting_director_id = assignment.sporting_director_id
    )
  order by team_season.final_rank nulls last, team_season.points desc,
    team_season.display_name, assignment.created_at desc
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  return v_created;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.season_award_team_director(p_team_id uuid, p_season_id uuid)
 RETURNS TABLE(sporting_director_id uuid, director_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select assignment.sporting_director_id, director.display_name
  from public.team_manager_assignments as assignment
  join public.seasons as award_season
    on award_season.id = p_season_id
  join public.seasons as start_season
    on start_season.id = assignment.start_season_id
  left join public.seasons as end_season
    on end_season.id = assignment.end_season_id
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
  where assignment.team_id = p_team_id
    and assignment.role = 'general_manager'
    and award_season.game_year >= start_season.game_year
    and (
      end_season.game_year is null
      or award_season.game_year <= end_season.game_year
    )
    and not exists (
      select 1
      from public.alpha_bot_managers as bot
      where bot.sporting_director_id = assignment.sporting_director_id
    )
  order by assignment.created_at desc, assignment.id desc
  limit 1;
$function$
;
CREATE OR REPLACE FUNCTION private.create_season_awards_for_season(p_season_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_season record;
  v_created integer := 0;
  v_rows integer := 0;
begin
  v_created := private.create_core_season_awards_before_expansion(p_season_id);

  select id, name, game_year, status, starts_on, ends_on
  into v_season
  from public.seasons
  where id = p_season_id;

  if not found or v_season.status <> 'completed' then
    return v_created;
  end if;

  -- La Béquille : somme des jours prescrits par blessure, sans compter deux
  -- fois une même blessure lorsqu'elle apparaît dans les résultats d'étape et
  -- le classement final de la course.
  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    rider_id, team_id, recipient_name, team_name, stat_value, stat_label
  )
  with injury_entries as (
    select distinct on (injury.id)
      injury.id,
      injury.rider_id,
      injury.recovery_days,
      team_season.team_id,
      team_season.display_name as team_name
    from public.rider_injuries as injury
    join public.stages as source_stage
      on source_stage.id = injury.source_stage_id
    join public.race_editions as edition
      on edition.id = source_stage.race_edition_id
     and edition.season_id = p_season_id
    join lateral (
      select stage_result.race_roster_id
      from public.stage_results as stage_result
      where stage_result.injury_id = injury.id
      union all
      select race_result.race_roster_id
      from public.race_results as race_result
      where race_result.injury_id = injury.id
      limit 1
    ) as injury_result on true
    join public.race_rosters as roster
      on roster.id = injury_result.race_roster_id
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    join public.team_seasons as team_season
      on team_season.id = registration.team_season_id
     and team_season.season_id = p_season_id
    order by injury.id, team_season.id
  ), rider_totals as (
    select rider_id, sum(recovery_days)::integer as recovery_days,
      count(*)::integer as injury_count
    from injury_entries
    group by rider_id
  )
  select p_season_id, 'injury_rider', 'La Béquille',
    'Le coureur qui a cumulé le plus de jours d’arrêt sur blessure.', 'rider',
    total.rider_id, main_team.team_id,
    btrim(rider.first_name || ' ' || rider.last_name), main_team.team_name,
    total.recovery_days, 'jours d’arrêt'
  from rider_totals as total
  join public.riders as rider on rider.id = total.rider_id
  join lateral (
    select entry.team_id, entry.team_name
    from injury_entries as entry
    where entry.rider_id = total.rider_id
    group by entry.team_id, entry.team_name
    order by sum(entry.recovery_days) desc, entry.team_name, entry.team_id
    limit 1
  ) as main_team on true
  where total.recovery_days > 0
  order by total.recovery_days desc, total.injury_count desc,
    rider.last_name, rider.first_name, rider.id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  -- L'Infirmerie pleine : nombre de coureurs distincts blessés par équipe.
  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    team_id, sporting_director_id, recipient_name, team_name,
    stat_value, stat_label
  )
  with injury_entries as (
    select distinct on (injury.id)
      injury.id, injury.rider_id, injury.recovery_days,
      team_season.team_id, team_season.display_name as team_name
    from public.rider_injuries as injury
    join public.stages as source_stage on source_stage.id = injury.source_stage_id
    join public.race_editions as edition
      on edition.id = source_stage.race_edition_id
     and edition.season_id = p_season_id
    join lateral (
      select stage_result.race_roster_id
      from public.stage_results as stage_result
      where stage_result.injury_id = injury.id
      union all
      select race_result.race_roster_id
      from public.race_results as race_result
      where race_result.injury_id = injury.id
      limit 1
    ) as injury_result on true
    join public.race_rosters as roster on roster.id = injury_result.race_roster_id
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    join public.team_seasons as team_season
      on team_season.id = registration.team_season_id
     and team_season.season_id = p_season_id
    order by injury.id, team_season.id
  ), team_totals as (
    select team_id, team_name,
      count(distinct rider_id)::integer as injured_riders,
      count(*)::integer as injury_count,
      sum(recovery_days)::integer as recovery_days
    from injury_entries
    group by team_id, team_name
  )
  select p_season_id, 'injury_director', 'L’Infirmerie pleine',
    'Le DS dont l’équipe a compté le plus de coureurs blessés distincts.',
    'director', total.team_id, manager.sporting_director_id,
    manager.director_name, total.team_name, total.injured_riders,
    'coureurs blessés'
  from team_totals as total
  join lateral private.season_award_team_director(total.team_id, p_season_id)
    as manager on true
  where total.injured_riders > 0
  order by total.injured_riders desc, total.injury_count desc,
    total.recovery_days desc, total.team_name, total.team_id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  -- Lanternes rouges sur les classements finaux des courses, pas sur chaque
  -- étape d'un tour : une course ne peut donc compter qu'une fois par coureur.
  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    rider_id, team_id, recipient_name, team_name, stat_value, stat_label
  )
  with classified as (
    select result.race_roster_id, roster.rider_id, team_season.team_id,
      team_season.display_name as team_name, result.final_rank,
      max(result.final_rank) over (partition by result.race_edition_id) as last_rank
    from public.race_results as result
    join public.race_editions as edition
      on edition.id = result.race_edition_id
     and edition.season_id = p_season_id
    join public.race_rosters as roster on roster.id = result.race_roster_id
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    join public.team_seasons as team_season
      on team_season.id = registration.team_season_id
     and team_season.season_id = p_season_id
    where result.status = 'classified'
      and result.final_rank is not null
  ), last_finishes as (
    select * from classified where final_rank = last_rank
  ), rider_totals as (
    select rider_id, count(*)::integer as last_finishes
    from last_finishes group by rider_id
  )
  select p_season_id, 'red_lantern_rider', 'La Lanterne rouge',
    'Le coureur classé dernier le plus souvent sur les courses de la saison.',
    'rider', total.rider_id, main_team.team_id,
    btrim(rider.first_name || ' ' || rider.last_name), main_team.team_name,
    total.last_finishes, 'dernières places'
  from rider_totals as total
  join public.riders as rider on rider.id = total.rider_id
  join lateral (
    select finish.team_id, finish.team_name
    from last_finishes as finish
    where finish.rider_id = total.rider_id
    group by finish.team_id, finish.team_name
    order by count(*) desc, finish.team_name, finish.team_id
    limit 1
  ) as main_team on true
  where total.last_finishes > 0
  order by total.last_finishes desc, rider.last_name, rider.first_name, rider.id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    team_id, sporting_director_id, recipient_name, team_name,
    stat_value, stat_label
  )
  with classified as (
    select team_season.team_id, team_season.display_name as team_name,
      result.final_rank,
      max(result.final_rank) over (partition by result.race_edition_id) as last_rank
    from public.race_results as result
    join public.race_editions as edition
      on edition.id = result.race_edition_id
     and edition.season_id = p_season_id
    join public.race_rosters as roster on roster.id = result.race_roster_id
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    join public.team_seasons as team_season
      on team_season.id = registration.team_season_id
     and team_season.season_id = p_season_id
    where result.status = 'classified' and result.final_rank is not null
  ), team_totals as (
    select team_id, team_name, count(*)::integer as last_finishes
    from classified
    where final_rank = last_rank
    group by team_id, team_name
  )
  select p_season_id, 'red_lantern_director', 'Le Porte-lanternes',
    'Le DS dont les coureurs ont cumulé le plus de dernières places.',
    'director', total.team_id, manager.sporting_director_id,
    manager.director_name, total.team_name, total.last_finishes,
    'dernières places'
  from team_totals as total
  join lateral private.season_award_team_director(total.team_id, p_season_id)
    as manager on true
  where total.last_finishes > 0
  order by total.last_finishes desc, total.team_name, total.team_id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    team_id, sporting_director_id, recipient_name, team_name,
    stat_value, stat_label
  )
  select p_season_id, 'negotiator', 'Le Négociateur',
    'Le DS qui a adressé le plus d’offres directes à ses homologues.',
    'director', offer.buyer_team_id, director.id, director.display_name,
    team_season.display_name, count(*)::integer, 'offres envoyées'
  from public.direct_transfer_offers as offer
  join public.sporting_directors as director
    on director.id = offer.submitted_by_director_id
  join public.team_seasons as team_season
    on team_season.team_id = offer.buyer_team_id
   and team_season.season_id = p_season_id
  where offer.season_id = p_season_id
    and not exists (
      select 1 from public.alpha_bot_managers as bot
      where bot.sporting_director_id = director.id
    )
  group by offer.buyer_team_id, director.id, director.display_name,
    team_season.display_name
  order by count(*) desc, director.display_name, director.id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    team_id, sporting_director_id, recipient_name, team_name,
    stat_value, stat_label
  )
  select p_season_id, 'sudoku_master', 'Le Maître des cases',
    'Le DS qui a résolu le plus de Sudokus de La Cyclogazette.', 'director',
    team_season.team_id, director.id, director.display_name,
    team_season.display_name, count(*)::integer, 'Sudokus réussis'
  from public.cyclogazette_game_completions as completion
  join public.cyclogazette_editions as edition
    on edition.id = completion.edition_id
   and edition.season_id = p_season_id
  join public.team_seasons as team_season
    on team_season.id = completion.team_season_id
  join public.sporting_directors as director
    on director.id = completion.sporting_director_id
  where completion.game_type = 'sudoku'
    and not exists (
      select 1 from public.alpha_bot_managers as bot
      where bot.sporting_director_id = director.id
    )
  group by team_season.team_id, team_season.display_name,
    director.id, director.display_name
  order by count(*) desc, director.display_name, director.id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    team_id, sporting_director_id, recipient_name, team_name,
    stat_value, stat_label
  )
  select p_season_id, 'crossword_master', 'La Plume du peloton',
    'Le DS qui a terminé le plus de mots croisés de La Cyclogazette.',
    'director', team_season.team_id, director.id, director.display_name,
    team_season.display_name, count(*)::integer, 'grilles réussies'
  from public.cyclogazette_game_completions as completion
  join public.cyclogazette_editions as edition
    on edition.id = completion.edition_id
   and edition.season_id = p_season_id
  join public.team_seasons as team_season
    on team_season.id = completion.team_season_id
  join public.sporting_directors as director
    on director.id = completion.sporting_director_id
  where completion.game_type = 'crossword'
    and not exists (
      select 1 from public.alpha_bot_managers as bot
      where bot.sporting_director_id = director.id
    )
  group by team_season.team_id, team_season.display_name,
    director.id, director.display_name
  order by count(*) desc, director.display_name, director.id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    team_id, sporting_director_id, recipient_name, team_name,
    stat_value, stat_label
  )
  select p_season_id, 'builder', 'Le Bâtisseur',
    'Le DS qui a investi le plus dans ses infrastructures pendant la saison.',
    'director', project.team_id, manager.sporting_director_id,
    manager.director_name, team_season.display_name,
    round(sum(project.final_cost))::integer, '€ investis'
  from public.infrastructure_projects as project
  join public.team_seasons as team_season
    on team_season.team_id = project.team_id
   and team_season.season_id = p_season_id
  join lateral private.season_award_team_director(project.team_id, p_season_id)
    as manager on true
  where project.started_season_id = p_season_id
    and project.status <> 'cancelled'
  group by project.team_id, manager.sporting_director_id,
    manager.director_name, team_season.display_name
  having sum(project.final_cost) > 0
  order by sum(project.final_cost) desc, manager.director_name,
    manager.sporting_director_id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    team_id, sporting_director_id, recipient_name, team_name,
    stat_value, stat_label
  )
  with appearances as (
    select interview.sporting_director_id, interview.team_id
    from public.post_race_interviews as interview
    where interview.season_id = p_season_id
      and interview.status = 'submitted'
    union all
    select conference.sporting_director_id, conference.team_id
    from public.pre_race_press_conferences as conference
    where conference.season_id = p_season_id
      and conference.status <> 'cancelled'
  ), totals as (
    select sporting_director_id, team_id, count(*)::integer as appearances
    from appearances
    group by sporting_director_id, team_id
  )
  select p_season_id, 'mixed_zone', 'La Voix de la zone mixte',
    'Le DS qui a répondu au plus grand nombre d’interviews et conférences.',
    'director', total.team_id, director.id, director.display_name,
    team_season.display_name, total.appearances, 'prises de parole'
  from totals as total
  join public.sporting_directors as director
    on director.id = total.sporting_director_id
  join public.team_seasons as team_season
    on team_season.team_id = total.team_id
   and team_season.season_id = p_season_id
  where total.appearances > 0
    and not exists (
      select 1 from public.alpha_bot_managers as bot
      where bot.sporting_director_id = director.id
    )
  order by total.appearances desc, director.display_name, director.id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    team_id, sporting_director_id, recipient_name, team_name,
    stat_value, stat_label
  )
  select p_season_id, 'chatterbox', 'Le Blablateur',
    'Le DS qui a publié le plus de messages dans le chat général.', 'director',
    message.team_id, director.id, director.display_name,
    team_season.display_name, count(*)::integer, 'messages publiés'
  from public.global_chat_messages as message
  join public.sporting_directors as director
    on director.id = message.sporting_director_id
  join public.team_seasons as team_season
    on team_season.team_id = message.team_id
   and team_season.season_id = p_season_id
  where message.created_at >= (v_season.starts_on::timestamp at time zone 'Europe/Paris')
    and message.created_at < ((v_season.ends_on + 1)::timestamp at time zone 'Europe/Paris')
    and not exists (
      select 1 from public.alpha_bot_managers as bot
      where bot.sporting_director_id = director.id
    )
  group by message.team_id, director.id, director.display_name,
    team_season.display_name
  order by count(*) desc, director.display_name, director.id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    team_id, sporting_director_id, recipient_name, team_name,
    stat_value, stat_label
  )
  select p_season_id, 'paddock_favorite', 'Le Chouchou du paddock',
    'Le DS dont les messages ont reçu le plus de réactions de la communauté.',
    'director', message.team_id, director.id, director.display_name,
    team_season.display_name, count(reaction.message_id)::integer, 'réactions reçues'
  from public.global_chat_messages as message
  join public.global_chat_message_reactions as reaction
    on reaction.message_id = message.id
  join public.sporting_directors as director
    on director.id = message.sporting_director_id
  join public.team_seasons as team_season
    on team_season.team_id = message.team_id
   and team_season.season_id = p_season_id
  where message.created_at >= (v_season.starts_on::timestamp at time zone 'Europe/Paris')
    and message.created_at < ((v_season.ends_on + 1)::timestamp at time zone 'Europe/Paris')
    and not exists (
      select 1 from public.alpha_bot_managers as bot
      where bot.sporting_director_id = director.id
    )
  group by message.team_id, director.id, director.display_name,
    team_season.display_name
  order by count(reaction.message_id) desc, director.display_name, director.id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    team_id, sporting_director_id, recipient_name, team_name,
    stat_value, stat_label
  )
  with academy_totals as (
    select academy.team_id, count(*)::integer as junior_count
    from public.youth_academy_riders as academy
    where academy.status in ('active', 'recruited')
      and exists (
        select 1 from public.seasons as joined_season
        where joined_season.id = academy.joined_season_id
          and joined_season.game_year <= v_season.game_year
      )
    group by academy.team_id
  )
  select p_season_id, 'youth_developer', 'Le Formateur',
    'Le DS qui compte le plus de juniors dans son école en fin de saison.',
    'director', total.team_id, manager.sporting_director_id,
    manager.director_name, team_season.display_name, total.junior_count,
    'juniors dans l’école'
  from academy_totals as total
  join public.team_seasons as team_season
    on team_season.team_id = total.team_id
   and team_season.season_id = p_season_id
  join lateral private.season_award_team_director(total.team_id, p_season_id)
    as manager on true
  where total.junior_count > 0
  order by total.junior_count desc, manager.director_name,
    manager.sporting_director_id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    academy_rider_id, team_id, recipient_name, team_name,
    stat_value, stat_label
  )
  select p_season_id, 'junior_rider_of_year', 'Étoile junior',
    'Le numéro un du classement UCI junior de la saison.', 'junior_rider',
    ranking.academy_rider_id, academy.team_id, ranking.display_name,
    team_season.display_name, ranking.points, 'points UCI junior'
  from public.development_ranking_entries as ranking
  join public.youth_academy_riders as academy
    on academy.id = ranking.academy_rider_id
  join public.team_seasons as team_season
    on team_season.team_id = academy.team_id
   and team_season.season_id = p_season_id
  where ranking.season_id = p_season_id
    and ranking.entity_type = 'individual'
    and ranking.academy_rider_id is not null
  order by ranking.points desc, ranking.wins desc, ranking.podiums desc,
    ranking.display_name, ranking.id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type,
    team_id, sporting_director_id, recipient_name, team_name,
    stat_value, stat_label
  )
  select p_season_id, 'junior_director_of_year', 'Trophée de la relève',
    'Le DS qui a accompagné le numéro un du classement UCI junior.',
    'director', academy.team_id, manager.sporting_director_id,
    manager.director_name, team_season.display_name, ranking.points,
    'points du leader junior'
  from public.development_ranking_entries as ranking
  join public.youth_academy_riders as academy
    on academy.id = ranking.academy_rider_id
  join public.team_seasons as team_season
    on team_season.team_id = academy.team_id
   and team_season.season_id = p_season_id
  join lateral private.season_award_team_director(academy.team_id, p_season_id)
    as manager on true
  where ranking.season_id = p_season_id
    and ranking.entity_type = 'individual'
    and ranking.academy_rider_id is not null
  order by ranking.points desc, ranking.wins desc, ranking.podiums desc,
    ranking.display_name, ranking.id
  limit 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_rows = row_count; v_created := v_created + v_rows;

  return v_created;
end;
$function$
;
