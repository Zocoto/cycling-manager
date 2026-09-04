begin;

-- Comme les récompenses individuelles, les primes d'un CLM par équipes sont
-- attribuées en série puis suivies d'un unique rafraîchissement UCI par le
-- service de règlement. Éviter un recalcul global par équipe réduit encore la
-- contention lorsque plusieurs courses arrivent ensemble.
create or replace function public.apply_team_time_trial_stage_reward(
  p_source_reference text,
  p_team_season_id uuid,
  p_stage_id uuid,
  p_finance_stage_id uuid,
  p_reputation_points integer,
  p_experience_points integer,
  p_cash_prize numeric,
  p_uci_points integer,
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
  if nullif(btrim(p_source_reference), '') is null then
    raise exception 'La référence de récompense TTT est obligatoire.';
  end if;
  if nullif(btrim(p_description), '') is null then
    raise exception 'La description de récompense TTT est obligatoire.';
  end if;

  select
    team_season.season_id,
    manager.sporting_director_id,
    finance_day.id as season_day_id,
    finance_day.day_number
  into v_context
  from public.team_seasons as team_season
  join public.stages as source_stage
    on source_stage.id = p_stage_id
   and source_stage.stage_type = 'team_time_trial'
  join public.race_editions as edition
    on edition.id = source_stage.race_edition_id
   and edition.season_id = team_season.season_id
  join public.race_registrations as registration
    on registration.race_edition_id = edition.id
   and registration.team_season_id = team_season.id
   and registration.status = 'accepted'
  join public.stages as finance_stage
    on finance_stage.id = p_finance_stage_id
   and finance_stage.race_edition_id = edition.id
  join public.season_days as finance_day
    on finance_day.id = finance_stage.season_day_id
   and finance_day.season_id = team_season.season_id
  left join lateral (
    select assignment.sporting_director_id
    from public.team_manager_assignments as assignment
    where assignment.team_id = team_season.team_id
      and assignment.role = 'general_manager'
      and assignment.status = 'active'
    order by assignment.created_at desc, assignment.id
    limit 1
  ) as manager on true
  where team_season.id = p_team_season_id
  limit 1;

  if v_context is null then
    raise exception 'L’équipe ne possède pas de contexte valide pour ce CLM par équipes.';
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
    'stage_result',
    v_context.sporting_director_id,
    p_team_season_id,
    null,
    null,
    greatest(0, p_reputation_points),
    greatest(0, p_experience_points),
    greatest(0, p_cash_prize),
    greatest(0, p_uci_points),
    btrim(p_description)
  )
  on conflict (source_reference) do nothing
  returning id into v_reward_id;

  if v_reward_id is null then
    select reward.id
    into v_reward_id
    from public.reward_events as reward
    where reward.source_reference = btrim(p_source_reference);
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
  where id = p_team_season_id;

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
      p_team_season_id,
      v_context.season_day_id,
      v_context.day_number,
      p_cash_prize,
      'race_prize',
      'posted',
      btrim(p_description),
      'reward:' || btrim(p_source_reference),
      now()
    )
    on conflict (team_season_id, source_reference) do nothing;
  end if;

  return v_reward_id;
end;
$$;

revoke all on function public.apply_team_time_trial_stage_reward(
  text, uuid, uuid, uuid, integer, integer, numeric, integer, text
) from public, anon, authenticated;

grant execute on function public.apply_team_time_trial_stage_reward(
  text, uuid, uuid, uuid, integer, integer, numeric, integer, text
) to service_role;

comment on function public.apply_team_time_trial_stage_reward(
  text, uuid, uuid, uuid, integer, integer, numeric, integer, text
) is
  'Crédite une seule fois les gains TTT; le classement UCI est rafraîchi une fois après l édition.';

commit;
