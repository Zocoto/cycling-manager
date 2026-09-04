begin;

-- Une homologation peut attribuer des gains à plusieurs dizaines de coureurs.
-- Rafraîchir tout le classement UCI après chaque gain rendait le règlement
-- quadratique et faisait expirer les crons des grands pelotons. Le service de
-- règlement effectue désormais un seul rafraîchissement à la fin de l'édition.
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
    raise exception
      'Le coureur ne possède pas de contexte de course et de saison valide.';
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
    select event.id
    into v_reward_id
    from public.reward_events as event
    where event.source_reference = btrim(p_source_reference);
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

  return v_reward_id;
end;
$$;

revoke all on function public.apply_race_roster_competition_reward(
  text, text, uuid, uuid, integer, integer, numeric, integer, boolean, text
) from public;

grant execute on function public.apply_race_roster_competition_reward(
  text, text, uuid, uuid, integer, integer, numeric, integer, boolean, text
) to service_role;

comment on function public.apply_race_roster_competition_reward(
  text, text, uuid, uuid, integer, integer, numeric, integer, boolean, text
) is
  'Attribue une récompense idempotente à la startlist; le classement UCI est rafraîchi une fois après l édition.';

commit;
