begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

create table public.gazette_article_reactions (
  target_key text not null,
  emoji text not null check (emoji in ('😂', '👏', '🔥', '🤝', '❤️', '👎', '🙄', '😡', '🤡')),
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (target_key, emoji, sporting_director_id)
);

create index gazette_article_reactions_director_idx
  on public.gazette_article_reactions (sporting_director_id);

-- Receipts outlive emoji toggles and are global across the financial seasons.
create table public.gazette_media_reaction_rewards (
  article_id uuid not null references public.media_center_articles(id) on delete cascade,
  reader_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  primary key (article_id, reader_director_id)
);

create index gazette_media_reaction_rewards_reader_idx
  on public.gazette_media_reaction_rewards (reader_director_id);

alter table public.gazette_article_reactions enable row level security;
alter table public.gazette_media_reaction_rewards enable row level security;
revoke all on public.gazette_article_reactions, public.gazette_media_reaction_rewards
  from public, anon, authenticated;

create function private.gazette_article_reaction_key(p_kind text, p_id text, p_edition_id uuid)
returns text
language sql immutable set search_path = ''
as $$
  select case
    when p_kind = 'media' and p_edition_id is null
      and p_id ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      then 'media:' || (p_id::uuid)::text
    when p_kind in ('race', 'jersey', 'feature') and p_edition_id is not null
      and p_id = btrim(p_id) and char_length(p_id) between 1 and 160
      then 'edition:' || p_edition_id::text || ':' || p_kind || ':' || p_id
    when p_kind = 'joke' and p_edition_id is not null and p_id ~ '^(italy|france|spain):[0-2]$'
      then 'edition:' || p_edition_id::text || ':joke:' || p_id
  end;
$$;

revoke all on function private.gazette_article_reaction_key(text, text, uuid)
  from public, anon, authenticated, service_role;

create function public.toggle_gazette_article_reaction(
  p_target_kind text, p_target_id text, p_edition_id uuid, p_emoji text
)
returns jsonb
language plpgsql security definer set search_path = ''
set lock_timeout = '2s'
as $$
declare
  v_key text := private.gazette_article_reaction_key(p_target_kind, p_target_id, p_edition_id);
  v_director_id uuid;
  v_article public.media_center_articles%rowtype;
  v_edition_content jsonb;
  v_edition_day integer;
  v_story_filter jsonb;
  v_jersey boolean;
  v_valid boolean;
  v_active boolean;
  v_count integer;
  v_account record;
begin
  select director.id into v_director_id
  from public.sporting_directors as director
  where director.auth_user_id = auth.uid() and director.status = 'active';

  if v_director_id is null then
    raise exception using errcode = '42501', message = 'Aucun Directeur Sportif actif ne correspond à ce compte.';
  end if;
  if v_key is null or p_emoji is null or p_emoji not in ('😂', '👏', '🔥', '🤝', '❤️', '👎', '🙄', '😡', '🤡') then
    raise exception 'Cette réaction est invalide.';
  end if;

  if p_target_kind = 'media' then
    select article.* into v_article
    from public.media_center_articles as article
    where article.id = p_target_id::uuid and article.status = 'published';
    if not found then
      raise exception 'Cet article publié est introuvable.';
    end if;

    if v_article.sporting_director_id = v_director_id or exists (
      select 1 from public.team_manager_assignments as assignment
      where assignment.team_id = v_article.team_id
        and assignment.sporting_director_id = v_director_id
        and assignment.status = 'active'
    ) then
      raise exception 'Vous ne pouvez pas réagir à une tribune de votre équipe.';
    end if;
  else
    select edition.content, season_day.day_number into v_edition_content, v_edition_day
    from public.cyclogazette_editions as edition
    join public.season_days as season_day on season_day.id = edition.season_day_id
    where edition.id = p_edition_id and edition.published_at <= now();

    if not found then
      raise exception 'Cet article publié est introuvable.';
    end if;

    v_story_filter := jsonb_build_array(jsonb_build_object('id', p_target_id));
    case p_target_kind
      when 'race' then
        v_valid := v_edition_content->'lead'->>'id' = p_target_id
          or v_edition_content->'raceStories' @> v_story_filter
          or v_edition_content->'raceHighlights' @> v_story_filter
          or v_edition_content->'mercatoStories' @> v_story_filter;
      when 'joke' then
        v_valid := case split_part(p_target_id, ':', 1)
          when 'italy' then v_edition_day between 2 and 7
          when 'france' then v_edition_day between 9 and 15
          when 'spain' then v_edition_day between 17 and 22
        end;
      else
        v_valid := v_edition_content->'featureStories' @> v_story_filter;
        if v_valid then
          select exists (
            select 1 from jsonb_array_elements(v_edition_content->'featureStories') as story
            where story->>'id' = p_target_id
              and story->>'kind' in ('national_team_jersey', 'national_champion_jersey')
              and jsonb_typeof(story->'jerseyReveal') = 'object'
          ) into v_jersey;
          v_valid := (p_target_kind = 'jersey') = v_jersey;
        end if;
        if p_target_kind = 'feature' and p_target_id = 'nations-cup-champion' then
          v_valid := jsonb_typeof(v_edition_content->'nationsCupSpecial') = 'object';
        end if;
    end case;

    if v_valid is not true then
      raise exception 'Cet article publié est introuvable.';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('gazette-article-reaction:' || v_key || ':' || v_director_id::text, 0));

  delete from public.gazette_article_reactions
  where target_key = v_key and emoji = p_emoji and sporting_director_id = v_director_id;

  v_active := not found;
  if v_active then
    insert into public.gazette_article_reactions (target_key, emoji, sporting_director_id)
    values (v_key, p_emoji, v_director_id);

    if p_target_kind = 'media' and not exists (
      select 1 from public.gazette_media_reaction_rewards as receipt
      where receipt.article_id = v_article.id and receipt.reader_director_id = v_director_id
    ) then
      select team_season.id as team_season_id, season_day.id as season_day_id, season_day.day_number
      into v_account
      from public.seasons as season
      join public.team_seasons as team_season on team_season.season_id = season.id
        and team_season.team_id = v_article.team_id and team_season.status = 'active'
      join public.season_days as season_day on season_day.season_id = season.id
        and season_day.day_number = season.current_day_number
      where season.status = 'active'
      for update of team_season;

      if found then
        insert into public.gazette_media_reaction_rewards (article_id, reader_director_id)
        values (v_article.id, v_director_id)
        on conflict do nothing;

        if found then
          update public.team_seasons set cash_balance = cash_balance + 1000
          where id = v_account.team_season_id;

          insert into public.team_finance_transactions (
            team_season_id, season_day_id, day_number, amount, category, status,
            description, source_reference, posted_at
          ) values (
            v_account.team_season_id, v_account.season_day_id, v_account.day_number,
            1000, 'other', 'posted', 'Réactions aux articles du Média Center',
            'gazette-media-reaction:' || v_article.id::text || ':' || v_director_id::text, now()
          );
        end if;
      end if;
    end if;
  end if;

  select count(*)::integer into v_count from public.gazette_article_reactions
  where target_key = v_key and emoji = p_emoji;

  return jsonb_build_object('active', v_active, 'count', v_count);
end;
$$;

create function public.get_gazette_article_reaction_summaries(p_targets jsonb)
returns table(target_key text, emoji text, count integer, reacted_by_viewer boolean, can_react boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare v_director_id uuid;
begin
  if auth.uid() is null or jsonb_typeof(p_targets) is distinct from 'array' then return; end if;
  if jsonb_array_length(p_targets) > 120 then return; end if;

  select director.id into v_director_id from public.sporting_directors as director
  where director.auth_user_id = auth.uid() and director.status = 'active';

  return query
  with targets as (
    select distinct private.gazette_article_reaction_key(target.kind, target.id, target."editionId") as key
    from jsonb_to_recordset(p_targets) as target(kind text, id text, "editionId" uuid)
  )
  select target.key, reaction.emoji, count(reaction.emoji)::integer,
    coalesce(bool_or(reaction.sporting_director_id = v_director_id), false),
    v_director_id is not null and (target.key not like 'media:%' or (
      article.status = 'published' and article.sporting_director_id <> v_director_id and not exists (
        select 1 from public.team_manager_assignments as assignment
        where assignment.team_id = article.team_id and assignment.sporting_director_id = v_director_id
          and assignment.status = 'active'
      )
    )) is true
  from targets as target
  left join public.gazette_article_reactions as reaction on reaction.target_key = target.key
  left join public.media_center_articles as article on article.id = case
    when target.key like 'media:%' then substring(target.key from 7)::uuid
  end
  where target.key is not null
  group by target.key, reaction.emoji, article.id;
end;
$$;

revoke all on function public.toggle_gazette_article_reaction(text, text, uuid, text),
  public.get_gazette_article_reaction_summaries(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.toggle_gazette_article_reaction(text, text, uuid, text),
  public.get_gazette_article_reaction_summaries(jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
