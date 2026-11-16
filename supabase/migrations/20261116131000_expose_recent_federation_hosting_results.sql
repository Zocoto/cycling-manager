begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

create index federation_hosting_result_publications_recent_idx
  on private.federation_hosting_result_publications (completed_at desc, award_id);

-- This archive is only for a reception window still open after season rollover.
create function public.get_recent_federation_hosting_result_archive(p_edition_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
set statement_timeout = '3s'
as $$
  with active_season as (
    select game_year from public.seasons where status = 'active'
  ), recent_awards as materialized (
    select distinct award.id, award.target_game_year
    from private.federation_hosting_result_publications publication
    join public.national_federation_hosting_awards award on award.id = publication.award_id
    join active_season active on active.game_year > award.target_game_year
    where publication.completed_at > statement_timestamp() - interval '72 hours'
      and award.economics_version = 2 and award.status = 'scheduled'
      and (select auth.uid()) is not null
      and (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  ), open_awards as materialized (
    select id, target_game_year, private.get_federation_hosting_revenue_window(id) as deadline
    from recent_awards
  ), editions as materialized (
    select publication.edition_id, publication.is_junior, award.target_game_year,
      coalesce(junior.name, pro.display_name) as name, award.deadline
    from open_awards award
    join private.federation_hosting_result_publications publication on publication.award_id = award.id
    left join public.development_race_editions junior on publication.is_junior
      and junior.id = publication.edition_id and junior.status = 'completed'
    left join public.race_editions pro on not publication.is_junior
      and pro.id = publication.edition_id and pro.status = 'completed'
    where award.deadline > statement_timestamp()
      and award.deadline - interval '72 hours' <= statement_timestamp()
      and (
        (junior.id is not null and exists (
          select 1 from public.development_race_results result
          where result.race_edition_id = junior.id and result.result_scope = 'general'
        )) or (pro.id is not null and exists (
          select 1 from public.race_results result
          where result.race_edition_id = pro.id and result.status = 'classified'
        ))
      )
  ), classification as (
    select result.rank, result.rider_name, result.team_name,
      result.elapsed_time_seconds, result.gap_to_winner_seconds
    from editions edition
    join public.development_race_results result on result.race_edition_id = edition.edition_id
    where edition.edition_id = p_edition_id and edition.is_junior and result.result_scope = 'general'
    union all
    select result.final_rank, concat_ws(' ', rider.first_name, rider.last_name),
      coalesce(team.display_name, registration.historical_team_name),
      ((result.total_time_ms + 500) / 1000)::integer, ((result.gap_to_winner_ms + 500) / 1000)::integer
    from editions edition
    join public.race_results result on result.race_edition_id = edition.edition_id
    join public.race_rosters roster on roster.id = result.race_roster_id
    join public.riders rider on rider.id = roster.rider_id
    join public.race_registrations registration on registration.id = roster.race_registration_id
      and registration.race_edition_id = edition.edition_id
    left join public.team_seasons team on team.id = registration.team_season_id
    where edition.edition_id = p_edition_id and not edition.is_junior and result.status = 'classified'
  )
  select jsonb_build_object(
    'editions', coalesce((select jsonb_agg(to_jsonb(edition)
      order by edition.target_game_year desc, edition.name, edition.edition_id) from editions edition), '[]'::jsonb),
    'classification', coalesce((select jsonb_agg(to_jsonb(result) order by result.rank)
      from classification result), '[]'::jsonb)
  );
$$;

revoke all on function public.get_recent_federation_hosting_result_archive(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_recent_federation_hosting_result_archive(uuid) to authenticated;

commit;
