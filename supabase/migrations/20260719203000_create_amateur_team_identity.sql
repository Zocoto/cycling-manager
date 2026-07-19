begin;

-- ============================================================
-- EPIC 8 — IDENTITE AMATEUR PERMANENTE
-- ============================================================

alter table public.teams
add column amateur_name text,
add column amateur_jersey_pattern text not null default 'classic',
add column amateur_jersey_primary_color text not null default '#176951',
add column amateur_jersey_secondary_color text not null default '#FFFDF4',
add column amateur_jersey_accent_color text not null default '#F2C94C',
add column amateur_identity_configured_at timestamptz;

alter table public.teams
add constraint teams_amateur_name_valid
check (
  amateur_name is null
  or char_length(amateur_name) between 3 and 40
),
add constraint teams_amateur_jersey_pattern_allowed
check (
  amateur_jersey_pattern in ('classic', 'diagonal', 'hoops', 'split')
),
add constraint teams_amateur_jersey_primary_color_valid
check (amateur_jersey_primary_color ~ '^#[0-9A-F]{6}$'),
add constraint teams_amateur_jersey_secondary_color_valid
check (amateur_jersey_secondary_color ~ '^#[0-9A-F]{6}$'),
add constraint teams_amateur_jersey_accent_color_valid
check (amateur_jersey_accent_color ~ '^#[0-9A-F]{6}$'),
add constraint teams_amateur_identity_complete
check (
  (amateur_name is null and amateur_identity_configured_at is null)
  or (amateur_name is not null and amateur_identity_configured_at is not null)
);

comment on column public.teams.amateur_name is
  'Nom fondateur permanent de l equipe, masque temporairement par le sponsor principal.';
comment on column public.teams.amateur_identity_configured_at is
  'Date de validation unique de l identite amateur par le Directeur Sportif.';

-- Les anciennes carrieres gardent leur pays et leur effectif. Leur nom
-- fondateur reste volontairement vide afin de leur offrir une
-- personnalisation unique depuis le nouvel onboarding.

-- ============================================================
-- PROFIL DE GENERATION POUR LE PAYS DE L EQUIPE
-- ============================================================

create or replace function public.get_rider_generation_profile_for_country(
  p_country_id uuid
)
returns table (
  name_profile_code text,
  avatar_profile_key text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    profile.name_profile_code,
    profile.avatar_profile_key
  from public.country_rider_generation_profiles as profile
  join public.countries as country
    on country.id = profile.country_id
  where profile.country_id = p_country_id
    and country.is_active = true;
$$;

revoke all
on function public.get_rider_generation_profile_for_country(uuid)
from public, anon;

grant execute
on function public.get_rider_generation_profile_for_country(uuid)
to authenticated;

comment on function public.get_rider_generation_profile_for_country(uuid) is
  'Expose le profil de generation des coureurs correspondant au pays choisi pour l equipe.';

-- L ancienne fonction creait une equipe generique des la validation du
-- profil DS. Elle reste presente pour l historique des migrations mais
-- n est plus accessible aux joueurs.
revoke all
on function public.initialize_sporting_director_career(jsonb)
from authenticated;

-- ============================================================
-- FONDATION OU REGULARISATION DE L EQUIPE AMATEUR
-- ============================================================

create or replace function public.initialize_sporting_director_career(
  p_rider_identities jsonb,
  p_team_name text,
  p_team_country_id uuid,
  p_jersey_pattern text,
  p_jersey_primary_color text,
  p_jersey_secondary_color text,
  p_jersey_accent_color text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_director public.sporting_directors%rowtype;
  v_season public.seasons%rowtype;
  v_existing_generation public.initial_career_generations%rowtype;
  v_has_existing_generation boolean := false;
  v_existing_team public.teams%rowtype;

  v_team_name text := regexp_replace(
    btrim(coalesce(p_team_name, '')),
    '[[:space:]]+',
    ' ',
    'g'
  );
  v_pattern text := lower(btrim(coalesce(p_jersey_pattern, '')));
  v_primary text := upper(btrim(coalesce(p_jersey_primary_color, '')));
  v_secondary text := upper(btrim(coalesce(p_jersey_secondary_color, '')));
  v_accent text := upper(btrim(coalesce(p_jersey_accent_color, '')));

  v_name_profile_code text;
  v_avatar_profile_key text;
  v_team_id uuid;
  v_rider_id uuid;
  v_age_offset integer;
  v_rider_count integer := 0;
  v_identity record;
  v_rating record;
begin
  if v_auth_user_id is null then
    raise exception 'Vous devez être authentifié pour fonder votre équipe.';
  end if;

  select director.*
  into v_director
  from public.sporting_directors as director
  where director.auth_user_id = v_auth_user_id
    and director.status = 'active'
  for update;

  if not found then
    raise exception 'Le profil du Directeur Sportif est introuvable ou inactif.';
  end if;

  if v_director.country_id is null
    or nullif(btrim(v_director.avatar_key), '') is null
  then
    raise exception 'Validez d abord la nationalité et l avatar du Directeur Sportif.';
  end if;

  if char_length(v_team_name) not between 3 and 40
    or v_team_name ~ '[[:cntrl:]<>]'
  then
    raise exception 'Le nom de l équipe doit contenir entre 3 et 40 caractères valides.';
  end if;

  if p_team_country_id is null then
    raise exception 'Le pays d affiliation de l équipe est obligatoire.';
  end if;

  perform 1
  from public.countries as country
  where country.id = p_team_country_id
    and country.is_active = true;

  if not found then
    raise exception 'Le pays d affiliation sélectionné est invalide.';
  end if;

  if v_pattern not in ('classic', 'diagonal', 'hoops', 'split') then
    raise exception 'Le motif du maillot amateur est invalide.';
  end if;

  if v_primary !~ '^#[0-9A-F]{6}$'
    or v_secondary !~ '^#[0-9A-F]{6}$'
    or v_accent !~ '^#[0-9A-F]{6}$'
  then
    raise exception 'Une ou plusieurs couleurs du maillot sont invalides.';
  end if;

  if v_primary = v_secondary and v_secondary = v_accent then
    raise exception 'Le maillot doit utiliser au moins deux couleurs différentes.';
  end if;

  select
    profile.name_profile_code,
    profile.avatar_profile_key
  into
    v_name_profile_code,
    v_avatar_profile_key
  from public.country_rider_generation_profiles as profile
  where profile.country_id = p_team_country_id;

  if not found then
    raise exception 'Aucun profil de génération de coureurs n est configuré pour ce pays.';
  end if;

  select season.*
  into v_season
  from public.seasons as season
  where season.status = 'active'
  order by season.starts_on desc
  limit 1;

  if not found then
    raise exception 'Aucune saison active ne permet actuellement de lancer une carrière.';
  end if;

  select generation.*
  into v_existing_generation
  from public.initial_career_generations as generation
  where generation.sporting_director_id = v_director.id;

  v_has_existing_generation := found;

  if exists (
    select 1
    from public.teams as other_team
    where other_team.id <> coalesce(v_existing_generation.team_id, gen_random_uuid())
      and other_team.amateur_name is not null
      and lower(other_team.amateur_name) = lower(v_team_name)
  ) then
    raise exception 'Ce nom d équipe amateur est déjà utilisé.';
  end if;

  if v_has_existing_generation then
    select team.*
    into v_existing_team
    from public.teams as team
    where team.id = v_existing_generation.team_id
    for update;

    if not found then
      raise exception 'L équipe existante de cette carrière est introuvable.';
    end if;

    if v_existing_team.amateur_identity_configured_at is not null then
      return jsonb_build_object(
        'status', 'already_created',
        'team_id', v_existing_team.id,
        'season_id', v_existing_generation.season_id,
        'rider_count', v_existing_generation.rider_count,
        'generation_version', v_existing_generation.generation_version
      );
    end if;

    if v_existing_team.home_country_id <> p_team_country_id then
      raise exception 'Le pays historique de cette équipe est définitif et ne peut plus être modifié.';
    end if;

    update public.teams
    set
      amateur_name = v_team_name,
      amateur_jersey_pattern = v_pattern,
      amateur_jersey_primary_color = v_primary,
      amateur_jersey_secondary_color = v_secondary,
      amateur_jersey_accent_color = v_accent,
      amateur_identity_configured_at = now()
    where id = v_existing_team.id;

    update public.team_sponsor_contracts
    set
      previous_team_display_name = v_team_name,
      previous_team_short_name = left(v_team_name, 30)
    where team_id = v_existing_team.id
      and role = 'principal'
      and status = 'active';

    if not exists (
      select 1
      from public.team_sponsor_contracts as contract
      where contract.team_id = v_existing_team.id
        and contract.role = 'principal'
        and contract.status = 'active'
    ) then
      update public.team_seasons
      set
        display_name = v_team_name,
        short_name = left(v_team_name, 30)
      where team_id = v_existing_team.id
        and season_id = v_season.id;
    end if;

    update public.sporting_directors
    set onboarding_completed = true
    where id = v_director.id;

    return jsonb_build_object(
      'status', 'configured_existing',
      'team_id', v_existing_team.id,
      'season_id', v_existing_generation.season_id,
      'rider_count', v_existing_generation.rider_count,
      'generation_version', v_existing_generation.generation_version
    );
  end if;

  if exists (
    select 1
    from public.team_manager_assignments as assignment
    where assignment.sporting_director_id = v_director.id
      and assignment.role = 'general_manager'
      and assignment.status = 'active'
  ) then
    raise exception 'Une équipe active est déjà rattachée à ce Directeur Sportif.';
  end if;

  if p_rider_identities is null
    or jsonb_typeof(p_rider_identities) <> 'array'
    or jsonb_array_length(p_rider_identities) <> 7
  then
    raise exception 'La carrière initiale doit contenir exactement sept coureurs.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rider_identities) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or coalesce(btrim(item.value ->> 'first_name'), '') = ''
      or coalesce(btrim(item.value ->> 'last_name'), '') = ''
      or char_length(btrim(item.value ->> 'first_name')) > 80
      or char_length(btrim(item.value ->> 'last_name')) > 80
      or coalesce(item.value ->> 'avatar_seed', '') !~ '^[0-9]{1,18}$'
  ) then
    raise exception 'Une ou plusieurs identités de coureurs sont invalides.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rider_identities) as item(value)
    group by
      lower(btrim(item.value ->> 'first_name')),
      lower(btrim(item.value ->> 'last_name'))
    having count(*) > 1
  ) then
    raise exception 'Deux coureurs initiaux ne peuvent pas partager exactement la même identité.';
  end if;

  insert into public.teams (
    home_country_id,
    founded_season_id,
    internal_name,
    amateur_name,
    amateur_jersey_pattern,
    amateur_jersey_primary_color,
    amateur_jersey_secondary_color,
    amateur_jersey_accent_color,
    amateur_identity_configured_at,
    status
  ) values (
    p_team_country_id,
    v_season.id,
    'initial_team_' || replace(v_director.id::text, '-', ''),
    v_team_name,
    v_pattern,
    v_primary,
    v_secondary,
    v_accent,
    now(),
    'active'
  ) returning id into v_team_id;

  insert into public.team_manager_assignments (
    sporting_director_id,
    team_id,
    start_season_id,
    end_season_id,
    role,
    status
  ) values (
    v_director.id,
    v_team_id,
    v_season.id,
    null,
    'general_manager',
    'active'
  );

  insert into public.team_seasons (
    team_id,
    season_id,
    division_id,
    registration_country_id,
    display_name,
    short_name,
    points,
    operating_budget,
    spent_budget,
    currency,
    status
  ) values (
    v_team_id,
    v_season.id,
    null,
    p_team_country_id,
    v_team_name,
    left(v_team_name, 30),
    0,
    0,
    0,
    'EUR',
    'active'
  );

  v_age_offset := (((hashtextextended(v_director.id::text, 0) % 7) + 7) % 7)::integer;

  for v_identity in
    select
      item.value as identity_data,
      item.ordinality::integer as rider_slot
    from jsonb_array_elements(p_rider_identities)
      with ordinality as item(value, ordinality)
    order by item.ordinality
  loop
    select profile.*
    into v_rating
    from (
      values
        (1, 64,58,45,47,40,42,50,55,57,54,58,56,44),
        (2, 56,64,49,46,43,54,62,54,56,55,55,60,48),
        (3, 43,48,62,64,49,50,52,49,60,58,55,48,62),
        (4, 40,46,58,48,44,65,64,47,54,52,50,42,56),
        (5, 42,50,60,51,65,56,58,50,59,61,53,54,52),
        (6, 52,57,55,52,50,50,54,56,61,59,56,65,50),
        (7, 50,52,56,53,52,51,52,54,63,62,61,55,51)
    ) as profile (
      rider_slot,
      mountain,
      hills,
      flat,
      time_trial,
      cobbles,
      sprint,
      acceleration,
      downhill,
      endurance,
      resistance,
      recovery,
      breakaway,
      prologue
    )
    where profile.rider_slot = v_identity.rider_slot;

    insert into public.riders (
      country_id,
      first_name,
      last_name,
      status,
      generated_name_profile_code,
      avatar_profile_key,
      avatar_seed
    ) values (
      p_team_country_id,
      btrim(v_identity.identity_data ->> 'first_name'),
      btrim(v_identity.identity_data ->> 'last_name'),
      'active',
      v_name_profile_code,
      v_avatar_profile_key,
      (v_identity.identity_data ->> 'avatar_seed')::bigint
    ) returning id into v_rider_id;

    insert into public.rider_contracts (
      rider_id,
      team_id,
      start_season_id,
      end_season_id,
      salary_per_season,
      currency,
      status,
      signed_at
    ) values (
      v_rider_id,
      v_team_id,
      v_season.id,
      v_season.id,
      0,
      'EUR',
      'active',
      now()
    );

    insert into public.rider_season_ratings (
      rider_id,
      season_id,
      age,
      mountain,
      hills,
      flat,
      time_trial,
      cobbles,
      sprint,
      acceleration,
      downhill,
      endurance,
      resistance,
      recovery,
      breakaway,
      prologue
    ) values (
      v_rider_id,
      v_season.id,
      18 + ((v_identity.rider_slot - 1 + v_age_offset) % 7),
      v_rating.mountain,
      v_rating.hills,
      v_rating.flat,
      v_rating.time_trial,
      v_rating.cobbles,
      v_rating.sprint,
      v_rating.acceleration,
      v_rating.downhill,
      v_rating.endurance,
      v_rating.resistance,
      v_rating.recovery,
      v_rating.breakaway,
      v_rating.prologue
    );

    v_rider_count := v_rider_count + 1;
  end loop;

  if v_rider_count <> 7 then
    raise exception 'La génération de l effectif initial est incomplète.';
  end if;

  insert into public.initial_career_generations (
    sporting_director_id,
    team_id,
    season_id,
    rider_count,
    generation_version
  ) values (
    v_director.id,
    v_team_id,
    v_season.id,
    v_rider_count,
    2
  );

  update public.sporting_directors
  set onboarding_completed = true
  where id = v_director.id;

  return jsonb_build_object(
    'status', 'created',
    'team_id', v_team_id,
    'season_id', v_season.id,
    'rider_count', v_rider_count,
    'name_profile_code', v_name_profile_code,
    'avatar_profile_key', v_avatar_profile_key,
    'generation_version', 2
  );
end;
$$;

revoke all
on function public.initialize_sporting_director_career(
  jsonb, text, uuid, text, text, text, text
)
from public, anon;

grant execute
on function public.initialize_sporting_director_career(
  jsonb, text, uuid, text, text, text, text
)
to authenticated;

comment on function public.initialize_sporting_director_career(
  jsonb, text, uuid, text, text, text, text
) is
  'Fonde atomiquement l equipe amateur et genere sept coureurs selon le pays de l equipe, ou configure une unique fois une ancienne carriere.';

-- ============================================================
-- PROTECTION DU SEUIL GLOBAL DE SPONSORING
--
-- Le seuil de 30 correspond a GAMEPLAY_RULES dans l application.
-- Le controle PostgreSQL constitue la barriere de securite contre
-- un appel direct a la RPC de signature.
-- ============================================================

create or replace function private.enforce_global_sponsoring_unlock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reputation integer;
  v_unlock_threshold constant integer := 30;
begin
  if new.role <> 'principal'
    or new.sponsor_offer_id is null
  then
    return new;
  end if;

  select director.reputation_points
  into v_reputation
  from public.sponsor_offers as offer
  join public.sporting_directors as director
    on director.id = offer.sporting_director_id
  where offer.id = new.sponsor_offer_id;

  if v_reputation is null then
    raise exception 'Le Directeur Sportif associé à cette offre est introuvable.';
  end if;

  if v_reputation < v_unlock_threshold then
    raise exception
      'Le marché du sponsoring se débloque à % points de réputation.',
      v_unlock_threshold;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_global_sponsoring_unlock
on public.team_sponsor_contracts;

create trigger enforce_global_sponsoring_unlock
before insert on public.team_sponsor_contracts
for each row
execute function private.enforce_global_sponsoring_unlock();

revoke all
on function private.enforce_global_sponsoring_unlock()
from public, anon, authenticated;

commit;
