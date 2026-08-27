begin;

alter table public.sporting_director_messages
  drop constraint if exists sporting_director_messages_type_allowed;

alter table public.sporting_director_messages
  add constraint sporting_director_messages_type_allowed check (
    message_type in (
      'race_result',
      'national_championship_selection',
      'national_championship_result',
      'international_selection',
      'roster_alert',
      'wildcard',
      'academy',
      'infrastructure',
      'auction_won',
      'trophy',
      'system'
    )
  );

-- The listing becomes settled only after complete_transfer_listing has created
-- the winning contract, moved the rider and posted the finance transactions.
-- Hooking this final transition prevents premature or duplicate victory mails.
create or replace function public.notify_won_transfer_auction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_director_id uuid;
  v_team_season_id uuid;
  v_rider_name text;
  v_winning_bid_label text;
begin
  if old.status is not distinct from 'settled'
    or new.status is distinct from 'settled'
    or new.winning_team_id is null
    or new.winning_bid is null
  then
    return new;
  end if;

  if not exists (
    select 1
    from public.rider_contracts as contract
    where contract.rider_id = new.rider_id
      and contract.team_id = new.winning_team_id
      and contract.start_season_id = new.season_id
      and contract.status = 'active'
      and contract.acquisition_type in ('daily_auction', 'director_auction')
  ) then
    return new;
  end if;

  select
    assignment.sporting_director_id,
    team_season.id
  into
    v_director_id,
    v_team_season_id
  from public.team_manager_assignments as assignment
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
   and director.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = new.season_id
  where assignment.team_id = new.winning_team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  limit 1;

  if v_director_id is null then
    return new;
  end if;

  select nullif(btrim(concat_ws(' ', rider.first_name, rider.last_name)), '')
  into v_rider_name
  from public.riders as rider
  where rider.id = new.rider_id;

  v_rider_name := coalesce(v_rider_name, 'ce coureur');
  v_winning_bid_label := new.winning_bid::numeric(14, 0)::text ||
    ' ' || new.currency_code;

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
    is_important,
    sent_at
  ) values (
    v_director_id,
    new.season_id,
    v_team_season_id,
    'auction_won',
    'Bureau des transferts',
    'Vous avez remporté l’enchère pour ' || v_rider_name,
    v_rider_name || ' rejoint votre équipe après votre offre victorieuse.',
    format(
      'Félicitations ! Votre offre de %s a remporté l’enchère pour %s.%s%sLe coureur a signé son contrat et rejoint dès maintenant votre équipe pour la saison actuelle et la suivante.',
      v_winning_bid_label,
      v_rider_name,
      E'\n',
      E'\n'
    ),
    '/jeu/coureurs/' || new.rider_id::text,
    'Voir le nouveau coureur',
    'transfer-auction-won:' || new.id::text,
    true,
    coalesce(new.settled_at, now())
  )
  on conflict (sporting_director_id, source_reference) do nothing;

  return new;
end;
$$;

drop trigger if exists transfer_market_listings_notify_winner
  on public.transfer_market_listings;
create trigger transfer_market_listings_notify_winner
after update of status on public.transfer_market_listings
for each row execute function public.notify_won_transfer_auction();

revoke all on function public.notify_won_transfer_auction()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
