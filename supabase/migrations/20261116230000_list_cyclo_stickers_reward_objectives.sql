begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

create function public.get_current_cyclo_stickers_reward_objectives()
returns table (
  edition_id text,
  source_season integer,
  achievement_id text,
  title text,
  current_value integer,
  target_value integer,
  reward_cash numeric,
  reward_experience integer,
  reward_reputation integer,
  trophy boolean,
  display_order integer,
  claimed_at timestamptz,
  is_completed boolean
)
language sql stable security definer
set search_path = ''
as $$
  with director as materialized (
    select account.id
    from public.sporting_directors as account
    where account.auth_user_id = (select auth.uid()) and account.status = 'active'
    limit 1
  ), published as materialized (
    select edition.edition_id, source.game_year::integer as source_season,
      edition.configuration->'achievements' as achievements,
      row_number() over (order by collection.game_year desc) as edition_rank
    from public.cyclo_stickers_editions as edition
    join public.seasons as source on source.id = edition.source_season_id and source.status = 'completed'
    join public.seasons as collection on collection.id = edition.collection_season_id
    where edition.configuration->>'enabled' = 'true'
      and edition.configuration->>'publicApproved' = 'true'
      and exists (
        select 1 from public.seasons as active
        where active.status = 'active' and active.game_year >= collection.game_year
      )
  ), visible_editions as materialized (
    select published.*, director.id as director_id, coalesce(owned.accepted_trade_count, 0) as trades
    from published cross join director
    left join public.cyclo_stickers_collections as owned
      on owned.edition_id = published.edition_id and owned.sporting_director_id = director.id
    where published.edition_rank = 1 or owned.sporting_director_id is not null
  ), card_progress as materialized (
    select visible.edition_id, card.rarity, card.profile_key, card.kind, coalesce(inventory.pasted, false) as pasted
    from visible_editions as visible
    join public.cyclo_stickers_cards as card on card.edition_id = visible.edition_id
    left join public.cyclo_stickers_card_inventory as inventory
      on inventory.edition_id = card.edition_id and inventory.card_number = card.card_number
      and inventory.sporting_director_id = visible.director_id
  ), totals as (
    select card.edition_id,
      count(*)::integer as cards,
      count(*) filter (where card.pasted)::integer as pasted,
      count(distinct card.rarity) filter (where card.pasted and card.rarity in ('bronze', 'silver', 'gold'))::integer as finishes
    from card_progress as card group by card.edition_id
  ), by_profile as (
    select card.edition_id, card.profile_key,
      count(*)::integer as cards, count(*) filter (where card.pasted)::integer as pasted
    from card_progress as card where card.kind is null group by card.edition_id, card.profile_key
  ), by_rarity as (
    select card.edition_id, card.rarity,
      count(*)::integer as cards, count(*) filter (where card.pasted)::integer as pasted
    from card_progress as card group by card.edition_id, card.rarity
  ), objective_progress as (
    select visible.edition_id, visible.source_season, visible.director_id, entry.achievement, entry.display_order,
      case entry.achievement->>'kind'
        when 'trade' then visible.trades
        when 'mixed' then coalesce(totals.finishes, 0)
        when 'count' then coalesce(totals.pasted, 0)
        when 'profile' then coalesce(profile.pasted, 0)
        when 'rarity' then coalesce(rarity.pasted, 0)
        else 0
      end as progress,
      case entry.achievement->>'kind'
        when 'trade' then 1
        when 'mixed' then 3
        when 'count' then case when entry.achievement->>'trophy' = 'true'
          then coalesce(totals.cards, 0) else (entry.achievement->>'target')::integer end
        when 'profile' then coalesce(profile.cards, 0)
        when 'rarity' then coalesce(rarity.cards, 0)
        else 0
      end as target
    from visible_editions as visible
    cross join lateral jsonb_array_elements(visible.achievements) with ordinality as entry(achievement, display_order)
    left join totals on totals.edition_id = visible.edition_id
    left join by_profile as profile on profile.edition_id = visible.edition_id and profile.profile_key = entry.achievement->>'profile'
    left join by_rarity as rarity on rarity.edition_id = visible.edition_id and rarity.rarity = entry.achievement->>'rarity'
  )
  select objective.edition_id, objective.source_season, objective.achievement->>'id', objective.achievement->>'name',
    least(objective.progress, objective.target), greatest(1, objective.target),
    (objective.achievement->>'cash')::numeric, (objective.achievement->>'xp')::integer,
    (objective.achievement->>'reputation')::integer, coalesce(objective.achievement->>'trophy' = 'true', false),
    objective.display_order::integer, claim.claimed_at,
    objective.target > 0 and objective.progress >= objective.target
  from objective_progress as objective
  left join public.cyclo_stickers_achievement_claims as claim
    on claim.edition_id = objective.edition_id and claim.sporting_director_id = objective.director_id
    and claim.achievement_id = objective.achievement->>'id'
  order by objective.source_season desc, objective.display_order;
$$;

-- Keep the regular objective cache and the desktop's single request.
create function public.get_current_game_objective_summary_with_album()
returns table (total_count integer, ready_count integer)
language sql volatile security definer
set search_path = ''
as $$
  select career.total_count + album.total_count, career.ready_count + album.ready_count
  from public.get_current_game_objective_summary_cached() as career
  cross join lateral (
    select count(*)::integer as total_count,
      count(*) filter (where objective.is_completed and objective.claimed_at is null)::integer as ready_count
    from public.get_current_cyclo_stickers_reward_objectives() as objective
  ) as album;
$$;

revoke all on function public.get_current_cyclo_stickers_reward_objectives(),
  public.get_current_game_objective_summary_with_album() from public, anon;
grant execute on function public.get_current_cyclo_stickers_reward_objectives(),
  public.get_current_game_objective_summary_with_album() to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
