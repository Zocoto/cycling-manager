begin;
set local lock_timeout = '1s';
set local statement_timeout = '10s';
set local application_name = 'cyclostratege-finance-shop-sales-20261124';

insert into public.staff_talent_catalog (code, role, display_name, minimum_level, is_active)
values ('finance_shop_sales', 'financial_director', 'Merchandising', 1, true);

create function private.get_team_fan_club_finance_sales_bonus(
  p_team_season_id uuid,
  p_day_number integer,
  p_elapsed_days integer
)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select 3 * least(5, greatest(1, member.level))
      * case when member.country_id = team_season.registration_country_id then 1.10 else 1 end
      -- A delayed settlement can aggregate multiple days. Only count days on
      -- or after both the contract signature and the affix acquisition.
      * least(p_elapsed_days, sale_day.calendar_date - greatest(
          (contract.signed_at at time zone 'Europe/Paris')::date,
          (talent.created_at at time zone 'Europe/Paris')::date
        ) + 1) / p_elapsed_days
    from public.team_seasons as team_season
    join public.season_days as sale_day
      on sale_day.season_id = team_season.season_id and sale_day.day_number = p_day_number
    join public.staff_contracts as contract
      on contract.team_id = team_season.team_id and contract.status = 'active'
    join public.staff_members as member
      on member.id = contract.staff_member_id and member.role = 'financial_director'
    join public.staff_member_talents as talent
      on talent.staff_member_id = member.id and talent.talent_code = 'finance_shop_sales'
    where team_season.id = p_team_season_id
      and p_elapsed_days > 0
      and contract.signed_at <= now()
      and talent.created_at <= now()
      and sale_day.calendar_date >= (contract.signed_at at time zone 'Europe/Paris')::date
      and sale_day.calendar_date >= (talent.created_at at time zone 'Europe/Paris')::date
    order by contract.signed_at, contract.id
    limit 1
  ), 0);
$$;

revoke all on function private.get_team_fan_club_finance_sales_bonus(uuid, integer, integer)
  from public, anon, authenticated, service_role;

create function public.get_current_team_fan_club_finance_sales_bonus()
returns numeric
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select private.get_team_fan_club_finance_sales_bonus(team_season.id, season.current_day_number, 1)
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment on assignment.sporting_director_id = director.id
      and assignment.role = 'general_manager' and assignment.status = 'active'
    join public.seasons as season on season.status = 'active'
    join public.team_seasons as team_season on team_season.team_id = assignment.team_id
      and team_season.season_id = season.id and team_season.status = 'active'
    where director.auth_user_id = auth.uid() and director.status = 'active'
    limit 1
  ), 0);
$$;

revoke all on function public.get_current_team_fan_club_finance_sales_bonus() from public, anon;
grant execute on function public.get_current_team_fan_club_finance_sales_bonus() to authenticated;

-- Compute the factor once per settlement and apply it to demand before the
-- inventory cap. Keep the existing pricing, accounting and locking logic.
do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_day_context text;
  v_marker text;
  v_markers constant text[] := array[
    '  v_expected numeric;',
    '  for v_inventory in',
    '      * public.get_team_club_shop_volume_multiplier(v_context.team_id)'
  ];
begin
  foreach v_signature in array array[
    'public.settle_current_team_fan_club_sales()'::regprocedure,
    'public.settle_team_fan_club_sales_for_day(uuid,integer)'::regprocedure
  ] loop
    v_definition := replace(pg_get_functiondef(v_signature), E'\r\n', E'\n');
    foreach v_marker in array v_markers loop
      if length(v_definition) - length(replace(v_definition, v_marker, '')) <> length(v_marker) then
        raise exception 'Unexpected shop settlement definition in % at %', v_signature, v_marker;
      end if;
    end loop;

    v_day_context := case
      when v_signature = 'public.settle_current_team_fan_club_sales()'::regprocedure
        then 'v_context.team_season_id, v_context.current_day_number'
      else 'p_team_season_id, p_day_number'
    end;
    v_definition := replace(v_definition, v_markers[1],
      v_markers[1] || E'\n  v_finance_sales_factor numeric;');
    v_definition := replace(v_definition, v_markers[2], format(
      E'  v_finance_sales_factor := 1 + private.get_team_fan_club_finance_sales_bonus(\n'
      '    %s, v_elapsed\n'
      '  ) / 100;\n\n%s', v_day_context, v_markers[2]));
    v_definition := replace(v_definition, v_markers[3],
      v_markers[3] || E'\n      * v_finance_sales_factor');
    execute v_definition;
  end loop;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
