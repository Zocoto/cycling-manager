begin;

-- Objectifs de carrière liés aux fonctionnalités livrées après le pool initial.
-- Le calcul reste un wrapper : les métriques historiques continuent d'être
-- déléguées à la version précédente de la fonction.

alter function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
  rename to calculate_game_objective_progress_pre_modern_pool;

create or replace function public.calculate_game_objective_progress(
  p_metric_key text,
  p_director_id uuid,
  p_current_team_id uuid,
  p_experience_points numeric
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_value integer;
begin
  case p_metric_key
    when 'performance_infrastructure_types' then
      select count(*)::integer into v_value
      from public.team_infrastructures as infrastructure
      where infrastructure.team_id = p_current_team_id
        and infrastructure.infrastructure_code in (
          'indoor_track', 'cryotherapy_center', 'wind_tunnel',
          'research_lab', 'international_welcome_center',
          'weather_center', 'media_center'
        );

    when 'performance_infrastructure_level_five' then
      select count(*)::integer into v_value
      from public.team_infrastructures as infrastructure
      where infrastructure.team_id = p_current_team_id
        and infrastructure.level >= 5
        and infrastructure.infrastructure_code in (
          'indoor_track', 'cryotherapy_center', 'wind_tunnel',
          'research_lab', 'international_welcome_center',
          'weather_center', 'media_center'
        );

    when 'infrastructure_total_levels' then
      select (
        coalesce((
          select sum(infrastructure.level)
          from public.team_infrastructures as infrastructure
          where infrastructure.team_id = p_current_team_id
        ), 0)
        + coalesce((
          select sum(center.quality_level)
          from public.international_youth_centers as center
          where center.team_id = p_current_team_id
        ), 0)
      )::integer into v_value;

    when 'training_center_level' then
      select coalesce(max(infrastructure.level), 0)::integer into v_value
      from public.team_infrastructures as infrastructure
      where infrastructure.team_id = p_current_team_id
        and infrastructure.infrastructure_code = 'training_center';

    when 'completed_performance_preparations' then
      select count(*)::integer into v_value
      from public.rider_performance_preparations as preparation
      where preparation.team_id = p_current_team_id
        and preparation.status = 'completed';

    when 'completed_indoor_preparations' then
      select count(*)::integer into v_value
      from public.rider_performance_preparations as preparation
      where preparation.team_id = p_current_team_id
        and preparation.status = 'completed'
        and preparation.preparation_type = 'indoor_track';

    when 'completed_wind_tunnel_preparations' then
      select count(*)::integer into v_value
      from public.rider_performance_preparations as preparation
      where preparation.team_id = p_current_team_id
        and preparation.status = 'completed'
        and preparation.preparation_type = 'wind_tunnel';

    when 'dual_prepared_riders' then
      select count(*)::integer into v_value
      from (
        select preparation.rider_id
        from public.rider_performance_preparations as preparation
        where preparation.team_id = p_current_team_id
          and preparation.status = 'completed'
        group by preparation.rider_id
        having count(distinct preparation.preparation_type) = 2
      ) as dual_prepared;

    when 'completed_rnd_projects' then
      select count(*)::integer into v_value
      from public.equipment_rnd_projects as project
      where project.team_id = p_current_team_id
        and project.status = 'completed';

    when 'successful_rnd_projects' then
      select count(*)::integer into v_value
      from public.equipment_rnd_projects as project
      where project.team_id = p_current_team_id
        and project.status = 'completed'
        and project.outcome = 'improvement';

    when 'rnd_breakthroughs' then
      select count(*)::integer into v_value
      from public.equipment_rnd_projects as project
      where project.team_id = p_current_team_id
        and project.status = 'completed'
        and project.rating_delta = 2;

    when 'successful_rnd_equipment_slots' then
      select count(distinct item.slot_type)::integer into v_value
      from public.equipment_rnd_projects as project
      join public.equipment_catalog_items as item
        on item.id = project.input_equipment_item_id
      where project.team_id = p_current_team_id
        and project.status = 'completed'
        and project.outcome = 'improvement';

    when 'submitted_post_race_interviews' then
      select count(*)::integer into v_value
      from public.post_race_interviews as interview
      where interview.sporting_director_id = p_director_id
        and interview.status = 'submitted';

    when 'cyclogazette_comments' then
      select count(*)::integer into v_value
      from public.cyclogazette_comments as comment_row
      where comment_row.sporting_director_id = p_director_id;

    when 'cyclogazette_likes' then
      select count(*)::integer into v_value
      from public.cyclogazette_likes as like_row
      where like_row.sporting_director_id = p_director_id;

    when 'global_chat_messages' then
      select count(*)::integer into v_value
      from public.global_chat_messages as message_row
      where message_row.sporting_director_id = p_director_id;

    when 'global_chat_shared_previews' then
      select count(*)::integer into v_value
      from public.global_chat_messages as message_row
      where message_row.sporting_director_id = p_director_id
        and message_row.preview_type is not null;

    when 'media_center_articles' then
      select count(*)::integer into v_value
      from public.media_center_articles as article
      where article.sporting_director_id = p_director_id;

    when 'active_roster_countries' then
      select count(distinct rider.country_id)::integer into v_value
      from public.rider_contracts as contract
      join public.riders as rider on rider.id = contract.rider_id
      where contract.team_id = p_current_team_id
        and contract.status = 'active';

    when 'active_roster_continents' then
      select count(distinct country.continent_code)::integer into v_value
      from public.rider_contracts as contract
      join public.riders as rider on rider.id = contract.rider_id
      join public.countries as country on country.id = rider.country_id
      where contract.team_id = p_current_team_id
        and contract.status = 'active'
        and country.continent_code is not null;

    when 'completed_naturalizations' then
      select count(*)::integer into v_value
      from public.rider_naturalizations as naturalization
      where naturalization.sporting_director_id = p_director_id;

    when 'qualified_referrals' then
      select count(*)::integer into v_value
      from public.sporting_director_referrals as referral
      where referral.referrer_director_id = p_director_id
        and referral.status = 'qualified';

    when 'fan_club_supporters' then
      select coalesce(profile.supporter_count, 0)::integer into v_value
      from public.fan_club_profiles as profile
      where profile.team_id = p_current_team_id;

    when 'fan_club_trips' then
      select count(*)::integer into v_value
      from public.fan_club_trip_allocations as allocation
      where allocation.team_id = p_current_team_id;

    when 'fan_club_fleet_models' then
      select count(*)::integer into v_value
      from public.fan_club_fleet as vehicle
      where vehicle.team_id = p_current_team_id
        and vehicle.quantity > 0;

    when 'fan_club_products_sold' then
      select count(distinct sale.product_code)::integer into v_value
      from public.fan_club_shop_sales as sale
      where sale.team_id = p_current_team_id;

    when 'team_national_championship_titles' then
      select count(*)::integer into v_value
      from public.rider_national_championship_titles as title
      join public.seasons as title_season on title_season.id = title.season_id
      where title.championship_type in ('road', 'time_trial')
        and public.was_rider_contracted_by_team_in_season(
          title.rider_id, p_current_team_id, title_season.game_year
        );

    when 'team_national_championship_disciplines' then
      select count(distinct title.championship_type)::integer into v_value
      from public.rider_national_championship_titles as title
      join public.seasons as title_season on title_season.id = title.season_id
      where title.championship_type in ('road', 'time_trial')
        and public.was_rider_contracted_by_team_in_season(
          title.rider_id, p_current_team_id, title_season.game_year
        );

    when 'team_continental_championship_titles' then
      select count(*)::integer into v_value
      from public.rider_national_championship_titles as title
      join public.seasons as title_season on title_season.id = title.season_id
      where title.championship_type like 'continental\_%' escape '\'
        and public.was_rider_contracted_by_team_in_season(
          title.rider_id, p_current_team_id, title_season.game_year
        );

    when 'team_world_championship_titles' then
      select count(*)::integer into v_value
      from public.rider_national_championship_titles as title
      join public.seasons as title_season on title_season.id = title.season_id
      where title.championship_type in ('world_road', 'world_time_trial')
        and public.was_rider_contracted_by_team_in_season(
          title.rider_id, p_current_team_id, title_season.game_year
        );

    when 'team_championship_title_countries' then
      select count(distinct title.country_id)::integer into v_value
      from public.rider_national_championship_titles as title
      join public.seasons as title_season on title_season.id = title.season_id
      where public.was_rider_contracted_by_team_in_season(
        title.rider_id, p_current_team_id, title_season.game_year
      );

    when 'team_championship_crown_types' then
      select count(distinct case
        when title.championship_type = 'road' then 'national_road'
        when title.championship_type = 'time_trial' then 'national_time_trial'
        when title.championship_type like 'continental\_%\_road' escape '\' then 'continental_road'
        when title.championship_type like 'continental\_%\_time_trial' escape '\' then 'continental_time_trial'
        when title.championship_type = 'world_road' then 'world_road'
        when title.championship_type = 'world_time_trial' then 'world_time_trial'
        else null
      end)::integer into v_value
      from public.rider_national_championship_titles as title
      join public.seasons as title_season on title_season.id = title.season_id
      where public.was_rider_contracted_by_team_in_season(
        title.rider_id, p_current_team_id, title_season.game_year
      );

    else
      return public.calculate_game_objective_progress_pre_modern_pool(
        p_metric_key,
        p_director_id,
        p_current_team_id,
        p_experience_points
      );
  end case;

  return greatest(coalesce(v_value, 0), 0);
end;
$$;

-- L'appartenance d'un coureur est évaluée à la saison du titre, et non à
-- l'équipe actuelle, afin que les couronnes restent des accomplissements de
-- carrière même après un transfert.
create or replace function public.was_rider_contracted_by_team_in_season(
  p_rider_id uuid,
  p_team_id uuid,
  p_game_year integer
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rider_contracts as contract
    join public.seasons as start_season on start_season.id = contract.start_season_id
    join public.seasons as end_season on end_season.id = contract.end_season_id
    where contract.rider_id = p_rider_id
      and contract.team_id = p_team_id
      and contract.status in ('active', 'completed', 'terminated')
      and p_game_year between start_season.game_year and end_season.game_year
  );
$$;

insert into public.game_objective_definitions (
  objective_key, objective_type, objective_group, title, description,
  metric_key, target_value, reward_cash, reward_experience,
  reward_reputation, reward_inventory_item_key,
  reward_equipment_catalog_key, reward_random_special_ability,
  display_order, is_active
)
values
  ('infrastructure_first_performance', 'secondary', 'infrastructures', 'La première pierre', 'Construire une première infrastructure de performance parmi les sept nouvelles installations.', 'performance_infrastructure_types', 1, 15000, 45, 1, null, null, false, 2000, true),
  ('infrastructure_performance_network', 'secondary', 'infrastructures', 'Le campus prend forme', 'Construire les sept infrastructures de performance : piste, cryothérapie, soufflerie, R&D, accueil international, météo et Média Center.', 'performance_infrastructure_types', 7, 180000, 420, 14, 'potential-notebook', null, false, 2010, true),
  ('infrastructure_total_level_25', 'secondary', 'infrastructures', 'Bâtisseur au long cours', 'Cumuler vingt-cinq niveaux sur l’ensemble de vos infrastructures et centres internationaux.', 'infrastructure_total_levels', 25, 120000, 280, 9, null, null, true, 2020, true),
  ('training_center_level_5_modern', 'secondary', 'infrastructures', 'Méthode haute performance', 'Porter le Centre d’entraînement au niveau 5.', 'training_center_level', 5, 90000, 240, 8, 'mountain-focus', null, false, 2030, true),
  ('infrastructure_performance_level_5', 'secondary', 'infrastructures', 'Campus de pointe', 'Porter chacune des sept infrastructures de performance au niveau 5. Débloque un trophée de carrière.', 'performance_infrastructure_level_five', 7, 500000, 1000, 35, null, null, true, 2040, true),

  ('preparation_indoor_first', 'secondary', 'rider_preparation', 'Tours de piste', 'Achever la première préparation d’un coureur sur la piste indoor.', 'completed_indoor_preparations', 1, 12000, 40, 1, null, null, false, 2100, true),
  ('preparation_wind_first', 'secondary', 'rider_preparation', 'Dans le vent', 'Achever la première préparation d’un coureur en soufflerie.', 'completed_wind_tunnel_preparations', 1, 18000, 50, 2, null, null, false, 2110, true),
  ('preparation_completed_10', 'secondary', 'rider_preparation', 'Préparateur méticuleux', 'Achever dix préparations de performance, piste et soufflerie confondues.', 'completed_performance_preparations', 10, 60000, 170, 6, 'acceleration-focus', null, false, 2120, true),
  ('preparation_completed_25', 'secondary', 'rider_preparation', 'Laboratoire de jambes', 'Achever vingt-cinq préparations de performance.', 'completed_performance_preparations', 25, 140000, 360, 12, null, null, true, 2130, true),
  ('preparation_dual_rider', 'secondary', 'rider_preparation', 'Deux écoles, un coureur', 'Faire achever à un même coureur au moins une préparation piste et une préparation soufflerie.', 'dual_prepared_riders', 1, 75000, 210, 7, 'sprint-masterclass', null, false, 2140, true),

  ('rnd_first_project', 'secondary', 'research', 'Le premier prototype', 'Mener un premier projet du Laboratoire R&D jusqu’à son terme, quel que soit le résultat.', 'completed_rnd_projects', 1, 25000, 75, 2, null, null, false, 2200, true),
  ('rnd_first_success', 'secondary', 'research', 'Eurêka sur deux roues', 'Obtenir une première amélioration positive grâce au Laboratoire R&D.', 'successful_rnd_projects', 1, 50000, 140, 5, null, null, true, 2210, true),
  ('rnd_successes_10', 'secondary', 'research', 'Série de prototypes', 'Réussir dix améliorations positives de matériel en R&D.', 'successful_rnd_projects', 10, 220000, 520, 18, 'potential-notebook', null, false, 2220, true),
  ('rnd_breakthrough', 'secondary', 'research', 'Percée technologique', 'Obtenir un prototype exceptionnel doté d’un bonus R&D de +2.', 'rnd_breakthroughs', 1, 130000, 350, 12, null, null, true, 2230, true),
  ('rnd_slots_4', 'secondary', 'research', 'Bureau d’études polyvalent', 'Réussir une amélioration sur quatre familles de matériel différentes.', 'successful_rnd_equipment_slots', 4, 180000, 430, 15, null, null, true, 2240, true),
  ('rnd_all_slots_success', 'secondary', 'research', 'Alchimiste du carbone', 'Réussir au moins une amélioration sur chacune des huit familles de matériel. Débloque un trophée de carrière.', 'successful_rnd_equipment_slots', 8, 600000, 1200, 40, null, null, true, 2250, true),

  ('social_interview_1', 'secondary', 'social', 'Face aux micros', 'Répondre à une première interview d’après-course.', 'submitted_post_race_interviews', 1, 5000, 20, 1, null, null, false, 2300, true),
  ('social_interview_5', 'secondary', 'social', 'Client régulier de la zone mixte', 'Répondre à cinq interviews d’après-course.', 'submitted_post_race_interviews', 5, 18000, 65, 2, null, null, false, 2310, true),
  ('social_interview_10', 'secondary', 'social', 'Bon client des médias', 'Répondre à dix interviews d’après-course.', 'submitted_post_race_interviews', 10, 40000, 130, 4, 'potential-spark', null, false, 2320, true),
  ('social_interview_100', 'secondary', 'social', 'La voix du peloton', 'Répondre à cent interviews d’après-course au fil de votre carrière.', 'submitted_post_race_interviews', 100, 300000, 750, 25, null, null, true, 2330, true),
  ('social_gazette_comment_1', 'secondary', 'social', 'Droit de réponse', 'Publier votre premier commentaire sous une édition de la Cyclogazette.', 'cyclogazette_comments', 1, 3000, 15, 1, null, null, false, 2340, true),
  ('social_gazette_comment_10', 'secondary', 'social', 'Au comptoir de la Gazette', 'Publier dix commentaires dans la Cyclogazette.', 'cyclogazette_comments', 10, 18000, 70, 3, null, null, false, 2350, true),
  ('social_gazette_comment_100', 'secondary', 'social', 'Éditorialiste du dimanche', 'Publier cent commentaires dans la Cyclogazette.', 'cyclogazette_comments', 100, 180000, 500, 18, null, null, true, 2360, true),
  ('social_gazette_likes_10', 'secondary', 'social', 'Lecteur fidèle', 'Soutenir dix éditions différentes de la Cyclogazette.', 'cyclogazette_likes', 10, 12000, 45, 2, null, null, false, 2370, true),
  ('social_chat_messages_25', 'secondary', 'social', 'Radio peloton', 'Publier vingt-cinq messages dans le fil global du peloton.', 'global_chat_messages', 25, 25000, 90, 3, null, null, false, 2380, true),
  ('social_chat_previews_5', 'secondary', 'social', 'Tu as vu ce coureur ?', 'Partager cinq aperçus de coureurs, équipes ou nations dans le fil global.', 'global_chat_shared_previews', 5, 30000, 110, 4, null, null, false, 2390, true),
  ('social_media_article_1', 'secondary', 'social', 'À la une', 'Publier un premier article grâce au Média Center.', 'media_center_articles', 1, 35000, 100, 4, null, null, false, 2400, true),
  ('social_media_article_10', 'secondary', 'social', 'Votre propre rédaction', 'Publier dix articles grâce au Média Center.', 'media_center_articles', 10, 150000, 400, 14, null, null, true, 2410, true),

  ('roster_countries_5', 'secondary', 'diversity', 'Vestiaire polyglotte', 'Réunir simultanément cinq nationalités dans votre effectif actif.', 'active_roster_countries', 5, 25000, 80, 3, null, null, false, 2500, true),
  ('roster_countries_10', 'secondary', 'diversity', 'Petit tour du monde', 'Réunir simultanément dix nationalités dans votre effectif actif.', 'active_roster_countries', 10, 80000, 230, 8, 'potential-spark', null, false, 2510, true),
  ('roster_continents_3', 'secondary', 'diversity', 'Trois horizons', 'Compter simultanément des coureurs issus de trois continents dans votre effectif actif.', 'active_roster_continents', 3, 45000, 130, 5, null, null, false, 2520, true),
  ('roster_all_continents', 'secondary', 'diversity', 'Atlas du peloton', 'Compter simultanément au moins un coureur d’Afrique, d’Amérique, d’Asie, d’Europe et d’Océanie. Débloque un trophée de carrière.', 'active_roster_continents', 5, 350000, 850, 30, null, null, true, 2530, true),
  ('naturalizations_3', 'secondary', 'diversity', 'Passeport sportif', 'Mener à bien trois naturalisations de coureurs professionnels ou juniors.', 'completed_naturalizations', 3, 90000, 260, 9, null, null, true, 2540, true),

  ('referral_qualified_1', 'secondary', 'referrals', 'Un ami dans la roue', 'Faire découvrir le jeu à un filleul qui termine le Critérium de la découverte.', 'qualified_referrals', 1, 25000, 80, 3, null, null, false, 2600, true),
  ('referral_qualified_5', 'secondary', 'referrals', 'Directeur de réseau', 'Qualifier cinq filleuls grâce à votre lien de parrainage.', 'qualified_referrals', 5, 120000, 320, 12, null, null, true, 2610, true),
  ('referral_qualified_25', 'secondary', 'referrals', 'Une dynastie dans le peloton', 'Qualifier vingt-cinq filleuls au cours de votre carrière.', 'qualified_referrals', 25, 500000, 1100, 40, null, null, true, 2620, true),

  ('fan_club_supporters_1000', 'secondary', 'fan_club', 'La tribune se remplit', 'Rassembler mille supporters dans votre Fan Club.', 'fan_club_supporters', 1000, 35000, 100, 4, null, null, false, 2700, true),
  ('fan_club_supporters_10000', 'secondary', 'fan_club', 'Une marée de maillots', 'Rassembler dix mille supporters dans votre Fan Club.', 'fan_club_supporters', 10000, 220000, 560, 20, null, null, true, 2710, true),
  ('fan_club_trips_5', 'secondary', 'fan_club', 'Les cars sont de sortie', 'Organiser cinq déplacements de supporters sur des courses.', 'fan_club_trips', 5, 60000, 170, 6, null, null, false, 2720, true),
  ('fan_club_fleet_complete', 'secondary', 'fan_club', 'Garage de gala', 'Posséder au moins un car régional, un grand-tourisme et un double étage.', 'fan_club_fleet_models', 3, 140000, 340, 12, null, null, true, 2730, true),
  ('fan_club_products_complete', 'secondary', 'fan_club', 'La boutique aux cinq couleurs', 'Vendre au moins une fois chacun des cinq produits de la boutique du Fan Club.', 'fan_club_products_sold', 5, 90000, 250, 9, 'potential-notebook', null, false, 2740, true),

  ('championship_national_title_1', 'secondary', 'championships', 'Champion à la maison', 'Remporter un premier Championnat national, sur route ou contre-la-montre.', 'team_national_championship_titles', 1, 60000, 180, 6, null, null, false, 2800, true),
  ('championship_national_double', 'secondary', 'championships', 'Doublé national', 'Remporter au cours de votre carrière un titre national route et un titre national CLM.', 'team_national_championship_disciplines', 2, 140000, 360, 12, null, null, true, 2810, true),
  ('championship_continental_title_1', 'secondary', 'championships', 'Couronne continentale', 'Remporter un premier Championnat continental, sur route ou contre-la-montre.', 'team_continental_championship_titles', 1, 180000, 460, 16, null, null, true, 2820, true),
  ('championship_world_title_1', 'secondary', 'championships', 'Arc-en-ciel senior', 'Remporter un premier Championnat du monde senior, sur route ou contre-la-montre.', 'team_world_championship_titles', 1, 300000, 700, 25, null, null, true, 2830, true),
  ('championship_title_countries_3', 'secondary', 'championships', 'Couronnes sans frontières', 'Gagner des titres de champion avec des coureurs de trois nationalités différentes.', 'team_championship_title_countries', 3, 240000, 600, 21, null, null, true, 2840, true),
  ('championship_triple_crown', 'secondary', 'championships', 'Triple Couronne intégrale', 'Remporter route et CLM aux trois niveaux : national, continental et mondial. Débloque un trophée de carrière.', 'team_championship_crown_types', 6, 750000, 1500, 50, null, null, true, 2850, true)
on conflict (objective_key) do update set
  objective_type = excluded.objective_type,
  objective_group = excluded.objective_group,
  title = excluded.title,
  description = excluded.description,
  metric_key = excluded.metric_key,
  target_value = excluded.target_value,
  reward_cash = excluded.reward_cash,
  reward_experience = excluded.reward_experience,
  reward_reputation = excluded.reward_reputation,
  reward_inventory_item_key = excluded.reward_inventory_item_key,
  reward_equipment_catalog_key = excluded.reward_equipment_catalog_key,
  reward_random_special_ability = excluded.reward_random_special_ability,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = now();

-- Les trophées maîtres sont attribués au moment où le DS réclame la
-- récompense de l'objectif. Ils arrivent déjà ouverts dans la galerie.
create or replace function private.grant_objective_achievement_trophy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trophy_key text;
begin
  v_trophy_key := case new.objective_key
    when 'roster_all_continents' then 'atlas_peloton'
    when 'infrastructure_performance_level_5' then 'campus_de_pointe'
    when 'rnd_all_slots_success' then 'alchimiste_carbone'
    when 'championship_triple_crown' then 'triple_couronne_integrale'
    else null
  end;

  if v_trophy_key is not null then
    insert into public.sporting_director_trophies (
      sporting_director_id, trophy_key, available_at, claimed_at
    )
    values (
      new.sporting_director_id, v_trophy_key, new.claimed_at, new.claimed_at
    )
    on conflict (sporting_director_id, trophy_key) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists grant_objective_achievement_trophy
  on public.game_objective_claims;
create trigger grant_objective_achievement_trophy
after insert on public.game_objective_claims
for each row execute function private.grant_objective_achievement_trophy();

insert into public.sporting_director_trophies (
  sporting_director_id, trophy_key, available_at, claimed_at
)
select
  claim.sporting_director_id,
  mapping.trophy_key,
  claim.claimed_at,
  claim.claimed_at
from public.game_objective_claims as claim
join (values
  ('roster_all_continents', 'atlas_peloton'),
  ('infrastructure_performance_level_5', 'campus_de_pointe'),
  ('rnd_all_slots_success', 'alchimiste_carbone'),
  ('championship_triple_crown', 'triple_couronne_integrale')
) as mapping(objective_key, trophy_key)
  on mapping.objective_key = claim.objective_key
on conflict (sporting_director_id, trophy_key) do nothing;

create or replace function public.discover_current_sporting_director_easter_egg()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_director_id uuid;
  v_inserted integer := 0;
begin
  select director.id into v_director_id
  from public.sporting_directors as director
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_director_id is null then
    raise exception 'Directeur Sportif introuvable.';
  end if;

  insert into public.sporting_director_trophies (
    sporting_director_id, trophy_key, available_at, claimed_at
  )
  values (v_director_id, 'virage_cache', now(), now())
  on conflict (sporting_director_id, trophy_key) do nothing;

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'newlyUnlocked', v_inserted = 1,
    'trophyKey', 'virage_cache'
  );
end;
$$;

revoke all on function public.was_rider_contracted_by_team_in_season(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.was_rider_contracted_by_team_in_season(uuid, uuid, integer)
  to service_role;

revoke all on function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
  to service_role;

revoke all on function public.discover_current_sporting_director_easter_egg()
  from public, anon;
grant execute on function public.discover_current_sporting_director_easter_egg()
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
