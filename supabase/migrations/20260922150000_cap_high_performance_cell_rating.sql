begin;

update public.daily_reward_catalog
set
  description = 'Une intervention exceptionnelle renforce durablement une statistique primaire encore perfectible.',
  effect_summary = '+2 dans la statistique primaire choisie · maximum 80',
  effect_payload = jsonb_set(effect_payload, '{maximumRating}', '80'::jsonb, true)
where reward_key = 'high-performance-cell';

alter function public.redeem_current_daily_reward(uuid, uuid, text, text, uuid)
rename to redeem_current_daily_reward_without_high_performance_cap;

revoke all
on function public.redeem_current_daily_reward_without_high_performance_cap(uuid, uuid, text, text, uuid)
from public, anon, authenticated;

create function public.redeem_current_daily_reward(
  p_inventory_id uuid,
  p_rider_id uuid default null,
  p_rating_key text default null,
  p_ability_code text default null,
  p_race_edition_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward record;
  v_current_rating integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;

  select
    catalog.reward_key,
    greatest(1, least(2, (catalog.effect_payload ->> 'amount')::integer)) as amount,
    greatest(1, least(100, (catalog.effect_payload ->> 'maximumRating')::integer)) as maximum_rating,
    assignment.team_id
  into v_reward
  from public.daily_reward_inventory as inventory
  join public.daily_reward_catalog as catalog
    on catalog.reward_key = inventory.reward_key
   and catalog.is_active
  join public.sporting_directors as director
    on director.id = inventory.sporting_director_id
   and director.auth_user_id = auth.uid()
   and director.status = 'active'
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  where inventory.id = p_inventory_id
    and catalog.reward_key = 'high-performance-cell';

  if v_reward is not null
    and p_rating_key in (
      'mountain', 'hills', 'flat', 'time_trial', 'cobbles', 'sprint',
      'acceleration', 'downhill', 'endurance', 'resistance', 'recovery',
      'breakaway', 'prologue'
    ) then
    execute format(
      'select max(rating.%1$I)::integer
       from public.rider_season_ratings as rating
       join public.seasons as season
         on season.id = rating.season_id
        and season.status in (''active'', ''planned'')
       where rating.rider_id = $1
         and exists (
           select 1
           from public.rider_contracts as contract
           where contract.rider_id = rating.rider_id
             and contract.team_id = $2
             and contract.status = ''active''
         )',
      p_rating_key
    )
    into v_current_rating
    using p_rider_id, v_reward.team_id;

    if v_current_rating is not null
      and v_current_rating + v_reward.amount > v_reward.maximum_rating then
      raise exception 'La Cellule haute performance ne peut être appliquée qu’à une statistique de % ou moins afin de ne pas dépasser %.',
        v_reward.maximum_rating - v_reward.amount,
        v_reward.maximum_rating;
    end if;
  end if;

  return public.redeem_current_daily_reward_without_high_performance_cap(
    p_inventory_id,
    p_rider_id,
    p_rating_key,
    p_ability_code,
    p_race_edition_id
  );
end;
$$;

revoke all
on function public.redeem_current_daily_reward(uuid, uuid, text, text, uuid)
from public, anon;

grant execute
on function public.redeem_current_daily_reward(uuid, uuid, text, text, uuid)
to authenticated;

comment on function public.redeem_current_daily_reward(uuid, uuid, text, text, uuid) is
  'Applique une récompense quotidienne et empêche la Cellule haute performance de porter une statistique au-delà de 80.';

notify pgrst, 'reload schema';

commit;
