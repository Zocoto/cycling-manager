begin;
set local lock_timeout='3s';
set local statement_timeout='15s';

-- Keep completed editions and their results. Retire the current/future programme.
-- Audit before-images allow the narrowly scoped cancellation to be recovered.
create table public.junior_nations_cup_retirement_audits (
  object_type text not null, object_id uuid not null, snapshot jsonb not null,
  recorded_at timestamptz not null default now(), primary key(object_type,object_id)
);
alter table public.junior_nations_cup_retirement_audits enable row level security;
revoke all on public.junior_nations_cup_retirement_audits from public,anon,authenticated;
grant select on public.junior_nations_cup_retirement_audits to service_role;

do $preflight$
begin
  if exists(select 1 from public.national_federation_hosting_awards a
    where a.event_type='nations_cup_junior' and a.status='scheduled'
      and a.target_game_year >= (select game_year from public.seasons where status='active' limit 1)) then
    raise exception 'Review hosting-cost refunds before retiring the junior cup';
  end if;
  if exists(select 1 from public.development_race_editions e join public.seasons s on s.id=e.season_id
    where e.competition_type='nations_cup_junior' and s.status<>'completed' and e.status<>'completed'
      and exists(select 1 from public.development_race_results r where r.race_edition_id=e.id)) then
    raise exception 'Junior cup has results: do not cancel a started event';
  end if;
end;
$preflight$;

create or replace function public.federation_selection_slot_is_available(p_slot_key text,p_game_year integer)
returns boolean language sql immutable strict set search_path='' as $$
 select p_slot_key<>'nc-junior-road' and (p_game_year<4 or p_game_year%4<>0
   or p_slot_key not in('nc-mountain','nc-sprint','nc-cobbles','nc-time-trial'));
$$;

-- Patch only reviewed boundaries; preserve all the other international logic.
do $patch$
declare v_definition text; v_start integer; v_end integer;
begin
  v_definition:=replace(pg_get_functiondef('public.ensure_federation_junior_championship_calendar(uuid)'::regprocedure),chr(13),'');
  v_start:=position(E'  insert into public.development_race_editions (\n    season_id, slug, name, short_name, location_name, country_code,\n    start_day_number, end_day_number, profile_type, race_format,\n    is_world_championship, selection_minimum, selection_maximum,\n    competition_type, selection_mode, points_scale, reward_pool,\n    championship_continent_code\n  ) values (' in v_definition);
  v_end:=position(E'  update public.development_race_editions\n  set selection_mode' in v_definition);
  if v_start=0 or v_end<=v_start or position('nations-cup-juniors' in substring(v_definition from v_start for v_end-v_start))=0 then
    raise exception 'Junior calendar retirement anchors changed';
  end if;
  v_definition:=substring(v_definition from 1 for v_start-1)||substring(v_definition from v_end);
  v_definition:=replace(v_definition,'''continental_road'', ''continental_time_trial'', ''nations_cup_junior''','''continental_road'', ''continental_time_trial''');
  execute v_definition;

  v_definition:=replace(pg_get_functiondef('public.sync_national_federation_junior_lineup(uuid)'::regprocedure),chr(13),'');
  if position('if v_slot.rider_category <> ''junior''' in v_definition)=0 then raise exception 'Junior sync anchor changed'; end if;
  execute replace(v_definition,'if v_slot.rider_category <> ''junior''',
    'if v_slot.slot_key = ''nc-junior-road'' or v_slot.rider_category <> ''junior''');

  v_definition:=replace(pg_get_functiondef('public.ensure_automatic_federation_junior_lineups(uuid)'::regprocedure),chr(13),'');
  if position('if v_edition.id is null' in v_definition)=0 then raise exception 'Junior automatic selection anchor changed'; end if;
  execute replace(v_definition,'if v_edition.id is null',
    'if v_edition.competition_type = ''nations_cup_junior'' or v_edition.id is null');
end;
$patch$;

-- Close the API too: a stale browser or direct RPC cannot create new hosting bids.
create function public.guard_retired_junior_cup_hosting() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.event_type='nations_cup_junior' and new.target_game_year>=4
    and new.status in ('pending','selected','scheduled') then
    raise exception 'La Nations Cup junior a été retirée du programme.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_retired_junior_cup_hosting() from public,anon,authenticated;
create trigger guard_retired_junior_cup_hosting before insert or update
on public.national_federation_hosting_candidacies for each row execute function public.guard_retired_junior_cup_hosting();
create trigger guard_retired_junior_cup_award before insert or update
on public.national_federation_hosting_awards for each row execute function public.guard_retired_junior_cup_hosting();

create temporary table retired_junior_cup_editions on commit drop as
 select e.id,e.season_id from public.development_race_editions e join public.seasons s on s.id=e.season_id
 where e.competition_type='nations_cup_junior' and s.status<>'completed' and e.status<>'completed';
create temporary table retired_junior_cup_lists on commit drop as
 select l.id from public.national_federation_selection_lists l join public.seasons s on s.id=l.season_id
 where l.slot_key='nc-junior-road' and s.status<>'completed';

insert into public.junior_nations_cup_retirement_audits(object_type,object_id,snapshot)
 select 'edition',e.id,to_jsonb(e) from public.development_race_editions e join retired_junior_cup_editions x on x.id=e.id
 union all select 'list',l.id,to_jsonb(l) from public.national_federation_selection_lists l join retired_junior_cup_lists x on x.id=l.id
 union all select 'member',m.id,to_jsonb(m) from public.national_federation_selection_members m join retired_junior_cup_lists x on x.id=m.selection_list_id
 union all select 'federation_registration',r.id,to_jsonb(r) from public.national_federation_junior_race_registrations r join retired_junior_cup_editions x on x.id=r.race_edition_id
 union all select 'development_registration',r.id,to_jsonb(r) from public.development_race_registrations r join retired_junior_cup_editions x on x.id=r.race_edition_id;

-- Declined members and withdrawn registrations no longer reserve any rider.
update public.national_federation_selection_members m set response_status='declined',responded_at=now()
 from retired_junior_cup_lists x where m.selection_list_id=x.id and m.response_status<>'declined';
update public.national_federation_selection_lists l set status='draft',updated_at=now()
 from retired_junior_cup_lists x where l.id=x.id;
update public.national_federation_junior_race_registrations r set status='withdrawn',synced_at=now()
 from retired_junior_cup_editions x where r.race_edition_id=x.id and r.status<>'completed';
update public.development_race_registrations r set status='withdrawn',updated_at=now()
 from retired_junior_cup_editions x where r.race_edition_id=x.id and r.status<>'completed';
update public.development_race_editions e set status='cancelled',updated_at=now()
 from retired_junior_cup_editions x where e.id=x.id;
update public.national_federation_hosting_candidacies set status='withdrawn',decided_at=now(),updated_at=now()
 where event_type='nations_cup_junior' and target_game_year>=4 and status='pending';

-- Remove actionable notifications, retaining them in the archived mailbox.
update public.sporting_director_messages message set archived_at=coalesce(message.archived_at,now())
 where message.season_id in(select season_id from retired_junior_cup_editions)
 and message.message_type='international_selection'
 and (message.subject ilike '%Nations Cup junior%' or message.preview ilike '%Nations Cup junior%'
   or exists(select 1 from public.national_federation_selection_members m join retired_junior_cup_lists x on x.id=m.selection_list_id
     where message.source_reference like 'federation%:'||m.id::text||'%'));

notify pgrst,'reload schema';
commit;
