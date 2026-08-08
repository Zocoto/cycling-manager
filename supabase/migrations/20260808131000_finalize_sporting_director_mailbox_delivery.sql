begin;

-- Les synchronisations CN sont régulièrement rejouées de façon idempotente.
-- Une écriture strictement identique ne doit ni réveiller le message ni
-- déclencher inutilement le flux Realtime de la boîte mail.
create or replace function public.skip_unchanged_national_notification_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(new.title, new.message, new.read_at)
    is not distinct from row(old.title, old.message, old.read_at) then
    return null;
  end if;

  return new;
end;
$$;

create trigger national_championship_notifications_skip_unchanged_update
before update of title, message, read_at
on public.national_championship_notifications
for each row
execute function public.skip_unchanged_national_notification_update();

revoke all
on function public.skip_unchanged_national_notification_update()
from public, anon, authenticated;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sporting_director_messages'
  ) then
    alter publication supabase_realtime
      add table public.sporting_director_messages;
  end if;
end;
$$;

comment on function public.skip_unchanged_national_notification_update() is
  'Ignore les resynchronisations CN sans changement afin de préserver l’état lu de la boîte mail.';

commit;
