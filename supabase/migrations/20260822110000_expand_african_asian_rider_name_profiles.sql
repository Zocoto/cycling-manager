begin;

-- Les bibliothèques restent stockées dans data/rider-names/*.json. Cette
-- migration ne renomme aucun coureur existant : elle ne change que le profil
-- utilisé lors des prochaines générations.
insert into public.rider_name_profiles (code, label)
values
  ('taiwan', 'Taïwan'),
  ('vietnam', 'Vietnam'),
  ('thailand', 'Thaïlande'),
  ('indonesia', 'Indonésie'),
  ('philippines', 'Philippines'),
  ('malaysia', 'Malaisie'),
  ('cambodia', 'Cambodge'),
  ('myanmar', 'Myanmar'),
  ('laos', 'Laos'),
  ('india', 'Inde'),
  ('pakistan', 'Pakistan'),
  ('bangladesh', 'Bangladesh'),
  ('nepal', 'Népal'),
  ('sri_lanka', 'Sri Lanka'),
  ('mongolia', 'Mongolie'),
  ('ivory_coast', 'Côte d’Ivoire'),
  ('senegal', 'Sénégal'),
  ('ghana', 'Ghana'),
  ('nigeria', 'Nigeria'),
  ('cameroon', 'Cameroun'),
  ('ethiopia', 'Éthiopie'),
  ('eritrea', 'Érythrée'),
  ('kenya', 'Kenya'),
  ('somalia', 'Somalie'),
  ('madagascar', 'Madagascar'),
  ('south_africa', 'Afrique du Sud')
on conflict (code)
do update set label = excluded.label;

with national_mapping (
  iso_alpha2,
  name_profile_code,
  avatar_profile_key
) as (
  values
    ('TW', 'taiwan', 'east_asia'),
    ('VN', 'vietnam', 'southeast_asia'),
    ('TH', 'thailand', 'southeast_asia'),
    ('ID', 'indonesia', 'southeast_asia'),
    ('PH', 'philippines', 'southeast_asia'),
    ('MY', 'malaysia', 'southeast_asia'),
    ('KH', 'cambodia', 'southeast_asia'),
    ('MM', 'myanmar', 'southeast_asia'),
    ('LA', 'laos', 'southeast_asia'),
    ('IN', 'india', 'south_asia'),
    ('PK', 'pakistan', 'south_asia'),
    ('BD', 'bangladesh', 'south_asia'),
    ('NP', 'nepal', 'south_asia'),
    ('LK', 'sri_lanka', 'south_asia'),
    ('MN', 'mongolia', 'central_asia'),
    ('CI', 'ivory_coast', 'west_africa'),
    ('SN', 'senegal', 'west_africa'),
    ('GH', 'ghana', 'west_africa'),
    ('NG', 'nigeria', 'west_africa'),
    ('CM', 'cameroon', 'central_africa'),
    ('ET', 'ethiopia', 'east_africa'),
    ('ER', 'eritrea', 'east_africa'),
    ('KE', 'kenya', 'east_africa'),
    ('SO', 'somalia', 'east_africa'),
    ('MG', 'madagascar', 'southern_africa'),
    ('ZA', 'south_africa', 'southern_africa')
)
insert into public.country_rider_generation_profiles (
  country_id,
  name_profile_code,
  avatar_profile_key
)
select
  country.id,
  national_mapping.name_profile_code,
  national_mapping.avatar_profile_key
from public.countries as country
inner join national_mapping
  on national_mapping.iso_alpha2 = upper(country.iso_alpha2)
on conflict (country_id)
do update set
  name_profile_code = excluded.name_profile_code,
  avatar_profile_key = excluded.avatar_profile_key;

do $$
declare
  invalid_mappings text;
begin
  with expected_mapping (iso_alpha2, name_profile_code) as (
    values
      ('TW', 'taiwan'),
      ('VN', 'vietnam'),
      ('TH', 'thailand'),
      ('ID', 'indonesia'),
      ('PH', 'philippines'),
      ('MY', 'malaysia'),
      ('KH', 'cambodia'),
      ('MM', 'myanmar'),
      ('LA', 'laos'),
      ('IN', 'india'),
      ('PK', 'pakistan'),
      ('BD', 'bangladesh'),
      ('NP', 'nepal'),
      ('LK', 'sri_lanka'),
      ('MN', 'mongolia'),
      ('CI', 'ivory_coast'),
      ('SN', 'senegal'),
      ('GH', 'ghana'),
      ('NG', 'nigeria'),
      ('CM', 'cameroon'),
      ('ET', 'ethiopia'),
      ('ER', 'eritrea'),
      ('KE', 'kenya'),
      ('SO', 'somalia'),
      ('MG', 'madagascar'),
      ('ZA', 'south_africa')
  )
  select string_agg(
    expected_mapping.iso_alpha2 || '→' || expected_mapping.name_profile_code,
    ', '
    order by expected_mapping.iso_alpha2
  )
  into invalid_mappings
  from expected_mapping
  left join public.countries as country
    on upper(country.iso_alpha2) = expected_mapping.iso_alpha2
  left join public.country_rider_generation_profiles as generation_profile
    on generation_profile.country_id = country.id
  where country.id is null
    or generation_profile.name_profile_code is distinct from expected_mapping.name_profile_code;

  if invalid_mappings is not null then
    raise exception
      'Profils nationaux africains/asiatiques non raccordés : %',
      invalid_mappings;
  end if;
end;
$$;

commit;
