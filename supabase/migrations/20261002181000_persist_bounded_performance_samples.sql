begin;
create table public.performance_samples (
  id bigint generated always as identity primary key,
  recorded_at timestamptz not null default clock_timestamp(),
  source text not null check (source in ('web', 'rpc')),
  route text not null check (length(route) <= 80),
  metric text not null check (length(metric) <= 100),
  value double precision not null check (value >= 0 and value <= 300000),
  device text not null check (device in ('mobile', 'desktop', 'server')),
  ok boolean not null,
  deployment text not null check (length(deployment) <= 100)
);
create index performance_samples_recorded_at_idx on public.performance_samples(recorded_at);
create table public.performance_sample_budgets (
  day date primary key,
  used integer not null check (used between 0 and 20000)
);
alter table public.performance_samples enable row level security;
alter table public.performance_sample_budgets enable row level security;
revoke all on public.performance_samples, public.performance_sample_budgets from public, anon, authenticated;

create function public.record_performance_samples(p_samples jsonb, p_deployment text)
returns integer language plpgsql security definer set search_path = ''
set lock_timeout = '500ms' set statement_timeout = '2s'
as $$
declare
  v_budget integer;
  v_count integer;
begin
  if jsonb_typeof(p_samples) <> 'array' or jsonb_array_length(p_samples) > 32 then
    raise exception 'Invalid performance batch';
  end if;
  -- A hard global daily ceiling bounds storage even if the beacon is abused.
  insert into public.performance_sample_budgets(day,used) values (current_date,0)
  on conflict do nothing;
  select used into v_budget from public.performance_sample_budgets
  where day = current_date for update;
  if v_budget >= 20000 then return 0; end if;
  insert into public.performance_samples(source,route,metric,value,device,ok,deployment)
  select sample.source, sample.route, sample.metric, sample.value, sample.device, sample.ok, left(p_deployment,100)
  from jsonb_to_recordset(p_samples) as sample(source text,route text,metric text,value double precision,device text,ok boolean)
  limit least(32,20000-v_budget);
  get diagnostics v_count = row_count;
  update public.performance_sample_budgets set used = used + v_count where day = current_date;
  return v_count;
end;
$$;

create function public.prune_performance_samples()
returns integer language plpgsql security definer set search_path = ''
set lock_timeout = '1s' set statement_timeout = '10s'
as $$
declare v_count integer;
begin
  delete from public.performance_samples where recorded_at < now() - interval '14 days';
  get diagnostics v_count = row_count;
  delete from public.performance_sample_budgets where day < current_date - 14;
  return v_count;
end;
$$;

create function public.get_performance_summary(p_days integer default 7)
returns table(source text,route text,metric text,device text,deployment text,sample_count bigint,error_count bigint,p50 double precision,p75 double precision,p95 double precision)
language sql stable security definer set search_path = '' set statement_timeout = '5s'
as $$
  select sample.source,sample.route,sample.metric,sample.device,sample.deployment,
    count(*), count(*) filter (where not sample.ok),
    percentile_cont(0.50) within group (order by sample.value),
    percentile_cont(0.75) within group (order by sample.value),
    percentile_cont(0.95) within group (order by sample.value)
  from public.performance_samples as sample
  where sample.recorded_at >= now() - make_interval(days => greatest(1,least(14,p_days)))
  group by sample.source,sample.route,sample.metric,sample.device,sample.deployment
  order by count(*) desc;
$$;

revoke all on function public.record_performance_samples(jsonb,text), public.prune_performance_samples(), public.get_performance_summary(integer) from public, anon, authenticated;
grant execute on function public.record_performance_samples(jsonb,text), public.prune_performance_samples(), public.get_performance_summary(integer) to service_role;
notify pgrst, 'reload schema';
commit;
