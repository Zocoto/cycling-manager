-- Separate durable supporters, short-term fervor and descriptive team reach.
-- The legacy popularity/result columns stay in place for a reversible rollout,
-- but no longer multiply shop demand.

begin;

create or replace function public.calculate_fan_club_price_factor(
  p_product_code text,
  p_sale_price numeric,
  p_unit_cost numeric,
  p_popularity_index numeric
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_product record;
  v_safe_cost numeric;
  v_tolerated_cost_multiple numeric;
  v_customer_price_ceiling numeric;
  v_price_elasticity_factor numeric;
  v_cost_multiple numeric;
  v_excessive_margin_factor numeric;
  v_price_resistance_factor numeric;
begin
  select config.*
  into v_product
  from public.get_fan_club_shop_product_config(p_product_code) as config;

  if v_product is null or coalesce(p_sale_price, 0) <= 0 then
    return 0;
  end if;

  v_safe_cost := greatest(
    0.01,
    coalesce(nullif(p_unit_cost, 0), v_product.default_cost)
  );
  v_tolerated_cost_multiple := v_product.margin_tolerance;
  v_customer_price_ceiling := v_product.maximum_price;

  if p_sale_price >= v_customer_price_ceiling then
    return 0;
  end if;

  v_price_elasticity_factor := least(
    2,
    power(v_product.suggested_price / p_sale_price, v_product.elasticity)
  );
  v_cost_multiple := p_sale_price / v_safe_cost;
  v_excessive_margin_factor := case
    when v_cost_multiple <= v_tolerated_cost_multiple then 1
    else exp(
      -(v_cost_multiple - v_tolerated_cost_multiple) * v_product.margin_penalty
    )
  end;
  v_price_resistance_factor := case
    when p_sale_price <= v_product.resistance_start then 1
    else power(
      greatest(
        0,
        (v_customer_price_ceiling - p_sale_price)
          / (v_customer_price_ceiling - v_product.resistance_start)
      ),
      2
    )
  end;

  return greatest(
    0,
    least(
      2,
      v_price_elasticity_factor
        * v_excessive_margin_factor
        * v_price_resistance_factor
    )
  );
end;
$$;

do $$
declare
  v_signature regprocedure;
  v_definition text;
  v_simplified text;
  v_popularity_term constant text :=
    '* (0.75 + v_profile.popularity_index / 200.0)';
  v_results_term constant text :=
    '* v_profile.recent_results_multiplier';
  v_popularity_occurrences integer;
  v_results_occurrences integer;
begin
  foreach v_signature in array array[
    'public.settle_current_team_fan_club_sales()'::regprocedure,
    'public.settle_team_fan_club_sales_for_day(uuid,integer)'::regprocedure
  ]
  loop
    v_definition := pg_get_functiondef(v_signature);
    v_popularity_occurrences := (
      length(v_definition) - length(replace(v_definition, v_popularity_term, ''))
    ) / length(v_popularity_term);
    v_results_occurrences := (
      length(v_definition) - length(replace(v_definition, v_results_term, ''))
    ) / length(v_results_term);

    if v_popularity_occurrences <> 1 or v_results_occurrences <> 1 then
      raise exception
        'Expected one legacy demand multiplier in %, found popularity=% and results=%',
        v_signature,
        v_popularity_occurrences,
        v_results_occurrences;
    end if;

    v_simplified := replace(
      replace(
        v_definition,
        v_popularity_term,
        ''
      ),
      v_results_term,
      ''
    );

    if position('v_profile.popularity_index / 200.0' in v_simplified) > 0
      or position('v_profile.recent_results_multiplier' in v_simplified) > 0
    then
      raise exception
        'Unable to simplify Fan Club demand function % safely',
        v_signature;
    end if;

    execute v_simplified;
  end loop;
end;
$$;

comment on column public.fan_club_profiles.popularity_index is
  'Legacy history retained for rollback; team reach is derived by the application and has no direct economic effect.';

comment on column public.fan_club_profiles.recent_results_multiplier is
  'Legacy history retained for rollback; recent results now affect short-term fervor instead of multiplying shop demand twice.';

comment on function public.calculate_fan_club_price_factor(
  text, numeric, numeric, numeric
) is
  'Calculates demand from price only. The fourth legacy argument is retained for compatibility and intentionally ignored.';

commit;
