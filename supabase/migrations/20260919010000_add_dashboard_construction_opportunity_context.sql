begin;

create index if not exists infrastructure_projects_active_team_idx
  on public.infrastructure_projects (team_id)
  where status = 'active';

-- Keep the Bureau read bounded to the connected DS and return only the data
-- needed to reuse the same construction/affordability rules as the catalogue.
create or replace function public.get_current_dashboard_construction_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
set statement_timeout = '2000ms'
as $$
  with current_context as (
    select
      team.id as team_id,
      director.experience_points,
      team_season.cash_balance
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.teams as team
      on team.id = assignment.team_id
     and team.status = 'active'
    join public.seasons as season
      on season.status = 'active'
    join public.team_seasons as team_season
      on team_season.team_id = team.id
     and team_season.season_id = season.id
     and team_season.status = 'active'
    where director.auth_user_id = auth.uid()
      and director.status = 'active'
    limit 1
  )
  select jsonb_build_object(
    'experiencePoints', coalesce(context.experience_points, 0),
    'balance', context.cash_balance,
    'levels', (
      select coalesce(
        jsonb_object_agg(building.infrastructure_code, building.level),
        '{}'::jsonb
      )
      from public.team_infrastructures as building
      where building.team_id = context.team_id
    ),
    'activeProjects', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'code', project.infrastructure_code,
            'architectContractId', project.architect_contract_id
          ) order by project.created_at, project.id
        ),
        '[]'::jsonb
      )
      from public.infrastructure_projects as project
      where project.team_id = context.team_id
        and project.status = 'active'
    ),
    'architects', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'contractId', contract.id,
            'level', member.level,
            'specialty', coalesce(member.architect_specialty, 'balanced'),
            'costReductionPercentage', public.get_architect_adjusted_reduction(
              contract.id,
              case coalesce(member.architect_specialty, 'balanced')
                when 'economist' then member.level * 6
                when 'foreman' then member.level * 2
                else member.level * 4
              end,
              'cost'
            ),
            'hasParallelConstructionTalent', exists (
              select 1
              from public.staff_member_talents as talent
              where talent.staff_member_id = member.id
                and talent.talent_code = 'architect_parallel_construction'
            )
          ) order by contract.id
        ),
        '[]'::jsonb
      )
      from public.staff_contracts as contract
      join public.staff_members as member
        on member.id = contract.staff_member_id
       and member.role = 'architect'
      where contract.team_id = context.team_id
        and contract.status = 'active'
    )
  )
  from current_context as context;
$$;

revoke all on function public.get_current_dashboard_construction_context()
  from public, anon;
grant execute on function public.get_current_dashboard_construction_context()
  to authenticated, service_role;

comment on function public.get_current_dashboard_construction_context() is
  'État compact et indexé des chantiers, niveaux et architectes du DS connecté pour son alerte de construction.';

notify pgrst, 'reload schema';

commit;
