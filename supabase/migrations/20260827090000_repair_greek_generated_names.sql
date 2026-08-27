begin;

-- Le profil grec contenait un bloc de valeurs à très faible fréquence issu
-- de résidents étrangers, ainsi qu'un patronyme tronqué ("Rm"). Ces tables
-- temporaires limitent le rattrapage aux valeurs retirées du catalogue.
create temporary table greek_invalid_first_names (
  name text primary key
) on commit drop;

insert into greek_invalid_first_names (name)
values
  ('George'), ('Elena'), ('Stella'), ('Elaine'), ('Marilia'), ('Carolina'),
  ('Ghada'), ('Marin'), ('Beata'), ('Dil'), ('Ghassan'), ('Mohit'),
  ('Krista'), ('Tanvir'), ('Adeel'), ('Fadia'), ('Faysal'), ('Seema'),
  ('Sofie'), ('Charbel'), ('Sumit'), ('Trish'), ('Vikram'), ('Yury'),
  ('Debby'), ('Haifa'), ('Rina'), ('Riyad'), ('Sina'), ('Valery'),
  ('Harvey'), ('Hiba'), ('Hima'), ('Jeanine'), ('Nahid'), ('Przemek'),
  ('Remon'), ('Rudolf'), ('Ute'), ('Anna'), ('John'), ('Mohamed'),
  ('Muhammad'), ('Chris'), ('Mikel'), ('Nazmi'), ('Hakan'), ('Hilmi'),
  ('Cihat'), ('Sissi'), ('Shan'), ('Cahit'), ('Manzoor'), ('Vanda'),
  ('Gökhan'), ('Maki'), ('Wahab'), ('Emmy'), ('Lukman'), ('Krzysztof'),
  ('Pelin'), ('Ilkay'), ('Saniye'), ('Zahir'), ('Polat'), ('Zainab'),
  ('Leandra'), ('Rahmi'), ('Ange'), ('Manou'), ('Joseph'), ('Clinton'),
  ('Annemarie'), ('Ayoub'), ('Ibra'), ('Inez'), ('Alysia'), ('Rhys'),
  ('Wail'), ('Ashref'), ('Boy'), ('Doriana'), ('Maximilian'), ('Tomislav'),
  ('Chika'), ('Floriana'), ('Loly'), ('Manuele');

create temporary table greek_invalid_last_names (
  name text primary key
) on commit drop;

insert into greek_invalid_last_names (name)
values
  ('Oksuz'), ('Popa'), ('Vasile'), ('Glover'), ('Morton'), ('Hassan'),
  ('Bruce'), ('Connolly'), ('Terzi'), ('Zara'), ('Hutchinson'),
  ('Stephenson'), ('Tarek'), ('Tyler'), ('Angeles'), ('Angelo'),
  ('Manzano'), ('Mariam'), ('Power'), ('Townsend'), ('Zidan'), ('Ayesha'),
  ('Ayman'), ('Baxter'), ('Didi'), ('Garner'), ('Haidar'), ('Hale'),
  ('Kalu'), ('Kandil'), ('Kar'), ('Ma'), ('Maheshwari'), ('Matta'),
  ('Moro'), ('Nichols'), ('Rathore'), ('Viola'), ('Lydia'), ('Ali'),
  ('Singh'), ('Ahmed'), ('Gujjar'), ('Waqas'), ('Deva'), ('Santo'),
  ('Jana'), ('Agha'), ('Dağlı'), ('Babul'), ('Fall'), ('Memiş'), ('Loi'),
  ('Zhao'), ('Gori'), ('Amen'), ('Duma'), ('Rm'), ('Filippi'), ('Warda'),
  ('Almasry'), ('Damato'), ('Dib'), ('Groß'), ('Rain'), ('Seven'), ('Ugwu'),
  ('Zheng'), ('Bachir'), ('Crespo'), ('Dev'), ('Dia'), ('Enrique'), ('Faria'),
  ('Jannat'), ('Mendonça'), ('Michele'), ('Mosaad'), ('Mosad'), ('Najwa'),
  ('Pagani'), ('Perri'), ('Raymond'), ('Borg'), ('Camilleri'), ('Vella'),
  ('Farrugia'), ('Pisani'), ('Iacono'), ('Caroline'), ('Schmid'), ('Farg'),
  ('Sanfilippo'), ('Zammit'), ('Galea');

create temporary table greek_replacement_first_names (
  ordinal integer primary key,
  name text not null unique
) on commit drop;

insert into greek_replacement_first_names (ordinal, name)
values
  (1, 'Georgios'), (2, 'Ioannis'), (3, 'Konstantinos'), (4, 'Dimitrios'),
  (5, 'Nikolaos'), (6, 'Panagiotis'), (7, 'Vasileios'), (8, 'Christos'),
  (9, 'Athanasios'), (10, 'Michail'), (11, 'Alexandros'), (12, 'Andreas'),
  (13, 'Stavros'), (14, 'Spyridon'), (15, 'Theodoros'), (16, 'Evangelos'),
  (17, 'Anastasios'), (18, 'Kyriakos'), (19, 'Apostolos'), (20, 'Stefanos'),
  (21, 'Marios'), (22, 'Petros'), (23, 'Antonios'), (24, 'Sotirios'),
  (25, 'Eleftherios'), (26, 'Charalampos'), (27, 'Gerasimos'),
  (28, 'Nektarios'), (29, 'Efthymios'), (30, 'Dionysios');

create temporary table greek_replacement_last_names (
  ordinal integer primary key,
  name text not null unique
) on commit drop;

insert into greek_replacement_last_names (ordinal, name)
values
  (1, 'Papadopoulos'), (2, 'Papadakis'), (3, 'Papageorgiou'),
  (4, 'Papathanasiou'), (5, 'Georgiou'), (6, 'Nikolaidis'),
  (7, 'Dimitriou'), (8, 'Konstantinou'), (9, 'Christodoulou'),
  (10, 'Ioannidis'), (11, 'Vasileiou'), (12, 'Antoniou'),
  (13, 'Athanasiou'), (14, 'Anastasiou'), (15, 'Alexandrou'),
  (16, 'Andreou'), (17, 'Charalambous'), (18, 'Evangelou'),
  (19, 'Theodorou'), (20, 'Panagiotou'), (21, 'Pavlou'), (22, 'Petrou'),
  (23, 'Stylianou'), (24, 'Kyriakou'), (25, 'Savvidis'),
  (26, 'Georgiadis'), (27, 'Dimitriadis'), (28, 'Papanikolaou'),
  (29, 'Papakonstantinou'), (30, 'Papadimitriou');

-- Coureurs professionnels : le profil d'origine évite de renommer un coureur
-- étranger qui aurait ensuite acquis la nationalité grecque.
with targets as (
  select
    rider.id,
    row_number() over (order by rider.created_at, rider.id) as ordinal
  from public.riders as rider
  join public.countries as country on country.id = rider.country_id
  where upper(country.iso_alpha2) = 'GR'
    and (
      (
        rider.generated_name_profile_code = 'greece'
        and (
          exists (select 1 from greek_invalid_first_names where name = rider.first_name)
          or exists (select 1 from greek_invalid_last_names where name = rider.last_name)
        )
      )
      or rider.last_name = 'Rm'
    )
)
update public.riders as rider
set
  first_name = case
    when exists (
      select 1 from greek_invalid_first_names where name = rider.first_name
    ) then (
      select replacement.name
      from greek_replacement_first_names as replacement
      where replacement.ordinal = 1 + mod(
        targets.ordinal - 1,
        (select count(*) from greek_replacement_first_names)
      )
    )
    else rider.first_name
  end,
  last_name = case
    when exists (
      select 1 from greek_invalid_last_names where name = rider.last_name
    ) then (
      select replacement.name
      from greek_replacement_last_names as replacement
      where replacement.ordinal = 1 + mod(
        targets.ordinal - 1,
        (select count(*) from greek_replacement_last_names)
      )
    )
    else rider.last_name
  end
from targets
where rider.id = targets.id;

-- Candidats de scouting : leur pays est celui de la génération, avant toute
-- entrée à l'académie et avant toute naturalisation.
with targets as (
  select
    candidate.id,
    row_number() over (order by candidate.created_at, candidate.id) as ordinal
  from public.youth_scouting_candidates as candidate
  join public.countries as country on country.id = candidate.country_id
  where upper(country.iso_alpha2) = 'GR'
    and (
      exists (select 1 from greek_invalid_first_names where name = candidate.first_name)
      or exists (select 1 from greek_invalid_last_names where name = candidate.last_name)
    )
)
update public.youth_scouting_candidates as candidate
set
  first_name = case
    when exists (
      select 1 from greek_invalid_first_names where name = candidate.first_name
    ) then (
      select replacement.name
      from greek_replacement_first_names as replacement
      where replacement.ordinal = 1 + mod(
        targets.ordinal - 1,
        (select count(*) from greek_replacement_first_names)
      )
    )
    else candidate.first_name
  end,
  last_name = case
    when exists (
      select 1 from greek_invalid_last_names where name = candidate.last_name
    ) then (
      select replacement.name
      from greek_replacement_last_names as replacement
      where replacement.ordinal = 1 + mod(
        targets.ordinal - 1,
        (select count(*) from greek_replacement_last_names)
      )
    )
    else candidate.last_name
  end
from targets
where candidate.id = targets.id;

-- Les noms des jeunes signés sont des copies de leur fiche de scouting.
update public.youth_academy_riders as academy
set
  first_name = candidate.first_name,
  last_name = candidate.last_name,
  updated_at = now()
from public.youth_scouting_candidates as candidate
join public.countries as country on country.id = candidate.country_id
where academy.candidate_id = candidate.id
  and upper(country.iso_alpha2) = 'GR'
  and (
    academy.first_name is distinct from candidate.first_name
    or academy.last_name is distinct from candidate.last_name
  );

-- Le marché du staff est également alimenté par cette bibliothèque. Une ligne
-- de naturalisation indique qu'un nom étranger doit être conservé.
with targets as (
  select
    member.id,
    row_number() over (order by member.created_at, member.id) as ordinal
  from public.staff_members as member
  join public.countries as country on country.id = member.country_id
  where upper(country.iso_alpha2) = 'GR'
    and (
      member.last_name = 'Rm'
      or (
        not exists (
          select 1
          from public.staff_naturalizations as naturalization
          where naturalization.staff_member_id = member.id
        )
        and (
          exists (select 1 from greek_invalid_first_names where name = member.first_name)
          or exists (select 1 from greek_invalid_last_names where name = member.last_name)
        )
      )
    )
)
update public.staff_members as member
set
  first_name = case
    when exists (
      select 1 from greek_invalid_first_names where name = member.first_name
    ) then (
      select replacement.name
      from greek_replacement_first_names as replacement
      where replacement.ordinal = 1 + mod(
        targets.ordinal - 1,
        (select count(*) from greek_replacement_first_names)
      )
    )
    else member.first_name
  end,
  last_name = case
    when exists (
      select 1 from greek_invalid_last_names where name = member.last_name
    ) then (
      select replacement.name
      from greek_replacement_last_names as replacement
      where replacement.ordinal = 1 + mod(
        targets.ordinal - 1,
        (select count(*) from greek_replacement_last_names)
      )
    )
    else member.last_name
  end
from targets
where member.id = targets.id;

-- L'archive du profil public conserve une copie du nom du coureur.
update public.rider_history_archives as archive
set
  first_name = rider.first_name,
  last_name = rider.last_name
from public.riders as rider
where rider.id = archive.rider_id
  and rider.generated_name_profile_code = 'greece'
  and upper(archive.country_code) = 'GR'
  and (
    archive.first_name is distinct from rider.first_name
    or archive.last_name is distinct from rider.last_name
  );

do $$
declare
  remaining_invalid_count integer;
begin
  select count(*)::integer
  into remaining_invalid_count
  from public.riders as rider
  join public.countries as country on country.id = rider.country_id
  where upper(country.iso_alpha2) = 'GR'
    and rider.generated_name_profile_code = 'greece'
    and (
      exists (select 1 from greek_invalid_first_names where name = rider.first_name)
      or exists (select 1 from greek_invalid_last_names where name = rider.last_name)
    );

  if remaining_invalid_count > 0 then
    raise exception '% identité(s) grecque(s) contaminée(s) subsistent.',
      remaining_invalid_count;
  end if;
end;
$$;

commit;
