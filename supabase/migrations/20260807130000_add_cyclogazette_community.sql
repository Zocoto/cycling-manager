begin;

create table public.cyclogazette_likes (
  edition_id uuid not null references public.cyclogazette_editions(id) on delete cascade,
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (edition_id, sporting_director_id)
);

create table public.cyclogazette_comments (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.cyclogazette_editions(id) on delete cascade,
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 2 and 400),
  created_at timestamptz not null default now()
);

create index cyclogazette_comments_edition_idx
  on public.cyclogazette_comments (edition_id, created_at desc);

alter table public.cyclogazette_likes enable row level security;
alter table public.cyclogazette_comments enable row level security;

create policy cyclogazette_likes_read_authenticated on public.cyclogazette_likes for select to authenticated using (true);
create policy cyclogazette_comments_read_authenticated on public.cyclogazette_comments for select to authenticated using (true);

create or replace function private.current_sporting_director_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.sporting_directors where auth_user_id = auth.uid() and status = 'active' limit 1;
$$;

create or replace function public.toggle_cyclogazette_like(p_edition_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_director_id uuid := private.current_sporting_director_id();
begin
  if v_director_id is null or not exists (select 1 from public.cyclogazette_editions where id = p_edition_id) then raise exception 'Edition ou directeur introuvable'; end if;
  if exists (select 1 from public.cyclogazette_likes where edition_id = p_edition_id and sporting_director_id = v_director_id) then
    delete from public.cyclogazette_likes where edition_id = p_edition_id and sporting_director_id = v_director_id;
    return false;
  end if;
  insert into public.cyclogazette_likes (edition_id, sporting_director_id) values (p_edition_id, v_director_id);
  return true;
end;
$$;

create or replace function public.post_cyclogazette_comment(p_edition_id uuid, p_message text)
returns void language plpgsql security definer set search_path = public as $$
declare v_director_id uuid := private.current_sporting_director_id(); v_message text := btrim(coalesce(p_message, ''));
begin
  if v_director_id is null or not exists (select 1 from public.cyclogazette_editions where id = p_edition_id) then raise exception 'Edition ou directeur introuvable'; end if;
  if char_length(v_message) not between 2 and 400 then raise exception 'Commentaire invalide'; end if;
  insert into public.cyclogazette_comments (edition_id, sporting_director_id, message) values (p_edition_id, v_director_id, v_message);
end;
$$;

revoke all on function private.current_sporting_director_id() from public;
revoke all on function public.toggle_cyclogazette_like(uuid) from public, anon;
revoke all on function public.post_cyclogazette_comment(uuid, text) from public, anon;
grant execute on function public.toggle_cyclogazette_like(uuid) to authenticated, service_role;
grant execute on function public.post_cyclogazette_comment(uuid, text) to authenticated, service_role;
grant all on public.cyclogazette_likes, public.cyclogazette_comments to service_role;

notify pgrst, 'reload schema';
commit;
