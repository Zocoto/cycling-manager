begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';

create table public.site_browser_presence (
  browser_id uuid primary key,
  auth_user_id uuid references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
create index site_browser_presence_recent_idx on public.site_browser_presence(last_seen_at);
alter table public.site_browser_presence enable row level security;
revoke all on public.site_browser_presence from public, anon, authenticated;

create function public.record_site_browser_presence(p_browser_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_players jsonb;
  v_visitors integer;
begin
  if p_browser_id is null then raise exception 'Browser identifier required'; end if;
  insert into public.site_browser_presence as presence(browser_id, auth_user_id, last_seen_at)
  values (p_browser_id, v_user_id, now())
  on conflict (browser_id) do update
    set auth_user_id = excluded.auth_user_id, last_seen_at = excluded.last_seen_at
    where presence.last_seen_at < now() - interval '2 minutes'
       or presence.auth_user_id is distinct from excluded.auth_user_id;

  delete from public.site_browser_presence
  where browser_id in (
    select browser_id from public.site_browser_presence
    where last_seen_at < now() - interval '1 day'
    order by last_seen_at limit 200
  );

  select count(*) into v_visitors from public.site_browser_presence
  where auth_user_id is null and last_seen_at >= now() - interval '15 minutes';

  with recent_users as (
    select auth_user_id from public.player_daily_activity
    where last_seen_at >= now() - interval '15 minutes'
    union
    select auth_user_id from public.site_browser_presence
    where auth_user_id is not null and last_seen_at >= now() - interval '15 minutes'
  ), players as (
    select director.id, director.display_name, director.username
    from recent_users
    join public.sporting_directors director on director.auth_user_id = recent_users.auth_user_id
    where director.status = 'active'
      and not exists (select 1 from public.alpha_bot_managers bot where bot.sporting_director_id = director.id)
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', coalesce(nullif(btrim(display_name), ''), username))
    order by display_name, id), '[]'::jsonb) into v_players from players;

  return jsonb_build_object('players', v_players, 'visitors', v_visitors,
    'total', jsonb_array_length(v_players) + v_visitors);
end;
$$;
revoke all on function public.record_site_browser_presence(uuid) from public;
grant execute on function public.record_site_browser_presence(uuid) to anon, authenticated;
comment on function public.record_site_browser_presence(uuid) is
  'Header presence over fifteen minutes: deduplicated active players and anonymous browsers, no private account identifiers.';
notify pgrst, 'reload schema';
commit;
