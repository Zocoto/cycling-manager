begin;

do $compensate_peloponnese_live_ranking$
declare
  v_incident_key constant text :=
    'peloponnese-live-finish-order-20261008';
  v_edition_id constant uuid :=
    'fb8bd3b9-ac38-4e63-ad17-86a6610e13ad';
  v_reward_key constant text := 'performance-equipment';
  v_reason constant text :=
    'Geste de réparation après l’affichage d’un ordre de groupe comme classement final dans le live de la Classique du Péloponnèse.';
  v_target_count integer;
  v_edition public.race_editions%rowtype;
  v_season public.seasons%rowtype;
  v_reward public.daily_reward_catalog%rowtype;
  v_target record;
  v_grant_id uuid;
  v_existing_grant public.race_incident_compensation_grants%rowtype;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(v_incident_key, 0)
  );

  select *
  into v_edition
  from public.race_editions
  where id = v_edition_id
    and display_name = 'Classique du Péloponnèse'
    and status = 'completed';

  if v_edition.id is null then
    raise exception
      'L’édition terminée de la Classique du Péloponnèse est introuvable.';
  end if;

  select *
  into v_season
  from public.seasons
  where id = v_edition.season_id;

  if v_season.id is null then
    raise exception 'La saison de la Classique du Péloponnèse est introuvable.';
  end if;

  select *
  into v_reward
  from public.daily_reward_catalog
  where reward_key = v_reward_key
    and importance = 4
    and effect_kind = 'equipment'
    and is_active;

  if v_reward.reward_key is null then
    raise exception 'Le Matériel performance actif de niveau 4 est introuvable.';
  end if;

  select count(*)::integer
  into v_target_count
  from (
    select distinct director.id
    from public.race_registrations as registration
    join public.team_seasons as team_season
      on team_season.id = registration.team_season_id
    join public.team_manager_assignments as assignment
      on assignment.team_id = team_season.team_id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
     and director.status = 'active'
     and director.auth_user_id is not null
    where registration.race_edition_id = v_edition_id
      and registration.status = 'accepted'
  ) as target_directors;

  if v_target_count <> 10 then
    raise exception
      'Périmètre de compensation inattendu : % membres au lieu de 10.',
      v_target_count;
  end if;

  for v_target in
    select distinct
      director.id as sporting_director_id,
      team_season.id as team_season_id,
      team_season.display_name as team_name
    from public.race_registrations as registration
    join public.team_seasons as team_season
      on team_season.id = registration.team_season_id
    join public.team_manager_assignments as assignment
      on assignment.team_id = team_season.team_id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
     and director.status = 'active'
     and director.auth_user_id is not null
    where registration.race_edition_id = v_edition_id
      and registration.status = 'accepted'
  loop
    v_grant_id := null;

    insert into public.race_incident_compensation_grants (
      incident_key,
      sporting_director_id,
      team_season_id,
      season_id,
      reward_key,
      reason
    ) values (
      v_incident_key,
      v_target.sporting_director_id,
      v_target.team_season_id,
      v_season.id,
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
        and sporting_director_id = v_target.sporting_director_id;

      if v_existing_grant.id is null
        or v_existing_grant.team_season_id is distinct from
          v_target.team_season_id
        or v_existing_grant.season_id is distinct from v_season.id
        or v_existing_grant.reward_key is distinct from v_reward.reward_key
      then
        raise exception
          'Compensation existante incohérente pour l’équipe %.',
          v_target.team_name;
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
      v_target.sporting_director_id,
      v_target.team_season_id,
      null,
      null,
      null,
      null,
      null,
      v_grant_id,
      v_reward.reward_key,
      v_season.game_year + 1
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
      v_target.sporting_director_id,
      v_season.id,
      v_target.team_season_id,
      'system',
      'Direction de Cyclo Stratège',
      'Excuses · classement live du Péloponnèse',
      'Le classement officiel a été vérifié et un cadeau vous attend.',
      E'Le live de la Classique du Péloponnèse a brièvement présenté l’ordre interne du groupe de tête comme classement final. Le classement officiel n’a pas été altéré : Dijilly Sidibé est bien vainqueur, devant Anil Mirza et Abshero Tolosa. Les primes, points et palmarès ont été attribués sur ce résultat correct.\n\nLe défaut d’affichage a été corrigé. Pour la gêne occasionnée, nous vous offrons un « ' || v_reward.name || E' », disponible dès maintenant dans votre inventaire.',
      '/jeu/inventaire',
      'Voir mon cadeau',
      'race-incident-compensation:' || v_incident_key || ':' ||
        v_target.sporting_director_id::text,
      true
    )
    on conflict (sporting_director_id, source_reference) do nothing;
  end loop;

  raise notice
    'Compensation Péloponnèse attribuée à % membres.',
    v_target_count;
end;
$compensate_peloponnese_live_ranking$;

commit;
