begin;

-- A team created during day 1 did not participate in the whole season. The
-- former date-only comparison incorrectly treated it as present from midnight.
create or replace function public.get_rookie_team_eligibility(
  p_season_id uuid default null
)
returns table (
  team_id uuid,
  sporting_director_id uuid,
  joined_at timestamptz,
  arrival_game_year integer,
  first_full_season_game_year integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with target_season as (
    select season.id, season.game_year
    from public.seasons as season
    where season.id = coalesce(
      p_season_id,
      (select active.id from public.seasons as active
       where active.status = 'active' limit 1)
    )
  )
  select
    generation.team_id,
    generation.sporting_director_id,
    generation.created_at,
    arrival_season.game_year,
    case
      when generation.created_at <=
        (arrival_season.starts_on::timestamp at time zone 'Europe/Paris')
      then arrival_season.game_year
      else arrival_season.game_year + 1
    end
  from public.initial_career_generations as generation
  join public.seasons as arrival_season
    on arrival_season.id = generation.season_id
  join target_season on true
  join public.team_seasons as target_team
    on target_team.team_id = generation.team_id
   and target_team.season_id = target_season.id
   and target_team.status <> 'withdrawn'
  join public.sporting_directors as director
    on director.id = generation.sporting_director_id
   and director.status = 'active'
  where not exists (
    select 1
    from public.alpha_bot_managers as bot
    where bot.sporting_director_id = generation.sporting_director_id
  )
    and not exists (
      select 1
      from public.seasons as completed_season
      join public.team_seasons as completed_team
        on completed_team.team_id = generation.team_id
       and completed_team.season_id = completed_season.id
       and completed_team.status = 'completed'
      where completed_season.status = 'completed'
        and completed_season.game_year < target_season.game_year
        and (completed_season.starts_on::timestamp at time zone 'Europe/Paris')
          >= generation.created_at
    )
  order by generation.created_at, generation.team_id;
$$;

-- The feature starts with season 3. This prevents a later team provisioning
-- from retroactively settling a season that ended before the feature existed.
create or replace function private.settle_rookie_rewards_after_season_completion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.game_year >= 3
    and new.status = 'completed'
    and old.status is distinct from 'completed'
  then
    perform private.settle_rookie_season_rewards(new.id);
  end if;
  return new;
end;
$$;

create or replace function private.retry_rookie_rewards_after_team_season_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_previous_season_id uuid;
begin
  select previous.id into v_previous_season_id
  from public.seasons as current_season
  join public.seasons as previous
    on previous.game_year = current_season.game_year - 1
   and previous.game_year >= 3
   and previous.status = 'completed'
  where current_season.id = new.season_id;

  if v_previous_season_id is not null then
    perform private.settle_rookie_season_rewards(v_previous_season_id);
  end if;
  return new;
end;
$$;

alter table public.rookie_season_rewards
  add column if not exists revoked_at timestamptz,
  add column if not exists revocation_reason text;

create temporary table revoked_rookie_reward_items
on commit drop
as
select
  reward.id as reward_id,
  reward.granted_at,
  reward.target_team_season_id,
  expanded.item_key,
  item.id as inventory_item_id,
  inventory.id as inventory_id,
  application.id as application_id
from public.rookie_season_rewards as reward
join public.seasons as season on season.id = reward.season_id
cross join lateral jsonb_array_elements_text(reward.reward_items)
  as expanded(item_key)
join public.inventory_catalog_items as item
  on item.item_key = expanded.item_key
left join public.team_item_inventory as inventory
  on inventory.team_season_id = reward.target_team_season_id
 and inventory.inventory_item_id = item.id
left join lateral (
  select candidate.id
  from public.rider_consumable_item_applications as candidate
  where inventory.id is null
    and candidate.team_season_id = reward.target_team_season_id
    and candidate.inventory_item_id = item.id
    and candidate.applied_at >= reward.granted_at
  order by candidate.applied_at, candidate.id
  limit 1
) as application on true
where season.game_year < 3
  and reward.revoked_at is null;

do $$
begin
  if exists (
    select 1
    from revoked_rookie_reward_items as revoked
    where revoked.inventory_id is null
      and revoked.application_id is null
  ) then
    raise exception
      'A historical rookie reward was consumed without a reversible audit trail.';
  end if;
end;
$$;

-- Reverse a rider item if it was already consumed after the erroneous grant.
delete from public.rider_special_abilities as ability
using revoked_rookie_reward_items as revoked,
  public.rider_consumable_item_applications as application
where application.id = revoked.application_id
  and application.category = 'special_ability'
  and ability.rider_id = application.rider_id
  and ability.ability_code = application.ability_code
  and ability.source_type = 'inventory_item'
  and ability.source_reference =
    'inventory-consumption:' || application.id::text;

update public.riders as rider
set potential_steps = greatest(
  0,
  rider.potential_steps - application.potential_bonus
)
from revoked_rookie_reward_items as revoked,
  public.rider_consumable_item_applications as application
where application.id = revoked.application_id
  and application.category = 'potential_boost'
  and rider.id = application.rider_id;

update public.rider_season_ratings as rating
set
  mountain = greatest(0, rating.mountain - case when application.rating_key = 'mountain' then application.rating_bonus else 0 end),
  hills = greatest(0, rating.hills - case when application.rating_key = 'hills' then application.rating_bonus else 0 end),
  flat = greatest(0, rating.flat - case when application.rating_key = 'flat' then application.rating_bonus else 0 end),
  time_trial = greatest(0, rating.time_trial - case when application.rating_key = 'time_trial' then application.rating_bonus else 0 end),
  cobbles = greatest(0, rating.cobbles - case when application.rating_key = 'cobbles' then application.rating_bonus else 0 end),
  sprint = greatest(0, rating.sprint - case when application.rating_key = 'sprint' then application.rating_bonus else 0 end),
  acceleration = greatest(0, rating.acceleration - case when application.rating_key = 'acceleration' then application.rating_bonus else 0 end),
  downhill = greatest(0, rating.downhill - case when application.rating_key = 'downhill' then application.rating_bonus else 0 end),
  endurance = greatest(0, rating.endurance - case when application.rating_key = 'endurance' then application.rating_bonus else 0 end),
  resistance = greatest(0, rating.resistance - case when application.rating_key = 'resistance' then application.rating_bonus else 0 end),
  recovery = greatest(0, rating.recovery - case when application.rating_key = 'recovery' then application.rating_bonus else 0 end),
  breakaway = greatest(0, rating.breakaway - case when application.rating_key = 'breakaway' then application.rating_bonus else 0 end),
  prologue = greatest(0, rating.prologue - case when application.rating_key = 'prologue' then application.rating_bonus else 0 end),
  updated_at = now()
from revoked_rookie_reward_items as revoked
join public.rider_consumable_item_applications as application
  on application.id = revoked.application_id
join public.team_seasons as target_team
  on target_team.id = revoked.target_team_season_id
where application.category = 'rating_boost'
  and rating.rider_id = application.rider_id
  and rating.season_id = target_team.season_id;

delete from public.rider_consumable_item_applications as application
using revoked_rookie_reward_items as revoked
where application.id = revoked.application_id;

update public.team_item_inventory as inventory
set quantity = inventory.quantity - 1,
  updated_at = now()
from revoked_rookie_reward_items as revoked
where inventory.id = revoked.inventory_id
  and inventory.quantity > 1;

delete from public.team_item_inventory as inventory
using revoked_rookie_reward_items as revoked
where inventory.id = revoked.inventory_id
  and inventory.quantity = 1;

-- Keep the original message in place, but turn it into an explicit correction
-- so recipients are not left with a false podium announcement.
update public.sporting_director_messages as message
set
  subject = 'Correction du classement rookie',
  preview = 'Le podium de la Saison 2 a été calculé rétroactivement par erreur.',
  body = 'Le message de podium rookie envoyé aujourd’hui a été déclenché par erreur sur la Saison 2, avant le lancement de cette récompense. Les cadeaux associés ont donc été retirés. Le premier podium officiel sera calculé à la clôture de la Saison 3, avec l’ensemble des équipes réellement éligibles.',
  action_href = '/jeu/classements?circuit=uci&vue=rookies',
  action_label = 'Voir le classement rookie',
  is_important = false
from public.rookie_season_rewards as reward,
  public.seasons as season
where season.id = reward.season_id
  and season.game_year < 3
  and reward.revoked_at is null
  and message.sporting_director_id = reward.sporting_director_id
  and message.source_reference =
    'rookie-season-reward:' || reward.season_id::text || ':' || reward.team_id::text;

update public.rookie_season_rewards as reward
set
  revoked_at = now(),
  revocation_reason = 'Attribution rétroactive antérieure au lancement en Saison 3'
from public.seasons as season
where season.id = reward.season_id
  and season.game_year < 3
  and reward.revoked_at is null;

comment on column public.rookie_season_rewards.revoked_at is
  'Date d’annulation d’une attribution erronée, conservée pour audit.';
comment on column public.rookie_season_rewards.revocation_reason is
  'Motif auditable de l’annulation d’une attribution rookie.';

notify pgrst, 'reload schema';

commit;
