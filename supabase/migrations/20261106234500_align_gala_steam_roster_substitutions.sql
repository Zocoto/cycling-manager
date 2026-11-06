begin;
set local lock_timeout='500ms';
set local statement_timeout='5s';
set local application_name='gala-steam-substitutions-20261106';

-- Owner-approved Steam-compatible exhibition replacements only.
-- All 22 original positions are pinned; the eight mountain riders are unchanged.
-- No rider, contract, official race, result, award, condition or finance changes.
do $steam_gala_lineups$
declare
  v_registration constant uuid := '72d5f15a-939b-45fe-83a5-26bc293211cf';
  v_team constant uuid := 'c7d4f299-3430-4aaf-a029-ac9b97a07ed2';
  v_season constant uuid := 'c0c5824c-43a4-442e-907c-265c479efa0a';
  v_before constant jsonb := '[{"profile":"hills","position":1,"rider_id":"bba478c5-d588-4575-b973-f50f0765036f"},{"profile":"hills","position":2,"rider_id":"90ae3de1-af6f-447a-9ff9-4c346d27862c"},{"profile":"hills","position":3,"rider_id":"1480bf3a-f781-41ee-8a80-8d9c61ddcfe5"},{"profile":"hills","position":4,"rider_id":"8b2210cd-45d1-42e6-95d2-0595b4f85055"},{"profile":"hills","position":5,"rider_id":"d922c976-3762-4f66-bf93-51fed148d065"},{"profile":"hills","position":6,"rider_id":"4ac8a8b2-fe1d-493d-84bc-551f0241326f"},{"profile":"hills","position":7,"rider_id":"a6a6a446-9b11-42d2-a97b-3cb0edd32916"},{"profile":"mountain","position":1,"rider_id":"ed560026-792d-456c-b4d6-484e46d9020a"},{"profile":"mountain","position":2,"rider_id":"fd16efdc-9dc4-4857-bc01-f1f104f39457"},{"profile":"mountain","position":3,"rider_id":"65b687e6-386f-4d2e-8443-7f6ba06839e8"},{"profile":"mountain","position":4,"rider_id":"c3adc4d1-478d-4a82-9522-111e5bc64228"},{"profile":"mountain","position":5,"rider_id":"e2e86b16-a3a3-45f4-89ef-afe3c3de7d56"},{"profile":"mountain","position":6,"rider_id":"2cb0d755-8a97-4be7-aabb-ca489d8a52e9"},{"profile":"mountain","position":7,"rider_id":"2a41b6da-9f1d-4cb8-b0b9-6043eedf614f"},{"profile":"mountain","position":8,"rider_id":"90ae3de1-af6f-447a-9ff9-4c346d27862c"},{"profile":"sprint","position":1,"rider_id":"e3496fbc-3b2b-40c0-b8d7-4b05a8e666b8"},{"profile":"sprint","position":2,"rider_id":"2cb0d755-8a97-4be7-aabb-ca489d8a52e9"},{"profile":"sprint","position":3,"rider_id":"4ac8a8b2-fe1d-493d-84bc-551f0241326f"},{"profile":"sprint","position":4,"rider_id":"d02400be-86ce-4788-9aad-b696595dff94"},{"profile":"sprint","position":5,"rider_id":"0e9d2051-42d0-485f-b7c2-ac65c167a278"},{"profile":"sprint","position":6,"rider_id":"2a41b6da-9f1d-4cb8-b0b9-6043eedf614f"},{"profile":"sprint","position":7,"rider_id":"6dedb80f-f35d-4bee-9040-646fafc50fbb"}]'::jsonb;
  v_after constant jsonb := '[{"profile":"hills","position":1,"rider_id":"bba478c5-d588-4575-b973-f50f0765036f"},{"profile":"hills","position":2,"rider_id":"90ae3de1-af6f-447a-9ff9-4c346d27862c"},{"profile":"hills","position":3,"rider_id":"2a41b6da-9f1d-4cb8-b0b9-6043eedf614f"},{"profile":"hills","position":4,"rider_id":"8b2210cd-45d1-42e6-95d2-0595b4f85055"},{"profile":"hills","position":5,"rider_id":"d922c976-3762-4f66-bf93-51fed148d065"},{"profile":"hills","position":6,"rider_id":"ed560026-792d-456c-b4d6-484e46d9020a"},{"profile":"hills","position":7,"rider_id":"a6a6a446-9b11-42d2-a97b-3cb0edd32916"},{"profile":"mountain","position":1,"rider_id":"ed560026-792d-456c-b4d6-484e46d9020a"},{"profile":"mountain","position":2,"rider_id":"fd16efdc-9dc4-4857-bc01-f1f104f39457"},{"profile":"mountain","position":3,"rider_id":"65b687e6-386f-4d2e-8443-7f6ba06839e8"},{"profile":"mountain","position":4,"rider_id":"c3adc4d1-478d-4a82-9522-111e5bc64228"},{"profile":"mountain","position":5,"rider_id":"e2e86b16-a3a3-45f4-89ef-afe3c3de7d56"},{"profile":"mountain","position":6,"rider_id":"2cb0d755-8a97-4be7-aabb-ca489d8a52e9"},{"profile":"mountain","position":7,"rider_id":"2a41b6da-9f1d-4cb8-b0b9-6043eedf614f"},{"profile":"mountain","position":8,"rider_id":"90ae3de1-af6f-447a-9ff9-4c346d27862c"},{"profile":"sprint","position":1,"rider_id":"e3496fbc-3b2b-40c0-b8d7-4b05a8e666b8"},{"profile":"sprint","position":2,"rider_id":"2cb0d755-8a97-4be7-aabb-ca489d8a52e9"},{"profile":"sprint","position":3,"rider_id":"bba478c5-d588-4575-b973-f50f0765036f"},{"profile":"sprint","position":4,"rider_id":"d02400be-86ce-4788-9aad-b696595dff94"},{"profile":"sprint","position":5,"rider_id":"0e9d2051-42d0-485f-b7c2-ac65c167a278"},{"profile":"sprint","position":6,"rider_id":"2a41b6da-9f1d-4cb8-b0b9-6043eedf614f"},{"profile":"sprint","position":7,"rider_id":"6dedb80f-f35d-4bee-9040-646fafc50fbb"}]'::jsonb;
  v_actual jsonb;
  v_event text;
  v_count integer;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('gala-s4:'||v_team::text,0)) then
    raise exception 'The gala registration is being edited; repair stopped.';
  end if;
  foreach v_event in array array['continental:mountain','continental:hills','continental:sprint'] loop
    if not pg_try_advisory_xact_lock(hashtextextended('season-four-gala:'||v_event,0)) then
      raise exception 'A Continental result is being imported; repair stopped.';
    end if;
  end loop;
  perform 1 from public.season_gala_registrations r join public.seasons s on s.id=r.season_id
    where r.id=v_registration and r.team_id=v_team and r.season_id=v_season
      and r.program='continental' and s.game_year=4 for update of r;
  if not found then raise exception 'The exact Gala S4 registration was not found; repair stopped.'; end if;
  perform 1 from public.season_gala_registration_riders
    where registration_id=v_registration order by profile,position for update;
  select coalesce(jsonb_agg(jsonb_build_object('profile',profile,'position',position,'rider_id',rider_id) order by profile,position),'[]'::jsonb) into v_actual from public.season_gala_registration_riders where registration_id=v_registration;
  if v_actual=v_after then return; end if;
  if v_actual<>v_before then raise exception 'The original 22 Gala roster rows changed; repair stopped.'; end if;
  if exists(select 1 from public.season_gala_result_imports
    where season_id=v_season and split_part(event_key,':',1)='continental') then
    raise exception 'Continental results were already imported; the ordinary freeze is preserved.';
  end if;
  select count(*) into v_count from (values
    ('2a41b6da-9f1d-4cb8-b0b9-6043eedf614f'::uuid,12739),
    ('ed560026-792d-456c-b4d6-484e46d9020a'::uuid,10565),
    ('bba478c5-d588-4575-b973-f50f0765036f'::uuid,12532)
  ) wanted(rider_id,pcm_id)
  join public.riders r on r.id=wanted.rider_id and r.pcm_export_id=wanted.pcm_id
  join public.rider_season_ratings n on n.rider_id=r.id and n.season_id=v_season
  where n.mountain between 1 and 75 and n.hills between 1 and 75 and n.flat between 1 and 75
    and n.time_trial between 1 and 75 and n.cobbles between 1 and 75 and n.sprint between 1 and 75
    and exists(select 1 from public.rider_contracts c
      join public.seasons starts on starts.id=c.start_season_id
      join public.seasons ends on ends.id=c.end_season_id
      left join public.seasons departed on departed.id=c.left_season_id
      where c.rider_id=r.id and c.team_id=v_team and c.status in('active','completed','terminated')
        and starts.game_year<=4 and ends.game_year>=4
        and (c.left_season_id is null or departed.game_year>=4));
  if v_count<>3 then
    raise exception 'A replacement lacks its exact Steam ID, eligible S4 ratings or source-club contract.';
  end if;
  update public.season_gala_registration_riders roster
  set rider_id=change.new_rider_id
  from (values
    ('hills'::text,3::smallint,'1480bf3a-f781-41ee-8a80-8d9c61ddcfe5'::uuid,'2a41b6da-9f1d-4cb8-b0b9-6043eedf614f'::uuid),
    ('hills'::text,6::smallint,'4ac8a8b2-fe1d-493d-84bc-551f0241326f'::uuid,'ed560026-792d-456c-b4d6-484e46d9020a'::uuid),
    ('sprint'::text,3::smallint,'4ac8a8b2-fe1d-493d-84bc-551f0241326f'::uuid,'bba478c5-d588-4575-b973-f50f0765036f'::uuid)
  ) change(profile,position,old_rider_id,new_rider_id)
  where roster.registration_id=v_registration and roster.profile=change.profile
    and roster.position=change.position and roster.rider_id=change.old_rider_id;
  get diagnostics v_count=row_count;
  if v_count<>3 then raise exception 'Expected exactly three Gala replacements; transaction cancelled.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('profile',profile,'position',position,'rider_id',rider_id) order by profile,position),'[]'::jsonb) into v_actual from public.season_gala_registration_riders where registration_id=v_registration;
  if v_actual<>v_after then raise exception 'A protected position or profile changed; transaction cancelled.'; end if;
end;
$steam_gala_lineups$;

select true aligned,count(*) roster_rows,
  count(*) filter(where profile='mountain') mountain_rows,
  count(*) filter(where profile='hills') hills_rows,
  count(*) filter(where profile='sprint') sprint_rows
from public.season_gala_registration_riders where registration_id='72d5f15a-939b-45fe-83a5-26bc293211cf'::uuid;
commit;
