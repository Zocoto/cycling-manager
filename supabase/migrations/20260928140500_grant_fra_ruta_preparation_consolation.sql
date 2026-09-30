begin;

do $grant_fra_ruta_consolation$
declare
  v_incident_key constant text :=
    'ruta-preparation-missing-stage-plan-20260928';
  v_director_id constant uuid :=
    '2ac12cfa-b9a5-43ea-bf34-3685e07e0d89';
  v_team_id constant uuid :=
    '35061203-aa19-4986-83e1-b227cea4ecb5';
  v_team_season_id constant uuid :=
    'e911b082-1e24-428f-b331-9c790492aee9';
  v_season_id constant uuid :=
    '74a7fd2f-ee7a-4d3f-bfe5-a97d0909d6c6';
  v_reward_key constant text := 'elite-equipment';
  v_reason constant text :=
    'Cadeau de consolation après le blocage de la préparation de la Ruta de las Sierras provoqué par un plan d’étape manquant.';
  v_reward public.daily_reward_catalog%rowtype;
  v_grant_id uuid;
  v_existing_grant public.race_incident_compensation_grants%rowtype;
begin
  if not exists (
    select 1
    from public.sporting_directors as director
    where director.id = v_director_id
      and director.username = 'Fra Troisset'
      and director.display_name = 'Fra Troisset'
      and director.status = 'active'
      and director.auth_user_id is not null
  ) then
    raise exception 'Le compte actif de Fra Troisset est introuvable.';
  end if;

  if not exists (
    select 1
    from public.team_manager_assignments as assignment
    where assignment.sporting_director_id = v_director_id
      and assignment.team_id = v_team_id
      and assignment.role = 'general_manager'
      and assignment.status = 'active'
  ) then
    raise exception 'L’affectation active de Fra Troisset est introuvable.';
  end if;

  if not exists (
    select 1
    from public.team_seasons as team_season
    join public.seasons as season on season.id = team_season.season_id
    where team_season.id = v_team_season_id
      and team_season.team_id = v_team_id
      and team_season.season_id = v_season_id
      and team_season.display_name = 'Kaffa Origins'
      and season.status = 'active'
      and season.game_year = 3
  ) then
    raise exception 'La saison active de Kaffa Origins est introuvable.';
  end if;

  select *
  into v_reward
  from public.daily_reward_catalog
  where reward_key = v_reward_key
    and importance = 8
    and effect_kind = 'equipment'
    and is_active;

  if v_reward.reward_key is null then
    raise exception 'Le Prototype de compétition actif de niveau 8 est introuvable.';
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
      raise exception 'La compensation existante de Fra Troisset est incohérente.';
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
    4
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
    'Cadeau de consolation · Ruta de las Sierras',
    'Un Prototype de compétition vous a été attribué.',
    E'Merci d’avoir signalé le blocage qui empêchait l’accès à la préparation de la Ruta de las Sierras. Le défaut lié au plan d’étape manquant a été corrigé et la page est de nouveau accessible.\n\nEn cadeau de consolation, vous recevez un objet de niveau 8 : « ' || v_reward.name || ' ». Il est disponible dans votre inventaire.',
    '/jeu/inventaire',
    'Voir mon cadeau',
    'race-incident-compensation:' || v_incident_key || ':' ||
      v_director_id::text,
    true
  )
  on conflict (sporting_director_id, source_reference) do nothing;
end;
$grant_fra_ruta_consolation$;

commit;
