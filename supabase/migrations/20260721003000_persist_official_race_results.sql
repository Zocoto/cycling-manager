begin;

-- Les points des classements annexes sont figés avec chaque résultat d'étape.
-- Ils permettent de reconstruire à l'identique un classement provisoire ou final.
alter table public.stage_results
  add column if not exists mountain_points integer not null default 0,
  add column if not exists sprint_points integer not null default 0;

alter table public.stage_results
  add constraint stage_results_mountain_points_non_negative
    check (mountain_points >= 0),
  add constraint stage_results_sprint_points_non_negative
    check (sprint_points >= 0);

-- Une chute d'une simulation officielle ne doit créer qu'une seule blessure,
-- même si deux requêtes tentent de finaliser l'étape simultanément.
create unique index if not exists rider_injuries_official_stage_unique_idx
  on public.rider_injuries (rider_id, source_stage_id)
  where source_stage_id is not null;

-- Variante historique de l'attribution des gains : l'équipe créditée est celle
-- de la startlist, et non l'éventuelle équipe actuelle du coureur après transfert.
create or replace function public.apply_race_roster_competition_reward(
  p_source_reference text,
  p_source_type text,
  p_race_roster_id uuid,
  p_stage_id uuid,
  p_reputation_points integer,
  p_experience_points integer,
  p_cash_prize numeric,
  p_uci_points integer,
  p_is_victory boolean,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_reward_id uuid;
begin
  select
    roster.rider_id,
    rider.country_id,
    registration.team_season_id,
    team_season.season_id,
    sporting_director.id as sporting_director_id,
    season_day.day_number,
    season_day.id as season_day_id
  into v_context
  from public.race_rosters as roster
  join public.riders as rider
    on rider.id = roster.rider_id
  join public.race_registrations as registration
    on registration.id = roster.race_registration_id
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  join public.stages as stage
    on stage.id = p_stage_id
   and stage.race_edition_id = registration.race_edition_id
  join public.season_days as season_day
    on season_day.id = stage.season_day_id
   and season_day.season_id = team_season.season_id
  left join public.team_manager_assignments as assignment
    on assignment.team_id = team_season.team_id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  left join public.sporting_directors as sporting_director
    on sporting_director.id = assignment.sporting_director_id
  where roster.id = p_race_roster_id
  limit 1;

  if v_context is null then
    raise exception 'Le coureur ne possède pas de contexte de course et de saison valide.';
  end if;

  insert into public.reward_events (
    source_reference,
    source_type,
    sporting_director_id,
    team_season_id,
    rider_id,
    country_id,
    reputation_points,
    experience_points,
    cash_prize,
    uci_points,
    description
  )
  values (
    btrim(p_source_reference),
    p_source_type,
    v_context.sporting_director_id,
    v_context.team_season_id,
    v_context.rider_id,
    v_context.country_id,
    greatest(0, p_reputation_points),
    greatest(0, p_experience_points),
    greatest(0, p_cash_prize),
    greatest(0, p_uci_points),
    btrim(p_description)
  )
  on conflict (source_reference) do nothing
  returning id into v_reward_id;

  if v_reward_id is null then
    select id into v_reward_id
    from public.reward_events
    where source_reference = btrim(p_source_reference);
    return v_reward_id;
  end if;

  update public.sporting_directors
  set
    reputation_points = reputation_points + greatest(0, p_reputation_points),
    experience_points = experience_points + greatest(0, p_experience_points)
  where id = v_context.sporting_director_id;

  update public.team_seasons
  set
    points = points + greatest(0, p_uci_points),
    cash_balance = cash_balance + greatest(0, p_cash_prize)
  where id = v_context.team_season_id;

  insert into public.rider_season_summaries (
    rider_id,
    season_id,
    victories,
    points
  )
  values (
    v_context.rider_id,
    v_context.season_id,
    case when p_is_victory then 1 else 0 end,
    greatest(0, p_uci_points)
  )
  on conflict (rider_id, season_id)
  do update set
    victories = coalesce(rider_season_summaries.victories, 0)
      + excluded.victories,
    points = coalesce(rider_season_summaries.points, 0)
      + excluded.points,
    updated_at = now();

  if p_cash_prize > 0 then
    insert into public.team_finance_transactions (
      team_season_id,
      season_day_id,
      day_number,
      amount,
      category,
      status,
      description,
      source_reference,
      posted_at
    )
    values (
      v_context.team_season_id,
      v_context.season_day_id,
      v_context.day_number,
      p_cash_prize,
      'race_prize',
      'posted',
      p_description,
      'reward:' || btrim(p_source_reference),
      now()
    )
    on conflict (team_season_id, source_reference) do nothing;
  end if;

  perform public.refresh_uci_rankings(v_context.season_id);
  return v_reward_id;
end;
$$;

revoke all on function public.apply_race_roster_competition_reward(
  text, text, uuid, uuid, integer, integer, numeric, integer, boolean, text
) from public;

grant execute on function public.apply_race_roster_competition_reward(
  text, text, uuid, uuid, integer, integer, numeric, integer, boolean, text
) to service_role;

grant all privileges on table public.stage_results to service_role;
grant all privileges on table public.race_results to service_role;
grant all privileges on table public.race_secondary_results to service_role;
grant all privileges on table public.rider_injuries to service_role;
grant select on table public.race_registrations to service_role;
grant select on table public.race_rosters to service_role;
grant select on table public.team_seasons to service_role;
grant select, update on table public.stages to service_role;
grant select, update on table public.race_editions to service_role;

comment on column public.stage_results.mountain_points is
  'Points montagne marqués par le coureur pendant cette étape.';

comment on column public.stage_results.sprint_points is
  'Points du classement par points marqués par le coureur pendant cette étape.';

comment on function public.apply_race_roster_competition_reward(
  text, text, uuid, uuid, integer, integer, numeric, integer, boolean, text
) is
  'Attribue une récompense idempotente à l’équipe historique de la startlist.';

commit;
