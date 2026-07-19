begin;

-- ============================================================
-- US16-A — RUPTURE ANTICIPEE DES CONTRATS SPONSORS
--
-- Cette migration :
-- - conserve l'identite amateur de l'equipe avant activation ;
-- - historise la fin ou la rupture d'un contrat ;
-- - permet au Directeur Sportif de rompre son sponsor actif ;
-- - applique une penalite de 10 points de reputation ;
-- - restaure l'identite amateur de l'equipe ;
-- - annule les objectifs du sponsor pour la saison ;
-- - bloque les nouvelles offres jusqu'a la saison suivante.
-- ============================================================


-- ============================================================
-- HISTORIQUE DU CYCLE DE VIE DU CONTRAT
-- ============================================================

alter table public.team_sponsor_contracts
add column previous_team_display_name text;

alter table public.team_sponsor_contracts
add column previous_team_short_name text;

alter table public.team_sponsor_contracts
add column completed_at timestamptz;

alter table public.team_sponsor_contracts
add column terminated_at timestamptz;

alter table public.team_sponsor_contracts
add column termination_reason text;

alter table public.team_sponsor_contracts
add column reputation_penalty integer
not null default 0;

alter table public.team_sponsor_contracts
add column termination_season_id uuid
references public.seasons(id)
on delete restrict;


alter table public.team_sponsor_contracts
add constraint team_sponsor_contracts_previous_name_not_empty
check (
  previous_team_display_name is null
  or btrim(previous_team_display_name) <> ''
);

alter table public.team_sponsor_contracts
add constraint team_sponsor_contracts_previous_short_name_not_empty
check (
  previous_team_short_name is null
  or btrim(previous_team_short_name) <> ''
);

alter table public.team_sponsor_contracts
add constraint team_sponsor_contracts_termination_reason_not_empty
check (
  termination_reason is null
  or btrim(termination_reason) <> ''
);

alter table public.team_sponsor_contracts
add constraint team_sponsor_contracts_reputation_penalty_non_negative
check (
  reputation_penalty >= 0
);

alter table public.team_sponsor_contracts
add constraint team_sponsor_contracts_completed_at_valid
check (
  completed_at is null
  or activated_at is null
  or completed_at >= activated_at
);

alter table public.team_sponsor_contracts
add constraint team_sponsor_contracts_terminated_at_valid
check (
  terminated_at is null
  or activated_at is null
  or terminated_at >= activated_at
);


create index team_sponsor_contracts_termination_season_idx
on public.team_sponsor_contracts (
  team_id,
  termination_season_id
)
where status = 'terminated'
  and role = 'principal';


-- ============================================================
-- REPRISE DES CONTRATS DEJA ACTIFS
--
-- Les contrats existants ont deja remplace le nom amateur par
-- le nom du sponsor. On reconstitue donc l'identite initiale a
-- partir du Directeur Sportif et de son identifiant public.
-- ============================================================

update public.team_sponsor_contracts as contract
set
  previous_team_display_name =
    'Équipe amateur de '
    || coalesce(
      nullif(
        btrim(sporting_director.display_name),
        ''
      ),
      nullif(
        btrim(sporting_director.username),
        ''
      ),
      'Directeur Sportif'
    )
    || ' · '
    || upper(
      left(
        replace(
          sporting_director.id::text,
          '-',
          ''
        ),
        4
      )
    ),

  previous_team_short_name = null

from public.team_manager_assignments as assignment

join public.sporting_directors as sporting_director
  on sporting_director.id =
    assignment.sporting_director_id

where contract.team_id = assignment.team_id
  and contract.role = 'principal'
  and contract.status = 'active'
  and assignment.role = 'general_manager'
  and assignment.status = 'active'
  and contract.previous_team_display_name
    is null;


-- ============================================================
-- VALIDATION DU MAILLOT
--
-- La fonction sauvegarde maintenant l'identite de l'equipe
-- avant d'appliquer le nom commercial du sponsor.
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
  v_team_season record;

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
    contract.previous_team_display_name,
    contract.previous_team_short_name,

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
  -- Le budget n'est pas recredite et l'identite precedente
  -- n'est jamais ecrasee.
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


  select
    team_season.display_name,
    team_season.short_name
  into v_team_season
  from public.team_seasons as team_season
  where team_season.team_id =
      v_contract.team_id
    and team_season.season_id =
      v_contract.start_season_id
  for update;

  if not found then
    raise exception
      'La saison de l’équipe est introuvable. Le contrat n’a pas été activé.';
  end if;


  update public.team_sponsor_contracts
  set
    previous_team_display_name =
      coalesce(
        previous_team_display_name,
        v_team_season.display_name
      ),

    previous_team_short_name =
      case
        when previous_team_display_name
          is null
        then v_team_season.short_name
        else previous_team_short_name
      end,

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


  return v_contract.id;
end;
$$;


-- ============================================================
-- RPC — RUPTURE ANTICIPEE
-- ============================================================

create or replace function public.terminate_active_sponsor_contract(
  p_contract_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();

  v_sporting_director record;
  v_active_season_id uuid;
  v_contract record;

  v_reputation_penalty integer := 10;

  v_restored_display_name text;
  v_restored_short_name text;
  v_terminated_at timestamptz := now();
begin
  if v_auth_user_id is null then
    raise exception
      'Vous devez être authentifié pour rompre un contrat.';
  end if;

  if p_contract_id is null then
    raise exception
      'L’identifiant du contrat est obligatoire.';
  end if;


  select
    sporting_director.id,
    sporting_director.username,
    sporting_director.display_name,
    sporting_director.reputation_points
  into v_sporting_director
  from public.sporting_directors as sporting_director
  where sporting_director.auth_user_id =
      v_auth_user_id
    and sporting_director.status = 'active'
  for update;

  if not found then
    raise exception
      'Le profil du Directeur Sportif est introuvable ou inactif.';
  end if;


  select season.id
  into v_active_season_id
  from public.seasons as season
  where season.status = 'active'
  for update;

  if not found then
    raise exception
      'Aucune saison active n’est disponible.';
  end if;


  select
    contract.id,
    contract.team_id,
    contract.sponsor_offer_id,
    contract.status,
    contract.previous_team_display_name,
    contract.previous_team_short_name
  into v_contract
  from public.team_sponsor_contracts as contract

  join public.team_manager_assignments as assignment
    on assignment.team_id = contract.team_id
    and assignment.sporting_director_id =
      v_sporting_director.id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'

  where contract.id = p_contract_id
    and contract.role = 'principal'

  for update of contract;

  if not found then
    raise exception
      'Ce contrat est introuvable ou ne vous appartient pas.';
  end if;


  if v_contract.status = 'terminated' then
    return v_contract.id;
  end if;

  if v_contract.status <> 'active' then
    raise exception
      'Seul un contrat sponsor actif peut être rompu.';
  end if;


  perform 1
  from public.team_seasons as team_season
  where team_season.team_id =
      v_contract.team_id
    and team_season.season_id =
      v_active_season_id
  for update;

  if not found then
    raise exception
      'L’équipe n’est pas inscrite dans la saison active.';
  end if;


  v_restored_display_name :=
    coalesce(
      nullif(
        btrim(
          v_contract.previous_team_display_name
        ),
        ''
      ),

      'Équipe amateur de '
      || coalesce(
        nullif(
          btrim(
            v_sporting_director.display_name
          ),
          ''
        ),
        nullif(
          btrim(
            v_sporting_director.username
          ),
          ''
        ),
        'Directeur Sportif'
      )
      || ' · '
      || upper(
        left(
          replace(
            v_sporting_director.id::text,
            '-',
            ''
          ),
          4
        )
      )
    );

  v_restored_short_name :=
    v_contract.previous_team_short_name;


  update public.team_sponsor_contracts
  set
    status = 'terminated',
    terminated_at = v_terminated_at,
    termination_reason =
      'director_early_termination',
    reputation_penalty =
      v_reputation_penalty,
    termination_season_id =
      v_active_season_id
  where id = v_contract.id;


  update public.sponsor_objectives
  set
    status = 'cancelled',
    updated_at = v_terminated_at
  where sponsor_offer_id =
      v_contract.sponsor_offer_id
    and status = 'active';


  update public.objective_progress
  set
    status = case
      when status = 'achieved'
      then 'achieved'
      else 'failed'
    end,

    details =
      coalesce(details, '{}'::jsonb)
      || jsonb_build_object(
        'contract_terminated', true,
        'termination_reason',
          'director_early_termination',
        'terminated_at',
          v_terminated_at
      ),

    last_evaluated_at = v_terminated_at,
    updated_at = v_terminated_at

  where team_sponsor_contract_id =
      v_contract.id;


  update public.sporting_directors
  set reputation_points =
    greatest(
      reputation_points -
        v_reputation_penalty,
      0
    )
  where id = v_sporting_director.id;


  update public.team_seasons
  set
    display_name =
      v_restored_display_name,
    short_name =
      v_restored_short_name
  where team_id = v_contract.team_id
    and season_id =
      v_active_season_id;


  return v_contract.id;
end;
$$;


-- ============================================================
-- SECURITE ET DOCUMENTATION
-- ============================================================

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


revoke all
on function public.terminate_active_sponsor_contract(
  uuid
)
from public;

grant execute
on function public.terminate_active_sponsor_contract(
  uuid
)
to authenticated;


comment on column
public.team_sponsor_contracts.previous_team_display_name is
  'Nom de l equipe avant l activation de son sponsor principal.';

comment on column
public.team_sponsor_contracts.previous_team_short_name is
  'Nom court de l equipe avant l activation de son sponsor principal.';

comment on column
public.team_sponsor_contracts.completed_at is
  'Date de fin naturelle du contrat sponsor.';

comment on column
public.team_sponsor_contracts.terminated_at is
  'Date de rupture anticipee du contrat sponsor.';

comment on column
public.team_sponsor_contracts.termination_reason is
  'Code metier expliquant la rupture du contrat sponsor.';

comment on column
public.team_sponsor_contracts.reputation_penalty is
  'Nombre de points de reputation retires lors de la rupture.';

comment on column
public.team_sponsor_contracts.termination_season_id is
  'Saison pendant laquelle la rupture anticipee a ete prononcee.';

comment on function
public.validate_sponsor_jersey(
  uuid,
  text,
  text
) is
  'Sauvegarde l identite precedente, valide le maillot, active le contrat, credite le budget et applique le nom commercial du sponsor.';

comment on function
public.terminate_active_sponsor_contract(
  uuid
) is
  'Rompt le sponsor principal actif, applique la penalite de reputation, annule ses objectifs et restaure l identite amateur de l equipe.';


notify pgrst, 'reload schema';

commit;
