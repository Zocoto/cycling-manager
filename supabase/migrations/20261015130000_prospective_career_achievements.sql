-- Prospective only: no historical scan, backfill, claim or reward at install.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '25s';

create table public.career_achievement_epoch (
  singleton boolean primary key default true check(singleton),
  activated_at timestamptz not null default clock_timestamp()
);
insert into public.career_achievement_epoch(singleton) values(true);
create table public.career_achievement_progress (
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  metric_key text not null,
  subject_key text not null,
  value numeric not null default 0,
  peak numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key(sporting_director_id,metric_key,subject_key)
);
create table public.career_achievement_receipts (
  source_key text primary key,
  created_at timestamptz not null default now()
);
create table public.career_achievement_shop_days (
  team_id uuid not null references public.teams(id) on delete cascade,
  game_day integer not null,
  qualified boolean not null,
  streak integer not null,
  primary key(team_id,game_day)
);
alter table public.career_achievement_epoch enable row level security;
alter table public.career_achievement_progress enable row level security;
alter table public.career_achievement_receipts enable row level security;
alter table public.career_achievement_shop_days enable row level security;
grant all on public.career_achievement_epoch, public.career_achievement_progress,
  public.career_achievement_receipts,public.career_achievement_shop_days to service_role;

create function private.record_career_achievement(
  p_team uuid,p_metric text,p_subject text,p_value numeric default 1,p_add boolean default false
) returns void language plpgsql security definer set search_path='' as $$
declare v_director uuid;
begin
  select a.sporting_director_id into v_director
  from public.team_manager_assignments a join public.sporting_directors d on d.id=a.sporting_director_id
  where a.team_id=p_team and a.status='active' and a.role='general_manager'
    and d.status='active' and d.auth_user_id is not null limit 1;
  if v_director is null then return; end if;
  insert into public.career_achievement_progress(sporting_director_id,metric_key,subject_key,value,peak)
  values(v_director,p_metric,p_subject,p_value,greatest(0,p_value))
  on conflict(sporting_director_id,metric_key,subject_key) do update set
    value=case when p_add then career_achievement_progress.value+excluded.value else greatest(career_achievement_progress.value,excluded.value) end,
    peak=greatest(career_achievement_progress.peak,case when p_add then career_achievement_progress.value+excluded.value else excluded.value end),updated_at=now();
end;
$$;
revoke all on function private.record_career_achievement(uuid,text,text,numeric,boolean) from public,anon,authenticated;
grant execute on function private.record_career_achievement(uuid,text,text,numeric,boolean) to service_role;

alter function public.calculate_game_objective_progress(text,uuid,uuid,numeric)
  rename to calculate_game_objective_progress_pre_prospective;
revoke all on function public.calculate_game_objective_progress_pre_prospective(text,uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function public.calculate_game_objective_progress_pre_prospective(text,uuid,uuid,numeric) to service_role;
create function public.calculate_game_objective_progress(p_metric_key text,p_director_id uuid,p_current_team_id uuid,p_experience_points numeric)
returns integer language plpgsql stable security definer set search_path='' as $$
declare v_value integer;
begin
  if p_metric_key not like 'future\_%' escape '\' then
    return public.calculate_game_objective_progress_pre_prospective(p_metric_key,p_director_id,p_current_team_id,p_experience_points);
  end if;
  if p_metric_key in ('future_world_traveler','future_tailored_setup','future_panache') then
    select count(*)::integer into v_value from public.career_achievement_progress
      where sporting_director_id=p_director_id and metric_key=p_metric_key and peak>0;
  elsif p_metric_key='future_three_tours' then
    select max(n)::integer into v_value from (select count(*) n from public.career_achievement_progress
      where sporting_director_id=p_director_id and metric_key=p_metric_key and peak>0 group by left(subject_key,36)) tours;
  else
    select floor(max(peak))::integer into v_value from public.career_achievement_progress
      where sporting_director_id=p_director_id and metric_key=p_metric_key;
  end if;
  return greatest(0,coalesce(v_value,0));
end;
$$;
revoke all on function public.calculate_game_objective_progress(text,uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function public.calculate_game_objective_progress(text,uuid,uuid,numeric) to service_role;

-- Actual integer training changes only: never raw theoretical gains, items,
-- free-agent training, or sessions belonging to a previous real-world day.
create function private.capture_career_training() returns trigger language plpgsql security definer set search_path='' as $$
declare v_entry record; v_start timestamptz; v_day date;
begin
  select activated_at into v_start from public.career_achievement_epoch;
  select calendar_date into v_day from public.season_days where id=new.season_day_id;
  if new.status<>'completed' or new.processed_at is null or new.processed_at<v_start or v_day is null
    or v_day<(v_start at time zone 'Europe/Paris')::date then return new; end if;
  -- The daily engine inserts the session, computes the ratings, then updates
  -- rating_changes. Do not consume its receipt on the initial empty payload.
  if not exists(select 1 from jsonb_each_text(new.rating_changes)
    where key in ('mountain','hills','flat','time_trial','timeTrial','cobbles','sprint') and value::numeric<>0) then return new; end if;
  insert into public.career_achievement_receipts(source_key) values('training:'||new.id::text) on conflict do nothing;
  if not found then return new; end if;
  for v_entry in select key,value::numeric delta from jsonb_each_text(new.rating_changes)
    where key in ('mountain','hills','flat','time_trial','timeTrial','cobbles','sprint') loop
    perform private.record_career_achievement(new.team_id,'future_natural_progress',new.rider_id::text||':'||replace(v_entry.key,'timeTrial','time_trial'),v_entry.delta,true);
  end loop;
  return new;
end;
$$;
create trigger capture_prospective_training after insert or update of rating_changes on public.rider_training_sessions
  for each row execute function private.capture_career_training();

create function private.capture_career_staff_training() returns trigger language plpgsql security definer set search_path='' as $$
declare v_director uuid; v_level integer; v_start timestamptz;
begin
  select activated_at into v_start from public.career_achievement_epoch;
  if new.status<>'completed' or new.improvement_type<>'level' or new.completed_at is null or new.completed_at<v_start then return new; end if;
  insert into public.career_achievement_receipts(source_key) values('staff:'||new.id::text) on conflict do nothing;
  if not found then return new; end if;
  select sporting_director_id into v_director from public.team_manager_assignments
    where team_id=new.team_id and status='active' and role='general_manager' limit 1;
  select value::integer into v_level from public.career_achievement_progress
    where sporting_director_id=v_director and metric_key='future_mentor' and subject_key=new.staff_member_id::text;
  if new.previous_level=1 or v_level=new.previous_level then
    perform private.record_career_achievement(new.team_id,'future_mentor',new.staff_member_id::text,new.previous_level+1);
  end if;
  return new;
end;
$$;
create trigger capture_prospective_staff_training after insert or update of status on public.staff_academy_trainings
  for each row execute function private.capture_career_staff_training();

-- Called once per team/day immediately BEFORE automatic refill. A stockout
-- cannot be hidden by refill; buying/re-selling is never a qualifying sale.
create function private.capture_career_shop_day(p_team_season uuid,p_day integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_context record; v_start timestamptz; v_profit numeric; v_good boolean; v_streak integer; v_level integer;
begin
  select activated_at into v_start from public.career_achievement_epoch;
  select ts.team_id,ts.season_id,s.game_year*28+p_day-1 game_day,d.calendar_date into v_context
    from public.team_seasons ts join public.seasons s on s.id=ts.season_id
    join public.season_days d on d.season_id=s.id and d.day_number=p_day where ts.id=p_team_season;
  if v_context is null or v_context.calendar_date<(v_start at time zone 'Europe/Paris')::date
    or v_context.calendar_date>(now() at time zone 'Europe/Paris')::date then return; end if;
  insert into public.career_achievement_receipts(source_key) values('shop:'||v_context.team_id::text||':'||v_context.game_day) on conflict do nothing;
  if not found then return; end if;
  select coalesce(sum(sale.revenue-sale.units_sold*inventory.average_unit_cost),0) into v_profit
    from public.fan_club_shop_sales sale join public.fan_club_shop_inventory inventory
      on inventory.team_id=sale.team_id and inventory.product_code=sale.product_code
    where sale.team_id=v_context.team_id and sale.season_id=v_context.season_id and sale.day_number=p_day and sale.created_at>=v_start;
  select coalesce(max(level),0) into v_level from public.team_infrastructures
    where team_id=v_context.team_id and infrastructure_code='club_shop';
  select v_profit>0 and v_level>0 and not exists (
    select 1 from (values('team-jersey',1),('bottle',2),('pennant',3),('cap',4),('supporter-balloon',5)) product(code,level)
    left join public.fan_club_shop_inventory inventory on inventory.team_id=v_context.team_id and inventory.product_code=product.code
    where product.level<=v_level and coalesce(inventory.quantity,0)<=0
  ) into v_good;
  select case when v_good then coalesce((select streak from public.career_achievement_shop_days where team_id=v_context.team_id and game_day=v_context.game_day-1),0)+1 else 0 end into v_streak;
  insert into public.career_achievement_shop_days values(v_context.team_id,v_context.game_day,v_good,v_streak);
  perform private.record_career_achievement(v_context.team_id,'future_shopkeeper','best-streak',v_streak);
end;
$$;
revoke all on function private.capture_career_shop_day(uuid,integer) from public,anon,authenticated;
grant execute on function private.capture_career_shop_day(uuid,integer) to service_role;
do $$
declare v_def text; v_anchor text:='perform private.restock_fan_club_shop(v_target.team_season_id, v_target.current_day_number);';
begin
  v_def:=pg_get_functiondef('public.settle_due_fan_club_shop_sales()'::regprocedure);
  if (length(v_def)-length(replace(v_def,v_anchor,'')))/length(v_anchor)<>1 then raise exception 'Unexpected daily sales hook; inspect before installing achievements.'; end if;
  execute replace(v_def,v_anchor,'perform private.capture_career_shop_day(v_target.team_season_id, v_target.current_day_number);'||chr(10)||'      '||v_anchor);
end;
$$;

-- Resolve owned research prototypes like owned commercial items, not like
-- supplier contracts. No bonus is invented: use the item's existing payload.
-- Freeze provenance as metadata; only the own lab's positive delta qualifies.
do $$
declare v_def text; v_predicate text; v_anchor text := 'jsonb_build_object(''_slotType'', slot.slot_type)';
begin
  v_def:=pg_get_functiondef('public.get_active_calendar_stage_equipment_effects(uuid[])'::regprocedure);
  foreach v_predicate in array array[
    'when item.acquisition_channel in (''commercial'', ''event_reward'')',
    'where item.acquisition_channel in (''commercial'', ''event_reward'')',
    'when permanent_item.acquisition_channel in (''commercial'', ''event_reward'')'
  ] loop
    if (length(v_def)-length(replace(v_def,v_predicate,'')))/length(v_predicate)<>1 then
      raise exception 'Unexpected prototype resolution hook; inspect before installing provenance.';
    end if;
  end loop;
  v_def:=replace(v_def,'when item.acquisition_channel in (''commercial'', ''event_reward'')',
    'when (item.acquisition_channel in (''commercial'', ''event_reward'') or (item.acquisition_channel=''research_prototype'' and item.owner_team_id=team_season.team_id))');
  v_def:=replace(v_def,'where item.acquisition_channel in (''commercial'', ''event_reward'')',
    'where (item.acquisition_channel in (''commercial'', ''event_reward'') or (item.acquisition_channel=''research_prototype'' and item.owner_team_id=team_season.team_id))');
  v_def:=replace(v_def,'when permanent_item.acquisition_channel in (''commercial'', ''event_reward'')',
    'when (permanent_item.acquisition_channel in (''commercial'', ''event_reward'') or (permanent_item.acquisition_channel=''research_prototype'' and permanent_item.owner_team_id=team_season.team_id))');
  if (length(v_def)-length(replace(v_def,v_anchor,'')))/length(v_anchor)<>1 then raise exception 'Unexpected equipment projection; inspect before installing provenance.'; end if;
  execute replace(v_def,v_anchor,v_anchor||$patch$ || jsonb_build_object('_careerResearch',
    case when item.owner_team_id=team_season.team_id then (
      select jsonb_build_object('ratingKey',project.rating_key,'delta',project.rating_delta)
      from public.equipment_rnd_projects project where project.prototype_equipment_item_id=item.id
        and project.team_id=team_season.team_id and project.status='completed' and project.rating_delta>0
      order by project.completed_at desc,project.id limit 1
    ) end)$patch$);
end;
$$;

-- Bounded to ONE homologated edition. No page-load replay, no old edition
-- scan. Caller is service_role; public users cannot submit sporting facts.
create function public.record_prospective_career_race(p_race_edition_id uuid,p_frozen_favorites jsonb default null,p_research_rider_ids uuid[] default '{}')
returns integer language plpgsql security definer set search_path='' set statement_timeout='6s' as $$
declare v_start timestamptz; v_edition record; v_row record; v_teams uuid[]; v_count integer:=0;
begin
  select activated_at into v_start from public.career_achievement_epoch;
  select e.id,r.id race_id,coalesce(e.host_country_id,r.country_id) country_id,r.is_monument,r.is_grand_tour,r.race_format,r.slug,
    max(st.departure_at) last_departure,bool_and(st.status='completed') stages_complete,bool_and(st.stage_type='team_time_trial') team_time_trial_only
  into v_edition from public.race_editions e join public.races r on r.id=e.race_id
    join public.stages st on st.race_edition_id=e.id
  where e.id=p_race_edition_id and r.competition_type='standard'
    and r.slug<>'criterium-de-la-decouverte'
  group by e.id,r.id;
  if v_edition is null or not v_edition.stages_complete or v_edition.last_departure<v_start
    or v_edition.last_departure>now() then return 0; end if;
  if not exists(select 1 from public.race_results where race_edition_id=p_race_edition_id) then return 0; end if;
  insert into public.career_achievement_receipts(source_key) values('race:'||p_race_edition_id::text) on conflict do nothing;
  if not found then return 0; end if;
  for v_row in
    select distinct ts.team_id from public.race_results result
    join public.race_rosters roster on roster.id=result.race_roster_id
    join public.race_registrations reg on reg.id=roster.race_registration_id
    join public.team_seasons ts on ts.id=reg.team_season_id
    where result.race_edition_id=p_race_edition_id and result.status='classified'
  loop
    if v_edition.country_id is not null then
      perform private.record_career_achievement(v_row.team_id,'future_world_traveler',v_edition.country_id::text);
    end if;
    if exists(select 1 from public.stage_results sr join public.stages st on st.id=sr.stage_id
      join public.race_rosters rr on rr.id=sr.race_roster_id join public.race_registrations reg on reg.id=rr.race_registration_id
      join public.team_seasons ts on ts.id=reg.team_season_id
      where st.race_edition_id=p_race_edition_id and ts.team_id=v_row.team_id and sr.status='finished'
        and st.departure_at>=v_start and jsonb_array_length(coalesce(sr.equipment_snapshot->'items','[]'::jsonb))>0) then
      perform private.record_career_achievement(v_row.team_id,'future_tailored_setup',p_race_edition_id::text);
    end if;
    v_count:=v_count+1;
  end loop;
  for v_row in select award.award_key,ts.team_id from public.race_combativity_awards award
    join public.race_rosters rr on rr.id=award.race_roster_id
    join public.race_registrations reg on reg.id=rr.race_registration_id join public.team_seasons ts on ts.id=reg.team_season_id
    left join public.stages st on st.id=award.stage_id
    where award.race_edition_id=p_race_edition_id and (st.id is null or st.departure_at>=v_start)
  loop perform private.record_career_achievement(v_row.team_id,'future_panache',v_row.award_key); end loop;
  for v_row in select rr.rider_id,ts.team_id,result.final_rank from public.race_results result
    join public.race_rosters rr on rr.id=result.race_roster_id
    join public.race_registrations reg on reg.id=rr.race_registration_id join public.team_seasons ts on ts.id=reg.team_season_id
    where result.race_edition_id=p_race_edition_id and result.status='classified' and result.final_rank<=3
  loop
    if exists(select 1 from public.youth_academy_riders junior
      join public.youth_scouting_candidates candidate on candidate.id=junior.candidate_id
      join public.youth_scouting_missions mission on mission.id=candidate.mission_id
      where junior.promoted_rider_id=v_row.rider_id and junior.team_id=v_row.team_id and mission.team_id=v_row.team_id
        and (exists(select 1 from public.youth_academy_training_sessions training where training.academy_rider_id=junior.id)
          or exists(select 1 from public.youth_academy_training_attempts training where training.academy_rider_id=junior.id and training.status='completed'))) then
      perform private.record_career_achievement(v_row.team_id,'future_homegrown',v_row.rider_id::text,
        case when v_row.final_rank=1 and (v_edition.is_monument or v_edition.is_grand_tour) then 3 when v_row.final_rank=1 then 2 else 1 end);
    end if;
    if v_row.rider_id=any(p_research_rider_ids) then
      perform private.record_career_achievement(v_row.team_id,'future_research_podium',v_row.rider_id::text,
        case when v_row.final_rank=1 and (v_edition.is_monument or v_edition.is_grand_tour) then 3 when v_row.final_rank=1 then 2 else 1 end);
    end if;
    if v_row.final_rank=1 and v_edition.is_grand_tour then
      perform private.record_career_achievement(v_row.team_id,'future_three_tours',v_row.rider_id::text||':'||v_edition.race_id::text);
    end if;
    if v_row.final_rank=1 and v_edition.race_format='one_day' and not v_edition.team_time_trial_only
      and (select count(*) from public.race_rosters rr join public.race_registrations reg on reg.id=rr.race_registration_id
        where reg.race_edition_id=p_race_edition_id and reg.status='accepted' and rr.status in ('selected','confirmed'))>10
      and jsonb_typeof(p_frozen_favorites)='array'
      and jsonb_array_length(p_frozen_favorites)=10 and not p_frozen_favorites ? v_row.rider_id::text then
      perform private.record_career_achievement(v_row.team_id,'future_upset',p_race_edition_id::text);
    end if;
  end loop;
  select array_agg(ts.team_id order by result.final_rank) into v_teams from public.race_results result
    join public.race_rosters rr on rr.id=result.race_roster_id join public.race_registrations reg on reg.id=rr.race_registration_id
    join public.team_seasons ts on ts.id=reg.team_season_id
    where result.race_edition_id=p_race_edition_id and result.status='classified' and result.final_rank<=3;
  if not v_edition.team_time_trial_only and array_length(v_teams,1)=3 and v_teams[1]=v_teams[2] and v_teams[2]=v_teams[3] then
    perform private.record_career_achievement(v_teams[1],'future_family_photo',p_race_edition_id::text);
  end if;
  return v_count;
end;
$$;
revoke all on function public.record_prospective_career_race(uuid,jsonb,uuid[]) from public,anon,authenticated;
grant execute on function public.record_prospective_career_race(uuid,jsonb,uuid[]) to service_role;

with families(code,grp,title,targets,description) as (values
 ('natural_progress','training','Ça progresse !',array[1,3,5],'Gagner %s points nets dans une même note principale d’un même coureur par l’entraînement dans votre équipe, hors objets bonus.'),
 ('tailored_setup','equipment','Le sens du détail',array[1,5,20],'Achever %s courses avec un coureur ayant terminé une étape avec un montage spécifique différent de son équipement habituel.'),
 ('panache','racing','Le panache avant tout',array[1,5,20],'Remporter %s prix de la combativité sur des courses officielles seniors.'),
 ('world_traveler','participations','Voyage, voyage',array[3,10,20],'Achever des courses officielles seniors dans %s pays différents.'),
 ('shopkeeper','fan_club','Boutique bien tenue',array[3,7,14],'Réaliser des ventes à marge positive pendant %s journées de jeu consécutives, en gardant tous les articles standards débloqués en stock après les ventes et avant le réapprovisionnement automatique.'),
 ('mentor','staff','Le maître d’apprentissage',array[3,4,5],'Former le même membre du staff du niveau 1 au niveau %s par des formations de niveau achevées après l’activation.'),
 ('research_podium','research','Du labo au podium',array[1,2,3],''),
 ('homegrown','youth','Pur produit maison',array[1,2,3],''),
 ('three_tours','grand_tours','Le seigneur des trois Tours',array[1,2,3],'Remporter le général de %s Grands Tours différents avec le même coureur, sur une ou plusieurs saisons.'),
 ('family_photo','racing','Photo de famille',array[1],'Placer trois coureurs aux trois premières places d’une course officielle senior, hors initiation et gala.'),
 ('upset','racing','Personne ne l’avait vu venir',array[1],'Gagner une course officielle senior d’un jour avec un coureur absent des dix premiers favoris figés avant le départ (plus de dix partants).')
), expanded as (select families.*,n,targets[n] target,case when cardinality(targets)=1 then 3 else n end tier from families cross join lateral generate_subscripts(targets,1) n)
insert into public.game_objective_definitions(objective_key,objective_type,objective_group,title,description,metric_key,target_value,reward_cash,reward_experience,reward_reputation,display_order,is_active)
select 'journey_'||code||'_'||(array['bronze','silver','gold'])[tier],'secondary',grp,title,
  case when code='research_podium' then (array['Obtenir un podium','Remporter une course','Remporter un Monument ou le général d’un Grand Tour'])[n]||' avec un coureur bénéficiant d’un bonus positif de votre propre prototype R&D.'
    when code='homegrown' then (array['Obtenir un podium professionnel','Remporter une course professionnelle','Remporter un Monument ou le général d’un Grand Tour'])[n]||' avec un junior détecté, entraîné puis promu dans votre propre centre.'
    else format(description,target) end ||' Seuls les accomplissements postérieurs à l’activation du 15 octobre 2026 comptent.',
  'future_'||code,target,case when cardinality(targets)=1 then 0 else (array[5000,15000,35000])[tier] end,
  (array[75,150,300])[tier],(array[1,2,5])[tier],2000+row_number() over(order by code,n),true
from expanded;

-- Preserve existing trophy notifications, using the French catalogue title
-- for the new automatic commemorative trophies.
do $$
declare v_def text; v_anchor text:='  v_kind := case';
begin
  v_def:=pg_get_functiondef('private.notify_sporting_director_trophy()'::regprocedure);
  if (length(v_def)-length(replace(v_def,v_anchor,'')))/length(v_anchor)<>1 then raise exception 'Unexpected trophy notification hook.'; end if;
  execute replace(v_def,v_anchor,$patch$  if new.trophy_key like 'journey\_%' escape '\' then
    select coalesce((select title from public.game_objective_definitions
      where objective_key=new.trophy_key||'_gold'),v_title) into v_title;
  end if;
$patch$||v_anchor);
end;
$$;

-- Hide the two secrets until earned, consistently for every existing reader.
alter function public.get_current_game_objectives() rename to get_current_game_objectives_pre_prospective;
revoke all on function public.get_current_game_objectives_pre_prospective() from public,anon,authenticated;
grant execute on function public.get_current_game_objectives_pre_prospective() to service_role;
create function public.get_current_game_objectives()
returns table(objective_key text,objective_type text,objective_group text,title text,description text,current_value integer,target_value integer,reward_cash numeric,reward_experience integer,reward_reputation numeric,reward_item_name text,reward_item_kind text,display_order integer,claimed_at timestamptz,is_completed boolean)
language sql stable security definer set search_path='' as $$
  select * from public.get_current_game_objectives_pre_prospective() o
    where o.objective_key not in ('journey_family_photo_gold','journey_upset_gold') or o.is_completed or o.claimed_at is not null
$$;
revoke all on function public.get_current_game_objectives() from public,anon;
grant execute on function public.get_current_game_objectives() to authenticated,service_role;

-- One automatic commemorative trophy on the normal, atomic objective claim.
-- No second gift to claim and no instant rewards at migration time.
create function private.award_prospective_achievement_trophy() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.objective_key like 'journey\_%\_gold' escape '\' then
    insert into public.sporting_director_trophies(sporting_director_id,trophy_key,available_at,claimed_at)
      values(new.sporting_director_id,replace(new.objective_key,'_gold',''),now(),now())
      on conflict(sporting_director_id,trophy_key) do nothing;
  end if;
  return new;
end;
$$;
create trigger award_prospective_achievement_after_claim after insert on public.game_objective_claims
  for each row execute function private.award_prospective_achievement_trophy();
revoke all on function private.capture_career_training(), private.capture_career_staff_training(),
  private.award_prospective_achievement_trophy() from public,anon,authenticated;

create function private.validate_career_achievement_avatar() returns trigger language plpgsql security definer set search_path='' as $$
declare v_outfit text; v_objective text;
begin
  if new.avatar_key is null or new.avatar_key not like 'director_custom_v1:%' then return new; end if;
  v_outfit:=split_part(substring(split_part(new.avatar_key,'~halloween~',1) from length('director_custom_v1:')+1),'.',14);
  v_objective:=case v_outfit when 'career-shopkeeper' then 'journey_shopkeeper_gold'
    when 'career-mentor' then 'journey_mentor_gold' when 'career-homegrown' then 'journey_homegrown_gold' end;
  if v_objective is not null and not exists(select 1 from public.game_objective_claims
    where sporting_director_id=new.id and objective_key=v_objective) then
    raise exception 'Récupérez d’abord le palier Or du succès correspondant à cette tenue.';
  end if;
  return new;
end;
$$;
create trigger validate_career_achievement_avatar before insert or update of avatar_key on public.sporting_directors
  for each row execute function private.validate_career_achievement_avatar();
revoke all on function private.validate_career_achievement_avatar() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
