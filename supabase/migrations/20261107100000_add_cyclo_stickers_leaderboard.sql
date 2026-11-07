begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

create function public.get_current_cyclo_stickers_leaderboard(p_edition text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_director uuid := private.current_cyclo_stickers_director();
  v_result jsonb;
begin
  perform private.require_cyclo_stickers_edition(p_edition);

  -- The inventory primary key makes each pasted row one distinct sticker.
  with scores as (
    select director.id, director.display_name, count(*) as pasted_count
    from public.cyclo_stickers_card_inventory inventory
    join public.sporting_directors director on director.id = inventory.sporting_director_id
    where inventory.edition_id = p_edition
      and inventory.pasted
      and director.status = 'active'
      and director.auth_user_id is not null
      and not exists (
        select 1 from public.alpha_bot_managers bot where bot.sporting_director_id = director.id
      )
    group by director.id, director.display_name
  ), ranked as (
    select id, display_name, pasted_count,
      rank() over (order by pasted_count desc) as placement,
      row_number() over (order by pasted_count desc, display_name, id) as list_order
    from scores
  ), entries as (
    select list_order, id, jsonb_build_object(
      'rank', placement,
      'displayName', display_name,
      'pastedCount', pasted_count,
      'isViewer', id = v_director
    ) as entry
    from ranked
    where list_order <= 20 or id = v_director
  )
  select jsonb_build_object(
    'entries', coalesce((select jsonb_agg(entry order by list_order) from entries where list_order <= 20), '[]'::jsonb),
    'viewer', (select entry from entries where id = v_director)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_current_cyclo_stickers_leaderboard(text) from public, anon, authenticated;
grant execute on function public.get_current_cyclo_stickers_leaderboard(text) to authenticated;

notify pgrst, 'reload schema';

commit;
