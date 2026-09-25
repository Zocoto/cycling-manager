begin;

-- Compensation générique, traçable et réutilisable pour les incidents de course.
create table if not exists public.race_incident_compensation_grants (
  id uuid primary key default gen_random_uuid(),
  incident_key text not null,
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  team_season_id uuid not null
    references public.team_seasons(id) on delete cascade,
  season_id uuid not null
    references public.seasons(id) on delete cascade,
  reward_key text not null
    references public.daily_reward_catalog(reward_key) on delete restrict,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint race_incident_compensation_incident_present
    check (btrim(incident_key) <> ''),
  constraint race_incident_compensation_reason_present
    check (btrim(reason) <> ''),
  constraint race_incident_compensation_once
    unique (incident_key, sporting_director_id)
);

alter table public.race_incident_compensation_grants enable row level security;

grant all privileges
on table public.race_incident_compensation_grants
to service_role;

alter table public.daily_reward_inventory
  add column if not exists source_race_incident_compensation_id uuid unique
    references public.race_incident_compensation_grants(id)
    on delete cascade;

alter table public.daily_reward_inventory
  drop constraint daily_reward_inventory_exactly_one_source;

alter table public.daily_reward_inventory
  add constraint daily_reward_inventory_exactly_one_source
  check (
    num_nonnulls(
      source_claim_id,
      source_referral_reward_id,
      source_auction_compensation_id,
      source_longevity_trophy_reward_id,
      source_international_selection_compensation_id,
      source_race_incident_compensation_id
    ) = 1
  );

do $grant_consolation$
declare
  v_incident_key constant text :=
    'boucle-provinces-stage9-race-dynamics-v35-20260925';
  v_season_id constant uuid := '74a7fd2f-ee7a-4d3f-bfe5-a97d0909d6c6';
  v_reward_key constant text := 'elite-equipment';
  v_reason constant text :=
    'Cadeau de consolation après les écarts de comportement signalés sur la dernière étape de la Boucle des Provinces, corrigés par le moteur v35.';
  v_season public.seasons%rowtype;
  v_reward public.daily_reward_catalog%rowtype;
  v_target record;
  v_grant_id uuid;
  v_existing_grant public.race_incident_compensation_grants%rowtype;
begin
  select *
  into v_season
  from public.seasons
  where id = v_season_id
    and status = 'active';

  if v_season.id is null or v_season.game_year is distinct from 3 then
    raise exception 'La saison active attendue pour la compensation est introuvable.';
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

  for v_target in
    select *
    from (
      values
        (
          'd7ec0ccf-bcb4-4802-8a14-b458eccf41d7'::uuid,
          '803e9755-570b-48ba-9b2d-6bbf5d8312d4'::uuid,
          '48e1dbbe-be1f-4e5c-abfa-8cbf2e66a9f9'::uuid,
          'Ujik'::text,
          'Hexa Bâtiment'::text
        ),
        (
          '69334b61-e63a-49fd-8eb6-1ed901c5ec98'::uuid,
          'c9db310c-1a90-4df5-9f78-fd48c8147425'::uuid,
          '57925ad3-5a5b-47b7-84e1-18cd68efa67d'::uuid,
          'Romain Bardet'::text,
          'Montecristi Toquilla House'::text
        )
    ) as target(
      sporting_director_id,
      team_id,
      team_season_id,
      director_name,
      team_name
    )
  loop
    if not exists (
      select 1
      from public.sporting_directors as director
      where director.id = v_target.sporting_director_id
        and director.username = v_target.director_name
        and director.display_name = v_target.director_name
        and director.status = 'active'
        and director.auth_user_id is not null
    ) then
      raise exception 'Le Directeur Sportif % est introuvable ou inactif.',
        v_target.director_name;
    end if;

    if not exists (
      select 1
      from public.team_manager_assignments as assignment
      where assignment.sporting_director_id = v_target.sporting_director_id
        and assignment.team_id = v_target.team_id
        and assignment.role = 'general_manager'
        and assignment.status = 'active'
    ) then
      raise exception 'L’affectation active de % est introuvable.',
        v_target.director_name;
    end if;

    if not exists (
      select 1
      from public.team_seasons as team_season
      where team_season.id = v_target.team_season_id
        and team_season.team_id = v_target.team_id
        and team_season.season_id = v_season_id
        and team_season.display_name = v_target.team_name
    ) then
      raise exception 'La saison d’équipe de % est introuvable.',
        v_target.team_name;
    end if;

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
        and sporting_director_id = v_target.sporting_director_id;

      if v_existing_grant.id is null
        or v_existing_grant.team_season_id is distinct from v_target.team_season_id
        or v_existing_grant.season_id is distinct from v_season_id
        or v_existing_grant.reward_key is distinct from v_reward.reward_key
      then
        raise exception 'Compensation existante incohérente pour %.',
          v_target.director_name;
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
    )
    select
      v_target.sporting_director_id,
      v_season_id,
      v_target.team_season_id,
      'system',
      'Direction de Cyclo Stratège',
      'Cadeau de consolation · Boucle des Provinces',
      'Un objet de niveau 8 vous a été attribué.',
      E'Merci d’avoir signalé les écarts de comportement observés sur la dernière étape de la Boucle des Provinces. Le moteur de course a été corrigé et la version 35 est maintenant active.\n\nEn cadeau de consolation, vous recevez un objet de niveau 8 : « ' || v_reward.name || ' ». Il est disponible dans votre inventaire.',
      '/jeu/inventaire',
      'Voir mon cadeau',
      'race-incident-compensation:' || v_incident_key || ':' ||
        v_target.sporting_director_id::text,
      true
    where not exists (
      select 1
      from public.sporting_director_messages as message
      where message.source_reference =
        'race-incident-compensation:' || v_incident_key || ':' ||
          v_target.sporting_director_id::text
    );
  end loop;
end;
$grant_consolation$;

notify pgrst, 'reload schema';

commit;
