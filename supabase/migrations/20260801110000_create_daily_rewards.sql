begin;

create table public.daily_reward_catalog (
  reward_key text primary key,
  name text not null,
  description text not null,
  effect_summary text not null,
  importance smallint not null,
  effect_kind text not null,
  effect_payload jsonb not null default '{}'::jsonb,
  icon_key text not null default 'gift',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint daily_reward_catalog_key_not_empty check (btrim(reward_key) <> ''),
  constraint daily_reward_catalog_importance_range check (importance between 1 and 10),
  constraint daily_reward_catalog_effect_allowed check (
    effect_kind in (
      'form_boost', 'rider_experience', 'rating_boost',
      'training_multiplier', 'scouting_boost', 'equipment',
      'special_ability', 'naturalization', 'wildcard'
    )
  ),
  constraint daily_reward_catalog_payload_object check (jsonb_typeof(effect_payload) = 'object')
);

insert into public.daily_reward_catalog (
  reward_key, name, description, effect_summary, importance,
  effect_kind, effect_payload, icon_key
)
values
  ('energy-ration', 'Ration énergétique', 'Une ration simple à remettre au coureur de votre choix.', '+5 en forme pour un coureur', 1, 'form_boost', '{"amount":5}', 'nutrition'),
  ('experience-day', 'Journée d’expérience', 'Une journée de course assimilée sans fatigue supplémentaire.', '+1 jour d’expérience pour un coureur', 1, 'rider_experience', '{"amount":1}', 'experience'),
  ('large-energy-ration', 'Grande ration énergétique', 'Une ration complète pour relancer un coureur émoussé.', '+10 en forme pour un coureur', 2, 'form_boost', '{"amount":10}', 'nutrition'),
  ('commercial-discovery', 'Découverte matérielle', 'Une référence commerciale adaptée rejoint le stock de l’équipe.', '1 équipement commercial courant', 2, 'equipment', '{"rarity":"common"}', 'equipment'),
  ('collective-training-150', 'Séance stimulée', 'Le prochain entraînement professionnel de 8 h profite à tout le groupe.', 'Progression de la prochaine séance ×1,5 pour toute l’équipe', 3, 'training_multiplier', '{"multiplier":1.5}', 'training'),
  ('scouting-week-10', 'Œil affûté', 'Le réseau de détection bénéficie d’un regain temporaire de précision.', '+10 % de qualité de scouting pendant 7 jours', 3, 'scouting_boost', '{"percentage":10,"durationDays":7}', 'scouting'),
  ('performance-equipment', 'Matériel performance', 'Une pièce performante rejoint gratuitement votre inventaire.', '1 équipement commercial performance', 4, 'equipment', '{"rarity":"performance"}', 'equipment'),
  ('collective-training-200', 'Bloc haute intensité', 'La prochaine séance collective produit deux fois plus de progression.', 'Progression de la prochaine séance ×2 pour toute l’équipe', 4, 'training_multiplier', '{"multiplier":2}', 'training'),
  ('secondary-technique', 'Perfectionnement technique', 'Un travail ciblé améliore définitivement une qualité secondaire.', '+1 dans la statistique secondaire choisie', 5, 'rating_boost', '{"amount":1,"statScope":"secondary"}', 'rating'),
  ('scouting-week-20', 'Réseau prioritaire', 'Vos scouts accèdent pendant une semaine à de meilleurs signaux.', '+20 % de qualité de scouting pendant 7 jours', 5, 'scouting_boost', '{"percentage":20,"durationDays":7}', 'scouting'),
  ('premium-equipment', 'Équipement premium', 'Une référence haut de gamme rejoint le stock sans transaction.', '1 équipement commercial premium', 6, 'equipment', '{"rarity":"premium"}', 'equipment'),
  ('secondary-specialization', 'Atelier spécialisé', 'Une séance individuelle fixe un acquis secondaire durable.', '+1 dans la statistique secondaire choisie', 6, 'rating_boost', '{"amount":1,"statScope":"secondary"}', 'rating'),
  ('talent-revealed', 'Talent révélé', 'Le staff révèle une capacité qui restera attachée au coureur.', '1 capacité spéciale au choix pour un coureur', 7, 'special_ability', '{}', 'ability'),
  ('automatic-naturalization', 'Passeport sportif', 'Le coureur rejoint immédiatement la nationalité sportive de l’équipe.', 'Naturalisation automatique d’un coureur éligible', 7, 'naturalization', '{}', 'passport'),
  ('elite-equipment', 'Prototype de compétition', 'Une pièce premium issue d’une petite série rejoint l’équipe.', '1 équipement premium', 8, 'equipment', '{"rarity":"premium"}', 'equipment'),
  ('collective-training-225', 'Cellule performance', 'La prochaine séance collective reçoit un puissant soutien scientifique.', 'Progression de la prochaine séance ×2,25 pour toute l’équipe', 8, 'training_multiplier', '{"multiplier":2.25}', 'training'),
  ('primary-breakthrough', 'Passage de cap', 'Un coureur franchit un palier sur sa qualité principale choisie.', '+1 dans la statistique primaire choisie', 9, 'rating_boost', '{"amount":1,"statScope":"primary"}', 'rating'),
  ('talent-revealed-plus', 'Talent révélé', 'Une capacité spéciale compatible peut être transmise au coureur.', '1 capacité spéciale au choix pour un coureur', 9, 'special_ability', '{}', 'ability'),
  ('golden-ticket', 'Ticket d’or', 'Une invitation automatique pour la course Elite de votre choix, hors Grand Tour.', 'Wild Card Elite automatique hors Grand Tour', 10, 'wildcard', '{}', 'ticket'),
  ('high-performance-cell', 'Cellule haute performance', 'Une intervention exceptionnelle transforme durablement un leader.', '+2 dans la statistique primaire choisie', 10, 'rating_boost', '{"amount":2,"statScope":"primary"}', 'rating'),
  ('historic-training', 'Séance historique', 'Toute l’équipe bénéficiera d’une séance hors normes au prochain passage de 8 h.', 'Progression de la prochaine séance ×3 pour toute l’équipe (+200 %)', 10, 'training_multiplier', '{"multiplier":3}', 'training'),
  ('ultimate-prototype', 'Prototype ultime', 'Une pièce premium parmi les meilleures références disponibles.', '1 équipement premium', 10, 'equipment', '{"rarity":"premium"}', 'equipment')
on conflict (reward_key) do update set
  name = excluded.name,
  description = excluded.description,
  effect_summary = excluded.effect_summary,
  importance = excluded.importance,
  effect_kind = excluded.effect_kind,
  effect_payload = excluded.effect_payload,
  icon_key = excluded.icon_key,
  is_active = true;

create table public.daily_reward_claims (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  team_season_id uuid not null references public.team_seasons(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  season_day_id uuid not null references public.season_days(id) on delete cascade,
  streak_day smallint not null,
  importance smallint not null,
  reward_key text not null references public.daily_reward_catalog(reward_key) on delete restrict,
  claimed_at timestamptz not null default now(),
  constraint daily_reward_claims_streak_range check (streak_day between 1 and 28),
  constraint daily_reward_claims_importance_range check (importance between 1 and 10),
  constraint daily_reward_claims_one_per_day unique (sporting_director_id, season_day_id)
);

create index daily_reward_claims_director_season_idx
  on public.daily_reward_claims (sporting_director_id, season_id, claimed_at desc);

create table public.daily_reward_inventory (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  team_season_id uuid not null references public.team_seasons(id) on delete cascade,
  source_claim_id uuid not null unique references public.daily_reward_claims(id) on delete cascade,
  reward_key text not null references public.daily_reward_catalog(reward_key) on delete restrict,
  status text not null default 'available',
  expires_after_game_year integer not null,
  acquired_at timestamptz not null default now(),
  used_at timestamptz,
  usage_payload jsonb not null default '{}'::jsonb,
  constraint daily_reward_inventory_status_allowed check (status in ('available', 'used', 'expired')),
  constraint daily_reward_inventory_usage_object check (jsonb_typeof(usage_payload) = 'object')
);

create index daily_reward_inventory_director_status_idx
  on public.daily_reward_inventory (sporting_director_id, status, acquired_at desc);

create table public.daily_reward_active_effects (
  id uuid primary key default gen_random_uuid(),
  source_inventory_id uuid not null unique references public.daily_reward_inventory(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  effect_kind text not null,
  effect_payload jsonb not null default '{}'::jsonb,
  starts_day_number smallint not null,
  ends_day_number smallint not null,
  consumed_day_number smallint,
  status text not null default 'active',
  activated_at timestamptz not null default now(),
  constraint daily_reward_active_effects_kind_allowed check (effect_kind in ('training_multiplier', 'scouting_boost')),
  constraint daily_reward_active_effects_day_range check (
    starts_day_number between 1 and 28
    and ends_day_number between starts_day_number and 28
    and (consumed_day_number is null or consumed_day_number between starts_day_number and ends_day_number)
  ),
  constraint daily_reward_active_effects_status_allowed check (status in ('active', 'consumed', 'expired')),
  constraint daily_reward_active_effects_payload_object check (jsonb_typeof(effect_payload) = 'object')
);

create table public.daily_reward_wildcard_reservations (
  id uuid primary key default gen_random_uuid(),
  source_inventory_id uuid not null unique references public.daily_reward_inventory(id) on delete cascade,
  team_season_id uuid not null references public.team_seasons(id) on delete cascade,
  race_edition_id uuid not null references public.race_editions(id) on delete cascade,
  status text not null default 'reserved',
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint daily_reward_wildcard_status_allowed check (status in ('reserved', 'consumed', 'cancelled')),
  constraint daily_reward_wildcard_one_team_race unique (team_season_id, race_edition_id)
);

alter table public.daily_reward_catalog enable row level security;
alter table public.daily_reward_claims enable row level security;
alter table public.daily_reward_inventory enable row level security;
alter table public.daily_reward_active_effects enable row level security;
alter table public.daily_reward_wildcard_reservations enable row level security;

create policy daily_reward_catalog_read_authenticated
on public.daily_reward_catalog for select to authenticated using (is_active);

create policy daily_reward_claims_read_own
on public.daily_reward_claims for select to authenticated
using (
  exists (
    select 1 from public.sporting_directors as director
    where director.id = daily_reward_claims.sporting_director_id
      and director.auth_user_id = auth.uid()
  )
);

create policy daily_reward_inventory_read_own
on public.daily_reward_inventory for select to authenticated
using (
  exists (
    select 1 from public.sporting_directors as director
    where director.id = daily_reward_inventory.sporting_director_id
      and director.auth_user_id = auth.uid()
  )
);

grant select on public.daily_reward_catalog, public.daily_reward_claims, public.daily_reward_inventory to authenticated;
grant all privileges on public.daily_reward_catalog, public.daily_reward_claims,
  public.daily_reward_inventory, public.daily_reward_active_effects,
  public.daily_reward_wildcard_reservations to service_role;

create or replace function public.get_daily_reward_importance(p_streak_day integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_streak_day >= 28 then 10
    when p_streak_day in (21, 27) then 6
    when p_streak_day = 25 then 5
    when p_streak_day in (14, 18, 22, 23, 24, 26) then 4
    when p_streak_day in (7, 11, 15, 16, 17, 19, 20) then 3
    when p_streak_day in (4, 8, 9, 10, 12, 13) then 2
    else 1
  end;
$$;

create or replace function public.get_current_daily_reward_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_last_claim record;
  v_claimed_today boolean;
  v_consecutive integer := 0;
  v_prospective integer := 1;
  v_importance integer := 1;
  v_offer_count integer := 1;
  v_offers jsonb := '[]'::jsonb;
  v_inventory jsonb := '[]'::jsonb;
  v_claimed_days jsonb := '[]'::jsonb;
  v_riders jsonb := '[]'::jsonb;
  v_races jsonb := '[]'::jsonb;
  v_abilities jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;

  perform public.sync_active_season_day();

  select
    director.id as director_id,
    assignment.team_id,
    team_season.id as team_season_id,
    season.id as season_id,
    season.name as season_name,
    season.game_year,
    coalesce(season.current_day_number, 1)::integer as current_day_number,
    season_day.id as season_day_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
   and team_season.status in ('planned', 'active')
  join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = coalesce(season.current_day_number, 1)
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then return null; end if;

  select claim.streak_day, day.day_number
  into v_last_claim
  from public.daily_reward_claims as claim
  join public.season_days as day on day.id = claim.season_day_id
  where claim.sporting_director_id = v_context.director_id
    and claim.season_id = v_context.season_id
  order by day.day_number desc, claim.claimed_at desc
  limit 1;

  v_claimed_today := exists (
    select 1 from public.daily_reward_claims as claim
    where claim.sporting_director_id = v_context.director_id
      and claim.season_day_id = v_context.season_day_id
  );

  if v_last_claim is not null then
    v_consecutive := case
      when v_last_claim.day_number = v_context.current_day_number then v_last_claim.streak_day
      when v_last_claim.day_number = v_context.current_day_number - 1 then v_last_claim.streak_day
      else 0
    end;
  end if;

  v_prospective := case
    when v_claimed_today then v_consecutive
    when v_last_claim.day_number = v_context.current_day_number - 1 then least(28, v_last_claim.streak_day + 1)
    else 1
  end;
  v_importance := public.get_daily_reward_importance(v_prospective);
  v_offer_count := case when v_importance >= 8 then 3 else 1 end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key', offer.reward_key,
    'name', offer.name,
    'description', offer.description,
    'effectSummary', offer.effect_summary,
    'importance', offer.importance,
    'effectKind', offer.effect_kind,
    'iconKey', offer.icon_key,
    'payload', offer.effect_payload
  ) order by offer.sort_key), '[]'::jsonb)
  into v_offers
  from (
    select catalog.*, md5(catalog.reward_key || v_context.director_id::text || v_context.season_day_id::text) as sort_key
    from public.daily_reward_catalog as catalog
    where catalog.is_active and catalog.importance = v_importance
    order by sort_key
    limit v_offer_count
  ) as offer;

  select coalesce(jsonb_agg(day.day_number order by day.day_number), '[]'::jsonb)
  into v_claimed_days
  from public.daily_reward_claims as claim
  join public.season_days as day on day.id = claim.season_day_id
  where claim.sporting_director_id = v_context.director_id
    and claim.season_id = v_context.season_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', inventory.id,
    'key', catalog.reward_key,
    'name', catalog.name,
    'description', catalog.description,
    'effectSummary', catalog.effect_summary,
    'importance', catalog.importance,
    'effectKind', catalog.effect_kind,
    'iconKey', catalog.icon_key,
    'payload', catalog.effect_payload,
    'acquiredAt', inventory.acquired_at,
    'expiresAfterGameYear', inventory.expires_after_game_year
  ) order by inventory.acquired_at desc), '[]'::jsonb)
  into v_inventory
  from public.daily_reward_inventory as inventory
  join public.daily_reward_catalog as catalog on catalog.reward_key = inventory.reward_key
  where inventory.sporting_director_id = v_context.director_id
    and inventory.status = 'available'
    and inventory.expires_after_game_year >= v_context.game_year;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', rider.id,
    'name', rider.first_name || ' ' || rider.last_name,
    'countryName', country.name
  ) order by rider.last_name, rider.first_name), '[]'::jsonb)
  into v_riders
  from public.rider_contracts as contract
  join public.riders as rider on rider.id = contract.rider_id and rider.status = 'active'
  join public.countries as country on country.id = rider.country_id
  join public.seasons as start_season on start_season.id = contract.start_season_id
  join public.seasons as end_season on end_season.id = contract.end_season_id
  where contract.team_id = v_context.team_id
    and contract.status = 'active'
    and start_season.game_year <= v_context.game_year
    and end_season.game_year >= v_context.game_year;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', race_option.id,
    'name', race_option.display_name,
    'firstDayNumber', race_option.first_day_number
  ) order by race_option.first_day_number, race_option.display_name), '[]'::jsonb)
  into v_races
  from (
    select edition.id, edition.display_name, min(day.day_number)::integer as first_day_number
    from public.race_editions as edition
    join public.race_categories as category on category.id = edition.race_category_id and category.code = 'elite'
    join public.races as race on race.id = edition.race_id and not race.is_grand_tour
    join public.stages as stage on stage.race_edition_id = edition.id
    join public.season_days as day on day.id = stage.season_day_id
    where edition.season_id = v_context.season_id
      and edition.status not in ('completed', 'cancelled')
    group by edition.id, edition.display_name
    having min(day.day_number) > v_context.current_day_number
  ) as race_option;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', ability.code,
    'name', ability.name,
    'effectSummary', ability.effect_description
  ) order by ability.name), '[]'::jsonb)
  into v_abilities
  from public.special_ability_catalog as ability
  where ability.is_active;

  return jsonb_build_object(
    'seasonId', v_context.season_id,
    'seasonName', v_context.season_name,
    'gameYear', v_context.game_year,
    'currentDayNumber', v_context.current_day_number,
    'claimedToday', v_claimed_today,
    'availableToday', not v_claimed_today,
    'consecutiveDays', v_consecutive,
    'prospectiveStreakDay', v_prospective,
    'importance', v_importance,
    'claimedSeasonDays', v_claimed_days,
    'offers', v_offers,
    'inventory', v_inventory,
    'riders', v_riders,
    'eligibleRaces', v_races,
    'abilities', v_abilities
  );
end;
$$;

create or replace function public.claim_current_daily_reward(p_reward_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_last_claim record;
  v_streak integer;
  v_importance integer;
  v_offer_count integer;
  v_claim_id uuid := gen_random_uuid();
  v_inventory_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Vous devez être connecté.'; end if;
  perform public.sync_active_season_day();

  select director.id as director_id, assignment.team_id, team_season.id as team_season_id,
    season.id as season_id, season.game_year, coalesce(season.current_day_number, 1)::integer as current_day_number,
    season_day.id as season_day_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment on assignment.sporting_director_id = director.id and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season on team_season.team_id = assignment.team_id and team_season.season_id = season.id and team_season.status in ('planned', 'active')
  join public.season_days as season_day on season_day.season_id = season.id and season_day.day_number = coalesce(season.current_day_number, 1)
  where director.auth_user_id = auth.uid() and director.status = 'active'
  limit 1;

  if v_context is null then raise exception 'Aucune équipe active ne correspond au Directeur Sportif.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('daily-reward:' || v_context.director_id::text, 0));

  if exists (select 1 from public.daily_reward_claims where sporting_director_id = v_context.director_id and season_day_id = v_context.season_day_id) then
    raise exception 'Le cadeau du jour a déjà été récupéré.';
  end if;

  select claim.streak_day, day.day_number into v_last_claim
  from public.daily_reward_claims as claim
  join public.season_days as day on day.id = claim.season_day_id
  where claim.sporting_director_id = v_context.director_id and claim.season_id = v_context.season_id
  order by day.day_number desc limit 1;

  v_streak := case when v_last_claim.day_number = v_context.current_day_number - 1 then least(28, v_last_claim.streak_day + 1) else 1 end;
  v_importance := public.get_daily_reward_importance(v_streak);
  v_offer_count := case when v_importance >= 8 then 3 else 1 end;

  if not exists (
    select 1 from (
      select catalog.reward_key
      from public.daily_reward_catalog as catalog
      where catalog.is_active and catalog.importance = v_importance
      order by md5(catalog.reward_key || v_context.director_id::text || v_context.season_day_id::text)
      limit v_offer_count
    ) as offer where offer.reward_key = p_reward_key
  ) then
    raise exception 'Ce cadeau ne fait pas partie des offres du jour.';
  end if;

  insert into public.daily_reward_claims (
    id, sporting_director_id, team_season_id, season_id, season_day_id,
    streak_day, importance, reward_key
  ) values (
    v_claim_id, v_context.director_id, v_context.team_season_id, v_context.season_id,
    v_context.season_day_id, v_streak, v_importance, p_reward_key
  );

  insert into public.daily_reward_inventory (
    id, sporting_director_id, team_season_id, source_claim_id,
    reward_key, expires_after_game_year
  ) values (
    v_inventory_id, v_context.director_id, v_context.team_season_id,
    v_claim_id, p_reward_key, v_context.game_year + 1
  );

  return jsonb_build_object('claimId', v_claim_id, 'inventoryId', v_inventory_id, 'streakDay', v_streak, 'importance', v_importance);
end;
$$;

create or replace function public.redeem_current_daily_reward(
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
  v_context record;
  v_reward record;
  v_rider record;
  v_amount integer;
  v_scope text;
  v_rarity text;
  v_equipment record;
  v_duration integer;
  v_target_country uuid;
  v_registration_id uuid;
  v_message text;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Vous devez être connecté.'; end if;
  perform public.sync_active_season_day();

  select director.id as director_id, assignment.team_id, team_season.id as team_season_id,
    team_season.registration_country_id, season.id as season_id, season.game_year,
    coalesce(season.current_day_number, 1)::integer as current_day_number, season_day.id as season_day_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment on assignment.sporting_director_id = director.id and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season on team_season.team_id = assignment.team_id and team_season.season_id = season.id and team_season.status in ('planned', 'active')
  join public.season_days as season_day on season_day.season_id = season.id and season_day.day_number = coalesce(season.current_day_number, 1)
  where director.auth_user_id = auth.uid() and director.status = 'active'
  limit 1;

  if v_context is null then raise exception 'Aucune équipe active ne correspond au Directeur Sportif.'; end if;

  select inventory.*, catalog.name, catalog.effect_kind, catalog.effect_payload
  into v_reward
  from public.daily_reward_inventory as inventory
  join public.daily_reward_catalog as catalog on catalog.reward_key = inventory.reward_key and catalog.is_active
  where inventory.id = p_inventory_id and inventory.sporting_director_id = v_context.director_id
  for update of inventory;

  if v_reward is null or v_reward.status <> 'available' then raise exception 'Ce cadeau n’est plus disponible.'; end if;
  if v_reward.expires_after_game_year < v_context.game_year then
    update public.daily_reward_inventory set status = 'expired' where id = p_inventory_id;
    raise exception 'Ce cadeau a expiré à la fin de la saison précédente.';
  end if;

  if v_reward.effect_kind in ('form_boost', 'rider_experience', 'rating_boost', 'special_ability', 'naturalization') then
    select rider.id, rider.country_id into v_rider
    from public.riders as rider
    join public.rider_contracts as contract on contract.rider_id = rider.id and contract.team_id = v_context.team_id and contract.status = 'active'
    where rider.id = p_rider_id and rider.status = 'active';
    if v_rider is null then raise exception 'Sélectionnez un coureur professionnel de votre équipe.'; end if;
  end if;

  if v_reward.effect_kind = 'form_boost' then
    v_amount := greatest(1, least(20, (v_reward.effect_payload ->> 'amount')::integer));
    insert into public.rider_condition_states (rider_id, season_day_id, form, fatigue, source)
    values (
      p_rider_id, v_context.season_day_id,
      least(100, coalesce((select state.form from public.rider_condition_states as state join public.season_days as day on day.id = state.season_day_id where state.rider_id = p_rider_id and day.season_id = v_context.season_id order by day.day_number desc, state.updated_at desc limit 1), 75) + v_amount),
      0, 'daily_reward'
    )
    on conflict (rider_id, season_day_id) do update set form = least(100, public.rider_condition_states.form + v_amount), source = 'daily_reward', updated_at = now();
    v_message := format('%s : +%s en forme appliqué.', v_reward.name, v_amount);
  elsif v_reward.effect_kind = 'rider_experience' then
    v_amount := greatest(1, least(5, (v_reward.effect_payload ->> 'amount')::integer));
    update public.riders set career_race_days = career_race_days + v_amount where id = p_rider_id;
    v_message := format('%s : +%s jour d’expérience appliqué.', v_reward.name, v_amount);
  elsif v_reward.effect_kind = 'rating_boost' then
    v_amount := greatest(1, least(2, (v_reward.effect_payload ->> 'amount')::integer));
    v_scope := v_reward.effect_payload ->> 'statScope';
    if p_rating_key not in ('mountain','hills','flat','time_trial','cobbles','sprint','acceleration','downhill','endurance','resistance','recovery','breakaway','prologue') then
      raise exception 'Sélectionnez une statistique valide.';
    end if;
    if v_scope = 'primary' and p_rating_key not in ('mountain','hills','flat','time_trial','cobbles','sprint') then raise exception 'Ce cadeau ne peut renforcer qu’une statistique primaire.'; end if;
    if v_scope = 'secondary' and p_rating_key not in ('acceleration','downhill','endurance','resistance','recovery','breakaway','prologue') then raise exception 'Ce cadeau ne peut renforcer qu’une statistique secondaire.'; end if;
    execute format(
      'update public.rider_season_ratings as rating set %1$I = least(100, rating.%1$I + $1), updated_at = now() where rating.rider_id = $2 and exists (select 1 from public.seasons as season where season.id = rating.season_id and season.status in (''active'',''planned''))',
      p_rating_key
    ) using v_amount, p_rider_id;
    v_message := format('%s : +%s en %s appliqué définitivement.', v_reward.name, v_amount, upper(p_rating_key));
  elsif v_reward.effect_kind = 'training_multiplier' then
    insert into public.daily_reward_active_effects (
      source_inventory_id, team_id, season_id, effect_kind, effect_payload,
      starts_day_number, ends_day_number
    ) values (
      p_inventory_id, v_context.team_id, v_context.season_id, 'training_multiplier',
      v_reward.effect_payload, v_context.current_day_number, 28
    );
    v_message := v_reward.name || ' activé pour la prochaine séance professionnelle de 8 h.';
  elsif v_reward.effect_kind = 'scouting_boost' then
    v_duration := greatest(1, least(14, (v_reward.effect_payload ->> 'durationDays')::integer));
    insert into public.daily_reward_active_effects (
      source_inventory_id, team_id, season_id, effect_kind, effect_payload,
      starts_day_number, ends_day_number
    ) values (
      p_inventory_id, v_context.team_id, v_context.season_id, 'scouting_boost',
      v_reward.effect_payload, v_context.current_day_number,
      least(28, v_context.current_day_number + v_duration - 1)
    );
    v_message := v_reward.name || ' activé pour les prochains rapports de scouting.';
  elsif v_reward.effect_kind = 'equipment' then
    v_rarity := coalesce(v_reward.effect_payload ->> 'rarity', 'common');
    select item.id, item.name into v_equipment
    from public.equipment_catalog_items as item
    where item.status = 'active' and item.rarity = v_rarity
    order by md5(item.id::text || p_inventory_id::text)
    limit 1;
    if v_equipment is null then raise exception 'Aucun équipement compatible n’est disponible dans le catalogue.'; end if;
    insert into public.team_equipment_inventory (team_season_id, equipment_item_id, quantity, last_purchase_price)
    values (v_context.team_season_id, v_equipment.id, 1, 0)
    on conflict (team_season_id, equipment_item_id) do update set quantity = public.team_equipment_inventory.quantity + 1, updated_at = now();
    v_message := v_equipment.name || ' a rejoint l’inventaire de l’équipe.';
  elsif v_reward.effect_kind = 'special_ability' then
    if not exists (select 1 from public.special_ability_catalog where code = p_ability_code and is_active) then raise exception 'Sélectionnez une capacité spéciale valide.'; end if;
    insert into public.rider_special_abilities (rider_id, ability_code, source_type, source_reference)
    values (p_rider_id, p_ability_code, 'daily_reward', p_inventory_id::text)
    on conflict (rider_id, ability_code) do nothing;
    if not found then raise exception 'Ce coureur possède déjà cette capacité spéciale.'; end if;
    v_message := v_reward.name || ' : la capacité spéciale a été attribuée.';
  elsif v_reward.effect_kind = 'naturalization' then
    v_target_country := v_context.registration_country_id;
    if v_rider.country_id = v_target_country then raise exception 'Ce coureur possède déjà la nationalité de l’équipe.'; end if;
    if exists (select 1 from public.rider_national_championship_titles where rider_id = p_rider_id and championship_type in ('road','time_trial')) then raise exception 'Un ancien champion national ne peut pas changer de nationalité sportive.'; end if;
    update public.riders set country_id = v_target_country where id = p_rider_id;
    insert into public.rider_naturalizations (
      subject_type, rider_id, academy_rider_id, team_id, sporting_director_id,
      season_id, day_number, from_country_id, to_country_id, elapsed_tenure_days
    ) values (
      'professional', p_rider_id, null, v_context.team_id, v_context.director_id,
      v_context.season_id, v_context.current_day_number, v_rider.country_id, v_target_country, 0
    );
    v_message := v_reward.name || ' : la naturalisation est effective immédiatement.';
  elsif v_reward.effect_kind = 'wildcard' then
    if not exists (
      select 1 from public.race_editions as edition
      join public.race_categories as category on category.id = edition.race_category_id and category.code = 'elite'
      join public.races as race on race.id = edition.race_id and not race.is_grand_tour
      join public.stages as stage on stage.race_edition_id = edition.id
      join public.season_days as day on day.id = stage.season_day_id
      where edition.id = p_race_edition_id and edition.season_id = v_context.season_id
        and edition.status not in ('completed','cancelled') and day.day_number > v_context.current_day_number
    ) then raise exception 'Cette course ne peut pas recevoir le Ticket d’or.'; end if;
    insert into public.daily_reward_wildcard_reservations (source_inventory_id, team_season_id, race_edition_id)
    values (p_inventory_id, v_context.team_season_id, p_race_edition_id);
    v_message := v_reward.name || ' réservé : votre inscription sera automatiquement invitée sur cette course.';
  else
    raise exception 'L’effet de ce cadeau n’est pas pris en charge.';
  end if;

  update public.daily_reward_inventory
  set status = 'used', used_at = now(), usage_payload = jsonb_strip_nulls(jsonb_build_object(
    'riderId', p_rider_id, 'ratingKey', p_rating_key,
    'abilityCode', p_ability_code, 'raceEditionId', p_race_edition_id
  ))
  where id = p_inventory_id;

  return jsonb_build_object('inventoryId', p_inventory_id, 'message', v_message);
exception
  when invalid_text_representation then raise exception 'Les données de ce cadeau sont invalides.';
end;
$$;

create or replace function public.get_daily_reward_training_multiplier(
  p_team_id uuid,
  p_season_day_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day record;
  v_effect record;
  v_multiplier numeric := 1;
begin
  select day.season_id, day.day_number into v_day
  from public.season_days as day where day.id = p_season_day_id;

  select effect.id, effect.effect_payload into v_effect
  from public.daily_reward_active_effects as effect
  where effect.team_id = p_team_id
    and effect.season_id = v_day.season_id
    and effect.effect_kind = 'training_multiplier'
    and effect.status = 'active'
    and v_day.day_number between effect.starts_day_number and effect.ends_day_number
    and (effect.consumed_day_number is null or effect.consumed_day_number = v_day.day_number)
  order by ((effect.effect_payload ->> 'multiplier')::numeric) desc, effect.activated_at
  limit 1
  for update;

  if v_effect is null then return 1; end if;
  v_multiplier := greatest(1, least(3, (v_effect.effect_payload ->> 'multiplier')::numeric));
  update public.daily_reward_active_effects
  set consumed_day_number = v_day.day_number, status = 'consumed'
  where id = v_effect.id and consumed_day_number is null;

  -- Le statut consommé reste valable pour tous les coureurs traités sur le même jour.
  if not found then
    update public.daily_reward_active_effects set consumed_day_number = v_day.day_number where id = v_effect.id;
  end if;
  return v_multiplier;
end;
$$;

-- Une séance est traitée coureur par coureur. Le bonus est donc également
-- retrouvé lorsqu'il est déjà marqué consommé pour cette même journée.
create or replace function public.get_daily_reward_training_multiplier_for_session(
  p_team_id uuid,
  p_season_day_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day record;
  v_effect record;
begin
  select day.season_id, day.day_number into v_day from public.season_days as day where day.id = p_season_day_id;
  select effect.id, effect.effect_payload, effect.consumed_day_number into v_effect
  from public.daily_reward_active_effects as effect
  where effect.team_id = p_team_id and effect.season_id = v_day.season_id
    and effect.effect_kind = 'training_multiplier'
    and (
      (effect.status = 'active' and effect.consumed_day_number is null and v_day.day_number between effect.starts_day_number and effect.ends_day_number)
      or (effect.status = 'consumed' and effect.consumed_day_number = v_day.day_number)
    )
  order by ((effect.effect_payload ->> 'multiplier')::numeric) desc, effect.activated_at
  limit 1 for update;
  if v_effect is null then return 1; end if;
  if v_effect.consumed_day_number is null then update public.daily_reward_active_effects set consumed_day_number = v_day.day_number, status = 'consumed' where id = v_effect.id; end if;
  return greatest(1, least(3, (v_effect.effect_payload ->> 'multiplier')::numeric));
end;
$$;

do $$
declare
  v_definition text;
  v_needle text := '(10000.0 / 28.0)';
begin
  select pg_get_functiondef('public.settle_due_training_sessions()'::regprocedure) into v_definition;
  if position('get_daily_reward_training_multiplier_for_session' in v_definition) = 0 then
    if position(v_needle in v_definition) = 0 then
      raise exception 'Point d’intégration de la progression d’entraînement introuvable.';
    end if;
    v_definition := replace(
      v_definition,
      v_needle,
      v_needle || ' * public.get_daily_reward_training_multiplier_for_session(v_rider.team_id, v_day.id)'
    );
    execute v_definition;
  end if;
end;
$$;

create or replace function public.apply_daily_reward_wildcard_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation_id uuid;
begin
  if new.status <> 'accepted' then return new; end if;
  select reservation.id into v_reservation_id
  from public.daily_reward_wildcard_reservations as reservation
  where reservation.team_season_id = new.team_season_id
    and reservation.race_edition_id = new.race_edition_id
    and reservation.status = 'reserved'
  for update;
  if v_reservation_id is null then return new; end if;
  new.entry_method := 'invited';
  update public.daily_reward_wildcard_reservations
  set status = 'consumed', consumed_at = now()
  where id = v_reservation_id;
  return new;
end;
$$;

drop trigger if exists apply_daily_reward_wildcard_registration_trigger on public.race_registrations;
create trigger apply_daily_reward_wildcard_registration_trigger
before insert or update of status, entry_method
on public.race_registrations
for each row execute function public.apply_daily_reward_wildcard_registration();

revoke all on function public.get_current_daily_reward_overview() from public, anon;
revoke all on function public.claim_current_daily_reward(text) from public, anon;
revoke all on function public.redeem_current_daily_reward(uuid, uuid, text, text, uuid) from public, anon;
revoke all on function public.get_daily_reward_training_multiplier_for_session(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_current_daily_reward_overview() to authenticated;
grant execute on function public.claim_current_daily_reward(text) to authenticated;
grant execute on function public.redeem_current_daily_reward(uuid, uuid, text, text, uuid) to authenticated;
grant execute on function public.get_daily_reward_training_multiplier_for_session(uuid, uuid) to service_role;

comment on table public.daily_reward_claims is 'Une ouverture manuelle maximum par Directeur Sportif et par journée de saison.';
comment on table public.daily_reward_inventory is 'Cadeaux quotidiens conservés jusqu’à leur utilisation ou la fin de la saison suivante.';
comment on function public.get_current_daily_reward_overview() is 'État complet de la série quotidienne, offres déterministes et réserve du Directeur Sportif connecté.';

notify pgrst, 'reload schema';

commit;
