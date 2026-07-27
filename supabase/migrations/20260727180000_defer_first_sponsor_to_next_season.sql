begin;

-- A first sponsor follows the same calendar as renewals:
-- qualification at 30 reputation points, offers from J21, activation next season.
update public.sponsor_offers as offer
set status = 'withdrawn'
from public.seasons as season
where season.id = offer.season_id
  and season.status = 'active'
  and offer.status in ('draft', 'open');

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
  v_reputation_points integer;
  v_team_id uuid;

  v_offer public.sponsor_offers%rowtype;
  v_offer_season record;
  v_active_season record;
  v_active_contract record;

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

  select
    sporting_director.id,
    sporting_director.reputation_points
  into
    v_sporting_director_id,
    v_reputation_points
  from public.sporting_directors as sporting_director
  where sporting_director.auth_user_id = v_auth_user_id
    and sporting_director.status = 'active'
  for update;

  if not found then
    raise exception
      'Le profil du Directeur Sportif est introuvable ou inactif.';
  end if;

  if coalesce(v_reputation_points, 0) < 30 then
    raise exception
      'Le marché du sponsoring se débloque à 30 points de réputation.';
  end if;

  select offer.*
  into v_offer
  from public.sponsor_offers as offer
  where offer.id = p_offer_id
    and offer.sporting_director_id = v_sporting_director_id
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

  if v_active_season.current_day_number < 21 then
    raise exception
      'Les trois offres sponsor de la saison suivante ouvrent au jour 21.';
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

  if not (
    v_offer_season.game_year = v_active_season.game_year + 1
    and v_offer_season.status = 'planned'
  ) then
    raise exception
      'Une offre sponsor ne peut être signée que pour la saison suivante. L’équipe reste amateur pendant la saison en cours.';
  end if;

  select assignment.team_id
  into v_team_id
  from public.team_manager_assignments as assignment
  where assignment.sporting_director_id = v_sporting_director_id
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

  if (
    found
    and v_active_contract.end_game_year >= v_offer_season.game_year
  ) then
    raise exception
      'Le contrat sponsor actuel couvre déjà la saison suivante.';
  end if;

  select contract.id
  into v_existing_contract_id
  from public.team_sponsor_contracts as contract
  where contract.team_id = v_team_id
    and contract.start_season_id = v_offer.season_id
    and contract.role = 'principal'
    and contract.status = 'planned'
  order by contract.created_at desc
  limit 1
  for update;

  if found then
    raise exception
      'L’équipe possède déjà un sponsor principal préparé pour la saison suivante.';
  end if;

  update public.sponsor_offers
  set status = 'accepted'
  where id = v_offer.id;

  update public.sponsor_offers
  set status = 'withdrawn'
  where sporting_director_id = v_sporting_director_id
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

  return v_contract_id;
end;
$$;

revoke all
on function public.sign_sponsor_offer(uuid)
from public;

grant execute
on function public.sign_sponsor_offer(uuid)
to authenticated;

comment on function
public.sign_sponsor_offer(uuid) is
  'Signe uniquement une offre de la saison suivante à partir de J21, y compris le premier sponsor d une équipe qualifiée à 30 points.';

notify pgrst, 'reload schema';

commit;
