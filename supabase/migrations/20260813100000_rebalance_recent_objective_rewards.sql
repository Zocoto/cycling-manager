begin;

-- Les objectifs ajoutes avec la Development Team et les fonctionnalites
-- modernes etaient beaucoup plus genereux que le reste du parcours de
-- carriere. Cette grille les replace dans la meme economie :
--   * les actions simples ou naturellement atteintes restent symboliques ;
--   * les paliers reguliers recompensent la perseverance sans financer seuls
--     une grande partie d'une saison ;
--   * les exploits sportifs et les objectifs maitres restent distinctifs.
--
-- Seules les definitions encore utilisees lors d'une future reclamation sont
-- mises a jour. Les lignes de game_objective_claims et les gains deja verses
-- ne sont volontairement pas modifies.

with rebalanced_rewards (
  objective_key,
  reward_cash,
  reward_experience,
  reward_reputation,
  reward_inventory_item_key,
  reward_random_special_ability
) as (
  values
    -- Development Team
    ('development_first_registration', 2000::numeric, 10, 0::numeric, null::text, false),
    ('development_calendar_complete', 15000::numeric, 60, 2::numeric, null::text, false),
    ('development_first_podium', 6000::numeric, 25, 1::numeric, null::text, false),
    ('development_podiums_10', 30000::numeric, 110, 4::numeric, 'mountain-focus'::text, false),
    ('development_first_stage_win', 8000::numeric, 30, 1::numeric, null::text, false),
    ('development_stage_wins_5', 25000::numeric, 90, 3::numeric, null::text, false),
    ('development_first_win', 12000::numeric, 45, 2::numeric, 'acceleration-focus'::text, false),
    ('development_victories_3', 25000::numeric, 85, 3::numeric, null::text, false),
    ('development_victories_10', 60000::numeric, 180, 6::numeric, 'medallion-panache'::text, false),
    ('development_profile_wins_4', 35000::numeric, 120, 4::numeric, null::text, false),
    ('development_unique_winners_3', 30000::numeric, 100, 3::numeric, null::text, false),
    ('development_tour_win', 45000::numeric, 160, 5::numeric, 'potential-notebook'::text, false),
    ('development_world_podiums_3', 55000::numeric, 180, 6::numeric, null::text, false),
    ('development_world_title', 70000::numeric, 230, 8::numeric, null::text, false),
    ('development_double_world_title', 120000::numeric, 380, 13::numeric, null::text, true),

    -- Infrastructures et preparation
    ('infrastructure_first_performance', 5000::numeric, 20, 0::numeric, null::text, false),
    ('infrastructure_performance_network', 65000::numeric, 180, 6::numeric, 'potential-notebook'::text, false),
    ('infrastructure_total_level_25', 45000::numeric, 140, 4::numeric, null::text, false),
    ('training_center_level_5_modern', 35000::numeric, 110, 4::numeric, 'mountain-focus'::text, false),
    ('infrastructure_performance_level_5', 180000::numeric, 500, 17::numeric, null::text, false),
    ('preparation_indoor_first', 4000::numeric, 15, 0::numeric, null::text, false),
    ('preparation_wind_first', 6000::numeric, 20, 0::numeric, null::text, false),
    ('preparation_completed_10', 20000::numeric, 65, 2::numeric, 'acceleration-focus'::text, false),
    ('preparation_completed_25', 45000::numeric, 140, 4::numeric, null::text, false),
    ('preparation_dual_rider', 15000::numeric, 50, 1::numeric, null::text, false),

    -- Recherche et developpement
    ('rnd_first_project', 8000::numeric, 25, 1::numeric, null::text, false),
    ('rnd_first_success', 12000::numeric, 40, 1::numeric, null::text, false),
    ('rnd_successes_10', 60000::numeric, 180, 6::numeric, 'potential-notebook'::text, false),
    ('rnd_breakthrough', 30000::numeric, 90, 3::numeric, null::text, false),
    ('rnd_slots_4', 45000::numeric, 140, 4::numeric, null::text, false),
    ('rnd_all_slots_success', 180000::numeric, 500, 17::numeric, null::text, false),

    -- Vie sociale et medias : volontairement bas pour ne pas encourager le spam
    ('social_interview_1', 2000::numeric, 10, 0::numeric, null::text, false),
    ('social_interview_5', 5000::numeric, 20, 0::numeric, null::text, false),
    ('social_interview_10', 10000::numeric, 35, 1::numeric, null::text, false),
    ('social_interview_100', 60000::numeric, 180, 5::numeric, null::text, false),
    ('social_gazette_comment_1', 1000::numeric, 5, 0::numeric, null::text, false),
    ('social_gazette_comment_10', 4000::numeric, 15, 0::numeric, null::text, false),
    ('social_gazette_comment_100', 35000::numeric, 110, 3::numeric, null::text, false),
    ('social_gazette_likes_10', 3000::numeric, 10, 0::numeric, null::text, false),
    ('social_chat_messages_25', 5000::numeric, 20, 0::numeric, null::text, false),
    ('social_chat_previews_5', 6000::numeric, 25, 0::numeric, null::text, false),
    ('social_media_article_1', 8000::numeric, 30, 1::numeric, null::text, false),
    ('social_media_article_10', 30000::numeric, 100, 3::numeric, null::text, false),

    -- Diversite : ces objectifs dependent surtout de la composition de
    -- l'effectif et sont donc les plus fortement diminues.
    ('roster_countries_5', 2000::numeric, 10, 0::numeric, null::text, false),
    ('roster_countries_10', 7500::numeric, 30, 1::numeric, null::text, false),
    ('roster_continents_3', 3000::numeric, 12, 0::numeric, null::text, false),
    ('roster_all_continents', 30000::numeric, 100, 3::numeric, null::text, false),
    ('naturalizations_3', 20000::numeric, 65, 2::numeric, null::text, false),

    -- Parrainage et Fan Club
    ('referral_qualified_1', 10000::numeric, 35, 1::numeric, null::text, false),
    ('referral_qualified_5', 45000::numeric, 140, 4::numeric, null::text, false),
    ('referral_qualified_25', 160000::numeric, 450, 15::numeric, null::text, true),
    ('fan_club_supporters_1000', 10000::numeric, 35, 1::numeric, null::text, false),
    ('fan_club_supporters_10000', 70000::numeric, 210, 7::numeric, null::text, false),
    ('fan_club_trips_5', 15000::numeric, 50, 1::numeric, null::text, false),
    ('fan_club_fleet_complete', 40000::numeric, 120, 4::numeric, null::text, false),
    ('fan_club_products_complete', 18000::numeric, 60, 2::numeric, null::text, false),

    -- Championnats : progression marquee, sans cumuler automatiquement une
    -- capacite rare avec la prime sportive et la recompense d'objectif.
    ('championship_national_title_1', 25000::numeric, 80, 2::numeric, null::text, false),
    ('championship_national_double', 55000::numeric, 170, 5::numeric, null::text, false),
    ('championship_continental_title_1', 80000::numeric, 240, 8::numeric, null::text, false),
    ('championship_world_title_1', 120000::numeric, 350, 12::numeric, null::text, false),
    ('championship_title_countries_3', 90000::numeric, 270, 9::numeric, null::text, false),
    ('championship_triple_crown', 250000::numeric, 650, 22::numeric, null::text, false)
)
update public.game_objective_definitions as definition
set
  reward_cash = reward.reward_cash,
  reward_experience = reward.reward_experience,
  reward_reputation = reward.reward_reputation,
  reward_inventory_item_key = reward.reward_inventory_item_key,
  reward_equipment_catalog_key = null,
  reward_random_special_ability = reward.reward_random_special_ability,
  updated_at = now()
from rebalanced_rewards as reward
where definition.objective_key = reward.objective_key;

notify pgrst, 'reload schema';

commit;
