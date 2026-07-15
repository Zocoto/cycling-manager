begin;

-- ============================================================
-- VALIDATION DU NOM DU DIRECTEUR SPORTIF
-- Le username constitue l'identifiant public unique.
-- Le display_name constitue le nom affiché dans l'interface.
-- Les deux valeurs sont identiques lors de l'inscription.
-- ============================================================

alter table public.sporting_directors
  add constraint sporting_directors_username_length_valid
    check (
      char_length(username) between 3 and 30
    ),

  add constraint sporting_directors_display_name_length_valid
    check (
      char_length(display_name) between 3 and 30
    ),

  add constraint sporting_directors_username_normalized
    check (
      username = regexp_replace(
        btrim(username),
        '[[:space:]]+',
        ' ',
        'g'
      )
    ),

  add constraint sporting_directors_display_name_normalized
    check (
      display_name = regexp_replace(
        btrim(display_name),
        '[[:space:]]+',
        ' ',
        'g'
      )
    );


-- ============================================================
-- SCHÉMA TECHNIQUE PRIVÉ
-- Les fonctions sensibles ne sont pas exposées par la Data API.
-- ============================================================

create schema if not exists private;

revoke all
  on schema private
  from public, anon, authenticated;


-- ============================================================
-- CRÉATION AUTOMATIQUE DU PROFIL MÉTIER
-- Après la création d'un compte Supabase Auth, le trigger crée
-- le directeur sportif correspondant.
--
-- La Server Action devra transmettre le nom dans :
-- raw_user_meta_data.manager_name
-- ============================================================

create or replace function private.create_sporting_director_after_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_manager_name text;
begin
  normalized_manager_name := regexp_replace(
    btrim(
      coalesce(
        new.raw_user_meta_data ->> 'manager_name',
        ''
      )
    ),
    '[[:space:]]+',
    ' ',
    'g'
  );

  if char_length(normalized_manager_name) < 3
    or char_length(normalized_manager_name) > 30
  then
    raise exception using
      errcode = '22023',
      message = 'Le nom du directeur sportif doit contenir entre 3 et 30 caractères.';
  end if;

  insert into public.sporting_directors (
    auth_user_id,
    username,
    display_name
  )
  values (
    new.id,
    normalized_manager_name,
    normalized_manager_name
  );

  return new;
end;
$$;

revoke all
  on function private.create_sporting_director_after_signup()
  from public, anon, authenticated;


-- ============================================================
-- TRIGGER SUPABASE AUTH
-- L'unicité existante sur lower(username) protège également
-- contre deux noms identiques avec des majuscules différentes.
-- ============================================================

drop trigger if exists
  create_sporting_director_after_auth_signup
  on auth.users;

create trigger create_sporting_director_after_auth_signup
  after insert
  on auth.users
  for each row
  execute function private.create_sporting_director_after_signup();


-- ============================================================
-- ACCÈS À LA DATA API
-- Aucun utilisateur anonyme ne peut lire les profils.
-- Un utilisateur connecté peut uniquement lire son profil.
-- L'insertion, la modification et la suppression directes
-- restent interdites dans cette US.
-- ============================================================

alter table public.sporting_directors
  enable row level security;

revoke all
  on table public.sporting_directors
  from anon, authenticated;

grant select
  on table public.sporting_directors
  to authenticated;

drop policy if exists
  sporting_directors_select_own
  on public.sporting_directors;

create policy sporting_directors_select_own
  on public.sporting_directors
  for select
  to authenticated
  using (
    (select auth.uid()) = auth_user_id
  );


-- ============================================================
-- DOCUMENTATION POSTGRES
-- ============================================================

comment on function private.create_sporting_director_after_signup() is
  'Crée automatiquement le profil métier du directeur sportif après une inscription Supabase Auth.';

commit;