begin;

create index if not exists daily_reward_active_scouting_lookup_idx
  on public.daily_reward_active_effects (
    team_id,
    season_id,
    ends_day_number,
    starts_day_number
  )
  where effect_kind = 'scouting_boost'
    and status = 'active';

create or replace function public.get_current_scouting_supervision_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_effects jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;

  select
    assignment.team_id,
    season.id as season_id,
    coalesce(season.current_day_number, 1)::integer as current_day_number
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
   and team_season.status in ('planned', 'active')
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    return jsonb_build_object('effects', '[]'::jsonb);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'effectPayload', effect.effect_payload,
        'startsDayNumber', effect.starts_day_number,
        'endsDayNumber', effect.ends_day_number
      )
      order by effect.ends_day_number, effect.activated_at
    ),
    '[]'::jsonb
  )
  into v_effects
  from public.daily_reward_active_effects as effect
  where effect.team_id = v_context.team_id
    and effect.season_id = v_context.season_id
    and effect.effect_kind = 'scouting_boost'
    and effect.status = 'active'
    and v_context.current_day_number between
      effect.starts_day_number and effect.ends_day_number;

  return jsonb_build_object(
    'currentDayNumber', v_context.current_day_number,
    'effects', v_effects
  );
end;
$$;

revoke all
on function public.get_current_scouting_supervision_status()
from public, anon;

grant execute
on function public.get_current_scouting_supervision_status()
to authenticated, service_role;

comment on function public.get_current_scouting_supervision_status() is
  'Retourne en un seul appel les couches de bonus de supervision junior actives pour le DS connecté.';

create or replace function public.redeem_current_daily_rewards(
  p_inventory_id uuid,
  p_quantity integer,
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
  v_inventory_ids uuid[];
  v_inventory_id uuid;
  v_result jsonb;
  v_current_game_year integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 1000 then
    raise exception 'La quantité demandée est invalide.';
  end if;

  select season.game_year
  into v_current_game_year
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  select
    inventory.sporting_director_id,
    inventory.reward_key,
    catalog.name,
    catalog.effect_kind
  into v_reward
  from public.daily_reward_inventory as inventory
  join public.sporting_directors as director
    on director.id = inventory.sporting_director_id
   and director.auth_user_id = auth.uid()
   and director.status = 'active'
  join public.daily_reward_catalog as catalog
    on catalog.reward_key = inventory.reward_key
   and catalog.is_active
  where inventory.id = p_inventory_id
    and inventory.status = 'available'
    and inventory.expires_after_game_year >= v_current_game_year;

  if v_reward is null then
    raise exception 'Ce cadeau n’est plus disponible.';
  end if;

  if v_reward.effect_kind not in (
    'form_boost',
    'rider_experience',
    'rating_boost',
    'scouting_boost'
  ) and p_quantity > 1 then
    raise exception 'Ce type de cadeau doit être utilisé un exemplaire à la fois.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'daily-reward-use:' || v_reward.sporting_director_id::text || ':' || v_reward.reward_key,
      0
    )
  );

  select array_agg(
    candidate.id
    order by candidate.expires_after_game_year, candidate.acquired_at, candidate.id
  )
  into v_inventory_ids
  from (
    select
      inventory.id,
      inventory.expires_after_game_year,
      inventory.acquired_at
    from public.daily_reward_inventory as inventory
    where inventory.sporting_director_id = v_reward.sporting_director_id
      and inventory.reward_key = v_reward.reward_key
      and inventory.status = 'available'
      and inventory.expires_after_game_year >= v_current_game_year
    order by inventory.expires_after_game_year, inventory.acquired_at, inventory.id
    limit p_quantity
  ) as candidate;

  if coalesce(cardinality(v_inventory_ids), 0) < p_quantity then
    raise exception 'Le contingent disponible est insuffisant pour cette attribution.';
  end if;

  foreach v_inventory_id in array v_inventory_ids loop
    v_result := public.redeem_current_daily_reward(
      v_inventory_id,
      p_rider_id,
      p_rating_key,
      p_ability_code,
      p_race_edition_id
    );
  end loop;

  if p_quantity = 1 then
    return v_result;
  end if;

  return jsonb_build_object(
    'inventoryId', p_inventory_id,
    'quantityApplied', p_quantity,
    'message', format(
      '%s × %s utilisés : l’effet cumulé a été appliqué.',
      p_quantity,
      v_reward.name
    )
  );
end;
$$;

revoke all
on function public.redeem_current_daily_rewards(uuid, integer, uuid, text, text, uuid)
from public, anon;

grant execute
on function public.redeem_current_daily_rewards(uuid, integer, uuid, text, text, uuid)
to authenticated;

comment on function public.redeem_current_daily_rewards(uuid, integer, uuid, text, text, uuid) is
  'Utilise en lot les lignes disponibles d’une même récompense quotidienne, y compris les bonus de scouting cumulables.';

notify pgrst, 'reload schema';

commit;
