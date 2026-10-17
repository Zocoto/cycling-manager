-- Owner-approved immediate publication; no new cron, polling or gameplay job.
begin;
set local lock_timeout='2s';
set local statement_timeout='10s';

create or replace function private.publish_federation_jersey_now(
  p_country_code text, p_design jsonb, p_jersey_kind text
) returns table(version integer, published_at timestamptz, activation_game_year integer)
language plpgsql volatile security definer set search_path='' as $$
declare
  v_country_id uuid;
  v_director_id uuid;
  v_game_year integer;
  v_target_term_start integer;
  v_version integer;
  v_published_at timestamptz := now();
  v_element jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Vous devez être connecté pour composer un maillot national.';
  end if;
  if p_jersey_kind is null or p_jersey_kind not in('national_team','national_champion') then
    raise exception 'Le type de maillot est invalide.';
  end if;
  if p_design is null or jsonb_typeof(p_design) is distinct from 'object'
     or octet_length(p_design::text)>20000
     or coalesce(p_design->>'schemaVersion','')<>'2'
     or jsonb_typeof(p_design->'elements') is distinct from 'array'
     or coalesce(p_design->>'baseColor','') !~ '^#[0-9A-F]{6}$' then
    raise exception 'Le maillot transmis est invalide.';
  end if;
  if jsonb_array_length(p_design->'elements')>16 then
    raise exception 'Le maillot contient trop de calques.';
  end if;
  for v_element in select value from jsonb_array_elements(p_design->'elements') loop
    if coalesce(v_element->>'kind','') not in('flag','emblem','band','shape','text') then
      raise exception 'Le maillot contient un élément inconnu.';
    end if;
    if v_element->>'kind'='text' and (jsonb_typeof(v_element->'text') is distinct from 'string'
        or char_length(btrim(coalesce(v_element->>'text',''))) not between 1 and 32
        or (v_element->>'text') ~ '[[:cntrl:]]') then
      raise exception 'Le texte du maillot doit contenir entre 1 et 32 caractères.';
    end if;
  end loop;

  select identity.country_id, identity.sporting_director_id into v_country_id,v_director_id
  from public.get_current_federation_identity(p_country_code) as identity;
  select season.game_year into v_game_year from public.seasons as season where season.status='active' limit 1;
  if v_country_id is null or v_director_id is null or v_game_year is null then
    raise exception 'Seule une équipe affiliée peut composer ce maillot.';
  end if;
  -- Preserve the existing current/exceptional/upcoming elected-president rules.
  v_target_term_start := case when mod(v_game_year,2)=0 then v_game_year+1 else v_game_year end;
  if not exists (
    select 1 from public.national_federation_terms as term
    where term.country_id=v_country_id and term.start_game_year<=v_game_year and term.end_game_year>=v_game_year
      and term.governance_mode='elected' and term.president_director_id=v_director_id
  ) and not exists (
    select 1 from public.national_federation_elections as election
    where election.country_id=v_country_id
      and (election.term_start_game_year=v_target_term_start
        or (election.election_type='exceptional' and election.term_start_game_year<=v_game_year and election.term_end_game_year>=v_game_year))
      and election.status='finalized' and election.elected_director_id=v_director_id
  ) then
    raise exception 'Seul le président élu peut modifier le maillot national.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_country_id::text||':federation-jersey',0));

  -- Exactly one row upsert and one history insert per validation, as before.
  -- No rider update, stat mutation or scheduled activation is needed.
  if p_jersey_kind='national_champion' then
    insert into public.national_federation_champion_jerseys as jersey
      (country_id,design,version,published_by,published_at,active_from_game_year)
    values(v_country_id,p_design,1,v_director_id,v_published_at,v_game_year)
    on conflict(country_id) do update set
      design=excluded.design, version=greatest(jersey.version,coalesce(jersey.pending_version,0))+1,
      published_by=excluded.published_by,published_at=excluded.published_at,active_from_game_year=excluded.active_from_game_year,
      pending_design=null,pending_version=null,pending_published_by=null,pending_published_at=null,pending_activation_game_year=null,updated_at=now()
    returning jersey.version into v_version;
    insert into public.national_federation_champion_jersey_history(country_id,version,design,published_by,published_at)
    values(v_country_id,v_version,p_design,v_director_id,v_published_at);
  else
    insert into public.national_federation_jerseys as jersey
      (country_id,design,version,published_by,published_at,active_from_game_year)
    values(v_country_id,p_design,1,v_director_id,v_published_at,v_game_year)
    on conflict(country_id) do update set
      design=excluded.design, version=greatest(jersey.version,coalesce(jersey.pending_version,0))+1,
      published_by=excluded.published_by,published_at=excluded.published_at,active_from_game_year=excluded.active_from_game_year,
      pending_design=null,pending_version=null,pending_published_by=null,pending_published_at=null,pending_activation_game_year=null,updated_at=now()
    returning jersey.version into v_version;
    insert into public.national_federation_jersey_history(country_id,version,design,published_by,published_at)
    values(v_country_id,v_version,p_design,v_director_id,v_published_at);
  end if;
  version:=v_version;
  published_at:=v_published_at;
  activation_game_year:=v_game_year;
  return next;
end;
$$;
revoke all on function private.publish_federation_jersey_now(text,jsonb,text) from public,anon,authenticated;

create or replace function public.publish_national_federation_jersey(p_country_code text,p_design jsonb,p_jersey_kind text)
returns table(version integer,published_at timestamptz,activation_game_year integer)
language sql volatile security definer set search_path='' as $$
  select * from private.publish_federation_jersey_now(p_country_code,p_design,p_jersey_kind);
$$;
create or replace function public.publish_national_federation_jersey(p_country_code text,p_design jsonb)
returns table(version integer,published_at timestamptz,activation_game_year integer)
language sql volatile security definer set search_path='' as $$
  select * from private.publish_federation_jersey_now(p_country_code,p_design,'national_team');
$$;
revoke all on function public.publish_national_federation_jersey(text,jsonb),public.publish_national_federation_jersey(text,jsonb,text) from public,anon;
grant execute on function public.publish_national_federation_jersey(text,jsonb),public.publish_national_federation_jersey(text,jsonb,text) to authenticated,service_role;
comment on function public.publish_national_federation_jersey(text,jsonb) is 'Publie immédiatement la tenue de sélection, exclusivement pour le président élu.';
comment on function public.publish_national_federation_jersey(text,jsonb,text) is 'Publie immédiatement le maillot du rôle choisi, sans modifier les coureurs ni la simulation.';
drop function if exists private.publish_national_champion_federation_jersey(text,jsonb);

-- Previously validated compositions also stop waiting for the next season.
-- Their versions/history/authors stay intact; this is a bounded one-time change.
do $$
declare v_game_year integer;
begin
  select game_year into v_game_year from public.seasons where status='active' limit 1;
  if v_game_year is null then return; end if;
  update public.national_federation_jerseys set design=pending_design,version=pending_version,
    published_by=pending_published_by,published_at=pending_published_at,active_from_game_year=v_game_year,
    pending_design=null,pending_version=null,pending_published_by=null,pending_published_at=null,pending_activation_game_year=null,updated_at=now()
  where pending_design is not null;
  update public.national_federation_champion_jerseys set design=pending_design,version=pending_version,
    published_by=pending_published_by,published_at=pending_published_at,active_from_game_year=v_game_year,
    pending_design=null,pending_version=null,pending_published_by=null,pending_published_at=null,pending_activation_game_year=null,updated_at=now()
  where pending_design is not null;
end;
$$;
notify pgrst,'reload schema';
commit;
