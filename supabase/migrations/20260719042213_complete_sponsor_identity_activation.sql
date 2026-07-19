begin;

-- ============================================================
-- US14 — IDENTITÉ COMMERCIALE DE L'ÉQUIPE
--
-- Lors de la validation du maillot :
-- - le contrat sponsor devient actif ;
-- - le budget est crédité une seule fois ;
-- - le nom de l'équipe devient celui du sponsor principal ;
-- - le nom court est également synchronisé.
--
-- La migration reprend aussi les contrats déjà activés avant
-- l'ajout de cette conséquence.
-- ============================================================


-- ============================================================
-- RPC — VALIDATION DU MAILLOT ET ACTIVATION DU CONTRAT
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
  v_team_short_name text;
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

    sponsor.catalog_key,
    sponsor.name as sponsor_name,
    sponsor.short_name as sponsor_short_name

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


  v_expected_jersey_id :=
    lower(v_contract.catalog_key)
    || '-'
    || v_jersey_style;

  if v_jersey_id <> v_expected_jersey_id then
    raise exception
      'Le maillot sélectionné ne correspond pas au sponsor du contrat.';
  end if;


  v_team_short_name :=
    coalesce(
      nullif(
        btrim(v_contract.sponsor_short_name),
        ''
      ),
      v_contract.sponsor_name
    );


  -- Une validation identique reste idempotente.
  -- Le budget n'est pas recrédité, mais l'identité commerciale
  -- est resynchronisée si nécessaire.
  if v_contract.status = 'active' then
    if (
      v_contract.selected_jersey_id =
        v_jersey_id
      and
      v_contract.selected_jersey_style =
        v_jersey_style
    ) then
      update public.team_seasons
      set
        display_name =
          v_contract.sponsor_name,
        short_name =
          v_team_short_name
      where team_id = v_contract.team_id
        and season_id =
          v_contract.start_season_id;

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
    selected_jersey_style =
      v_jersey_style,
    status = 'active',
    activated_at = now()
  where id = v_contract.id;


  update public.team_seasons
  set
    display_name =
      v_contract.sponsor_name,

    short_name =
      v_team_short_name,

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
-- REPRISE DES CONTRATS DÉJÀ ACTIVÉS
-- ============================================================

update public.team_seasons as team_season
set
  display_name = sponsor.name,

  short_name = coalesce(
    nullif(
      btrim(sponsor.short_name),
      ''
    ),
    sponsor.name
  )

from public.team_sponsor_contracts as contract

join public.sponsors as sponsor
  on sponsor.id = contract.sponsor_id

where contract.team_id =
    team_season.team_id

  and contract.start_season_id =
    team_season.season_id

  and contract.role = 'principal'

  and contract.status = 'active'

  and contract.selected_jersey_id
    is not null;


-- ============================================================
-- DROITS DU SERVICE SERVEUR
-- ============================================================

grant usage
on schema public
to service_role;

grant select
on table public.sporting_directors
to service_role;

grant select
on table public.team_manager_assignments
to service_role;

grant select
on table public.initial_career_generations
to service_role;

grant select
on table public.team_sponsor_contracts
to service_role;

grant select
on table public.team_seasons
to service_role;

grant select
on table public.seasons
to service_role;

grant select
on table public.sponsors
to service_role;


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
public.validate_sponsor_jersey(
  uuid,
  text,
  text
) is
  'Valide le maillot, active le contrat, crédite le budget et applique le nom commercial du sponsor à l’équipe.';


notify pgrst, 'reload schema';

commit;