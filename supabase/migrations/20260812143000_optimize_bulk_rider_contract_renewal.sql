begin;

-- La saison suivante est normalement déjà préparée lorsque l'onglet Contrats
-- devient disponible. Éviter de reprovisionner tout son calendrier à chaque
-- prolongation ; ce travail répété faisait dépasser le statement_timeout dès
-- que plusieurs coureurs étaient renouvelés ensemble.
create or replace function public.renew_current_team_rider(p_rider_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_contract public.rider_contracts%rowtype;
  v_end_year integer;
  v_next_season_id uuid;
  v_salary numeric;
  v_contract_id uuid;
begin
  select assignment.team_id, season.id as season_id, season.game_year
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au DS.';
  end if;

  select contract.*
  into v_contract
  from public.rider_contracts as contract
  where contract.rider_id = p_rider_id
    and contract.team_id = v_context.team_id
    and contract.status = 'active'
  for update;

  if v_contract is null then
    raise exception 'Ce coureur n’appartient pas à votre équipe.';
  end if;

  select season.game_year
  into v_end_year
  from public.seasons as season
  where season.id = v_contract.end_season_id;

  if v_end_year is null then
    raise exception 'L’échéance du contrat est introuvable.';
  end if;

  if v_end_year > v_context.game_year then
    raise exception 'Ce coureur est déjà sous contrat pour la saison suivante.';
  end if;

  select next_season.id
  into v_next_season_id
  from public.seasons as next_season
  where next_season.game_year = v_context.game_year + 1
    and exists (
      select 1
      from public.season_days as final_day
      where final_day.season_id = next_season.id
        and final_day.day_number = 28
    )
  limit 1;

  if v_next_season_id is null then
    v_next_season_id := public.ensure_transfer_next_season(
      v_context.season_id
    );
  end if;

  if exists (
    select 1
    from public.rider_contracts as successor
    where successor.rider_id = p_rider_id
      and successor.start_season_id = v_next_season_id
      and successor.status in ('planned', 'active')
  ) then
    raise exception 'Le contrat de ce coureur est déjà renouvelé.';
  end if;

  v_salary := public.calculate_rider_season_salary(
    p_rider_id,
    v_next_season_id
  );

  insert into public.rider_contracts (
    rider_id,
    team_id,
    start_season_id,
    end_season_id,
    salary_per_season,
    currency,
    currency_code,
    status,
    signed_at,
    acquisition_type
  )
  values (
    p_rider_id,
    v_context.team_id,
    v_next_season_id,
    v_next_season_id,
    v_salary,
    v_contract.currency,
    v_contract.currency_code,
    'planned',
    now(),
    'renewal'
  )
  on conflict (rider_id, team_id, start_season_id)
  do update set
    end_season_id = excluded.end_season_id,
    salary_per_season = excluded.salary_per_season,
    currency = excluded.currency,
    currency_code = excluded.currency_code,
    status = 'planned',
    signed_at = excluded.signed_at,
    acquisition_type = 'renewal',
    left_season_id = null,
    left_day_number = null
  where rider_contracts.status = 'cancelled'
  returning id into v_contract_id;

  if v_contract_id is null then
    raise exception 'Un autre contrat existe déjà pour cette saison.';
  end if;

  return v_contract_id;
end;
$$;

create or replace function public.renew_all_current_team_riders()
returns table (
  renewed_count integer,
  total_salary numeric
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_next_season_id uuid;
  v_contract record;
begin
  select
    assignment.team_id,
    season.id as season_id,
    season.game_year
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au DS.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'bulk-rider-renewal:' || v_context.team_id::text,
      0
    )
  );

  select next_season.id
  into v_next_season_id
  from public.seasons as next_season
  where next_season.game_year = v_context.game_year + 1
    and exists (
      select 1
      from public.season_days as final_day
      where final_day.season_id = next_season.id
        and final_day.day_number = 28
    )
  limit 1;

  if v_next_season_id is null then
    v_next_season_id := public.ensure_transfer_next_season(
      v_context.season_id
    );
  end if;

  renewed_count := 0;
  total_salary := 0;

  for v_contract in
    with eligible_contracts as (
      select
        contract.rider_id,
        contract.team_id,
        contract.currency,
        contract.currency_code
      from public.rider_contracts as contract
      join public.seasons as contract_end
        on contract_end.id = contract.end_season_id
      where contract.team_id = v_context.team_id
        and contract.status = 'active'
        and contract_end.game_year <= v_context.game_year
        and not exists (
          select 1
          from public.rider_contracts as successor
          where successor.rider_id = contract.rider_id
            and successor.start_season_id = v_next_season_id
            and successor.status in ('planned', 'active')
        )
      order by contract.id
      for update of contract
    )
    insert into public.rider_contracts (
      rider_id,
      team_id,
      start_season_id,
      end_season_id,
      salary_per_season,
      currency,
      currency_code,
      status,
      signed_at,
      acquisition_type
    )
    select
      eligible.rider_id,
      eligible.team_id,
      v_next_season_id,
      v_next_season_id,
      public.calculate_rider_season_salary(
        eligible.rider_id,
        v_next_season_id
      ),
      eligible.currency,
      eligible.currency_code,
      'planned',
      now(),
      'renewal'
    from eligible_contracts as eligible
    on conflict (rider_id, team_id, start_season_id)
    do update set
      end_season_id = excluded.end_season_id,
      salary_per_season = excluded.salary_per_season,
      currency = excluded.currency,
      currency_code = excluded.currency_code,
      status = 'planned',
      signed_at = excluded.signed_at,
      acquisition_type = 'renewal',
      left_season_id = null,
      left_day_number = null
    where rider_contracts.status = 'cancelled'
    returning id, salary_per_season
  loop
    renewed_count := renewed_count + 1;
    total_salary := total_salary + coalesce(v_contract.salary_per_season, 0);
  end loop;

  return next;
end;
$$;

-- Régulariser les contrats gratuits déjà étendus directement jusqu'en S2 par
-- l'ancienne RPC. Le contrat courant reste gratuit en S1 et une vraie ligne de
-- renouvellement porte le salaire recalculé pour S2.
do $$
declare
  v_current_season record;
  v_next_season_id uuid;
  v_contract record;
  v_renewal_id uuid;
begin
  select season.id, season.game_year
  into v_current_season
  from public.seasons as season
  where season.status = 'active'
  order by season.game_year desc
  limit 1;

  if v_current_season is null then
    return;
  end if;

  select season.id
  into v_next_season_id
  from public.seasons as season
  where season.game_year = v_current_season.game_year + 1
  limit 1;

  if v_next_season_id is null then
    return;
  end if;

  for v_contract in
    select
      contract.id,
      contract.rider_id,
      contract.team_id,
      contract.currency,
      contract.currency_code
    from public.rider_contracts as contract
    join public.seasons as contract_start
      on contract_start.id = contract.start_season_id
    where contract.status = 'active'
      and contract.end_season_id = v_next_season_id
      and contract_start.game_year <= v_current_season.game_year
      and contract.salary_per_season = 0
      and not exists (
        select 1
        from public.rider_contracts as successor
        where successor.rider_id = contract.rider_id
          and successor.start_season_id = v_next_season_id
          and successor.status in ('planned', 'active')
          and successor.id <> contract.id
      )
    order by contract.id
    for update of contract
  loop
    v_renewal_id := null;

    insert into public.rider_contracts (
      rider_id,
      team_id,
      start_season_id,
      end_season_id,
      salary_per_season,
      currency,
      currency_code,
      status,
      signed_at,
      acquisition_type
    )
    values (
      v_contract.rider_id,
      v_contract.team_id,
      v_next_season_id,
      v_next_season_id,
      public.calculate_rider_season_salary(
        v_contract.rider_id,
        v_next_season_id
      ),
      v_contract.currency,
      v_contract.currency_code,
      'planned',
      now(),
      'renewal'
    )
    on conflict (rider_id, team_id, start_season_id)
    do update set
      end_season_id = excluded.end_season_id,
      salary_per_season = excluded.salary_per_season,
      currency = excluded.currency,
      currency_code = excluded.currency_code,
      status = 'planned',
      signed_at = excluded.signed_at,
      acquisition_type = 'renewal',
      left_season_id = null,
      left_day_number = null
    where rider_contracts.status = 'cancelled'
    returning id into v_renewal_id;

    if v_renewal_id is not null then
      update public.rider_contracts
      set end_season_id = v_current_season.id
      where id = v_contract.id;
    end if;
  end loop;
end;
$$;

revoke all on function public.renew_current_team_rider(uuid)
from public, anon;

grant execute on function public.renew_current_team_rider(uuid)
to authenticated;

revoke all on function public.renew_all_current_team_riders()
from public, anon;

grant execute on function public.renew_all_current_team_riders()
to authenticated, service_role;

comment on function public.renew_all_current_team_riders() is
  'Crée atomiquement les contrats S2 avec leur salaire recalculé, sans reprovisionner la saison pour chaque coureur.';

notify pgrst, 'reload schema';

commit;
