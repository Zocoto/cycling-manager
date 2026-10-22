begin;
set local lock_timeout = '1s';
set local statement_timeout = '8s';

-- Separate from annual grants: a Games result pays once, in its own season.
create table public.quadrennial_games_cash_settlements (
  race_edition_id uuid primary key references public.race_editions(id),
  season_id uuid not null references public.seasons(id),
  winner_roster_id uuid not null,
  winner_country_id uuid not null references public.countries(id),
  club_prize_count integer not null check (club_prize_count >= 0),
  club_prize_total numeric(14, 2) not null check (club_prize_total >= 0),
  federation_prize numeric(14, 2) not null check (federation_prize = 500000),
  settled_at timestamptz not null default now()
);
alter table public.quadrennial_games_cash_settlements enable row level security;
revoke all on public.quadrennial_games_cash_settlements from public, anon, authenticated;
grant select, insert on public.quadrennial_games_cash_settlements to service_role;

alter table public.national_federation_transactions
  drop constraint national_federation_transactions_category_allowed;
alter table public.national_federation_transactions
  add constraint national_federation_transactions_category_allowed check (
    category in (
      'opening_grant', 'race_revenue', 'objective_bonus', 'donation',
      'solidarity', 'infrastructure', 'refund', 'hosting',
      'race_creation', 'race_maintenance', 'equipment', 'quadrennial_prize'
    )
  );

create function public.get_quadrennial_games_club_prize(p_final_rank integer)
returns numeric language sql immutable set search_path = '' as $$
  select case
    when p_final_rank = 1 then 500000
    when p_final_rank = 2 then 300000
    when p_final_rank = 3 then 200000
    when p_final_rank between 4 and 5 then 100000
    when p_final_rank between 6 and 10 then 50000
    when p_final_rank between 11 and 20 then 20000
    when p_final_rank between 21 and 40 then 10000
    when p_final_rank > 40 then 4000
    else 0
  end::numeric;
$$;

create function public.settle_quadrennial_games_cash_prizes(p_race_edition_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
set statement_timeout = '10s' set lock_timeout = '2s'
as $$
declare
  v_event record;
  v_day record;
  v_winner record;
  v_result record;
  v_account_id uuid;
  v_transaction_id uuid;
  v_reward_id uuid;
  v_cash numeric;
  v_source text;
  v_description text;
  v_club_count integer := 0;
  v_club_total numeric := 0;
begin
  -- Never identify a paid event by a translated label or by nations_cup alone.
  select edition.id, edition.season_id, edition.display_name, edition.status
  into v_event
  from public.race_editions edition
  join public.races race on race.id = edition.race_id and race.competition_type = 'nations_cup'
  join public.seasons season on season.id = edition.season_id
    and season.game_year >= 4 and season.game_year % 4 = 0
  join public.national_federation_olympic_events event on event.season_id = edition.season_id
    and edition.id in (event.race_edition_id, event.time_trial_race_edition_id)
  where edition.id = p_race_edition_id;
  if not found then raise exception 'Cette épreuve ne fait pas partie des Jeux quadriennaux officiels.'; end if;

  perform pg_advisory_xact_lock(hashtextextended('quadrennial-cash:' || p_race_edition_id::text, 0));
  if exists (select 1 from public.quadrennial_games_cash_settlements where race_edition_id = p_race_edition_id) then
    return p_race_edition_id;
  end if;
  if v_event.status = 'cancelled' then raise exception 'Une épreuve annulée ne peut pas recevoir de primes.'; end if;
  if not exists (select 1 from public.stages where race_edition_id = p_race_edition_id)
    or exists (select 1 from public.stages where race_edition_id = p_race_edition_id and status <> 'completed') then
    raise exception 'Les résultats des Jeux ne sont pas encore homologués.';
  end if;
  if (select count(*) from public.race_results where race_edition_id = p_race_edition_id
    and status = 'classified' and final_rank = 1) <> 1 then
    raise exception 'Le vainqueur officiel des Jeux doit être unique.';
  end if;
  if exists (
    select 1 from public.stage_results result
    join public.stages stage on stage.id = result.stage_id and stage.race_edition_id = p_race_edition_id
    where not exists (select 1 from public.race_results final_result
      where final_result.race_edition_id = p_race_edition_id and final_result.race_roster_id = result.race_roster_id)
  ) then raise exception 'Le classement final des Jeux est incomplet.'; end if;

  select day.id, day.day_number into strict v_day
  from public.stages stage
  join public.season_days day on day.id = stage.season_day_id and day.season_id = v_event.season_id
  where stage.race_edition_id = p_race_edition_id
  order by stage.stage_number desc limit 1;

  select result.race_roster_id, selection.country_id into v_winner
  from public.race_results result
  join public.race_rosters roster on roster.id = result.race_roster_id
  join public.national_federation_selection_race_links link on link.race_registration_id = roster.race_registration_id
    and link.race_edition_id = result.race_edition_id
  join public.national_federation_selection_lists selection on selection.id = link.selection_list_id
    and selection.season_id = v_event.season_id
  where result.race_edition_id = p_race_edition_id and result.status = 'classified' and result.final_rank = 1;
  if not found then raise exception 'La fédération du vainqueur des Jeux est introuvable.'; end if;

  for v_result in
    select result.race_roster_id, result.final_rank, roster.rider_id,
      selection.country_id, member.id as member_id, member.owner_team_id, member.owner_director_id,
      team_season.id as team_season_id
    from public.race_results result
    join public.race_rosters roster on roster.id = result.race_roster_id
    left join public.national_federation_selection_race_links link on link.race_registration_id = roster.race_registration_id
      and link.race_edition_id = result.race_edition_id
    left join public.national_federation_selection_lists selection on selection.id = link.selection_list_id
      and selection.season_id = v_event.season_id
    left join public.national_federation_selection_members member on member.selection_list_id = selection.id
      and member.professional_rider_id = roster.rider_id
    left join public.team_seasons team_season on team_season.team_id = member.owner_team_id
      and team_season.season_id = v_event.season_id
    where result.race_edition_id = p_race_edition_id and result.status = 'classified' and result.final_rank > 0
    order by team_season.id, result.race_roster_id
  loop
    if v_result.member_id is null then raise exception 'La sélection officielle d’un coureur classé est introuvable.'; end if;
    -- A free agent has no club to credit. The represented federation still wins its prize.
    if v_result.owner_team_id is null then continue; end if;
    if v_result.team_season_id is null then raise exception 'Le compte saisonnier du club est introuvable.'; end if;
    v_cash := public.get_quadrennial_games_club_prize(v_result.final_rank);
    v_source := 'quadrennial-games:' || p_race_edition_id::text || ':roster:' || v_result.race_roster_id::text || ':club:v1';
    v_description := v_event.display_name || ' · ' || v_result.final_rank::text || 'e place · prime au club';
    v_reward_id := null;
    insert into public.reward_events (
      source_reference, source_type, sporting_director_id, team_season_id, rider_id, country_id,
      reputation_points, experience_points, cash_prize, uci_points, description
    ) values (
      v_source, 'race_result', v_result.owner_director_id, v_result.team_season_id, v_result.rider_id,
      v_result.country_id, 0, 0, v_cash, 0, v_description
    ) on conflict (source_reference) do nothing returning id into v_reward_id;
    if v_reward_id is not null then
      update public.team_seasons set cash_balance = cash_balance + v_cash where id = v_result.team_season_id;
      insert into public.team_finance_transactions (
        team_season_id, season_day_id, day_number, amount, category, status, description, source_reference, posted_at
      ) values (
        v_result.team_season_id, v_day.id, v_day.day_number, v_cash, 'race_prize', 'posted', v_description, 'reward:' || v_source, now()
      );
    end if;
    v_club_count := v_club_count + 1;
    v_club_total := v_club_total + v_cash;
  end loop;

  select id into v_account_id from public.national_federation_accounts
  where country_id = v_winner.country_id and season_id = v_event.season_id for update;
  if not found then raise exception 'Le compte saisonnier de la fédération gagnante est introuvable.'; end if;
  insert into public.national_federation_transactions (
    account_id, day_number, amount, category, description, source_reference, metadata
  ) values (
    v_account_id, v_day.day_number, 500000, 'quadrennial_prize',
    v_event.display_name || ' · prime à la fédération du vainqueur',
    'quadrennial-games:' || p_race_edition_id::text || ':federation:v1',
    jsonb_build_object('raceEditionId', p_race_edition_id, 'winnerRosterId', v_winner.race_roster_id,
      'countryId', v_winner.country_id, 'oneShot', true)
  ) on conflict (source_reference) do nothing returning id into v_transaction_id;
  if v_transaction_id is not null then
    update public.national_federation_accounts set balance = balance + 500000, updated_at = now() where id = v_account_id;
  end if;
  insert into public.quadrennial_games_cash_settlements (
    race_edition_id, season_id, winner_roster_id, winner_country_id, club_prize_count, club_prize_total, federation_prize
  ) values (p_race_edition_id, v_event.season_id, v_winner.race_roster_id, v_winner.country_id, v_club_count, v_club_total, 500000);
  return p_race_edition_id;
end;
$$;
revoke all on function public.get_quadrennial_games_club_prize(integer) from public, anon, authenticated;
revoke all on function public.settle_quadrennial_games_cash_prizes(uuid) from public, anon, authenticated;
grant execute on function public.get_quadrennial_games_club_prize(integer) to service_role;
grant execute on function public.settle_quadrennial_games_cash_prizes(uuid) to service_role;

commit;
