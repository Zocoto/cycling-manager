begin;

insert into public.inventory_catalog_items (
  item_key,
  name,
  category,
  rarity,
  description,
  effect_summary,
  effect_payload,
  icon_key,
  is_consumable,
  status
)
values (
  'classified-talent-dossier',
  'Dossier de talent classifié',
  'potential_boost',
  'epic',
  'Des notes confidentielles qui révèlent une marge de progression exceptionnelle chez un coureur.',
  '+1 étoile de talent au coureur sélectionné.',
  '{"potentialBonus":1}'::jsonb,
  'potential',
  true,
  'active'
)
on conflict (item_key) do update set
  name = excluded.name,
  category = excluded.category,
  rarity = excluded.rarity,
  description = excluded.description,
  effect_summary = excluded.effect_summary,
  effect_payload = excluded.effect_payload,
  icon_key = excluded.icon_key,
  is_consumable = excluded.is_consumable,
  status = excluded.status,
  updated_at = now();

create or replace function private.grant_hidden_switchback_rewards(
  p_sporting_director_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_context record;
  v_inventory_item_id uuid;
  v_reward_id uuid;
begin
  if p_sporting_director_id is null then
    return false;
  end if;

  select
    team_season.id as team_season_id,
    season.current_day_number,
    season_day.id as season_day_id
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
  join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = season.current_day_number
  where director.id = p_sporting_director_id
    and director.status = 'active'
  order by assignment.created_at desc
  limit 1;

  if v_context is null then
    return false;
  end if;

  select item.id
  into v_inventory_item_id
  from public.inventory_catalog_items as item
  where item.item_key = 'classified-talent-dossier'
    and item.status = 'active'
  limit 1;

  if v_inventory_item_id is null then
    raise exception 'Le Dossier de talent classifié est introuvable.';
  end if;

  insert into public.reward_events (
    source_reference,
    source_type,
    sporting_director_id,
    team_season_id,
    cash_prize,
    description
  )
  values (
    'hidden-switchback:' || p_sporting_director_id::text,
    'game_objective',
    p_sporting_director_id,
    v_context.team_season_id,
    100000,
    'Découverte du Virage caché'
  )
  on conflict (source_reference) do nothing
  returning id into v_reward_id;

  if v_reward_id is null then
    return false;
  end if;

  update public.team_seasons
  set cash_balance = cash_balance + 100000
  where id = v_context.team_season_id;

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
  values (
    v_context.team_season_id,
    v_context.season_day_id,
    v_context.current_day_number,
    100000,
    'other',
    'posted',
    'Cadeau secret — Le Virage caché',
    'reward:hidden-switchback:' || p_sporting_director_id::text,
    now()
  )
  on conflict (team_season_id, source_reference) do nothing;

  insert into public.team_item_inventory (
    team_season_id,
    inventory_item_id,
    quantity,
    acquisition_source,
    acquired_at,
    updated_at
  )
  values (
    v_context.team_season_id,
    v_inventory_item_id,
    2,
    'hidden-switchback',
    now(),
    now()
  )
  on conflict (team_season_id, inventory_item_id) do update set
    quantity = public.team_item_inventory.quantity + excluded.quantity,
    acquisition_source = excluded.acquisition_source,
    updated_at = now();

  return true;
end;
$$;

create or replace function public.discover_current_sporting_director_easter_egg()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_director_id uuid;
  v_inserted integer := 0;
  v_rewards_granted boolean := false;
begin
  select director.id into v_director_id
  from public.sporting_directors as director
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_director_id is null then
    raise exception 'Directeur Sportif introuvable.';
  end if;

  insert into public.sporting_director_trophies (
    sporting_director_id, trophy_key, available_at, claimed_at
  )
  values (v_director_id, 'virage_cache', now(), now())
  on conflict (sporting_director_id, trophy_key) do nothing;

  get diagnostics v_inserted = row_count;
  v_rewards_granted := private.grant_hidden_switchback_rewards(v_director_id);

  return jsonb_build_object(
    'newlyUnlocked', v_inserted = 1,
    'rewardsGranted', v_rewards_granted,
    'trophyKey', 'virage_cache'
  );
end;
$$;

create or replace function public.validate_assidu_avatar_glasses()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_glasses_key text;
begin
  if new.avatar_key is null
     or new.avatar_key not like 'director_custom_v1:%' then
    return new;
  end if;

  v_glasses_key := split_part(
    substring(
      new.avatar_key
      from char_length('director_custom_v1:') + 1
    ),
    '.',
    13
  );

  if v_glasses_key = 'honor-roll' then
    if not exists (
      select 1
      from public.sporting_director_attendance_trophies as trophy
      where trophy.sporting_director_id = new.id
    ) then
      raise exception
        'Le trophée Assidu est requis pour porter les lunettes Premier de la classe.';
    end if;
  elsif v_glasses_key = 'spy-glasses' then
    if not exists (
      select 1
      from public.sporting_director_trophies as trophy
      where trophy.sporting_director_id = new.id
        and trophy.trophy_key = 'virage_cache'
        and trophy.claimed_at is not null
    ) then
      raise exception
        'Le Virage caché doit être découvert pour porter les lunettes d’espion.';
    end if;
  end if;

  return new;
end;
$$;

do $$
declare
  discovered record;
begin
  for discovered in
    select trophy.sporting_director_id
    from public.sporting_director_trophies as trophy
    where trophy.trophy_key = 'virage_cache'
      and trophy.claimed_at is not null
  loop
    perform private.grant_hidden_switchback_rewards(
      discovered.sporting_director_id
    );
  end loop;
end;
$$;

revoke all on function private.grant_hidden_switchback_rewards(uuid)
  from public, anon, authenticated;

revoke all on function public.discover_current_sporting_director_easter_egg()
  from public, anon;
grant execute on function public.discover_current_sporting_director_easter_egg()
  to authenticated, service_role;

revoke all on function public.validate_assidu_avatar_glasses()
  from public, anon, authenticated;

comment on function private.grant_hidden_switchback_rewards(uuid) is
  'Attribue une seule fois 100 000 euros et deux Dossiers de talent classifiés au découvreur du Virage caché.';

notify pgrst, 'reload schema';

commit;
