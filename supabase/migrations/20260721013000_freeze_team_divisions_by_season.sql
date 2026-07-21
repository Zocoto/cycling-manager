-- ============================================================
-- Divisions figées par saison
-- ============================================================

begin;

-- Le classement reste actualisé pendant la saison, mais il ne doit jamais
-- modifier la division de la saison en cours.
create or replace function public.refresh_uci_rankings(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with ranked_teams as (
    select
      team_season.id,
      row_number() over (
        order by team_season.points desc, team_season.display_name, team_season.id
      )::integer as ranking_position
    from public.team_seasons as team_season
    where team_season.season_id = p_season_id
      and team_season.status <> 'withdrawn'
  )
  update public.team_seasons as team_season
  set final_rank = ranked.ranking_position
  from ranked_teams as ranked
  where team_season.id = ranked.id;

  with ranked_riders as (
    select
      summary.id,
      row_number() over (
        order by coalesce(summary.points, 0) desc, rider.last_name,
          rider.first_name, rider.id
      )::integer as ranking_position
    from public.rider_season_summaries as summary
    join public.riders as rider on rider.id = summary.rider_id
    where summary.season_id = p_season_id
  )
  update public.rider_season_summaries as summary
  set uci_rank = ranked.ranking_position,
      updated_at = now()
  from ranked_riders as ranked
  where summary.id = ranked.id;
end;
$$;

create or replace function public.assign_next_season_team_division(
  p_team_season_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.team_seasons%rowtype;
  v_next_season_id uuid;
  v_next_division_id uuid;
begin
  select team_season.*
  into v_current
  from public.team_seasons as team_season
  where team_season.id = p_team_season_id
  for update;

  if v_current is null then
    raise exception 'Saison d’équipe introuvable.';
  end if;

  if v_current.status <> 'completed' then
    raise exception 'La division suivante ne peut être attribuée qu’à la clôture.';
  end if;

  perform public.refresh_uci_rankings(v_current.season_id);
  select team_season.*
  into v_current
  from public.team_seasons as team_season
  where team_season.id = p_team_season_id;

  select public.ensure_transfer_next_season(v_current.season_id)
  into v_next_season_id;

  select division.id
  into v_next_division_id
  from public.divisions as division
  where division.code = case
    when v_current.final_rank between 1 and 20 then 'elite'
    when v_current.final_rank between 21 and 50 then 'world'
    when v_current.final_rank between 51 and 100 then 'continental'
    when v_current.final_rank between 101 and 200 then 'national'
    else null
  end;

  insert into public.team_seasons (
    team_id,
    season_id,
    division_id,
    registration_country_id,
    display_name,
    short_name,
    points,
    final_rank,
    operating_budget,
    spent_budget,
    currency_code,
    currency,
    opening_cash_balance,
    cash_balance,
    negative_season_streak,
    next_sponsor_budget_bonus_percent,
    status
  )
  values (
    v_current.team_id,
    v_next_season_id,
    v_next_division_id,
    v_current.registration_country_id,
    v_current.display_name,
    v_current.short_name,
    0,
    null,
    0,
    0,
    v_current.currency_code,
    v_current.currency,
    v_current.cash_balance,
    v_current.cash_balance,
    v_current.negative_season_streak,
    v_current.next_sponsor_budget_bonus_percent,
    'planned'
  )
  on conflict (team_id, season_id)
  do update set division_id = excluded.division_id;
end;
$$;

create or replace function public.assign_division_when_team_season_completes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    perform public.assign_next_season_team_division(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists team_season_division_closure on public.team_seasons;
create trigger team_season_division_closure
after update of status
on public.team_seasons
for each row execute function public.assign_division_when_team_season_completes();

-- Répare les affectations déjà calculées en direct : une saison active ne
-- reprend que la division issue d’une saison précédente effectivement close.
with corrected_divisions as (
  select
    current_team_season.id as team_season_id,
    previous_division.id as division_id
  from public.team_seasons as current_team_season
  join public.seasons as current_season
    on current_season.id = current_team_season.season_id
  left join lateral (
    select previous_team_season.final_rank
    from public.team_seasons as previous_team_season
    join public.seasons as previous_season
      on previous_season.id = previous_team_season.season_id
    where previous_team_season.team_id = current_team_season.team_id
      and previous_season.game_year = current_season.game_year - 1
      and previous_season.status = 'completed'
      and previous_team_season.status = 'completed'
    limit 1
  ) as previous_team_season on true
  left join public.divisions as previous_division
    on previous_division.code = case
      when previous_team_season.final_rank between 1 and 20 then 'elite'
      when previous_team_season.final_rank between 21 and 50 then 'world'
      when previous_team_season.final_rank between 51 and 100 then 'continental'
      when previous_team_season.final_rank between 101 and 200 then 'national'
      else null
    end
  where current_season.status in ('active', 'planned')
)
update public.team_seasons as team_season
set division_id = corrected_divisions.division_id
from corrected_divisions
where team_season.id = corrected_divisions.team_season_id;

revoke all on function public.assign_next_season_team_division(uuid) from public;
grant execute on function public.assign_next_season_team_division(uuid) to service_role;

comment on function public.assign_next_season_team_division(uuid) is
  'Fige le rang de clôture et attribue à l’équipe sa division pour la saison suivante.';

notify pgrst, 'reload schema';

commit;
