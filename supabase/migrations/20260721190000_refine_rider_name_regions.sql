begin;

-- Deux bibliothèques auparavant trop larges sont séparées :
-- l'Afghanistan ne dépend plus des listes turciques d'Asie centrale,
-- et les pays de la péninsule Arabique ne dépendent plus du Levant/Irak.
insert into public.rider_name_profiles (code, label)
values
  ('afghanistan', 'Afghanistan (dari et pachto)'),
  ('arabian_peninsula', 'Péninsule Arabique'),
  ('middle_east_arabic', 'Levant et Mésopotamie arabes')
on conflict (code)
do update set label = excluded.label;

with refined_mapping (iso_alpha2, name_profile_code) as (
  values
    ('AF', 'afghanistan'),
    ('AE', 'arabian_peninsula'),
    ('BH', 'arabian_peninsula'),
    ('KW', 'arabian_peninsula'),
    ('OM', 'arabian_peninsula'),
    ('QA', 'arabian_peninsula'),
    ('SA', 'arabian_peninsula'),
    ('YE', 'arabian_peninsula'),
    ('IQ', 'middle_east_arabic'),
    ('JO', 'middle_east_arabic'),
    ('LB', 'middle_east_arabic'),
    ('PS', 'middle_east_arabic'),
    ('SY', 'middle_east_arabic'),
    ('KM', 'east_africa')
)
update public.country_rider_generation_profiles as generation_profile
set name_profile_code = refined_mapping.name_profile_code
from public.countries as country
join refined_mapping
  on refined_mapping.iso_alpha2 = upper(country.iso_alpha2)
where generation_profile.country_id = country.id
  and country.is_active = true;

-- Rattrapage des coureurs afghans déjà générés avec l'ancienne liste
-- centrasiatique. Les identifiants, contrats et historiques restent inchangés.
with legacy_afghan_riders as (
  select
    rider.id,
    row_number() over (order by rider.created_at, rider.id) as ordinal
  from public.riders as rider
  join public.countries as country on country.id = rider.country_id
  where upper(country.iso_alpha2) = 'AF'
    and rider.generated_name_profile_code = 'central_asia'
), replacement_names (ordinal, first_name, last_name) as (
  values
    (1, 'Mirwais', 'Safi'),
    (2, 'Hamidullah', 'Wardak'),
    (3, 'Omid', 'Panjshiri'),
    (4, 'Emal', 'Stanikzai'),
    (5, 'Farhad', 'Husseini'),
    (6, 'Wais', 'Ahmadzai'),
    (7, 'Zalmay', 'Noorzai'),
    (8, 'Lutfullah', 'Karimi'),
    (9, 'Ajmal', 'Shinwari'),
    (10, 'Rahmatullah', 'Mohmand'),
    (11, 'Behzad', 'Herawi'),
    (12, 'Nematullah', 'Niazi'),
    (13, 'Matiullah', 'Zadran'),
    (14, 'Jawad', 'Kazemi'),
    (15, 'Khyber', 'Popalzai'),
    (16, 'Javid', 'Badakhshi'),
    (17, 'Waliullah', 'Kohistani'),
    (18, 'Hekmatullah', 'Mangal'),
    (19, 'Ramin', 'Kabuli'),
    (20, 'Samiullah', 'Khogyani')
)
update public.riders as rider
set
  first_name = replacement_names.first_name,
  last_name = replacement_names.last_name,
  generated_name_profile_code = 'afghanistan'
from legacy_afghan_riders
join replacement_names using (ordinal)
where rider.id = legacy_afghan_riders.id;

update public.riders as rider
set generated_name_profile_code = 'afghanistan'
from public.countries as country
where country.id = rider.country_id
  and upper(country.iso_alpha2) = 'AF'
  and rider.generated_name_profile_code = 'central_asia';

do $$
declare
  invalid_mapping text;
  legacy_afghan_rider_count integer;
begin
  with expected_mapping (iso_alpha2, name_profile_code) as (
    values
      ('AF', 'afghanistan'),
      ('AE', 'arabian_peninsula'),
      ('BH', 'arabian_peninsula'),
      ('KW', 'arabian_peninsula'),
      ('OM', 'arabian_peninsula'),
      ('QA', 'arabian_peninsula'),
      ('SA', 'arabian_peninsula'),
      ('YE', 'arabian_peninsula'),
      ('IQ', 'middle_east_arabic'),
      ('JO', 'middle_east_arabic'),
      ('LB', 'middle_east_arabic'),
      ('PS', 'middle_east_arabic'),
      ('SY', 'middle_east_arabic'),
      ('KM', 'east_africa')
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
   and country.is_active = true
  left join public.country_rider_generation_profiles as generation_profile
    on generation_profile.country_id = country.id
  where generation_profile.name_profile_code is distinct from
    expected_mapping.name_profile_code;

  if invalid_mapping is not null then
    raise exception 'Profils de noms régionaux mal raccordés : %', invalid_mapping;
  end if;

  select count(*)::integer
  into legacy_afghan_rider_count
  from public.riders as rider
  join public.countries as country on country.id = rider.country_id
  where upper(country.iso_alpha2) = 'AF'
    and rider.generated_name_profile_code = 'central_asia';

  if legacy_afghan_rider_count > 0 then
    raise exception '% coureur(s) afghan(s) utilisent encore le profil central_asia.',
      legacy_afghan_rider_count;
  end if;
end;
$$;

comment on table public.rider_name_profiles is
  'Catalogue des 39 bibliothèques JSON utilisées côté serveur pour générer les identités des coureurs.';

commit;
