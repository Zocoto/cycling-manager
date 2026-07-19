begin;

-- ============================================================
-- US16-B1 — PREPARER LE SPONSOR DE LA SAISON SUIVANTE
--
-- Cette migration permet :
-- - d'ouvrir les signatures anticipees entre J21 et J28 ;
-- - de signer une offre rattachee a la saison suivante ;
-- - de conserver simultanement un contrat actif et un contrat futur ;
-- - de choisir le futur maillot sans activer le contrat ;
-- - de ne verser aucun budget avant le passage a J1.
-- ============================================================


-- Une equipe ne peut preparer qu'un seul sponsor principal pour
-- une saison donnee. Un contrat actif de la saison courante peut
-- toutefois coexister avec ce contrat futur.
create unique index
team_sponsor_one_planned_principal_per_team_season_idx
on public.team_sponsor_contracts (
  team_id,
  start_season_id
)
where status = 'planned'
  and role = 'principal';


-- ============================================================
-- SIGNER UNE OFFRE COURANTE OU FUTURE
-- ============================================================

create or replace function public.sign_sponsor_offer(
  p_offer_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();

  v_sporting_director_id uuid;
  v_team_id uuid;

  v_offer public.sponsor_offers%rowtype;
  v_offer_season record;
  v_active_season record;
  v_active_contract record;

  v_is_current_offer boolean := false;
  v_is_future_offer boolean := false;
  v_has_current_termination boolean := false;
  v_has_active_contract boolean := false;

  v_existing_contract_id uuid;
  v_contract_id uuid;
begin
  if v_auth_user_id is null then
    raise exception
      'Vous devez être authentifié pour signer une offre.';
  end if;

  if p_offer_id is null then
    raise exception
      'L’identifiant de l’offre est obligatoire.';
  end if;


  select sporting_director.id
  into v_sporting_director_id
  from public.sporting_directors as sporting_director
  where sporting_director.auth_user_id =
      v_auth_user_id
    and sporting_director.status = 'active'
  for update;

  if not found then
    raise exception
      'Le profil du Directeur Sportif est introuvable ou inactif.';
  end if;


  select offer.*
  into v_offer
  from public.sponsor_offers as offer
  where offer.id = p_offer_id
    and offer.sporting_director_id =
      v_sporting_director_id
  for update;

  if not found then
    raise exception
      'Cette offre est introuvable ou ne vous appartient pas.';
  end if;


  select contract.id
  into v_existing_contract_id
  from public.team_sponsor_contracts as contract
  where contract.sponsor_offer_id = v_offer.id;

  if found then
    return v_existing_contract_id;
  end if;


  if v_offer.status <> 'open' then
    raise exception
      'Cette offre n’est plus disponible à la signature.';
  end if;

  if (
    v_offer.available_from is not null
    and v_offer.available_from > now()
  ) then
    raise exception
      'Cette offre n’est pas encore disponible.';
  end if;

  if (
    v_offer.available_until is not null
    and v_offer.available_until <= now()
  ) then
    raise exception
      'Cette offre a expiré.';
  end if;


  select
    season.id,
    season.game_year,
    season.name,
    season.status,
    season.current_day_number
  into v_active_season
  from public.seasons as season
  where season.status = 'active'
  for update;

  if not found then
    raise exception
      'Aucune saison active n’est disponible.';
  end if;

  if (
    v_active_season.current_day_number is null
    or v_active_season.current_day_number not between 1 and 28
  ) then
    raise exception
      'Le jour courant de la saison active est invalide.';
  end if;


  select
    season.id,
    season.game_year,
    season.name,
    season.status
  into v_offer_season
  from public.seasons as season
  where season.id = v_offer.season_id
  for update;

  if not found then
    raise exception
      'La saison associée à cette offre est introuvable.';
  end if;


  v_is_current_offer :=
    v_offer_season.id = v_active_season.id
    and v_offer_season.status = 'active';

  v_is_future_offer :=
    v_offer_season.game_year =
      v_active_season.game_year + 1
    and v_offer_season.status = 'planned';

  if not v_is_current_offer and not v_is_future_offer then
    raise exception
      'Cette offre ne concerne ni la saison active ni la saison suivante.';
  end if;


  select assignment.team_id
  into v_team_id
  from public.team_manager_assignments as assignment
  where assignment.sporting_director_id =
      v_sporting_director_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  order by assignment.created_at desc
  limit 1
  for update;

  if not found then
    raise exception
      'Aucune équipe active n’est rattachée à ce Directeur Sportif.';
  end if;


  perform 1
  from public.team_seasons as team_season
  where team_season.team_id = v_team_id
    and team_season.season_id = v_offer.season_id
  for update;

  if not found then
    raise exception
      'L’équipe n’est pas inscrite dans la saison de cette offre.';
  end if;


  if v_is_current_offer then
    -- Le parcours initial reste immediat : aucune rupture de la
    -- saison courante et aucun autre sponsor principal signe.
    perform 1
    from public.team_sponsor_contracts as contract
    where contract.team_id = v_team_id
      and contract.role = 'principal'
      and contract.status = 'terminated'
      and contract.termination_season_id =
        v_active_season.id;

    if found then
      raise exception
        'Après une rupture, un nouveau sponsor ne peut être signé que pour la saison suivante à partir du jour 21.';
    end if;


    select contract.id
    into v_existing_contract_id
    from public.team_sponsor_contracts as contract
    where contract.team_id = v_team_id
      and contract.role = 'principal'
      and contract.status in ('planned', 'active')
    order by contract.created_at desc
    limit 1
    for update;

    if found then
      raise exception
        'L’équipe possède déjà un sponsor principal signé.';
    end if;
  end if;


  if v_is_future_offer then
    if v_active_season.current_day_number < 21 then
      raise exception
        'Les signatures pour la saison suivante ouvrent au jour 21.';
    end if;


    select
      contract.id,
      start_season.game_year
        + contract.contract_duration_seasons
        - 1 as end_game_year
    into v_active_contract
    from public.team_sponsor_contracts as contract
    join public.seasons as start_season
      on start_season.id = contract.start_season_id
    where contract.team_id = v_team_id
      and contract.role = 'principal'
      and contract.status = 'active'
    order by contract.created_at desc
    limit 1
    for update of contract;

    v_has_active_contract := found;


    select exists (
      select 1
      from public.team_sponsor_contracts as contract
      where contract.team_id = v_team_id
        and contract.role = 'principal'
        and contract.status = 'terminated'
        and contract.termination_season_id =
          v_active_season.id
    )
    into v_has_current_termination;


    if v_has_active_contract then
      if v_active_contract.end_game_year >=
        v_offer_season.game_year
      then
        raise exception
          'Le contrat sponsor actuel couvre déjà la saison suivante.';
      end if;
    elsif not v_has_current_termination then
      raise exception
        'Aucun renouvellement ou remplacement de sponsor n’est nécessaire pour la saison suivante.';
    end if;


    select contract.id
    into v_existing_contract_id
    from public.team_sponsor_contracts as contract
    where contract.team_id = v_team_id
      and contract.start_season_id =
        v_offer.season_id
      and contract.role = 'principal'
      and contract.status = 'planned'
    order by contract.created_at desc
    limit 1
    for update;

    if found then
      raise exception
        'L’équipe possède déjà un sponsor principal préparé pour la saison suivante.';
    end if;
  end if;


  update public.sponsor_offers
  set status = 'accepted'
  where id = v_offer.id;


  update public.sponsor_offers
  set status = 'withdrawn'
  where sporting_director_id =
      v_sporting_director_id
    and season_id = v_offer.season_id
    and id <> v_offer.id
    and status in ('draft', 'open');


  insert into public.team_sponsor_contracts (
    team_id,
    sponsor_id,
    sponsor_offer_id,
    start_season_id,
    end_season_id,
    role,
    budget_per_season,
    currency_code,
    status,
    contract_duration_seasons,
    selected_jersey_id,
    selected_jersey_style,
    signed_at,
    activated_at
  )
  values (
    v_team_id,
    v_offer.sponsor_id,
    v_offer.id,
    v_offer.season_id,
    null,
    'principal',
    v_offer.budget_per_season,
    v_offer.currency_code,
    'planned',
    v_offer.contract_duration_seasons,
    null,
    null,
    now(),
    null
  )
  returning id into v_contract_id;


  -- Les objectifs de la saison active commencent immediatement.
  -- Les objectifs futurs restent en preparation jusqu'au passage
  -- a J1, qui sera gere par l'US16-B2.
  if v_is_current_offer then
    update public.sponsor_objectives
    set
      status = 'active',
      updated_at = now()
    where sponsor_offer_id = v_offer.id
      and season_id = v_offer.season_id;


    insert into public.objective_progress (
      sponsor_objective_id,
      team_sponsor_contract_id,
      season_id,
      status,
      current_value,
      details
    )
    select
      objective.id,
      v_contract_id,
      v_offer.season_id,
      'not_started',
      0,
      '{}'::jsonb
    from public.sponsor_objectives as objective
    where objective.sponsor_offer_id = v_offer.id
      and objective.season_id = v_offer.season_id
    on conflict (
      sponsor_objective_id,
      team_sponsor_contract_id,
      season_id
    )
    do nothing;
  end if;


  return v_contract_id;
end;
$$;


-- ============================================================
-- CHOISIR LE MAILLOT COURANT OU FUTUR
-- ============================================================

create or replace function public.validate_sponsor_jersey(
  p_contract_id uuid,
  p_jersey_id text,
  p_jersey_style text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_sporting_director_id uuid;

  v_active_season record;
  v_contract record;

  v_jersey_id text :=
    lower(btrim(coalesce(p_jersey_id, '')));

  v_jersey_style text :=
    lower(btrim(coalesce(p_jersey_style, '')));

  v_expected_jersey_id text;
  v_team_short_name text;
  v_previous_team_display_name text;
  v_previous_team_short_name text;

  v_is_current_contract boolean := false;
  v_is_future_contract boolean := false;
begin
  if v_auth_user_id is null then
    raise exception
      'Vous devez être authentifié pour choisir un maillot.';
  end if;

  if p_contract_id is null then
    raise exception
      'L’identifiant du contrat est obligatoire.';
  end if;


  select sporting_director.id
  into v_sporting_director_id
  from public.sporting_directors as sporting_director
  where sporting_director.auth_user_id =
      v_auth_user_id
    and sporting_director.status = 'active'
  for update;

  if not found then
    raise exception
      'Le profil du Directeur Sportif est introuvable ou inactif.';
  end if;


  select
    season.id,
    season.game_year,
    season.current_day_number
  into v_active_season
  from public.seasons as season
  where season.status = 'active'
  for update;

  if not found then
    raise exception
      'Aucune saison active n’est disponible.';
  end if;


  if v_jersey_style not in (
    'classic',
    'modern',
    'bold'
  ) then
    raise exception
      'Le style de maillot sélectionné est invalide.';
  end if;


  select
    contract.id,
    contract.team_id,
    contract.sponsor_id,
    contract.start_season_id,
    contract.status,
    contract.budget_per_season,
    contract.currency_code,
    contract.selected_jersey_id,
    contract.selected_jersey_style,
    contract.previous_team_display_name,
    contract.previous_team_short_name,

    start_season.game_year as start_game_year,
    start_season.status as start_season_status,

    sponsor.catalog_key,
    sponsor.name as sponsor_name,
    sponsor.short_name as sponsor_short_name

  into v_contract

  from public.team_sponsor_contracts as contract

  join public.seasons as start_season
    on start_season.id = contract.start_season_id

  join public.sponsors as sponsor
    on sponsor.id = contract.sponsor_id

  join public.team_manager_assignments as assignment
    on assignment.team_id = contract.team_id
    and assignment.sporting_director_id =
      v_sporting_director_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'

  where contract.id = p_contract_id
    and contract.role = 'principal'

  for update of contract;

  if not found then
    raise exception
      'Ce contrat est introuvable ou ne vous appartient pas.';
  end if;


  v_expected_jersey_id :=
    lower(v_contract.catalog_key)
    || '-'
    || v_jersey_style;

  if v_jersey_id <> v_expected_jersey_id then
    raise exception
      'Le maillot sélectionné ne correspond pas au sponsor du contrat.';
  end if;


  v_is_current_contract :=
    v_contract.start_season_id = v_active_season.id;

  v_is_future_contract :=
    v_contract.start_game_year =
      v_active_season.game_year + 1
    and v_contract.start_season_status = 'planned';

  if not v_is_current_contract and not v_is_future_contract then
    raise exception
      'Ce contrat ne concerne ni la saison active ni la saison suivante.';
  end if;


  if v_contract.status = 'active' then
    if (
      v_contract.selected_jersey_id = v_jersey_id
      and v_contract.selected_jersey_style =
        v_jersey_style
    ) then
      return v_contract.id;
    end if;

    raise exception
      'Le maillot de ce contrat a déjà été validé.';
  end if;


  if v_contract.status <> 'planned' then
    raise exception
      'Ce contrat ne peut plus recevoir de maillot.';
  end if;


  if (
    v_contract.selected_jersey_id is not null
    or v_contract.selected_jersey_style is not null
  ) then
    if (
      v_contract.selected_jersey_id = v_jersey_id
      and v_contract.selected_jersey_style =
        v_jersey_style
    ) then
      return v_contract.id;
    end if;

    raise exception
      'Le maillot de ce contrat a déjà été choisi.';
  end if;


  if v_is_future_contract then
    if (
      v_active_season.current_day_number is null
      or v_active_season.current_day_number < 21
    ) then
      raise exception
        'Le maillot de la saison suivante ne peut être choisi qu’à partir du jour 21.';
    end if;


    update public.team_sponsor_contracts
    set
      selected_jersey_id = v_jersey_id,
      selected_jersey_style = v_jersey_style
    where id = v_contract.id;

    return v_contract.id;
  end if;


  v_team_short_name :=
    coalesce(
      nullif(
        btrim(v_contract.sponsor_short_name),
        ''
      ),
      v_contract.sponsor_name
    );


  select
    team_season.display_name,
    team_season.short_name
  into strict v_previous_team_display_name,
    v_previous_team_short_name
  from public.team_seasons as team_season
  where team_season.team_id = v_contract.team_id
    and team_season.season_id =
      v_contract.start_season_id
  for update;


  update public.team_sponsor_contracts
  set
    previous_team_display_name =
      v_previous_team_display_name,
    previous_team_short_name =
      v_previous_team_short_name,
    selected_jersey_id = v_jersey_id,
    selected_jersey_style = v_jersey_style,
    status = 'active',
    activated_at = now()
  where id = v_contract.id;


  update public.team_seasons
  set
    display_name = v_contract.sponsor_name,
    short_name = v_team_short_name,
    operating_budget =
      operating_budget + v_contract.budget_per_season,
    currency_code = v_contract.currency_code,
    status = case
      when status = 'planned' then 'active'
      else status
    end
  where team_id = v_contract.team_id
    and season_id = v_contract.start_season_id;

  if not found then
    raise exception
      'La saison de l’équipe est introuvable. Le contrat n’a pas été activé.';
  end if;


  return v_contract.id;
end;
$$;


-- ============================================================
-- SECURITE ET DOCUMENTATION
-- ============================================================

revoke all
on function public.sign_sponsor_offer(uuid)
from public;

grant execute
on function public.sign_sponsor_offer(uuid)
to authenticated;


revoke all
on function public.validate_sponsor_jersey(
  uuid,
  text,
  text
)
from public;

grant execute
on function public.validate_sponsor_jersey(
  uuid,
  text,
  text
)
to authenticated;


comment on function
public.sign_sponsor_offer(uuid) is
  'Signe une offre de la saison active ou une offre future ouverte entre J21 et J28, puis cree un contrat principal planned.';

comment on function
public.validate_sponsor_jersey(uuid, text, text) is
  'Active immediatement un contrat courant ou enregistre seulement le maillot d un contrat futur sans verser le budget.';


notify pgrst, 'reload schema';

commit;
