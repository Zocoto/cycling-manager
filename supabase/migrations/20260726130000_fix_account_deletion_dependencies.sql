begin;

-- Les archives sportives figent le nom amateur dans une simple colonne texte.
-- Elles ne conservent ainsi aucun lien vers l'équipe ou sa saison technique.
alter table public.race_registrations
  add column historical_team_name text,
  alter column team_season_id drop not null,
  add constraint race_registrations_team_identity_present
    check (
      (team_season_id is not null and historical_team_name is null)
      or (
        team_season_id is null
        and nullif(btrim(historical_team_name), '') is not null
      )
    );

alter table public.race_secondary_results
  add column historical_team_name text,
  drop constraint race_secondary_results_competitor_matches_type,
  add constraint race_secondary_results_competitor_matches_type
    check (
      (
        classification_type = 'team'
        and race_roster_id is null
        and (
          (team_season_id is not null and historical_team_name is null)
          or (
            team_season_id is null
            and nullif(btrim(historical_team_name), '') is not null
          )
        )
      )
      or (
        classification_type <> 'team'
        and race_roster_id is not null
        and team_season_id is null
        and historical_team_name is null
      )
    );

comment on column public.race_registrations.historical_team_name is
  'Nom amateur figé quand une équipe supprimée possède des résultats officiels.';

comment on column public.race_secondary_results.historical_team_name is
  'Nom amateur figé pour un classement par équipes dont le profil a été supprimé.';

-- La procédure initiale précédait les modules transferts, staff, centre de
-- formation et soins. Leurs clés étrangères restrictives empêchaient ensuite
-- la suppression de l'équipe. Cette version nettoie toutes les données propres
-- à la carrière avant de supprimer l'équipe et le Directeur Sportif.
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
  v_staff_contract_ids uuid[] := array[]::uuid[];
  v_owned_team record;
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

  -- Rend la fonction réessayable si la carrière a été supprimée mais que le
  -- compte Auth doit encore être fermé par le serveur.
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

  -- Les inscriptions sans résultat ne constituent pas une archive sportive.
  -- Elles peuvent être supprimées avec le reste de la carrière.
  delete from public.race_registrations as registration
  using public.team_seasons as team_season
  where registration.team_season_id = team_season.id
    and team_season.team_id = any(v_team_ids)
    and not exists (
      select 1
      from public.race_rosters as roster
      where roster.race_registration_id = registration.id
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
          or exists (
            select 1
            from public.race_secondary_results as secondary_result
            where secondary_result.race_roster_id = roster.id
          )
        )
    )
    and not exists (
      select 1
      from public.race_secondary_results as secondary_result
      where secondary_result.team_season_id = team_season.id
        and secondary_result.race_edition_id = registration.race_edition_id
    );

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

  select coalesce(
    array_agg(contract.id),
    array[]::uuid[]
  )
  into v_staff_contract_ids
  from public.staff_contracts as contract
  where contract.team_id = any(v_team_ids);

  -- Retire d'abord les participations du joueur au marché des transferts.
  -- Une annonce de son équipe disparaît ; une annonce qu'il avait remportée
  -- redevient annulée afin de conserver la fiche du coureur partagé.
  delete from public.transfer_market_bids
  where team_id = any(v_team_ids)
     or sporting_director_id = v_sporting_director_id;

  delete from public.transfer_market_listings
  where seller_team_id = any(v_team_ids);

  update public.transfer_market_listings
  set
    status = 'cancelled',
    winning_team_id = null,
    winning_bid = null,
    settled_at = null
  where winning_team_id = any(v_team_ids);

  -- Supprime les données qui référencent un contrat de staff en RESTRICT
  -- avant de retirer ces contrats. Les membres du staff restent dans leur
  -- référentiel et leur ancienne annonce devient expirée.
  delete from public.youth_academy_riders as academy_rider
  where academy_rider.team_id = any(v_team_ids)
     or academy_rider.candidate_id in (
       select candidate.id
       from public.youth_scouting_candidates as candidate
       join public.youth_scouting_missions as mission
         on mission.id = candidate.mission_id
       where mission.scout_contract_id = any(v_staff_contract_ids)
     );

  delete from public.youth_scouting_missions
  where team_id = any(v_team_ids)
     or scout_contract_id = any(v_staff_contract_ids);

  delete from public.rider_nutrition_interventions
  where nutritionist_contract_id = any(v_staff_contract_ids);

  -- Ces tables utilisent ON DELETE RESTRICT vers la saison d'équipe. Elles
  -- contiennent des données de gestion privées qui ne font pas partie de
  -- l'archive sportive publique.
  delete from public.rider_injury_treatments as treatment
  using public.team_seasons as team_season
  where treatment.team_season_id = team_season.id
    and team_season.team_id = any(v_team_ids);

  delete from public.rider_consumable_item_applications as application
  using public.team_seasons as team_season
  where application.team_season_id = team_season.id
    and team_season.team_id = any(v_team_ids);

  delete from public.game_objective_claims
  where sporting_director_id = v_sporting_director_id;

  delete from public.staff_contracts
  where id = any(v_staff_contract_ids);

  update public.staff_market_listings
  set
    status = 'expired',
    hired_team_id = null,
    hired_at = null
  where hired_team_id = any(v_team_ids);

  -- Supprimer les contrats libère les coureurs et les sponsors sans toucher
  -- à leurs référentiels permanents.
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

  -- Une inscription possédant des résultats officiels conserve uniquement le
  -- nom amateur comme texte. Les lignes de résultats restent attachées à leur
  -- inscription et à leurs coureurs, sans équipe ni saison d'équipe persistante.
  for v_owned_team in
    select
      team.id,
      coalesce(
        nullif(btrim(team.amateur_name), ''),
        'Équipe amateur supprimée '
          || upper(left(replace(team.id::text, '-', ''), 8))
      ) as history_name
    from public.teams as team
    where team.id = any(v_team_ids)
  loop
    update public.race_registrations as registration
    set
      team_season_id = null,
      historical_team_name = v_owned_team.history_name,
      status = 'withdrawn',
      decided_at = coalesce(registration.decided_at, now())
    where registration.team_season_id in (
      select team_season.id
      from public.team_seasons as team_season
      where team_season.team_id = v_owned_team.id
    )
      and (
        exists (
          select 1
          from public.race_rosters as roster
          where roster.race_registration_id = registration.id
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
              or exists (
                select 1
                from public.race_secondary_results as secondary_result
                where secondary_result.race_roster_id = roster.id
              )
            )
        )
        or exists (
          select 1
          from public.race_secondary_results as secondary_result
          where secondary_result.team_season_id = registration.team_season_id
            and secondary_result.race_edition_id = registration.race_edition_id
        )
      );

    update public.race_secondary_results as secondary_result
    set
      team_season_id = null,
      historical_team_name = v_owned_team.history_name
    where secondary_result.team_season_id in (
      select team_season.id
      from public.team_seasons as team_season
      where team_season.team_id = v_owned_team.id
    );
  end loop;

  -- La cascade supprime désormais les saisons d'équipe et toutes leurs données
  -- de gestion ; seules les colonnes texte ci-dessus survivent dans l'archive.
  delete from public.teams
  where id = any(v_team_ids);

  -- Les offres, objectifs, messages et progressions de tutoriel propres au
  -- joueur sont supprimés par leurs clés étrangères en cascade.
  delete from public.sporting_directors
  where id = v_sporting_director_id;

  return query
  select v_team_count, v_rider_count, v_sponsor_count;
end;
$$;

create or replace function public.get_race_past_winners(
  p_race_id uuid
)
returns table (
  game_year integer,
  season_name text,
  final_rank integer,
  rider_id uuid,
  rider_first_name text,
  rider_last_name text,
  team_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    season.game_year,
    season.name,
    result.final_rank,
    rider.id,
    rider.first_name,
    rider.last_name,
    coalesce(team_season.display_name, registration.historical_team_name)
  from public.race_editions as edition
  join public.seasons as season
    on season.id = edition.season_id
  join public.race_results as result
    on result.race_edition_id = edition.id
   and result.final_rank between 1 and 3
   and result.status = 'classified'
  join public.race_rosters as roster
    on roster.id = result.race_roster_id
  join public.riders as rider
    on rider.id = roster.rider_id
  join public.race_registrations as registration
    on registration.id = roster.race_registration_id
  left join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  where edition.race_id = p_race_id
    and edition.status = 'completed'
  order by season.game_year desc, result.final_rank;
$$;

revoke all
on function public.get_race_past_winners(uuid)
from public, anon;

grant execute
on function public.get_race_past_winners(uuid)
to authenticated;

revoke all
on function public.delete_current_sporting_director_account()
from public, anon;

grant execute
on function public.delete_current_sporting_director_account()
to authenticated;

comment on function public.delete_current_sporting_director_account() is
  'Supprime atomiquement la carrière et son équipe, libère les référentiels partagés et conserve uniquement le nom amateur comme texte dans les résultats officiels.';

notify pgrst, 'reload schema';

commit;
