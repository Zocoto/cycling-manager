begin;

alter table public.sporting_directors
  add column avatar_frame_key text;

alter table public.sporting_directors
  add constraint sporting_directors_avatar_frame_key_allowed
  check (avatar_frame_key is null or avatar_frame_key = 'alpha_tester');

create table public.sporting_director_trophies (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null
    references public.sporting_directors(id)
    on delete cascade,
  trophy_key text not null,
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sporting_director_id, trophy_key),
  constraint sporting_director_trophies_key_format
    check (trophy_key ~ '^[a-z0-9_]{3,80}$'),
  constraint sporting_director_trophies_claimed_after_availability
    check (claimed_at is null or claimed_at >= available_at)
);

create index sporting_director_trophies_pending_idx
  on public.sporting_director_trophies (sporting_director_id, available_at)
  where claimed_at is null;

insert into public.sporting_director_trophies (
  sporting_director_id,
  trophy_key
)
select
  director.id,
  'alpha_tester'
from public.sporting_directors as director
where director.status = 'active'
  and director.auth_user_id is not null
  and not exists (
    select 1
    from public.alpha_bot_managers as bot
    where bot.sporting_director_id = director.id
  )
on conflict (sporting_director_id, trophy_key) do nothing;

create or replace function public.grant_alpha_tester_trophy_to_new_director()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and new.auth_user_id is not null then
    insert into public.sporting_director_trophies (
      sporting_director_id,
      trophy_key
    )
    values (new.id, 'alpha_tester')
    on conflict (sporting_director_id, trophy_key) do nothing;
  end if;

  return new;
end;
$$;

create trigger grant_alpha_tester_trophy_after_director_creation
after insert on public.sporting_directors
for each row
execute function public.grant_alpha_tester_trophy_to_new_director();

create trigger grant_alpha_tester_trophy_after_director_activation
after update of status, auth_user_id on public.sporting_directors
for each row
when (new.status = 'active' and new.auth_user_id is not null)
execute function public.grant_alpha_tester_trophy_to_new_director();

create or replace function public.remove_alpha_tester_trophy_from_bot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.sporting_director_trophies
  where sporting_director_id = new.sporting_director_id
    and trophy_key = 'alpha_tester';

  update public.sporting_directors
  set avatar_frame_key = null
  where id = new.sporting_director_id;

  return new;
end;
$$;

create trigger remove_alpha_tester_trophy_after_bot_creation
after insert on public.alpha_bot_managers
for each row
execute function public.remove_alpha_tester_trophy_from_bot();

create or replace function public.claim_current_sporting_director_trophy(
  p_trophy_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_director_id uuid;
  v_claimed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Vous devez être connecté pour récupérer ce trophée.';
  end if;

  if trim(coalesce(p_trophy_key, '')) <> 'alpha_tester' then
    raise exception 'Ce trophée ne peut pas être récupéré.';
  end if;

  select director.id
  into v_director_id
  from public.sporting_directors as director
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  for update;

  if v_director_id is null then
    raise exception 'Profil de Directeur Sportif introuvable.';
  end if;

  if exists (
    select 1
    from public.alpha_bot_managers as bot
    where bot.sporting_director_id = v_director_id
  ) then
    raise exception 'Cette récompense est réservée aux joueurs de la phase Alpha.';
  end if;

  update public.sporting_director_trophies
  set claimed_at = coalesce(claimed_at, now())
  where sporting_director_id = v_director_id
    and trophy_key = 'alpha_tester'
  returning claimed_at into v_claimed_at;

  if v_claimed_at is null then
    raise exception 'Ce trophée n’est pas disponible pour ce compte.';
  end if;

  return jsonb_build_object(
    'status', 'claimed',
    'trophy_key', 'alpha_tester',
    'claimed_at', v_claimed_at
  );
end;
$$;

create or replace function public.validate_sporting_director_avatar_frame()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.avatar_frame_key is null then
    return new;
  end if;

  if new.avatar_frame_key <> 'alpha_tester' then
    raise exception 'Liseré d’avatar inconnu.';
  end if;

  if not exists (
    select 1
    from public.sporting_director_trophies as trophy
    where trophy.sporting_director_id = new.id
      and trophy.trophy_key = 'alpha_tester'
      and trophy.claimed_at is not null
  ) then
    raise exception 'Récupérez d’abord le trophée Alphatesteur.';
  end if;

  return new;
end;
$$;

create trigger validate_sporting_director_avatar_frame_before_write
before insert or update of avatar_frame_key on public.sporting_directors
for each row
execute function public.validate_sporting_director_avatar_frame();

alter table public.sporting_director_trophies enable row level security;

create policy sporting_director_trophies_select_own
  on public.sporting_director_trophies
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sporting_directors as director
      where director.id = sporting_director_id
        and director.auth_user_id = (select auth.uid())
    )
  );

grant select on table public.sporting_director_trophies to authenticated;
grant all privileges on table public.sporting_director_trophies to service_role;
grant update (avatar_frame_key)
  on table public.sporting_directors
  to authenticated;

revoke all on function public.claim_current_sporting_director_trophy(text)
  from public, anon;
grant execute on function public.claim_current_sporting_director_trophy(text)
  to authenticated;

revoke all on function public.grant_alpha_tester_trophy_to_new_director()
  from public, anon, authenticated;
revoke all on function public.remove_alpha_tester_trophy_from_bot()
  from public, anon, authenticated;
revoke all on function public.validate_sporting_director_avatar_frame()
  from public, anon, authenticated;

comment on table public.sporting_director_trophies is
  'Distinctions de carrière disponibles ou récupérées par chaque Directeur Sportif.';
comment on column public.sporting_directors.avatar_frame_key is
  'Liseré public optionnel débloqué par un trophée de carrière.';
comment on function public.claim_current_sporting_director_trophy(text) is
  'Récupère de façon idempotente un trophée disponible pour le Directeur Sportif connecté.';

notify pgrst, 'reload schema';

commit;