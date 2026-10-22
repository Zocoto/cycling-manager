begin;
set local lock_timeout = '1s';
set local statement_timeout = '5s';
set local application_name = 'site-release-management-20261022';

create table private.site_release_settings (
  singleton boolean primary key default true check (singleton),
  version text not null check (length(version) <= 40 and version ~ '^(0|[1-9][0-9]{0,5})[.](0|[1-9][0-9]{0,5})[.](0|[1-9][0-9]{0,5})(-[A-Za-z0-9]+([.][A-Za-z0-9]+)*)?$'),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
create table private.site_release_events (
  revision integer primary key check (revision > 0),
  version text not null,
  previous_version text,
  note text not null default '' check (length(note) <= 180),
  actor_user_id uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now()
);
alter table private.site_release_settings enable row level security;
alter table private.site_release_events enable row level security;
revoke all on private.site_release_settings, private.site_release_events from public, anon, authenticated, service_role;

-- Preserve the currently displayed label. No news, gameplay or historical result is touched.
insert into private.site_release_settings(version) values ('0.9.1');
insert into private.site_release_events(revision, version, note) values (1, '0.9.1', '');

create function public.get_active_site_release()
returns table(version text, revision integer, updated_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select settings.version, settings.revision, settings.updated_at
  from private.site_release_settings settings where singleton;
$$;

create function public.get_site_release_management()
returns table(version text, revision integer, updated_at timestamptz, history jsonb)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if private.current_game_role() is distinct from 'owner' then
    raise exception 'Accès réservé au fondateur.' using errcode = '42501';
  end if;
  return query select settings.version, settings.revision, settings.updated_at,
    coalesce((select jsonb_agg(jsonb_build_object('version', recent.version,
      'previous_version', recent.previous_version, 'revision', recent.revision,
      'note', recent.note, 'recorded_at', recent.recorded_at) order by recent.revision desc)
      from (select events.* from private.site_release_events events order by events.revision desc limit 10) recent), '[]'::jsonb)
  from private.site_release_settings settings where singleton;
end;
$$;

create function public.set_active_site_release(p_version text, p_note text, p_expected_revision integer)
returns table(version text, revision integer, updated_at timestamptz, history jsonb)
language plpgsql security definer set search_path = '' set lock_timeout = '1s'
as $$
declare
  v_current private.site_release_settings%rowtype;
  v_version text := btrim(p_version);
  v_note text := btrim(coalesce(p_note, ''));
begin
  if private.current_game_role() is distinct from 'owner' then
    raise exception 'Accès réservé au fondateur.' using errcode = '42501';
  end if;
  if v_version is null or length(v_version) > 40
    or v_version !~ '^(0|[1-9][0-9]{0,5})[.](0|[1-9][0-9]{0,5})[.](0|[1-9][0-9]{0,5})(-[A-Za-z0-9]+([.][A-Za-z0-9]+)*)?$'
    or length(v_note) > 180 or p_expected_revision is null or p_expected_revision < 1 or p_expected_revision >= 2147483647 then
    raise exception 'Version ou commentaire invalide.' using errcode = '22023';
  end if;
  select * into v_current from private.site_release_settings settings where singleton for update;
  if not found or v_current.revision <> p_expected_revision then
    raise exception 'La version a été modifiée ailleurs.' using errcode = '40001';
  end if;
  -- Saving the same label is a no-op, not a duplicate history entry.
  if v_current.version = v_version then
    return query select * from public.get_site_release_management();
    return;
  end if;
  update private.site_release_settings settings
    set version = v_version, revision = v_current.revision + 1, updated_at = now()
    where singleton;
  insert into private.site_release_events(revision, version, previous_version, note, actor_user_id)
    values(v_current.revision + 1, v_version, v_current.version, v_note, auth.uid());
  return query select * from public.get_site_release_management();
end;
$$;

revoke all on function public.get_active_site_release(), public.get_site_release_management(),
  public.set_active_site_release(text, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.get_active_site_release() to anon, authenticated, service_role;
grant execute on function public.get_site_release_management(), public.set_active_site_release(text, text, integer) to authenticated;
commit;
