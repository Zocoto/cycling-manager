begin;
set local lock_timeout = '500ms';
set local statement_timeout = '8s';

-- Also usable by a privileged repair of a verified naturalization. This
-- migration itself does not replay past naturalizations or rebuild lineups.
create function private.reconcile_naturalized_competition_engagements(
  p_rider_id uuid,
  p_academy_rider_id uuid,
  p_old_country_id uuid,
  p_new_country_id uuid,
  p_now timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
set lock_timeout = '500ms'
as $$
declare
  v_rider_status text;
  v_proxy record;
begin
  if num_nonnulls(p_rider_id, p_academy_rider_id) <> 1
    or p_old_country_id is null or p_new_country_id is null
    or p_old_country_id = p_new_country_id or p_now is null then
    return;
  end if;

  if p_rider_id is not null then
    select rider.status into v_rider_status
    from public.riders as rider
    where rider.id = p_rider_id and rider.country_id = p_new_country_id
      and rider.status in ('active', 'free_agent', 'academy')
    for no key update;
    if not found then
      return;
    end if;

    if v_rider_status = 'academy' and not exists (
      select 1
      from public.academy_competition_rider_links as link
      join public.seasons as season on season.id = link.season_id and season.status = 'active'
      join public.youth_academy_riders as academy on academy.id = link.academy_rider_id
      where link.rider_id = p_rider_id and academy.status in ('active', 'recruited')
        and academy.country_id = p_new_country_id
    ) then
      return;
    end if;

    perform private.reconcile_rider_cn_nationality(
      p_rider_id, p_old_country_id, p_new_country_id, p_now
    );
    if v_rider_status <> 'academy' then
      perform private.reconcile_rider_callup_nationality(
        p_rider_id, null, p_old_country_id, p_new_country_id, p_now
      );
    end if;
    return;
  end if;

  perform 1
  from public.youth_academy_riders as academy
  where academy.id = p_academy_rider_id and academy.country_id = p_new_country_id
    and academy.status in ('active', 'recruited')
  for no key update;
  if not found then
    return;
  end if;

  -- Pro CN can use a season-scoped competition identity for a junior.
  -- Updating only the live proxy runs the same CN trigger as a pro change.
  for v_proxy in
    select proxy.id, proxy.country_id
    from public.academy_competition_rider_links as link
    join public.seasons as season on season.id = link.season_id and season.status = 'active'
    join public.riders as proxy on proxy.id = link.rider_id and proxy.status = 'academy'
    where link.academy_rider_id = p_academy_rider_id
    for no key update of proxy
  loop
    if v_proxy.country_id is distinct from p_new_country_id then
      update public.riders set country_id = p_new_country_id where id = v_proxy.id;
    end if;
    -- A previously aligned proxy can still have a stale entry from before
    -- these triggers existed. An older proxy may have missed two changes.
    if v_proxy.country_id is distinct from p_old_country_id then
      perform private.reconcile_rider_cn_nationality(
        v_proxy.id, p_old_country_id, p_new_country_id, p_now
      );
    end if;
  end loop;

  perform private.reconcile_rider_callup_nationality(
    null, p_academy_rider_id, p_old_country_id, p_new_country_id, p_now
  );
end;
$$;

create function private.sync_competition_engagements_on_country_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed_at timestamptz := clock_timestamp();
begin
  if tg_table_name = 'riders' then
    perform private.reconcile_naturalized_competition_engagements(
      new.id, null, old.country_id, new.country_id, v_changed_at
    );
  else
    perform private.reconcile_naturalized_competition_engagements(
      null, new.id, old.country_id, new.country_id, v_changed_at
    );
  end if;
  return new;
end;
$$;

create trigger sync_competition_engagements_on_country_change
after update of country_id on public.riders
for each row when (old.country_id is distinct from new.country_id)
execute function private.sync_competition_engagements_on_country_change();

create trigger sync_competition_engagements_on_country_change
after update of country_id on public.youth_academy_riders
for each row when (old.country_id is distinct from new.country_id)
execute function private.sync_competition_engagements_on_country_change();

revoke all on function private.reconcile_naturalized_competition_engagements(uuid,uuid,uuid,uuid,timestamptz),
  private.sync_competition_engagements_on_country_change()
from public, anon, authenticated, service_role;

commit;
