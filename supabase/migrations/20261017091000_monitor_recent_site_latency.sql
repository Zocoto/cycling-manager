begin;
set local application_name = 'site-latency-delivery-20261017';
set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- Inspect at most 5,000 indexed samples from the last 15 minutes. This runs
-- only on the existing health-check cadence, never on a player's page request.
create or replace function public.get_recent_site_performance_health()
returns jsonb language sql stable security definer
set search_path = '' set statement_timeout = '2s'
as $$
  with recent as materialized (
    select source, route, metric, value, ok
    from public.performance_samples
    where recorded_at >= statement_timestamp() - interval '15 minutes'
    order by recorded_at desc
    limit 5000
  ), measurements as (
    select source, route, metric, count(*)::integer as samples,
      count(*) filter (where not ok)::integer as errors,
      percentile_cont(0.95) within group (order by value) as p95_ms,
      case when source = 'rpc' then 2000
        when metric = 'LCP' then 4000
        when metric = 'TTFB' then 1800
        when metric = 'INP' then 500 end as budget_ms
    from recent
    where source = 'rpc' or (source = 'web' and metric in ('LCP','TTFB','INP'))
    group by source, route, metric
  ), breaches as (
    select * from measurements where samples >= 10
      and (p95_ms >= budget_ms or (errors >= 3 and errors::numeric / samples >= 0.10))
  )
  select jsonb_build_object(
    'healthy', not exists(select 1 from breaches),
    'status', case when exists(select 1 from breaches) then 'degraded'
      when exists(select 1 from measurements where samples >= 10) then 'observed'
      else 'insufficient_data' end,
    'windowMinutes', 15,
    'sampleCount', (select count(*) from recent),
    'breaches', coalesce((select jsonb_agg(jsonb_build_object(
      'source', source, 'route', route, 'metric', metric, 'samples', samples,
      'errors', errors, 'p95Ms', round(p95_ms::numeric), 'budgetMs', budget_ms
    ) order by source, route, metric) from breaches), '[]'::jsonb)
  );
$$;

revoke all on function public.get_recent_site_performance_health() from public, anon, authenticated;
grant execute on function public.get_recent_site_performance_health() to service_role;
notify pgrst, 'reload schema';
commit;
