begin;
set local application_name = 'published-news-sitemap-projection-20261121';
set local lock_timeout = '2s';
set local statement_timeout = '15s';

-- Sitemap readers need only publication identifiers and public snapshot dates.
-- Preserve the existing feed RPC and its 50-article bound without granting
-- access to the private table, draft documents or editorial update timestamps.
create function public.get_published_game_news_sitemap(
  p_after_id uuid default null,
  p_limit integer default 250
)
returns table (id uuid, published_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select news.id, news.published_at, news.published_updated_at
  from private.game_product_news as news
  where news.published is not null
    and (p_after_id is null or news.id > p_after_id)
  order by news.id
  limit least(greatest(coalesce(p_limit, 250), 1), 500);
$$;

revoke all on function public.get_published_game_news_sitemap(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.get_published_game_news_sitemap(uuid, integer)
  to service_role;

comment on function public.get_published_game_news_sitemap(uuid, integer) is
  'Server sitemap projection of published article UUIDs and public snapshot dates only; bounded UUID keyset pagination.';

notify pgrst, 'reload schema';
commit;
