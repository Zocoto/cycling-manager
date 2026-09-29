begin;

do $$
declare
  v_season_id uuid;
  v_current_day_number integer;
  v_activated_count integer;
begin
  select season.id, season.current_day_number
  into v_season_id, v_current_day_number
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_season_id is null then
    raise exception 'Aucune saison active ne permet de réactiver les équipes gérées.';
  end if;

  if coalesce(v_current_day_number, 0) not between 1 and 28 then
    raise exception 'La journée active est invalide pour l automatisation : %.', v_current_day_number;
  end if;

  insert into public.alpha_bot_managers (
    bot_key,
    auth_user_id,
    sporting_director_id,
    team_id,
    display_name,
    strategy,
    enabled,
    automation_season_id,
    automation_end_day_number
  )
  select
    'antoine_morel_29',
    director.auth_user_id,
    director.id,
    assignment.team_id,
    'Antoine Morel 29',
    'development',
    true,
    v_season_id,
    28
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  where director.id = 'db3cdafe-0284-4193-8e3c-82b506d8599a'::uuid
    and director.auth_user_id = '2ef55776-958b-4b0f-a0e1-123a7c0bb415'::uuid
    and director.username = 'Antoine Morel 29'
    and director.status = 'active'
  on conflict (bot_key) do update set
    auth_user_id = excluded.auth_user_id,
    sporting_director_id = excluded.sporting_director_id,
    team_id = excluded.team_id,
    display_name = excluded.display_name,
    strategy = excluded.strategy,
    enabled = excluded.enabled,
    automation_season_id = excluded.automation_season_id,
    automation_end_day_number = excluded.automation_end_day_number,
    updated_at = now();

  update public.alpha_bot_managers
  set
    enabled = true,
    automation_season_id = v_season_id,
    automation_end_day_number = 28,
    updated_at = now()
  where bot_key in (
    'elodie_martin',
    'thomas_vermeulen',
    'giulia_rinaldi',
    'mikkel_sorensen',
    'rafael_costa',
    'antoine_morel_29'
  );

  select count(*)
  into v_activated_count
  from public.alpha_bot_managers
  where enabled
    and automation_season_id = v_season_id
    and automation_end_day_number = 28
    and bot_key in (
      'elodie_martin',
      'thomas_vermeulen',
      'giulia_rinaldi',
      'mikkel_sorensen',
      'rafael_costa',
      'antoine_morel_29'
    );

  if v_activated_count <> 6 then
    raise exception 'Réactivation incomplète : % équipe(s) sur 6.', v_activated_count;
  end if;
end;
$$;

grant execute on function public.claim_alpha_bot_cycle(uuid, text, text)
  to service_role;
grant execute on function public.complete_alpha_bot_cycle(
  uuid,
  text,
  jsonb,
  text
) to service_role;

comment on table public.alpha_bot_managers is
  'Comptes gérés automatiquement ; leur activation est bornée par saison et journée.';

commit;
