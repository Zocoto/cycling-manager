begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

create or replace function private.get_dashboard_federation_vote_reminder(
  p_team_season_id uuid,
  p_sporting_director_id uuid
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('countryCode', lower(country.iso_alpha2), 'closesAt', ballot.closes_at)
  from public.team_seasons as team_season
  join public.countries as country
    on country.id = team_season.registration_country_id and country.is_active
  join public.seasons as season on season.id = team_season.season_id and season.status = 'active'
  cross join lateral (
    -- Pick the election the Governance tab will show before testing who can
    -- vote. An exceptional candidacy period can take precedence over a regular vote.
    select election.id,
      case when election.election_type = 'exceptional'
        then election.applications_close_at end as opens_at,
      case when election.election_type = 'exceptional'
        then election.voting_close_at
        else ((season.ends_on + 1)::timestamp at time zone 'Europe/Paris') end as closes_at
    from public.national_federation_elections as election
    where election.country_id = country.id
      and election.term_start_game_year between season.game_year - 1 and season.game_year + 1
      -- The governance page transitions due elections before displaying them.
      -- The Bureau only observes the effective window and never settles an election.
      and election.status in ('applications', 'voting')
      and (
        (election.election_type = 'exceptional'
          and season.game_year between election.term_start_game_year and election.term_end_game_year
          and now() < election.voting_close_at)
        or (election.election_type = 'regular'
          and election.election_season_id = season.id
          and election.term_start_game_year = season.game_year + 1
          and mod(season.game_year, 2) = 0
          and season.current_day_number between 25 and 28)
      )
    order by (election.election_type = 'exceptional') desc, election.created_at desc
    limit 1
  ) as ballot
  join public.national_federation_electorate as electorate
    on electorate.election_id = ballot.id and electorate.team_id = team_season.team_id
   and electorate.sporting_director_id = p_sporting_director_id
  where team_season.id = p_team_season_id
    and (ballot.opens_at is null or ballot.opens_at <= now())
    and now() < ballot.closes_at
    and exists (
      select 1
      from public.national_federation_candidates as candidate
      where candidate.election_id = ballot.id and candidate.withdrawn_at is null
        and public.is_national_federation_candidate_eligible(ballot.id, candidate.team_id)
    )
    and not exists (
      select 1
      from public.national_federation_votes as vote
      join public.national_federation_candidates as candidate
        on candidate.id = vote.candidate_id and candidate.election_id = vote.election_id
      where vote.election_id = ballot.id and vote.team_id = team_season.team_id
        and candidate.withdrawn_at is null
        and public.is_national_federation_candidate_eligible(ballot.id, candidate.team_id)
    );
$$;

revoke all on function private.get_dashboard_federation_vote_reminder(uuid, uuid)
  from public, anon, authenticated, service_role;

do $migration$
declare
  v_definition text := replace(
    pg_get_functiondef('public.get_current_dashboard_assistant_summary()'::regprocedure), chr(13), ''
  );
  v_anchor constant text := $anchor$'equipmentPartnerSignatureAvailable', ($anchor$;
  v_replacement constant text := $replacement$'federationVoteReminder', (
        select private.get_dashboard_federation_vote_reminder(context.team_season_id, context.sporting_director_id)
        from current_context as context
      ),
      'equipmentPartnerSignatureAvailable', ($replacement$;
begin
  if length(v_definition) - length(replace(v_definition, v_anchor, '')) <> length(v_anchor)
     or position('federationVoteReminder' in v_definition) > 0 then
    raise exception 'Unexpected federation vote reminder anchor in dashboard assistant summary';
  end if;
  execute replace(v_definition, v_anchor, v_replacement);
end;
$migration$;

commit;
