begin;

-- ============================================================
-- US14 — SIGNATURE DU SPONSOR ET CHOIX DU MAILLOT
--
-- Parcours :
-- 1. Le Directeur Sportif signe une offre.
-- 2. Le contrat est créé avec le statut "planned".
-- 3. Les deux autres offres sont retirées.
-- 4. Le Directeur Sportif choisit l'un des trois maillots.
-- 5. Le contrat devient "active" et le budget est crédité.
-- ============================================================


-- ============================================================
-- EVOLUTION DES CONTRATS SPONSORS
-- ============================================================

alter table public.team_sponsor_contracts
add column contract_duration_seasons smallint;

alter table public.team_sponsor_contracts
add column selected_jersey_id text;

alter table public.team_sponsor_contracts
add column selected_jersey_style text;

alter table public.team_sponsor_contracts
add column signed_at timestamptz;

alter table public.team_sponsor_contracts
add column activated_at timestamptz;


-- Reprise de la durée depuis l'offre associée pour les éventuels
-- contrats déjà présents.
update public.team_sponsor_contracts as contract
set contract_duration_seasons =
  offer.contract_duration_seasons
from public.sponsor_offers as offer
where offer.id = contract.sponsor_offer_id
  and contract.contract_duration_seasons is null;

-- Valeur de sécurité pour d'éventuels contrats historiques
-- qui ne seraient reliés à aucune offre.
update public.team_sponsor_contracts
set contract_duration_seasons = 1
where contract_duration_seasons is null;

alter table public.team_sponsor_contracts
alter column contract_duration_seasons set not null;


-- Les saisons futures ne sont pas encore toutes créées.
-- La durée contractuelle devient la référence jusqu'à ce que
-- l'EPIC Saison/Calendrier puisse renseigner end_season_id.
alter table public.team_sponsor_contracts
alter column end_season_id drop not null;


-- ============================================================
-- CONTRAINTES DES NOUVELLES COLONNES
-- ============================================================

alter table public.team_sponsor_contracts
add constraint team_sponsor_contracts_duration_positive
check (
  contract_duration_seasons > 0
);

alter table public.team_sponsor_contracts
add constraint team_sponsor_contracts_jersey_style_allowed
check (
  selected_jersey_style is null
  or selected_jersey_style in (
    'classic',
    'modern',
    'bold'
  )
);

alter table public.team_sponsor_contracts
add constraint team_sponsor_contracts_jersey_id_not_empty
check (
  selected_jersey_id is null
  or btrim(selected_jersey_id) <> ''
);

alter table public.team_sponsor_contracts
add constraint team_sponsor_contracts_jersey_selection_complete
check (
  (
    selected_jersey_id is null
    and selected_jersey_style is null
  )
  or (
    selected_jersey_id is not null
    and selected_jersey_style is not null
  )
);

alter table public.team_sponsor_contracts
add constraint team_sponsor_contracts_activation_date_valid
check (
  activated_at is null
  or signed_at is null
  or activated_at >= signed_at
);


-- ============================================================
-- RPC 1 — SIGNER UNE OFFRE DE SPONSORING
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


  -- Le verrou sur le Directeur Sportif empêche deux signatures
  -- concurrentes sur deux offres différentes.
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


  -- L'offre doit appartenir au joueur authentifié.
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


  -- Idempotence : si cette offre a déjà produit un contrat,
  -- le contrat existant est simplement retourné.
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


  -- La signature ne peut porter que sur la saison active.
  perform 1
  from public.seasons as season
  where season.id = v_offer.season_id
    and season.status = 'active';

  if not found then
    raise exception
      'La saison associée à cette offre n’est plus active.';
  end if;


  -- Récupération de l'équipe actuellement dirigée.
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


  -- L'équipe doit être inscrite dans la saison de l'offre.
  perform 1
  from public.team_seasons as team_season
  where team_season.team_id = v_team_id
    and team_season.season_id =
      v_offer.season_id;

  if not found then
    raise exception
      'L’équipe n’est pas inscrite dans la saison de cette offre.';
  end if;


  -- Une équipe ne peut avoir qu'un seul sponsor principal
  -- en préparation ou déjà actif.
  select contract.id
  into v_existing_contract_id
  from public.team_sponsor_contracts as contract
  where contract.team_id = v_team_id
    and contract.role = 'principal'
    and contract.status in (
      'planned',
      'active'
    )
  order by contract.created_at desc
  limit 1
  for update;

  if found then
    raise exception
      'L’équipe possède déjà un sponsor principal signé.';
  end if;


  -- L'offre choisie est acceptée.
  update public.sponsor_offers
  set status = 'accepted'
  where id = v_offer.id;


  -- Les offres concurrentes de la même saison sont retirées.
  update public.sponsor_offers
  set status = 'withdrawn'
  where sporting_director_id =
      v_sporting_director_id
    and season_id = v_offer.season_id
    and id <> v_offer.id
    and status in (
      'draft',
      'open'
    );


  -- Le contrat reste "planned" tant que le maillot n'est pas
  -- choisi et validé.
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


  -- Les sept objectifs deviennent les engagements du contrat.
  update public.sponsor_objectives
  set
    status = 'active',
    updated_at = now()
  where sponsor_offer_id = v_offer.id
    and season_id = v_offer.season_id;


  -- Initialisation de leur suivi.
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
  where objective.sponsor_offer_id =
    v_offer.id
    and objective.season_id =
      v_offer.season_id
  on conflict (
    sponsor_objective_id,
    team_sponsor_contract_id,
    season_id
  )
  do nothing;


  return v_contract_id;
end;
$$;


-- ============================================================
-- RPC 2 — VALIDER LE MAILLOT ET ACTIVER LE CONTRAT
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

  v_contract record;

  v_jersey_id text :=
    lower(btrim(coalesce(p_jersey_id, '')));

  v_jersey_style text :=
    lower(btrim(coalesce(p_jersey_style, '')));

  v_expected_jersey_id text;
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


  if v_jersey_style not in (
    'classic',
    'modern',
    'bold'
  ) then
    raise exception
      'Le style de maillot sélectionné est invalide.';
  end if;


  -- Le contrat doit appartenir à l'équipe gérée par le joueur.
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
    sponsor.catalog_key
  into v_contract
  from public.team_sponsor_contracts as contract
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


  -- Les identifiants du catalogue respectent la convention :
  -- <catalog_key>-classic
  -- <catalog_key>-modern
  -- <catalog_key>-bold
  v_expected_jersey_id :=
    lower(v_contract.catalog_key)
    || '-'
    || v_jersey_style;

  if v_jersey_id <> v_expected_jersey_id then
    raise exception
      'Le maillot sélectionné ne correspond pas au sponsor du contrat.';
  end if;


  -- Idempotence : une seconde validation identique ne recrédite
  -- jamais le budget.
  if v_contract.status = 'active' then
    if (
      v_contract.selected_jersey_id =
        v_jersey_id
      and
      v_contract.selected_jersey_style =
        v_jersey_style
    ) then
      return v_contract.id;
    end if;

    raise exception
      'Le maillot de ce contrat a déjà été validé.';
  end if;


  if v_contract.status <> 'planned' then
    raise exception
      'Ce contrat ne peut plus être activé.';
  end if;


  update public.team_sponsor_contracts
  set
    selected_jersey_id = v_jersey_id,
    selected_jersey_style = v_jersey_style,
    status = 'active',
    activated_at = now()
  where id = v_contract.id;


  -- Le budget n'est versé qu'au moment de la validation du
  -- maillot et de l'activation définitive du contrat.
  update public.team_seasons
  set
    operating_budget =
      operating_budget
      + v_contract.budget_per_season,
    currency_code =
      v_contract.currency_code,
    status = case
      when status = 'planned' then 'active'
      else status
    end
  where team_id = v_contract.team_id
    and season_id =
      v_contract.start_season_id;

  if not found then
    raise exception
      'La saison de l’équipe est introuvable. Le contrat n’a pas été activé.';
  end if;


  return v_contract.id;
end;
$$;


-- ============================================================
-- SECURITE DES RPC
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


-- ============================================================
-- DOCUMENTATION
-- ============================================================

comment on column
public.team_sponsor_contracts.contract_duration_seasons is
  'Durée contractuelle totale en nombre de saisons.';

comment on column
public.team_sponsor_contracts.selected_jersey_id is
  'Identifiant stable du maillot choisi dans le catalogue TypeScript.';

comment on column
public.team_sponsor_contracts.selected_jersey_style is
  'Style du maillot choisi : classic, modern ou bold.';

comment on column
public.team_sponsor_contracts.signed_at is
  'Date de signature de l’offre par le Directeur Sportif.';

comment on column
public.team_sponsor_contracts.activated_at is
  'Date de validation du maillot et d’activation définitive du contrat.';

comment on function
public.sign_sponsor_offer(uuid) is
  'Signe une offre, retire les offres concurrentes et crée un contrat sponsor en attente du choix du maillot.';

comment on function
public.validate_sponsor_jersey(uuid, text, text) is
  'Enregistre le maillot choisi, active le contrat sponsor et crédite le budget de la saison.';


notify pgrst, 'reload schema';

commit;