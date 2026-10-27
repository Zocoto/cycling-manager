-- A visible game tab can span several days without remounting its layout.
-- Reuse the existing presence heartbeat's first activity INSERT of the day.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';

create or replace function private.award_weekly_login_booster_from_activity()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_director uuid;v_season uuid;
begin
  -- Historical imports and later heartbeat UPDATEs must not mint boosters.
  if new.activity_on is distinct from (now() at time zone 'Europe/Paris')::date then return null; end if;
  select d.id,s.id into v_director,v_season from public.seasons s
    join public.sporting_directors d on d.auth_user_id=new.auth_user_id and d.status='active'
    where s.status='active' and s.game_year>=5 order by s.game_year desc limit 1;
  if v_director is not null then
    perform private.record_weekly_login_booster_connection(v_director,v_season,new.activity_on);
  end if;
  return null;
end;
$$;
revoke all on function private.award_weekly_login_booster_from_activity() from public,anon,authenticated;
drop trigger if exists weekly_login_booster_daily_activity on public.player_daily_activity;
create trigger weekly_login_booster_daily_activity after insert on public.player_daily_activity
  for each row execute function private.award_weekly_login_booster_from_activity();
commit;
