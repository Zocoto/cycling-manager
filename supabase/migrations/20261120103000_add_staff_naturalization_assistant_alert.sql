begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

create function private.get_dashboard_staff_naturalization_opportunity(
  p_team_id uuid,
  p_season_id uuid
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with context as materialized (
    select country.id as country_id, country.name as country_name,
      greatest(0,
        least(5, greatest(0, coalesce((
          select infrastructure.level
          from public.team_infrastructures as infrastructure
          where infrastructure.team_id = p_team_id
            and infrastructure.infrastructure_code = 'international_welcome_center'
        ), 0)))
        + case when public.get_team_specialization_power(
            p_team_id, 'international_welcome_center', 'administrative_path'
          ) > 0 then 1 else 0 end
        + public.get_team_federal_staff_naturalization_bonus(p_team_id)
        - (
          select count(*)::integer
          from public.staff_naturalizations as naturalization
          where naturalization.team_id = p_team_id
            and naturalization.season_id = p_season_id
        )
      ) as remaining_count
    from public.team_seasons as team_season
    join public.countries as country
      on country.id = team_season.registration_country_id and country.is_active
    where team_season.team_id = p_team_id
      and team_season.season_id = p_season_id
      and team_season.status in ('planned', 'active')
  )
  select jsonb_build_object(
    'eligibleMemberCount', eligible.member_count,
    'remainingCount', context.remaining_count,
    'targetCountryName', context.country_name
  )
  from context
  cross join lateral (
    select count(distinct member.id)::integer as member_count
    from public.staff_contracts as contract
    join public.staff_members as member on member.id = contract.staff_member_id
    where context.remaining_count > 0
      and contract.team_id = p_team_id
      and contract.status = 'active'
      and member.country_id <> context.country_id
  ) as eligible
  where context.remaining_count > 0 and eligible.member_count > 0;
$$;

revoke all on function private.get_dashboard_staff_naturalization_opportunity(uuid, uuid)
  from public, anon, authenticated, service_role;

-- Keep the existing authenticated dashboard request and its query budget.
do $patch$
declare
  v_definition text := pg_get_functiondef('public.get_current_dashboard_assistant_summary()'::regprocedure);
  v_anchor constant text := $anchor$'equipmentPartnerSignatureAvailable', ($anchor$;
begin
  if position('staffNaturalizationOpportunity' in v_definition) > 0
    or (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor) <> 1
  then
    raise exception 'Unexpected dashboard summary; staff naturalization alert update cancelled.';
  end if;

  execute replace(v_definition, v_anchor, $replacement$'staffNaturalizationOpportunity', (
        select private.get_dashboard_staff_naturalization_opportunity(context.team_id, context.season_id)
        from current_context context
      ),
      'equipmentPartnerSignatureAvailable', ($replacement$);
end;
$patch$;

notify pgrst, 'reload schema';
commit;

