begin;

create table public.global_chat_read_receipts (
  sporting_director_id uuid primary key
    references public.sporting_directors(id)
    on delete cascade,
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.global_chat_read_receipts
  enable row level security;

grant all on table public.global_chat_read_receipts
to service_role;

create or replace function public.has_unread_global_chat_messages()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with current_director as (
    select identity.sporting_director_id
    from public.get_current_global_chat_identity() as identity
    limit 1
  )
  select coalesce(
    (
      select exists (
        select 1
        from public.global_chat_messages as message
        left join public.global_chat_read_receipts as receipt
          on receipt.sporting_director_id =
             current_director.sporting_director_id
        where message.sporting_director_id <>
              current_director.sporting_director_id
          and message.created_at >
              coalesce(receipt.last_read_at, '-infinity'::timestamptz)
      )
      from current_director
    ),
    false
  );
$$;

create or replace function public.mark_global_chat_messages_read(
  p_last_read_at timestamptz
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_director_id uuid;
  v_last_read_at timestamptz;
begin
  select identity.sporting_director_id
  into v_director_id
  from public.get_current_global_chat_identity() as identity
  limit 1;

  if v_director_id is null then
    raise exception
      'Vous devez diriger une équipe active pour consulter le chat général.';
  end if;

  if p_last_read_at is null then
    return null;
  end if;

  v_last_read_at := least(p_last_read_at, now());

  insert into public.global_chat_read_receipts (
    sporting_director_id,
    last_read_at,
    updated_at
  )
  values (
    v_director_id,
    v_last_read_at,
    now()
  )
  on conflict (sporting_director_id)
  do update set
    last_read_at = greatest(
      public.global_chat_read_receipts.last_read_at,
      excluded.last_read_at
    ),
    updated_at = now();

  return v_last_read_at;
end;
$$;

revoke all on function public.has_unread_global_chat_messages()
from public, anon;
revoke all on function public.mark_global_chat_messages_read(timestamptz)
from public, anon;

grant execute on function public.has_unread_global_chat_messages()
to authenticated, service_role;
grant execute on function public.mark_global_chat_messages_read(timestamptz)
to authenticated, service_role;

comment on table public.global_chat_read_receipts is
  'Dernière lecture du chat général enregistrée pour chaque Directeur Sportif.';

comment on function public.has_unread_global_chat_messages() is
  'Indique si un autre Directeur Sportif a publié depuis la dernière lecture.';

comment on function public.mark_global_chat_messages_read(timestamptz) is
  'Marque comme lus tous les messages du chat général actuellement publiés.';

commit;
