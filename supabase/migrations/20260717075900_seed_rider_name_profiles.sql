begin;

-- ============================================================
-- NETTOYAGE DE L'ANCIENNE ARCHITECTURE
--
-- Les milliers de prénoms et noms sont désormais conservés dans
-- les fichiers JSON du serveur. Cette table n'est plus utile.
-- ============================================================

drop table if exists public.rider_name_parts;


-- ============================================================
-- PROFILS DE GÉNÉRATION
--
-- Seuls les codes et libellés des 37 bibliothèques sont stockés
-- dans Supabase. Les listes complètes restent dans :
--
-- data/rider-names/*.json
-- ============================================================

insert into public.rider_name_profiles (
  code,
  label
)
values
  ('france', 'France'),
  ('belgium', 'Belgique'),
  ('netherlands', 'Pays-Bas'),
  ('italy', 'Italie'),
  ('spain', 'Espagne'),
  ('portugal', 'Portugal'),
  ('germany', 'Allemagne et espace germanophone'),
  ('british_isles', 'Îles britanniques'),
  ('nordic', 'Europe nordique'),
  ('central_europe', 'Europe centrale'),
  ('balkans', 'Balkans'),
  ('eastern_europe', 'Europe orientale'),
  ('greece', 'Grèce et Chypre'),
  ('caucasus', 'Caucase'),
  ('turkey', 'Turquie'),
  ('north_america', 'Amérique du Nord anglophone'),
  ('mexico_central_america', 'Mexique et Amérique centrale'),
  ('andean', 'Région andine'),
  ('southern_cone', 'Cône Sud de l’Amérique'),
  ('brazil', 'Brésil'),
  ('caribbean', 'Caraïbes'),
  ('japan', 'Japon'),
  ('korea', 'Corée'),
  ('china', 'Chine'),
  ('southeast_asia', 'Asie du Sud-Est'),
  ('south_asia', 'Asie du Sud'),
  ('central_asia', 'Asie centrale'),
  ('north_africa', 'Afrique du Nord'),
  ('middle_east_arabic', 'Moyen-Orient arabe'),
  ('israel', 'Israël'),
  ('iran', 'Iran'),
  ('west_africa_francophone', 'Afrique de l’Ouest francophone'),
  ('west_africa_anglophone', 'Afrique de l’Ouest anglophone'),
  ('central_africa', 'Afrique centrale'),
  ('east_africa', 'Afrique de l’Est'),
  ('southern_africa', 'Afrique australe'),
  ('oceania', 'Océanie')
on conflict (code)
do update set
  label = excluded.label;


-- ============================================================
-- ASSOCIATION DES PAYS AUX PROFILS
--
-- name_profile_code :
--   fichier JSON utilisé pour générer le prénom et le nom.
--
-- avatar_profile_key :
--   futur profil régional utilisé par le générateur de visages.
--
-- Ces deux valeurs sont volontairement indépendantes. Un pays
-- africain lusophone peut par exemple utiliser la bibliothèque
-- portugaise pour les noms et un profil visuel africain.
-- ============================================================

with country_mapping (
  iso_alpha2,
  name_profile_code,
  avatar_profile_key
) as (
  values

    -- ========================================================
    -- EUROPE OCCIDENTALE ET MÉRIDIONALE
    -- ========================================================

    ('FR', 'france', 'europe_west'),
    ('MC', 'france', 'europe_west'),

    ('BE', 'belgium', 'europe_west'),
    ('LU', 'belgium', 'europe_west'),

    ('NL', 'netherlands', 'europe_west'),

    ('IT', 'italy', 'europe_south'),
    ('SM', 'italy', 'europe_south'),
    ('VA', 'italy', 'europe_south'),

    ('ES', 'spain', 'europe_south'),
    ('AD', 'spain', 'europe_south'),

    ('PT', 'portugal', 'europe_south'),

    ('DE', 'germany', 'europe_central'),
    ('AT', 'germany', 'europe_central'),
    ('CH', 'germany', 'europe_central'),
    ('LI', 'germany', 'europe_central'),

    ('GB', 'british_isles', 'europe_west'),
    ('IE', 'british_isles', 'europe_west'),

    ('DK', 'nordic', 'europe_north'),
    ('FI', 'nordic', 'europe_north'),
    ('IS', 'nordic', 'europe_north'),
    ('NO', 'nordic', 'europe_north'),
    ('SE', 'nordic', 'europe_north'),

    -- ========================================================
    -- EUROPE CENTRALE, ORIENTALE ET BALKANS
    -- ========================================================

    ('CZ', 'central_europe', 'europe_central'),
    ('HU', 'central_europe', 'europe_central'),
    ('PL', 'central_europe', 'europe_central'),
    ('SK', 'central_europe', 'europe_central'),

    ('AL', 'balkans', 'europe_southeast'),
    ('BA', 'balkans', 'europe_southeast'),
    ('BG', 'balkans', 'europe_southeast'),
    ('HR', 'balkans', 'europe_southeast'),
    ('ME', 'balkans', 'europe_southeast'),
    ('MK', 'balkans', 'europe_southeast'),
    ('RO', 'balkans', 'europe_southeast'),
    ('RS', 'balkans', 'europe_southeast'),
    ('SI', 'balkans', 'europe_southeast'),
    ('XK', 'balkans', 'europe_southeast'),

    ('BY', 'eastern_europe', 'europe_east'),
    ('EE', 'eastern_europe', 'europe_east'),
    ('LT', 'eastern_europe', 'europe_east'),
    ('LV', 'eastern_europe', 'europe_east'),
    ('MD', 'eastern_europe', 'europe_east'),
    ('RU', 'eastern_europe', 'europe_east'),
    ('UA', 'eastern_europe', 'europe_east'),

    ('CY', 'greece', 'europe_southeast'),
    ('GR', 'greece', 'europe_southeast'),
    ('MT', 'greece', 'europe_southeast'),

    ('AM', 'caucasus', 'caucasus'),
    ('AZ', 'caucasus', 'caucasus'),
    ('GE', 'caucasus', 'caucasus'),

    ('TR', 'turkey', 'anatolia'),

    -- ========================================================
    -- AMÉRIQUE DU NORD
    -- ========================================================

    ('CA', 'north_america', 'north_america'),
    ('US', 'north_america', 'north_america'),

    -- ========================================================
    -- MEXIQUE ET AMÉRIQUE CENTRALE
    -- ========================================================

    ('BZ', 'mexico_central_america', 'latin_america'),
    ('CR', 'mexico_central_america', 'latin_america'),
    ('GT', 'mexico_central_america', 'latin_america'),
    ('HN', 'mexico_central_america', 'latin_america'),
    ('MX', 'mexico_central_america', 'latin_america'),
    ('NI', 'mexico_central_america', 'latin_america'),
    ('PA', 'mexico_central_america', 'latin_america'),
    ('SV', 'mexico_central_america', 'latin_america'),

    -- ========================================================
    -- AMÉRIQUE DU SUD
    -- ========================================================

    ('BO', 'andean', 'latin_america'),
    ('CO', 'andean', 'latin_america'),
    ('EC', 'andean', 'latin_america'),
    ('PE', 'andean', 'latin_america'),
    ('VE', 'andean', 'latin_america'),

    ('AR', 'southern_cone', 'latin_america'),
    ('CL', 'southern_cone', 'latin_america'),
    ('PY', 'southern_cone', 'latin_america'),
    ('UY', 'southern_cone', 'latin_america'),

    ('BR', 'brazil', 'latin_america'),

    -- ========================================================
    -- CARAÏBES
    -- ========================================================

    ('AG', 'caribbean', 'caribbean'),
    ('BB', 'caribbean', 'caribbean'),
    ('BS', 'caribbean', 'caribbean'),
    ('CU', 'caribbean', 'caribbean'),
    ('DM', 'caribbean', 'caribbean'),
    ('DO', 'caribbean', 'caribbean'),
    ('GD', 'caribbean', 'caribbean'),
    ('GY', 'caribbean', 'caribbean'),
    ('HT', 'caribbean', 'caribbean'),
    ('JM', 'caribbean', 'caribbean'),
    ('KN', 'caribbean', 'caribbean'),
    ('LC', 'caribbean', 'caribbean'),
    ('SR', 'caribbean', 'caribbean'),
    ('TT', 'caribbean', 'caribbean'),
    ('VC', 'caribbean', 'caribbean'),

    -- ========================================================
    -- ASIE DE L'EST
    -- ========================================================

    ('JP', 'japan', 'east_asia'),

    ('KP', 'korea', 'east_asia'),
    ('KR', 'korea', 'east_asia'),

    ('CN', 'china', 'east_asia'),
    ('TW', 'china', 'east_asia'),

    ('MN', 'central_asia', 'central_asia'),

    -- ========================================================
    -- ASIE DU SUD-EST
    -- ========================================================

    ('BN', 'southeast_asia', 'southeast_asia'),
    ('ID', 'southeast_asia', 'southeast_asia'),
    ('KH', 'southeast_asia', 'southeast_asia'),
    ('LA', 'southeast_asia', 'southeast_asia'),
    ('MM', 'southeast_asia', 'southeast_asia'),
    ('MY', 'southeast_asia', 'southeast_asia'),
    ('PH', 'southeast_asia', 'southeast_asia'),
    ('SG', 'southeast_asia', 'southeast_asia'),
    ('TH', 'southeast_asia', 'southeast_asia'),
    ('TL', 'southeast_asia', 'southeast_asia'),
    ('VN', 'southeast_asia', 'southeast_asia'),

    -- ========================================================
    -- ASIE DU SUD
    -- ========================================================

    ('BD', 'south_asia', 'south_asia'),
    ('BT', 'south_asia', 'south_asia'),
    ('IN', 'south_asia', 'south_asia'),
    ('LK', 'south_asia', 'south_asia'),
    ('MV', 'south_asia', 'south_asia'),
    ('NP', 'south_asia', 'south_asia'),
    ('PK', 'south_asia', 'south_asia'),

    -- ========================================================
    -- ASIE CENTRALE
    -- ========================================================

    ('AF', 'central_asia', 'central_asia'),
    ('KG', 'central_asia', 'central_asia'),
    ('KZ', 'central_asia', 'central_asia'),
    ('TJ', 'central_asia', 'central_asia'),
    ('TM', 'central_asia', 'central_asia'),
    ('UZ', 'central_asia', 'central_asia'),

    -- ========================================================
    -- AFRIQUE DU NORD
    -- ========================================================

    ('DZ', 'north_africa', 'north_africa'),
    ('EG', 'north_africa', 'north_africa'),
    ('EH', 'north_africa', 'north_africa'),
    ('LY', 'north_africa', 'north_africa'),
    ('MA', 'north_africa', 'north_africa'),
    ('TN', 'north_africa', 'north_africa'),

    -- ========================================================
    -- MOYEN-ORIENT ARABE
    -- ========================================================

    ('AE', 'middle_east_arabic', 'middle_east'),
    ('BH', 'middle_east_arabic', 'middle_east'),
    ('IQ', 'middle_east_arabic', 'middle_east'),
    ('JO', 'middle_east_arabic', 'middle_east'),
    ('KW', 'middle_east_arabic', 'middle_east'),
    ('LB', 'middle_east_arabic', 'middle_east'),
    ('OM', 'middle_east_arabic', 'middle_east'),
    ('PS', 'middle_east_arabic', 'middle_east'),
    ('QA', 'middle_east_arabic', 'middle_east'),
    ('SA', 'middle_east_arabic', 'middle_east'),
    ('SY', 'middle_east_arabic', 'middle_east'),
    ('YE', 'middle_east_arabic', 'middle_east'),

    ('IL', 'israel', 'middle_east'),

    ('IR', 'iran', 'middle_east'),

    -- ========================================================
    -- AFRIQUE DE L'OUEST FRANCOPHONE
    -- ========================================================

    ('BJ', 'west_africa_francophone', 'west_africa'),
    ('BF', 'west_africa_francophone', 'west_africa'),
    ('CI', 'west_africa_francophone', 'west_africa'),
    ('GN', 'west_africa_francophone', 'west_africa'),
    ('ML', 'west_africa_francophone', 'west_africa'),
    ('MR', 'west_africa_francophone', 'west_africa'),
    ('NE', 'west_africa_francophone', 'west_africa'),
    ('SN', 'west_africa_francophone', 'west_africa'),
    ('TG', 'west_africa_francophone', 'west_africa'),

    -- Pays lusophones d'Afrique de l'Ouest
    ('CV', 'portugal', 'west_africa'),
    ('GW', 'portugal', 'west_africa'),

    -- ========================================================
    -- AFRIQUE DE L'OUEST ANGLOPHONE
    -- ========================================================

    ('GH', 'west_africa_anglophone', 'west_africa'),
    ('GM', 'west_africa_anglophone', 'west_africa'),
    ('LR', 'west_africa_anglophone', 'west_africa'),
    ('NG', 'west_africa_anglophone', 'west_africa'),
    ('SL', 'west_africa_anglophone', 'west_africa'),

    -- ========================================================
    -- AFRIQUE CENTRALE
    -- ========================================================

    ('CD', 'central_africa', 'central_africa'),
    ('CF', 'central_africa', 'central_africa'),
    ('CG', 'central_africa', 'central_africa'),
    ('CM', 'central_africa', 'central_africa'),
    ('GA', 'central_africa', 'central_africa'),
    ('TD', 'central_africa', 'central_africa'),

    -- Guinée équatoriale : noms hispanophones
    ('GQ', 'spain', 'central_africa'),

    -- Sao Tomé-et-Principe : noms lusophones
    ('ST', 'portugal', 'central_africa'),

    -- ========================================================
    -- AFRIQUE DE L'EST
    -- ========================================================

    ('BI', 'east_africa', 'east_africa'),
    ('DJ', 'east_africa', 'east_africa'),
    ('ER', 'east_africa', 'east_africa'),
    ('ET', 'east_africa', 'east_africa'),
    ('KE', 'east_africa', 'east_africa'),
    ('RW', 'east_africa', 'east_africa'),
    ('SD', 'east_africa', 'east_africa'),
    ('SO', 'east_africa', 'east_africa'),
    ('SS', 'east_africa', 'east_africa'),
    ('TZ', 'east_africa', 'east_africa'),
    ('UG', 'east_africa', 'east_africa'),

    -- Comores : noms majoritairement arabes
    ('KM', 'middle_east_arabic', 'east_africa'),

    -- Seychelles : noms créoles et francophones
    ('SC', 'france', 'east_africa'),

    -- ========================================================
    -- AFRIQUE AUSTRALE
    -- ========================================================

    ('AO', 'southern_africa', 'southern_africa'),
    ('BW', 'southern_africa', 'southern_africa'),
    ('LS', 'southern_africa', 'southern_africa'),
    ('MG', 'southern_africa', 'southern_africa'),
    ('MU', 'southern_africa', 'southern_africa'),
    ('MW', 'southern_africa', 'southern_africa'),
    ('MZ', 'southern_africa', 'southern_africa'),
    ('NA', 'southern_africa', 'southern_africa'),
    ('SZ', 'southern_africa', 'southern_africa'),
    ('ZA', 'southern_africa', 'southern_africa'),
    ('ZM', 'southern_africa', 'southern_africa'),
    ('ZW', 'southern_africa', 'southern_africa'),

    -- ========================================================
    -- OCÉANIE
    -- ========================================================

    ('AU', 'oceania', 'oceania'),
    ('FJ', 'oceania', 'oceania'),
    ('FM', 'oceania', 'oceania'),
    ('KI', 'oceania', 'oceania'),
    ('MH', 'oceania', 'oceania'),
    ('NR', 'oceania', 'oceania'),
    ('NZ', 'oceania', 'oceania'),
    ('PG', 'oceania', 'oceania'),
    ('PW', 'oceania', 'oceania'),
    ('SB', 'oceania', 'oceania'),
    ('TO', 'oceania', 'oceania'),
    ('TV', 'oceania', 'oceania'),
    ('VU', 'oceania', 'oceania'),
    ('WS', 'oceania', 'oceania')
)
insert into public.country_rider_generation_profiles (
  country_id,
  name_profile_code,
  avatar_profile_key
)
select
  country.id,
  country_mapping.name_profile_code,
  country_mapping.avatar_profile_key
from public.countries as country
inner join country_mapping
  on country_mapping.iso_alpha2 = upper(country.iso_alpha2)
where country.is_active = true
on conflict (country_id)
do update set
  name_profile_code = excluded.name_profile_code,
  avatar_profile_key = excluded.avatar_profile_key;


-- ============================================================
-- NETTOYAGE DES ASSOCIATIONS INACTIVES
-- ============================================================

delete from public.country_rider_generation_profiles as profile
using public.countries as country
where country.id = profile.country_id
  and country.is_active = false;


-- ============================================================
-- CONTRÔLE DE COUVERTURE
--
-- La migration est annulée si un pays actif ne possède pas de
-- profil de noms et de futur profil visuel.
-- ============================================================

do $$
declare
  missing_country_codes text;
begin
  select string_agg(
    upper(country.iso_alpha2),
    ', '
    order by upper(country.iso_alpha2)
  )
  into missing_country_codes
  from public.countries as country
  left join public.country_rider_generation_profiles as profile
    on profile.country_id = country.id
  where country.is_active = true
    and profile.country_id is null;

  if missing_country_codes is not null then
    raise exception
      'Pays actifs sans profil de génération : %',
      missing_country_codes;
  end if;
end;
$$;


-- ============================================================
-- DOCUMENTATION
-- ============================================================

comment on table public.rider_name_profiles is
  'Catalogue léger des bibliothèques JSON utilisées côté serveur pour générer les identités des coureurs.';

comment on table public.country_rider_generation_profiles is
  'Association de chaque nationalité active à une bibliothèque de noms et à un futur profil visuel régional.';

comment on column public.country_rider_generation_profiles.name_profile_code is
  'Code du fichier data/rider-names correspondant à la nationalité.';

comment on column public.country_rider_generation_profiles.avatar_profile_key is
  'Profil géographique destiné au futur moteur de génération des avatars de coureurs.';

comment on column public.riders.generated_name_profile_code is
  'Bibliothèque JSON ayant servi à générer le nom du coureur.';

comment on column public.riders.avatar_profile_key is
  'Profil visuel régional préparé pour le futur générateur d’avatars.';

comment on column public.riders.avatar_seed is
  'Graine stable permettant de reproduire ultérieurement le visage généré du coureur.';

commit;