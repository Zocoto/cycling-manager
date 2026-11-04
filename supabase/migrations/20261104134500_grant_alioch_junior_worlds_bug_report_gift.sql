begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';
set local application_name = 'alioch-junior-worlds-bug-report-gift';

do $grant_alioch_gift$
declare
  v_incident constant text := 'alioch-junior-worlds-bug-report-20261104';
  v_director constant uuid := 'f1437c24-ad40-44e4-b508-f08d610a3a9d';
  v_team constant uuid := 'a81d26fc-5b1f-4267-8c60-073d53389733';
  v_team_season constant uuid := '58b44d6a-931a-461d-8991-f4efbb4371ab';
  v_season constant uuid := 'c0c5824c-43a4-442e-907c-265c479efa0a';
  v_year integer;
  v_reward public.daily_reward_catalog%rowtype;
  v_grant public.race_incident_compensation_grants%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_incident, 0));
  select s.game_year into strict v_year
  from public.sporting_directors d
  join public.team_manager_assignments a on a.sporting_director_id=d.id
    and a.team_id=v_team and a.role='general_manager' and a.status='active'
  join public.team_seasons ts on ts.team_id=a.team_id and ts.id=v_team_season
  join public.seasons s on s.id=ts.season_id and s.id=v_season
  where d.id=v_director and d.username='Alioch4' and d.status='active'
    and d.auth_user_id is not null and s.status='active' and s.game_year=4;

  select * into strict v_reward from public.daily_reward_catalog
  where reward_key='high-performance-cell' and importance=10 and is_active
    and effect_kind='rating_boost'
    and effect_payload @> '{"amount":2,"statScope":"primary","maximumRating":80}'::jsonb;

  insert into public.race_incident_compensation_grants (
    incident_key,sporting_director_id,team_season_id,season_id,reward_key,reason
  ) values (
    v_incident,v_director,v_team_season,v_season,v_reward.reward_key,
    'Cadeau de niveau 10 demandé par le propriétaire en compensation des anomalies des courses juniors et en remerciement du signalement ayant permis leur correction.'
  ) on conflict (incident_key,sporting_director_id) do nothing;
  select * into strict v_grant from public.race_incident_compensation_grants
  where incident_key=v_incident and sporting_director_id=v_director;
  if v_grant.team_season_id is distinct from v_team_season
    or v_grant.season_id is distinct from v_season
    or v_grant.reward_key is distinct from v_reward.reward_key then
    raise exception 'Compensation existante incohérente pour Alioch4.';
  end if;

  insert into public.daily_reward_inventory (
    sporting_director_id,team_season_id,source_race_incident_compensation_id,
    reward_key,expires_after_game_year
  ) values (v_director,v_team_season,v_grant.id,v_reward.reward_key,v_year+1)
  on conflict (source_race_incident_compensation_id) do nothing;
  if not exists (
    select 1 from public.daily_reward_inventory
    where source_race_incident_compensation_id=v_grant.id
      and sporting_director_id=v_director and team_season_id=v_team_season
      and reward_key=v_reward.reward_key
  ) then
    raise exception 'Cadeau existant incohérent pour Alioch4.';
  end if;

  insert into public.sporting_director_messages (
    sporting_director_id,season_id,team_season_id,message_type,sender_name,
    subject,preview,body,action_href,action_label,source_reference,is_important
  ) values (
    v_director,v_season,v_team_season,'system','Direction de Cyclo Stratège',
    'Merci pour votre signalement · courses juniors',
    'Une Cellule haute performance de niveau 10 vous a été offerte.',
    E'Merci pour votre signalement concernant les résultats des Mondiaux juniors. Il a permis d’identifier et de corriger la puissance excessive des bots ainsi que le calcul du bonus du matériel fédéral.\n\nEn compensation et pour vous remercier de votre aide, nous vous offrons une « Cellule haute performance » de niveau 10, disponible dès maintenant dans votre inventaire.\n\nLe correctif est actif pour les prochaines simulations ; les résultats déjà publiés restent conservés.',
    '/jeu/inventaire','Voir mon cadeau',
    'race-incident-compensation:'||v_incident||':'||v_director::text,true
  ) on conflict (sporting_director_id,source_reference) do nothing;
end;
$grant_alioch_gift$;

commit;
