begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Le nom public et l'identifiant de mention sont identiques à l'inscription.
-- Lorsqu'un joueur change seulement son nom depuis son profil, conserver cette
-- synchronisation pour que l'autocomplétion du chat propose immédiatement le
-- nouveau @. Une mise à jour qui fournit explicitement un username différent
-- reste prioritaire.
create or replace function private.sync_sporting_director_chat_username()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.display_name is distinct from old.display_name
    and new.username is not distinct from old.username
  then
    new.username := new.display_name;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_sporting_director_chat_username
  on public.sporting_directors;

create trigger sync_sporting_director_chat_username
before update of display_name on public.sporting_directors
for each row
execute function private.sync_sporting_director_chat_username();

-- Les messages gardent le texte du @ choisi par leur auteur. Lorsqu'une
-- mention structurée existe, faire suivre ce texte au nouvel identifiant du
-- destinataire sans toucher aux messages qui ne le mentionnent pas.
create or replace function private.refresh_sporting_director_chat_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.global_chat_messages as chat_message
  set message = replace(
    chat_message.message,
    '@' || old.username,
    '@' || new.username
  )
  where strpos(chat_message.message, '@' || old.username) > 0
    and exists (
      select 1
      from public.global_chat_mentions as mention
      where mention.message_id = chat_message.id
        and mention.mentioned_sporting_director_id = new.id
    );

  return new;
end;
$$;

drop trigger if exists refresh_sporting_director_chat_mentions
  on public.sporting_directors;

create trigger refresh_sporting_director_chat_mentions
after update of display_name, username on public.sporting_directors
for each row
when (old.username is distinct from new.username)
execute function private.refresh_sporting_director_chat_mentions();

-- Correction ciblée demandée pour Giorgos. Les deux valeurs actuelles sont
-- vérifiées avant l'écriture afin qu'une donnée inattendue fasse échouer la
-- migration plutôt que de modifier un autre compte.
do $$
declare
  v_target_id constant uuid :=
    '64ff2464-c0bd-48c0-b39a-04a600495a76'::uuid;
  v_current_username text;
  v_display_name text;
begin
  select director.username, director.display_name
  into v_current_username, v_display_name
  from public.sporting_directors as director
  where director.id = v_target_id;

  if not found then
    raise exception
      'Le profil Giorgos attendu est introuvable.';
  end if;

  if lower(btrim(v_display_name)) not like 'giorgos%' then
    raise exception
      'Le profil ciblé ne correspond plus à Giorgos.';
  end if;

  if lower(btrim(v_current_username)) not in (
    'zocoto',
    'giorgos testingopoulos',
    'giorgos'
  ) then
    raise exception
      'L''identifiant actuel du profil Giorgos est inattendu : @%.',
      v_current_username;
  end if;

  if exists (
    select 1
    from public.sporting_directors as director
    where lower(btrim(director.username)) = 'giorgos'
      and director.id <> v_target_id
  ) then
    raise exception
      'L''identifiant public @Giorgos est déjà utilisé par un autre profil.';
  end if;

  if lower(btrim(v_current_username)) <> 'giorgos' then
    update public.sporting_directors
    set username = 'Giorgos'
    where id = v_target_id;
  end if;
end;
$$;

comment on function private.sync_sporting_director_chat_username() is
  'Synchronise l’identifiant @ du chat lorsqu’un joueur modifie uniquement son nom de Directeur Sportif.';

comment on function private.refresh_sporting_director_chat_mentions() is
  'Met à jour le texte des mentions structurées du chat après un changement d’identifiant public.';

notify pgrst, 'reload schema';

commit;
