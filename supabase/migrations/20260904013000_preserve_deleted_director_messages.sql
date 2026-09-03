begin;

-- Une suppression explicite est une préférence durable du DS. La source
-- métier (convocation, résultat, WildCard...) peut continuer d'évoluer, mais
-- sa synchronisation ne doit jamais recréer le courrier supprimé.
create table public.sporting_director_message_deletions (
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  source_reference text not null,
  deleted_at timestamptz not null default now(),
  primary key (sporting_director_id, source_reference),
  constraint sporting_director_message_deletions_source_present
    check (btrim(source_reference) <> '')
);

alter table public.sporting_director_message_deletions
  enable row level security;

grant all privileges
on table public.sporting_director_message_deletions
to service_role;

comment on table public.sporting_director_message_deletions is
  'Mémorise les suppressions explicites afin que les producteurs automatiques ne recréent pas les courriers du DS.';

create or replace function public.prevent_deleted_director_message_recreation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.sporting_director_message_deletions as deletion
    where deletion.sporting_director_id = new.sporting_director_id
      and deletion.source_reference = new.source_reference
  ) then
    return null;
  end if;

  return new;
end;
$$;

revoke all
on function public.prevent_deleted_director_message_recreation()
from public, anon, authenticated;

grant execute
on function public.prevent_deleted_director_message_recreation()
to service_role;

drop trigger if exists prevent_deleted_director_message_recreation
  on public.sporting_director_messages;
create trigger prevent_deleted_director_message_recreation
before insert on public.sporting_director_messages
for each row execute function
  public.prevent_deleted_director_message_recreation();

create or replace function public.delete_current_director_message(
  p_message_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sporting_director_id uuid;
  v_source_reference text;
begin
  select message.sporting_director_id, message.source_reference
  into v_sporting_director_id, v_source_reference
  from public.sporting_director_messages as message
  join public.sporting_directors as director
    on director.id = message.sporting_director_id
  where message.id = p_message_id
    and director.auth_user_id = auth.uid()
  for update of message;

  if not found then
    return false;
  end if;

  insert into public.sporting_director_message_deletions (
    sporting_director_id,
    source_reference,
    deleted_at
  ) values (
    v_sporting_director_id,
    v_source_reference,
    now()
  )
  on conflict (sporting_director_id, source_reference)
  do update set deleted_at = excluded.deleted_at;

  delete from public.sporting_director_messages as message
  where message.id = p_message_id
    and message.sporting_director_id = v_sporting_director_id;

  return found;
end;
$$;

create or replace function public.delete_current_director_messages(
  p_scope text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_scope not in ('read', 'older_than_7_days', 'all') then
    raise exception 'Mode de nettoyage invalide.';
  end if;

  insert into public.sporting_director_message_deletions (
    sporting_director_id,
    source_reference,
    deleted_at
  )
  select
    message.sporting_director_id,
    message.source_reference,
    now()
  from public.sporting_director_messages as message
  join public.sporting_directors as director
    on director.id = message.sporting_director_id
  where director.auth_user_id = auth.uid()
    and case p_scope
      when 'read' then message.read_at is not null
      when 'older_than_7_days' then message.sent_at < now() - interval '7 days'
      else true
    end
  on conflict (sporting_director_id, source_reference)
  do update set deleted_at = excluded.deleted_at;

  delete from public.sporting_director_messages as message
  using public.sporting_directors as director
  where director.id = message.sporting_director_id
    and director.auth_user_id = auth.uid()
    and case p_scope
      when 'read' then message.read_at is not null
      when 'older_than_7_days' then message.sent_at < now() - interval '7 days'
      else true
    end;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all
on function public.delete_current_director_message(uuid)
from public, anon;

revoke all
on function public.delete_current_director_messages(text)
from public, anon;

grant execute
on function public.delete_current_director_message(uuid)
to authenticated, service_role;

grant execute
on function public.delete_current_director_messages(text)
to authenticated, service_role;

commit;
