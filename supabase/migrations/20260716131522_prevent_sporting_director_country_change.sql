begin;

-- ============================================================
-- NATIONALITÉ DÉFINITIVE DU DIRECTEUR SPORTIF
-- La nationalité peut être renseignée lorsque country_id est NULL,
-- mais elle ne peut plus être remplacée après sa validation.
-- ============================================================

create or replace function private.prevent_sporting_director_country_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if
    old.country_id is not null
    and new.country_id is distinct from old.country_id
  then
    raise exception using
      errcode = '23514',
      message = 'La nationalité du Directeur Sportif ne peut plus être modifiée après sa validation.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_sporting_director_country_change
  on public.sporting_directors;

create trigger prevent_sporting_director_country_change
before update of country_id
on public.sporting_directors
for each row
execute function private.prevent_sporting_director_country_change();

comment on function private.prevent_sporting_director_country_change() is
  'Empêche le remplacement de la nationalité d’un Directeur Sportif après sa première validation.';

commit;