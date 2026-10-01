begin;

do $grant_ujik_ruta_stage_role_compensation$
declare
  v_incident_key constant text :=
    'ruta-stage10-prepared-role-overridden-20261001';
  v_reason constant text :=
    'Compensation après l’écrasement des rôles préparés par le leader automatique dans le live de l’étape 10 de la Ruta de las Sierras.';
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
      and (
        lower(btrim(director.display_name)) = 'ujik'
        or lower(btrim(director.username)) = 'ujik'
      )
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
      'Aucun compte actif et aucune équipe active trouvés pour Ujik.';
  end if;

  if v_target_count <> 1 then
    raise exception
      'Ciblage ambigu pour Ujik : % affectations actives trouvées.',
      v_target_count;
  end if;

  select *
  into v_reward
  from public.daily_reward_catalog as catalog
  where catalog.is_active
    and catalog.importance = 9
  order by md5(
    catalog.reward_key || v_incident_key || v_director_id::text
  )
  limit 1;

  if v_reward.reward_key is null then
    raise exception 'Aucun cadeau actif de niveau 9 n’est disponible.';
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
        'La compensation existante d’Ujik est incohérente.';
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
    'Compensation · rôles de l’étape 10 de la Ruta',
    'Un cadeau de niveau 9 vous a été attribué.',
    E'Merci d’avoir signalé l’incohérence des rôles affichés pendant l’étape 10 de la Ruta de las Sierras. Les consignes que vous aviez préparées étaient bien enregistrées, mais le leader automatique du tour les avait écrasées dans le scénario live. Le défaut a été corrigé sans modifier les résultats de l’étape.\n\nEn compensation, vous recevez un cadeau de niveau 9 : « ' || v_reward.name || E' ». Il est disponible dans votre inventaire.',
    '/jeu/inventaire',
    'Voir mon cadeau',
    'race-incident-compensation:' || v_incident_key || ':' ||
      v_director_id::text,
    true
  )
  on conflict (sporting_director_id, source_reference) do nothing;

  raise notice
    'Cadeau % de niveau 9 attribué à Ujik (DS %, équipe %, saison d’équipe %).',
    v_reward.name,
    v_director_id,
    v_team_id,
    v_team_season_id;
end;
$grant_ujik_ruta_stage_role_compensation$;

commit;
