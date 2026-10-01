begin;

create temporary table romanized_game_names (
  old_name text primary key,
  new_name text not null
) on commit drop;

insert into romanized_game_names (old_name, new_name)
values
  ('د کابل دور', 'Kabul Tour'),
  ('د بامیان چلنج', 'Bamiyan Challenge'),
  ('د هریرود کپ', 'Hari Rud Cup'),
  ('د پنجشیر کلاسیک', 'Panjshir Classic'),
  ('د افغانستان کوچنی تور', 'Afghanistan Regional Tour'),
  ('Երևանի շրջան', 'Yerevan Circuit'),
  ('Սևանի գավաթ', 'Sevan Cup'),
  ('Արարատի դասական', 'Ararat Classic'),
  ('Դիլիջանի ուղի', 'Dilijan Route'),
  ('Հայաստանի փոքր տուր', 'Armenia Regional Tour'),
  ('የአዲስ አበባ ዙር', 'Addis Ababa Circuit'),
  ('የአዋሳ ዋንጫ', 'Hawassa Cup'),
  ('የባሕር ዳር ክላሲክ', 'Bahir Dar Classic'),
  ('የሰሜን ተራሮች ፈተና', 'Northern Mountains Challenge'),
  ('የኢትዮጵያ ክልሎች ጉብኝት', 'Ethiopia Regional Tour'),
  ('Γύρος Αθήνας', 'Athens Tour'),
  ('Κύπελλο Πελοποννήσου', 'Peloponnese Cup'),
  ('Κλασική Μακεδονίας', 'Macedonia Classic'),
  ('Πρόκληση Πίνδου', 'Pindus Challenge'),
  ('Μικρός Γύρος Ελλάδας', 'Regional Tour of Greece'),
  ('東京サーキット', 'Tokyo Circuit'),
  ('瀬戸内カップ', 'Setouchi Cup'),
  ('北海道クラシック', 'Hokkaido Classic'),
  ('日本アルプスチャレンジ', 'Japan Alps Challenge'),
  ('地方一周ツアー', 'Japan Regional Tour'),
  ('Бишкек айлампасы', 'Bishkek Circuit'),
  ('Ысык-Көл кубогу', 'Issyk-Kul Cup'),
  ('Чүй классикасы', 'Chuy Classic'),
  ('Ала-Тоо чакырыгы', 'Ala-Too Challenge'),
  ('Кыргызстандын аймактар туру', 'Kyrgyzstan Regional Tour'),
  ('평양 순환경주', 'Pyongyang Circuit'),
  ('동해 컵', 'East Sea Cup'),
  ('함경 클래식', 'Hamgyong Classic'),
  ('백두산 도전', 'Baekdu Mountain Challenge'),
  ('조선 지역 순환경주', 'Korea Regional Tour'),
  ('اسلام آباد سرکٹ', 'Islamabad Circuit'),
  ('سندھ کپ', 'Sindh Cup'),
  ('پنجاب کلاسک', 'Punjab Classic'),
  ('قراقرم چیلنج', 'Karakoram Challenge'),
  ('پاکستان علاقائی ٹور', 'Pakistan Regional Tour'),
  ('تور هندوکش', 'Tour-e Hindukush'),
  ('تور زاگرس', 'Tour-e Zagros'),
  ('Ала-Тоо классикасы', 'Ala-Too Klassikasy'),
  ('백두산 순환경주', 'Baekdusan Circuit'),
  ('كلاسيك الأوراس', 'Klassik El Aures');

-- Les noms d'étapes reprennent souvent le nom de la course suivi de son numéro.
update public.stages as stage
set name = replace(stage.name, mapping.old_name, mapping.new_name)
from romanized_game_names as mapping
where position(mapping.old_name in stage.name) > 0;

update public.race_editions as edition
set display_name = replace(edition.display_name, mapping.old_name, mapping.new_name)
from romanized_game_names as mapping
where position(mapping.old_name in edition.display_name) > 0;

update public.races as race
set name = mapping.new_name
from romanized_game_names as mapping
where race.name = mapping.old_name;

insert into private.local_race_country_catalog (
  country_code,
  classic_names,
  tour_name,
  signature_profile
)
values
  ('AF', array['Kabul Tour','Bamiyan Challenge','Hari Rud Cup','Panjshir Classic'], 'Afghanistan Regional Tour', 'mountain'),
  ('AM', array['Yerevan Circuit','Sevan Cup','Ararat Classic','Dilijan Route'], 'Armenia Regional Tour', 'mountain'),
  ('ET', array['Addis Ababa Circuit','Hawassa Cup','Bahir Dar Classic','Northern Mountains Challenge'], 'Ethiopia Regional Tour', 'mountain'),
  ('GR', array['Athens Tour','Peloponnese Cup','Macedonia Classic','Pindus Challenge'], 'Regional Tour of Greece', 'mountain'),
  ('JP', array['Tokyo Circuit','Setouchi Cup','Hokkaido Classic','Japan Alps Challenge'], 'Japan Regional Tour', 'mountain'),
  ('KG', array['Bishkek Circuit','Issyk-Kul Cup','Chuy Classic','Ala-Too Challenge'], 'Kyrgyzstan Regional Tour', 'mountain'),
  ('KP', array['Pyongyang Circuit','East Sea Cup','Hamgyong Classic','Baekdu Mountain Challenge'], 'Korea Regional Tour', 'mountain'),
  ('PK', array['Islamabad Circuit','Sindh Cup','Punjab Classic','Karakoram Challenge'], 'Pakistan Regional Tour', 'mountain')
on conflict (country_code)
do update set
  classic_names = excluded.classic_names,
  tour_name = excluded.tour_name,
  signature_profile = excluded.signature_profile;

update public.sponsors
set
  name = 'Bishkek Emal',
  short_name = 'Bishkek Emal'
where catalog_key = 'bishkek-emal';

update public.sponsors
set industry = case catalog_key
  when 'stupina-rautului' then 'Miel, propolis et cire naturelle'
  when 'covoare-basarabene' then 'Textiles et tapis contemporains'
  when 'mecanica-balti' then 'Machines et composants agricoles'
  when 'lana-sibiului' then 'Laine et textiles techniques'
  when 'portelan-de-alba' then 'Porcelaine et céramique'
  else industry
end
where catalog_key in (
  'stupina-rautului',
  'covoare-basarabene',
  'mecanica-balti',
  'lana-sibiului',
  'portelan-de-alba'
);

create or replace function public.uses_roman_alphabet_name(p_value text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_value is null then true
    else coalesce(
      bool_and(
        codepoint between 32 and 126
        or codepoint between 160 and 591
        or codepoint between 768 and 879
        or codepoint between 7680 and 7935
        or codepoint between 8192 and 8303
        or codepoint between 8352 and 8399
      ),
      true
    )
  end
  from (
    select ascii(substr(p_value, character_index, 1)) as codepoint
    from generate_series(1, char_length(coalesce(p_value, ''))) as character(character_index)
  ) as characters;
$$;

comment on function public.uses_roman_alphabet_name(text) is
  'Autorise les lettres latines, leurs diacritiques, les nombres, les espaces et la ponctuation dans les noms publics.';

alter table public.teams
  add constraint teams_names_use_roman_alphabet
  check (
    public.uses_roman_alphabet_name(internal_name)
    and public.uses_roman_alphabet_name(amateur_name)
  ) not valid;

alter table public.team_seasons
  add constraint team_seasons_names_use_roman_alphabet
  check (
    public.uses_roman_alphabet_name(display_name)
    and public.uses_roman_alphabet_name(short_name)
  ) not valid;

alter table public.development_teams
  add constraint development_teams_names_use_roman_alphabet
  check (public.uses_roman_alphabet_name(display_name)) not valid;

alter table public.races
  add constraint races_names_use_roman_alphabet
  check (
    public.uses_roman_alphabet_name(name)
    and public.uses_roman_alphabet_name(short_name)
  ) not valid;

alter table public.race_editions
  add constraint race_editions_names_use_roman_alphabet
  check (public.uses_roman_alphabet_name(display_name)) not valid;

alter table public.stages
  add constraint stages_names_use_roman_alphabet
  check (public.uses_roman_alphabet_name(name)) not valid;

alter table public.development_race_editions
  add constraint development_race_editions_names_use_roman_alphabet
  check (
    public.uses_roman_alphabet_name(name)
    and public.uses_roman_alphabet_name(short_name)
    and public.uses_roman_alphabet_name(location_name)
  ) not valid;

alter table public.development_race_stages
  add constraint development_race_stages_names_use_roman_alphabet
  check (public.uses_roman_alphabet_name(name)) not valid;

alter table public.national_federation_race_projects
  add constraint national_federation_race_projects_names_use_roman_alphabet
  check (
    public.uses_roman_alphabet_name(name)
    and public.uses_roman_alphabet_name(short_name)
  ) not valid;

alter table public.sponsors
  add constraint sponsors_names_use_roman_alphabet
  check (
    public.uses_roman_alphabet_name(name)
    and public.uses_roman_alphabet_name(short_name)
  ) not valid;

alter table public.teams validate constraint teams_names_use_roman_alphabet;
alter table public.team_seasons validate constraint team_seasons_names_use_roman_alphabet;
alter table public.development_teams validate constraint development_teams_names_use_roman_alphabet;
alter table public.races validate constraint races_names_use_roman_alphabet;
alter table public.race_editions validate constraint race_editions_names_use_roman_alphabet;
alter table public.stages validate constraint stages_names_use_roman_alphabet;
alter table public.development_race_editions validate constraint development_race_editions_names_use_roman_alphabet;
alter table public.development_race_stages validate constraint development_race_stages_names_use_roman_alphabet;
alter table public.national_federation_race_projects validate constraint national_federation_race_projects_names_use_roman_alphabet;
alter table public.sponsors validate constraint sponsors_names_use_roman_alphabet;

commit;
