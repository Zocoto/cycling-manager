begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

-- Prepared without awarding anything. Activate only once the corrected UI is live.
alter table public.halloween_editions add column mobile_replay_cutoff_at timestamptz;
create table public.halloween_mobile_replays (
  edition_id text not null,
  user_id uuid not null,
  granted_at timestamptz not null default now(),
  used_run_id uuid unique references public.halloween_runs(id),
  primary key(edition_id,user_id),
  foreign key(edition_id,user_id) references public.halloween_wallets(edition_id,user_id)
);
alter table public.halloween_mobile_replays enable row level security;
revoke all on public.halloween_mobile_replays from public,anon,authenticated;
grant all on public.halloween_mobile_replays to service_role;

-- Slot 3 is a one-off restored attempt, not another daily ticket slot.
alter table public.halloween_runs drop constraint halloween_runs_attempt_check;
alter table public.halloween_runs add constraint halloween_runs_attempt_check check(attempt in(1,2,3));

create function public.grant_halloween_mobile_replays(p_cutoff timestamptz default now())
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_edition public.halloween_editions%rowtype;v_added integer;v_total integer;
begin
  select * into strict v_edition from public.halloween_editions where id='halloween-2026' for update;
  if not v_edition.enabled or now()<v_edition.starts_at or now()>=v_edition.ends_at then
    raise exception 'Les jeux doivent être ouverts pour restituer les essais.';
  end if;
  if p_cutoff is null or p_cutoff>now() or p_cutoff<v_edition.starts_at then
    raise exception 'Date de correction invalide.';
  end if;
  if v_edition.mobile_replay_cutoff_at is null then
    update public.halloween_editions set mobile_replay_cutoff_at=p_cutoff where id=v_edition.id
      returning * into v_edition;
  end if;
  -- A retry keeps the original deployment cutoff: later players are not added.
  insert into public.halloween_mobile_replays(edition_id,user_id)
    select v_edition.id,r.user_id from public.halloween_runs r
    where r.edition_id=v_edition.id and r.attempt in(1,2) and r.started_at<v_edition.mobile_replay_cutoff_at
    group by r.user_id on conflict do nothing;
  get diagnostics v_added=row_count;
  select count(*) into v_total from public.halloween_mobile_replays where edition_id=v_edition.id;
  return jsonb_build_object('cutoff',v_edition.mobile_replay_cutoff_at,'added',v_added,'total',v_total);
end $$;
revoke all on function public.grant_halloween_mobile_replays(timestamptz) from public,anon,authenticated;
grant execute on function public.grant_halloween_mobile_replays(timestamptz) to service_role;

-- Patch only start. Keep score verification, rewards, curses and purchases intact.
-- Exact anchors fail closed if another change has altered the current implementation.
do $$
declare v_def text;
  v_anchor text:=$old$      select coalesce(max(attempt),0)+1 into v_attempt from public.halloween_runs where edition_id=v_edition.id and user_id=p_user and day=v_day;
      if v_attempt>2 or (v_attempt=2 and v_wallet.tickets<1) then raise exception 'Votre essai quotidien est utilisé. Un seul ticket bonus peut être utilisé par jour.'; end if;$old$;
  v_insert text:='case when v_curse.kind=''vampire'' then v_curse.id end) returning * into v_run;';
begin
  select pg_get_functiondef('public.halloween_action(uuid,uuid,text,jsonb)'::regprocedure) into v_def;
  v_def:=replace(v_def,chr(13)||chr(10),chr(10));
  v_anchor:=replace(v_anchor,chr(13)||chr(10),chr(10));
  if (length(v_def)-length(replace(v_def,v_anchor,'')))/length(v_anchor)<>1
     or (length(v_def)-length(replace(v_def,v_insert,'')))/length(v_insert)<>1 then
    raise exception 'Halloween start anchors changed: cannot restore attempts safely.';
  end if;
  v_def:=replace(v_def,v_anchor,$new$      select coalesce(max(attempt),0)+1 into v_attempt from public.halloween_runs where edition_id=v_edition.id and user_id=p_user and day=v_day and attempt in(1,2);
      if v_attempt>1 and exists(select 1 from public.halloween_mobile_replays where edition_id=v_edition.id and user_id=p_user and used_run_id is null) then
        v_attempt:=3;
      elsif v_attempt>2 or (v_attempt=2 and v_wallet.tickets<1) then
        raise exception 'Votre essai quotidien est utilisé. Un seul ticket bonus peut être utilisé par jour.';
      end if;$new$);
  v_def:=replace(v_def,v_insert,v_insert||$consume$
      if v_attempt=3 then
        -- The existing wallet FOR UPDATE serializes double clicks and concurrent starts.
        update public.halloween_mobile_replays set used_run_id=v_run.id
          where edition_id=v_edition.id and user_id=p_user and used_run_id is null;
        if not found then raise exception 'Votre essai restitué a déjà été utilisé.'; end if;
      end if;$consume$);
  execute v_def;
end $$;

do $$
declare v_def text;
  v_anchor text:='''tickets'',coalesce(v_wallet.tickets,0),';
  v_attempts text:='''attempts'',(select count(*) from public.halloween_runs where edition_id=v_edition.id and user_id=auth.uid() and day=v_day),';
begin
  select pg_get_functiondef('public.get_current_halloween_state()'::regprocedure) into v_def;
  v_def:=replace(v_def,chr(13)||chr(10),chr(10));
  if (length(v_def)-length(replace(v_def,v_anchor,'')))/length(v_anchor)<>1
     or (length(v_def)-length(replace(v_def,v_attempts,'')))/length(v_attempts)<>1 then
    raise exception 'Halloween state anchors changed: cannot expose restored attempt safely.';
  end if;
  v_def:=replace(v_def,v_anchor,v_anchor||$state$
    'replayAvailable',exists(select 1 from public.halloween_mobile_replays where edition_id=v_edition.id and user_id=auth.uid() and used_run_id is null),$state$);
  v_def:=replace(v_def,v_attempts,replace(v_attempts,'and day=v_day','and day=v_day and attempt in(1,2)'));
  execute v_def;
end $$;

notify pgrst,'reload schema';
commit;
