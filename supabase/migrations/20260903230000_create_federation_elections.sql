begin;

create table public.national_federation_elections (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  election_season_id uuid not null references public.seasons(id) on delete cascade,
  term_start_game_year integer not null,
  term_end_game_year integer not null,
  status text not null default 'applications',
  elected_director_id uuid references public.sporting_directors(id) on delete set null,
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  constraint national_federation_elections_term_valid check (
    term_start_game_year > 0
    and term_end_game_year = term_start_game_year + 1
  ),
  constraint national_federation_elections_status_allowed check (
    status in ('applications', 'voting', 'finalized', 'automatic')
  ),
  constraint national_federation_elections_country_term_unique
    unique (country_id, term_start_game_year)
);

create index national_federation_elections_country_term_idx
  on public.national_federation_elections (
    country_id,
    term_start_game_year desc
  );

create table public.national_federation_electorate (
  election_id uuid not null
    references public.national_federation_elections(id) on delete cascade,
  team_season_id uuid not null references public.team_seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (election_id, team_id),
  constraint national_federation_electorate_director_unique
    unique (election_id, sporting_director_id)
);

create index national_federation_electorate_director_idx
  on public.national_federation_electorate (sporting_director_id, election_id);

create table public.national_federation_candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null
    references public.national_federation_elections(id) on delete cascade,
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  manifesto text not null,
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  constraint national_federation_candidates_manifesto_length check (
    char_length(btrim(manifesto)) between 40 and 800
  ),
  constraint national_federation_candidates_director_unique
    unique (election_id, sporting_director_id),
  constraint national_federation_candidates_team_unique
    unique (election_id, team_id)
);

create index national_federation_candidates_election_created_idx
  on public.national_federation_candidates (election_id, created_at, id);

create table public.national_federation_votes (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null
    references public.national_federation_elections(id) on delete cascade,
  candidate_id uuid not null
    references public.national_federation_candidates(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  cast_at timestamptz not null default now(),
  constraint national_federation_votes_team_once unique (election_id, team_id),
  constraint national_federation_votes_director_once
    unique (election_id, sporting_director_id)
);

create index national_federation_votes_candidate_idx
  on public.national_federation_votes (candidate_id, election_id);

create table public.national_federation_terms (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  election_id uuid references public.national_federation_elections(id) on delete set null,
  start_game_year integer not null,
  end_game_year integer not null,
  governance_mode text not null default 'automatic',
  president_director_id uuid references public.sporting_directors(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint national_federation_terms_years_valid check (
    start_game_year > 0 and end_game_year = start_game_year + 1
  ),
  constraint national_federation_terms_mode_allowed check (
    governance_mode in ('automatic', 'elected')
  ),
  constraint national_federation_terms_country_start_unique
    unique (country_id, start_game_year)
);

create index national_federation_terms_country_years_idx
  on public.national_federation_terms (country_id, start_game_year, end_game_year);

create table public.national_federation_journal_entries (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete set null,
  day_number smallint,
  category text not null,
  title text not null,
  detail text not null,
  source_reference text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint national_federation_journal_day_valid check (
    day_number is null or day_number between 1 and 28
  ),
  constraint national_federation_journal_category_allowed check (
    category in ('governance', 'selection', 'finance', 'infrastructure', 'jersey', 'system')
  ),
  constraint national_federation_journal_text_present check (
    btrim(title) <> '' and btrim(detail) <> '' and btrim(source_reference) <> ''
  ),
  constraint national_federation_journal_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  ),
  constraint national_federation_journal_source_unique unique (source_reference)
);

create index national_federation_journal_country_created_idx
  on public.national_federation_journal_entries (country_id, created_at desc, id desc);

alter table public.national_federation_elections enable row level security;
alter table public.national_federation_electorate enable row level security;
alter table public.national_federation_candidates enable row level security;
alter table public.national_federation_votes enable row level security;
alter table public.national_federation_terms enable row level security;
alter table public.national_federation_journal_entries enable row level security;

create policy national_federation_elections_select_authenticated
on public.national_federation_elections for select to authenticated using (true);
create policy national_federation_electorate_select_authenticated
on public.national_federation_electorate for select to authenticated using (true);
create policy national_federation_candidates_select_authenticated
on public.national_federation_candidates for select to authenticated using (true);
create policy national_federation_terms_select_authenticated
on public.national_federation_terms for select to authenticated using (true);
create policy national_federation_journal_select_authenticated
on public.national_federation_journal_entries for select to authenticated using (true);

grant select on table public.national_federation_elections to authenticated;
grant select on table public.national_federation_electorate to authenticated;
grant select on table public.national_federation_candidates to authenticated;
grant select on table public.national_federation_terms to authenticated;
grant select on table public.national_federation_journal_entries to authenticated;
grant all on table public.national_federation_elections to service_role;
grant all on table public.national_federation_electorate to service_role;
grant all on table public.national_federation_candidates to service_role;
grant all on table public.national_federation_votes to service_role;
grant all on table public.national_federation_terms to service_role;
grant all on table public.national_federation_journal_entries to service_role;

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

  if mod(v_season.game_year, 2) = 0
     and coalesce(v_season.current_day_number, 1) >= 21 then
    with inserted as (
      insert into public.national_federation_elections (
        country_id,
        election_season_id,
        term_start_game_year,
        term_end_game_year,
        status
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
        end
      from public.team_seasons as team_season
      join public.teams as team
        on team.id = team_season.team_id
       and team.status = 'active'
      join public.countries as country
        on country.id = team_season.registration_country_id
       and country.iso_alpha2 = 'BE'
       and country.is_active = true
      where team_season.season_id = v_season.id
        and team_season.status in ('planned', 'active')
      on conflict (country_id, term_start_game_year) do nothing
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
    where election.election_season_id = v_season.id
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
    where election.election_season_id = v_season.id
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
      'federation-election:' || election.id::text || ':applications:' || electorate.sporting_director_id::text,
      true
    from public.national_federation_elections as election
    join public.countries as country on country.id = election.country_id
    join public.national_federation_electorate as electorate
      on electorate.election_id = election.id
    where election.election_season_id = v_season.id
      and election.term_start_game_year = v_season.game_year + 1
    on conflict (sporting_director_id, source_reference) do nothing;

    if coalesce(v_season.current_day_number, 1) >= 25 then
      with advanced as (
        update public.national_federation_elections
        set status = 'voting'
        where election_season_id = v_season.id
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
      where election.election_season_id = v_season.id
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
        'federation-election:' || election.id::text || ':voting:' || electorate.sporting_director_id::text,
        true
      from public.national_federation_elections as election
      join public.countries as country on country.id = election.country_id
      join public.national_federation_electorate as electorate
        on electorate.election_id = election.id
      where election.election_season_id = v_season.id
        and election.term_start_game_year = v_season.game_year + 1
      on conflict (sporting_director_id, source_reference) do nothing;
    end if;
  end if;

  if mod(v_season.game_year, 2) = 1
     and coalesce(v_season.current_day_number, 1) >= 1 then
    for v_election in
      select *
      from public.national_federation_elections
      where term_start_game_year = v_season.game_year
        and status in ('applications', 'voting')
      for update skip locked
    loop
      v_winner_director_id := null;
      v_winner_vote_count := 0;

      select
        candidate.sporting_director_id,
        count(vote.id)::integer as vote_count
      into v_winner_director_id, v_winner_vote_count
      from public.national_federation_candidates as candidate
      left join public.national_federation_votes as vote
        on vote.candidate_id = candidate.id
       and vote.election_id = candidate.election_id
      where candidate.election_id = v_election.id
        and candidate.withdrawn_at is null
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
      )
      values (
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
      )
      values (
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
          'votes', coalesce(v_winner_vote_count, 0)
        )
      )
      on conflict (source_reference) do nothing;

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
  v_election_id uuid;
  v_candidate_id uuid;
  v_manifesto text;
begin
  if (select auth.uid()) is null then
    raise exception 'Vous devez être connecté pour déposer une candidature.';
  end if;
  if upper(btrim(coalesce(p_country_code, ''))) <> 'BE' then
    raise exception 'Les élections sont limitées à la fédération belge pendant la bêta.';
  end if;

  v_manifesto := regexp_replace(btrim(coalesce(p_manifesto, '')), '\s+', ' ', 'g');
  if char_length(v_manifesto) not between 40 and 800 then
    raise exception 'La profession de foi doit contenir entre 40 et 800 caractères.';
  end if;

  perform public.settle_due_federation_elections();
  select * into v_identity
  from public.get_current_federation_identity(p_country_code);
  select * into v_season
  from public.seasons where status = 'active' limit 1;

  if v_identity.country_id is null or v_identity.team_id is null then
    raise exception 'Votre équipe ne fait pas partie de cette fédération.';
  end if;
  if mod(v_season.game_year, 2) <> 0
     or coalesce(v_season.current_day_number, 1) not between 21 and 24 then
    raise exception 'Les candidatures sont ouvertes uniquement de J21 à J24.';
  end if;

  select election.id into v_election_id
  from public.national_federation_elections as election
  where election.country_id = v_identity.country_id
    and election.term_start_game_year = v_season.game_year + 1
    and election.status = 'applications'
  limit 1;

  if v_election_id is null or not exists (
    select 1 from public.national_federation_electorate as electorate
    where electorate.election_id = v_election_id
      and electorate.team_id = v_identity.team_id
      and electorate.sporting_director_id = v_identity.sporting_director_id
  ) then
    raise exception 'Votre équipe ne figure pas sur la liste électorale figée à J21.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_election_id::text || ':' || v_identity.team_id::text, 0)
  );

  insert into public.national_federation_candidates (
    election_id,
    sporting_director_id,
    team_id,
    manifesto
  )
  values (
    v_election_id,
    v_identity.sporting_director_id,
    v_identity.team_id,
    v_manifesto
  )
  on conflict (election_id, team_id) do update
  set manifesto = excluded.manifesto
  returning id into v_candidate_id;

  insert into public.national_federation_journal_entries (
    country_id,
    season_id,
    day_number,
    category,
    title,
    detail,
    source_reference
  )
  values (
    v_identity.country_id,
    v_season.id,
    v_season.current_day_number,
    'governance',
    'Nouvelle candidature',
    v_identity.display_name || ' présente sa candidature au nom de ' || v_identity.team_name || '.',
    'federation-election:' || v_election_id::text || ':candidate:' || v_candidate_id::text
  )
  on conflict (source_reference) do nothing;

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
  v_election_id uuid;
  v_vote_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Vous devez être connecté pour voter.';
  end if;
  if upper(btrim(coalesce(p_country_code, ''))) <> 'BE' then
    raise exception 'Les élections sont limitées à la fédération belge pendant la bêta.';
  end if;

  perform public.settle_due_federation_elections();
  select * into v_identity
  from public.get_current_federation_identity(p_country_code);
  select * into v_season
  from public.seasons where status = 'active' limit 1;

  if v_identity.country_id is null or v_identity.team_id is null then
    raise exception 'Votre équipe ne fait pas partie de cette fédération.';
  end if;
  if mod(v_season.game_year, 2) <> 0
     or coalesce(v_season.current_day_number, 1) not between 25 and 28 then
    raise exception 'Le vote est ouvert uniquement de J25 à J28.';
  end if;

  select election.id into v_election_id
  from public.national_federation_elections as election
  where election.country_id = v_identity.country_id
    and election.term_start_game_year = v_season.game_year + 1
    and election.status = 'voting'
  limit 1;

  if v_election_id is null or not exists (
    select 1 from public.national_federation_electorate as electorate
    where electorate.election_id = v_election_id
      and electorate.team_id = v_identity.team_id
      and electorate.sporting_director_id = v_identity.sporting_director_id
  ) then
    raise exception 'Votre équipe ne figure pas sur la liste électorale.';
  end if;
  if not exists (
    select 1 from public.national_federation_candidates as candidate
    where candidate.id = p_candidate_id
      and candidate.election_id = v_election_id
      and candidate.withdrawn_at is null
  ) then
    raise exception 'Cette candidature n’est pas valide pour ce scrutin.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_election_id::text || ':' || v_identity.team_id::text, 0)
  );

  insert into public.national_federation_votes (
    election_id,
    candidate_id,
    team_id,
    sporting_director_id,
    cast_at
  )
  values (
    v_election_id,
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
  )
  values (
    v_identity.country_id,
    v_season.id,
    v_season.current_day_number,
    'governance',
    'Participation au scrutin',
    v_identity.team_name || ' a enregistré sa voix. Le choix reste secret jusqu’à la clôture.',
    'federation-election:' || v_election_id::text || ':vote:' || v_identity.team_id::text
  )
  on conflict (source_reference) do nothing;

  return v_vote_id;
end;
$$;

revoke all on function public.settle_due_federation_elections()
  from public, anon, authenticated;
revoke all on function public.submit_national_federation_candidacy(text, text)
  from public, anon;
revoke all on function public.vote_national_federation_president(text, uuid)
  from public, anon;
grant execute on function public.settle_due_federation_elections() to service_role;
grant execute on function public.submit_national_federation_candidacy(text, text)
  to authenticated, service_role;
grant execute on function public.vote_national_federation_president(text, uuid)
  to authenticated, service_role;

comment on table public.national_federation_electorate is
  'Liste électorale figée à J21 : une équipe et une voix par fédération.';
comment on table public.national_federation_votes is
  'Votes privés modifiables jusqu’à J28 ; seul le dernier choix de l’équipe compte.';
comment on function public.settle_due_federation_elections() is
  'Ouvre et clôt les élections fédérales par lots idempotents, puis garantit le mode automatique sans élu.';

notify pgrst, 'reload schema';

commit;
