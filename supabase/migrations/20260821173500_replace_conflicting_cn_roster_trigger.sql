begin;

-- Le garde-fou ligne par ligne pouvait modifier une ligne déjà visée par un
-- INSERT ... ON CONFLICT exécuté pendant la synchronisation des CN. Postgres
-- rejetait alors toute la transaction avec SQLSTATE 21000. Le nettoyage est
-- désormais explicite, groupé et rejouable après chaque synchronisation.
drop trigger if exists enforce_unique_active_rider_per_race_edition
on public.race_rosters;

drop function if exists public.enforce_unique_active_rider_per_race_edition();

create or replace function public.cleanup_duplicate_national_championship_rosters(
  p_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_withdrawn integer := 0;
begin
  with ranked_rosters as (
    select
      roster.id,
      row_number() over (
        partition by edition.id, roster.rider_id
        order by
          (
            registration.team_season_id
              is not distinct from ranking.team_season_id
          ) desc,
          roster.selected_at desc,
          roster.id desc
      ) as active_rank
    from public.race_editions as edition
    join public.races as race
      on race.id = edition.race_id
     and race.competition_type in (
       'national_road',
       'national_time_trial'
     )
    join public.race_registrations as registration
      on registration.race_edition_id = edition.id
     and registration.status = 'accepted'
    join public.race_rosters as roster
      on roster.race_registration_id = registration.id
     and roster.status in ('selected', 'confirmed')
    left join public.get_national_championship_country_rankings(p_season_id)
      as ranking
      on ranking.rider_id = roster.rider_id
    where edition.season_id = p_season_id
      and edition.status not in ('completed', 'cancelled')
  )
  update public.race_rosters as roster
  set status = 'withdrawn'
  from ranked_rosters as ranked
  where ranked.id = roster.id
    and ranked.active_rank > 1;

  get diagnostics v_withdrawn = row_count;

  update public.race_registrations as registration
  set
    status = 'withdrawn',
    decided_at = now()
  where registration.status = 'accepted'
    and registration.team_season_id is null
    and registration.historical_team_name = 'Coureurs libres'
    and exists (
      select 1
      from public.race_editions as edition
      join public.races as race
        on race.id = edition.race_id
       and race.competition_type in (
         'national_road',
         'national_time_trial'
       )
      where edition.id = registration.race_edition_id
        and edition.season_id = p_season_id
        and edition.status not in ('completed', 'cancelled')
    )
    and not exists (
      select 1
      from public.race_rosters as active_roster
      where active_roster.race_registration_id = registration.id
        and active_roster.status in ('selected', 'confirmed')
    );

  return v_withdrawn;
end;
$$;

revoke all
on function public.cleanup_duplicate_national_championship_rosters(uuid)
from public, anon, authenticated;

grant execute
on function public.cleanup_duplicate_national_championship_rosters(uuid)
to service_role;

comment on function public.cleanup_duplicate_national_championship_rosters(uuid)
  is 'Retire en une passe les anciennes doubles présences équipe/agents libres des CN non clôturés.';

-- Assainit aussi les éditions actives déjà créées avant ce correctif.
do $$
declare
  v_season_id uuid;
begin
  for v_season_id in
    select season.id
    from public.seasons as season
    where season.status = 'active'
  loop
    perform public.cleanup_duplicate_national_championship_rosters(v_season_id);
  end loop;
end;
$$;

commit;
