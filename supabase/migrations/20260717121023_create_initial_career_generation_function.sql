begin;

-- ============================================================
-- GÉNÉRATION TRANSACTIONNELLE DE LA CARRIÈRE INITIALE
--
-- Cette fonction crée en une seule transaction :
--   - l'équipe amateur ;
--   - l'affectation du Directeur Sportif ;
--   - l'inscription de l'équipe dans la saison active ;
--   - les sept coureurs initiaux ;
--   - leurs contrats d'une saison ;
--   - leurs évaluations sportives équilibrées ;
--   - le registre empêchant une seconde génération.
--
-- Les identités sont préparées côté serveur à partir des
-- bibliothèques JSON. Les statistiques sont imposées ici afin
-- qu'un client ne puisse pas créer un effectif plus puissant.
-- ============================================================

create or replace function public.initialize_sporting_director_career(
  p_rider_identities jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_auth_user_id uuid := auth.uid();

  current_director public.sporting_directors%rowtype;
  current_season public.seasons%rowtype;
  existing_generation public.initial_career_generations%rowtype;

  selected_name_profile_code text;
  selected_avatar_profile_key text;

  created_team_id uuid;
  created_rider_id uuid;

  director_public_name text;
  generated_team_display_name text;
  generated_team_internal_name text;

  age_offset integer;
  created_rider_count integer := 0;

  identity_record record;
  rating_profile record;
begin
  -- ==========================================================
  -- CONTRÔLE DE L'AUTHENTIFICATION
  -- ==========================================================

  if current_auth_user_id is null then
    raise exception
      'Vous devez être authentifié pour lancer votre carrière.';
  end if;


  -- ==========================================================
  -- RÉCUPÉRATION ET VERROUILLAGE DU DIRECTEUR SPORTIF
  --
  -- Le verrou empêche deux demandes simultanées de générer
  -- deux équipes pour le même compte.
  -- ==========================================================

  select sporting_director.*
  into current_director
  from public.sporting_directors as sporting_director
  where sporting_director.auth_user_id = current_auth_user_id
  for update;

  if not found then
    raise exception
      'Aucun profil de Directeur Sportif ne correspond au compte authentifié.';
  end if;


  -- ==========================================================
  -- IDEMPOTENCE
  --
  -- Si la carrière a déjà été générée, la fonction retourne
  -- simplement l'équipe existante.
  -- ==========================================================

  select generation.*
  into existing_generation
  from public.initial_career_generations as generation
  where generation.sporting_director_id = current_director.id;

  if found then
    return jsonb_build_object(
      'status',
      'already_created',
      'team_id',
      existing_generation.team_id,
      'season_id',
      existing_generation.season_id,
      'rider_count',
      existing_generation.rider_count,
      'generation_version',
      existing_generation.generation_version
    );
  end if;


  -- ==========================================================
  -- CONTRÔLE DU PROFIL DU DIRECTEUR SPORTIF
  -- ==========================================================

  if current_director.country_id is null then
    raise exception
      'La nationalité du Directeur Sportif doit être renseignée avant de lancer la carrière.';
  end if;

  if (
    current_director.avatar_key is null
    or btrim(current_director.avatar_key) = ''
  ) then
    raise exception
      'Un avatar de Directeur Sportif doit être sélectionné avant de lancer la carrière.';
  end if;


  -- ==========================================================
  -- PROTECTION CONTRE UNE ÉQUIPE EXISTANTE NON ENREGISTRÉE
  -- ==========================================================

  if exists (
    select 1
    from public.team_manager_assignments as assignment
    where assignment.sporting_director_id = current_director.id
      and assignment.role = 'general_manager'
      and assignment.status = 'active'
  ) then
    raise exception
      'Une équipe active est déjà rattachée à ce Directeur Sportif.';
  end if;


  -- ==========================================================
  -- RÉCUPÉRATION DE LA SAISON ACTIVE
  -- ==========================================================

  select season.*
  into current_season
  from public.seasons as season
  where season.status = 'active'
  order by season.starts_on desc
  limit 1;

  if not found then
    raise exception
      'Aucune saison active ne permet actuellement de lancer une carrière.';
  end if;


  -- ==========================================================
  -- PROFILS DE GÉNÉRATION LIÉS À LA NATIONALITÉ
  -- ==========================================================

  select
    generation_profile.name_profile_code,
    generation_profile.avatar_profile_key
  into
    selected_name_profile_code,
    selected_avatar_profile_key
  from public.country_rider_generation_profiles
    as generation_profile
  where generation_profile.country_id = current_director.country_id;

  if not found then
    raise exception
      'Aucun profil de génération de coureurs n’est configuré pour cette nationalité.';
  end if;


  -- ==========================================================
  -- VALIDATION DES SEPT IDENTITÉS
  --
  -- Format attendu :
  --
  -- [
  --   {
  --     "first_name": "Arthur",
  --     "last_name": "Martin",
  --     "avatar_seed": 123456
  --   }
  -- ]
  -- ==========================================================

  if p_rider_identities is null then
    raise exception
      'Les identités des coureurs initiaux sont absentes.';
  end if;

  if jsonb_typeof(p_rider_identities) <> 'array' then
    raise exception
      'Les identités des coureurs doivent être transmises sous forme de tableau.';
  end if;

  if jsonb_array_length(p_rider_identities) <> 7 then
    raise exception
      'La carrière initiale doit contenir exactement sept coureurs.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rider_identities)
      as identity_element(value)
    where jsonb_typeof(identity_element.value) <> 'object'
      or coalesce(
        btrim(identity_element.value ->> 'first_name'),
        ''
      ) = ''
      or coalesce(
        btrim(identity_element.value ->> 'last_name'),
        ''
      ) = ''
      or char_length(
        btrim(identity_element.value ->> 'first_name')
      ) > 80
      or char_length(
        btrim(identity_element.value ->> 'last_name')
      ) > 80
      or coalesce(
        identity_element.value ->> 'avatar_seed',
        ''
      ) !~ '^[0-9]{1,18}$'
  ) then
    raise exception
      'Une ou plusieurs identités de coureurs sont invalides.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rider_identities)
      as identity_element(value)
    group by
      lower(
        btrim(identity_element.value ->> 'first_name')
      ),
      lower(
        btrim(identity_element.value ->> 'last_name')
      )
    having count(*) > 1
  ) then
    raise exception
      'Deux coureurs initiaux ne peuvent pas partager exactement la même identité.';
  end if;


  -- ==========================================================
  -- NOM DE L'ÉQUIPE AMATEUR
  --
  -- Le suffixe issu de l'identifiant du DS garantit l'unicité.
  -- Le nom pourra être remplacé plus tard par le nom du sponsor.
  -- ==========================================================

  director_public_name := coalesce(
    nullif(btrim(current_director.display_name), ''),
    nullif(btrim(current_director.username), ''),
    'Directeur Sportif'
  );

  generated_team_internal_name :=
    'initial_team_'
    || replace(current_director.id::text, '-', '');

  generated_team_display_name :=
    'Équipe amateur de '
    || director_public_name
    || ' · '
    || upper(
      left(
        replace(current_director.id::text, '-', ''),
        4
      )
    );


  -- ==========================================================
  -- CRÉATION DE L'ÉQUIPE
  -- ==========================================================

  insert into public.teams (
    home_country_id,
    founded_season_id,
    internal_name,
    status
  )
  values (
    current_director.country_id,
    current_season.id,
    generated_team_internal_name,
    'active'
  )
  returning id
  into created_team_id;


  -- ==========================================================
  -- AFFECTATION DU DIRECTEUR SPORTIF
  -- ==========================================================

  insert into public.team_manager_assignments (
    sporting_director_id,
    team_id,
    start_season_id,
    end_season_id,
    role,
    status
  )
  values (
    current_director.id,
    created_team_id,
    current_season.id,
    null,
    'general_manager',
    'active'
  );


  -- ==========================================================
  -- INSCRIPTION DE L'ÉQUIPE DANS LA SAISON ACTIVE
  -- ==========================================================

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
  )
  values (
    created_team_id,
    current_season.id,
    null,
    current_director.country_id,
    generated_team_display_name,
    null,
    0,
    0,
    0,
    'EUR',
    'active'
  );


  -- ==========================================================
  -- RÉPARTITION DES ÂGES
  --
  -- Toutes les équipes reçoivent exactement les âges :
  --   18, 19, 20, 21, 22, 23 et 24 ans.
  --
  -- Leur association aux profils sportifs est décalée selon
  -- l'identifiant du DS afin de varier les effectifs sans
  -- modifier leur équilibre global.
  -- ==========================================================

  age_offset := (
    (
      hashtextextended(
        current_director.id::text,
        0
      ) % 7
      + 7
    ) % 7
  )::integer;


  -- ==========================================================
  -- CRÉATION DES SEPT COUREURS
  --
  -- Profils sportifs fixes :
  --   1. Grimpeur
  --   2. Puncheur
  --   3. Rouleur / spécialiste du contre-la-montre
  --   4. Sprinteur
  --   5. Spécialiste des pavés
  --   6. Baroudeur
  --   7. Polyvalent / équipier
  --
  -- Chaque nouveau joueur reçoit exactement ces sept modèles.
  -- ==========================================================

  for identity_record in
    select
      identity_element.value as identity_data,
      identity_element.ordinality::integer as rider_slot
    from jsonb_array_elements(p_rider_identities)
      with ordinality
      as identity_element(value, ordinality)
    order by identity_element.ordinality
  loop
    select profile.*
    into rating_profile
    from (
      values
        (
          1,
          64, 58, 45, 47, 40,
          42, 50, 55,
          57, 54, 58,
          56, 44
        ),
        (
          2,
          56, 64, 49, 46, 43,
          54, 62, 54,
          56, 55, 55,
          60, 48
        ),
        (
          3,
          43, 48, 62, 64, 49,
          50, 52, 49,
          60, 58, 55,
          48, 62
        ),
        (
          4,
          40, 46, 58, 48, 44,
          65, 64, 47,
          54, 52, 50,
          42, 56
        ),
        (
          5,
          42, 50, 60, 51, 65,
          56, 58, 50,
          59, 61, 53,
          54, 52
        ),
        (
          6,
          52, 57, 55, 52, 50,
          50, 54, 56,
          61, 59, 56,
          65, 50
        ),
        (
          7,
          50, 52, 56, 53, 52,
          51, 52, 54,
          63, 62, 61,
          55, 51
        )
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
    where profile.rider_slot = identity_record.rider_slot;


    -- --------------------------------------------------------
    -- IDENTITÉ DU COUREUR
    -- --------------------------------------------------------

    insert into public.riders (
      country_id,
      first_name,
      last_name,
      status,
      generated_name_profile_code,
      avatar_profile_key,
      avatar_seed
    )
    values (
      current_director.country_id,
      btrim(
        identity_record.identity_data ->> 'first_name'
      ),
      btrim(
        identity_record.identity_data ->> 'last_name'
      ),
      'active',
      selected_name_profile_code,
      selected_avatar_profile_key,
      (
        identity_record.identity_data ->> 'avatar_seed'
      )::bigint
    )
    returning id
    into created_rider_id;


    -- --------------------------------------------------------
    -- CONTRAT ACTIF D'UNE SAISON
    --
    -- La saison de début et la saison de fin sont identiques :
    -- le contrat expire donc à la fin de la saison active.
    -- --------------------------------------------------------

    insert into public.rider_contracts (
      rider_id,
      team_id,
      start_season_id,
      end_season_id,
      salary_per_season,
      currency,
      status,
      signed_at
    )
    values (
      created_rider_id,
      created_team_id,
      current_season.id,
      current_season.id,
      0,
      'EUR',
      'active',
      now()
    );


    -- --------------------------------------------------------
    -- ÉVALUATION SPORTIVE DE LA SAISON
    -- --------------------------------------------------------

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
    )
    values (
      created_rider_id,
      current_season.id,
      18 + (
        (
          identity_record.rider_slot
          - 1
          + age_offset
        ) % 7
      ),
      rating_profile.mountain,
      rating_profile.hills,
      rating_profile.flat,
      rating_profile.time_trial,
      rating_profile.cobbles,
      rating_profile.sprint,
      rating_profile.acceleration,
      rating_profile.downhill,
      rating_profile.endurance,
      rating_profile.resistance,
      rating_profile.recovery,
      rating_profile.breakaway,
      rating_profile.prologue
    );

    created_rider_count := created_rider_count + 1;
  end loop;


  -- ==========================================================
  -- CONTRÔLE FINAL
  -- ==========================================================

  if created_rider_count <> 7 then
    raise exception
      'La génération de l’effectif initial est incomplète.';
  end if;


  -- ==========================================================
  -- REGISTRE DE GÉNÉRATION
  -- ==========================================================

  insert into public.initial_career_generations (
    sporting_director_id,
    team_id,
    season_id,
    rider_count,
    generation_version
  )
  values (
    current_director.id,
    created_team_id,
    current_season.id,
    created_rider_count,
    1
  );


  -- ==========================================================
  -- ONBOARDING TERMINÉ
  -- ==========================================================

  update public.sporting_directors
  set onboarding_completed = true
  where id = current_director.id;


  -- ==========================================================
  -- RÉSULTAT
  -- ==========================================================

  return jsonb_build_object(
    'status',
    'created',
    'team_id',
    created_team_id,
    'season_id',
    current_season.id,
    'rider_count',
    created_rider_count,
    'name_profile_code',
    selected_name_profile_code,
    'avatar_profile_key',
    selected_avatar_profile_key,
    'generation_version',
    1
  );
end;
$$;


-- ============================================================
-- AUTORISATIONS
--
-- La fonction utilise auth.uid() et ne peut créer que la
-- carrière du compte actuellement authentifié.
-- ============================================================

revoke all
on function public.initialize_sporting_director_career(jsonb)
from public;

revoke all
on function public.initialize_sporting_director_career(jsonb)
from anon;

grant execute
on function public.initialize_sporting_director_career(jsonb)
to authenticated;


-- ============================================================
-- DOCUMENTATION
-- ============================================================

comment on function
  public.initialize_sporting_director_career(jsonb)
is
  'Crée atomiquement l’équipe amateur et les sept coureurs équilibrés du Directeur Sportif authentifié. Les identités sont fournies par le serveur depuis les bibliothèques JSON, tandis que les statistiques sont imposées par PostgreSQL.';

commit;