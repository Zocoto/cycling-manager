-- Each upgrade has its own price. The old global 60/70/80/90% discount
-- made the most powerful late-game facilities cheaper than their first level.
-- Only new projects use this tariff: existing projects keep their recorded
-- base_cost and final_cost, including architect reductions already applied.

create or replace function public.get_team_infrastructure_base_cost(
  p_infrastructure_code text,
  p_target_level integer
)
returns numeric
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_costs integer[];
begin
  case p_infrastructure_code
    when 'recruitment_data_room' then v_costs := array[200000, 350000, 550000];
    when 'staff_academy' then v_costs := array[1500000, 2100000, 2900000, 3900000, 5100000];
    when 'training_center' then v_costs := array[100000, 250000, 500000, 900000, 1500000];
    when 'fan_club_headquarters' then v_costs := array[200000, 450000, 850000, 1400000, 2200000];
    when 'club_shop' then v_costs := array[150000, 350000, 650000, 1050000, 1600000];
    when 'international_youth_center' then v_costs := array[500000, 800000, 1200000, 1700000, 2300000];
    when 'indoor_track' then v_costs := array[180000, 450000, 900000, 1550000, 2400000];
    when 'cryotherapy_center' then v_costs := array[150000, 275000, 450000, 700000, 1000000];
    when 'wind_tunnel' then v_costs := array[400000, 850000, 1500000, 2400000, 3600000];
    when 'weather_center' then v_costs := array[50000, 90000, 150000, 230000, 350000];
    when 'media_center' then v_costs := array[650000, 1200000, 2000000, 3000000, 4300000];
    when 'international_welcome_center' then v_costs := array[800000, 1500000, 2500000, 3800000, 5500000];
    when 'research_lab' then v_costs := array[1200000, 2000000, 3000000, 4200000, 5600000, 7200000, 9000000];
    -- Retired; retained solely for consistency with historical project codes.
    when 'tactical_center' then v_costs := array[3000000, 3900000, 5100000, 6600000, 8400000];
    else raise exception 'Cette infrastructure d’équipe n’existe pas.';
  end case;

  if p_target_level < 1 or p_target_level > cardinality(v_costs) then
    raise exception 'Niveau d’infrastructure d’équipe invalide.';
  end if;

  return v_costs[p_target_level];
end;
$$;

revoke all on function public.get_team_infrastructure_base_cost(text, integer)
from public, anon, authenticated;

-- Keep the current RPC's validation, architect handling, duration override and
-- payment flow intact. Replace its obsolete calculated price immediately before
-- the architect discount is computed. This is intentionally a surgical patch:
-- redefining the RPC from an older migration would regress later fixes.
do $migration$
declare
  v_definition text;
  v_needle text := E'\n  if p_architect_contract_id is not null then';
begin
  select replace(
    pg_catalog.pg_get_functiondef(
      'public.start_current_team_infrastructure_project(text,uuid,uuid)'::regprocedure
    ),
    chr(13),
    ''
  ) into v_definition;

  if position('public.get_team_infrastructure_base_cost(' in v_definition) = 0 then
    if position(v_needle in v_definition) = 0
      or position('v_base_cost := round(' in v_definition) = 0
    then
      raise exception 'Point d’intégration des coûts d’équipe introuvable.';
    end if;

    v_definition := replace(
      v_definition,
      v_needle,
      E'\n  v_base_cost := public.get_team_infrastructure_base_cost(\n'
        || E'    p_infrastructure_code,\n'
        || E'    v_target_level\n'
        || E'  );\n'
        || v_needle
    );
    execute v_definition;
  end if;

  select replace(
    pg_catalog.pg_get_functiondef(
      'public.start_current_team_infrastructure_project(text,uuid,uuid)'::regprocedure
    ),
    chr(13),
    ''
  ) into v_definition;

  if position('public.get_team_infrastructure_base_cost(' in v_definition) = 0
    or position('public.get_team_infrastructure_base_cost(' in v_definition)
       > position('if p_architect_contract_id is not null then' in v_definition)
  then
    raise exception 'Le coût progressif n’est pas appliqué avant la remise architecte.';
  end if;
end;
$migration$;
