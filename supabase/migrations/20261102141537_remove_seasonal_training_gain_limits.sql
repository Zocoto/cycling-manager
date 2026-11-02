begin;
set local lock_timeout = '3s';
set local statement_timeout = '12s';
set local application_name = 'remove-season-training-limit-20261102';

-- Patch only the former annual allowance. Keep every other live engine rule,
-- including potential, absolute 100, veteran maintenance, bonuses and ledgers.
do $patch$
declare
  v_signature regprocedure; v_definition text; v_pair text[];
begin
  foreach v_signature in array array[
    'public.settle_due_training_sessions()'::regprocedure,
    'public.settle_due_free_agent_training(integer)'::regprocedure,
    'private.apply_training_season_carryover(uuid,uuid,text)'::regprocedure
  ] loop
    v_definition := replace(pg_get_functiondef(v_signature),E'\r\n',E'\n');
    if position('unlimited_season_training_v1' in v_definition)>0 then continue; end if;
    foreach v_pair slice 1 in array array[
      array['v_gain_cap integer;', ''],
      array['v_gain_cap := case[[:space:]]+when v_progress.initial_rating < 60 then 18[[:space:]]+when v_progress.initial_rating < 70 then 12[[:space:]]+when v_progress.initial_rating < 80 then 8[[:space:]]+when v_progress.initial_rating < 90 then 4[[:space:]]+else 2[[:space:]]*end;', '-- unlimited_season_training_v1: progression has no annual allowance.'],
      array['and v_progress.rating_gain < v_gain_cap[[:space:]]*', ''],
      array['v_gain_cap[[:space:]]*-[[:space:]]*v_progress.rating_gain,[[:space:]]*', ''],
      array['v_progress.rating_gain >= v_gain_cap[[:space:]]+or[[:space:]]+', '']
    ] loop
      if (select count(*) from regexp_matches(v_definition,v_pair[1],'g'))<>1 then
        raise exception 'Unexpected annual training guard in %: %',v_signature,v_pair[1];
      end if;
      v_definition := regexp_replace(v_definition,v_pair[1],v_pair[2],'g');
    end loop;
    if position('v_gain_cap' in v_definition)>0 then raise exception 'Annual allowance remains in %',v_signature; end if;
    execute v_definition;
  end loop;
end;
$patch$;

-- Only one affected stat was found across all four audited seasons. The
-- immutable receipt and exact source guards prevent re-crediting or guessing.
create table if not exists private.training_season_limit_recoveries (
  rider_id uuid not null references public.riders(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  stat_code text not null,
  session_id uuid not null references public.rider_training_sessions(id),
  recovered_milli integer not null check (recovered_milli>0),
  balance_before integer not null, balance_after integer not null,
  rating_before smallint not null, rating_after smallint not null,
  rating_change smallint not null check (rating_change>=0),
  session_changes_before jsonb not null,
  recorded_at timestamptz not null default now(),
  primary key (rider_id,season_id,stat_code)
);
alter table private.training_season_limit_recoveries enable row level security;
revoke all on table private.training_season_limit_recoveries from public,anon,authenticated;

do $recover$
declare
  v_rider constant uuid := '4e44a1c8-c33d-49b1-9cf2-b5e809e20762';
  v_season constant uuid := 'c0c5824c-43a4-442e-907c-265c479efa0a';
  v_progress record; v_rating record; v_session record;
  v_discarded integer; v_balance integer; v_change integer;
  v_career_captured boolean;
begin
  if exists(select 1 from private.training_season_limit_recoveries where rider_id=v_rider and season_id=v_season and stat_code='hills') then return; end if;
  if not exists(select 1 from public.seasons where id=v_season and status='active' and game_year=4) then
    raise exception 'Audited season is no longer active: re-audit before recovery.';
  end if;
  -- Same order as normal settlement: stat progress before current ratings.
  select * into strict v_progress from public.rider_training_stat_progress
    where rider_id=v_rider and season_id=v_season and stat_code='hills' for update;
  select r.*,i.potential_steps into strict v_rating from public.rider_season_ratings r
    join public.riders i on i.id=r.rider_id where r.rider_id=v_rider and r.season_id=v_season for update of r;
  if v_progress.initial_rating<>61 or v_progress.total_training_milli<>14409
    or v_progress.rating_gain<>12 or v_progress.rating_loss<>0 or v_progress.balance_milli<>999
    or v_rating.age<>18 or v_rating.hills<>73 or v_rating.potential_steps<>8 then
    raise exception 'Iguchi progression changed: re-audit before recovery.';
  end if;
  select * into strict v_session from public.rider_training_sessions
    where id='994b87f3-c297-4588-9142-1040c5cbe968'::uuid and rider_id=v_rider and season_id=v_season
      and season_day_id='45e7c287-7866-4858-8eae-201edd82ea5c'::uuid and is_contract_eligible
    for update;
  if coalesce((v_session.rating_changes->>'hills')::integer,0)<>0 then
    raise exception 'Recovery session changed: inspect its ledger.';
  end if;
  v_career_captured := exists(select 1 from public.career_achievement_receipts where source_key='training:'||v_session.id::text);
  v_discarded := v_progress.total_training_milli-v_progress.rating_gain*1000-v_progress.balance_milli;
  v_balance := v_progress.balance_milli+v_discarded;
  v_change := least(floor(v_balance/1000.0)::integer,
    public.get_rider_potential_stat_cap(v_rating.potential_steps)-v_rating.hills,100-v_rating.hills);
  v_balance := v_balance-v_change*1000;
  if v_discarded<>1410 or v_change<>2 or v_balance<>409 then raise exception 'Unexpected audited recovery arithmetic.'; end if;
  insert into private.training_season_limit_recoveries(rider_id,season_id,stat_code,session_id,recovered_milli,
    balance_before,balance_after,rating_before,rating_after,rating_change,session_changes_before)
  values(v_rider,v_season,'hills',v_session.id,v_discarded,v_progress.balance_milli,v_balance,
    v_rating.hills,v_rating.hills+v_change,v_change,v_session.rating_changes);
  update public.rider_training_stat_progress set balance_milli=v_balance,rating_gain=rating_gain+v_change,updated_at=now()
    where rider_id=v_rider and season_id=v_season and stat_code='hills';
  update public.rider_season_ratings set hills=hills+v_change,updated_at=now() where rider_id=v_rider and season_id=v_season;
  -- Book today's recovery in the existing report, preserving all other stats
  -- and the original work totals. Progression charts need no extra query.
  update public.rider_training_sessions set rating_changes=jsonb_set(rating_changes,'{hills}',to_jsonb(v_change)) where id=v_session.id;
  -- The career trigger deliberately consumes each session only once. If its
  -- original receipt already exists, add only this recovery's delta using a
  -- separate receipt; otherwise the normal trigger captures the updated row.
  if v_career_captured and v_session.status='completed' and exists(
    select 1 from public.career_achievement_epoch e join public.season_days d on d.id=v_session.season_day_id
    where v_session.processed_at>=e.activated_at and d.calendar_date>=(e.activated_at at time zone 'Europe/Paris')::date
  ) then
    insert into public.career_achievement_receipts(source_key)
      values('training-season-limit:'||v_rider::text||':'||v_season::text||':hills') on conflict do nothing;
    if found then
      perform private.record_career_achievement(v_session.team_id,'future_natural_progress',v_rider::text||':hills',v_change,true);
    end if;
  end if;
end;
$recover$;

notify pgrst,'reload schema';
commit;
