begin;

-- Les validations interactives consultent presque toutes la journée active.
-- L'ancienne implémentation réécrivait la ligne de saison à chaque appel,
-- même quand la valeur ne changeait pas. Tous les joueurs attendaient alors le
-- même verrou global. La ligne n'est désormais modifiée qu'au changement de jour.
create or replace function public.sync_active_season_day()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '2s'
set statement_timeout = '5s'
as $$
declare
  v_season_id uuid;
  v_starts_on date;
  v_current_day integer;
  v_target_day integer;
  v_synced_day integer;
begin
  select season.id, season.starts_on, season.current_day_number::integer
  into v_season_id, v_starts_on, v_current_day
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_season_id is null then
    return null;
  end if;

  v_target_day := greatest(
    coalesce(v_current_day, 1),
    least(
      28,
      greatest(
        1,
        ((now() at time zone 'Europe/Paris')::date - v_starts_on) + 1
      )
    )
  );

  update public.seasons as season
  set current_day_number = v_target_day
  where season.id = v_season_id
    and season.current_day_number is distinct from v_target_day
  returning season.current_day_number::integer into v_synced_day;

  if found then
    return v_synced_day;
  end if;

  select season.current_day_number::integer
  into v_synced_day
  from public.seasons as season
  where season.id = v_season_id;

  return coalesce(v_synced_day, v_target_day);
end;
$$;

comment on function public.sync_active_season_day() is
  'Aligne la journée active sans acquérir de verrou d’écriture lorsque la valeur est déjà correcte.';

-- Aucun clic utilisateur ne doit attendre indéfiniment un verrou. Les lots
-- restent atomiques : un timeout annule toute la transaction et l'interface peut
-- proposer une nouvelle tentative sans écriture partielle.
alter function public.save_current_rider_training_plans(jsonb)
  set lock_timeout = '2500ms';
alter function public.save_current_rider_training_plans(jsonb)
  set statement_timeout = '12s';

alter function public.save_current_youth_training_settings_bulk(jsonb)
  set lock_timeout = '2500ms';
alter function public.save_current_youth_training_settings_bulk(jsonb)
  set statement_timeout = '12s';

alter function public.save_current_team_equipment_assignments(jsonb)
  set lock_timeout = '2500ms';
alter function public.save_current_team_equipment_assignments(jsonb)
  set statement_timeout = '12s';

alter function public.apply_current_team_nutrition_interventions(jsonb)
  set lock_timeout = '2500ms';
alter function public.apply_current_team_nutrition_interventions(jsonb)
  set statement_timeout = '12s';

-- Le Bureau préfère afficher un module dégradé plutôt que retenir toute
-- la réponse HTTP si une synthèse secondaire dépasse son budget temps.
alter function public.get_current_dashboard_fast_summary_v2()
  set statement_timeout = '5s';
alter function public.get_current_newcomer_journey()
  set lock_timeout = '1500ms';
alter function public.get_current_newcomer_journey()
  set statement_timeout = '3s';
alter function public.get_current_sponsoring_alerts()
  set statement_timeout = '3s';
alter function public.get_current_federation_equipment_alert()
  set statement_timeout = '3s';

-- Deux rafraîchissements de classement pouvaient se croiser. En outre, une
-- ancienne identité d'équipe présente sur les résultats créait deux groupes
-- portant la même clé. Le verrou par saison et l'agrégation par clé rendent le
-- recalcul idempotent et suppriment l'erreur de contrainte observée en production.
create or replace function public.refresh_development_rankings(
  p_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
set lock_timeout = '5s'
set statement_timeout = '30s'
as $$
declare
  v_game_year integer;
  v_count integer := 0;
begin
  select game_year into v_game_year
  from public.seasons where id = p_season_id;
  if coalesce(v_game_year, 0) < 3 then return 0; end if;

  perform pg_advisory_xact_lock(
    hashtextextended('development-rankings:' || p_season_id::text, 0)
  );

  delete from public.development_ranking_entries
  where season_id = p_season_id;

  insert into public.development_ranking_entries (
    season_id, entity_type, entity_key, academy_rider_id,
    development_team_id, display_name, secondary_name, country_code,
    points, wins, podiums, race_count
  )
  select
    p_season_id,
    'individual',
    result.competitor_key,
    max(result.academy_rider_id::text)::uuid,
    max(result.development_team_id::text)::uuid,
    max(result.rider_name),
    max(coalesce(development_team.display_name, virtual.team_name, result.team_name)),
    max(result.country_code),
    sum(result.points)::integer,
    count(*) filter (
      where result.result_scope = 'general' and result.rank = 1
    )::integer,
    count(*) filter (
      where result.result_scope = 'general' and result.rank <= 3
    )::integer,
    count(distinct result.race_edition_id) filter (
      where result.result_scope = 'general'
    )::integer
  from public.development_race_results as result
  join public.development_race_editions as edition
    on edition.id = result.race_edition_id
   and edition.season_id = p_season_id
   and edition.status = 'completed'
  left join public.development_teams as development_team
    on development_team.id = result.development_team_id
  left join public.development_virtual_riders as virtual
    on result.competitor_key = 'virtual:' || virtual.id::text
  group by result.competitor_key;

  insert into public.development_ranking_entries (
    season_id, entity_type, entity_key, development_team_id,
    display_name, secondary_name, country_code,
    points, wins, podiums, race_count
  )
  select
    p_season_id,
    'team',
    grouped.entity_key,
    grouped.development_team_id,
    max(grouped.display_name),
    null,
    null,
    sum(grouped.points)::integer,
    sum(grouped.wins)::integer,
    sum(grouped.podiums)::integer,
    sum(grouped.race_count)::integer
  from (
    select
      case when individual.development_team_id is not null
        then individual.development_team_id::text
        else 'virtual-team:' || coalesce(individual.secondary_name, 'Indépendants')
      end as entity_key,
      individual.development_team_id,
      coalesce(
        development_team.display_name,
        individual.secondary_name,
        'Indépendants'
      ) as display_name,
      individual.points,
      individual.wins,
      individual.podiums,
      individual.race_count
    from public.development_ranking_entries as individual
    left join public.development_teams as development_team
      on development_team.id = individual.development_team_id
    where individual.season_id = p_season_id
      and individual.entity_type = 'individual'
  ) as grouped
  group by grouped.entity_key, grouped.development_team_id;

  insert into public.development_ranking_entries (
    season_id, entity_type, entity_key, display_name, secondary_name,
    country_code, points, wins, podiums, race_count
  )
  select
    p_season_id,
    'nation',
    ranked.country_code,
    coalesce(country.name, ranked.country_code),
    'Top 5 juniors',
    ranked.country_code,
    sum(ranked.points) filter (where ranked.nation_rank <= 5)::integer,
    sum(ranked.wins) filter (where ranked.nation_rank <= 5)::integer,
    sum(ranked.podiums) filter (where ranked.nation_rank <= 5)::integer,
    count(*) filter (where ranked.nation_rank <= 5)::integer
  from (
    select individual.*,
      row_number() over (
        partition by individual.country_code
        order by individual.points desc, individual.wins desc,
          individual.display_name, individual.entity_key
      ) as nation_rank
    from public.development_ranking_entries as individual
    where individual.season_id = p_season_id
      and individual.entity_type = 'individual'
      and individual.country_code is not null
  ) as ranked
  left join public.countries as country
    on country.iso_alpha2 = ranked.country_code
  group by ranked.country_code, country.name;

  select count(*)::integer into v_count
  from public.development_ranking_entries
  where season_id = p_season_id;
  return v_count;
end;
$$;

revoke all on function public.refresh_development_rankings(uuid)
  from public, anon, authenticated;
grant execute on function public.refresh_development_rankings(uuid)
  to service_role;

comment on function public.refresh_development_rankings(uuid) is
  'Reconstruit atomiquement les classements juniors, sérialisé par saison et sans doublon d’identité d’équipe.';

notify pgrst, 'reload schema';

commit;
