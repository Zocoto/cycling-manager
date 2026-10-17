-- PREPARED ONLY: do not apply before the owner approves the local preview.
begin;
set local lock_timeout='2s';
set local statement_timeout='10s';

-- Keep the existing national-team table/API backward compatible. Champion
-- kits get independent current/pending versions and publication history.
create table if not exists public.national_federation_champion_jerseys
  (like public.national_federation_jerseys including all);
create table if not exists public.national_federation_champion_jersey_history
  (like public.national_federation_jersey_history including all);

do $constraints$
declare v_constraint record;
begin
  -- An author's account must not be required forever to keep a nation's kit.
  alter table public.national_federation_champion_jerseys alter column published_by drop not null;
  alter table public.national_federation_champion_jersey_history alter column published_by drop not null;
  for v_constraint in select conname from pg_constraint
    where conrelid='public.national_federation_champion_jerseys'::regclass and contype='c'
      and pg_get_constraintdef(oid) like '%pending_published_by%' loop
    execute format('alter table public.national_federation_champion_jerseys drop constraint %I',v_constraint.conname);
  end loop;
  if not exists(select 1 from pg_constraint where conrelid='public.national_federation_champion_jerseys'::regclass and conname='champion_pending_shape') then
    alter table public.national_federation_champion_jerseys add constraint champion_pending_shape check(
      (pending_design is null and pending_version is null and pending_published_by is null and pending_published_at is null and pending_activation_game_year is null)
      or (jsonb_typeof(pending_design)='object' and pending_version>0 and pending_published_at is not null
        and pending_activation_game_year>0 and octet_length(pending_design::text)<=20000));
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.national_federation_champion_jerseys'::regclass and contype='f') then
    alter table public.national_federation_champion_jerseys
      add foreign key(country_id) references public.countries(id) on delete cascade,
      add foreign key(published_by) references public.sporting_directors(id) on delete set null,
      add foreign key(pending_published_by) references public.sporting_directors(id) on delete set null;
    alter table public.national_federation_champion_jersey_history
      add foreign key(country_id) references public.countries(id) on delete cascade,
      add foreign key(published_by) references public.sporting_directors(id) on delete set null;
  end if;
end;
$constraints$;

-- One-time continuity: existing national artwork is the initial champion kit,
-- not a shared pointer. Later publications cannot overwrite the other role.
with added as (
  insert into public.national_federation_champion_jerseys
    select * from public.national_federation_jerseys on conflict(country_id) do nothing
    returning country_id
)
insert into public.national_federation_champion_jersey_history
  select history.* from public.national_federation_jersey_history history join added using(country_id)
  on conflict(country_id,version) do nothing;

alter table public.national_federation_champion_jerseys enable row level security;
alter table public.national_federation_champion_jersey_history enable row level security;
drop policy if exists champion_jersey_read on public.national_federation_champion_jerseys;
create policy champion_jersey_read on public.national_federation_champion_jerseys for select to authenticated using(true);
drop policy if exists champion_jersey_history_read on public.national_federation_champion_jersey_history;
create policy champion_jersey_history_read on public.national_federation_champion_jersey_history for select to authenticated using(true);
revoke all on public.national_federation_champion_jerseys,public.national_federation_champion_jersey_history from public,anon,authenticated;
grant select on public.national_federation_champion_jerseys,public.national_federation_champion_jersey_history to authenticated;
grant all on public.national_federation_champion_jerseys,public.national_federation_champion_jersey_history to service_role;

-- Reuse the actual elected-president and next-season publication rules.
-- No weakened alternative authorization path, and no calls to gameplay jobs.
do $copy_rules$
declare v_source text;
begin
  select pg_get_functiondef('public.publish_national_federation_jersey(text,jsonb)'::regprocedure) into v_source;
  if position('Seul le président élu' in v_source)=0
     or position('activation_game_year := v_game_year + 1' in v_source)=0 then
    raise exception 'Publication rules changed: review before preparing champion publication.';
  end if;
  v_source:=replace(v_source,'public.publish_national_federation_jersey(', 'private.publish_national_champion_federation_jersey(');
  v_source:=replace(v_source,'public.national_federation_jerseys','public.national_federation_champion_jerseys');
  v_source:=replace(v_source,'public.national_federation_jersey_history','public.national_federation_champion_jersey_history');
  execute v_source;

  select pg_get_functiondef('public.activate_due_national_federation_jerseys()'::regprocedure) into v_source;
  if position('split_jersey_roles_v1' in v_source)=0 then
    if position('pending_activation_game_year <= v_game_year' in v_source)=0 then
      raise exception 'Activation rules changed: review required.';
    end if;
    execute replace(v_source,'public.activate_due_national_federation_jerseys(', 'private.activate_due_national_team_jerseys(');
    v_source:=replace(v_source,'public.activate_due_national_federation_jerseys(', 'private.activate_due_national_champion_jerseys(');
    execute replace(v_source,'public.national_federation_jerseys','public.national_federation_champion_jerseys');
  end if;
end;
$copy_rules$;

revoke all on function private.publish_national_champion_federation_jersey(text,jsonb),
  private.activate_due_national_team_jerseys(),private.activate_due_national_champion_jerseys() from public,anon,authenticated;

create or replace function public.publish_national_federation_jersey(
 p_country_code text,p_design jsonb,p_jersey_kind text
) returns table(version integer,published_at timestamptz,activation_game_year integer)
language plpgsql volatile security definer set search_path='' as $$
declare v_element jsonb;
begin
 if p_jersey_kind is null or p_jersey_kind not in('national_team','national_champion') then
   raise exception 'Le type de maillot est invalide.';
 end if;
 if p_design is null or jsonb_typeof(p_design) is distinct from 'object'
    or octet_length(p_design::text)>20000 or jsonb_typeof(p_design->'elements') is distinct from 'array' then
   raise exception 'Le maillot transmis est invalide.';
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
 if p_jersey_kind='national_champion' then
   return query select * from private.publish_national_champion_federation_jersey(p_country_code,p_design);
 else
   return query select * from public.publish_national_federation_jersey(p_country_code,p_design);
 end if;
end;
$$;
revoke all on function public.publish_national_federation_jersey(text,jsonb,text) from public,anon;
grant execute on function public.publish_national_federation_jersey(text,jsonb,text) to authenticated,service_role;

create or replace function public.activate_due_national_federation_jerseys()
returns integer language plpgsql volatile security definer set search_path='' as $$
begin
 -- split_jersey_roles_v1: the existing cron/rollover activates both roles once.
 return private.activate_due_national_team_jerseys()+private.activate_due_national_champion_jerseys();
end;
$$;
notify pgrst,'reload schema';
commit;
