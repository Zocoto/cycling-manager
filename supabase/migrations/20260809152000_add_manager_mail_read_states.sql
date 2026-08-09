begin;

create table if not exists public.manager_mail_read_states (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  message_key text not null,
  read_at timestamptz not null default now(),
  primary key (auth_user_id, message_key)
);

alter table public.manager_mail_read_states enable row level security;

create policy "Les DS gèrent la lecture de leurs courriers"
on public.manager_mail_read_states
for all
to authenticated
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

grant select, insert, update, delete on public.manager_mail_read_states to authenticated;

notify pgrst, 'reload schema';

commit;
