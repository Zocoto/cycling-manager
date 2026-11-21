begin;
set local application_name = 'cyclostratege-gala-s5-registration-20261121';
set local lock_timeout = '1s';
set local statement_timeout = '10s';

-- Edition-scoped storage. S3/S4 registrations, result keys and rewards remain
-- untouched. No financial, training, morale or sporting write is performed.
create table if not exists public.season_gala_editions (
  id uuid primary key default gen_random_uuid(),
  source_season_id uuid not null unique references public.seasons(id) on delete restrict,
  target_game_year integer not null check (target_game_year > 0),
  status text not null default 'draft' check (status in ('draft','open','closed')),
  visibility text not null default 'private' check (visibility in ('private','public')),
  registration_opens_at timestamptz not null,
  registration_closes_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (registration_closes_at > registration_opens_at)
);
create table if not exists public.season_gala_events (
  edition_id uuid not null references public.season_gala_editions(id) on delete restrict,
  event_key text not null,
  program text not null check (program in ('pro-tour','continental')),
  position smallint not null check (position between 1 and 3),
  pcm_race_id integer not null check (pcm_race_id > 0),
  pcm_stage_id integer not null check (pcm_stage_id > 0),
  stage_file text not null check (stage_file ~ '^[a-z0-9_]+\.cds$'),
  startlist_filename text not null check (startlist_filename ~ '^[a-z0-9_]+\.xml$'),
  native_capacity smallint not null check (native_capacity > 1),
  native_min_riders smallint not null check (native_min_riders between 1 and 8),
  native_max_riders smallint not null check (native_max_riders between native_min_riders and 8),
  min_riders smallint not null default 7 check (min_riders = 7),
  max_riders smallint not null default 8 check (max_riders = 8),
  primary key (edition_id,event_key),
  unique (edition_id,event_key,program),
  unique (edition_id,program,position),
  unique (edition_id,pcm_race_id),
  unique (edition_id,pcm_stage_id),
  unique (edition_id,stage_file),
  unique (edition_id,startlist_filename)
);
create table if not exists public.season_gala_entries (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.season_gala_editions(id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete restrict,
  program text not null check (program in ('pro-tour','continental')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id,auth_user_id),
  unique (edition_id,team_id),
  unique (edition_id,id,program)
);
-- Admission is kept separately from individual race lineups. A rider admitted
-- to Continental at <=75 remains eligible after natural training progression.
create table if not exists public.season_gala_entry_admissions (
  entry_id uuid not null references public.season_gala_entries(id) on delete cascade,
  rider_id uuid not null references public.riders(id) on delete restrict,
  primary_snapshot jsonb not null check (jsonb_typeof(primary_snapshot) = 'object'),
  admitted_at timestamptz not null default now(),
  primary key (entry_id,rider_id)
);
create table if not exists public.season_gala_entry_riders (
  entry_id uuid not null,
  edition_id uuid not null,
  event_key text not null,
  program text not null,
  rider_id uuid not null,
  position smallint not null check (position between 1 and 8),
  primary key (entry_id,event_key,rider_id),
  unique (entry_id,event_key,position),
  foreign key (edition_id,entry_id,program) references public.season_gala_entries(edition_id,id,program) on delete cascade,
  foreign key (edition_id,event_key,program) references public.season_gala_events(edition_id,event_key,program) on delete restrict,
  foreign key (entry_id,rider_id) references public.season_gala_entry_admissions(entry_id,rider_id) on delete restrict
);
create index if not exists season_gala_entry_riders_event_idx
  on public.season_gala_entry_riders(edition_id,event_key,entry_id);

alter table public.season_gala_editions enable row level security;
alter table public.season_gala_events enable row level security;
alter table public.season_gala_entries enable row level security;
alter table public.season_gala_entry_admissions enable row level security;
alter table public.season_gala_entry_riders enable row level security;
revoke all on public.season_gala_editions,public.season_gala_events,public.season_gala_entries,
  public.season_gala_entry_admissions,public.season_gala_entry_riders from public,anon,authenticated;
grant select on public.season_gala_editions,public.season_gala_events,public.season_gala_entries,
  public.season_gala_entry_admissions,public.season_gala_entry_riders to service_role;

insert into public.season_gala_editions(source_season_id,target_game_year,status,registration_opens_at,registration_closes_at)
select id,6,'open',timestamptz '2026-11-21 00:00:00 Europe/Paris',timestamptz '2026-12-04 12:00:00 Europe/Paris'
from public.seasons where game_year=5
on conflict (source_season_id) do nothing;
insert into public.season_gala_events(edition_id,event_key,program,position,pcm_race_id,pcm_stage_id,
  stage_file,startlist_filename,native_capacity,native_min_riders,native_max_riders)
select e.id,v.* from public.season_gala_editions e join public.seasons s on s.id=e.source_season_id and s.game_year=5
cross join (values
  ('pt-zoncolan','pro-tour',1,135,14135,'top_giro_14_2021.cds','top_giro.xml',23,8,8),
  ('pt-liege','pro-tour',2,87,1087,'topclas_lbl_2019.cds','topclas_lbl.xml',25,7,7),
  ('pt-flanders','pro-tour',3,11,1011,'topclas_rondevv_2024.cds','topclas_rondevv.xml',25,7,7),
  ('ct-alpe','continental',1,25,12025,'top_tdf_12_2022.cds','top_tdf.xml',23,7,8),
  ('ct-fleche','continental',2,15,1015,'topclas_fleche_2024.cds','topclas_fleche.xml',25,6,8),
  ('ct-hamburg','continental',3,26,1026,'topclas_hamburg_2023.cds','topclas_hamburg.xml',24,7,7)
) v(event_key,program,position,pcm_race_id,pcm_stage_id,stage_file,startlist_filename,native_capacity,native_min_riders,native_max_riders)
on conflict (edition_id,event_key) do nothing;

create or replace function private.current_season_five_gala_team()
returns uuid language plpgsql stable set search_path = '' as $$
declare v_team uuid; v_count integer;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Authentification requise.'; end if;
  select min(a.team_id::text)::uuid,count(distinct a.team_id) into v_team,v_count
  from public.sporting_directors d
  join public.team_manager_assignments a on a.sporting_director_id=d.id and a.role='general_manager' and a.status='active'
  join public.teams t on t.id=a.team_id and t.status='active'
  join public.team_seasons ts on ts.team_id=t.id
  join public.seasons s on s.id=ts.season_id and s.game_year=5
  join public.seasons first_season on first_season.id=a.start_season_id
  left join public.seasons last_season on last_season.id=a.end_season_id
  where d.auth_user_id=auth.uid() and d.status='active' and first_season.game_year<=5
    and (last_season.id is null or last_season.game_year>=5);
  if v_count>1 then raise exception 'Plusieurs équipes actives : contactez l’organisation.'; end if;
  return v_team;
end;$$;

create or replace function private.season_five_gala_can_access(p_edition uuid)
returns boolean language sql stable set search_path = '' as $$
  select auth.uid() is not null and (
    auth.uid() in ('58140add-54c6-40af-9528-f823d0051d0f'::uuid,'ee244935-5722-4626-a28f-dc3cf63aa6f4'::uuid)
    or exists(select 1 from public.season_gala_editions where id=p_edition and visibility='public'));
$$;

create or replace function private.season_five_gala_team_identity(p_team uuid)
returns jsonb language sql stable set search_path = '' as $$
  with source as (
    select ts.team_id,ts.display_name from public.team_seasons ts
    join public.seasons s on s.id=ts.season_id and s.game_year=5 where ts.team_id=p_team
  ), target as (select id from public.seasons where game_year=6), principal as (
    select sponsor.name,sponsor.catalog_key,
      case when c.pending_jersey_season_id=target.id then coalesce(c.pending_jersey_id,c.selected_jersey_id) else c.selected_jersey_id end jersey_id,
      case when c.pending_jersey_season_id=target.id then coalesce(c.pending_jersey_style,c.selected_jersey_style) else c.selected_jersey_style end jersey_style
    from target join public.team_sponsor_contracts c on c.team_id=p_team and c.role='principal' and c.status in ('planned','active')
    join public.seasons starts on starts.id=c.start_season_id and starts.game_year<=6 and starts.game_year+c.contract_duration_seasons-1>=6
    join public.sponsors sponsor on sponsor.id=c.sponsor_id
    order by (c.status='planned') desc,starts.game_year desc,c.created_at desc,c.id limit 1
  ), secondary as (
    select sponsor.name from target
    join public.secondary_sponsor_contracts c on c.team_id=p_team and c.season_id=target.id and c.status in ('planned','active')
    join public.secondary_sponsor_catalog sponsor on sponsor.id=c.secondary_sponsor_id limit 1
  ), resolved as (
    select source.*,principal.name primary_name,principal.catalog_key,principal.jersey_id,principal.jersey_style,secondary.name secondary_name,
      target.id is not null and (principal.name is not null or not exists (
        select 1 from public.team_sponsor_contracts c join public.seasons starts on starts.id=c.start_season_id
        where c.team_id=p_team and c.role='principal' and c.status in ('active','completed')
          and starts.game_year<=5 and starts.game_year+c.contract_duration_seasons-1>=5
      )) ready
    from source left join target on true left join principal on true left join secondary on true
  )
  select jsonb_build_object('id',team_id,'name',display_name,'futureName',
    case when ready then coalesce(primary_name,display_name)||coalesce(' - '||secondary_name,'')
      else display_name||' · identité S6 à confirmer' end,
    'identityReady',ready,'jerseyId',jersey_id,'jerseyStyle',jersey_style,'sponsorCatalogKey',catalog_key)
  from resolved;
$$;

create or replace function private.season_five_gala_roster(p_team uuid,p_entry uuid)
returns table(rider_id uuid,first_name text,last_name text,age smallint,
  mountain numeric,hills numeric,flat numeric,time_trial numeric,cobbles numeric,sprint numeric,
  acceleration numeric,downhill numeric,endurance numeric,resistance numeric,recovery numeric,breakaway numeric,prologue numeric,
  continental_eligible boolean,frozen_admission boolean)
language sql stable set search_path = '' as $$
  select r.id,r.first_name,r.last_name,n.age,
    n.mountain::numeric,n.hills::numeric,n.flat::numeric,n.time_trial::numeric,n.cobbles::numeric,n.sprint::numeric,
    n.acceleration::numeric,n.downhill::numeric,n.endurance::numeric,n.resistance::numeric,n.recovery::numeric,n.breakaway::numeric,n.prologue::numeric,
    (n.mountain between 1 and 75 and n.hills between 1 and 75 and n.flat between 1 and 75
      and n.time_trial between 1 and 75 and n.cobbles between 1 and 75 and n.sprint between 1 and 75) or admitted.valid,
    admitted.valid
  from (select distinct c.rider_id from public.rider_contracts c where c.team_id=p_team and c.status in ('active','completed')) candidate
  join public.riders r on r.id=candidate.rider_id and r.status='active'
  join public.rider_season_ratings n on n.rider_id=r.id
  join public.seasons s on s.id=n.season_id and s.game_year=5
  join lateral (
    select c.team_id from public.rider_contracts c
    join public.seasons starts on starts.id=c.start_season_id and starts.game_year<=5
    join public.seasons ends on ends.id=c.end_season_id and ends.game_year>=5
    left join public.seasons departed on departed.id=c.left_season_id
    where c.rider_id=r.id and c.status in ('active','completed') and (c.left_season_id is null or departed.game_year>5)
    order by starts.game_year desc,coalesce(c.joined_day_number,1) desc,c.signed_at desc nulls last,c.id limit 1
  ) owner on owner.team_id=p_team
  cross join lateral (
    select exists(select 1 from public.season_gala_entry_admissions a
      join public.season_gala_entries e on e.id=a.entry_id and e.program='continental' and e.team_id=p_team
      where a.entry_id=p_entry and a.rider_id=r.id
        and (a.primary_snapshot->>'mountain')::numeric between 1 and 75
        and (a.primary_snapshot->>'hills')::numeric between 1 and 75
        and (a.primary_snapshot->>'flat')::numeric between 1 and 75
        and (a.primary_snapshot->>'time_trial')::numeric between 1 and 75
        and (a.primary_snapshot->>'cobbles')::numeric between 1 and 75
        and (a.primary_snapshot->>'sprint')::numeric between 1 and 75) valid
  ) admitted;
$$;

create or replace function public.get_current_season_five_gala_context()
returns jsonb language plpgsql stable security definer set search_path = '' set statement_timeout = '5s' as $$
declare v_team uuid; v_edition public.season_gala_editions%rowtype; v_entry public.season_gala_entries%rowtype; v_status text;
begin
  v_team:=private.current_season_five_gala_team();
  select e.* into v_edition from public.season_gala_editions e
    join public.seasons s on s.id=e.source_season_id and s.game_year=5;
  select status into v_status from public.seasons where id=v_edition.source_season_id;
  if not private.season_five_gala_can_access(v_edition.id) then
    raise exception using errcode='42501',message='L’aperçu du gala est réservé à l’organisation.';
  end if;
  select * into v_entry from public.season_gala_entries where edition_id=v_edition.id and auth_user_id=auth.uid();
  return jsonb_build_object(
    'isOpen',coalesce(v_edition.status='open' and v_status in ('active','completed')
      and now()>=v_edition.registration_opens_at and now()<v_edition.registration_closes_at,false),
    'closesAt',coalesce(v_edition.registration_closes_at,timestamptz '2026-12-04 12:00:00 Europe/Paris'),
    'sourceSeasonId',v_edition.source_season_id,'targetGameYear',6,
    'team',private.season_five_gala_team_identity(v_team),'program',v_entry.program,
    'selections',coalesce((select jsonb_object_agg(event.event_key,coalesce(selection.ids,'[]'::jsonb))
      from public.season_gala_events event
      left join lateral (select jsonb_agg(rider_id order by position) ids from public.season_gala_entry_riders
        where entry_id=v_entry.id and event_key=event.event_key) selection on true
      where event.edition_id=v_edition.id and event.program=v_entry.program),'{}'::jsonb),
    'riders',coalesce((select jsonb_agg(to_jsonb(r) order by last_name,first_name,rider_id)
      from private.season_five_gala_roster(v_team,case when v_entry.team_id=v_team then v_entry.id end) r),'[]'::jsonb),
    'courseCounts',coalesce((select jsonb_object_agg(event.event_key,coalesce(counts.total,0))
      from public.season_gala_events event left join lateral (
        select count(*) total from (select entry_id from public.season_gala_entry_riders
          where edition_id=v_edition.id and event_key=event.event_key group by entry_id having count(*) between 7 and 8) complete
      ) counts on true where event.edition_id=v_edition.id),'{}'::jsonb));
end;$$;

create or replace function public.save_current_season_five_gala_registration(
  p_program text,p_selections jsonb,p_previous_program text default null
)
returns uuid language plpgsql security definer set search_path = '' set lock_timeout = '1s' set statement_timeout = '5s' as $$
declare
  v_team uuid; v_edition public.season_gala_editions%rowtype; v_status text;
  v_entry public.season_gala_entries%rowtype; v_course text; v_courses text[]; v_ids uuid[]; v_all uuid[] := '{}';
  v_valid integer; v_nonempty integer := 0; v_now timestamptz;
begin
  v_team:=private.current_season_five_gala_team();
  if v_team is null then raise exception 'Aucune équipe de saison 5 à inscrire.'; end if;
  if p_program is null or p_program not in ('pro-tour','continental')
    or (p_previous_program is not null and p_previous_program not in ('pro-tour','continental')) then
    raise exception 'Programme du gala invalide.';
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended('season-gala-s5:'||auth.uid()::text,0)) then
    raise exception using errcode='40001',message='Une inscription est déjà en cours. Réessayez.';
  end if;
  select e.* into v_edition from public.season_gala_editions e
    join public.seasons s on s.id=e.source_season_id and s.game_year=5 for share of e;
  select status into v_status from public.seasons where id=v_edition.source_season_id;
  if not private.season_five_gala_can_access(v_edition.id) then
    raise exception using errcode='42501',message='L’aperçu du gala est réservé à l’organisation.';
  end if;
  v_now:=clock_timestamp();
  if v_edition.id is null or v_edition.status<>'open' or v_status not in ('active','completed')
    or v_now<v_edition.registration_opens_at or v_now>=v_edition.registration_closes_at then
    raise exception 'Les inscriptions du gala sont closes.';
  end if;
  perform 1 from public.teams where id=v_team for update;
  select * into v_entry from public.season_gala_entries where edition_id=v_edition.id and auth_user_id=auth.uid() for update;
  if v_entry.id is not null and v_entry.team_id<>v_team then raise exception 'Vous disposez déjà d’une inscription pour une autre équipe.'; end if;
  if exists(select 1 from public.season_gala_entries where edition_id=v_edition.id and team_id=v_team and auth_user_id<>auth.uid()) then
    raise exception 'Cette équipe est déjà inscrite par un autre DS.';
  end if;
  if v_entry.program is distinct from p_previous_program then raise exception 'Votre catégorie a changé. Rechargez la page avant de continuer.'; end if;
  select array_agg(event_key order by position) into v_courses from public.season_gala_events where edition_id=v_edition.id and program=p_program;
  if cardinality(v_courses) is distinct from 3 or p_selections is null or jsonb_typeof(p_selections)<>'object' or pg_column_size(p_selections)>16384 then
    raise exception 'Compositions du gala invalides.';
  end if;
  if (select count(*) from jsonb_object_keys(p_selections))<>3
    or exists(select 1 from jsonb_object_keys(p_selections) key where not key=any(v_courses)) then
    raise exception 'Trois compositions du même programme sont requises.';
  end if;
  foreach v_course in array v_courses loop
    if jsonb_typeof(p_selections->v_course) is distinct from 'array' then raise exception 'Chaque course exige 7 à 8 coureurs distincts.'; end if;
    if jsonb_array_length(p_selections->v_course) not in (0,7,8)
      or exists(select 1 from jsonb_array_elements(p_selections->v_course) value where jsonb_typeof(value)<>'string')
      or exists(select 1 from jsonb_array_elements_text(p_selections->v_course) value where value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
      raise exception 'Chaque course exige 7 à 8 coureurs distincts.';
    end if;
    select coalesce(array_agg(value::uuid),'{}'::uuid[]) into v_ids from jsonb_array_elements_text(p_selections->v_course) value;
    if (select count(distinct rider) from unnest(v_ids) rider)<>cardinality(v_ids) then raise exception 'Chaque course exige 7 à 8 coureurs distincts.'; end if;
    if cardinality(v_ids)>0 then v_nonempty:=v_nonempty+1; end if;
    v_all:=v_all||v_ids;
  end loop;
  if v_nonempty=0 then raise exception 'Sélectionnez au moins une course du gala.'; end if;
  -- At most 24 selected riders. Stable lock ordering also protects the
  -- admission snapshot from simultaneous training or contract changes. The
  -- parent lock blocks a new contract FK while existing contracts are shared.
  perform 1 from public.riders where id=any(v_all) order by id for update;
  perform 1 from public.rider_contracts where rider_id=any(v_all) and status in ('active','completed') order by id for share;
  perform 1 from public.rider_season_ratings where rider_id=any(v_all) and season_id=v_edition.source_season_id order by rider_id for share;
  select count(*) into v_valid from private.season_five_gala_roster(v_team,
    case when v_entry.program=p_program then v_entry.id end) r
    where r.rider_id=any(v_all) and (p_program='pro-tour' or r.continental_eligible);
  if v_valid<>(select count(distinct rider) from unnest(v_all) rider) then
    raise exception 'Coureur hors effectif de saison 5 ou inéligible : en Continental, chaque note primaire native doit être de 75 maximum, sans équipement.';
  end if;
  if v_entry.id is null then
    insert into public.season_gala_entries(edition_id,auth_user_id,team_id,program)
      values(v_edition.id,auth.uid(),v_team,p_program) returning * into v_entry;
  else
    delete from public.season_gala_entry_riders where entry_id=v_entry.id;
    if v_entry.program<>p_program then delete from public.season_gala_entry_admissions where entry_id=v_entry.id; end if;
    update public.season_gala_entries set program=p_program,updated_at=v_now where id=v_entry.id;
  end if;
  insert into public.season_gala_entry_admissions(entry_id,rider_id,primary_snapshot)
  select v_entry.id,r.rider_id,jsonb_build_object('mountain',r.mountain,'hills',r.hills,'flat',r.flat,
    'time_trial',r.time_trial,'cobbles',r.cobbles,'sprint',r.sprint)
  from private.season_five_gala_roster(v_team,null) r where r.rider_id=any(v_all)
  on conflict (entry_id,rider_id) do nothing;
  foreach v_course in array v_courses loop
    insert into public.season_gala_entry_riders(entry_id,edition_id,event_key,program,rider_id,position)
      select v_entry.id,v_edition.id,v_course,p_program,value::uuid,position::smallint
      from jsonb_array_elements_text(p_selections->v_course) with ordinality selected(value,position);
  end loop;
  return v_entry.id;
end;$$;

create or replace function public.withdraw_current_season_five_gala_registration()
returns void language plpgsql security definer set search_path = '' set lock_timeout = '1s' set statement_timeout = '5s' as $$
declare v_team uuid; v_edition public.season_gala_editions%rowtype; v_status text; v_entry uuid; v_now timestamptz;
begin
  v_team:=private.current_season_five_gala_team();
  if v_team is null then raise exception 'Aucune équipe de saison 5 à inscrire.'; end if;
  if not pg_try_advisory_xact_lock(hashtextextended('season-gala-s5:'||auth.uid()::text,0)) then
    raise exception using errcode='40001',message='Une inscription est déjà en cours. Réessayez.';
  end if;
  select e.* into v_edition from public.season_gala_editions e
    join public.seasons s on s.id=e.source_season_id and s.game_year=5 for share of e;
  select status into v_status from public.seasons where id=v_edition.source_season_id;
  if not private.season_five_gala_can_access(v_edition.id) then
    raise exception using errcode='42501',message='L’aperçu du gala est réservé à l’organisation.';
  end if;
  v_now:=clock_timestamp();
  if v_edition.id is null or v_edition.status<>'open' or v_status not in ('active','completed')
    or v_now<v_edition.registration_opens_at or v_now>=v_edition.registration_closes_at then
    raise exception 'Les inscriptions du gala sont closes.';
  end if;
  select id into v_entry from public.season_gala_entries where edition_id=v_edition.id and auth_user_id=auth.uid() and team_id=v_team for update;
  delete from public.season_gala_entry_riders where entry_id=v_entry;
  delete from public.season_gala_entries where id=v_entry;
end;$$;

revoke all on function private.current_season_five_gala_team(),private.season_five_gala_team_identity(uuid),
  private.season_five_gala_roster(uuid,uuid),private.season_five_gala_can_access(uuid) from public,anon,authenticated;
revoke all on function public.get_current_season_five_gala_context(),
  public.save_current_season_five_gala_registration(text,jsonb,text),
  public.withdraw_current_season_five_gala_registration() from public,anon;
grant execute on function public.get_current_season_five_gala_context(),
  public.save_current_season_five_gala_registration(text,jsonb,text),
  public.withdraw_current_season_five_gala_registration() to authenticated;
comment on table public.season_gala_entries is 'One category per authenticated DS and team per gala edition. Ownership-checked atomic RPCs only.';
comment on table public.season_gala_entry_admissions is 'Frozen native primary admission for Continental; natural progress is retained without clipping. Current S5 club membership still required.';
comment on table public.season_gala_events is 'Six unique PCM race/stage/startlist identities per S5 gala; native roster limits must be harmonized to 7–8 in the future export.';
notify pgrst,'reload schema';
commit;
