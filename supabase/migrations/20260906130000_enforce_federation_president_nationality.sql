begin;

alter table public.national_federation_elections
  add column election_type text not null default 'regular',
  add column applications_open_at timestamptz,
  add column applications_close_at timestamptz,
  add column voting_close_at timestamptz;

alter table public.national_federation_elections
  add constraint national_federation_elections_type_allowed check (
    election_type in ('regular', 'exceptional')
  ),
  add constraint national_federation_elections_exceptional_dates_valid check (
    election_type = 'regular'
    or (
      applications_open_at is not null
      and applications_close_at > applications_open_at
      and voting_close_at > applications_close_at
    )
  );

alter table public.national_federation_elections
  drop constraint national_federation_elections_country_term_unique;

create unique index national_federation_elections_regular_country_term_uidx
  on public.national_federation_elections (country_id, term_start_game_year)
  where election_type = 'regular';

create unique index national_federation_elections_active_exceptional_country_uidx
  on public.national_federation_elections (country_id)
  where election_type = 'exceptional'
    and status in ('applications', 'voting');

create or replace function public.get_projected_team_federation_country_id(
  p_team_id uuid,
  p_game_year integer
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_country_id uuid;
begin
  select sponsor.country_id
  into v_country_id
  from public.team_sponsor_contracts as contract
  join public.sponsors as sponsor on sponsor.id = contract.sponsor_id
  join public.seasons as start_season on start_season.id = contract.start_season_id
  left join public.seasons as end_season on end_season.id = contract.end_season_id
  where contract.team_id = p_team_id
    and contract.role = 'principal'
    and contract.status in ('active', 'planned')
    and (
      (
        contract.status = 'planned'
        and start_season.game_year = p_game_year
      )
      or (
        contract.status = 'active'
        and p_game_year between start_season.game_year and coalesce(
          end_season.game_year,
          start_season.game_year + contract.contract_duration_seasons - 1
        )
      )
    )
  order by
    case
      when contract.status = 'planned'
        and start_season.game_year = p_game_year then 0
      else 1
    end,
    start_season.game_year desc,
    contract.created_at desc,
    contract.id desc
  limit 1;

  if v_country_id is not null then
    return v_country_id;
  end if;

  select team_season.registration_country_id
  into v_country_id
  from public.team_seasons as team_season
  join public.seasons as season on season.id = team_season.season_id
  where team_season.team_id = p_team_id
    and team_season.status in ('planned', 'active')
    and (season.game_year = p_game_year or season.status = 'active')
  order by
    case when season.game_year = p_game_year then 0 else 1 end,
    season.game_year desc
  limit 1;

  if v_country_id is not null then
    return v_country_id;
  end if;

  select team.home_country_id
  into v_country_id
  from public.teams as team
  where team.id = p_team_id;

  return v_country_id;
end;
$$;

create or replace function public.is_national_federation_candidate_eligible(
  p_election_id uuid,
  p_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(bool_and(
    public.get_projected_team_federation_country_id(
      p_team_id,
      mandate_year.game_year
    ) = election.country_id
  ), false)
  from public.national_federation_elections as election
  join public.seasons as active_season on active_season.status = 'active'
  cross join lateral pg_catalog.generate_series(
    case
      when election.election_type = 'exceptional'
        then greatest(election.term_start_game_year, active_season.game_year)
      else election.term_start_game_year
    end,
    election.term_end_game_year
  ) as mandate_year(game_year)
  where election.id = p_election_id;
$$;

create or replace function public.assert_national_federation_candidate_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.withdrawn_at is null
     and not public.is_national_federation_candidate_eligible(
       new.election_id,
       new.team_id
     ) then
    raise exception 'Votre prochain sponsor principal rattache votre équipe à une autre fédération : vous ne pouvez pas vous présenter à cette présidence.';
  end if;

  return new;
end;
$$;

drop trigger if exists national_federation_candidate_eligibility_guard
  on public.national_federation_candidates;
create trigger national_federation_candidate_eligibility_guard
before insert or update of election_id, team_id, withdrawn_at
on public.national_federation_candidates
for each row execute function public.assert_national_federation_candidate_eligibility();

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

create or replace function public.open_exceptional_federation_election(
  p_country_id uuid,
  p_term_id uuid,
  p_season_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  v_election_id uuid;
  v_term public.national_federation_terms%rowtype;
  v_season public.seasons%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_country_id::text || ':exceptional-election', 0)
  );

  select election.id into v_election_id
  from public.national_federation_elections as election
  where election.country_id = p_country_id
    and election.election_type = 'exceptional'
    and election.status in ('applications', 'voting')
  order by election.created_at desc
  limit 1;

  if v_election_id is not null then
    return v_election_id;
  end if;

  select * into v_term
  from public.national_federation_terms
  where id = p_term_id
    and country_id = p_country_id;
  select * into v_season
  from public.seasons
  where id = p_season_id
    and status = 'active';

  if v_term.id is null or v_season.id is null then
    return null;
  end if;

  insert into public.national_federation_elections (
    country_id,
    election_season_id,
    term_start_game_year,
    term_end_game_year,
    status,
    election_type,
    applications_open_at,
    applications_close_at,
    voting_close_at
  ) values (
    p_country_id,
    p_season_id,
    v_term.start_game_year,
    v_term.end_game_year,
    'applications',
    'exceptional',
    now(),
    now() + interval '48 hours',
    now() + interval '96 hours'
  )
  returning id into v_election_id;

  insert into public.national_federation_electorate (
    election_id,
    team_season_id,
    team_id,
    sporting_director_id
  )
  select
    v_election_id,
    team_season.id,
    team_season.team_id,
    assignment.sporting_director_id
  from public.team_seasons as team_season
  join public.teams as team
    on team.id = team_season.team_id
   and team.status = 'active'
  join public.team_manager_assignments as assignment
    on assignment.team_id = team.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
   and director.status = 'active'
  where team_season.season_id = p_season_id
    and team_season.registration_country_id = p_country_id
    and team_season.status in ('planned', 'active')
  on conflict do nothing;

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
    p_country_id,
    p_season_id,
    v_season.current_day_number,
    'governance',
    'Élection présidentielle exceptionnelle',
    'La présidence est vacante. Les candidatures sont ouvertes pendant 48 heures, avant un vote de 48 heures.',
    'federation-election:' || v_election_id::text || ':applications',
    jsonb_build_object(
      'electionType', 'exceptional',
      'applicationsCloseAt', now() + interval '48 hours',
      'votingCloseAt', now() + interval '96 hours'
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
    electorate.sporting_director_id,
    p_season_id,
    electorate.team_season_id,
    'system',
    'Fédération de ' || country.name,
    'Élection présidentielle exceptionnelle',
    'La présidence est vacante : les candidatures sont ouvertes pendant 48 heures.',
    'Un changement de nationalité d’équipe a mis fin au mandat du président. Votre fédération ouvre immédiatement une élection exceptionnelle : 48 heures de candidatures, puis 48 heures de vote.',
    '/jeu/federations/' || lower(country.iso_alpha2) || '?onglet=governance',
    'Voir l’élection',
    'federation-election:' || v_election_id::text ||
      ':applications:' || electorate.sporting_director_id::text,
    true
  from public.national_federation_electorate as electorate
  join public.countries as country on country.id = p_country_id
  where electorate.election_id = v_election_id
  on conflict (sporting_director_id, source_reference) do nothing;

  return v_election_id;
end;
$$;

create or replace function public.enforce_federation_president_nationality()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  v_season public.seasons%rowtype;
  v_term record;
  v_election_id uuid;
  v_country record;
  v_vacated integer := 0;
begin
  select * into v_season
  from public.seasons
  where status = 'active'
  limit 1;

  if v_season.id is null then
    return 0;
  end if;

  for v_term in
    select
      term.id,
      term.country_id,
      term.start_game_year,
      term.end_game_year,
      term.president_director_id,
      assignment.team_id,
      team_season.registration_country_id
    from public.national_federation_terms as term
    left join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = term.president_director_id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    left join public.team_seasons as team_season
      on team_season.team_id = assignment.team_id
     and team_season.season_id = v_season.id
     and team_season.status in ('planned', 'active')
    where term.president_director_id is not null
      and v_season.game_year between term.start_game_year and term.end_game_year
      and team_season.id is not null
      and team_season.registration_country_id <> term.country_id
    for update of term skip locked
  loop
    update public.national_federation_terms
    set
      governance_mode = 'automatic',
      president_director_id = null
    where id = v_term.id;

    v_election_id := public.open_exceptional_federation_election(
      v_term.country_id,
      v_term.id,
      v_season.id
    );

    select country.name, country.iso_alpha2
    into v_country
    from public.countries as country
    where country.id = v_term.country_id;

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
      v_term.country_id,
      v_season.id,
      v_season.current_day_number,
      'governance',
      'Présidence vacante',
      'Le président quitte immédiatement ses fonctions après le changement de nationalité de son équipe. Une élection exceptionnelle est ouverte.',
      'federation-term:' || v_term.id::text ||
        ':vacancy:' || coalesce(v_election_id::text, 'none'),
      jsonb_build_object(
        'formerPresidentDirectorId', v_term.president_director_id,
        'exceptionalElectionId', v_election_id,
        'newTeamCountryId', v_term.registration_country_id
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
    ) values (
      v_term.president_director_id,
      v_season.id,
      (
        select team_season.id
        from public.team_seasons as team_season
        where team_season.team_id = v_term.team_id
          and team_season.season_id = v_season.id
        limit 1
      ),
      'system',
      'Fédération de ' || coalesce(v_country.name, 'votre ancienne nation'),
      'Fin de votre mandat fédéral',
      'Le changement de nationalité de votre équipe met fin à votre présidence.',
      'La présidence est réservée aux DS dont l’équipe reste affiliée à la fédération pendant le mandat. Une élection exceptionnelle vient d’être ouverte.',
      '/jeu/federations/' || lower(coalesce(v_country.iso_alpha2, '')) || '?onglet=governance',
      'Voir la gouvernance',
      'federation-term:' || v_term.id::text ||
        ':vacancy-message:' || coalesce(v_election_id::text, 'none'),
      true
    )
    on conflict (sporting_director_id, source_reference) do nothing;

    v_vacated := v_vacated + 1;
  end loop;

  return v_vacated;
end;
$$;

create or replace function public.handle_federation_nationality_eligibility_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.withdraw_ineligible_federation_candidates(new.team_id);
  perform public.enforce_federation_president_nationality();
  return new;
end;
$$;

drop trigger if exists team_season_federation_presidency_guard
  on public.team_seasons;
create trigger team_season_federation_presidency_guard
after update of registration_country_id
on public.team_seasons
for each row
when (old.registration_country_id is distinct from new.registration_country_id)
execute function public.handle_federation_nationality_eligibility_change();

create or replace function public.handle_sponsor_federation_eligibility_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'principal'
     and new.status in ('active', 'planned') then
    perform public.withdraw_ineligible_federation_candidates(new.team_id);
    perform public.enforce_federation_president_nationality();
  end if;
  return new;
end;
$$;

drop trigger if exists sponsor_contract_federation_eligibility_guard
  on public.team_sponsor_contracts;
create trigger sponsor_contract_federation_eligibility_guard
after insert or update of sponsor_id, start_season_id, end_season_id, status, role
on public.team_sponsor_contracts
for each row execute function public.handle_sponsor_federation_eligibility_change();

create or replace function public.settle_due_federation_elections()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_season public.seasons%rowtype;
  v_election public.national_federation_elections%rowtype;
  v_winner_director_id uuid;
  v_winner_vote_count integer;
  v_created integer := 0;
  v_advanced integer := 0;
  v_finalized integer := 0;
begin
  select * into v_season
  from public.seasons
  where status = 'active'
  limit 1;

  if v_season.id is null then
    return jsonb_build_object('created', 0, 'advanced', 0, 'finalized', 0);
  end if;

  perform public.withdraw_ineligible_federation_candidates();

  if mod(v_season.game_year, 2) = 0
     and coalesce(v_season.current_day_number, 1) >= 21 then
    with inserted as (
      insert into public.national_federation_elections (
        country_id,
        election_season_id,
        term_start_game_year,
        term_end_game_year,
        status,
        election_type
      )
      select distinct
        team_season.registration_country_id,
        v_season.id,
        v_season.game_year + 1,
        v_season.game_year + 2,
        case
          when coalesce(v_season.current_day_number, 1) <= 24
            then 'applications'
          else 'voting'
        end,
        'regular'
      from public.team_seasons as team_season
      join public.teams as team
        on team.id = team_season.team_id
       and team.status = 'active'
      join public.countries as country
        on country.id = team_season.registration_country_id
       and country.is_active = true
      where team_season.season_id = v_season.id
        and team_season.status in ('planned', 'active')
      on conflict (country_id, term_start_game_year)
        where election_type = 'regular'
        do nothing
      returning id
    )
    select count(*)::integer into v_created from inserted;

    insert into public.national_federation_electorate (
      election_id,
      team_season_id,
      team_id,
      sporting_director_id
    )
    select
      election.id,
      team_season.id,
      team_season.team_id,
      assignment.sporting_director_id
    from public.national_federation_elections as election
    join public.team_seasons as team_season
      on team_season.registration_country_id = election.country_id
     and team_season.season_id = v_season.id
     and team_season.status in ('planned', 'active')
    join public.teams as team
      on team.id = team_season.team_id
     and team.status = 'active'
    join public.team_manager_assignments as assignment
      on assignment.team_id = team.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
     and director.status = 'active'
    where election.election_type = 'regular'
      and election.election_season_id = v_season.id
      and election.term_start_game_year = v_season.game_year + 1
    on conflict do nothing;

    insert into public.national_federation_journal_entries (
      country_id,
      season_id,
      day_number,
      category,
      title,
      detail,
      source_reference
    )
    select
      election.country_id,
      v_season.id,
      21,
      'governance',
      'Appel à candidatures ouvert',
      format(
        'Les équipes affiliées peuvent présenter leur candidat jusqu’à J24 pour le mandat S%s–S%s.',
        election.term_start_game_year,
        election.term_end_game_year
      ),
      'federation-election:' || election.id::text || ':applications'
    from public.national_federation_elections as election
    where election.election_type = 'regular'
      and election.election_season_id = v_season.id
      and election.term_start_game_year = v_season.game_year + 1
    on conflict (source_reference) do nothing;

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
      electorate.sporting_director_id,
      v_season.id,
      electorate.team_season_id,
      'system',
      'Fédération de ' || country.name,
      'Élection fédérale · appel à candidatures',
      'Les candidatures à la présidence sont ouvertes jusqu’à J24.',
      format(
        'Votre équipe fait partie du corps électoral. Vous pouvez présenter une candidature pour le mandat S%s–S%s jusqu’à J24.',
        election.term_start_game_year,
        election.term_end_game_year
      ),
      '/jeu/federations/' || lower(country.iso_alpha2) || '?onglet=governance',
      'Voir l’élection',
      'federation-election:' || election.id::text ||
        ':applications:' || electorate.sporting_director_id::text,
      true
    from public.national_federation_elections as election
    join public.countries as country on country.id = election.country_id
    join public.national_federation_electorate as electorate
      on electorate.election_id = election.id
    where election.election_type = 'regular'
      and election.election_season_id = v_season.id
      and election.term_start_game_year = v_season.game_year + 1
    on conflict (sporting_director_id, source_reference) do nothing;

    if coalesce(v_season.current_day_number, 1) >= 25 then
      with advanced as (
        update public.national_federation_elections
        set status = 'voting'
        where election_type = 'regular'
          and election_season_id = v_season.id
          and term_start_game_year = v_season.game_year + 1
          and status = 'applications'
        returning id
      )
      select count(*)::integer into v_advanced from advanced;

      insert into public.national_federation_journal_entries (
        country_id,
        season_id,
        day_number,
        category,
        title,
        detail,
        source_reference
      )
      select
        election.country_id,
        v_season.id,
        25,
        'governance',
        'Scrutin présidentiel ouvert',
        'Chaque équipe affiliée dispose d’une voix jusqu’à la fin de J28.',
        'federation-election:' || election.id::text || ':voting'
      from public.national_federation_elections as election
      where election.election_type = 'regular'
        and election.election_season_id = v_season.id
        and election.term_start_game_year = v_season.game_year + 1
      on conflict (source_reference) do nothing;

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
        electorate.sporting_director_id,
        v_season.id,
        electorate.team_season_id,
        'system',
        'Fédération de ' || country.name,
        'Élection fédérale · vote ouvert',
        'Votre équipe peut voter jusqu’à la fin de J28.',
        'Le scrutin est ouvert. Une seule voix est enregistrée par équipe affiliée et le dernier choix effectué avant la clôture fait foi.',
        '/jeu/federations/' || lower(country.iso_alpha2) || '?onglet=governance',
        'Voter',
        'federation-election:' || election.id::text ||
          ':voting:' || electorate.sporting_director_id::text,
        true
      from public.national_federation_elections as election
      join public.countries as country on country.id = election.country_id
      join public.national_federation_electorate as electorate
        on electorate.election_id = election.id
      where election.election_type = 'regular'
        and election.election_season_id = v_season.id
        and election.term_start_game_year = v_season.game_year + 1
      on conflict (sporting_director_id, source_reference) do nothing;
    end if;
  end if;

  if mod(v_season.game_year, 2) = 1
     and coalesce(v_season.current_day_number, 1) >= 1 then
    for v_election in
      select *
      from public.national_federation_elections
      where election_type = 'regular'
        and term_start_game_year = v_season.game_year
        and status in ('applications', 'voting')
      for update skip locked
    loop
      v_winner_director_id := null;
      v_winner_vote_count := 0;

      select
        candidate.sporting_director_id,
        count(vote.id)::integer
      into v_winner_director_id, v_winner_vote_count
      from public.national_federation_candidates as candidate
      left join public.national_federation_votes as vote
        on vote.candidate_id = candidate.id
       and vote.election_id = candidate.election_id
      where candidate.election_id = v_election.id
        and candidate.withdrawn_at is null
        and public.is_national_federation_candidate_eligible(
          v_election.id,
          candidate.team_id
        )
      group by candidate.id, candidate.sporting_director_id, candidate.created_at
      having count(vote.id) > 0
      order by count(vote.id) desc, candidate.created_at asc, candidate.id asc
      limit 1;

      update public.national_federation_elections
      set
        status = case
          when v_winner_director_id is null then 'automatic'
          else 'finalized'
        end,
        elected_director_id = v_winner_director_id,
        finalized_at = now()
      where id = v_election.id;

      insert into public.national_federation_terms (
        country_id,
        election_id,
        start_game_year,
        end_game_year,
        governance_mode,
        president_director_id
      ) values (
        v_election.country_id,
        v_election.id,
        v_election.term_start_game_year,
        v_election.term_end_game_year,
        case
          when v_winner_director_id is null then 'automatic'
          else 'elected'
        end,
        v_winner_director_id
      )
      on conflict (country_id, start_game_year) do nothing;

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
        v_election.country_id,
        v_season.id,
        1,
        'governance',
        case
          when v_winner_director_id is null
            then 'Gestion automatique reconduite'
          else 'Président de fédération élu'
        end,
        case
          when v_winner_director_id is null
            then 'Aucun candidat n’a réuni de voix : la fédération reste administrée automatiquement.'
          else format(
            'Le président élu entre en fonction pour les saisons %s et %s.',
            v_election.term_start_game_year,
            v_election.term_end_game_year
          )
        end,
        'federation-election:' || v_election.id::text || ':result',
        jsonb_build_object(
          'presidentDirectorId', v_winner_director_id,
          'votes', coalesce(v_winner_vote_count, 0),
          'electionType', 'regular'
        )
      ) on conflict (source_reference) do nothing;

      v_finalized := v_finalized + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'created', v_created,
    'advanced', v_advanced,
    'finalized', v_finalized
  );
end;
$$;

create or replace function public.settle_due_exceptional_federation_elections()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_season public.seasons%rowtype;
  v_election public.national_federation_elections%rowtype;
  v_winner_director_id uuid;
  v_winner_vote_count integer;
  v_vacated integer := 0;
  v_withdrawn integer := 0;
  v_advanced integer := 0;
  v_finalized integer := 0;
begin
  select * into v_season
  from public.seasons
  where status = 'active'
  limit 1;

  if v_season.id is null then
    return jsonb_build_object(
      'vacated', 0,
      'withdrawn', 0,
      'advanced', 0,
      'finalized', 0
    );
  end if;

  v_vacated := public.enforce_federation_president_nationality();
  v_withdrawn := public.withdraw_ineligible_federation_candidates();

  for v_election in
    update public.national_federation_elections
    set status = 'voting'
    where election_type = 'exceptional'
      and status = 'applications'
      and applications_close_at <= now()
    returning *
  loop
    insert into public.national_federation_journal_entries (
      country_id,
      season_id,
      day_number,
      category,
      title,
      detail,
      source_reference
    ) values (
      v_election.country_id,
      v_season.id,
      v_season.current_day_number,
      'governance',
      'Vote exceptionnel ouvert',
      'Les candidatures sont closes. Chaque équipe affiliée dispose maintenant de 48 heures pour voter.',
      'federation-election:' || v_election.id::text || ':voting'
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
      electorate.sporting_director_id,
      v_season.id,
      electorate.team_season_id,
      'system',
      'Fédération de ' || country.name,
      'Élection exceptionnelle · vote ouvert',
      'Le vote est ouvert pendant 48 heures.',
      'Choisissez le président qui terminera le mandat en cours. Une seule voix est enregistrée par équipe et votre dernier choix fait foi.',
      '/jeu/federations/' || lower(country.iso_alpha2) || '?onglet=governance',
      'Voter',
      'federation-election:' || v_election.id::text ||
        ':voting:' || electorate.sporting_director_id::text,
      true
    from public.national_federation_electorate as electorate
    join public.countries as country on country.id = v_election.country_id
    where electorate.election_id = v_election.id
    on conflict (sporting_director_id, source_reference) do nothing;

    v_advanced := v_advanced + 1;
  end loop;

  for v_election in
    select *
    from public.national_federation_elections
    where election_type = 'exceptional'
      and status = 'voting'
      and voting_close_at <= now()
    for update skip locked
  loop
    v_winner_director_id := null;
    v_winner_vote_count := 0;

    select
      candidate.sporting_director_id,
      count(vote.id)::integer
    into v_winner_director_id, v_winner_vote_count
    from public.national_federation_candidates as candidate
    left join public.national_federation_votes as vote
      on vote.candidate_id = candidate.id
     and vote.election_id = candidate.election_id
    where candidate.election_id = v_election.id
      and candidate.withdrawn_at is null
      and public.is_national_federation_candidate_eligible(
        v_election.id,
        candidate.team_id
      )
    group by candidate.id, candidate.sporting_director_id, candidate.created_at
    having count(vote.id) > 0
    order by count(vote.id) desc, candidate.created_at asc, candidate.id asc
    limit 1;

    update public.national_federation_elections
    set
      status = case
        when v_winner_director_id is null then 'automatic'
        else 'finalized'
      end,
      elected_director_id = v_winner_director_id,
      finalized_at = now()
    where id = v_election.id;

    update public.national_federation_terms
    set
      election_id = v_election.id,
      governance_mode = case
        when v_winner_director_id is null then 'automatic'
        else 'elected'
      end,
      president_director_id = v_winner_director_id
    where country_id = v_election.country_id
      and start_game_year = v_election.term_start_game_year;

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
      v_election.country_id,
      v_season.id,
      v_season.current_day_number,
      'governance',
      case
        when v_winner_director_id is null
          then 'Intérim automatique confirmé'
        else 'Nouveau président élu'
      end,
      case
        when v_winner_director_id is null
          then 'Aucun candidat n’a réuni de voix : la gestion automatique terminera le mandat en cours.'
        else 'Le président élu lors du scrutin exceptionnel prend immédiatement ses fonctions jusqu’à la fin du mandat en cours.'
      end,
      'federation-election:' || v_election.id::text || ':result',
      jsonb_build_object(
        'presidentDirectorId', v_winner_director_id,
        'votes', coalesce(v_winner_vote_count, 0),
        'electionType', 'exceptional'
      )
    ) on conflict (source_reference) do nothing;

    v_finalized := v_finalized + 1;
  end loop;

  return jsonb_build_object(
    'vacated', v_vacated,
    'withdrawn', v_withdrawn,
    'advanced', v_advanced,
    'finalized', v_finalized
  );
end;
$$;

create or replace function public.submit_national_federation_candidacy(
  p_country_code text,
  p_manifesto text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_identity record;
  v_season public.seasons%rowtype;
  v_election public.national_federation_elections%rowtype;
  v_candidate_id uuid;
  v_manifesto text;
begin
  if (select auth.uid()) is null then
    raise exception 'Vous devez être connecté pour déposer une candidature.';
  end if;

  v_manifesto := regexp_replace(btrim(coalesce(p_manifesto, '')), '\s+', ' ', 'g');
  if char_length(v_manifesto) not between 40 and 800 then
    raise exception 'La profession de foi doit contenir entre 40 et 800 caractères.';
  end if;

  perform public.settle_due_exceptional_federation_elections();
  perform public.settle_due_federation_elections();
  select * into v_identity
  from public.get_current_federation_identity(p_country_code);
  select * into v_season
  from public.seasons where status = 'active' limit 1;

  if v_identity.country_id is null or v_identity.team_id is null then
    raise exception 'Votre équipe ne fait pas partie de cette fédération.';
  end if;

  select election.* into v_election
  from public.national_federation_elections as election
  where election.country_id = v_identity.country_id
    and election.status = 'applications'
    and (
      (
        election.election_type = 'exceptional'
        and v_season.game_year between
          election.term_start_game_year and election.term_end_game_year
        and now() < election.applications_close_at
      )
      or (
        election.election_type = 'regular'
        and election.term_start_game_year = v_season.game_year + 1
        and mod(v_season.game_year, 2) = 0
        and coalesce(v_season.current_day_number, 1) between 21 and 24
      )
    )
  order by
    case when election.election_type = 'exceptional' then 0 else 1 end,
    election.created_at desc
  limit 1;

  if v_election.id is null then
    raise exception 'Aucun appel à candidatures n’est actuellement ouvert dans cette fédération.';
  end if;
  if not exists (
    select 1 from public.national_federation_electorate as electorate
    where electorate.election_id = v_election.id
      and electorate.team_id = v_identity.team_id
      and electorate.sporting_director_id = v_identity.sporting_director_id
  ) then
    raise exception 'Votre équipe ne figure pas sur la liste électorale de ce scrutin.';
  end if;
  if not public.is_national_federation_candidate_eligible(
    v_election.id,
    v_identity.team_id
  ) then
    raise exception 'Votre prochain sponsor principal rattache votre équipe à une autre fédération : vous ne pouvez pas vous présenter à cette présidence.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_election.id::text || ':' || v_identity.team_id::text, 0)
  );

  insert into public.national_federation_candidates (
    election_id,
    sporting_director_id,
    team_id,
    manifesto
  ) values (
    v_election.id,
    v_identity.sporting_director_id,
    v_identity.team_id,
    v_manifesto
  )
  on conflict (election_id, team_id) do update
  set
    sporting_director_id = excluded.sporting_director_id,
    manifesto = excluded.manifesto,
    withdrawn_at = null
  returning id into v_candidate_id;

  insert into public.national_federation_journal_entries (
    country_id,
    season_id,
    day_number,
    category,
    title,
    detail,
    source_reference
  ) values (
    v_identity.country_id,
    v_season.id,
    v_season.current_day_number,
    'governance',
    'Nouvelle candidature',
    v_identity.display_name || ' présente sa candidature au nom de ' || v_identity.team_name || '.',
    'federation-election:' || v_election.id::text || ':candidate:' || v_candidate_id::text
  ) on conflict (source_reference) do nothing;

  return v_candidate_id;
end;
$$;

create or replace function public.vote_national_federation_president(
  p_country_code text,
  p_candidate_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_identity record;
  v_season public.seasons%rowtype;
  v_election public.national_federation_elections%rowtype;
  v_vote_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Vous devez être connecté pour voter.';
  end if;

  perform public.settle_due_exceptional_federation_elections();
  perform public.settle_due_federation_elections();
  select * into v_identity
  from public.get_current_federation_identity(p_country_code);
  select * into v_season
  from public.seasons where status = 'active' limit 1;

  if v_identity.country_id is null or v_identity.team_id is null then
    raise exception 'Votre équipe ne fait pas partie de cette fédération.';
  end if;

  select election.* into v_election
  from public.national_federation_elections as election
  where election.country_id = v_identity.country_id
    and election.status = 'voting'
    and (
      (
        election.election_type = 'exceptional'
        and v_season.game_year between
          election.term_start_game_year and election.term_end_game_year
        and now() < election.voting_close_at
      )
      or (
        election.election_type = 'regular'
        and election.term_start_game_year = v_season.game_year + 1
        and mod(v_season.game_year, 2) = 0
        and coalesce(v_season.current_day_number, 1) between 25 and 28
      )
    )
  order by
    case when election.election_type = 'exceptional' then 0 else 1 end,
    election.created_at desc
  limit 1;

  if v_election.id is null then
    raise exception 'Aucun vote présidentiel n’est actuellement ouvert dans cette fédération.';
  end if;
  if not exists (
    select 1 from public.national_federation_electorate as electorate
    where electorate.election_id = v_election.id
      and electorate.team_id = v_identity.team_id
      and electorate.sporting_director_id = v_identity.sporting_director_id
  ) then
    raise exception 'Votre équipe ne figure pas sur la liste électorale.';
  end if;
  if not exists (
    select 1 from public.national_federation_candidates as candidate
    where candidate.id = p_candidate_id
      and candidate.election_id = v_election.id
      and candidate.withdrawn_at is null
      and public.is_national_federation_candidate_eligible(
        v_election.id,
        candidate.team_id
      )
  ) then
    raise exception 'Cette candidature n’est pas valide pour ce scrutin.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_election.id::text || ':' || v_identity.team_id::text, 0)
  );

  insert into public.national_federation_votes (
    election_id,
    candidate_id,
    team_id,
    sporting_director_id,
    cast_at
  ) values (
    v_election.id,
    p_candidate_id,
    v_identity.team_id,
    v_identity.sporting_director_id,
    now()
  )
  on conflict (election_id, team_id) do update
  set candidate_id = excluded.candidate_id, cast_at = excluded.cast_at
  returning id into v_vote_id;

  insert into public.national_federation_journal_entries (
    country_id,
    season_id,
    day_number,
    category,
    title,
    detail,
    source_reference
  ) values (
    v_identity.country_id,
    v_season.id,
    v_season.current_day_number,
    'governance',
    'Participation au scrutin',
    v_identity.team_name || ' a enregistré sa voix. Le choix reste secret jusqu’à la clôture.',
    'federation-election:' || v_election.id::text || ':vote:' || v_identity.team_id::text
  ) on conflict (source_reference) do nothing;

  return v_vote_id;
end;
$$;

revoke all on function public.get_projected_team_federation_country_id(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.is_national_federation_candidate_eligible(uuid, uuid)
  from public, anon;
revoke all on function public.withdraw_ineligible_federation_candidates(uuid)
  from public, anon, authenticated;
revoke all on function public.open_exceptional_federation_election(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.enforce_federation_president_nationality()
  from public, anon, authenticated;
revoke all on function public.settle_due_exceptional_federation_elections()
  from public, anon, authenticated;
revoke all on function public.submit_national_federation_candidacy(text, text)
  from public, anon;
revoke all on function public.vote_national_federation_president(text, uuid)
  from public, anon;

grant execute on function public.is_national_federation_candidate_eligible(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.withdraw_ineligible_federation_candidates(uuid)
  to service_role;
grant execute on function public.open_exceptional_federation_election(uuid, uuid, uuid)
  to service_role;
grant execute on function public.enforce_federation_president_nationality()
  to service_role;
grant execute on function public.settle_due_exceptional_federation_elections()
  to service_role;
grant execute on function public.submit_national_federation_candidacy(text, text)
  to authenticated, service_role;
grant execute on function public.vote_national_federation_president(text, uuid)
  to authenticated, service_role;

comment on function public.is_national_federation_candidate_eligible(uuid, uuid) is
  'Refuse une candidature lorsque le sponsor principal projeté affiliera l’équipe à une autre fédération pendant le mandat.';
comment on function public.settle_due_exceptional_federation_elections() is
  'Destitue les présidents dont l’équipe change de fédération et conduit un scrutin exceptionnel de 48 h + 48 h.';

select public.settle_due_exceptional_federation_elections();

notify pgrst, 'reload schema';

commit;
