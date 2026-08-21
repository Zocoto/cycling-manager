begin;

-- Les cinq pays nordiques ne partagent plus une bibliothèque de noms unique.
-- Le profil "nordic" reste disponible pour tracer les générations historiques,
-- mais toutes les nouvelles identités utilisent désormais un catalogue national.
insert into public.rider_name_profiles (code, label)
values
  ('denmark', 'Danemark'),
  ('finland', 'Finlande'),
  ('iceland', 'Islande'),
  ('norway', 'Norvège'),
  ('sweden', 'Suède')
on conflict (code)
do update set label = excluded.label;

update public.rider_name_profiles
set label = 'Europe nordique (profil historique)'
where code = 'nordic';

with refined_mapping (iso_alpha2, name_profile_code) as (
  values
    ('DK', 'denmark'),
    ('FI', 'finland'),
    ('IS', 'iceland'),
    ('NO', 'norway'),
    ('SE', 'sweden')
)
update public.country_rider_generation_profiles as generation_profile
set name_profile_code = refined_mapping.name_profile_code
from public.countries as country
join refined_mapping
  on refined_mapping.iso_alpha2 = upper(country.iso_alpha2)
where generation_profile.country_id = country.id;

do $$
declare
  invalid_mapping text;
begin
  with expected_mapping (iso_alpha2, name_profile_code) as (
    values
      ('DK', 'denmark'),
      ('FI', 'finland'),
      ('IS', 'iceland'),
      ('NO', 'norway'),
      ('SE', 'sweden')
  )
  select string_agg(
    expected_mapping.iso_alpha2 || '→' || expected_mapping.name_profile_code,
    ', '
    order by expected_mapping.iso_alpha2
  )
  into invalid_mapping
  from expected_mapping
  join public.countries as country
    on upper(country.iso_alpha2) = expected_mapping.iso_alpha2
  left join public.country_rider_generation_profiles as generation_profile
    on generation_profile.country_id = country.id
  where generation_profile.name_profile_code is distinct from
    expected_mapping.name_profile_code;

  if invalid_mapping is not null then
    raise exception 'Profils de noms nordiques mal raccordés : %', invalid_mapping;
  end if;
end;
$$;

comment on table public.rider_name_profiles is
  'Catalogue des 44 bibliothèques JSON utilisées côté serveur pour générer les identités des coureurs.';

commit;
