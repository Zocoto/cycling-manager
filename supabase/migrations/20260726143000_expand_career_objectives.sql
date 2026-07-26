begin;

-- ============================================================
-- PRESTIGE DES COURSES
-- Les objectifs de fin de partie ne doivent pas dépendre d'une
-- liste de slugs dispersée dans les fonctions de progression.
-- ============================================================

alter table public.races
  add column if not exists is_monument boolean not null default false,
  add column if not exists is_grand_tour boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.races'::regclass
      and conname = 'races_monument_format_consistent'
  ) then
    alter table public.races
      add constraint races_monument_format_consistent
      check (not is_monument or race_format = 'one_day');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.races'::regclass
      and conname = 'races_grand_tour_format_consistent'
  ) then
    alter table public.races
      add constraint races_grand_tour_format_consistent
      check (not is_grand_tour or race_format = 'stage_race');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.races'::regclass
      and conname = 'races_single_prestige_kind'
  ) then
    alter table public.races
      add constraint races_single_prestige_kind
      check (not (is_monument and is_grand_tour));
  end if;
end;
$$;

update public.races
set is_monument = slug in (
  'enfer-des-dunes',
  'paves-de-zelande',
  'couronne-des-ardennes',
  'classique-des-lacs',
  'traversee-des-flandres'
);

update public.races
set is_grand_tour = slug in (
  'corsa-delle-regioni',
  'boucle-des-provinces',
  'ruta-de-las-sierras'
);

create index if not exists races_monuments_idx
  on public.races (slug)
  where is_monument;

create index if not exists races_grand_tours_idx
  on public.races (slug)
  where is_grand_tour;

comment on column public.races.is_monument is
  'Identifie les cinq classiques de prestige utilisées par les objectifs de carrière.';
comment on column public.races.is_grand_tour is
  'Identifie les tours de prestige utilisés par les objectifs de carrière.';

-- ============================================================
-- DIDACTICIELS OBLIGATOIRES
-- Cette liste décrit le périmètre final attendu. Les parcours non
-- encore développés empêchent volontairement une réclamation trop tôt.
-- ============================================================

create table if not exists public.game_required_tutorials (
  tutorial_key text primary key,
  section_key text not null,
  title text not null,
  display_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_required_tutorials_key_format
    check (tutorial_key ~ '^[a-z0-9][a-z0-9._-]*$'),
  constraint game_required_tutorials_section_not_empty
    check (btrim(section_key) <> ''),
  constraint game_required_tutorials_title_not_empty
    check (btrim(title) <> ''),
  constraint game_required_tutorials_order_positive
    check (display_order > 0)
);

insert into public.game_required_tutorials (
  tutorial_key,
  section_key,
  title,
  display_order,
  is_active
)
values
  ('onboarding-core', 'onboarding', 'Premiers pas', 10, true),
  ('criterium-discovery', 'courses', 'Critérium de la découverte', 20, true),
  ('office-dashboard', 'office', 'Bureau du Directeur Sportif', 30, true),
  ('calendar-and-registration', 'calendar', 'Calendrier et inscriptions', 40, true),
  ('race-roster', 'courses', 'Composer une sélection', 50, true),
  ('race-live', 'courses', 'Piloter une course', 60, true),
  ('results-and-rankings', 'results', 'Résultats et classements', 70, true),
  ('squad-and-contracts', 'roster', 'Effectif et contrats', 80, true),
  ('training', 'training', 'Programmer l''entraînement', 90, true),
  ('race-reconnaissance', 'training', 'Stages de reconnaissance', 100, true),
  ('medical-center', 'health', 'Centre médical', 110, true),
  ('nutrition', 'health', 'Nutrition et récupération', 120, true),
  ('staff', 'staff', 'Constituer son staff', 130, true),
  ('equipment', 'equipment', 'Matériel et équipements', 140, true),
  ('youth-academy', 'youth', 'Détection et formation des juniors', 150, true),
  ('sponsoring', 'sponsoring', 'Sponsors et contrats', 160, true),
  ('finances-infrastructure', 'finances', 'Finances et infrastructures', 170, true),
  ('transfer-market', 'market', 'Marché des transferts', 180, true)
on conflict (tutorial_key) do update set
  section_key = excluded.section_key,
  title = excluded.title,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = now();

alter table public.game_required_tutorials enable row level security;
grant all privileges on table public.game_required_tutorials to service_role;

comment on table public.game_required_tutorials is
  'Registre stable de tous les didacticiels à terminer avant de débloquer la récompense globale.';

-- ============================================================
-- FORME ÉCONOMISÉE PAR LE KINÉ EN COURSE
-- Les entraînements et blessures conservent déjà cette information.
-- On historise désormais aussi la protection appliquée après une étape.
-- ============================================================

alter table public.stage_rider_condition_effects
  add column if not exists physiotherapist_level smallint not null default 0,
  add column if not exists physiotherapist_form_protection smallint not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.stage_rider_condition_effects'::regclass
      and conname = 'stage_rider_condition_effects_physio_level_range'
  ) then
    alter table public.stage_rider_condition_effects
      add constraint stage_rider_condition_effects_physio_level_range
      check (physiotherapist_level between 0 and 5);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.stage_rider_condition_effects'::regclass
      and conname = 'stage_rider_condition_effects_physio_protection_range'
  ) then
    alter table public.stage_rider_condition_effects
      add constraint stage_rider_condition_effects_physio_protection_range
      check (physiotherapist_form_protection between 0 and 5);
  end if;
end;
$$;

create or replace function public.apply_assigned_physio_to_race_condition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_physio_level integer;
  v_original_form_delta integer := new.form_delta;
begin
  new.physiotherapist_level := 0;
  new.physiotherapist_form_protection := 0;

  select team_season.team_id
  into v_team_id
  from public.stages as stage
  join public.race_registrations as registration
    on registration.race_edition_id = stage.race_edition_id
   and registration.status = 'accepted'
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.rider_id = new.rider_id
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  where stage.id = new.stage_id
  limit 1;

  if v_team_id is null then
    return new;
  end if;

  v_physio_level := public.get_active_rider_physiotherapist_level(
    v_team_id,
    new.rider_id
  );
  if v_physio_level <= 0 then
    return new;
  end if;

  new.form_delta := least(-1, new.form_delta + v_physio_level);
  new.form_after := greatest(0, new.form_before + new.form_delta);
  new.physiotherapist_level := v_physio_level;
  new.physiotherapist_form_protection := greatest(
    0,
    new.form_delta - v_original_form_delta
  );
  return new;
end;
$$;

comment on column public.stage_rider_condition_effects.physiotherapist_form_protection is
  'Points de forme effectivement préservés par le kiné après cette étape.';

-- ============================================================
-- MÉTRIQUES ÉTENDUES
-- La fonction d'origine reste le repli pour les objectifs existants.
-- Ce renommage accepte aussi l'ancien wrapper du didacticiel déployé.
-- ============================================================

do $$
begin
  if to_regprocedure(
    'public.calculate_game_objective_progress_base(text,uuid,uuid,numeric)'
  ) is null then
    if to_regprocedure(
      'public.calculate_game_objective_progress_legacy(text,uuid,uuid,numeric)'
    ) is not null then
      alter function public.calculate_game_objective_progress_legacy(
        text,
        uuid,
        uuid,
        numeric
      ) rename to calculate_game_objective_progress_base;
    elsif to_regprocedure(
      'public.calculate_game_objective_progress(text,uuid,uuid,numeric)'
    ) is not null then
      alter function public.calculate_game_objective_progress(
        text,
        uuid,
        uuid,
        numeric
      ) rename to calculate_game_objective_progress_base;
    else
      raise exception 'La fonction de progression des objectifs est introuvable.';
    end if;
  end if;
end;
$$;

create or replace function public.calculate_expanded_game_objective_progress(
  p_metric_key text,
  p_director_id uuid
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
    when 'monument_participations' then
      select count(*)::integer into v_value
      from public.race_registrations as registration
      join public.team_seasons as team_season
        on team_season.id = registration.team_season_id
      join public.race_editions as edition
        on edition.id = registration.race_edition_id
      join public.races as race on race.id = edition.race_id
      where registration.status = 'accepted'
        and edition.status = 'completed'
        and race.is_monument
        and exists (
          select 1 from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = team_season.team_id
        );

    when 'monument_wins' then
      select count(*)::integer into v_value
      from public.race_results as result
      join public.race_editions as edition
        on edition.id = result.race_edition_id
      join public.races as race on race.id = edition.race_id
      join public.race_rosters as roster on roster.id = result.race_roster_id
      join public.race_registrations as registration
        on registration.id = roster.race_registration_id
      join public.team_seasons as team_season
        on team_season.id = registration.team_season_id
      where result.status = 'classified'
        and result.final_rank = 1
        and race.is_monument
        and exists (
          select 1 from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = team_season.team_id
        );

    when 'distinct_monument_wins' then
      select count(distinct race.id)::integer into v_value
      from public.race_results as result
      join public.race_editions as edition
        on edition.id = result.race_edition_id
      join public.races as race on race.id = edition.race_id
      join public.race_rosters as roster on roster.id = result.race_roster_id
      join public.race_registrations as registration
        on registration.id = roster.race_registration_id
      join public.team_seasons as team_season
        on team_season.id = registration.team_season_id
      where result.status = 'classified'
        and result.final_rank = 1
        and race.is_monument
        and exists (
          select 1 from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = team_season.team_id
        );

    when 'grand_tour_participations' then
      select count(*)::integer into v_value
      from public.race_registrations as registration
      join public.team_seasons as team_season
        on team_season.id = registration.team_season_id
      join public.race_editions as edition
        on edition.id = registration.race_edition_id
      join public.races as race on race.id = edition.race_id
      where registration.status = 'accepted'
        and edition.status = 'completed'
        and race.is_grand_tour
        and exists (
          select 1 from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = team_season.team_id
        );

    when 'grand_tour_stage_wins' then
      select count(*)::integer into v_value
      from public.stage_results as result
      join public.stages as stage on stage.id = result.stage_id
      join public.race_editions as edition on edition.id = stage.race_edition_id
      join public.races as race on race.id = edition.race_id
      join public.race_rosters as roster on roster.id = result.race_roster_id
      join public.race_registrations as registration
        on registration.id = roster.race_registration_id
      join public.team_seasons as team_season
        on team_season.id = registration.team_season_id
      where result.status = 'finished'
        and result.rank = 1
        and race.is_grand_tour
        and exists (
          select 1 from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = team_season.team_id
        );

    when 'grand_tour_gc_wins' then
      select count(*)::integer into v_value
      from public.race_results as result
      join public.race_editions as edition
        on edition.id = result.race_edition_id
      join public.races as race on race.id = edition.race_id
      join public.race_rosters as roster on roster.id = result.race_roster_id
      join public.race_registrations as registration
        on registration.id = roster.race_registration_id
      join public.team_seasons as team_season
        on team_season.id = registration.team_season_id
      where result.status = 'classified'
        and result.final_rank = 1
        and race.is_grand_tour
        and exists (
          select 1 from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = team_season.team_id
        );

    when 'uci_number_one_riders' then
      select count(*)::integer into v_value
      from public.rider_season_summaries as summary
      join public.seasons as summary_season on summary_season.id = summary.season_id
      where summary.uci_rank = 1
        and summary_season.status = 'completed'
        and exists (
          select 1
          from public.rider_contracts as contract
          join public.seasons as start_season
            on start_season.id = contract.start_season_id
          join public.seasons as end_season
            on end_season.id = contract.end_season_id
          join public.team_manager_assignments as assignment
            on assignment.team_id = contract.team_id
          where contract.rider_id = summary.rider_id
            and contract.status in ('active', 'completed', 'terminated')
            and summary_season.game_year between
              start_season.game_year and end_season.game_year
            and assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
        );

    when 'uci_top_ten_finishes' then
      select count(*)::integer into v_value
      from public.rider_season_summaries as summary
      join public.seasons as summary_season on summary_season.id = summary.season_id
      where summary.uci_rank between 1 and 10
        and summary_season.status = 'completed'
        and exists (
          select 1
          from public.rider_contracts as contract
          join public.seasons as start_season
            on start_season.id = contract.start_season_id
          join public.seasons as end_season
            on end_season.id = contract.end_season_id
          join public.team_manager_assignments as assignment
            on assignment.team_id = contract.team_id
          where contract.rider_id = summary.rider_id
            and contract.status in ('active', 'completed', 'terminated')
            and summary_season.game_year between
              start_season.game_year and end_season.game_year
            and assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
        );

    when 'team_uci_number_one_seasons' then
      select count(*)::integer into v_value
      from public.team_seasons as team_season
      join public.seasons as season on season.id = team_season.season_id
      where team_season.final_rank = 1
        and season.status = 'completed'
        and exists (
          select 1 from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = team_season.team_id
        );

    when 'completed_youth_scouting' then
      select count(*)::integer into v_value
      from public.youth_scouting_missions as mission
      where mission.status = 'completed'
        and exists (
          select 1 from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = mission.team_id
        );

    when 'youth_academy_signings' then
      select count(*)::integer into v_value
      from public.youth_academy_riders as youth
      where exists (
        select 1 from public.team_manager_assignments as assignment
        where assignment.sporting_director_id = p_director_id
          and assignment.role = 'general_manager'
          and assignment.team_id = youth.team_id
      );

    when 'youth_promotions' then
      select count(*)::integer into v_value
      from public.youth_academy_riders as youth
      where youth.promoted_rider_id is not null
        and exists (
          select 1 from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = youth.team_id
        );

    when 'completed_training_sessions' then
      select count(*)::integer into v_value
      from public.rider_training_sessions as session
      where session.status = 'completed'
        and exists (
          select 1 from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = session.team_id
        );

    when 'completed_form_camps' then
      select count(*)::integer into v_value
      from public.rider_form_camps as camp
      join public.team_seasons as team_season
        on team_season.id = camp.team_season_id
      where camp.status = 'completed'
        and camp.camp_type in ('classic', 'premium')
        and exists (
          select 1 from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = team_season.team_id
        );

    when 'completed_reconnaissances' then
      select count(*)::integer into v_value
      from public.stage_reconnaissances as reconnaissance
      join public.team_seasons as team_season
        on team_season.id = reconnaissance.team_season_id
      where reconnaissance.status = 'completed'
        and exists (
          select 1 from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = team_season.team_id
        );

    when 'nutrition_interventions' then
      select count(*)::integer into v_value
      from public.rider_nutrition_interventions as intervention
      join public.team_seasons as team_season
        on team_season.id = intervention.team_season_id
      where exists (
        select 1 from public.team_manager_assignments as assignment
        where assignment.sporting_director_id = p_director_id
          and assignment.role = 'general_manager'
          and assignment.team_id = team_season.team_id
      );

    when 'nutrition_form_gained' then
      select coalesce(sum(intervention.actual_form_gain), 0)::integer into v_value
      from public.rider_nutrition_interventions as intervention
      join public.team_seasons as team_season
        on team_season.id = intervention.team_season_id
      where exists (
        select 1 from public.team_manager_assignments as assignment
        where assignment.sporting_director_id = p_director_id
          and assignment.role = 'general_manager'
          and assignment.team_id = team_season.team_id
      );

    when 'physio_form_saved' then
      select coalesce(sum(saved_form.points), 0)::integer into v_value
      from (
        select effect.physiotherapist_form_protection::integer as points
        from public.stage_rider_condition_effects as effect
        join public.stages as stage on stage.id = effect.stage_id
        join public.race_rosters as roster on roster.rider_id = effect.rider_id
        join public.race_registrations as registration
          on registration.id = roster.race_registration_id
         and registration.race_edition_id = stage.race_edition_id
        join public.team_seasons as team_season
          on team_season.id = registration.team_season_id
        where effect.physiotherapist_form_protection > 0
          and exists (
            select 1 from public.team_manager_assignments as assignment
            where assignment.sporting_director_id = p_director_id
              and assignment.role = 'general_manager'
              and assignment.team_id = team_season.team_id
          )

        union all

        select effect.physiotherapist_form_protection::integer as points
        from public.rider_injury_form_effects as effect
        join public.season_days as day on day.id = effect.season_day_id
        join public.seasons as effect_season on effect_season.id = day.season_id
        where effect.physiotherapist_form_protection > 0
          and exists (
            select 1
            from public.rider_contracts as contract
            join public.seasons as start_season
              on start_season.id = contract.start_season_id
            join public.seasons as end_season
              on end_season.id = contract.end_season_id
            join public.team_manager_assignments as assignment
              on assignment.team_id = contract.team_id
            where contract.rider_id = effect.rider_id
              and contract.status in ('active', 'completed', 'terminated')
              and effect_season.game_year between
                start_season.game_year and end_season.game_year
              and assignment.sporting_director_id = p_director_id
              and assignment.role = 'general_manager'
          )

        union all

        select greatest(
          0,
          session.form_delta + round((session.intensity - 50) / 2.0)::integer
        ) as points
        from public.rider_training_sessions as session
        where session.status = 'completed'
          and session.intensity > 50
          and session.physiotherapist_level > 0
          and exists (
            select 1 from public.team_manager_assignments as assignment
            where assignment.sporting_director_id = p_director_id
              and assignment.role = 'general_manager'
              and assignment.team_id = session.team_id
          )
      ) as saved_form;

    when 'all_required_tutorials_completed' then
      if to_regclass('public.tutorial_progress') is null then
        v_value := 0;
      else
        execute $tutorial$
          select case
            when count(*) > 0
             and bool_and(coalesce(progress.status = 'completed', false))
              then 1
            else 0
          end::integer
          from public.game_required_tutorials as required
          left join public.tutorial_progress as progress
            on progress.tutorial_key = required.tutorial_key
           and progress.sporting_director_id = $1
          where required.is_active
        $tutorial$
        into v_value
        using p_director_id;
      end if;

    else
      return null;
  end case;

  return greatest(0, coalesce(v_value, 0));
end;
$$;

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
  v_value := public.calculate_expanded_game_objective_progress(
    p_metric_key,
    p_director_id
  );

  if v_value is not null then
    return v_value;
  end if;

  return public.calculate_game_objective_progress_base(
    p_metric_key,
    p_director_id,
    p_current_team_id,
    p_experience_points
  );
end;
$$;

revoke all on function public.calculate_expanded_game_objective_progress(text, uuid)
  from public, anon, authenticated;
grant execute on function public.calculate_expanded_game_objective_progress(text, uuid)
  to service_role;

revoke all on function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
  to service_role;

-- ============================================================
-- BIBLIOTHÈQUE D'OBJECTIFS
-- ============================================================

update public.game_objective_definitions
set is_active = false,
    updated_at = now()
where objective_key = 'complete_tutorial';

insert into public.game_objective_definitions (
  objective_key,
  objective_type,
  objective_group,
  title,
  description,
  metric_key,
  target_value,
  reward_cash,
  reward_experience,
  reward_reputation,
  reward_inventory_item_key,
  reward_equipment_catalog_key,
  reward_random_special_ability,
  display_order,
  is_active
)
values
  ('tutorial_mastery', 'secondary', 'tutorials', 'Finir tous les didacticiels', 'Suivre jusqu''au bout tous les didacticiels de toutes les rubriques du jeu.', 'all_required_tutorials_completed', 1, 50000, 150, 5, null, null, true, 1000, true),

  ('monument_participation_1', 'secondary', 'monuments', 'Entrer dans la légende', 'Prendre le départ d''un Monument et le mener à son terme avec l''équipe.', 'monument_participations', 1, 20000, 80, 2, null, null, false, 1100, true),
  ('monument_participation_5', 'secondary', 'monuments', 'Campagne des classiques', 'Achever cinq participations à des Monuments.', 'monument_participations', 5, 50000, 160, 4, null, null, false, 1110, true),
  ('monument_win_1', 'secondary', 'monuments', 'Un pavé dans l''histoire', 'Remporter un Monument avec l''un de vos coureurs.', 'monument_wins', 1, 75000, 220, 8, null, null, true, 1120, true),
  ('monument_win_5', 'secondary', 'monuments', 'Dynastie des classiques', 'Remporter cinq Monuments au cours de votre carrière.', 'monument_wins', 5, 175000, 450, 15, null, null, true, 1130, true),
  ('all_monuments_won', 'secondary', 'monuments', 'Le pentacle des classiques', 'Gagner au moins une édition de chacun des cinq Monuments.', 'distinct_monument_wins', 5, 250000, 600, 20, null, null, true, 1140, true),

  ('grand_tour_participation_1', 'secondary', 'grand_tours', 'Trois semaines au sommet', 'Achever une participation à un Grand Tour.', 'grand_tour_participations', 1, 30000, 100, 3, null, null, false, 1200, true),
  ('grand_tour_participation_3', 'secondary', 'grand_tours', 'Le cercle des trois Tours', 'Achever trois participations à des Grands Tours.', 'grand_tour_participations', 3, 75000, 220, 7, null, null, false, 1210, true),
  ('grand_tour_stage_win_1', 'secondary', 'grand_tours', 'Lever les bras sur un Grand Tour', 'Remporter une étape de Grand Tour.', 'grand_tour_stage_wins', 1, 40000, 140, 5, null, null, true, 1220, true),
  ('grand_tour_stage_win_5', 'secondary', 'grand_tours', 'Chasseur d''étapes', 'Remporter cinq étapes de Grand Tour.', 'grand_tour_stage_wins', 5, 100000, 300, 10, null, null, true, 1230, true),
  ('grand_tour_gc_win_1', 'secondary', 'grand_tours', 'Maillot de la consécration', 'Remporter le classement général final d''un Grand Tour.', 'grand_tour_gc_wins', 1, 200000, 500, 20, null, null, true, 1240, true),

  ('uci_rider_number_one', 'secondary', 'rankings', 'Le meilleur coureur du monde', 'Terminer une saison avec l''un de vos coureurs à la première place du classement UCI.', 'uci_number_one_riders', 1, 150000, 400, 15, null, null, true, 1300, true),
  ('uci_top_ten_3', 'secondary', 'rankings', 'Une constellation de leaders', 'Cumuler trois classements de coureurs dans le top 10 UCI en fin de saison.', 'uci_top_ten_finishes', 3, 100000, 300, 10, null, null, false, 1310, true),
  ('uci_team_number_one', 'secondary', 'rankings', 'La meilleure équipe du monde', 'Terminer une saison à la première place du classement UCI par équipes.', 'team_uci_number_one_seasons', 1, 200000, 500, 20, null, null, true, 1320, true),

  ('youth_scouting_1', 'secondary', 'youth', 'L''œil du recruteur', 'Achever une première mission de détection junior.', 'completed_youth_scouting', 1, 5000, 25, 1, null, null, false, 1400, true),
  ('youth_scouting_5', 'secondary', 'youth', 'Réseau de détection', 'Achever cinq missions de détection junior.', 'completed_youth_scouting', 5, 18000, 70, 2, null, null, false, 1410, true),
  ('youth_signing_1', 'secondary', 'youth', 'La pépite de demain', 'Accueillir un premier junior au centre de formation.', 'youth_academy_signings', 1, 8000, 35, 1, null, null, false, 1420, true),
  ('youth_signing_3', 'secondary', 'youth', 'Une génération prometteuse', 'Accueillir trois juniors au centre de formation.', 'youth_academy_signings', 3, 25000, 90, 3, null, null, false, 1430, true),
  ('youth_promotion_1', 'secondary', 'youth', 'De l''académie au peloton', 'Promouvoir un junior dans l''effectif professionnel.', 'youth_promotions', 1, 30000, 120, 4, null, null, true, 1440, true),
  ('youth_promotion_5', 'secondary', 'youth', 'Fabrique de champions', 'Promouvoir cinq juniors dans l''effectif professionnel.', 'youth_promotions', 5, 100000, 300, 10, null, null, true, 1450, true),

  ('training_sessions_25', 'secondary', 'training', 'La régularité paie', 'Achever vingt-cinq séances d''entraînement.', 'completed_training_sessions', 25, 10000, 45, 1, null, null, false, 1500, true),
  ('training_sessions_100', 'secondary', 'training', 'Méthode et constance', 'Achever cent séances d''entraînement.', 'completed_training_sessions', 100, 40000, 150, 4, null, null, false, 1510, true),
  ('form_camps_1', 'secondary', 'training', 'Changer d''air', 'Achever un premier stage de forme classique ou premium.', 'completed_form_camps', 1, 7000, 30, 1, null, null, false, 1520, true),
  ('form_camps_10', 'secondary', 'training', 'Planificateur de pics', 'Achever dix stages de forme classiques ou premium.', 'completed_form_camps', 10, 35000, 130, 4, null, null, false, 1530, true),

  ('reconnaissance_1', 'secondary', 'reconnaissance', 'Connaître chaque virage', 'Achever un premier stage de reconnaissance.', 'completed_reconnaissances', 1, 10000, 40, 1, null, null, false, 1600, true),
  ('reconnaissance_10', 'secondary', 'reconnaissance', 'Cartographe du peloton', 'Achever dix stages de reconnaissance.', 'completed_reconnaissances', 10, 45000, 160, 5, null, null, true, 1610, true),

  ('nutrition_interventions_5', 'secondary', 'health', 'Le bon carburant', 'Réaliser cinq interventions nutritionnelles.', 'nutrition_interventions', 5, 8000, 35, 1, null, null, false, 1700, true),
  ('nutrition_interventions_25', 'secondary', 'health', 'Cuisine de la performance', 'Réaliser vingt-cinq interventions nutritionnelles.', 'nutrition_interventions', 25, 30000, 110, 3, null, null, false, 1710, true),
  ('nutrition_form_25', 'secondary', 'health', 'Énergie bien dépensée', 'Faire regagner vingt-cinq points de forme grâce à la nutrition.', 'nutrition_form_gained', 25, 25000, 100, 3, null, null, false, 1720, true),
  ('physio_form_saved_10', 'secondary', 'health', 'Des jambes préservées', 'Économiser dix points de forme grâce au travail des kinés.', 'physio_form_saved', 10, 18000, 70, 2, null, null, false, 1730, true),
  ('physio_form_saved_50', 'secondary', 'health', 'L''art de durer', 'Économiser cinquante points de forme grâce au travail des kinés.', 'physio_form_saved', 50, 65000, 220, 7, null, null, true, 1740, true)
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

commit;
