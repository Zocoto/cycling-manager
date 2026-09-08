begin;

create or replace function public.get_team_club_shop_specialization_power(
  p_team_id uuid,
  p_specialization_code text
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when public.get_team_infrastructure_specialization(
        p_team_id,
        'club_shop'
      ) = p_specialization_code
      then public.get_infrastructure_specialization_power_multiplier(
        infrastructure.level
      )
      else 0
    end
    from public.team_infrastructures as infrastructure
    where infrastructure.team_id = p_team_id
      and infrastructure.infrastructure_code = 'club_shop'
    limit 1
  ), 0)::numeric
$$;

create or replace function public.get_team_club_shop_volume_multiplier(
  p_team_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select (
    1 + 0.10 * public.get_team_club_shop_specialization_power(
      p_team_id,
      'volume_retail'
    )
  )::numeric
$$;

-- Une hausse réelle de 8 % est évaluée comme le prix de référence par la
-- demande. Le DS peut donc conserver le même volume en augmentant son prix de
-- vente jusqu'à ce seuil, au lieu de recevoir artificiellement des ventes.
create or replace function public.get_team_club_shop_effective_demand_price(
  p_team_id uuid,
  p_sale_price numeric
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select (
    p_sale_price / (
      1 + 0.08 * public.get_team_club_shop_specialization_power(
        p_team_id,
        'premium_retail'
      )
    )
  )::numeric
$$;

create or replace function public.get_team_club_shop_wholesale_cost_multiplier(
  p_team_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select (
    1 - 0.05 * public.get_team_club_shop_specialization_power(
      p_team_id,
      'limited_editions'
    )
  )::numeric
$$;

-- La conjoncture est commune à tous les produits de l'équipe pendant une
-- journée. Sans orientation, une journée a une chance sur trois d'être
-- prolifique (facteur >= 1,15). Commerce opportuniste ajoute jusqu'à 10 points
-- à cette probabilité, sans rendre le résultat prévisible à l'avance.
create or replace function public.get_team_club_shop_daily_demand_factor(
  p_team_id uuid,
  p_season_id uuid,
  p_day_number integer
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_power numeric;
  v_prolific_chance numeric;
  v_category_roll numeric;
  v_magnitude_roll numeric;
begin
  v_power := public.get_team_club_shop_specialization_power(
    p_team_id,
    'limited_editions'
  );
  v_prolific_chance := 1.0 / 3.0 + 0.10 * v_power;
  v_category_roll := abs(
    pg_catalog.hashtextextended(
      p_team_id::text || ':' || p_season_id::text || ':' ||
        p_day_number::text || ':shop-day',
      0
    ) % 1000000
  )::numeric / 1000000.0;
  v_magnitude_roll := abs(
    pg_catalog.hashtextextended(
      p_team_id::text || ':' || p_season_id::text || ':' ||
        p_day_number::text || ':shop-demand',
      0
    ) % 1000000
  )::numeric / 1000000.0;

  return round(case
    when v_category_roll < v_prolific_chance
      then 1.15 + 0.30 * v_magnitude_roll
    else 0.55 + 0.60 * v_magnitude_roll
  end, 3);
end;
$$;

-- La remise est intégrée au coût moyen du stock : la marge affichée, le débit
-- de trésorerie et la transaction financière restent parfaitement alignés.
do $migration$
declare
  v_definition text;
  v_marker constant text := 'v_cost := p_quantity * v_unit_cost;';
  v_marker_count integer;
begin
  select pg_get_functiondef(
    'public.purchase_current_team_fan_club_stock(text,integer)'::regprocedure
  ) into v_definition;

  if position('get_team_club_shop_wholesale_cost_multiplier' in v_definition) = 0 then
    v_marker_count := (
      length(v_definition) - length(replace(v_definition, v_marker, ''))
    ) / length(v_marker);
    if v_marker_count <> 1 then
      raise exception
        'Point d’intégration du coût de stock de la boutique inattendu (% marqueurs).',
        v_marker_count;
    end if;

    v_definition := replace(
      v_definition,
      v_marker,
      'v_unit_cost := round(' || chr(10) ||
        '    v_unit_cost * public.get_team_club_shop_wholesale_cost_multiplier(' || chr(10) ||
        '      v_context.team_id' || chr(10) ||
        '    ),' || chr(10) ||
        '    2' || chr(10) ||
        '  );' || chr(10) || chr(10) ||
        '  ' || v_marker
    );
    execute v_definition;
  end if;
end;
$migration$;

-- Les deux voies de vente et la nouvelle conjoncture quotidienne sont
-- appliquées aux règlements interactif et automatisé/fin de saison.
do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_day_expression text;
  v_random_marker constant text := 'v_random_factor := 0.55 + random() * 0.90;';
  v_price_marker constant text := '          v_inventory.sale_price,';
  v_volume_marker constant text := '      * v_elapsed;';
  v_marker_count integer;
begin
  foreach v_signature in array array[
    'public.settle_current_team_fan_club_sales()'::regprocedure,
    'public.settle_team_fan_club_sales_for_day(uuid,integer)'::regprocedure
  ]
  loop
    select pg_get_functiondef(v_signature) into v_definition;
    v_day_expression := case
      when v_signature =
        'public.settle_current_team_fan_club_sales()'::regprocedure
      then 'v_context.current_day_number'
      else 'p_day_number'
    end;

    if position('get_team_club_shop_daily_demand_factor' in v_definition) = 0 then
      v_marker_count := (
        length(v_definition) -
          length(replace(v_definition, v_random_marker, ''))
      ) / length(v_random_marker);
      if v_marker_count <> 1 then
        raise exception
          'Point d’intégration de la conjoncture boutique inattendu dans % (% marqueurs).',
          v_signature,
          v_marker_count;
      end if;
      v_definition := replace(
        v_definition,
        v_random_marker,
        'v_random_factor := public.get_team_club_shop_daily_demand_factor(' || chr(10) ||
          '      v_context.team_id,' || chr(10) ||
          '      v_context.season_id,' || chr(10) ||
          '      ' || v_day_expression || chr(10) ||
          '    );'
      );
    end if;

    if position('get_team_club_shop_effective_demand_price' in v_definition) = 0 then
      v_marker_count := (
        length(v_definition) - length(replace(v_definition, v_price_marker, ''))
      ) / length(v_price_marker);
      if v_marker_count <> 1 then
        raise exception
          'Point d’intégration de Gamme premium inattendu dans % (% marqueurs).',
          v_signature,
          v_marker_count;
      end if;
      v_definition := replace(
        v_definition,
        v_price_marker,
        '          public.get_team_club_shop_effective_demand_price(' || chr(10) ||
          '            v_context.team_id,' || chr(10) ||
          '            v_inventory.sale_price' || chr(10) ||
          '          ),'
      );
    end if;

    if position('get_team_club_shop_volume_multiplier' in v_definition) = 0 then
      v_marker_count := (
        length(v_definition) - length(replace(v_definition, v_volume_marker, ''))
      ) / length(v_volume_marker);
      if v_marker_count <> 1 then
        raise exception
          'Point d’intégration de Grande diffusion inattendu dans % (% marqueurs).',
          v_signature,
          v_marker_count;
      end if;
      v_definition := replace(
        v_definition,
        v_volume_marker,
        '      * public.get_team_club_shop_volume_multiplier(v_context.team_id)' || chr(10) ||
          v_volume_marker
      );
    end if;

    execute v_definition;
  end loop;
end;
$migration$;

revoke all on function public.get_team_club_shop_specialization_power(uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_team_club_shop_volume_multiplier(uuid)
  from public, anon, authenticated;
revoke all on function public.get_team_club_shop_effective_demand_price(uuid, numeric)
  from public, anon, authenticated;
revoke all on function public.get_team_club_shop_wholesale_cost_multiplier(uuid)
  from public, anon, authenticated;
revoke all on function public.get_team_club_shop_daily_demand_factor(uuid, uuid, integer)
  from public, anon, authenticated;

grant execute on function public.get_team_club_shop_specialization_power(uuid, text)
  to service_role;
grant execute on function public.get_team_club_shop_volume_multiplier(uuid)
  to service_role;
grant execute on function public.get_team_club_shop_effective_demand_price(uuid, numeric)
  to service_role;
grant execute on function public.get_team_club_shop_wholesale_cost_multiplier(uuid)
  to service_role;
grant execute on function public.get_team_club_shop_daily_demand_factor(uuid, uuid, integer)
  to service_role;

comment on function public.get_team_club_shop_volume_multiplier(uuid) is
  'Ajoute jusqu’à 10 % de volume quotidien avec Grande diffusion.';
comment on function public.get_team_club_shop_effective_demand_price(uuid, numeric) is
  'Autorise jusqu’à 8 % de prix ou marge supplémentaire sans pénalité de demande avec Gamme premium.';
comment on function public.get_team_club_shop_wholesale_cost_multiplier(uuid) is
  'Réduit jusqu’à 5 % le coût réellement payé du stock avec Commerce opportuniste.';
comment on function public.get_team_club_shop_daily_demand_factor(uuid, uuid, integer) is
  'Produit la conjoncture quotidienne commune de la boutique et ajoute jusqu’à 10 points de chance prolifique.';

notify pgrst, 'reload schema';

commit;
