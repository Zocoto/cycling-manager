begin;
set local application_name='cyclostratege-gazette-active-polls-20261124';
set local lock_timeout='1s';
set local statement_timeout='10s';

-- One pool for every future team/rider subject and race option. Daily presence
-- is genuine in-game activity; retired telemetry and account creation dates do
-- not substitute for it. All professional native ratings must be initialized.
create or replace function private.cyclogazette_poll_candidate_riders(p_season_id uuid)
returns table(team_season_id uuid,team_id uuid,team_name text,rider_id uuid,
  rider_name text,uci_points numeric,primary_strength numeric)
language sql stable security definer set search_path='' as $$
  select team_season.id,team.id,team_season.display_name,rider.id,
    concat_ws(' ',rider.first_name,rider.last_name),coalesce(summary.points,0)::numeric,
    greatest(rating.mountain,rating.hills,rating.flat,rating.time_trial,rating.cobbles,rating.sprint)::numeric
  from public.team_seasons team_season
  join public.seasons season on season.id=team_season.season_id
  join public.teams team on team.id=team_season.team_id and team.status='active'
  join public.team_manager_assignments assignment on assignment.team_id=team.id
    and assignment.role='general_manager' and assignment.status='active'
  join public.sporting_directors director on director.id=assignment.sporting_director_id
    and director.status='active' and director.auth_user_id is not null
  join public.seasons manager_start on manager_start.id=assignment.start_season_id
    and manager_start.game_year<=season.game_year
  left join public.seasons manager_end on manager_end.id=assignment.end_season_id
  join public.rider_contracts contract on contract.team_id=team.id and contract.status='active'
  join public.seasons contract_start on contract_start.id=contract.start_season_id
    and contract_start.game_year<=season.game_year
  join public.seasons contract_end on contract_end.id=contract.end_season_id
    and contract_end.game_year>=season.game_year
  join public.riders rider on rider.id=contract.rider_id and rider.status='active'
  join public.rider_season_ratings rating on rating.rider_id=rider.id and rating.season_id=season.id
  left join public.rider_season_summaries summary on summary.rider_id=rider.id and summary.season_id=season.id
  where team_season.season_id=p_season_id and team_season.status='active'
    and (manager_end.id is null or manager_end.game_year>=season.game_year)
    and not exists(select 1 from public.alpha_bot_managers bot
      where bot.sporting_director_id=director.id or bot.auth_user_id=director.auth_user_id or bot.team_id=team.id)
    and exists(select 1 from public.player_daily_activity activity
      where activity.auth_user_id=director.auth_user_id
        and activity.activity_on between (now() at time zone 'Europe/Paris')::date-13
          and (now() at time zone 'Europe/Paris')::date)
    and rating.mountain>0 and rating.mountain<=100
    and rating.hills>0 and rating.hills<=100
    and rating.flat>0 and rating.flat<=100
    and rating.time_trial>0 and rating.time_trial<=100
    and rating.cobbles>0 and rating.cobbles<=100
    and rating.sprint>0 and rating.sprint<=100
    and rating.acceleration>0 and rating.acceleration<=100
    and rating.downhill>0 and rating.downhill<=100
    and rating.endurance>0 and rating.endurance<=100
    and rating.resistance>0 and rating.resistance<=100
    and rating.recovery>0 and rating.recovery<=100
    and rating.breakaway>0 and rating.breakaway<=100
    and rating.prologue>0 and rating.prologue<=100;
$$;

revoke all on function private.cyclogazette_poll_candidate_riders(uuid) from public,anon,authenticated,service_role;

create or replace function private.ensure_cyclogazette_poll(p_edition_id uuid)
returns uuid language plpgsql security definer set search_path='' set statement_timeout='5s'
as $$
declare
  v_edition record;
  v_poll_id uuid;
  v_topic_index integer;
  v_candidates jsonb;
  v_team jsonb;
  v_rider jsonb;
  v_recruit jsonb;
  v_race jsonb;
  v_question text;
  v_topic_type text;
  v_options jsonb;
  v_subjects jsonb := '[]'::jsonb;
begin
  select id into v_poll_id from public.cyclogazette_polls where edition_id=p_edition_id;
  -- Existing questions, choices, links and votes are immutable for this repair.
  if v_poll_id is not null then return v_poll_id; end if;
  select edition.id,edition.season_id,edition.issue_number,day.day_number,season.game_year
  into v_edition from public.cyclogazette_editions edition
  join public.season_days day on day.id=edition.season_day_id
  join public.seasons season on season.id=edition.season_id
  where edition.id=p_edition_id;
  if v_edition.id is null then return null; end if;

  -- Freeze a single eligibility snapshot for all five topics and fallbacks.
  -- Only the four chosen options/subjects are converted to JSON, not the full
  -- professional roster. Seeded rotation keeps daily variety within real clubs.
  with pool as materialized (
    select * from private.cyclogazette_poll_candidate_riders(v_edition.season_id)
  ), teams as materialized (
    select distinct team_season_id,team_id,team_name from pool
  ), ranked_riders as (
    select pool.*,row_number() over(partition by team_id
      order by uci_points desc,primary_strength desc,rider_id) as club_rank
    from pool
  ), recognizable as materialized (
    select * from ranked_riders where club_rank<=3
  ), recent_polls as (
    select poll.options,poll.subjects
    from public.cyclogazette_polls poll
    join public.cyclogazette_editions edition on edition.id=poll.edition_id
    where edition.season_id=v_edition.season_id and edition.issue_number<v_edition.issue_number
    order by edition.issue_number desc limit 14
  ), recent_refs as materialized (
    select distinct value->>'href' as href from recent_polls
    cross join lateral jsonb_array_elements(recent_polls.options||recent_polls.subjects) refs(value)
    where value ? 'href'
  ), team_pick as (
    select * from teams
    order by exists(select 1 from recent_refs where href='/jeu/equipes/'||teams.team_id::text),
      md5(teams.team_id::text||':subject:'||v_edition.issue_number::text),teams.team_id
    limit 1
  ), rider_pick as (
    select * from recognizable rider
    order by exists(select 1 from recent_refs where href='/jeu/coureurs/'||rider.rider_id::text),
      md5(rider.rider_id::text||':future:'||v_edition.issue_number::text),rider.rider_id
    limit 1
  ), recruit_pick as (
    select rider.* from recognizable rider cross join team_pick target
    where rider.team_id<>target.team_id
    order by exists(select 1 from recent_refs where href='/jeu/coureurs/'||rider.rider_id::text),
      md5(rider.rider_id::text||':recruit:'||v_edition.issue_number::text),rider.rider_id
    limit 1
  ), engaged as materialized (
    select distinct registration.race_edition_id,team.team_id,team.team_name
    from public.race_registrations registration
    join teams team on team.team_season_id=registration.team_season_id
    join public.race_rosters roster on roster.race_registration_id=registration.id
      and roster.status in ('selected','confirmed')
    join pool rider on rider.rider_id=roster.rider_id and rider.team_id=team.team_id
    where registration.status='accepted'
  ), selected_race as (
    select edition.id,edition.race_id,edition.display_name,race.slug
    from public.race_editions edition
    join public.races race on race.id=edition.race_id and race.status='active' and race.competition_type='standard'
    join public.stages stage on stage.race_edition_id=edition.id
    join public.season_days day on day.id=stage.season_day_id
    where edition.season_id=v_edition.season_id
      and edition.status in ('planned','registration_open','registration_closed','in_progress')
      and day.day_number>v_edition.day_number
      and (select count(*) from engaged where race_edition_id=edition.id)>=2
    group by edition.id,edition.race_id,edition.display_name,race.slug
    order by min(day.day_number),edition.display_name,edition.id limit 1
  ), defending as (
    select prior_team.team_id from public.race_results result
    join public.race_editions prior_edition on prior_edition.id=result.race_edition_id
    join selected_race selected on selected.race_id=prior_edition.race_id
    join public.seasons prior_season on prior_season.id=prior_edition.season_id
    join public.race_rosters roster on roster.id=result.race_roster_id
    join public.race_registrations registration on registration.id=roster.race_registration_id
    join public.team_seasons prior_team on prior_team.id=registration.team_season_id
    where result.status='classified' and result.final_rank=1 and prior_season.game_year<v_edition.game_year
    order by prior_season.game_year desc,result.id limit 1
  ), race_candidates as (
    select engaged.* from engaged join selected_race selected on selected.id=engaged.race_edition_id
    order by case when engaged.team_id=(select team_id from defending) then 0 else 1 end,
      exists(select 1 from recent_refs where href='/jeu/equipes/'||engaged.team_id::text),
      md5(engaged.team_id::text||':race:'||v_edition.issue_number::text),engaged.team_id limit 4
  ), race_options as (
    select candidate.*,row_number() over(order by
      case when candidate.team_id=(select team_id from defending) then 0 else 1 end,
      exists(select 1 from recent_refs where href='/jeu/equipes/'||candidate.team_id::text),
      md5(candidate.team_id::text||':race:'||v_edition.issue_number::text),candidate.team_id) as position
    from race_candidates candidate
  ), per_club_choices as (
    select rider.*,row_number() over(partition by rider.team_id order by
      exists(select 1 from recent_refs where href='/jeu/coureurs/'||rider.rider_id::text),
      md5(rider.rider_id::text||':choice:'||v_edition.issue_number::text),rider.rider_id) as team_pick
    from recognizable rider
  ), rider_candidates as (
    select * from per_club_choices rider order by team_pick,
      exists(select 1 from recent_refs where href='/jeu/coureurs/'||rider.rider_id::text),
      md5(rider.rider_id::text||':choice:'||v_edition.issue_number::text),rider.rider_id limit 4
  ), rider_options as (
    select candidate.*,row_number() over(order by team_pick,
      exists(select 1 from recent_refs where href='/jeu/coureurs/'||candidate.rider_id::text),
      md5(candidate.rider_id::text||':choice:'||v_edition.issue_number::text),candidate.rider_id) as position
    from rider_candidates candidate
  )
  select jsonb_build_object(
    'team',(select to_jsonb(team_pick) from team_pick),
    'rider',(select to_jsonb(rider_pick) from rider_pick),
    'recruit',(select to_jsonb(recruit_pick) from recruit_pick),
    'race',(select to_jsonb(selected_race)||jsonb_build_object('defenderName',
      (select team_name from race_options where team_id=(select team_id from defending))) from selected_race),
    'raceOptions',(select jsonb_agg(jsonb_build_object('id','option-'||position::text,
      'label',team_name,'href','/jeu/equipes/'||team_id::text) order by position) from race_options),
    'riderOptions',(select jsonb_agg(jsonb_build_object('id','option-'||position::text,
      'label',rider_name||' · '||team_name,'href','/jeu/coureurs/'||rider_id::text) order by position) from rider_options)
  ) into v_candidates;

  v_team:=v_candidates->'team'; v_rider:=v_candidates->'rider';
  v_recruit:=v_candidates->'recruit'; v_race:=v_candidates->'race';
  v_topic_index:=mod(v_edition.issue_number,5);
  if v_topic_index=0 and v_team->>'team_id' is not null then
    v_topic_type:='team_opinion';
    v_question:=format('Que pensez-vous de %s cette saison ?',v_team->>'team_name');
    v_options:=jsonb_build_array(jsonb_build_object('id','option-1','label','Elle impressionne'),
      jsonb_build_object('id','option-2','label','Elle progresse'),jsonb_build_object('id','option-3','label','Elle doit encore convaincre'));
    v_subjects:=jsonb_build_array(jsonb_build_object('label',v_team->>'team_name','href','/jeu/equipes/'||(v_team->>'team_id')));
  elsif v_topic_index=1 and v_rider->>'rider_id' is not null then
    v_topic_type:='rider_future';
    v_question:=format('%s (%s) devrait-il changer d’air ?',v_rider->>'rider_name',v_rider->>'team_name');
    v_options:=jsonb_build_array(jsonb_build_object('id','option-1','label','Oui'),
      jsonb_build_object('id','option-2','label','Non'),jsonb_build_object('id','option-3','label','Encore trop tôt pour le dire'));
    v_subjects:=jsonb_build_array(jsonb_build_object('label',v_rider->>'rider_name','href','/jeu/coureurs/'||(v_rider->>'rider_id')),
      jsonb_build_object('label',v_rider->>'team_name','href','/jeu/equipes/'||(v_rider->>'team_id')));
  elsif v_topic_index=2 and v_team->>'team_id' is not null and v_recruit->>'rider_id' is not null then
    v_topic_type:='team_recruitment';
    v_question:=format('%s devrait-elle recruter %s (%s) ?',v_team->>'team_name',v_recruit->>'rider_name',v_recruit->>'team_name');
    v_options:=jsonb_build_array(jsonb_build_object('id','option-1','label','Oui, absolument'),
      jsonb_build_object('id','option-2','label','Pourquoi pas'),jsonb_build_object('id','option-3','label','Non, mauvais profil'));
    v_subjects:=jsonb_build_array(jsonb_build_object('label',v_team->>'team_name','href','/jeu/equipes/'||(v_team->>'team_id')),
      jsonb_build_object('label',v_recruit->>'rider_name','href','/jeu/coureurs/'||(v_recruit->>'rider_id')),
      jsonb_build_object('label',v_recruit->>'team_name','href','/jeu/equipes/'||(v_recruit->>'team_id')));
  elsif v_topic_index=3 and v_race->>'id' is not null then
    v_topic_type:='race_prediction';
    v_question:=case when v_race->>'defenderName' is not null then
      format('%s défend son titre sur %s : quelle équipe engagée l’emportera ?',v_race->>'defenderName',v_race->>'display_name')
      else format('Parmi les équipes engagées, laquelle remportera %s ?',v_race->>'display_name') end;
    v_options:=v_candidates->'raceOptions';
    v_subjects:=jsonb_build_array(jsonb_build_object('label',v_race->>'display_name','href','/jeu/courses/'||(v_race->>'slug')));
  elsif v_topic_index=4 then
    v_topic_type:='rider_choice';
    v_question:='Quel coureur vous impressionne le plus actuellement ?';
    v_options:=v_candidates->'riderOptions';
  end if;
  if v_question is null or v_options is null or jsonb_typeof(v_options)<>'array'
    or jsonb_array_length(v_options)<2 then
    v_topic_type:='team_opinion';v_question:='Quelle est votre lecture du peloton actuel ?';
    v_subjects:='[]'::jsonb;
    v_options:=jsonb_build_array(jsonb_build_object('id','option-1','label','Les favoris dominent'),
      jsonb_build_object('id','option-2','label','La hiérarchie se resserre'),jsonb_build_object('id','option-3','label','Une surprise se prépare'));
  end if;
  insert into public.cyclogazette_polls(edition_id,topic_type,question,options,subjects)
  values(v_edition.id,v_topic_type,v_question,v_options,v_subjects)
  on conflict(edition_id) do nothing returning id into v_poll_id;
  if v_poll_id is null then select id into v_poll_id from public.cyclogazette_polls where edition_id=v_edition.id; end if;
  return v_poll_id;
end;
$$;

revoke all on function private.ensure_cyclogazette_poll(uuid) from public,anon,authenticated,service_role;

-- The old INSERT trigger could replace safe options with unrestricted race
-- entries and fuzzy-match homonyms. New generation already supplies stable IDs
-- in every link, so preserve those authoritative references. Retain the exact
-- historical UPDATE enrichment behaviour for existing archive maintenance.
do $migration$
declare
  v_definition text;
  v_marker text := '  select edition.season_id, day.day_number, edition.issue_number, season.game_year';
  v_count integer;
begin
  select pg_get_functiondef('private.enrich_cyclogazette_poll_entities()'::regprocedure) into v_definition;
  if position('-- Preserve authoritative future poll references.' in v_definition)=0 then
    v_count:=(length(v_definition)-length(replace(v_definition,v_marker,'')))/length(v_marker);
    if v_count<>1 then raise exception 'Le déclencheur des sondages de La Cyclogazette est inattendu.'; end if;
    execute replace(v_definition,v_marker,
      E'  -- Preserve authoritative future poll references.\n  if tg_op=''INSERT'' then return new; end if;\n'||v_marker);
  end if;
end;
$migration$;

comment on function private.cyclogazette_poll_candidate_riders(uuid) is
  'Private shared poll pool: recently present human managers and initialized active professionals in their actual current-season clubs.';
comment on function private.ensure_cyclogazette_poll(uuid) is
  'Creates future polls only from active human clubs and recognizable professionals, preserving every existing poll and vote.';
commit;
