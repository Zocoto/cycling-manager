begin;

-- During a season rollover there is intentionally a short interval after the
-- outgoing season has been completed and before the incoming season is made
-- active. In that interval is_national_federation_candidate_eligible() has no
-- active-season row to anchor its mandate projection and returns false. A
-- sponsor-contract trigger must not turn that transient technical state into
-- an irreversible candidacy withdrawal.
create or replace function public.withdraw_ineligible_federation_candidates(
  p_team_id uuid default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  v_candidate record;
  v_season public.seasons%rowtype;
  v_withdrawn integer := 0;
begin
  select * into v_season
  from public.seasons
  where status = 'active'
  limit 1;

  if v_season.id is null then
    return 0;
  end if;

  for v_candidate in
    select
      candidate.id,
      candidate.election_id,
      candidate.team_id,
      candidate.sporting_director_id,
      election.country_id,
      election.term_start_game_year
    from public.national_federation_candidates as candidate
    join public.national_federation_elections as election
      on election.id = candidate.election_id
    where candidate.withdrawn_at is null
      and election.status in ('applications', 'voting')
      and (p_team_id is null or candidate.team_id = p_team_id)
      and not public.is_national_federation_candidate_eligible(
        election.id,
        candidate.team_id
      )
    for update of candidate skip locked
  loop
    update public.national_federation_candidates
    set withdrawn_at = now()
    where id = v_candidate.id;

    insert into public.national_federation_journal_entries (
      country_id,
      season_id,
      day_number,
      category,
      title,
      detail,
      source_reference,
      metadata
    ) values (
      v_candidate.country_id,
      v_season.id,
      v_season.current_day_number,
      'governance',
      'Candidature retirée',
      'La candidature a été retirée car l’équipe sera affiliée à une autre fédération la saison prochaine.',
      'federation-election:' || v_candidate.election_id::text ||
        ':candidate-ineligible:' || v_candidate.id::text,
      jsonb_build_object(
        'candidateId', v_candidate.id,
        'teamId', v_candidate.team_id,
        'termStartGameYear', v_candidate.term_start_game_year
      )
    ) on conflict (source_reference) do nothing;

    insert into public.sporting_director_messages (
      sporting_director_id,
      season_id,
      team_season_id,
      message_type,
      sender_name,
      subject,
      preview,
      body,
      action_href,
      action_label,
      source_reference,
      is_important
    )
    select
      v_candidate.sporting_director_id,
      v_season.id,
      team_season.id,
      'system',
      'Gouvernance fédérale',
      'Candidature fédérale retirée',
      'Votre changement de nationalité d’équipe rend cette candidature inéligible.',
      'Votre futur sponsor principal rattache votre équipe à une autre fédération. Votre candidature est donc retirée, mais votre équipe conserve son droit de vote dans le scrutin en cours.',
      '/jeu/federations',
      'Voir les fédérations',
      'federation-election:' || v_candidate.election_id::text ||
        ':candidate-ineligible-message:' || v_candidate.id::text,
      true
    from public.team_seasons as team_season
    where team_season.team_id = v_candidate.team_id
      and team_season.season_id = v_season.id
    limit 1
    on conflict (sporting_director_id, source_reference) do nothing;

    v_withdrawn := v_withdrawn + 1;
  end loop;

  return v_withdrawn;
end;
$$;

comment on function public.withdraw_ineligible_federation_candidates(uuid) is
  'Retire les candidatures réellement incompatibles avec le mandat, mais reste neutre pendant la fenêtre sans saison active d’un rollover.';

-- Repair the one production mandate affected by the S2 -> S3 transition. The
-- repair is deliberately narrow and only runs when every invariant observed in
-- the public Japanese governance journal is still true.
do $repair_japanese_presidency$
declare
  v_season public.seasons%rowtype;
  v_country_id uuid;
  v_candidate record;
  v_term record;
  v_exceptional_activity_count integer := 0;
begin
  select * into v_season
  from public.seasons
  where status = 'active'
  limit 1;

  select country.id into v_country_id
  from public.countries as country
  where upper(country.iso_alpha2) = 'JP'
  limit 1;

  if v_season.id is null
     or v_season.game_year <> 3
     or v_country_id is null then
    return;
  end if;

  select
    candidate.id as candidate_id,
    candidate.election_id,
    candidate.sporting_director_id,
    candidate.team_id,
    candidate.withdrawn_at,
    count(vote.id)::integer as vote_count
  into v_candidate
  from public.national_federation_candidates as candidate
  join public.national_federation_elections as election
    on election.id = candidate.election_id
   and election.country_id = v_country_id
   and election.election_type = 'regular'
   and election.term_start_game_year = 3
   and election.term_end_game_year = 4
   and election.status = 'automatic'
  join public.sporting_directors as director
    on director.id = candidate.sporting_director_id
   and lower(director.username) = 'alioch4'
  join public.team_seasons as team_season
    on team_season.team_id = candidate.team_id
   and team_season.season_id = v_season.id
   and team_season.status = 'active'
   and team_season.registration_country_id = v_country_id
  left join public.national_federation_votes as vote
    on vote.election_id = candidate.election_id
   and vote.candidate_id = candidate.id
  where candidate.withdrawn_at is not null
  group by
    candidate.id,
    candidate.election_id,
    candidate.sporting_director_id,
    candidate.team_id,
    candidate.withdrawn_at
  having count(vote.id) > 0
  limit 1;

  if v_candidate.candidate_id is null then
    return;
  end if;

  select
    term.id,
    term.president_director_id
  into v_term
  from public.national_federation_terms as term
  where term.country_id = v_country_id
    and term.start_game_year = 3
    and term.end_game_year = 4
  for update;

  if v_term.id is null then
    raise exception 'Japanese S3-S4 federation term is missing; repair aborted.';
  end if;

  if v_term.president_director_id is not null
     and v_term.president_director_id <> v_candidate.sporting_director_id then
    raise exception 'Japanese S3-S4 federation term already has another president; repair aborted.';
  end if;

  select count(*)::integer into v_exceptional_activity_count
  from public.national_federation_elections as election
  where election.country_id = v_country_id
    and election.election_type = 'exceptional'
    and election.term_start_game_year = 3
    and election.term_end_game_year = 4
    and election.status in ('applications', 'voting')
    and (
      exists (
        select 1
        from public.national_federation_candidates as candidate
        where candidate.election_id = election.id
          and candidate.withdrawn_at is null
      )
      or exists (
        select 1
        from public.national_federation_votes as vote
        where vote.election_id = election.id
      )
    );

  if v_exceptional_activity_count > 0 then
    raise exception 'The Japanese exceptional election already has candidate or vote activity; repair aborted.';
  end if;

  update public.national_federation_candidates
  set withdrawn_at = null
  where id = v_candidate.candidate_id;

  update public.national_federation_elections
  set
    status = 'finalized',
    elected_director_id = v_candidate.sporting_director_id,
    finalized_at = now()
  where id = v_candidate.election_id;

  update public.national_federation_terms
  set
    election_id = v_candidate.election_id,
    governance_mode = 'elected',
    president_director_id = v_candidate.sporting_director_id
  where id = v_term.id;

  update public.national_federation_elections
  set
    status = 'automatic',
    elected_director_id = null,
    finalized_at = now()
  where country_id = v_country_id
    and election_type = 'exceptional'
    and term_start_game_year = 3
    and term_end_game_year = 4
    and status in ('applications', 'voting');

  insert into public.national_federation_journal_entries (
    country_id,
    season_id,
    day_number,
    category,
    title,
    detail,
    source_reference,
    metadata
  ) values (
    v_country_id,
    v_season.id,
    v_season.current_day_number,
    'governance',
    'Mandat présidentiel rétabli',
    'La candidature élue en fin de Saison 2 avait été retirée à tort pendant la bascule de saison. Le résultat du scrutin est rétabli pour les Saisons 3 et 4 et l’élection exceptionnelle est close.',
    'federation-presidency:s3:jp:rollover-repair',
    jsonb_build_object(
      'presidentDirectorId', v_candidate.sporting_director_id,
      'regularElectionId', v_candidate.election_id,
      'restoredCandidateId', v_candidate.candidate_id,
      'voteCount', v_candidate.vote_count
    )
  ) on conflict (source_reference) do nothing;

  insert into public.sporting_director_messages (
    sporting_director_id,
    season_id,
    team_season_id,
    message_type,
    sender_name,
    subject,
    preview,
    body,
    action_href,
    action_label,
    source_reference,
    is_important
  )
  select
    v_candidate.sporting_director_id,
    v_season.id,
    team_season.id,
    'system',
    'Fédération du Japon',
    'Votre mandat présidentiel est rétabli',
    'Le résultat du scrutin de fin de Saison 2 est de nouveau appliqué.',
    'Votre candidature avait été invalidée à tort pendant la bascule vers la Saison 3. Le résultat du scrutin est rétabli : vous présidez la Fédération du Japon pour les Saisons 3 et 4.',
    '/jeu/federations/jp?onglet=governance',
    'Ouvrir la fédération',
    'federation-presidency:s3:jp:rollover-repair-message',
    true
  from public.team_seasons as team_season
  where team_season.team_id = v_candidate.team_id
    and team_season.season_id = v_season.id
  limit 1
  on conflict (sporting_director_id, source_reference) do nothing;
end;
$repair_japanese_presidency$;

notify pgrst, 'reload schema';

commit;
