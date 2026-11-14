begin;
set local lock_timeout = '1s';
set local statement_timeout = '10s';

alter table public.season_awards
  add column metadata jsonb not null default '{}'::jsonb,
  drop constraint season_awards_key_allowed,
  add constraint season_awards_key_allowed check (award_key in (
    'rider_of_year','team_of_year','serial_winner','young_rider','director_of_year',
    'injury_rider','injury_director','red_lantern_rider','red_lantern_director',
    'negotiator','sudoku_master','crossword_master','builder','mixed_zone',
    'chatterbox','youth_developer','junior_rider_of_year','junior_director_of_year',
    'paddock_favorite','homegrown_squad','national_identity','international_squad',
    'article_reactions','primary_rating_progression','team_race_days',
    'rider_race_days','record_transfer'
  ));

alter function private.create_season_awards_for_season(uuid)
  rename to create_season_awards_before_season_five_distinctions;

create function private.create_season_awards_for_season(p_season_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_created integer;
  v_new_awards integer := 0;
  v_game_year integer;
begin
  if not private.season_awards_ready(p_season_id) then return 0; end if;
  perform pg_advisory_xact_lock(hashtextextended('season-awards:' || p_season_id::text, 0));
  if exists (select 1 from public.season_award_finalizations where season_id = p_season_id) then
    return 0;
  end if;

  select game_year into strict v_game_year from public.seasons where id = p_season_id;
  if v_game_year < 5 then
    return private.create_season_awards_before_season_five_distinctions(p_season_id);
  end if;

  v_new_awards := private.create_season_five_distinctions(p_season_id);
  v_created := private.create_season_awards_before_season_five_distinctions(p_season_id);
  perform private.snapshot_existing_season_award_podiums(p_season_id);
  return v_created + v_new_awards;
end;
$$;

revoke all on function private.create_season_awards_before_season_five_distinctions(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.create_season_awards_for_season(uuid)
  from public, anon, authenticated;
grant execute on function private.create_season_awards_for_season(uuid) to service_role;

-- Rebind the completion fallback to the full builder.
create or replace function private.create_season_awards_after_completion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform private.create_season_awards_for_season(new.id);
  end if;
  return new;
end;
$$;

create function private.snapshot_existing_season_award_podiums(p_season_id uuid)
returns void language sql set search_path = '' as $$
  with rider_rankings as materialized (
    select summary.rider_id, rider.first_name, rider.last_name, rating.age,
      coalesce(summary.points, 0) as points, summary.uci_rank,
      coalesce(summary.victories, 0) as victories
    from public.rider_season_summaries summary
    join public.riders rider on rider.id = summary.rider_id
    left join public.rider_season_ratings rating
      on rating.rider_id = summary.rider_id and rating.season_id = summary.season_id
    where summary.season_id = p_season_id
  ), team_rankings as materialized (
    select team.id, team.team_id, team.display_name, team.points, team.final_rank
    from public.team_seasons team
    where team.season_id = p_season_id and team.status <> 'withdrawn'
  ), ranked as (
    select 'rider_of_year' as award_key, btrim(first_name || ' ' || last_name) as name,
      rider_id as recipient_id, points::numeric as stat_value,
      row_number() over (order by points desc, uci_rank nulls last, last_name, first_name, rider_id) as rank
    from rider_rankings where points > 0
    union all
    select 'young_rider', btrim(first_name || ' ' || last_name), rider_id, points::numeric,
      row_number() over (order by points desc, uci_rank nulls last, last_name, first_name, rider_id)
    from rider_rankings where age <= 23 and points > 0
    union all
    select 'serial_winner', btrim(first_name || ' ' || last_name), rider_id, victories::numeric,
      row_number() over (order by victories desc, points desc, last_name, first_name, rider_id)
    from rider_rankings where victories > 0
    union all
    select 'team_of_year', display_name, team_id, points::numeric,
      row_number() over (order by final_rank nulls last, points desc, display_name, id)
    from team_rankings
    union all
    select 'junior_rider_of_year', ranking.display_name, ranking.academy_rider_id, ranking.points::numeric,
      row_number() over (order by ranking.points desc, ranking.wins desc, ranking.podiums desc,
        ranking.display_name, ranking.id)
    from public.development_ranking_entries ranking
    join public.youth_academy_riders academy on academy.id = ranking.academy_rider_id
    join public.team_seasons team on team.team_id = academy.team_id and team.season_id = p_season_id
    where ranking.season_id = p_season_id and ranking.entity_type = 'individual' and ranking.points > 0
  ), podiums as (
    select runners.award_key,
      jsonb_agg(jsonb_build_object(
        'rank', runners.rank, 'recipientName', runners.name, 'statValue', runners.stat_value
      ) order by runners.rank) as podium
    from ranked runners
    join ranked winner on winner.award_key = runners.award_key and winner.rank = 1
    join public.season_awards award on award.season_id = p_season_id and award.award_key = winner.award_key
      and coalesce(award.rider_id, award.academy_rider_id, award.team_id) = winner.recipient_id
    where runners.rank between 2 and 3
    group by runners.award_key
  )
  update public.season_awards award
  set metadata = award.metadata || jsonb_build_object('podium', podiums.podium)
  from podiums where award.season_id = p_season_id and award.award_key = podiums.award_key;
$$;

revoke all on function private.snapshot_existing_season_award_podiums(uuid)
  from public, anon, authenticated, service_role;

create table public.cyclogazette_article_reactions (
  article_id uuid not null references public.media_center_articles(id) on delete cascade,
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (article_id, sporting_director_id)
);

create index cyclogazette_article_reactions_director_idx
  on public.cyclogazette_article_reactions (sporting_director_id);
create index media_center_articles_published_edition_idx
  on public.media_center_articles (published_edition_id)
  where status = 'published';

alter table public.cyclogazette_article_reactions enable row level security;
revoke all on table public.cyclogazette_article_reactions from public, anon, authenticated;

create function public.get_cyclogazette_article_reaction_context(p_edition_id uuid)
returns table (article_id uuid, reaction_count integer, viewer_reacted boolean, viewer_can_react boolean)
language sql stable security definer
set search_path = ''
as $$
  select article.id,
    count(reaction.article_id)::integer,
    coalesce(bool_or(reaction.sporting_director_id = viewer.id), false),
    coalesce(viewer.id <> article.sporting_director_id, false)
  from (select private.current_sporting_director_id() as id) as viewer
  join public.media_center_articles as article
    on article.published_edition_id = p_edition_id and article.status = 'published'
  left join public.cyclogazette_article_reactions as reaction on reaction.article_id = article.id
  group by article.id, viewer.id;
$$;

create function public.toggle_cyclogazette_article_reaction(p_article_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_director_id uuid := private.current_sporting_director_id();
  v_author_id uuid;
  v_viewer_reacted boolean;
begin
  if v_director_id is null then
    raise exception 'Directeur sportif actif requis.' using errcode = '42501';
  end if;

  select article.sporting_director_id into v_author_id
  from public.media_center_articles as article
  where article.id = p_article_id
    and article.status = 'published'
    and article.published_edition_id is not null
  for update;

  if not found then
    raise exception 'Article publié introuvable.' using errcode = 'P0002';
  end if;

  if v_author_id = v_director_id then
    raise exception 'Vous êtes l’auteur de cet article.' using errcode = '42501';
  end if;

  delete from public.cyclogazette_article_reactions as reaction
  where reaction.article_id = p_article_id and reaction.sporting_director_id = v_director_id;
  v_viewer_reacted := not found;

  if v_viewer_reacted then
    insert into public.cyclogazette_article_reactions (article_id, sporting_director_id)
    values (p_article_id, v_director_id);
  end if;

  return jsonb_build_object(
    'reactionCount', (select count(*) from public.cyclogazette_article_reactions as reaction
      where reaction.article_id = p_article_id),
    'viewerReacted', v_viewer_reacted
  );
end;
$$;

revoke all on function public.get_cyclogazette_article_reaction_context(uuid) from public, anon, authenticated;
revoke all on function public.toggle_cyclogazette_article_reaction(uuid) from public, anon, authenticated;
grant execute on function public.get_cyclogazette_article_reaction_context(uuid) to authenticated;
grant execute on function public.toggle_cyclogazette_article_reaction(uuid) to authenticated;

-- The winning result and its podium are captured once, at season finalization.
create function private.create_season_five_distinctions(p_season_id uuid)
returns integer language plpgsql set search_path = '' as $$
declare v_created integer;
begin
  with -- p_season_id is the season being finalized. These CTEs share one scan of
-- official starts: a DNF/OTL counts, a DNS does not.
race_day_starts as materialized (
  select stage.id as stage_id,
         roster.rider_id,
         registration.team_season_id
  from public.race_editions edition
  join public.stages stage on stage.race_edition_id = edition.id
  join public.stage_results result on result.stage_id = stage.id
  join public.race_rosters roster on roster.id = result.race_roster_id
  join public.race_registrations registration on registration.id = roster.race_registration_id
  where edition.season_id = p_season_id and result.status <> 'did_not_start'
), race_day_club_totals as (
  select team_season_id, count(distinct stage_id) as race_days
  from race_day_starts
  where team_season_id is not null
  group by team_season_id
), race_day_club_ranking as (
  select team_season.team_id, team_season.display_name, manager.sporting_director_id,
         totals.race_days,
         row_number() over (order by totals.race_days desc, team_season.team_id)::integer as rank
  from race_day_club_totals totals
  join public.team_seasons team_season on team_season.id = totals.team_season_id
  join lateral private.season_award_team_director(team_season.team_id, p_season_id) manager on true
  where team_season.season_id = p_season_id and team_season.status <> 'withdrawn'
), race_day_rider_ranking as (
  select rider_id, count(*) as race_days,
         row_number() over (order by count(*) desc, rider_id)::integer as rank
  from race_day_starts
  group by rider_id
  order by race_days desc, rider_id
  limit 3
), race_day_award_candidates as (
  select 'team_race_days'::text as award_key, 'team'::text as recipient_type,
         club.display_name as recipient_name, club.display_name as team_name,
         club.sporting_director_id, club.team_id, null::uuid as rider_id,
         club.race_days::numeric as stat_value, 'JDC'::text as stat_label,
         '{}'::jsonb as metadata, club.rank
  from race_day_club_ranking club
  where club.rank <= 3
  union all
  select 'rider_race_days', 'rider', btrim(rider.first_name || ' ' || rider.last_name),
         club.display_name, club.sporting_director_id, club.team_id, rider.id,
         total.race_days::numeric, 'JDC', '{}'::jsonb, total.rank
  from race_day_rider_ranking total
  join public.riders rider on rider.id = total.rider_id
  left join lateral (
    select team_season.display_name, manager.sporting_director_id, team_season.team_id
    from race_day_starts start
    join public.team_seasons team_season on team_season.id = start.team_season_id
    join lateral private.season_award_team_director(team_season.team_id, p_season_id) manager on true
    where start.rider_id = total.rider_id and team_season.season_id = p_season_id
    group by team_season.display_name, manager.sporting_director_id, team_season.team_id
    order by count(*) desc, team_season.team_id
    limit 1
  ) club on true
),
  season_window as materialized (
  select season.starts_on, season.ends_on
  from public.seasons as season
  where season.id = p_season_id
), primary_progression_gains as (
  select current_rating.rider_id, stat.axis, stat.axis_order,
    progress.initial_rating as before_rating, stat.after_rating,
    stat.after_rating - progress.initial_rating as gain
  from public.rider_training_stat_progress as progress
  join public.rider_season_ratings as current_rating
    on current_rating.rider_id = progress.rider_id
   and current_rating.season_id = progress.season_id
  cross join lateral (values
    ('mountain', 1, current_rating.mountain),
    ('hills', 2, current_rating.hills),
    ('flat', 3, current_rating.flat),
    ('time_trial', 4, current_rating.time_trial),
    ('cobbles', 5, current_rating.cobbles),
    ('sprint', 6, current_rating.sprint)
  ) as stat(axis, axis_order, after_rating)
  where progress.season_id = p_season_id
    and progress.stat_code = stat.axis
    and stat.after_rating > progress.initial_rating
), primary_progression_by_rider as (
  select distinct on (rider_id) *
  from primary_progression_gains
  order by rider_id, gain desc, axis_order
), primary_rating_progression_candidates as (
  select 'primary_rating_progression'::text as award_key,
    'rider'::text as recipient_type,
    concat_ws(' ', rider.first_name, rider.last_name) as recipient_name,
    team.display_name as team_name,
    manager.sporting_director_id,
    club.team_id, rider.id as rider_id, gain.gain::numeric as stat_value,
    'points gagnés'::text as stat_label,
    jsonb_build_object('progression', jsonb_build_object(
      'axis', gain.axis, 'before', gain.before_rating, 'after', gain.after_rating
    ), 'detail', (case gain.axis
      when 'mountain' then 'MON' when 'hills' then 'VAL' when 'flat' then 'PLA'
      when 'time_trial' then 'CLM' when 'cobbles' then 'PAV' when 'sprint' then 'SPR'
    end) || ' · ' || gain.before_rating || ' → ' || gain.after_rating) as metadata,
    row_number() over (
      order by gain.gain desc, rider.last_name, rider.first_name, rider.id
    )::integer as rank
  from primary_progression_by_rider as gain
  join public.riders as rider on rider.id = gain.rider_id
  left join lateral (
    select contract.team_id
    from public.rider_contracts as contract
    join public.seasons as start_season on start_season.id = contract.start_season_id
    join public.seasons as end_season on end_season.id = contract.end_season_id
    join public.seasons as season on season.id = p_season_id
    left join public.seasons as left_season on left_season.id = contract.left_season_id
    where contract.rider_id = rider.id
      and start_season.game_year <= season.game_year
      and end_season.game_year >= season.game_year
      and contract.status not in ('planned', 'cancelled')
      and (left_season.id is null or left_season.game_year > season.game_year)
    order by start_season.game_year desc,
      contract.joined_day_number desc nulls last, contract.signed_at desc, contract.id
    limit 1
  ) as club on true
  left join public.team_seasons as team
    on team.team_id = club.team_id and team.season_id = p_season_id
  left join lateral private.season_award_team_director(club.team_id, p_season_id) as manager on true
), transfer_candidates as (
  select distinct on (contract.rider_id, contract.team_id) contract.*
  from public.rider_contracts as contract
  where contract.start_season_id = p_season_id
    and contract.acquisition_type in ('daily_auction', 'director_auction', 'direct_offer')
    and contract.status in ('active', 'completed', 'terminated')
    and contract.transfer_fee > 0
  order by contract.rider_id, contract.team_id, contract.transfer_fee desc, contract.signed_at, contract.id
), record_transfer_candidates as (
  select 'record_transfer'::text as award_key,
    'rider'::text as recipient_type,
    concat_ws(' ', rider.first_name, rider.last_name) as recipient_name,
    buyer.display_name as team_name,
    manager.sporting_director_id,
    contract.team_id, rider.id as rider_id, contract.transfer_fee as stat_value,
    '€'::text as stat_label,
    jsonb_strip_nulls(jsonb_build_object('transfer', jsonb_build_object(
      'buyer', buyer.display_name, 'seller', seller.display_name,
      'type', contract.acquisition_type
    ), 'detail', case when seller.display_name is not null
        then seller.display_name || ' → ' || buyer.display_name
        else buyer.display_name end)) as metadata,
    row_number() over (
      order by contract.transfer_fee desc, contract.signed_at, contract.id
    )::integer as rank
  from transfer_candidates as contract
  join public.riders as rider on rider.id = contract.rider_id
  join public.team_seasons as buyer
    on buyer.team_id = contract.team_id and buyer.season_id = p_season_id
  left join lateral private.season_award_team_director(contract.team_id, p_season_id) as manager on true
  left join lateral (
    select prior.team_id
    from public.rider_contracts as prior
    where contract.acquisition_type <> 'daily_auction'
      and prior.rider_id = contract.rider_id and prior.team_id <> contract.team_id
      and prior.status in ('completed', 'terminated')
      and (
        (prior.left_season_id = p_season_id
          and prior.left_day_number = contract.joined_day_number)
        or (contract.joined_day_number = 1 and prior.left_season_id is null
          and exists (
            select 1 from public.seasons as source
            join public.seasons as destination on destination.id = p_season_id
            where source.id = prior.end_season_id and source.game_year = destination.game_year - 1
          ))
      )
    order by prior.signed_at desc, prior.id
    limit 1
  ) as previous_club on true
  left join public.team_seasons as seller
    on seller.team_id = previous_club.team_id and seller.season_id = p_season_id
), article_reaction_totals as (
  select article.id, article.title, article.published_edition_id, article.sporting_director_id,
    article.team_id, article.team_name, edition.published_at, count(*)::numeric as reaction_count
  from public.media_center_articles as article
  join public.cyclogazette_editions as edition
    on edition.id = article.published_edition_id and edition.season_id = p_season_id
  join public.cyclogazette_article_reactions as reaction on reaction.article_id = article.id
  cross join season_window as season
  where article.status = 'published'
    and reaction.created_at < ((season.ends_on + 1)::timestamp at time zone 'Europe/Paris')
    and not exists (
      select 1 from public.alpha_bot_managers as bot
      where bot.sporting_director_id = article.sporting_director_id
    )
  group by article.id, edition.published_at
), top_article_by_director as (
  select distinct on (sporting_director_id) *
  from article_reaction_totals
  order by sporting_director_id, reaction_count desc, published_at, id
), article_reactions_candidates as (
  select 'article_reactions'::text as award_key,
    'director'::text as recipient_type,
    director.display_name as recipient_name,
    article.team_name,
    article.sporting_director_id, article.team_id, null::uuid as rider_id,
    article.reaction_count as stat_value, 'réactions'::text as stat_label,
    jsonb_build_object('article', jsonb_build_object(
      'id', article.id, 'title', article.title, 'editionId', article.published_edition_id
    )) as metadata,
    row_number() over (
      order by article.reaction_count desc, article.published_at, article.id
    )::integer as rank
  from top_article_by_director as article
  join public.sporting_directors as director on director.id = article.sporting_director_id
),
  candidates as (
    select * from race_day_award_candidates
    union all select * from primary_rating_progression_candidates where rank <= 3
    union all select * from record_transfer_candidates where rank <= 3
    union all select * from article_reactions_candidates where rank <= 3
  ), award_definitions (award_key, title, description) as (values
    ('article_reactions', 'L’article de la saison', 'L’article de La Cyclogazette qui a reçu le plus de réactions.'),
    ('primary_rating_progression', 'La plus forte progression', 'La plus forte hausse d’une note primaire chez un coureur au cours de la saison.'),
    ('team_race_days', 'L’équipe la plus présente', 'L’équipe qui a disputé le plus de jours de course.'),
    ('rider_race_days', 'Le coureur le plus assidu', 'Le coureur qui a disputé le plus de jours de course.'),
    ('record_transfer', 'Le transfert record', 'Le transfert qui a donné lieu à la plus forte indemnité de la saison.')
  ), podiums as (
    select award_key, jsonb_agg(
      jsonb_build_object('rank', rank, 'recipientName', recipient_name,
        'statValue', stat_value, 'statLabel', stat_label) || metadata
      order by rank
    ) as podium
    from candidates where rank between 2 and 3
    group by award_key
  )
  insert into public.season_awards (
    season_id, award_key, title, description, recipient_type, sporting_director_id,
    team_id, rider_id, recipient_name, team_name, stat_value, stat_label, metadata
  )
  select p_season_id, winner.award_key, definition.title, definition.description,
    winner.recipient_type, winner.sporting_director_id, winner.team_id, winner.rider_id,
    winner.recipient_name, winner.team_name, winner.stat_value, winner.stat_label,
    winner.metadata || case when podiums.podium is not null then jsonb_build_object('podium', podiums.podium)
      else '{}'::jsonb end
  from candidates winner
  join award_definitions definition using (award_key)
  left join podiums using (award_key)
  where winner.rank = 1
  on conflict (season_id, award_key) do nothing;
  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

revoke all on function private.create_season_five_distinctions(uuid)
  from public, anon, authenticated, service_role;

comment on column public.season_awards.metadata is
  'Immutable details and podium places captured during season finalization.';


notify pgrst, 'reload schema';
commit;
