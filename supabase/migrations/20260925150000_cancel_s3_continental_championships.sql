begin;

-- Les convocations des championnats continentaux S3 n'ont pas ete envoyees
-- de facon fiable. L'ensemble de la campagne (pros et juniors, route et CLM)
-- est donc annulee : aucune course, aucun resultat, aucun titre et aucun gain.
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('cancel-s3-continental-championships', 0)
);

create temporary table s3_cc_editions on commit drop as
select edition.id
from public.race_editions as edition
join public.seasons as season
  on season.id = edition.season_id
 and season.game_year = 3
join public.races as race
  on race.id = edition.race_id
 and race.competition_type = 'continental_championship';

create temporary table s3_cc_stages on commit drop as
select stage.id, stage.season_day_id
from public.stages as stage
join s3_cc_editions as edition on edition.id = stage.race_edition_id;

create temporary table s3_cc_winners on commit drop as
select
  result.race_edition_id,
  roster.rider_id
from public.race_results as result
join s3_cc_editions as edition on edition.id = result.race_edition_id
join public.race_rosters as roster on roster.id = result.race_roster_id
where result.status = 'classified'
  and result.final_rank = 1;

create temporary table s3_cc_victory_deltas on commit drop as
select
  reward.rider_id,
  edition.season_id,
  count(*)::integer as victories
from public.reward_events as reward
join public.race_editions as edition
  on reward.source_reference like '%' || edition.id::text || '%'
join s3_cc_editions as affected on affected.id = edition.id
where reward.rider_id is not null
  and (
    reward.source_type = 'race_result'
    or (
      reward.source_type = 'stage_result'
      and reward.source_reference like '%:rank:1:%'
    )
  )
group by reward.rider_id, edition.season_id;

do $guard$
declare
  v_professional_editions integer;
  v_professional_stages integer;
  v_completed_winners integer;
  v_junior_editions integer;
  v_s2_titles integer;
begin
  select count(*)::integer into v_professional_editions from s3_cc_editions;
  select count(*)::integer into v_professional_stages from s3_cc_stages;
  select count(*)::integer into v_completed_winners from s3_cc_winners;
  select count(*)::integer into v_junior_editions
  from public.development_race_editions as edition
  join public.seasons as season
    on season.id = edition.season_id
   and season.game_year = 3
  where edition.competition_type in (
    'continental_road', 'continental_time_trial'
  );
  select count(*)::integer into v_s2_titles
  from public.rider_national_championship_titles as title
  join public.seasons as season
    on season.id = title.season_id
   and season.game_year = 2
  where title.championship_type like 'continental\_%' escape '\';

  if v_professional_editions <> 10
     or v_professional_stages <> 10
     or v_completed_winners <> 5
     or v_junior_editions <> 10
     or v_s2_titles <> 10 then
    raise exception using
      message = format(
        'S3 CC cancellation guard failed: pro editions=%s, pro stages=%s, winners=%s, junior editions=%s, S2 titles=%s.',
        v_professional_editions,
        v_professional_stages,
        v_completed_winners,
        v_junior_editions,
        v_s2_titles
      );
  end if;
end;
$guard$;

-- Le statut annule empeche immediatement tout cron de simulation ou de
-- reglement de prendre les epreuves de 18 h et les epreuves juniors.
update public.stages as stage
set status = 'cancelled'
from s3_cc_stages as affected
where stage.id = affected.id;

update public.race_editions as edition
set status = 'cancelled'
from s3_cc_editions as affected
where edition.id = affected.id;

update public.development_race_editions as edition
set status = 'cancelled', updated_at = now()
from public.seasons as season
where season.id = edition.season_id
  and season.game_year = 3
  and edition.competition_type in (
    'continental_road', 'continental_time_trial'
  );

-- Le reglement avait deja neutralise l'argent, les points, l'XP et la
-- satisfaction sponsor. Il restait toutefois les victoires statistiques.
update public.rider_season_summaries as summary
set
  victories = greatest(
    0,
    coalesce(summary.victories, 0) - correction.victories
  ),
  updated_at = now()
from s3_cc_victory_deltas as correction
where summary.rider_id = correction.rider_id
  and summary.season_id = correction.season_id;

update public.reward_events as reward
set description = case
  when reward.description like '%epreuve annulee%'
    or reward.description like '%épreuve annulée%'
    then reward.description
  else reward.description || ' · épreuve annulée'
end
from public.race_editions as edition,
  s3_cc_editions as affected
where affected.id = edition.id
  and reward.source_reference like '%' || edition.id::text || '%';

-- Retirer les maillots S3 puis reactiver exactement les dix champions S2.
delete from public.rider_national_championship_titles as title
using s3_cc_editions as affected
where title.race_edition_id = affected.id
  and title.championship_type like 'continental\_%' escape '\';

update public.rider_national_championship_titles
set relinquished_at = coalesce(relinquished_at, now())
where championship_type like 'continental\_%' escape '\'
  and relinquished_at is null;

with s2_holders as (
  select distinct on (title.championship_type)
    title.id
  from public.rider_national_championship_titles as title
  join public.seasons as season
    on season.id = title.season_id
   and season.game_year = 2
  where title.championship_type like 'continental\_%' escape '\'
  order by title.championship_type, title.won_at desc, title.id desc
)
update public.rider_national_championship_titles as title
set relinquished_at = null
from s2_holders as holder
where title.id = holder.id;

-- Restaurer la forme uniquement si aucun autre traitement n'a modifie depuis
-- l'etat du jour. Cela annule la fatigue du CLM sans ecraser un soin ou un
-- entrainement eventuellement applique apres la course.
update public.rider_condition_states as state
set
  form = effect.form_before,
  source = 'continental_championship_cancelled',
  updated_at = now()
from public.stage_rider_condition_effects as effect,
  s3_cc_stages as stage
where effect.stage_id = stage.id
  and state.rider_id = effect.rider_id
  and state.season_day_id = stage.season_day_id
  and state.form = effect.form_after;

delete from public.stage_rider_condition_effects as effect
using s3_cc_stages as stage
where effect.stage_id = stage.id;

-- Supprimer les scenarios et les classements officiels : une epreuve annulee
-- ne doit pas rester consultable comme si elle avait ete homologuee.
delete from public.official_stage_simulation_claims as claim
using s3_cc_stages as stage
where claim.stage_id = stage.id;

delete from public.official_stage_simulations as simulation
using s3_cc_stages as stage
where simulation.stage_id = stage.id;

delete from public.team_points_events as event
using public.stage_results as result,
  s3_cc_stages as stage
where event.stage_result_id = result.id
  and result.stage_id = stage.id;

delete from public.team_points_events as event
using public.race_results as result,
  s3_cc_editions as edition
where event.race_result_id = result.id
  and result.race_edition_id = edition.id;

delete from public.stage_results as result
using s3_cc_stages as stage
where result.stage_id = stage.id;

delete from public.race_results as result
using s3_cc_editions as edition
where result.race_edition_id = edition.id;

delete from public.development_race_results as result
using public.development_race_editions as edition,
  public.seasons as season
where result.race_edition_id = edition.id
  and season.id = edition.season_id
  and season.game_year = 3
  and edition.competition_type in (
    'continental_road', 'continental_time_trial'
  );

do $refresh$
declare
  v_edition_id uuid;
begin
  for v_edition_id in select id from s3_cc_editions loop
    perform public.refresh_race_edition_uci_rankings(v_edition_id);
  end loop;
end;
$refresh$;

commit;
