begin;

-- Les convocations des championnats continentaux professionnels de S3 n'ont
-- pas fonctionné de manière homogène. Les résultats, victoires et titres sont
-- conservés, mais aucun participant ne doit recevoir de gain économique ou de
-- progression sur les dix épreuves (route et CLM).

alter function public.apply_race_roster_competition_reward(
  text, text, uuid, uuid, integer, integer, numeric, integer, boolean, text
)
rename to apply_race_roster_competition_reward_before_s3_continental_void;

revoke all on function
  public.apply_race_roster_competition_reward_before_s3_continental_void(
    text, text, uuid, uuid, integer, integer, numeric, integer, boolean, text
  )
from public, anon, authenticated;
grant execute on function
  public.apply_race_roster_competition_reward_before_s3_continental_void(
    text, text, uuid, uuid, integer, integer, numeric, integer, boolean, text
  )
to service_role;

create function public.apply_race_roster_competition_reward(
  p_source_reference text,
  p_source_type text,
  p_race_roster_id uuid,
  p_stage_id uuid,
  p_reputation_points integer,
  p_experience_points integer,
  p_cash_prize numeric,
  p_uci_points integer,
  p_is_victory boolean,
  p_description text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_void_rewards boolean;
begin
  select exists (
    select 1
    from public.race_rosters as roster
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    join public.race_editions as edition
      on edition.id = registration.race_edition_id
    join public.seasons as season
      on season.id = edition.season_id
     and season.game_year = 3
    join public.races as race
      on race.id = edition.race_id
     and race.competition_type = 'continental_championship'
    where roster.id = p_race_roster_id
  ) into v_void_rewards;

  return public.apply_race_roster_competition_reward_before_s3_continental_void(
    p_source_reference,
    p_source_type,
    p_race_roster_id,
    p_stage_id,
    case when v_void_rewards then 0 else p_reputation_points end,
    case when v_void_rewards then 0 else p_experience_points end,
    case when v_void_rewards then 0::numeric else p_cash_prize end,
    case when v_void_rewards then 0 else p_uci_points end,
    p_is_victory,
    case when v_void_rewards
      then btrim(p_description) || ' · gains neutralisés en S3'
      else p_description
    end
  );
end;
$$;

revoke all on function public.apply_race_roster_competition_reward(
  text, text, uuid, uuid, integer, integer, numeric, integer, boolean, text
) from public, anon, authenticated;
grant execute on function public.apply_race_roster_competition_reward(
  text, text, uuid, uuid, integer, integer, numeric, integer, boolean, text
) to service_role;

alter function public.apply_detection_rider_competition_reward(
  text, text, uuid, uuid, integer, boolean, text
)
rename to apply_detection_rider_competition_reward_before_s3_continental_;

revoke all on function
  public.apply_detection_rider_competition_reward_before_s3_continental_(
    text, text, uuid, uuid, integer, boolean, text
  )
from public, anon, authenticated;
grant execute on function
  public.apply_detection_rider_competition_reward_before_s3_continental_(
    text, text, uuid, uuid, integer, boolean, text
  )
to service_role;

create function public.apply_detection_rider_competition_reward(
  p_source_reference text,
  p_source_type text,
  p_race_roster_id uuid,
  p_stage_id uuid,
  p_uci_points integer,
  p_is_victory boolean,
  p_description text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_void_rewards boolean;
begin
  select exists (
    select 1
    from public.race_rosters as roster
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    join public.race_editions as edition
      on edition.id = registration.race_edition_id
    join public.seasons as season
      on season.id = edition.season_id
     and season.game_year = 3
    join public.races as race
      on race.id = edition.race_id
     and race.competition_type = 'continental_championship'
    where roster.id = p_race_roster_id
  ) into v_void_rewards;

  return public.apply_detection_rider_competition_reward_before_s3_continental_(
    p_source_reference,
    p_source_type,
    p_race_roster_id,
    p_stage_id,
    case when v_void_rewards then 0 else p_uci_points end,
    p_is_victory,
    case when v_void_rewards
      then btrim(p_description) || ' · gains neutralisés en S3'
      else p_description
    end
  );
end;
$$;

revoke all on function public.apply_detection_rider_competition_reward(
  text, text, uuid, uuid, integer, boolean, text
) from public, anon, authenticated;
grant execute on function public.apply_detection_rider_competition_reward(
  text, text, uuid, uuid, integer, boolean, text
) to service_role;

create function public.prevent_s3_continental_sponsor_gain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_type = 'race_result'
    and exists (
      select 1
      from public.race_editions as edition
      join public.seasons as season
        on season.id = edition.season_id
       and season.game_year = 3
      join public.races as race
        on race.id = edition.race_id
       and race.competition_type = 'continental_championship'
      where edition.id = new.race_edition_id
    )
  then
    return null;
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_s3_continental_sponsor_gain()
from public, anon, authenticated;
grant execute on function public.prevent_s3_continental_sponsor_gain()
to service_role;

create trigger prevent_s3_continental_sponsor_gain
before insert on public.sponsor_satisfaction_events
for each row execute function public.prevent_s3_continental_sponsor_gain();

-- Régularisation défensive : si un ancien déploiement a versé des gains entre
-- l'audit et cette migration, ils sont retirés exactement une fois.
create temporary table s3_continental_reward_voids on commit drop as
select
  reward.*,
  edition.id as race_edition_id,
  edition.season_id
from public.reward_events as reward
join public.race_editions as edition
  on reward.source_reference like '%' || edition.id::text || '%'
join public.seasons as season
  on season.id = edition.season_id
 and season.game_year = 3
join public.races as race
  on race.id = edition.race_id
 and race.competition_type = 'continental_championship'
where reward.reputation_points > 0
   or reward.experience_points > 0
   or reward.cash_prize > 0
   or reward.uci_points > 0;

update public.sporting_directors as director
set
  reputation_points = greatest(
    0,
    director.reputation_points - correction.reputation_points
  ),
  experience_points = greatest(
    0,
    director.experience_points - correction.experience_points
  )
from (
  select
    sporting_director_id,
    sum(reputation_points)::integer as reputation_points,
    sum(experience_points)::integer as experience_points
  from s3_continental_reward_voids
  where sporting_director_id is not null
  group by sporting_director_id
) as correction
where director.id = correction.sporting_director_id;

update public.team_seasons as team_season
set
  points = greatest(0, team_season.points - correction.uci_points),
  cash_balance = team_season.cash_balance - correction.cash_prize
from (
  select
    team_season_id,
    sum(uci_points)::integer as uci_points,
    sum(cash_prize)::numeric as cash_prize
  from s3_continental_reward_voids
  where team_season_id is not null
  group by team_season_id
) as correction
where team_season.id = correction.team_season_id;

update public.rider_season_summaries as summary
set
  points = greatest(0, coalesce(summary.points, 0) - correction.uci_points),
  updated_at = now()
from (
  select
    rider_id,
    season_id,
    sum(uci_points)::integer as uci_points
  from s3_continental_reward_voids
  where rider_id is not null
  group by rider_id, season_id
) as correction
where summary.rider_id = correction.rider_id
  and summary.season_id = correction.season_id;

insert into public.team_finance_transactions (
  team_season_id,
  season_day_id,
  day_number,
  amount,
  category,
  status,
  description,
  source_reference,
  posted_at
)
select
  reward.team_season_id,
  coalesce(original.season_day_id, final_day.id),
  coalesce(original.day_number, final_day.day_number),
  -reward.cash_prize,
  'race_prize',
  'posted',
  'Annulation équitable des gains des championnats continentaux de S3',
  'void-s3-continental-reward:' || reward.id::text || ':v1',
  now()
from s3_continental_reward_voids as reward
left join public.team_finance_transactions as original
  on original.team_season_id = reward.team_season_id
 and original.source_reference = 'reward:' || reward.source_reference
join lateral (
  select day.id, day.day_number
  from public.stages as stage
  join public.season_days as day on day.id = stage.season_day_id
  where stage.race_edition_id = reward.race_edition_id
  order by stage.stage_number desc
  limit 1
) as final_day on true
where reward.team_season_id is not null
  and reward.cash_prize > 0
on conflict (team_season_id, source_reference) do nothing;

update public.reward_events as reward
set
  reputation_points = 0,
  experience_points = 0,
  cash_prize = 0,
  uci_points = 0,
  description = reward.description || ' · gains neutralisés en S3'
from s3_continental_reward_voids as voided
where reward.id = voided.id;

delete from public.sponsor_satisfaction_events as event
using public.race_editions as edition,
  public.seasons as season,
  public.races as race
where event.race_edition_id = edition.id
  and season.id = edition.season_id
  and season.game_year = 3
  and race.id = edition.race_id
  and race.competition_type = 'continental_championship'
  and event.event_type = 'race_result';

do $$
declare
  v_edition_id uuid;
begin
  for v_edition_id in
    select edition.id
    from public.race_editions as edition
    join public.seasons as season
      on season.id = edition.season_id
     and season.game_year = 3
    join public.races as race
      on race.id = edition.race_id
     and race.competition_type = 'continental_championship'
  loop
    perform public.refresh_race_edition_uci_rankings(v_edition_id);
  end loop;
end;
$$;

comment on function public.apply_race_roster_competition_reward(
  text, text, uuid, uuid, integer, integer, numeric, integer, boolean, text
) is
  'Attribue les gains officiels, neutralisés pour les championnats continentaux professionnels de S3 tout en conservant les victoires.';

comment on function public.apply_detection_rider_competition_reward(
  text, text, uuid, uuid, integer, boolean, text
) is
  'Attribue le palmarès des coureurs de détection, sans points UCI sur les championnats continentaux professionnels de S3.';

commit;
