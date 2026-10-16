begin;
set local lock_timeout='3s';
set local statement_timeout='10s';
create function public.get_national_championship_settlement_health(p_now timestamptz default now())
returns jsonb language sql stable security definer set search_path='' set statement_timeout='5s' as $$
  with active as (select id from public.seasons where status='active' limit 1), backlog as (
    -- Results may take a bounded series of jobs. After a 45-minute grace
    -- period an unfinished country must make the existing health check fail.
    select 'clm' discipline,count(*)::integer pending from active,
      lateral public.get_due_national_championship_edition_ids(active.id,'national_time_trial',p_now-interval '45 minutes')
    union all
    select 'road',count(*)::integer from active,
      lateral public.get_due_national_championship_edition_ids(active.id,'national_road',p_now-interval '45 minutes')
  ) select jsonb_build_object('healthy',coalesce(sum(pending),0)=0,'checkedAt',p_now,
      'timeTrialOverdue',coalesce(max(pending) filter(where discipline='clm'),0),
      'roadOverdue',coalesce(max(pending) filter(where discipline='road'),0)) from backlog;
$$;
revoke all on function public.get_national_championship_settlement_health(timestamptz) from public,anon,authenticated;
grant execute on function public.get_national_championship_settlement_health(timestamptz) to service_role;
notify pgrst,'reload schema';
commit;
