begin;

-- Les portraits historiques restent valides. Les nouveaux portraits utilisent
-- une clé versionnée contenant les quinze choix de l'éditeur, sans URL ni
-- donnée binaire. Le format reste ainsi portable dans toutes les vues publiques.
do $$
declare
  avatar_constraint record;
begin
  for avatar_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.sporting_directors'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%avatar_key%'
  loop
    execute format(
      'alter table public.sporting_directors drop constraint %I',
      avatar_constraint.conname
    );
  end loop;
end;
$$;

alter table public.sporting_directors
add constraint sporting_directors_avatar_key_check
check (
  avatar_key is null
  or avatar_key in (
    'director_m_01',
    'director_m_02',
    'director_m_03',
    'director_m_04',
    'director_m_05',
    'director_m_06',
    'director_f_01',
    'director_f_02',
    'director_f_03',
    'director_f_04',
    'director_f_05',
    'director_f_06'
  )
  or (
    char_length(avatar_key) <= 512
    and avatar_key ~ '^director_custom_v1:[a-z0-9-]+(\.[a-z0-9-]+){14}$'
  )
);

comment on column public.sporting_directors.avatar_key is
  'Clé du portrait prédéfini ou configuration versionnée de l’éditeur d’avatar du Directeur Sportif.';

notify pgrst, 'reload schema';

commit;
