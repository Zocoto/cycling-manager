begin;

-- Réactivation volontaire et bornée des cinq comptes alpha, complétés par le
-- compte d'audit Antoine Morel 29. La portée est attachée à une saison précise
-- et à son jour 14 afin qu'aucune automatisation ne reparte en saison suivante.
alter table public.alpha_bot_managers
  add column if not exists automation_season_id uuid
    references public.seasons(id) on delete set null,
  add column if not exists automation_end_day_number smallint;

alter table public.alpha_bot_managers
  drop constraint if exists alpha_bot_managers_automation_scope_check;
alter table public.alpha_bot_managers
  add constraint alpha_bot_managers_automation_scope_check check (
    (
      automation_season_id is null
      and automation_end_day_number is null
    )
    or (
      automation_season_id is not null
      and automation_end_day_number between 1 and 28
    )
  );

do $activation$
declare
  v_season_id uuid;
  v_current_day integer;
  v_activated_count integer;
begin
  select season.id, coalesce(season.current_day_number, 1)
  into v_season_id, v_current_day
  from public.seasons as season
  where season.status = 'active'
    and season.game_year = 3
  limit 1;

  if v_season_id is null then
    raise exception 'La saison 3 active est introuvable.';
  end if;
  if v_current_day > 14 then
    raise exception 'La première moitié de la saison 3 est déjà terminée.';
  end if;

  update public.alpha_bot_managers
  set
    enabled = false,
    automation_season_id = null,
    automation_end_day_number = null,
    updated_at = now();

  if (
    select count(*)
    from public.alpha_bot_managers
    where bot_key in (
      'elodie_martin',
      'thomas_vermeulen',
      'giulia_rinaldi',
      'mikkel_sorensen',
      'rafael_costa'
    )
  ) <> 5 then
    raise exception 'Les cinq comptes alpha historiques sont incomplets.';
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
    14
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
    automation_end_day_number = 14,
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
    and automation_end_day_number = 14
    and bot_key in (
      'elodie_martin',
      'thomas_vermeulen',
      'giulia_rinaldi',
      'mikkel_sorensen',
      'rafael_costa',
      'antoine_morel_29'
    );

  if v_activated_count <> 6 then
    raise exception 'L''activation des six comptes automatisés a échoué.';
  end if;
end;
$activation$;

create or replace function public.claim_alpha_bot_cycle(
  p_manager_id uuid,
  p_cycle_key text,
  p_slot text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Cette opération est réservée au service interne.';
  end if;
  if p_slot not in ('morning', 'evening') then
    raise exception 'Créneau automatisé invalide.';
  end if;

  if not exists (
    select 1
    from public.alpha_bot_managers as manager
    join public.seasons as season
      on season.id = manager.automation_season_id
     and season.status = 'active'
    where manager.id = p_manager_id
      and manager.enabled
      and coalesce(season.current_day_number, 1)
        between 1 and manager.automation_end_day_number
  ) then
    return null;
  end if;

  insert into public.alpha_bot_cycles (
    manager_id,
    cycle_key,
    slot
  )
  values (
    p_manager_id,
    left(trim(p_cycle_key), 80),
    p_slot
  )
  on conflict (manager_id, cycle_key) do nothing
  returning id into v_cycle_id;

  if v_cycle_id is not null then
    return v_cycle_id;
  end if;

  select cycle.id
  into v_cycle_id
  from public.alpha_bot_cycles as cycle
  where cycle.manager_id = p_manager_id
    and cycle.cycle_key = left(trim(p_cycle_key), 80)
    and cycle.attempt_count < 3
    and (
      cycle.status = 'failed'
      or (
        cycle.status = 'running'
        and cycle.started_at < now() - interval '20 minutes'
      )
    )
  for update;

  if v_cycle_id is null then
    return null;
  end if;

  update public.alpha_bot_cycles
  set
    status = 'running',
    attempt_count = attempt_count + 1,
    actions = '[]'::jsonb,
    error_message = null,
    started_at = now(),
    completed_at = null
  where id = v_cycle_id;

  return v_cycle_id;
end;
$$;

revoke all on function public.claim_alpha_bot_cycle(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.complete_alpha_bot_cycle(uuid, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.claim_alpha_bot_cycle(uuid, text, text)
  to service_role;
grant execute on function public.complete_alpha_bot_cycle(uuid, text, jsonb, text)
  to service_role;

comment on table public.alpha_bot_managers is
  'Comptes de test automatisés. Toute activation est bornée par une saison et un jour de fin explicites.';
comment on column public.alpha_bot_managers.automation_season_id is
  'Saison unique pendant laquelle ce compte peut exécuter ses cycles automatisés.';
comment on column public.alpha_bot_managers.automation_end_day_number is
  'Dernier jour inclus de la saison ciblée pendant lequel les cycles sont autorisés.';

commit;
