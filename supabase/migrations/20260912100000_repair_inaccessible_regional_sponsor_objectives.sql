begin;

-- Les Régionales sont réservées aux structures sans sponsor principal. Elles
-- ne peuvent donc jamais constituer un objectif du contrat qui rend justement
-- l'équipe inéligible. Remplace uniquement les objectifs actifs de la saison
-- en cours, à difficulté et échéance aussi proches que possible.
do $$
declare
  v_objective record;
  v_replacement record;
  v_achievement_type text;
  v_target_rank integer;
  v_required_count integer;
  v_name text;
  v_description text;
  v_repaired integer := 0;
begin
  for v_objective in
    select
      objective.id,
      objective.sponsor_offer_id,
      objective.season_id,
      objective.target_details,
      offer.sporting_director_id,
      sponsor.country_id as sponsor_country_id,
      sponsor_country.continent_code as sponsor_continent_code,
      coalesce(director.reputation_points, 0) as team_reputation_points,
      race_objective.achievement_type,
      race_objective.target_rank,
      race_objective.required_count,
      target_stage.first_departure as target_departure,
      target_stage.profile_type as target_profile_type
    from public.sponsor_objectives as objective
    join public.sponsor_offers as offer
      on offer.id = objective.sponsor_offer_id
     and offer.status = 'accepted'
    join public.sponsors as sponsor
      on sponsor.id = offer.sponsor_id
    join public.countries as sponsor_country
      on sponsor_country.id = sponsor.country_id
    left join public.sporting_directors as director
      on director.id = offer.sporting_director_id
    join public.team_sponsor_contracts as contract
      on contract.sponsor_offer_id = offer.id
     and contract.role = 'principal'
     and contract.status = 'active'
    join public.seasons as season
      on season.id = objective.season_id
     and season.status = 'active'
    join public.race_result_objectives as race_objective
      on race_objective.objective_id = objective.id
    join public.race_editions as target_edition
      on target_edition.id = race_objective.race_edition_id
    join public.race_categories as target_category
      on target_category.id = target_edition.race_category_id
     and target_category.code = 'regional'
    join lateral (
      select
        min(stage.departure_at) as first_departure,
        (array_agg(stage.profile_type order by stage.stage_number))[1] as profile_type
      from public.stages as stage
      where stage.race_edition_id = target_edition.id
    ) as target_stage on true
    where objective.objective_type = 'race_result'
      and objective.status = 'active'
    order by objective.sponsor_offer_id, objective.display_order
    for update of objective
  loop
    select
      edition.id as race_edition_id,
      edition.race_id,
      edition.display_name as race_label,
      race.slug as race_slug,
      country.iso_alpha2 as country_code
    into strict v_replacement
    from public.race_editions as edition
    join public.races as race
      on race.id = edition.race_id
     and race.status = 'active'
     and race.competition_type = 'standard'
    join public.countries as country
      on country.id = coalesce(edition.host_country_id, race.country_id)
    join public.race_categories as category
      on category.id = edition.race_category_id
     and category.code in ('national', 'continental', 'world')
    join lateral (
      select
        min(stage.departure_at) as first_departure,
        bool_or(stage.profile_type = v_objective.target_profile_type) as same_profile
      from public.stages as stage
      where stage.race_edition_id = edition.id
    ) as candidate_stage on candidate_stage.first_departure is not null
    where edition.season_id = v_objective.season_id
      and edition.status <> 'cancelled'
      and edition.registration_policy = 'open'
      and coalesce(edition.minimum_reputation, 0) <= v_objective.team_reputation_points
      and candidate_stage.first_departure > now()
      and not exists (
        select 1
        from public.sponsor_objectives as existing_objective
        where existing_objective.sponsor_offer_id = v_objective.sponsor_offer_id
          and existing_objective.id <> v_objective.id
          and existing_objective.target_details ->> 'raceId' = edition.race_id::text
      )
    order by
      (country.id = v_objective.sponsor_country_id) desc,
      (country.continent_code = v_objective.sponsor_continent_code) desc,
      (category.code = 'national') desc,
      candidate_stage.same_profile desc,
      abs(extract(epoch from candidate_stage.first_departure - v_objective.target_departure)),
      race.slug
    limit 1;

    v_achievement_type := coalesce(
      nullif(v_objective.target_details ->> 'achievementType', ''),
      v_objective.achievement_type,
      'top_n'
    );
    v_target_rank := case
      when v_achievement_type = 'top_n' then coalesce(
        nullif(v_objective.target_details ->> 'targetRank', '')::integer,
        v_objective.target_rank,
        10
      )
      else null
    end;
    v_required_count := greatest(
      1,
      coalesce(
        nullif(v_objective.target_details ->> 'requiredCount', '')::integer,
        v_objective.required_count,
        1
      )
    );
    v_name := case v_achievement_type
      when 'win' then 'Remporter ' || v_replacement.race_label
      when 'participation' then 'Participer à ' || v_replacement.race_label
      else 'Top ' || v_target_rank || ' sur ' || v_replacement.race_label
    end;
    v_description := case v_achievement_type
      when 'win' then 'Obtenir la victoire sur ' || v_replacement.race_label || ' pendant la saison.'
      when 'participation' then 'Prendre le départ de ' || v_replacement.race_label || ' pendant la saison.'
      else 'Placer au moins un coureur parmi les ' || v_target_rank || ' premiers de ' || v_replacement.race_label || '.'
    end;

    update public.sponsor_objectives
    set
      name = v_name,
      description = v_description,
      target_details = v_objective.target_details || jsonb_build_object(
        'kind', 'race_result',
        'raceId', v_replacement.race_id,
        'raceEditionId', v_replacement.race_edition_id,
        'raceSlug', v_replacement.race_slug,
        'raceLabel', v_replacement.race_label,
        'countryCode', v_replacement.country_code,
        'achievementType', v_achievement_type,
        'targetRank', v_target_rank,
        'requiredCount', v_required_count,
        'replacedInaccessibleRegionalRace', true
      ),
      updated_at = now()
    where id = v_objective.id;

    update public.race_result_objectives
    set
      race_edition_id = v_replacement.race_edition_id,
      stage_id = null,
      target_scope = 'race_final',
      achievement_type = v_achievement_type,
      target_rank = v_target_rank,
      required_count = v_required_count
    where objective_id = v_objective.id;

    update public.objective_progress
    set
      status = 'not_started',
      current_value = 0,
      details = '{}'::jsonb,
      last_evaluated_at = null,
      achieved_at = null,
      settled_at = null,
      updated_at = now()
    where sponsor_objective_id = v_objective.id
      and status in ('not_started', 'in_progress');

    v_repaired := v_repaired + 1;
  end loop;

  raise notice '% objectif(s) sponsor régional(aux) inaccessible(s) remplacé(s).', v_repaired;
end;
$$;

commit;
