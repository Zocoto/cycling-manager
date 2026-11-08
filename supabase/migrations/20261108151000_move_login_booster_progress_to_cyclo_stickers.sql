begin;
set local statement_timeout = '8s';
set local lock_timeout = '500ms';

-- The existing activity hooks remain responsible for daily attendance. When the
-- album is the first visit, record the same idempotent connection milestone before
-- reading the owner's stock, so a newly earned booster is immediately openable.
create or replace function public.get_current_cyclo_stickers_state(p_edition text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  v_director uuid := private.current_cyclo_stickers_director();
  v_season uuid;
begin
  perform private.require_cyclo_stickers_edition(p_edition);

  select id into v_season
  from public.seasons
  where status = 'active' and game_year >= 5;

  if v_season is not null then
    perform private.record_weekly_login_booster_connection(
      v_director, v_season, (now() at time zone 'Europe/Paris')::date
    );
  end if;

  return private.cyclo_stickers_state(p_edition, v_director) || jsonb_build_object(
    'weeklyLogin', case when v_season is not null then private.get_weekly_login_booster_progress(v_director) end
  );
end;
$$;

notify pgrst, 'reload schema';
commit;
