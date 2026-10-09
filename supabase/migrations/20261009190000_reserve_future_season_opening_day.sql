-- Keep S4 exactly as played. From S5 onward J1 is reserved for preparation.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';

do $patch$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef('private.find_free_standard_race_start_day(uuid,uuid,integer,integer,uuid)'::regprocedure)
    into v_definition;
  if position('generate_series(1, 29 - p_duration)' in v_definition)>0 then
    execute replace(v_definition,'generate_series(1, 29 - p_duration)','generate_series(2, 29 - p_duration)');
  elsif position('generate_series(2, 29 - p_duration)' in v_definition)=0 then
    raise exception 'Unexpected free-day formula; migration aborted.';
  end if;
  select pg_catalog.pg_get_functiondef('private.normalize_standard_race_country_spacing(uuid)'::regprocedure)
    into v_definition;
  if position('v_min_day + v_candidate_offset < 1' in v_definition)>0 then
    execute replace(v_definition,'v_min_day + v_candidate_offset < 1','v_min_day + v_candidate_offset < 2');
  elsif position('v_min_day + v_candidate_offset < 2' in v_definition)=0 then
    raise exception 'Unexpected country-spacing lower bound; migration aborted.';
  end if;
end;
$patch$;

create or replace function private.reserve_future_season_opening_day(p_season_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_edition record;
  v_start integer;
  v_moved integer := 0;
begin
  if not exists(select 1 from public.seasons where id=p_season_id and status='planned' and game_year>=5) then
    return 0;
  end if;
  set constraints public.stages_day_slot_unique deferred;
  for v_edition in
    select e.id,r.country_id,min(d.day_number)::integer start_day,
      (max(d.day_number)-min(d.day_number)+1)::integer duration
    from public.race_editions e join public.races r on r.id=e.race_id
    join public.stages t on t.race_edition_id=e.id
    join public.season_days d on d.id=t.season_day_id
    where e.season_id=p_season_id and e.status in ('planned','registration_open')
      and r.competition_type='standard'
      and not exists(select 1 from public.stages x where x.race_edition_id=e.id and x.status<>'planned')
      and not exists(select 1 from public.stage_results x join public.stages st on st.id=x.stage_id where st.race_edition_id=e.id)
      and not exists(select 1 from public.official_stage_simulations x join public.stages st on st.id=x.stage_id where st.race_edition_id=e.id)
    group by e.id,r.country_id having min(d.day_number)=1 order by e.id
  loop
    v_start := private.find_free_standard_race_start_day(p_season_id,v_edition.country_id,2,v_edition.duration,v_edition.id);
    if v_start is null then raise exception 'No free opening-day replacement for edition %.',v_edition.id; end if;
    update public.stages t set season_day_id=target.id,
      departure_at=(target.calendar_date::timestamp+case t.day_slot when 'early' then time '14:00' else time '18:00' end) at time zone 'Europe/Paris'
    from public.season_days original,public.season_days target
    where t.race_edition_id=v_edition.id and original.id=t.season_day_id
      and target.season_id=p_season_id and target.day_number=original.day_number+v_start-1;
    update public.race_editions set
      registration_closes_at=((registration_closes_at at time zone 'Europe/Paris')+make_interval(days=>v_start-1)) at time zone 'Europe/Paris',
      withdrawal_closes_at=((withdrawal_closes_at at time zone 'Europe/Paris')+make_interval(days=>v_start-1)) at time zone 'Europe/Paris'
    where id=v_edition.id;
    v_moved:=v_moved+1;
  end loop;
  return v_moved;
end;
$$;
revoke all on function private.reserve_future_season_opening_day(uuid) from public,anon,authenticated;

do $repair$
declare v_season record; v_definition text; v_marker text;
begin
  for v_season in select id from public.seasons where status='planned' and game_year>=5 order by game_year loop
    perform private.reserve_future_season_opening_day(v_season.id);
  end loop;
  select pg_catalog.pg_get_functiondef('public.provision_season_race_calendar(uuid,uuid)'::regprocedure) into v_definition;
  v_marker:='  perform public.compact_planned_stage_races(p_target_season_id);';
  if position('perform private.reserve_future_season_opening_day(p_target_season_id);' in v_definition)=0 then
    if position(v_marker in v_definition)=0 then raise exception 'Unexpected provisioning hook; migration aborted.'; end if;
    execute replace(v_definition,v_marker,E'  perform private.reserve_future_season_opening_day(p_target_season_id);\n'||v_marker);
  end if;
end;
$repair$;

create or replace function private.enforce_future_season_opening_day()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Read final rows: provisioning may relocate several stages atomically.
  if exists(select 1 from public.stages t join public.race_editions e on e.id=t.race_edition_id
    join public.seasons s on s.id=e.season_id join public.season_days d on d.id=t.season_day_id
    where t.id=new.id and s.game_year>=5 and s.status in ('planned','active') and d.day_number=1
      and t.status<>'cancelled' and e.status<>'cancelled') then
    raise exception 'J1 est réservé à la préparation de la saison : aucune course ne peut y être programmée.';
  end if;
  return null;
end;
$$;
revoke all on function private.enforce_future_season_opening_day() from public,anon,authenticated;
drop trigger if exists enforce_future_season_opening_day on public.stages;
create constraint trigger enforce_future_season_opening_day after insert or update on public.stages
  deferrable initially deferred for each row execute function private.enforce_future_season_opening_day();

do $verify$
begin
  if exists(select 1 from public.stages t join public.race_editions e on e.id=t.race_edition_id
    join public.seasons s on s.id=e.season_id join public.season_days d on d.id=t.season_day_id
    where s.game_year>=5 and s.status='planned' and d.day_number=1 and t.status<>'cancelled' and e.status<>'cancelled') then
    raise exception 'A future season still contains a J1 race; migration aborted.';
  end if;
end;
$verify$;
commit;
