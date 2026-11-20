begin;
set local lock_timeout = '1s';
set local statement_timeout = '5s';

create function public.get_current_fan_club_assistant_summary_v2()
returns table (
  shop_level integer,
  total_stock integer,
  sales_processed_today boolean,
  today_units_sold integer,
  today_revenue numeric,
  out_of_stock_products text[]
)
language sql
stable
security definer
set search_path = ''
set statement_timeout = '2000ms'
as $$
  with context as (
    select public.current_fan_club_team_id() as team_id, season.id as season_id
    from public.seasons as season
    where season.status = 'active'
    limit 1
  )
  select
    summary.shop_level,
    summary.total_stock,
    summary.sales_processed_today,
    summary.today_units_sold,
    summary.today_revenue,
    array(
      select product.code
      from context
      cross join unnest(array[
        'team-jersey', 'bottle', 'pennant', 'cap', 'supporter-balloon',
        'collector-jersey-france', 'collector-jersey-italy', 'collector-jersey-spain'
      ]::text[]) with ordinality as product(code, position)
      cross join lateral public.get_fan_club_shop_product_config(product.code) as config
      left join public.fan_club_shop_inventory as inventory
        on inventory.team_id = context.team_id
       and inventory.product_code = product.code
       and (not config.is_collector or inventory.collector_season_id = context.season_id)
      where context.team_id is not null
        and config.required_level <= summary.shop_level
        and case when config.is_collector then
          public.team_won_fan_club_collector_gt(context.team_id, context.season_id, product.code)
          else true end
        and coalesce(inventory.quantity, 0) <= 0
      order by product.position
    ) as out_of_stock_products
  from public.get_current_fan_club_assistant_summary() as summary;
$$;

revoke all on function public.get_current_fan_club_assistant_summary_v2() from public, anon;
grant execute on function public.get_current_fan_club_assistant_summary_v2() to authenticated;
notify pgrst, 'reload schema';
commit;
