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
);