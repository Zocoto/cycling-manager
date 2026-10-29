begin;
set local lock_timeout = '1s';
set local statement_timeout = '5s';
set local application_name = 'ujik-baltic-failed-chase-gift';

do $grant_ujik_baltic_gift$
declare
  v_incident constant text := 'ujik-baltic-cobbles-failed-chase-20261029';
  v_director constant uuid := 'd7ec0ccf-bcb4-4802-8a14-b458eccf41d7';
  v_team constant uuid := '803e9755-570b-48ba-9b2d-6bbf5d8312d4';
  v_team_season constant uuid := '3945ad38-a7bc-41c2-b3b1-4826044f2e9b';
  v_season constant uuid := 'c0c5824c-43a4-442e-907c-265c479efa0a';
  v_year integer;
  v_reward public.daily_reward_catalog%rowtype;
  v_grant public.race_incident_compensation_grants%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_incident, 0));

  select season.game_year into strict v_year
  from public.sporting_directors director
  join public.team_manager_assignments assignment
    on assignment.sporting_director_id = director.id
   and assignment.team_id = v_team
   and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.team_seasons team_season
    on team_season.team_id = assignment.team_id
   and team_season.id = v_team_season
  join public.seasons season
    on season.id = team_season.season_id and season.id = v_season
  where director.id = v_director and lower(btrim(director.username)) = 'ujik'
    and director.status = 'active' and director.auth_user_id is not null
    and season.status = 'active' and season.game_year = 4;

  select * into strict v_reward
  from public.daily_reward_catalog
  where reward_key = 'primary-breakthrough' and importance = 9
    and effect_kind = 'rating_boost' and is_active
    and effect_payload @> '{"amount":1,"statScope":"primary"}'::jsonb;

  insert into public.race_incident_compensation_grants (
    incident_key, sporting_director_id, team_season_id, season_id, reward_key, reason
  ) values (
    v_incident, v_director, v_team_season, v_season, v_reward.reward_key,
    'Compensation demandée par le propriétaire pour le décrochage artificiel de Kulmane après une poursuite ratée sur Baltic Cobbles du 28 octobre 2026.'
  ) on conflict (incident_key, sporting_director_id) do nothing;

  select * into strict v_grant
  from public.race_incident_compensation_grants
  where incident_key = v_incident and sporting_director_id = v_director;
  if v_grant.team_season_id is distinct from v_team_season
    or v_grant.season_id is distinct from v_season
    or v_grant.reward_key is distinct from v_reward.reward_key then
    raise exception 'Compensation Baltic Cobbles existante incohérente pour Ujik.';
  end if;

  insert into public.daily_reward_inventory (
    sporting_director_id, team_season_id, source_race_incident_compensation_id,
    reward_key, expires_after_game_year
  ) values (
    v_director, v_team_season, v_grant.id, v_reward.reward_key, v_year + 1
  ) on conflict (source_race_incident_compensation_id) do nothing;

  if not exists (
    select 1 from public.daily_reward_inventory
    where source_race_incident_compensation_id = v_grant.id
      and sporting_director_id = v_director and team_season_id = v_team_season
      and reward_key = v_reward.reward_key
  ) then
    raise exception 'Cadeau Baltic Cobbles existant incohérent pour Ujik.';
  end if;

  insert into public.sporting_director_messages (
    sporting_director_id, season_id, team_season_id, message_type, sender_name,
    subject, preview, body, action_href, action_label, source_reference, is_important
  ) values (
    v_director, v_season, v_team_season, 'system', 'Direction de Cyclo Stratège',
    'Compensation · Baltic Cobbles', 'Un cadeau de niveau 9 vous a été attribué.',
    E'Pour compenser le décrochage artificiel de Kulmane après sa tentative de poursuite sur Baltic Cobbles, vous recevez un cadeau de niveau 9 : « '
      || v_reward.name || E' ».\n\nCet objet permet de gagner +1 sur une note principale du coureur de votre choix. Il est disponible dès maintenant dans votre inventaire. La règle de poursuite a été corrigée pour les prochaines simulations.',
    '/jeu/inventaire', 'Voir mon cadeau',
    'race-incident-compensation:' || v_incident || ':' || v_director::text, true
  ) on conflict (sporting_director_id, source_reference) do nothing;
end;
$grant_ujik_baltic_gift$;

commit;
