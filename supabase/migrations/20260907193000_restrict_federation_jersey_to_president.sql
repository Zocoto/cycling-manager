begin;

-- La publication précédente contrôlait seulement l'affiliation. Elle
-- exposait aussi une ambiguïté PL/pgSQL entre la colonne `version` et la
-- colonne de sortie homonyme. La décision doit appartenir au président élu,
-- y compris pendant la préparation de son prochain mandat.
create or replace function public.publish_national_federation_jersey(
  p_country_code text,
  p_design jsonb
)
returns table (
  version integer,
  published_at timestamptz,
  activation_game_year integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_country_id uuid;
  v_director_id uuid;
  v_game_year integer;
  v_target_term_start integer;
  v_version integer;
  v_published_at timestamptz := now();
begin
  if (select auth.uid()) is null then
    raise exception 'Vous devez être connecté pour composer un maillot national.';
  end if;
  if p_design is null or jsonb_typeof(p_design) <> 'object'
     or octet_length(p_design::text) > 20000
     or coalesce(p_design ->> 'schemaVersion', '') <> '2'
     or jsonb_typeof(p_design -> 'elements') <> 'array'
     or jsonb_array_length(p_design -> 'elements') > 16
     or coalesce(p_design ->> 'baseColor', '') !~ '^#[0-9A-F]{6}$' then
    raise exception 'Le maillot transmis est invalide.';
  end if;

  select identity.country_id, identity.sporting_director_id
  into v_country_id, v_director_id
  from public.get_current_federation_identity(p_country_code) as identity;

  select season.game_year
  into v_game_year
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_country_id is null or v_director_id is null or v_game_year is null then
    raise exception 'Seule une équipe affiliée peut composer ce maillot.';
  end if;

  v_target_term_start := case
    when mod(v_game_year, 2) = 0 then v_game_year + 1
    else v_game_year
  end;

  if not exists (
    select 1
    from public.national_federation_terms as term
    where term.country_id = v_country_id
      and term.start_game_year <= v_game_year
      and term.end_game_year >= v_game_year
      and term.governance_mode = 'elected'
      and term.president_director_id = v_director_id
  ) and not exists (
    select 1
    from public.national_federation_elections as election
    where election.country_id = v_country_id
      and (
        election.term_start_game_year = v_target_term_start
        or (
          election.election_type = 'exceptional'
          and election.term_start_game_year <= v_game_year
          and election.term_end_game_year >= v_game_year
        )
      )
      and election.status = 'finalized'
      and election.elected_director_id = v_director_id
  ) then
    raise exception 'Seul le président élu peut modifier le maillot national.';
  end if;

  activation_game_year := v_game_year + 1;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_country_id::text || ':federation-jersey', 0)
  );

  select greatest(
    jersey.version,
    coalesce(jersey.pending_version, 0)
  ) + 1
  into v_version
  from public.national_federation_jerseys as jersey
  where jersey.country_id = v_country_id
  for update;
  v_version := coalesce(v_version, 1);

  insert into public.national_federation_jerseys (
    country_id,
    design,
    version,
    published_by,
    published_at,
    active_from_game_year,
    pending_design,
    pending_version,
    pending_published_by,
    pending_published_at,
    pending_activation_game_year,
    updated_at
  ) values (
    v_country_id,
    p_design,
    v_version,
    v_director_id,
    v_published_at,
    null,
    p_design,
    v_version,
    v_director_id,
    v_published_at,
    activation_game_year,
    now()
  ) on conflict (country_id) do update set
    pending_design = excluded.pending_design,
    pending_version = excluded.pending_version,
    pending_published_by = excluded.pending_published_by,
    pending_published_at = excluded.pending_published_at,
    pending_activation_game_year = excluded.pending_activation_game_year,
    updated_at = now();

  insert into public.national_federation_jersey_history (
    country_id,
    version,
    design,
    published_by,
    published_at
  ) values (
    v_country_id,
    v_version,
    p_design,
    v_director_id,
    v_published_at
  );

  version := v_version;
  published_at := v_published_at;
  return next;
end;
$$;

revoke all on function public.publish_national_federation_jersey(text, jsonb)
  from public, anon;
grant execute on function public.publish_national_federation_jersey(text, jsonb)
  to authenticated, service_role;

comment on function public.publish_national_federation_jersey(text, jsonb) is
  'Réserve le maillot de la prochaine saison, exclusivement pour le président élu de la fédération.';

commit;
