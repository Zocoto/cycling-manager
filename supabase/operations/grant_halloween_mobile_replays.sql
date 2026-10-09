begin;
set local lock_timeout='3s';
set local statement_timeout='8s';
do $audit$
declare v_wallets text;v_runs text;v_after text;v_result jsonb;
begin
  -- The same edition lock used by player actions prevents a legitimate change
  -- between these narrowly scoped before/after checks.
  perform 1 from public.halloween_editions where id='halloween-2026' for update;
  select md5(coalesce(string_agg(concat_ws(':',user_id,coins,tickets),',' order by user_id),'')) into v_wallets
    from public.halloween_wallets where edition_id='halloween-2026';
  select md5(coalesce(string_agg(concat_ws(':',id,status,attempt,score,distance,coins,finished_at),',' order by id),'')) into v_runs
    from public.halloween_runs where edition_id='halloween-2026';
  select public.grant_halloween_mobile_replays(__HALLOWEEN_UI_CUTOFF__::timestamptz) into v_result;
  select md5(coalesce(string_agg(concat_ws(':',user_id,coins,tickets),',' order by user_id),'')) into v_after
    from public.halloween_wallets where edition_id='halloween-2026';
  if v_after is distinct from v_wallets then raise exception 'Wallet preservation check failed.'; end if;
  select md5(coalesce(string_agg(concat_ws(':',id,status,attempt,score,distance,coins,finished_at),',' order by id),'')) into v_after
    from public.halloween_runs where edition_id='halloween-2026';
  if v_after is distinct from v_runs then raise exception 'Score preservation check failed.'; end if;
  perform set_config('cyclostratege.mobile_replay_receipt',
    (v_result||jsonb_build_object('scoresPreserved',true,'gainsAndTicketsPreserved',true))::text,true);
end $audit$;
select current_setting('cyclostratege.mobile_replay_receipt')::jsonb as receipt;
commit;
