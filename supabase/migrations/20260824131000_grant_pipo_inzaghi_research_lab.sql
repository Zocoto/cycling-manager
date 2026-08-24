begin;

do $grant_research_lab$
declare
  v_target_count integer;
  v_team_id uuid;
  v_current_level integer;
  v_active_project_id uuid;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('grant-pipo-inzaghi-research-lab-2026-08-24', 0)
  );

  with target_teams as (
    select distinct assignment.team_id
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.seasons as season
      on season.status = 'active'
    join public.team_seasons as team_season
      on team_season.team_id = assignment.team_id
     and team_season.season_id = season.id
    where (
        lower(btrim(director.display_name)) = 'pipo inzaghi'
        or lower(btrim(director.username)) = 'pipo inzaghi'
      )
      and (
        lower(btrim(team_season.display_name)) = 'tsubame precision'
        or exists (
          select 1
          from public.team_sponsor_contracts as contract
          join public.sponsors as sponsor
            on sponsor.id = contract.sponsor_id
          where contract.team_id = assignment.team_id
            and contract.role = 'principal'
            and contract.status = 'active'
            and lower(btrim(sponsor.name)) = 'tsubame precision'
        )
      )
  )
  select count(*)::integer
  into v_target_count
  from target_teams;

  -- Une base locale vierge ne contient pas ce joueur de production.
  if v_target_count = 0 then
    raise notice 'Pipo Inzaghi / Tsubame Precision absent : aucun octroi appliqué.';
    return;
  end if;

  if v_target_count <> 1 then
    raise exception
      'Ciblage ambigu pour Pipo Inzaghi / Tsubame Precision : % équipes trouvées.',
      v_target_count;
  end if;

  select distinct assignment.team_id
  into v_team_id
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  where (
      lower(btrim(director.display_name)) = 'pipo inzaghi'
      or lower(btrim(director.username)) = 'pipo inzaghi'
    )
    and (
      lower(btrim(team_season.display_name)) = 'tsubame precision'
      or exists (
        select 1
        from public.team_sponsor_contracts as contract
        join public.sponsors as sponsor
          on sponsor.id = contract.sponsor_id
        where contract.team_id = assignment.team_id
          and contract.role = 'principal'
          and contract.status = 'active'
          and lower(btrim(sponsor.name)) = 'tsubame precision'
      )
    );

  select infrastructure.level
  into v_current_level
  from public.team_infrastructures as infrastructure
  where infrastructure.team_id = v_team_id
    and infrastructure.infrastructure_code = 'research_lab'
  for update;

  if coalesce(v_current_level, 0) >= 1 then
    raise notice
      'Le laboratoire R&D de Pipo Inzaghi est déjà construit au niveau %.',
      v_current_level;
    return;
  end if;

  select project.id
  into v_active_project_id
  from public.infrastructure_projects as project
  where project.team_id = v_team_id
    and project.infrastructure_code = 'research_lab'
    and project.target_level = 1
    and project.status = 'active'
  order by project.created_at
  limit 1
  for update;

  insert into public.team_infrastructures (
    team_id,
    infrastructure_code,
    level,
    completed_project_id,
    completed_at,
    updated_at
  ) values (
    v_team_id,
    'research_lab',
    1,
    v_active_project_id,
    now(),
    now()
  )
  on conflict (team_id, infrastructure_code) do update
  set level = greatest(public.team_infrastructures.level, 1),
      completed_project_id = coalesce(
        public.team_infrastructures.completed_project_id,
        excluded.completed_project_id
      ),
      completed_at = now(),
      updated_at = now();

  if v_active_project_id is not null then
    update public.infrastructure_projects
    set status = 'completed',
        completed_at = now(),
        updated_at = now()
    where id = v_active_project_id;

    insert into public.infrastructure_notifications (
      team_id,
      project_id,
      title,
      message
    ) values (
      v_team_id,
      v_active_project_id,
      'Laboratoire R&D opérationnel',
      'Le Laboratoire R&D atteint désormais le niveau 1 et peut être testé.'
    )
    on conflict (team_id, project_id) do nothing;
  end if;

  raise notice
    'Laboratoire R&D niveau 1 activé pour Pipo Inzaghi / Tsubame Precision (équipe %).',
    v_team_id;
end;
$grant_research_lab$;

commit;
