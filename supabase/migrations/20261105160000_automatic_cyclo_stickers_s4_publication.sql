-- The existing maintenance worker claims this one-off publication AFTER the
-- atomic season rollover commits. No trigger, new cron, player-page mutation,
-- demo grant or result/contract modification is introduced here.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';

create table public.cyclo_stickers_publication_jobs (
  id uuid primary key default gen_random_uuid(),
  source_season_id uuid not null unique references public.seasons(id) on delete restrict,
  collection_season_id uuid not null unique references public.seasons(id) on delete restrict,
  edition_id text not null unique default 'cyclo-stickers-s5-s4-final-v1'
    check(edition_id='cyclo-stickers-s5-s4-final-v1'),
  identity_stage_sha256 text not null default '1f465b5bbc8660ed64fe6eed77e64210c9f12514f08901092f17c37566d1c9f1'
    check(identity_stage_sha256='1f465b5bbc8660ed64fe6eed77e64210c9f12514f08901092f17c37566d1c9f1'),
  status text not null default 'pending' check(status in ('pending','processing','failed','published')),
  worker_id uuid,
  lease_token uuid,
  lease_expires_at timestamptz,
  attempts integer not null default 0 check(attempts>=0),
  next_attempt_at timestamptz not null default now(),
  source_facts jsonb check(source_facts is null or octet_length(source_facts::text)<=2000000),
  source_captured_at timestamptz,
  snapshot_sha256 text check(snapshot_sha256 is null or snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  published_at timestamptz,
  last_error text check(last_error is null or length(last_error)<=2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(source_season_id<>collection_season_id),
  check(status<>'processing' or (worker_id is not null and lease_token is not null and lease_expires_at is not null)),
  check((status='published')=(published_at is not null)),
  check(status<>'published' or (snapshot_sha256 is not null and lease_token is not null)),
  check((source_facts is null)=(source_captured_at is null))
);
alter table public.cyclo_stickers_publication_jobs enable row level security;
revoke all on public.cyclo_stickers_publication_jobs from public,anon,authenticated;
grant select on public.cyclo_stickers_publication_jobs to service_role;

create function public.claim_cyclo_stickers_publication(p_worker_id uuid,p_lease_seconds integer default 120)
returns jsonb language plpgsql security definer set search_path=''
set lock_timeout='300ms' set statement_timeout='3s' as $$
declare v_source uuid; v_collection uuid; v_job public.cyclo_stickers_publication_jobs%rowtype;
begin
  if p_worker_id is null or p_lease_seconds is null or p_lease_seconds not between 30 and 300 then raise exception 'Publication worker/lease invalid.'; end if;
  -- Cheap indexed season lookup on every eligible maintenance invocation.
  -- Before the S4 transaction commits there is no job and no source scan.
  select source.id,collection.id into v_source,v_collection from public.seasons source
    join public.seasons collection on collection.game_year=5 and collection.status<>'cancelled'
    where source.game_year=4 and source.status='completed'
      and exists(select 1 from public.seasons active where active.status='active' and active.game_year>=5)
    limit 1;
  if not found then return null; end if;
  insert into public.cyclo_stickers_publication_jobs(source_season_id,collection_season_id)
    values(v_source,v_collection) on conflict(source_season_id) do nothing;
  select * into v_job from public.cyclo_stickers_publication_jobs
    where source_season_id=v_source and status<>'published' and next_attempt_at<=now()
      and (status in ('pending','failed') or (status='processing' and lease_expires_at<=now()))
    for update skip locked;
  if not found then return null; end if;
  update public.cyclo_stickers_publication_jobs set status='processing',worker_id=p_worker_id,
    lease_token=gen_random_uuid(),lease_expires_at=now()+make_interval(secs=>p_lease_seconds),attempts=attempts+1,
    last_error=null,updated_at=now() where id=v_job.id returning * into v_job;
  return jsonb_build_object('jobId',v_job.id,'leaseToken',v_job.lease_token,'leaseExpiresAt',v_job.lease_expires_at,
    'editionId',v_job.edition_id,'sourceSeasonId',v_job.source_season_id,'collectionSeasonId',v_job.collection_season_id,
    'identityStageSha256',v_job.identity_stage_sha256,'attempt',v_job.attempts,'factsCached',v_job.source_facts is not null);
end;
$$;

create function private.read_cyclo_stickers_completed_s4_facts()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'context',coalesce((select jsonb_agg(to_jsonb(bounded_row)) from (select id as "sourceSeasonId",game_year as "sourceSeason",status as "sourceSeasonStatus",
      starts_on::text as "startsOn",ends_on::text as "endsOn",to_char(transaction_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "capturedAt" from public.seasons where game_year=4 limit 1) bounded_row),'[]'::jsonb),
    'ranking',coalesce((select jsonb_agg(to_jsonb(bounded_row)) from (with source as materialized (select id,game_year,status,starts_on,ends_on from public.seasons where game_year=4 and status='completed' limit 1)
      select source.id as "sourceSeasonId",summary.rider_id as "riderId",summary.uci_rank as rank,coalesce(summary.points,0) as points,coalesce(summary.victories,0) as victories
      from public.rider_season_summaries summary join source on source.id=summary.season_id
      where summary.uci_rank between 1 and 50 order by summary.uci_rank,summary.rider_id limit 51) bounded_row),'[]'::jsonb),
    'teams',coalesce((select jsonb_agg(to_jsonb(bounded_row)) from (with source as materialized (select id,game_year,status,starts_on,ends_on from public.seasons where game_year=4 and status='completed' limit 1)
      select source.id as "sourceSeasonId",team.team_id as "teamId",team.final_rank as rank,team.display_name as name,team.points
      from public.team_seasons team join source on source.id=team.season_id where team.status<>'withdrawn' and team.final_rank between 1 and 5
      order by team.final_rank,team.team_id limit 6) bounded_row),'[]'::jsonb),
    'championships',coalesce((select jsonb_agg(to_jsonb(bounded_row)) from (with source as materialized (select id,game_year,status,starts_on,ends_on from public.seasons where game_year=4 and status='completed' limit 1),champions as materialized (
  select title.rider_id,title.championship_type,title.race_edition_id,edition.status from public.rider_national_championship_titles title
  join source on source.id=title.season_id join public.race_editions edition on edition.id=title.race_edition_id and edition.season_id=source.id
  where title.championship_type in ('continental_africa_road','continental_africa_time_trial','continental_america_road','continental_america_time_trial','continental_asia_road','continental_asia_time_trial','continental_europe_road','continental_europe_time_trial','continental_oceania_road','continental_oceania_time_trial','world_road','world_time_trial','quadrennial_road') order by title.championship_type,title.id limit 14)
      select source.id as "sourceSeasonId",champions.championship_type as type,champions.rider_id as "riderId",champions.race_edition_id as "raceEditionId",
        champions.status as "raceStatus",'pro'::text as category from champions join source on true order by champions.championship_type) bounded_row),'[]'::jsonb),
    'ratings',coalesce((select jsonb_agg(to_jsonb(bounded_row)) from (with source as materialized (select id,game_year,status,starts_on,ends_on from public.seasons where game_year=4 and status='completed' limit 1), ranked as materialized (
  select summary.rider_id,summary.uci_rank from public.rider_season_summaries summary join source on source.id=summary.season_id
  where summary.uci_rank between 1 and 50 order by summary.uci_rank,summary.rider_id limit 51
), champions as materialized (
  select title.rider_id,title.championship_type,title.race_edition_id,edition.status from public.rider_national_championship_titles title
  join source on source.id=title.season_id join public.race_editions edition on edition.id=title.race_edition_id and edition.season_id=source.id
  where title.championship_type in ('continental_africa_road','continental_africa_time_trial','continental_america_road','continental_america_time_trial','continental_asia_road','continental_asia_time_trial','continental_europe_road','continental_europe_time_trial','continental_oceania_road','continental_oceania_time_trial','world_road','world_time_trial','quadrennial_road') order by title.championship_type,title.id limit 14),bonus as materialized (
  select summary.rider_id,summary.uci_rank,coalesce(summary.points,0) points,coalesce(summary.victories,0) victories
  from public.rider_season_summaries summary join source on source.id=summary.season_id
  join public.rider_season_ratings rating on rating.rider_id=summary.rider_id and rating.season_id=source.id
  where summary.uci_rank>50 and (rating.breakaway::double precision>=62 and not exists(select 1 from (values
    ((rating.mountain::double precision>=62 and rating.time_trial::double precision>=62),((rating.mountain::double precision+rating.time_trial::double precision)/2::double precision)),
    (rating.mountain::double precision>=62 and (not (rating.mountain::double precision>=62 and rating.time_trial::double precision>=62) or rating.mountain::double precision-((rating.mountain::double precision+rating.time_trial::double precision)/2::double precision)>4),rating.mountain::double precision),
    (rating.time_trial::double precision>=62 and (not (rating.mountain::double precision>=62 and rating.time_trial::double precision>=62) or rating.time_trial::double precision-((rating.mountain::double precision+rating.time_trial::double precision)/2::double precision)>4),rating.time_trial::double precision),
    (rating.hills::double precision>=62,rating.hills::double precision),(rating.sprint::double precision>=62,rating.sprint::double precision),(rating.cobbles::double precision>=62,rating.cobbles::double precision)
  ) profile(qualifies,score) where profile.qualifies and profile.score>=rating.breakaway::double precision))
  order by summary.uci_rank,summary.rider_id limit 3), members as materialized (select rider_id from ranked union select rider_id from champions union select rider_id from bonus)
      select rating.rider_id as "riderId",rating.season_id as "sourceSeasonId",rating.age,rating.mountain,rating.hills,rating.flat,rating.time_trial as "timeTrial",rating.cobbles,
        rating.sprint,rating.acceleration,rating.downhill,rating.endurance,rating.resistance,rating.recovery,rating.breakaway,rating.prologue
      from public.rider_season_ratings rating join source on source.id=rating.season_id join members on members.rider_id=rating.rider_id order by rating.rider_id limit 67) bounded_row),'[]'::jsonb),
    'honours',coalesce((select jsonb_agg(to_jsonb(bounded_row)) from (with source as materialized (select id,game_year,status,starts_on,ends_on from public.seasons where game_year=4 and status='completed' limit 1), ranked as materialized (
  select summary.rider_id,summary.uci_rank from public.rider_season_summaries summary join source on source.id=summary.season_id
  where summary.uci_rank between 1 and 50 order by summary.uci_rank,summary.rider_id limit 51
), champions as materialized (
  select title.rider_id,title.championship_type,title.race_edition_id,edition.status from public.rider_national_championship_titles title
  join source on source.id=title.season_id join public.race_editions edition on edition.id=title.race_edition_id and edition.season_id=source.id
  where title.championship_type in ('continental_africa_road','continental_africa_time_trial','continental_america_road','continental_america_time_trial','continental_asia_road','continental_asia_time_trial','continental_europe_road','continental_europe_time_trial','continental_oceania_road','continental_oceania_time_trial','world_road','world_time_trial','quadrennial_road') order by title.championship_type,title.id limit 14),bonus as materialized (
  select summary.rider_id,summary.uci_rank,coalesce(summary.points,0) points,coalesce(summary.victories,0) victories
  from public.rider_season_summaries summary join source on source.id=summary.season_id
  join public.rider_season_ratings rating on rating.rider_id=summary.rider_id and rating.season_id=source.id
  where summary.uci_rank>50 and (rating.breakaway::double precision>=62 and not exists(select 1 from (values
    ((rating.mountain::double precision>=62 and rating.time_trial::double precision>=62),((rating.mountain::double precision+rating.time_trial::double precision)/2::double precision)),
    (rating.mountain::double precision>=62 and (not (rating.mountain::double precision>=62 and rating.time_trial::double precision>=62) or rating.mountain::double precision-((rating.mountain::double precision+rating.time_trial::double precision)/2::double precision)>4),rating.mountain::double precision),
    (rating.time_trial::double precision>=62 and (not (rating.mountain::double precision>=62 and rating.time_trial::double precision>=62) or rating.time_trial::double precision-((rating.mountain::double precision+rating.time_trial::double precision)/2::double precision)>4),rating.time_trial::double precision),
    (rating.hills::double precision>=62,rating.hills::double precision),(rating.sprint::double precision>=62,rating.sprint::double precision),(rating.cobbles::double precision>=62,rating.cobbles::double precision)
  ) profile(qualifies,score) where profile.qualifies and profile.score>=rating.breakaway::double precision))
  order by summary.uci_rank,summary.rider_id limit 3), members as materialized (select rider_id from ranked union select rider_id from champions union select rider_id from bonus), honours as (
      select roster.rider_id as "riderId",source.id as "sourceSeasonId",edition.id as "raceEditionId",edition.display_name as "raceName",category.code as "categoryCode",
        'race'::text as kind,1::integer as count,result.final_rank::integer as rank
      from public.race_results result join public.race_rosters roster on roster.id=result.race_roster_id join members on members.rider_id=roster.rider_id
      join public.race_editions edition on edition.id=result.race_edition_id and edition.status='completed' join source on source.id=edition.season_id
      join public.races race on race.id=edition.race_id join public.race_categories category on category.id=edition.race_category_id
      where result.status='classified' and (result.final_rank=1 or (result.final_rank<=3 and (category.code in ('elite','world')
        or race.competition_type in ('continental_championship','world_championship') or race.competition_type like 'quadrennial%'))
        or (result.final_rank<=10 and (race.is_grand_tour or race.is_monument)))
      union all
      select roster.rider_id,source.id,edition.id,edition.display_name,category.code,'stages',count(*)::integer,null::integer
      from public.stage_results result join public.race_rosters roster on roster.id=result.race_roster_id join members on members.rider_id=roster.rider_id
      join public.stages stage on stage.id=result.stage_id join public.race_editions edition on edition.id=stage.race_edition_id and edition.status='completed'
      join source on source.id=edition.season_id join public.races race on race.id=edition.race_id and race.race_format='stage_race'
      join public.race_categories category on category.id=edition.race_category_id and category.code in ('elite','world')
      where result.status='finished' and result.rank=1 group by roster.rider_id,source.id,edition.id,edition.display_name,category.code
      union all
      select roster.rider_id,source.id,edition.id,edition.display_name,category.code,result.classification_type,1,null::integer
      from public.race_secondary_results result join public.race_rosters roster on roster.id=result.race_roster_id join members on members.rider_id=roster.rider_id
      join public.race_editions edition on edition.id=result.race_edition_id and edition.status='completed' join source on source.id=edition.season_id
      join public.races race on race.id=edition.race_id and race.race_format='stage_race'
      join public.race_categories category on category.id=edition.race_category_id and category.code in ('elite','world')
      where result.rank=1 and result.classification_type in ('mountain','sprint','youth'))
      select * from honours order by "riderId","raceEditionId",kind,rank limit 6001) bounded_row),'[]'::jsonb),
    'contracts',coalesce((select jsonb_agg(to_jsonb(bounded_row)) from (with source as materialized (select id,game_year,status,starts_on,ends_on from public.seasons where game_year=4 and status='completed' limit 1), ranked as materialized (
  select summary.rider_id,summary.uci_rank from public.rider_season_summaries summary join source on source.id=summary.season_id
  where summary.uci_rank between 1 and 50 order by summary.uci_rank,summary.rider_id limit 51
), champions as materialized (
  select title.rider_id,title.championship_type,title.race_edition_id,edition.status from public.rider_national_championship_titles title
  join source on source.id=title.season_id join public.race_editions edition on edition.id=title.race_edition_id and edition.season_id=source.id
  where title.championship_type in ('continental_africa_road','continental_africa_time_trial','continental_america_road','continental_america_time_trial','continental_asia_road','continental_asia_time_trial','continental_europe_road','continental_europe_time_trial','continental_oceania_road','continental_oceania_time_trial','world_road','world_time_trial','quadrennial_road') order by title.championship_type,title.id limit 14),bonus as materialized (
  select summary.rider_id,summary.uci_rank,coalesce(summary.points,0) points,coalesce(summary.victories,0) victories
  from public.rider_season_summaries summary join source on source.id=summary.season_id
  join public.rider_season_ratings rating on rating.rider_id=summary.rider_id and rating.season_id=source.id
  where summary.uci_rank>50 and (rating.breakaway::double precision>=62 and not exists(select 1 from (values
    ((rating.mountain::double precision>=62 and rating.time_trial::double precision>=62),((rating.mountain::double precision+rating.time_trial::double precision)/2::double precision)),
    (rating.mountain::double precision>=62 and (not (rating.mountain::double precision>=62 and rating.time_trial::double precision>=62) or rating.mountain::double precision-((rating.mountain::double precision+rating.time_trial::double precision)/2::double precision)>4),rating.mountain::double precision),
    (rating.time_trial::double precision>=62 and (not (rating.mountain::double precision>=62 and rating.time_trial::double precision>=62) or rating.time_trial::double precision-((rating.mountain::double precision+rating.time_trial::double precision)/2::double precision)>4),rating.time_trial::double precision),
    (rating.hills::double precision>=62,rating.hills::double precision),(rating.sprint::double precision>=62,rating.sprint::double precision),(rating.cobbles::double precision>=62,rating.cobbles::double precision)
  ) profile(qualifies,score) where profile.qualifies and profile.score>=rating.breakaway::double precision))
  order by summary.uci_rank,summary.rider_id limit 3), members as materialized (select rider_id from ranked union select rider_id from champions union select rider_id from bonus)
      select contract.rider_id as "riderId",contract.id as "contractId",contract.team_id as "teamId",starts.game_year as "startGameYear",ends.game_year as "endGameYear",
        contract.status,left_season.game_year as "leftGameYear",contract.left_day_number as "leftDayNumber"
      from public.rider_contracts contract join members on members.rider_id=contract.rider_id join public.seasons starts on starts.id=contract.start_season_id and starts.game_year<=4
      join public.seasons ends on ends.id=contract.end_season_id and ends.game_year>=4 left join public.seasons left_season on left_season.id=contract.left_season_id
      where contract.status in ('active','completed','terminated') order by contract.rider_id,contract.id limit 1001) bounded_row),'[]'::jsonb),
    'naturalizations',coalesce((select jsonb_agg(to_jsonb(bounded_row)) from (with source as materialized (select id,game_year,status,starts_on,ends_on from public.seasons where game_year=4 and status='completed' limit 1), ranked as materialized (
  select summary.rider_id,summary.uci_rank from public.rider_season_summaries summary join source on source.id=summary.season_id
  where summary.uci_rank between 1 and 50 order by summary.uci_rank,summary.rider_id limit 51
), champions as materialized (
  select title.rider_id,title.championship_type,title.race_edition_id,edition.status from public.rider_national_championship_titles title
  join source on source.id=title.season_id join public.race_editions edition on edition.id=title.race_edition_id and edition.season_id=source.id
  where title.championship_type in ('continental_africa_road','continental_africa_time_trial','continental_america_road','continental_america_time_trial','continental_asia_road','continental_asia_time_trial','continental_europe_road','continental_europe_time_trial','continental_oceania_road','continental_oceania_time_trial','world_road','world_time_trial','quadrennial_road') order by title.championship_type,title.id limit 14),bonus as materialized (
  select summary.rider_id,summary.uci_rank,coalesce(summary.points,0) points,coalesce(summary.victories,0) victories
  from public.rider_season_summaries summary join source on source.id=summary.season_id
  join public.rider_season_ratings rating on rating.rider_id=summary.rider_id and rating.season_id=source.id
  where summary.uci_rank>50 and (rating.breakaway::double precision>=62 and not exists(select 1 from (values
    ((rating.mountain::double precision>=62 and rating.time_trial::double precision>=62),((rating.mountain::double precision+rating.time_trial::double precision)/2::double precision)),
    (rating.mountain::double precision>=62 and (not (rating.mountain::double precision>=62 and rating.time_trial::double precision>=62) or rating.mountain::double precision-((rating.mountain::double precision+rating.time_trial::double precision)/2::double precision)>4),rating.mountain::double precision),
    (rating.time_trial::double precision>=62 and (not (rating.mountain::double precision>=62 and rating.time_trial::double precision>=62) or rating.time_trial::double precision-((rating.mountain::double precision+rating.time_trial::double precision)/2::double precision)>4),rating.time_trial::double precision),
    (rating.hills::double precision>=62,rating.hills::double precision),(rating.sprint::double precision>=62,rating.sprint::double precision),(rating.cobbles::double precision>=62,rating.cobbles::double precision)
  ) profile(qualifies,score) where profile.qualifies and profile.score>=rating.breakaway::double precision))
  order by summary.uci_rank,summary.rider_id limit 3), members as materialized (select rider_id from ranked union select rider_id from champions union select rider_id from bonus)
      select change.rider_id as "riderId",to_char(change.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "changedAt",change.season_id as "sourceSeasonId",country.name as country,country.iso_alpha2 as "countryCode"
      from public.rider_naturalizations change join members on members.rider_id=change.rider_id join source on source.id=change.season_id
      join public.countries country on country.id=change.to_country_id where change.subject_type='professional'
      order by change.rider_id,change.created_at,change.id limit 1001) bounded_row),'[]'::jsonb),
    'bonusRanking',coalesce((select jsonb_agg(to_jsonb(bounded_row)) from (with source as materialized (select id,game_year,status,starts_on,ends_on from public.seasons where game_year=4 and status='completed' limit 1),bonus as materialized (
  select summary.rider_id,summary.uci_rank,coalesce(summary.points,0) points,coalesce(summary.victories,0) victories
  from public.rider_season_summaries summary join source on source.id=summary.season_id
  join public.rider_season_ratings rating on rating.rider_id=summary.rider_id and rating.season_id=source.id
  where summary.uci_rank>50 and (rating.breakaway::double precision>=62 and not exists(select 1 from (values
    ((rating.mountain::double precision>=62 and rating.time_trial::double precision>=62),((rating.mountain::double precision+rating.time_trial::double precision)/2::double precision)),
    (rating.mountain::double precision>=62 and (not (rating.mountain::double precision>=62 and rating.time_trial::double precision>=62) or rating.mountain::double precision-((rating.mountain::double precision+rating.time_trial::double precision)/2::double precision)>4),rating.mountain::double precision),
    (rating.time_trial::double precision>=62 and (not (rating.mountain::double precision>=62 and rating.time_trial::double precision>=62) or rating.time_trial::double precision-((rating.mountain::double precision+rating.time_trial::double precision)/2::double precision)>4),rating.time_trial::double precision),
    (rating.hills::double precision>=62,rating.hills::double precision),(rating.sprint::double precision>=62,rating.sprint::double precision),(rating.cobbles::double precision>=62,rating.cobbles::double precision)
  ) profile(qualifies,score) where profile.qualifies and profile.score>=rating.breakaway::double precision))
  order by summary.uci_rank,summary.rider_id limit 3)
      select source.id as "sourceSeasonId",bonus.rider_id as "riderId",bonus.uci_rank as rank,bonus.points,bonus.victories
      from bonus join source on true order by bonus.uci_rank,bonus.rider_id) bounded_row),'[]'::jsonb)
  );
$$;

create function public.get_cyclo_stickers_final_source_facts(p_job_id uuid,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path=''
set lock_timeout='300ms' set statement_timeout='8s' as $$
declare v_job public.cyclo_stickers_publication_jobs%rowtype; v_facts jsonb; v_riders integer;
begin
  select * into v_job from public.cyclo_stickers_publication_jobs where id=p_job_id for update;
  if not found or v_job.status<>'processing' or v_job.lease_token is distinct from p_lease_token
    or v_job.lease_expires_at<=clock_timestamp() then raise exception 'Publication lease is missing, expired or superseded.'; end if;
  if v_job.source_facts is not null then return v_job.source_facts; end if;
  if not exists(select 1 from public.seasons where id=v_job.source_season_id and game_year=4 and status='completed')
    then raise exception 'S4 must be completed before capturing final facts.'; end if;
  v_facts:=private.read_cyclo_stickers_completed_s4_facts();
  if jsonb_array_length(v_facts->'context')<>1 or v_facts->'context'->0->>'sourceSeasonStatus' is distinct from 'completed'
    or v_facts->'context'->0->>'sourceSeasonId' is distinct from v_job.source_season_id::text
    or jsonb_array_length(v_facts->'ranking')<>50 or jsonb_array_length(v_facts->'teams')<>5
    or jsonb_array_length(v_facts->'championships')<>13 or jsonb_array_length(v_facts->'bonusRanking')<>3
    or jsonb_array_length(v_facts->'ratings') not between 53 and 66
    or jsonb_array_length(v_facts->'honours')>6000 or jsonb_array_length(v_facts->'contracts')>1000
    or jsonb_array_length(v_facts->'naturalizations')>1000 then raise exception 'Completed S4 facts are incomplete or exceed their bounded cardinality.'; end if;
  if exists(select 1 from jsonb_array_elements(v_facts->'ranking') with ordinality r(row,n)
      where row->>'sourceSeasonId' is distinct from v_job.source_season_id::text or row->>'rank' is distinct from n::text)
    or (select count(distinct row->>'riderId') from jsonb_array_elements(v_facts->'ranking') row)<>50
    or exists(select 1 from jsonb_array_elements(v_facts->'teams') with ordinality r(row,n)
      where row->>'sourceSeasonId' is distinct from v_job.source_season_id::text or row->>'rank' is distinct from n::text)
    or (select count(distinct row->>'teamId') from jsonb_array_elements(v_facts->'teams') row)<>5
    or (select count(distinct row->>'type') from jsonb_array_elements(v_facts->'championships') row)<>13
    or exists(select 1 from jsonb_array_elements(v_facts->'championships') row where row->>'raceStatus' is distinct from 'completed'
      or row->>'sourceSeasonId' is distinct from v_job.source_season_id::text)
    or (select count(distinct row->>'riderId') from jsonb_array_elements(v_facts->'bonusRanking') row)<>3
    or exists(select 1 from jsonb_array_elements(v_facts->'bonusRanking') with ordinality b(row,n)
      where row->>'sourceSeasonId' is distinct from v_job.source_season_id::text or coalesce((row->>'rank')::integer,0)<=50
        or (n>1 and (row->>'rank')::integer<=(v_facts->'bonusRanking'->(n::integer-2)->>'rank')::integer)
        or exists(select 1 from jsonb_array_elements(v_facts->'ranking') top50 where top50->>'riderId'=row->>'riderId'))
    then raise exception 'Final S4 ranks/titles are missing, duplicated, active or mixed-season.'; end if;
  select count(distinct id) into v_riders from (
    select row->>'riderId' id from jsonb_array_elements(v_facts->'ranking') row
    union select row->>'riderId' from jsonb_array_elements(v_facts->'championships') row
    union select row->>'riderId' from jsonb_array_elements(v_facts->'bonusRanking') row) members;
  if v_riders<>jsonb_array_length(v_facts->'ratings')
    or (select count(distinct row->>'riderId') from jsonb_array_elements(v_facts->'ratings') row)<>v_riders
    or exists(select 1 from jsonb_array_elements(v_facts->'ratings') row where row->>'sourceSeasonId' is distinct from v_job.source_season_id::text)
    then raise exception 'Native S4 ratings are missing or duplicated.'; end if;
  if octet_length(v_facts::text)>2000000 then raise exception 'Final S4 source facts exceed 2 MB.'; end if;
  if v_job.lease_expires_at<=clock_timestamp() then raise exception 'Publication lease expired during source capture.'; end if;
  update public.cyclo_stickers_publication_jobs set source_facts=v_facts,source_captured_at=clock_timestamp(),updated_at=clock_timestamp() where id=v_job.id;
  return v_facts;
end;
$$;

create function public.publish_cyclo_stickers_publication(p_job_id uuid,p_lease_token uuid,p_snapshot jsonb,p_sha256 text)
returns jsonb language plpgsql security definer set search_path=''
set lock_timeout='500ms' set statement_timeout='10s' as $$
declare v_job public.cyclo_stickers_publication_jobs%rowtype;
begin
  select * into v_job from public.cyclo_stickers_publication_jobs where id=p_job_id for update;
  if not found or v_job.lease_token is distinct from p_lease_token then raise exception 'Publication lease is missing or superseded.'; end if;
  if v_job.status='published' then
    if v_job.snapshot_sha256 is distinct from p_sha256 or not exists(select 1 from public.cyclo_stickers_editions
      where edition_id=v_job.edition_id and snapshot_sha256=p_sha256 and snapshot=p_snapshot)
      then raise exception 'A published S4 edition cannot be replaced.'; end if;
    return jsonb_build_object('published',true,'alreadyPublished',true,'editionId',v_job.edition_id,'sha256',v_job.snapshot_sha256,'publishedAt',v_job.published_at);
  end if;
  if v_job.status<>'processing' or v_job.lease_expires_at<=clock_timestamp() or v_job.source_facts is null
    then raise exception 'Publication requires a current lease and captured final facts.'; end if;
  if p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or p_snapshot->>'edition' is distinct from v_job.edition_id
    or p_snapshot->>'sourceSeasonId' is distinct from v_job.source_season_id::text
    or p_snapshot->'provenance'->'source'->'season'->>'id' is distinct from v_job.source_season_id::text
    or p_snapshot->'provenance'->'source'->'season'->>'status' is distinct from 'completed'
    or p_snapshot->'provenance'->'source'->'identityCapture'->>'sha256' is distinct from v_job.identity_stage_sha256
    or p_snapshot->'provenance'->'source'->'identityCapture'->>'sourceSeasonId' is distinct from v_job.source_season_id::text
    or p_snapshot->'provenance'->'source'->'ranking' is distinct from v_job.source_facts->'ranking'
    or p_snapshot->'provenance'->'source'->'bonusRanking' is distinct from v_job.source_facts->'bonusRanking'
    or p_snapshot->'provenance'->'source'->'championships' is distinct from v_job.source_facts->'championships'
    or p_snapshot->'provenance'->'source'->>'capturedAt' is distinct from v_job.source_facts->'context'->0->>'capturedAt'
    then raise exception 'Publication snapshot must match the trusted frozen S4 identity and captured final facts.'; end if;
  if not exists(select 1 from public.seasons where id=v_job.source_season_id and game_year=4 and status='completed')
    or not exists(select 1 from public.seasons where status='active' and game_year>=5)
    then raise exception 'S4 publication is available only after the S4 to S5 rollover.'; end if;
  -- Strict TypeScript assembly/seal happens in the trusted worker; install and
  -- durable publication acknowledgement share this short final transaction.
  perform public.install_cyclo_stickers_edition(v_job.edition_id,p_snapshot,p_sha256,'{"enabled":true,"publicApproved":true}'::jsonb);
  if v_job.lease_expires_at<=clock_timestamp() then raise exception 'Publication lease expired during install.'; end if;
  update public.cyclo_stickers_publication_jobs set status='published',snapshot_sha256=p_sha256,published_at=clock_timestamp(),
    lease_expires_at=null,last_error=null,updated_at=clock_timestamp() where id=v_job.id returning * into v_job;
  return jsonb_build_object('published',true,'alreadyPublished',false,'editionId',v_job.edition_id,'sha256',v_job.snapshot_sha256,'publishedAt',v_job.published_at);
end;
$$;

create function public.fail_cyclo_stickers_publication(p_job_id uuid,p_lease_token uuid,p_error text)
returns jsonb language plpgsql security definer set search_path=''
set lock_timeout='300ms' set statement_timeout='3s' as $$
declare v_job public.cyclo_stickers_publication_jobs%rowtype; v_delay integer;
begin
  select * into v_job from public.cyclo_stickers_publication_jobs where id=p_job_id for update;
  if not found or v_job.lease_token is distinct from p_lease_token then raise exception 'Publication lease is missing or superseded.'; end if;
  -- A client timeout after a committed publication must never turn it failed.
  if v_job.status='published' then return jsonb_build_object('status','published','editionId',v_job.edition_id); end if;
  if v_job.status<>'processing' then return jsonb_build_object('status',v_job.status,'nextAttemptAt',v_job.next_attempt_at); end if;
  v_delay:=least(3600,60*(2^least(6,greatest(0,v_job.attempts-1)))::integer);
  update public.cyclo_stickers_publication_jobs set status='failed',lease_expires_at=null,worker_id=null,
    next_attempt_at=clock_timestamp()+make_interval(secs=>v_delay),last_error=left(coalesce(nullif(btrim(p_error),''),'Publication worker failed.'),2000),
    updated_at=clock_timestamp() where id=v_job.id returning * into v_job;
  return jsonb_build_object('status','failed','nextAttemptAt',v_job.next_attempt_at,'attempt',v_job.attempts);
end;
$$;

-- Owner-approved extension: keep slots1..69 and append three genuine native
-- Baroudeurs at70..72. No chapter-completion fallback is introduced.
create function private.cyclo_stickers_primary_baroudeur(p_ratings jsonb)
returns boolean language sql immutable strict set search_path='' as $$
  select rating.mountain between 0 and 100 and rating.time_trial between 0 and 100 and rating.hills between 0 and 100
    and rating.sprint between 0 and 100 and rating.cobbles between 0 and 100 and rating.breakaway between 0 and 100
    and (rating.breakaway::double precision>=62 and not exists(select 1 from (values
    ((rating.mountain::double precision>=62 and rating.time_trial::double precision>=62),((rating.mountain::double precision+rating.time_trial::double precision)/2::double precision)),
    (rating.mountain::double precision>=62 and (not (rating.mountain::double precision>=62 and rating.time_trial::double precision>=62) or rating.mountain::double precision-((rating.mountain::double precision+rating.time_trial::double precision)/2::double precision)>4),rating.mountain::double precision),
    (rating.time_trial::double precision>=62 and (not (rating.mountain::double precision>=62 and rating.time_trial::double precision>=62) or rating.time_trial::double precision-((rating.mountain::double precision+rating.time_trial::double precision)/2::double precision)>4),rating.time_trial::double precision),
    (rating.hills::double precision>=62,rating.hills::double precision),(rating.sprint::double precision>=62,rating.sprint::double precision),(rating.cobbles::double precision>=62,rating.cobbles::double precision)
  ) profile(qualifies,score) where profile.qualifies and profile.score>=rating.breakaway::double precision))
  from (select (p_ratings->>'mountain')::double precision mountain,(p_ratings->>'timeTrial')::double precision time_trial,
    (p_ratings->>'hills')::double precision hills,(p_ratings->>'sprint')::double precision sprint,
    (p_ratings->>'cobbles')::double precision cobbles,(p_ratings->>'breakaway')::double precision breakaway) rating;
$$;
revoke all on function private.cyclo_stickers_primary_baroudeur(jsonb) from public,anon,authenticated,service_role;

do $extend_s4_catalogue$
declare v_definition text; v_old text; v_new text; v_i integer;
  v_old_rules text[]:=array[
    'jsonb_array_length(p_snapshot->''cards'')<>69',
    'if v_count<>69 or exists',
    'Les 69 emplacements de collection',
    'when n>=68 then ''holographic''',
    $old$      or (n<=50 and (card ? 'kind' or card->>'rank' is distinct from n::text))$old$,
    $old$  if exists(select 1 from jsonb_array_elements(p_snapshot->'cards') card where$old$,
    $old$  if exists(select 1 from unnest(array['bronze','silver','gold','holographic']) r where$old$
  ];
  v_new_rules text[]:=array[
    'jsonb_array_length(p_snapshot->''cards'')<>72',
    'if v_count<>72 or exists',
    'Les 72 emplacements de collection',
    'when n between 68 and 69 then ''holographic''',
    $new$      or (n<=50 and (card ? 'kind' or card->>'rank' is distinct from n::text))
      or (n between 70 and 72 and (card ? 'kind' or card ? 'rarityOverride' or card->>'profileKey' is distinct from 'breakaway'
        or coalesce((card->>'rank')::integer,0)<=50 or not coalesce(private.cyclo_stickers_primary_baroudeur(card->'ratings'),false)))$new$,
    $new$  if (select count(distinct card->>'rank') from jsonb_array_elements(p_snapshot->'cards') with ordinality c(card,n) where n between 70 and 72)<>3
    or exists(select 1 from jsonb_array_elements(p_snapshot->'cards') with ordinality c(card,n) where n between 71 and 72
      and (card->>'rank')::integer<=(p_snapshot->'cards'->(n::integer-2)->>'rank')::integer)
    then raise exception 'Les trois Baroudeurs doivent suivre leur rang UCI officiel hors top50.'; end if;
  if exists(select 1 from jsonb_array_elements(p_snapshot->'cards') card where$new$,
    $new$  if exists(select 1 from (values('bronze',33),('silver',30),('gold',7),('holographic',2)) pool(rarity,quantity)
    where (select count(*) from public.cyclo_stickers_cards c where c.edition_id=p_edition and c.rarity=pool.rarity)<>pool.quantity)
    then raise exception 'Répartition de finitions S4 invalide (33/30/7/2).'; end if;
  if exists(select 1 from unnest(array['bronze','silver','gold','holographic']) r where$new$
  ];
begin
  if exists(select 1 from public.cyclo_stickers_editions) then raise exception 'Inspect existing catalogue before expanding the unpublished S4 edition.'; end if;
  if not exists(select 1 from pg_constraint where conrelid='public.cyclo_stickers_cards'::regclass
    and conname='cyclo_stickers_cards_card_number_check' and pg_get_constraintdef(oid) like '%69%') then raise exception 'Unexpected sticker-number constraint.'; end if;
  alter table public.cyclo_stickers_cards drop constraint cyclo_stickers_cards_card_number_check;
  alter table public.cyclo_stickers_cards add constraint cyclo_stickers_cards_card_number_check check(card_number between 1 and 72);
  select replace(pg_get_functiondef('private.cyclo_stickers_default_configuration()'::regprocedure),E'\r\n',E'\n') into v_definition;
  v_old:='"target":69'; v_new:='"target":72';
  if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old)<>1 then raise exception 'Unexpected final achievement target.'; end if;
  execute replace(v_definition,v_old,v_new);
  select replace(pg_get_functiondef('public.install_cyclo_stickers_edition(text,jsonb,text,jsonb)'::regprocedure),E'\r\n',E'\n') into v_definition;
  for v_i in 1..cardinality(v_old_rules) loop
    v_old:=v_old_rules[v_i];v_new:=v_new_rules[v_i];
    if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old)<>1 then raise exception 'Unexpected S4 installer anchor %; inspect before extension.',v_i; end if;
    v_definition:=replace(v_definition,v_old,v_new);
  end loop;
  execute v_definition;
end;
$extend_s4_catalogue$;

-- Replace the provider's existing ONE indicators request; no new request,
-- card JSON, ranking load or counter refresh is added to headers.
create function public.get_current_game_header_indicators_v4()
returns table(current_sporting_director_id uuid,mailbox_unread_count integer,direct_message_unread_count integer,
  has_unread_global_chat boolean,has_unread_cyclogazette boolean,game_role text,collector_album_available boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentification requise.' using errcode='42501'; end if;
  return query select indicators.current_sporting_director_id,indicators.mailbox_unread_count,indicators.direct_message_unread_count,
    indicators.has_unread_global_chat,indicators.has_unread_cyclogazette,indicators.game_role,
    indicators.current_sporting_director_id is not null and exists(select 1 from public.cyclo_stickers_editions e
      join public.seasons source on source.id=e.source_season_id and source.game_year=4 and source.status='completed'
      join public.seasons collection on collection.id=e.collection_season_id and collection.game_year=5
      where e.configuration->>'enabled'='true' and e.configuration->>'publicApproved'='true'
        and exists(select 1 from public.seasons active where active.status='active' and active.game_year>=5))
  from public.get_current_game_header_indicators_v3() indicators;
end;
$$;

revoke all on function private.read_cyclo_stickers_completed_s4_facts() from public,anon,authenticated,service_role;
revoke all on function public.claim_cyclo_stickers_publication(uuid,integer),public.get_cyclo_stickers_final_source_facts(uuid,uuid),
  public.publish_cyclo_stickers_publication(uuid,uuid,jsonb,text),public.fail_cyclo_stickers_publication(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_cyclo_stickers_publication(uuid,integer),public.get_cyclo_stickers_final_source_facts(uuid,uuid),
  public.publish_cyclo_stickers_publication(uuid,uuid,jsonb,text),public.fail_cyclo_stickers_publication(uuid,uuid,text) to service_role;
revoke all on function public.get_current_game_header_indicators_v4() from public,anon;
grant execute on function public.get_current_game_header_indicators_v4() to authenticated,service_role;
notify pgrst,'reload schema';
commit;
