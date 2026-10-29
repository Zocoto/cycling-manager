begin;
set local statement_timeout = '20s';
set local lock_timeout = '1s';
set local application_name = 'restore-mr0-botswana-roster';

-- Owner-requested recovery of Mr0's empty historical team. Eight, rather than
-- the usual seven, were explicitly requested. Standard initial generation v3:
-- seven normal archetypes and one additional polyvalent, no custom bonuses.
-- Fixed rider IDs are the receipt: a retry cannot grant a second roster.
do $repair$
declare
  v_director_id constant uuid := '70c903c0-63f3-4f48-b5ed-85708d781110';
  v_team_id constant uuid := '6d6ec2fb-196c-4c7d-8c92-eda2a6786b2d';
  v_season_id constant uuid := 'c0c5824c-43a4-442e-907c-265c479efa0a';
  v_country_id constant uuid := '88c77a8f-f889-4d47-ba12-d6bcfa70a344';
  v_rider_ids constant uuid[] := array[
    'c8667410-b027-427c-b004-85fc86724411'::uuid,
    'ae41a89c-af99-4abb-8617-a0985d3167ec'::uuid,
    '1d53d4bf-5c0a-4a57-a59b-c05d8b9afbc5'::uuid,
    '6fd2a841-021a-4cc8-90f1-2db9d9ef40ce'::uuid,
    '611e8442-0b27-4f44-bc2a-43a1ced49517'::uuid,
    '260e9486-a5f8-4248-a85f-4b9e3bf4d47a'::uuid,
    '217c127b-7b47-4f01-a296-377c1c39c001'::uuid,
    '7a54cfc3-50b3-481e-9a9b-e73b806d7d20'::uuid
  ];
  v_profile record;
  v_identity record;
  v_age_offset integer;
  v_count integer;
begin
  perform 1
  from public.sporting_directors d
  join public.team_manager_assignments a
    on a.sporting_director_id=d.id and a.role='general_manager' and a.status='active'
  join public.teams t on t.id=a.team_id and t.status='active'
  join public.seasons s on s.id=v_season_id and s.status='active'
  join public.team_seasons ts on ts.team_id=t.id and ts.season_id=s.id and ts.status='active'
  where d.id=v_director_id and d.username='Mr0' and d.status='active'
    and t.id=v_team_id and t.home_country_id=v_country_id
    and ts.registration_country_id=v_country_id
  for update of d,t,ts;
  if not found then
    raise exception 'Mr0 recovery: account, team, country or active season changed.';
  end if;

  select count(*) into v_count from public.riders where id=any(v_rider_ids);
  if v_count=8 then
    if (select count(*) from public.rider_contracts where rider_id=any(v_rider_ids)
        and team_id=v_team_id and status='active' and start_season_id=v_season_id)=8
      and (select count(*) from public.rider_season_ratings where rider_id=any(v_rider_ids)
        and season_id=v_season_id)=8 then
      raise notice 'Mr0 recovery already applied: no new rider created.';
      return;
    end if;
    raise exception 'Mr0 recovery: previous grant exists but has changed. Review manually.';
  elsif v_count<>0 then
    raise exception 'Mr0 recovery: partial fixed-ID receipt. No insertion allowed.';
  end if;

  if exists(select 1 from public.rider_contracts where team_id=v_team_id
    and status in ('active','planned')) then
    raise exception 'Mr0 recovery: team is no longer empty. No insertion allowed.';
  end if;

  select p.name_profile_code,p.avatar_profile_key into strict v_profile
  from public.countries c join public.country_rider_generation_profiles p on p.country_id=c.id
  where c.id=v_country_id and c.iso_alpha2='BW' and c.is_active;
  if v_profile.name_profile_code<>'southern_africa' then
    raise exception 'Mr0 recovery: Botswana generation profile changed.';
  end if;
  v_age_offset := (((hashtextextended(v_director_id::text,0)%7)+7)%7)::integer;

  for v_identity in
    select identity.*,profile.*
    from (values
      (1, 'c8667410-b027-427c-b004-85fc86724411'::uuid, 'Nkosinathi', 'Chinamasa', 6702850109330912::bigint),
      (2, 'ae41a89c-af99-4abb-8617-a0985d3167ec'::uuid, 'Ben', 'Mupfumi', 8213264264298240::bigint),
      (3, '1d53d4bf-5c0a-4a57-a59b-c05d8b9afbc5'::uuid, 'Tapiwa', 'Collins', 6800714325489361::bigint),
      (4, '6fd2a841-021a-4cc8-90f1-2db9d9ef40ce'::uuid, 'Tafadzwa', 'Marais', 3035186428878874::bigint),
      (5, '611e8442-0b27-4f44-bc2a-43a1ced49517'::uuid, 'Rufus', 'Scholtz', 4202248217913370::bigint),
      (6, '260e9486-a5f8-4248-a85f-4b9e3bf4d47a'::uuid, 'Allen', 'Bhengu', 9916192777189868::bigint),
      (7, '217c127b-7b47-4f01-a296-377c1c39c001'::uuid, 'Rigard', 'Henderson', 2319937477779369::bigint),
      (8, '7a54cfc3-50b3-481e-9a9b-e73b806d7d20'::uuid, 'Aubrey', 'Theron', 3711503737930354::bigint)
    ) identity(slot,rider_id,first_name,last_name,avatar_seed)
    join (values
      (1, 64,58,45,47,40,42,50,55,57,54,58,56,44),
        (2, 56,64,49,46,43,54,62,54,56,55,55,60,48),
        (3, 43,48,62,64,49,50,52,49,60,58,55,48,62),
        (4, 40,46,58,48,44,65,64,47,54,52,50,42,56),
        (5, 42,50,60,51,65,56,58,50,59,61,53,54,52),
        (6, 52,57,55,52,50,50,54,56,61,59,56,65,50),
        (7, 50,52,56,53,52,51,52,54,63,62,61,55,51)
    ) profile(profile_slot,mountain,hills,flat,time_trial,cobbles,sprint,acceleration,downhill,endurance,resistance,recovery,breakaway,prologue)
      on profile.profile_slot=least(identity.slot,7)
    order by identity.slot
  loop
    -- Keep the regular INSERT triggers enabled: potential, decline resistance,
    -- avatar v3, initial form/summary and physiology all use the live defaults.
    insert into public.riders(id,country_id,first_name,last_name,status,
      generated_name_profile_code,avatar_profile_key,avatar_seed)
    values(v_identity.rider_id,v_country_id,v_identity.first_name,v_identity.last_name,
      'active',v_profile.name_profile_code,v_profile.avatar_profile_key,v_identity.avatar_seed);

    insert into public.rider_contracts(rider_id,team_id,start_season_id,end_season_id,
      salary_per_season,currency,acquisition_type,status,signed_at)
    values(v_identity.rider_id,v_team_id,v_season_id,v_season_id,0,'EUR','initial','active',now());

    insert into public.rider_season_ratings(rider_id,season_id,age,mountain,hills,flat,time_trial,cobbles,sprint,acceleration,downhill,endurance,resistance,recovery,breakaway,prologue)
    values(v_identity.rider_id,v_season_id,18+((v_identity.slot-1+v_age_offset)%7),
      v_identity.mountain,v_identity.hills,v_identity.flat,v_identity.time_trial,v_identity.cobbles,v_identity.sprint,v_identity.acceleration,v_identity.downhill,v_identity.endurance,v_identity.resistance,v_identity.recovery,v_identity.breakaway,v_identity.prologue);

    -- Same bounded, per-rider variation and write order as career generation v3.
    update public.rider_season_ratings rating set
      mountain=private.randomize_initial_amateur_rating(rating.mountain,v_team_id,rating.rider_id,'mountain'),
      hills=private.randomize_initial_amateur_rating(rating.hills,v_team_id,rating.rider_id,'hills'),
      flat=private.randomize_initial_amateur_rating(rating.flat,v_team_id,rating.rider_id,'flat'),
      time_trial=private.randomize_initial_amateur_rating(rating.time_trial,v_team_id,rating.rider_id,'time_trial'),
      cobbles=private.randomize_initial_amateur_rating(rating.cobbles,v_team_id,rating.rider_id,'cobbles'),
      sprint=private.randomize_initial_amateur_rating(rating.sprint,v_team_id,rating.rider_id,'sprint'),
      acceleration=private.randomize_initial_amateur_rating(rating.acceleration,v_team_id,rating.rider_id,'acceleration'),
      downhill=private.randomize_initial_amateur_rating(rating.downhill,v_team_id,rating.rider_id,'downhill'),
      endurance=private.randomize_initial_amateur_rating(rating.endurance,v_team_id,rating.rider_id,'endurance'),
      resistance=private.randomize_initial_amateur_rating(rating.resistance,v_team_id,rating.rider_id,'resistance'),
      recovery=private.randomize_initial_amateur_rating(rating.recovery,v_team_id,rating.rider_id,'recovery'),
      breakaway=private.randomize_initial_amateur_rating(rating.breakaway,v_team_id,rating.rider_id,'breakaway'),
      prologue=private.randomize_initial_amateur_rating(rating.prologue,v_team_id,rating.rider_id,'prologue')
    where rating.rider_id=v_identity.rider_id and rating.season_id=v_season_id;
  end loop;

  if (select count(*) from public.rider_contracts where team_id=v_team_id and status='active')<>8
    or (select count(*) from public.riders r join public.rider_season_ratings q
      on q.rider_id=r.id and q.season_id=v_season_id
      where r.id=any(v_rider_ids) and r.country_id=v_country_id and r.status='active')<>8 then
    raise exception 'Mr0 recovery: final roster is incomplete; rolling back.';
  end if;
end;
$repair$;

commit;
