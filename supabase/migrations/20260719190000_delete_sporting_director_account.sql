begin;

-- ============================================================
-- SUPPRESSION DÉFINITIVE D'UNE CARRIÈRE
--
-- La suppression conserve les coureurs, qui deviennent agents libres,
-- ainsi que les sponsors. L'équipe, ses contrats, ses inscriptions et
-- le profil du Directeur Sportif sont supprimés atomiquement.
--
-- Les résultats sportifs constituent une archive publique : si la
-- carrière en possède déjà, la suppression destructive est refusée.
-- Une future mécanique de retraite/archivage prendra alors le relais.
-- ============================================================

create or replace function public.delete_current_sporting_director_account()
returns table (
  deleted_team_count integer,
  released_rider_count integer,
  released_sponsor_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_sporting_director_id uuid;
  v_team_ids uuid[] := array[]::uuid[];
  v_rider_ids uuid[] := array[]::uuid[];
  v_team_count integer := 0;
  v_rider_count integer := 0;
  v_sponsor_count integer := 0;
begin
  if v_auth_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez être connecté pour supprimer votre compte.';
  end if;

  select director.id
  into v_sporting_director_id
  from public.sporting_directors as director
  where director.auth_user_id = v_auth_user_id
  for update;

  -- Rend la fonction réessayable si la suppression métier a réussi mais
  -- que la suppression du compte Auth doit être relancée par le serveur.
  if not found then
    return query select 0, 0, 0;
    return;
  end if;

  select coalesce(
    array_agg(distinct owned_team.team_id),
    array[]::uuid[]
  )
  into v_team_ids
  from (
    select generation.team_id
    from public.initial_career_generations as generation
    where generation.sporting_director_id = v_sporting_director_id

    union

    select assignment.team_id
    from public.team_manager_assignments as assignment
    where assignment.sporting_director_id = v_sporting_director_id
      and assignment.role = 'general_manager'
      and assignment.status = 'active'
  ) as owned_team;

  v_team_count := cardinality(v_team_ids);

  if exists (
    select 1
    from public.team_seasons as team_season
    join public.race_registrations as registration
      on registration.team_season_id = team_season.id
    join public.race_rosters as roster
      on roster.race_registration_id = registration.id
    where team_season.team_id = any(v_team_ids)
      and (
        exists (
          select 1
          from public.stage_results as stage_result
          where stage_result.race_roster_id = roster.id
        )
        or exists (
          select 1
          from public.race_results as race_result
          where race_result.race_roster_id = roster.id
        )
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Cette carrière possède des résultats officiels et doit être archivée plutôt que supprimée.';
  end if;

  select coalesce(
    array_agg(distinct contract.rider_id),
    array[]::uuid[]
  )
  into v_rider_ids
  from public.rider_contracts as contract
  where contract.team_id = any(v_team_ids);

  v_rider_count := cardinality(v_rider_ids);

  select count(distinct contract.sponsor_id)::integer
  into v_sponsor_count
  from public.team_sponsor_contracts as contract
  where contract.team_id = any(v_team_ids);

  -- Supprimer les contrats libère les équipes et les sponsors sans
  -- toucher aux référentiels permanents riders/sponsors.
  delete from public.rider_contracts
  where team_id = any(v_team_ids);

  update public.riders as rider
  set status = 'free_agent'
  where rider.id = any(v_rider_ids)
    and not exists (
      select 1
      from public.rider_contracts as remaining_contract
      where remaining_contract.rider_id = rider.id
        and remaining_contract.status = 'active'
    );

  delete from public.team_sponsor_contracts
  where team_id = any(v_team_ids);

  delete from public.initial_career_generations
  where sporting_director_id = v_sporting_director_id
     or team_id = any(v_team_ids);

  delete from public.team_manager_assignments
  where sporting_director_id = v_sporting_director_id
     or team_id = any(v_team_ids);

  delete from public.teams
  where id = any(v_team_ids);

  -- Les offres destinées au joueur sont supprimées par leur FK cascade.
  delete from public.sporting_directors
  where id = v_sporting_director_id;

  return query
  select v_team_count, v_rider_count, v_sponsor_count;
end;
$$;

revoke all
on function public.delete_current_sporting_director_account()
from public, anon;

grant execute
on function public.delete_current_sporting_director_account()
to authenticated;

comment on function public.delete_current_sporting_director_account() is
  'Supprime atomiquement la carrière du joueur authentifié, libère ses coureurs et ses sponsors, et conserve les référentiels permanents.';

notify pgrst, 'reload schema';

commit;
