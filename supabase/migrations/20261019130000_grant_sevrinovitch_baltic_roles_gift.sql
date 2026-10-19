begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';

do $grant_sevrinovitch_baltic_roles_gift$
declare
  v_incident_key constant text :=
    'sevrinovitch-baltic-stage2-roles-20261019';
  v_reward_key constant text := 'collective-training-225';
  v_reason constant text :=
    'Cadeau demandé par le propriétaire après le signalement de la priorité des rôles sur l’étape 2 du Tour des Pavés Baltiques.';
  v_target_count integer;
  v_director_id uuid;
  v_team_id uuid;
  v_team_season_id uuid;
  v_season_id uuid;
  v_game_year integer;
  v_reward public.daily_reward_catalog%rowtype;
  v_grant_id uuid;
  v_existing_grant public.race_incident_compensation_grants%rowtype;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(v_incident_key, 0)
  );

  with target as (
    select distinct
      director.id as director_id,
      assignment.team_id,
      team_season.id as team_season_id,
      season.id as season_id,
      season.game_year
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.seasons as season
      on season.status = 'active'
    join public.team_seasons as team_season
      on team_season.team_id = assignment.team_id
     and team_season.season_id = season.id
    where director.status = 'active'
      and director.auth_user_id is not null
      and director.id = '8406962e-41b9-4181-a372-3d57043de3a8'::uuid
      and assignment.team_id = '27948dd4-0dac-416d-8f6c-118771bcb6eb'::uuid
      and season.id = 'c0c5824c-43a4-442e-907c-265c479efa0a'::uuid
      and season.game_year = 4
      and team_season.id = 'e6caf016-72e6-45a2-b26b-3dad5fdbe99a'::uuid
  )
  select
    count(*)::integer,
    (array_agg(target.director_id))[1],
    (array_agg(target.team_id))[1],
    (array_agg(target.team_season_id))[1],
    (array_agg(target.season_id))[1],
    (array_agg(target.game_year))[1]
  into
    v_target_count,
    v_director_id,
    v_team_id,
    v_team_season_id,
    v_season_id,
    v_game_year
  from target;

  if v_target_count = 0 then
    raise exception
      'Aucun compte actif et aucune équipe active trouvés pour Sevrinovitch.';
  end if;

  if v_target_count <> 1 then
    raise exception
      'Ciblage ambigu pour Sevrinovitch : % affectations actives trouvées.',
      v_target_count;
  end if;

  select *
  into v_reward
  from public.daily_reward_catalog
  where reward_key = v_reward_key
    and importance = 8
    and effect_kind = 'training_multiplier'
    and is_active;

  if v_reward.reward_key is null then
    raise exception
      'La Cellule performance active de niveau 8 est introuvable.';
  end if;

  insert into public.race_incident_compensation_grants (
    incident_key,
    sporting_director_id,
    team_season_id,
    season_id,
    reward_key,
    reason
  ) values (
    v_incident_key,
    v_director_id,
    v_team_season_id,
    v_season_id,
    v_reward.reward_key,
    v_reason
  )
  on conflict (incident_key, sporting_director_id) do nothing
  returning id into v_grant_id;

  if v_grant_id is null then
    select *
    into v_existing_grant
    from public.race_incident_compensation_grants
    where incident_key = v_incident_key
      and sporting_director_id = v_director_id;

    if v_existing_grant.id is null
      or v_existing_grant.team_season_id is distinct from v_team_season_id
      or v_existing_grant.season_id is distinct from v_season_id
      or v_existing_grant.reward_key is distinct from v_reward.reward_key
    then
      raise exception
        'La compensation existante de Sevrinovitch est incohérente.';
    end if;

    v_grant_id := v_existing_grant.id;
  end if;

  insert into public.daily_reward_inventory (
    sporting_director_id,
    team_season_id,
    source_claim_id,
    source_referral_reward_id,
    source_auction_compensation_id,
    source_longevity_trophy_reward_id,
    source_international_selection_compensation_id,
    source_race_incident_compensation_id,
    reward_key,
    expires_after_game_year
  )
  select
    v_director_id,
    v_team_season_id,
    null,
    null,
    null,
    null,
    null,
    v_grant_id,
    v_reward.reward_key,
    v_game_year + 1
  where not exists (
    select 1
    from public.daily_reward_inventory as inventory
    where inventory.source_race_incident_compensation_id = v_grant_id
  );

  insert into public.sporting_director_messages (
    sporting_director_id,
    season_id,
    team_season_id,
    message_type,
    sender_name,
    subject,
    preview,
    body,
    action_href,
    action_label,
    source_reference,
    is_important
  ) values (
    v_director_id,
    v_season_id,
    v_team_season_id,
    'system',
    'Direction de Cyclo Stratège',
    'Cadeau · Tour des Pavés Baltiques',
    'Un objet de niveau 8 vous a été attribué.',
    E'Merci d’avoir signalé l’incohérence des rôles sur l’étape 2 du Tour des Pavés Baltiques. Le problème de priorité des rôles a été corrigé.\n\nVous recevez un cadeau de niveau 8 : « ' || v_reward.name || E' ». Cet objet multiplie par 2,25 la progression de votre prochaine séance collective lorsqu’il est utilisé. Il est disponible dès maintenant dans votre inventaire.',
    '/jeu/inventaire',
    'Voir mon cadeau',
    'race-incident-compensation:' || v_incident_key || ':' ||
      v_director_id::text,
    true
  )
  on conflict (sporting_director_id, source_reference) do nothing;

  raise notice
    'Objet % de niveau 8 attribué à Sevrinovitch (DS %, équipe %, saison d’équipe %).',
    v_reward.name,
    v_director_id,
    v_team_id,
    v_team_season_id;
end;
$grant_sevrinovitch_baltic_roles_gift$;

commit;
