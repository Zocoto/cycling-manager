begin;

-- Les Mondiaux S1 restent strictement inchanges. On deduit uniquement les
-- titres route et CLM des resultats officiels deja enregistres.
with world_winners as (
  select
    roster.rider_id,
    rider.country_id,
    edition.season_id,
    edition.id as race_edition_id,
    case
      when exists (
        select 1
        from public.stages as stage
        where stage.race_edition_id = edition.id
          and stage.stage_type in (
            'individual_time_trial',
            'team_time_trial',
            'prologue'
          )
      ) then 'world_time_trial'
      else 'world_road'
    end as championship_type,
    result.updated_at as won_at,
    row_number() over (
      partition by case
        when exists (
          select 1
          from public.stages as stage
          where stage.race_edition_id = edition.id
            and stage.stage_type in (
              'individual_time_trial',
              'team_time_trial',
              'prologue'
            )
        ) then 'world_time_trial'
        else 'world_road'
      end
      order by season.game_year desc, result.updated_at desc, edition.id desc
    ) as recency_rank
  from public.race_results as result
  join public.race_rosters as roster
    on roster.id = result.race_roster_id
  join public.riders as rider
    on rider.id = roster.rider_id
  join public.race_editions as edition
    on edition.id = result.race_edition_id
  join public.seasons as season
    on season.id = edition.season_id
  join public.races as race
    on race.id = edition.race_id
   and race.competition_type = 'world_championship'
  where result.status = 'classified'
    and result.final_rank = 1
)
insert into public.rider_national_championship_titles (
  rider_id,
  country_id,
  season_id,
  race_edition_id,
  championship_type,
  won_at,
  relinquished_at
)
select
  winner.rider_id,
  winner.country_id,
  winner.season_id,
  winner.race_edition_id,
  winner.championship_type,
  winner.won_at,
  case when winner.recency_rank = 1 then null else winner.won_at end
from world_winners as winner
on conflict (race_edition_id, championship_type)
do update set
  rider_id = excluded.rider_id,
  country_id = excluded.country_id,
  season_id = excluded.season_id,
  won_at = excluded.won_at,
  relinquished_at = excluded.relinquished_at;

-- Le meme mecanisme s'applique aux prochaines saisons. Il ne simule rien :
-- il reagit uniquement a l'enregistrement d'un vainqueur officiel.
create or replace function public.assign_world_championship_title()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rider_id uuid;
  v_country_id uuid;
  v_season_id uuid;
  v_competition_type text;
  v_championship_type text;
begin
  if new.status <> 'classified' or new.final_rank <> 1 then
    return new;
  end if;

  select
    roster.rider_id,
    rider.country_id,
    edition.season_id,
    race.competition_type,
    case
      when exists (
        select 1
        from public.stages as stage
        where stage.race_edition_id = edition.id
          and stage.stage_type in (
            'individual_time_trial',
            'team_time_trial',
            'prologue'
          )
      ) then 'world_time_trial'
      else 'world_road'
    end
  into
    v_rider_id,
    v_country_id,
    v_season_id,
    v_competition_type,
    v_championship_type
  from public.race_rosters as roster
  join public.riders as rider on rider.id = roster.rider_id
  join public.race_editions as edition on edition.id = new.race_edition_id
  join public.races as race on race.id = edition.race_id
  where roster.id = new.race_roster_id;

  if v_competition_type <> 'world_championship' then
    return new;
  end if;

  update public.rider_national_championship_titles
  set relinquished_at = coalesce(relinquished_at, now())
  where championship_type = v_championship_type
    and relinquished_at is null
    and (
      rider_id <> v_rider_id
      or race_edition_id <> new.race_edition_id
    );

  insert into public.rider_national_championship_titles (
    rider_id,
    country_id,
    season_id,
    race_edition_id,
    championship_type,
    won_at,
    relinquished_at
  )
  values (
    v_rider_id,
    v_country_id,
    v_season_id,
    new.race_edition_id,
    v_championship_type,
    now(),
    null
  )
  on conflict (race_edition_id, championship_type)
  do update set
    rider_id = excluded.rider_id,
    country_id = excluded.country_id,
    season_id = excluded.season_id,
    won_at = excluded.won_at,
    relinquished_at = null;

  return new;
end;
$$;

commit;
