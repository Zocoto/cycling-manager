begin;

-- Freeze the four tables involved while the explicitly approved 13/10/3
-- scope is checked and repaired atomically.
lock table public.rider_contracts in share row exclusive mode;
lock table public.riders in share row exclusive mode;
lock table public.youth_academy_riders in share row exclusive mode;
lock table public.team_finance_transactions in share row exclusive mode;

create temporary table legacy_youth_dismissal_refunds
on commit drop
as
select
  academy.id as academy_rider_id,
  academy.promoted_rider_id as rider_id,
  academy.first_name,
  academy.last_name,
  team_season.id as team_season_id,
  season_day.id as season_day_id,
  coalesce(active_season.current_day_number, 1) as day_number,
  -legacy_transaction.amount as refund_amount
from public.youth_academy_riders as academy
join public.team_finance_transactions as legacy_transaction
  on legacy_transaction.source_reference =
    'youth-dismissal:' || academy.id::text
 and legacy_transaction.status = 'posted'
 and legacy_transaction.amount < 0
join public.team_seasons as team_season
  on team_season.id = legacy_transaction.team_season_id
 and team_season.team_id = academy.team_id
join public.seasons as active_season
  on active_season.id = team_season.season_id
 and active_season.status = 'active'
join public.season_days as season_day
  on season_day.season_id = active_season.id
 and season_day.day_number = coalesce(active_season.current_day_number, 1)
where academy.status = 'free_agent'
  and not exists (
    select 1
    from public.team_finance_transactions as previous_refund
    where previous_refund.team_season_id = team_season.id
      and previous_refund.source_reference =
        'youth-dismissal-refund:' || academy.id::text
  );

create temporary table legacy_uncontracted_youth_dismissals
on commit drop
as
select
  refund.academy_rider_id,
  refund.rider_id
from legacy_youth_dismissal_refunds as refund
join public.riders as rider
  on rider.id = refund.rider_id
 and rider.status = 'free_agent'
join public.rider_season_ratings as rating
  on rating.rider_id = rider.id
join public.team_seasons as team_season
  on team_season.id = refund.team_season_id
 and team_season.season_id = rating.season_id
where not exists (
  select 1
  from public.rider_contracts as contract
  where contract.rider_id = rider.id
);

do $scope_check$
declare
  v_refund_count integer;
  v_suspension_count integer;
begin
  select count(*)::integer
  into v_refund_count
  from legacy_youth_dismissal_refunds;

  select count(*)::integer
  into v_suspension_count
  from legacy_uncontracted_youth_dismissals;

  if v_refund_count <> 13
    or v_suspension_count <> 10
    or v_refund_count - v_suspension_count <> 3 then
    raise exception
      'Le périmètre historique a changé : % remboursements, % suspensions, % contrats conservés.',
      v_refund_count,
      v_suspension_count,
      v_refund_count - v_suspension_count;
  end if;
end;
$scope_check$;

with inserted_refunds as (
  insert into public.team_finance_transactions (
    team_season_id,
    season_day_id,
    day_number,
    amount,
    category,
    status,
    description,
    source_reference,
    posted_at
  )
  select
    refund.team_season_id,
    refund.season_day_id,
    refund.day_number,
    refund.refund_amount,
    'training',
    'posted',
    'Remboursement du renvoi de ' || refund.first_name || ' ' || refund.last_name,
    'youth-dismissal-refund:' || refund.academy_rider_id::text,
    now()
  from legacy_youth_dismissal_refunds as refund
  on conflict (team_season_id, source_reference) do nothing
  returning team_season_id, amount
),
refund_totals as (
  select
    inserted.team_season_id,
    sum(inserted.amount) as amount
  from inserted_refunds as inserted
  group by inserted.team_season_id
)
update public.team_seasons as team_season
set cash_balance = team_season.cash_balance + refund.amount
from refund_totals as refund
where team_season.id = refund.team_season_id;

update public.riders as rider
set status = 'suspended'
where rider.id in (
  select repair.rider_id
  from legacy_uncontracted_youth_dismissals as repair
);

update public.youth_academy_training_attempts as attempt
set status = 'expired'
where attempt.status = 'started'
  and attempt.academy_rider_id in (
    select repair.academy_rider_id
    from legacy_uncontracted_youth_dismissals as repair
  );

update public.youth_academy_riders as academy
set
  status = 'release_pending',
  promotion_game_year = null,
  pending_training_mode = null,
  pending_training_mode_after_season_id = null,
  pending_training_mode_after_day_number = null,
  updated_at = now()
where academy.id in (
  select repair.academy_rider_id
  from legacy_uncontracted_youth_dismissals as repair
);

-- Reuse the suspended identity when the ten juniors are finally released at
-- J1. Future dismissals have no professional identity and keep the normal
-- insertion branch introduced by the preventive fix.
do $rollover_migration$
declare
  v_definition text;
  v_old_insert constant text := $old$  loop
    insert into public.riders (
      country_id, first_name, last_name, status, potential_steps
    )
    values (
      v_youth.country_id, v_youth.first_name, v_youth.last_name,
      case when v_youth.promote_to_pro then 'active' else 'free_agent' end,
      v_youth.potential_steps
    )
    returning id into v_new_rider_id;
$old$;
  v_new_insert constant text := $new$  loop
    if v_youth.status = 'release_pending'
      and v_youth.promoted_rider_id is not null then
      v_new_rider_id := v_youth.promoted_rider_id;

      update public.riders
      set status = 'free_agent'
      where id = v_new_rider_id
        and status = 'suspended';

      if not found then
        raise exception
          'L’identité professionnelle suspendue du junior % est introuvable.',
          v_youth.id;
      end if;
    else
      insert into public.riders (
        country_id, first_name, last_name, status, potential_steps
      )
      values (
        v_youth.country_id, v_youth.first_name, v_youth.last_name,
        case when v_youth.promote_to_pro then 'active' else 'free_agent' end,
        v_youth.potential_steps
      )
      returning id into v_new_rider_id;
    end if;
$new$;
begin
  select pg_get_functiondef(
    'public.rollover_game_season(uuid,boolean)'::regprocedure
  ) into v_definition;
  v_definition := replace(v_definition, E'\r\n', E'\n');

  if position(v_old_insert in v_definition) = 0 then
    raise exception 'La création des juniors à J1 est introuvable.';
  end if;

  execute replace(v_definition, v_old_insert, v_new_insert);
end;
$rollover_migration$;

comment on function public.rollover_game_season(uuid, boolean) is
  'Clôture atomiquement une saison et ouvre la suivante. À J1, les promotions sont arbitrées et les départs juniors programmés deviennent agents libres, y compris les renvois historiques réparés.';

notify pgrst, 'reload schema';

commit;
