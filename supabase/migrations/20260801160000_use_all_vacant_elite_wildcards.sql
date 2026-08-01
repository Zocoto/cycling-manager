begin;

-- Une course Elite peut accueillir jusqu'a field_limit equipes. Les equipes
-- Elite deja inscrites restent prioritaires ; chaque place qu'elles
-- n'occupent pas devient disponible pour une Wild Card. Le plafond historique
-- de quatre invitations est donc supprime.
create or replace function public.settle_due_elite_wildcards()
returns table (
  processed_editions integer,
  accepted_requests integer,
  rejected_requests integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_edition record;
  v_candidate record;
  v_available_places integer;
  v_rank integer;
  v_processed_editions integer := 0;
  v_accepted_requests integer := 0;
  v_rejected_requests integer := 0;
  v_decision text;
begin
  for v_edition in
    select
      edition.id,
      edition.display_name,
      edition.field_limit,
      edition.season_id,
      race.country_id as race_country_id
    from public.race_editions as edition
    join public.race_categories as category
      on category.id = edition.race_category_id
     and category.code = 'elite'
    join public.races as race on race.id = edition.race_id
    where edition.wildcard_closes_at is not null
      and edition.wildcard_closes_at <= now()
      and edition.status not in ('completed', 'cancelled')
      and exists (
        select 1
        from public.race_registrations as registration
        where registration.race_edition_id = edition.id
          and registration.status = 'pending'
      )
    order by edition.wildcard_closes_at, edition.id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_edition.id::text, 0)
    );

    -- Les inscriptions acceptees comprennent d'abord les equipes Elite, puis
    -- les eventuelles invitations deja garanties. Toutes les autres places
    -- du plateau sont octroyables, sans plafond arbitraire de quatre WC.
    select greatest(
      coalesce(v_edition.field_limit, 24) - count(*)::integer,
      0
    )
    into v_available_places
    from public.race_registrations as registration
    where registration.race_edition_id = v_edition.id
      and registration.status = 'accepted';

    v_rank := 0;

    for v_candidate in
      with scored_candidates as (
        select
          registration.id as registration_id,
          registration.team_season_id,
          registration.registered_at,
          team_season.registration_country_id = v_edition.race_country_id
            as team_country_match,
          coalesce(sponsor.country_id = v_edition.race_country_id, false)
            as sponsor_country_match,
          coalesce(director.reputation_points, 0)::integer
            as reputation_points,
          coalesce(performance.best_profile_fit, 0)::numeric(6, 2)
            as best_rider_profile_fit
        from public.race_registrations as registration
        join public.team_seasons as team_season
          on team_season.id = registration.team_season_id
        left join lateral (
          select sponsor_row.country_id
          from public.team_sponsor_contracts as contract
          join public.sponsors as sponsor_row
            on sponsor_row.id = contract.sponsor_id
          join public.seasons as current_season
            on current_season.id = v_edition.season_id
          join public.seasons as start_season
            on start_season.id = contract.start_season_id
           and start_season.game_year <= current_season.game_year
          join public.seasons as end_season
            on end_season.id = contract.end_season_id
           and end_season.game_year >= current_season.game_year
          where contract.team_id = team_season.team_id
            and contract.role = 'principal'
            and contract.status in ('active', 'planned')
          order by
            case contract.status when 'active' then 0 else 1 end,
            contract.created_at desc
          limit 1
        ) as sponsor on true
        left join lateral (
          select sporting_director.reputation_points
          from public.team_manager_assignments as assignment
          join public.sporting_directors as sporting_director
            on sporting_director.id = assignment.sporting_director_id
          where assignment.team_id = team_season.team_id
            and assignment.role = 'general_manager'
            and assignment.status = 'active'
          limit 1
        ) as director on true
        left join lateral (
          select max(rider_score.profile_fit) as best_profile_fit
          from (
            select
              roster.rider_id,
              avg(
                case stage.profile_type
                  when 'mountain' then rating.mountain
                  when 'hilly' then rating.hills
                  when 'cobbles' then rating.cobbles
                  when 'time_trial' then rating.time_trial
                  when 'sprint' then rating.sprint
                  when 'flat' then (rating.flat + rating.sprint) / 2.0
                  else (
                    rating.mountain
                    + rating.hills
                    + rating.flat
                    + rating.time_trial
                    + rating.cobbles
                    + rating.sprint
                  ) / 6.0
                end
              ) as profile_fit
            from public.race_rosters as roster
            join public.rider_season_ratings as rating
              on rating.rider_id = roster.rider_id
             and rating.season_id = v_edition.season_id
            cross join public.stages as stage
            where roster.race_registration_id = registration.id
              and roster.status in ('selected', 'confirmed')
              and stage.race_edition_id = v_edition.id
            group by roster.rider_id
          ) as rider_score
        ) as performance on true
        where registration.race_edition_id = v_edition.id
          and registration.status = 'pending'
      )
      select
        candidate.*,
        (
          case when candidate.team_country_match then 250 else 0 end
          + case when candidate.sponsor_country_match then 150 else 0 end
          + least(greatest(candidate.reputation_points, 0), 1000) * 0.25
          + candidate.best_rider_profile_fit * 5
        )::numeric(10, 2) as selection_score
      from scored_candidates as candidate
      order by
        selection_score desc,
        candidate.registered_at,
        candidate.registration_id
    loop
      v_rank := v_rank + 1;
      v_decision := case
        when v_rank <= v_available_places then 'accepted'
        else 'rejected'
      end;

      if v_decision = 'accepted' then
        update public.race_registrations
        set
          status = 'accepted',
          entry_method = 'invited',
          decided_at = now()
        where id = v_candidate.registration_id
          and status = 'pending';

        v_accepted_requests := v_accepted_requests + 1;
      else
        update public.race_registrations
        set
          status = 'rejected',
          decided_at = now()
        where id = v_candidate.registration_id
          and status = 'pending';

        update public.race_rosters
        set status = 'withdrawn'
        where race_registration_id = v_candidate.registration_id
          and status in ('selected', 'confirmed');

        v_rejected_requests := v_rejected_requests + 1;
      end if;

      insert into public.elite_wildcard_decisions (
        race_registration_id,
        race_edition_id,
        team_season_id,
        decision,
        team_country_match,
        sponsor_country_match,
        reputation_points,
        best_rider_profile_fit,
        selection_score,
        title,
        message,
        decided_at
      )
      values (
        v_candidate.registration_id,
        v_edition.id,
        v_candidate.team_season_id,
        v_decision,
        v_candidate.team_country_match,
        v_candidate.sponsor_country_match,
        v_candidate.reputation_points,
        v_candidate.best_rider_profile_fit,
        v_candidate.selection_score,
        'Reponse de l''organisateur : ' || v_edition.display_name,
        case v_decision
          when 'accepted' then 'Wild Card octroyee.'
          else 'Wild Card refusee. Les creneaux des coureurs proposes ont ete liberes.'
        end,
        now()
      )
      on conflict (race_registration_id)
      do nothing;
    end loop;

    if v_rank > 0 then
      v_processed_editions := v_processed_editions + 1;
    end if;
  end loop;

  return query
  select
    v_processed_editions,
    v_accepted_requests,
    v_rejected_requests;
end;
$$;

revoke all
on function public.settle_due_elite_wildcards()
from public, anon;

grant execute
on function public.settle_due_elite_wildcards()
to authenticated, service_role;

comment on function public.settle_due_elite_wildcards() is
  'Arbitre a J-1 toutes les places Elite encore libres : les equipes Elite inscrites sont prioritaires et chaque absence ouvre une Wild Card supplementaire.';

-- Les decisions de Ruta de las Sierras et de la Classique des Lacs ont deja
-- ete prises en saison 1 avec l'ancien plafond. On promeut les refus dans
-- l'ordre du classement initial, sans jamais depasser les 24 places.
create temporary table repaired_elite_wildcards (
  registration_id uuid primary key,
  race_edition_id uuid not null
) on commit drop;

with target_editions as (
  select
    edition.id as race_edition_id,
    greatest(
      coalesce(edition.field_limit, 24)
        - count(registration.id) filter (
            where registration.status = 'accepted'
          )::integer,
      0
    ) as available_places
  from public.race_editions as edition
  join public.races as race
    on race.id = edition.race_id
   and race.slug in ('ruta-de-las-sierras', 'classique-des-lacs')
  join public.seasons as season
    on season.id = edition.season_id
   and season.game_year = 1
  left join public.race_registrations as registration
    on registration.race_edition_id = edition.id
  where edition.status not in ('in_progress', 'completed', 'cancelled')
    and exists (
      select 1
      from public.stages as stage
      where stage.race_edition_id = edition.id
        and stage.status = 'planned'
        and stage.departure_at > now()
    )
  group by edition.id, edition.field_limit
), ranked_rejections as (
  select
    registration.id as registration_id,
    target.race_edition_id,
    target.available_places,
    row_number() over (
      partition by target.race_edition_id
      order by
        decision.selection_score desc,
        registration.registered_at,
        registration.id
    ) as invitation_rank
  from target_editions as target
  join public.race_registrations as registration
    on registration.race_edition_id = target.race_edition_id
   and registration.status = 'rejected'
  join public.elite_wildcard_decisions as decision
    on decision.race_registration_id = registration.id
   and decision.decision = 'rejected'
)
insert into repaired_elite_wildcards (
  registration_id,
  race_edition_id
)
select
  rejected.registration_id,
  rejected.race_edition_id
from ranked_rejections as rejected
where rejected.invitation_rank <= rejected.available_places;

update public.race_registrations as registration
set
  status = 'accepted',
  entry_method = 'invited',
  decided_at = now()
from repaired_elite_wildcards as repaired
where registration.id = repaired.registration_id;

-- Le refus automatique avait retire toute la composition. On restaure les
-- coureurs encore disponibles. Un coureur blesse, parti en stage de forme ou
-- engage depuis sur une course concurrente reste retire et devra etre remplace.
update public.race_rosters as roster
set status = 'confirmed'
from repaired_elite_wildcards as repaired
where roster.race_registration_id = repaired.registration_id
  and roster.status = 'withdrawn'
  and roster.withdrawn_by_injury_id is null
  and not exists (
    select 1
    from public.rider_injuries as injury
    join public.stages as stage
      on stage.race_edition_id = repaired.race_edition_id
    join public.season_days as day
      on day.id = stage.season_day_id
    where injury.rider_id = roster.rider_id
      and injury.started_at < coalesce(
        stage.departure_at,
        ((day.calendar_date::timestamp + time '12:00') at time zone 'Europe/Paris')
      ) + interval '8 hours'
      and injury.expected_recovery_at > coalesce(
        stage.departure_at,
        ((day.calendar_date::timestamp + time '12:00') at time zone 'Europe/Paris')
      )
  )
  and not exists (
    select 1
    from public.rider_form_camps as camp
    join public.race_editions as edition
      on edition.id = repaired.race_edition_id
    join public.stages as stage
      on stage.race_edition_id = edition.id
    join public.season_days as day
      on day.id = stage.season_day_id
    where camp.rider_id = roster.rider_id
      and camp.season_id = edition.season_id
      and camp.status <> 'cancelled'
      and day.day_number between camp.start_day_number and camp.end_day_number
  )
  and not exists (
    select 1
    from public.race_rosters as other_roster
    join public.race_registrations as other_registration
      on other_registration.id = other_roster.race_registration_id
     and other_registration.status in ('accepted', 'pending')
    where other_roster.rider_id = roster.rider_id
      and other_roster.status in ('selected', 'confirmed')
      and other_registration.race_edition_id <> repaired.race_edition_id
      and exists (
        select 1
        from public.stages as target_stage
        join public.stages as other_stage
          on other_stage.season_day_id = target_stage.season_day_id
         and other_stage.race_edition_id = other_registration.race_edition_id
        where target_stage.race_edition_id = repaired.race_edition_id
      )
  );

update public.elite_wildcard_decisions as decision
set
  decision = 'accepted',
  title = 'Reponse corrigee de l''organisateur',
  message = 'Wild Card octroyee : toutes les places laissees libres par les equipes Elite sont ouvertes aux invitations.',
  decided_at = now()
from repaired_elite_wildcards as repaired
where decision.race_registration_id = repaired.registration_id;

commit;
