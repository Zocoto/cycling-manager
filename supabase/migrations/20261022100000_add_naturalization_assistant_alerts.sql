begin;
set local statement_timeout = '5s';
set local lock_timeout = '1s';

create table private.dashboard_naturalization_dismissals (
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  target_country_id uuid not null references public.countries(id) on delete cascade,
  subject_type text not null check (subject_type in ('professional','youth')),
  subject_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (sporting_director_id,team_id,target_country_id,subject_type,subject_id)
);
alter table private.dashboard_naturalization_dismissals enable row level security;
revoke all on private.dashboard_naturalization_dismissals from public,anon,authenticated,service_role;

-- Called inside the already authenticated, bounded dashboard summary. Read-only,
-- team-scoped and using existing progress counters and infrastructure rules.
create function private.get_dashboard_naturalization_alerts(
  p_director_id uuid,p_team_id uuid,p_season_id uuid,p_game_year integer,p_day_number integer
) returns jsonb language sql stable set search_path = '' as $$
  with context as materialized (
    select country.id as country_id,country.name as country_name,
      public.get_team_professional_naturalization_days(p_team_id) as pro_days,
      public.get_team_youth_naturalization_days(p_team_id) as youth_days
    from public.team_seasons ts
    join public.countries country on country.id=ts.registration_country_id and country.is_active
    where ts.team_id=p_team_id and ts.season_id=p_season_id and ts.status in('planned','active')
  ), pro_roster as materialized (
    select distinct rider.id,rider.first_name,rider.last_name,country.name as country_name,
      context.country_id as target_country_id,context.country_name as target_country_name,
      coalesce(progress.required_days_override,context.pro_days) as required_days,
      -- Batch equivalent of get_rider_country_progress_days: no per-rider RPC or
      -- repeated season lookup; keep parity covered by the isolated SQL test.
      coalesce(progress.accumulated_days,0) + case when progress.active_since_season_id is null then 0 else
        greatest(0,(p_game_year-started.game_year)*28+least(28,greatest(1,p_day_number))
          -least(28,greatest(1,progress.active_since_day_number))) end as elapsed_days
    from public.rider_contracts contract
    join public.seasons starts on starts.id=contract.start_season_id and starts.game_year<=p_game_year
    join public.seasons ends on ends.id=contract.end_season_id and ends.game_year>=p_game_year
    join public.riders rider on rider.id=contract.rider_id and rider.status='active'
    join public.countries country on country.id=rider.country_id
    cross join context
    left join public.rider_naturalization_country_progress progress on progress.rider_id=rider.id and progress.country_id=context.country_id
    left join public.seasons started on started.id=progress.active_since_season_id
    where contract.team_id=p_team_id and contract.status='active' and rider.country_id<>context.country_id
      and not exists(select 1 from public.rider_national_championship_titles title where title.rider_id=rider.id and title.championship_type in('road','time_trial'))
  ), subjects as materialized (
    select 'professional'::text as subject_type,rider.id as subject_id,
      rider.first_name||' '||rider.last_name as name,rider.country_name as current_country_name,
      rider.target_country_id,rider.target_country_name,rider.required_days,
      rider.elapsed_days
    from pro_roster rider
    union all
    select 'youth',academy.id,academy.first_name||' '||academy.last_name,country.name,
      context.country_id,context.country_name,context.youth_days,
      case when academy.naturalization_country_id=context.country_id and started.game_year is not null and academy.naturalization_started_day_number is not null
        then greatest(0,(p_game_year-started.game_year)*28+p_day_number-academy.naturalization_started_day_number) else 0 end
    from public.youth_academy_riders academy
    join public.countries country on country.id=academy.country_id
    cross join context
    left join public.seasons started on started.id=academy.naturalization_started_season_id
    where academy.team_id=p_team_id and academy.status in('active','recruited') and academy.country_id<>context.country_id
      and not exists(select 1 from public.junior_championship_titles title where title.academy_rider_id=academy.id and title.title_level='national' and title.championship_type in('road','time_trial'))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'subjectType',subject.subject_type,'subjectId',subject.subject_id,'name',subject.name,
    'currentCountryName',subject.current_country_name,'targetCountryId',subject.target_country_id,
    'targetCountryName',subject.target_country_name,'elapsedDays',subject.elapsed_days,'requiredDays',subject.required_days
  ) order by subject.subject_type,subject.name,subject.subject_id),'[]'::jsonb)
  from subjects subject
  where subject.elapsed_days>=subject.required_days
    and not exists(
      select 1 from private.dashboard_naturalization_dismissals ignored
      where ignored.sporting_director_id=p_director_id and ignored.team_id=p_team_id
        and ignored.target_country_id=subject.target_country_id
        and (ignored.subject_type=subject.subject_type and ignored.subject_id=subject.subject_id
          or subject.subject_type='professional' and ignored.subject_type='youth' and exists(
            select 1 from public.youth_academy_riders origin where origin.id=ignored.subject_id and origin.promoted_rider_id=subject.subject_id
          ))
    );
$$;
revoke all on function private.get_dashboard_naturalization_alerts(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;

create function public.ignore_current_naturalization_alert(p_subject_type text,p_subject_id uuid,p_target_country_id uuid)
returns void language plpgsql security definer set search_path = '' set statement_timeout = '3000ms' as $$
declare v_context record;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Votre session a expiré. Reconnectez-vous pour continuer.'; end if;
  if p_subject_type is null or p_subject_type not in('professional','youth') or p_subject_id is null or p_target_country_id is null then
    raise exception 'Cette alerte de naturalisation est invalide.';
  end if;
  select director.id as director_id,assignment.team_id,season.game_year,team_season.registration_country_id into v_context
  from public.sporting_directors director
  join public.team_manager_assignments assignment on assignment.sporting_director_id=director.id and assignment.role='general_manager' and assignment.status='active'
  join public.seasons season on season.status='active'
  join public.team_seasons team_season on team_season.team_id=assignment.team_id and team_season.season_id=season.id and team_season.status in('planned','active')
  where director.auth_user_id=auth.uid() and director.status='active' limit 1;
  if v_context is null or v_context.registration_country_id<>p_target_country_id then raise exception using errcode='42501',message='Cette alerte ne correspond plus à votre équipe.'; end if;
  if p_subject_type='professional' then
    if not exists(
      select 1 from public.rider_contracts contract
      join public.riders rider on rider.id=contract.rider_id and rider.status='active'
      join public.seasons starts on starts.id=contract.start_season_id and starts.game_year<=v_context.game_year
      join public.seasons ends on ends.id=contract.end_season_id and ends.game_year>=v_context.game_year
      where contract.rider_id=p_subject_id and contract.team_id=v_context.team_id and contract.status='active'
    ) then raise exception using errcode='42501',message='Ce coureur ne fait plus partie de votre équipe.'; end if;
  elsif not exists(select 1 from public.youth_academy_riders academy where academy.id=p_subject_id and academy.team_id=v_context.team_id and academy.status in('active','recruited')) then
    raise exception using errcode='42501',message='Ce junior ne fait plus partie de votre équipe.';
  end if;
  insert into private.dashboard_naturalization_dismissals(sporting_director_id,team_id,target_country_id,subject_type,subject_id)
  values(v_context.director_id,v_context.team_id,p_target_country_id,p_subject_type,p_subject_id) on conflict do nothing;
end;
$$;
revoke all on function public.ignore_current_naturalization_alert(text,uuid,uuid) from public,anon;
grant execute on function public.ignore_current_naturalization_alert(text,uuid,uuid) to authenticated;

-- Preserve every existing alert, journal item, return column and 3-second budget.
do $patch$
declare v_definition text; v_anchor constant text := $anchor$'equipmentPartnerSignatureAvailable', ($anchor$;
begin
  v_definition:=pg_get_functiondef('public.get_current_dashboard_assistant_summary()'::regprocedure);
  if position('naturalizationAlerts' in v_definition)>0 or
    (length(v_definition)-length(replace(v_definition,v_anchor,'')))/length(v_anchor)<>1 then raise exception 'Unexpected dashboard function; naturalization alert update cancelled.'; end if;
  execute replace(v_definition,v_anchor,$replacement$'naturalizationAlerts', coalesce((
        select private.get_dashboard_naturalization_alerts(context.sporting_director_id,context.team_id,context.season_id,context.game_year,context.current_day_number)
        from current_context context
      ),'[]'::jsonb),
      'equipmentPartnerSignatureAvailable', ($replacement$);
end;
$patch$;
notify pgrst,'reload schema';
commit;
