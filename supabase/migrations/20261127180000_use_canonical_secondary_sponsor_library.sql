begin;
set local statement_timeout='8s';
set local lock_timeout='500ms';

-- Keep every existing agreement and its original country. The country templates
-- remain readable for history, but are no longer a source of new proposals.
alter table public.secondary_sponsor_catalog
  add column source_sponsor_id uuid references public.sponsors(id) on delete restrict,
  add column available_for_offers boolean not null default false,
  alter column slot_number drop not null,
  add constraint secondary_sponsor_library_source_unique unique(source_sponsor_id),
  add constraint secondary_sponsor_library_source_shape check (
    (source_sponsor_id is null and not available_for_offers)
    or (source_sponsor_id is not null and slot_number is null)
  );
create unique index secondary_sponsor_library_brand_unique
  on public.secondary_sponsor_catalog(lower(btrim(name))) where source_sponsor_id is not null;
create index secondary_sponsor_library_available_country_idx
  on public.secondary_sponsor_catalog(country_id,prestige,id) where available_for_offers;

create function private.guard_secondary_sponsor_library_identity()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_source public.sponsors%rowtype;
begin
  if tg_op='UPDATE' and old.source_sponsor_id is not null
    and (new.source_sponsor_id,new.country_id) is distinct from (old.source_sponsor_id,old.country_id) then
    raise exception 'L’identité et le pays d’une marque de la bibliothèque sont permanents.';
  end if;
  if new.source_sponsor_id is null then
    if new.available_for_offers then raise exception 'Cette ancienne marque ne peut plus être proposée.'; end if;
    return new;
  end if;
  select * into v_source from public.sponsors where id=new.source_sponsor_id;
  if v_source.id is null or new.country_id is distinct from v_source.country_id
    or new.name is distinct from v_source.name
    or new.catalog_key is distinct from 'library-'||v_source.catalog_key or new.slot_number is not null then
    raise exception 'Le sponsor secondaire doit reprendre l’identité et le pays de sa marque dans la bibliothèque.';
  end if;
  if new.available_for_offers and v_source.status<>'active' then
    raise exception 'Cette marque de la bibliothèque est inactive.';
  end if;
  return new;
end;
$$;
create trigger guard_secondary_sponsor_library_identity
before insert or update of source_sponsor_id,country_id,name,catalog_key,slot_number,available_for_offers
on public.secondary_sponsor_catalog for each row execute function private.guard_secondary_sponsor_library_identity();

create function private.guard_sponsor_library_country()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.country_id is distinct from old.country_id and exists(
    select 1 from public.secondary_sponsor_catalog where source_sponsor_id=old.id
  ) then raise exception 'Une marque de la bibliothèque ne peut être associée qu’à un seul pays.'; end if;
  return new;
end;
$$;
create trigger guard_sponsor_library_country before update of country_id on public.sponsors
  for each row execute function private.guard_sponsor_library_country();

create function private.sync_secondary_sponsor_library_identity()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if (new.name,new.catalog_key,new.status) is not distinct from (old.name,old.catalog_key,old.status) then return new; end if;
  update public.secondary_sponsor_catalog
    set name=new.name,catalog_key='library-'||new.catalog_key,available_for_offers=(new.status='active')
    where source_sponsor_id=new.id and (name,catalog_key,available_for_offers)
      is distinct from (new.name,'library-'||new.catalog_key,new.status='active');
  return new;
end;
$$;
create trigger sync_secondary_sponsor_library_identity after update of name,catalog_key,status on public.sponsors
  for each row execute function private.sync_secondary_sponsor_library_identity();

-- This reviewed metadata snapshot uses the existing game library and its assets;
-- it does not create or rename principal sponsors, countries, or signed brands.
create temporary table secondary_library_snapshot(
  catalog_key text primary key,name text not null,country_code text not null,
  prestige smallint not null,primary_color text not null,accent_color text not null
) on commit drop;
-- BEGIN REVIEWED LIBRARY SNAPSHOT
insert into secondary_library_snapshot(catalog_key,name,country_code,prestige,primary_color,accent_color) values
('abbaye-du-lion','Abbaye du Lion','BE',4,'#7A3E12','#F5E6C8'),
('abyssinia-coffee-pulse','Abyssinia Coffee Pulse','ET',4,'#5B1730','#29D9C2'),
('aden-maritime-exchange','Aden Maritime Exchange','YE',3,'#073D53','#B98A2E'),
('adire','Adire','NG',3,'#172F76','#F04A8A'),
('adria-pasta-bar','Adria Pasta Bar','HR',3,'#0F6B78','#F2C14E'),
('adriatica-lines','Adriatica Lines','IT',4,'#006D9C','#FFFFFF'),
('aerovia-turbines','Aérovia Turbines','FR',5,'#102A43','#E24A33'),
('afi-lavaware','Afi Lavaware','WS',5,'#202226','#48B9AA'),
('agos-lakas','Agos Lakas','PH',2,'#105E8B','#F4A23A'),
('air-solar-works','Aïr Solar Works','NE',3,'#1248A4','#BCC2C8'),
('akhal-ceramics','Akhal Ceramics','TM',4,'#173A78','#C86F3E'),
('al-rafidain-cables','Al-Rafidain Cables','IQ',2,'#173A56','#24A6A1'),
('al-zour-pearl-lines','Al Zour Pearl Lines','KW',5,'#082B4C','#C8A85A'),
('ala-velona','Ala Velona','MG',1,'#326A3F','#C84B3A'),
('almyra','Almyra','CY',1,'#174EB6','#B96735'),
('alpenbore-systems','AlpenBore Systems','CH',4,'#252B30','#66B7D4'),
('altiplano-condor','Altiplano Cóndor','BO',3,'#4B123D','#F1B82D'),
('amahoro-amazi','Amahoro Amazi','BI',2,'#237FC2','#F0C64D'),
('amber-rye-foods','Amber Rye Foods','LV',2,'#48633A','#E4BC55'),
('amber-sky-aviation','Amber Sky Aviation','LT',4,'#E9A11B','#56B8E8'),
('amman-generics','Amman Generics','JO',5,'#0B3954','#F18B4C'),
('andean-meridian-bank','Andean Meridian Bank','EC',5,'#183A52','#D9A525'),
('andes-salud','Andes Salud','CO',4,'#176B58','#D84C4C'),
('aotearoa-biosecure','Aotearoa BioSecure','NZ',4,'#173C35','#79B94A'),
('apricot-crown','Apricot Crown','AM',3,'#7A1F35','#E89B49'),
('arawak-cay-conch-kitchens','Arawak Cay Conch Kitchens','BS',1,'#123D54','#F2C94C'),
('arcstride-athletics','Arcstride Athletics','AU',4,'#222A31','#D85B32'),
('ardennes-outillage','Ardennes Outillage','BE',2,'#20252B','#E4572E'),
('arevi-mirg','Arevi Mirg','AM',4,'#7A294C','#3D7B55'),
('armonia','Armonia','IT',2,'#741827','#B18A45'),
('ashgabat-grand-hotels','Ashgabat Grand Hotels','TM',4,'#07533F','#C99A2D'),
('assurances-du-fleuve','Assurances du Fleuve','CG',4,'#1B4F91','#2AAE9B'),
('asuncion-ledger-partners','Asunción Ledger Partners','PY',2,'#163B5C','#8F2D56'),
('atacama-condor','Atacama Condor','CL',2,'#1B2A41','#C98B3C'),
('atacama-observatory-optics','Atacama Observatory Optics','CL',3,'#151C3A','#F06B4F'),
('ateliers-rail-thies','Ateliers du Rail de Thiès','SN',3,'#173F34','#D69B35'),
('atlantica-naval-systems','Atlântica Naval Systems','PT',5,'#003B5C','#FFFFFF'),
('atlas-ghassoul','Atlas Ghassoul','MA',4,'#8A3F2D','#E1A83B'),
('atlas-racing-lab','Atlas Racing Lab','MA',4,'#174A3A','#E8C56A'),
('atlas-solaire','Atlas Solaire','MA',5,'#C1272D','#D4A017'),
('atoll-coco-surge','Atoll Coco Surge','MV',3,'#092B4B','#F07167'),
('atoll-sports-desk','Atoll Sports Desk','MV',2,'#087A89','#F36D5C'),
('aurelia-moda','Aurelia Moda','IT',5,'#6B1839','#FFF8E7'),
('aures-solaire','Aurès Solaire','DZ',3,'#102A56','#F5A623'),
('aurora-racing-team','Aurora Racing Team','FI',5,'#112B46','#F4D35E'),
('avvolta','Avvolta','IT',4,'#303438','#E9E600'),
('ayeyar-textile-care','Ayeyar Textile Care','MM',1,'#286A78','#F0A64A'),
('ayeyarwady-riceworks','Ayeyarwady Riceworks','MM',2,'#005946','#F1E7D2'),
('azulejo-vivo','Azulejo Vivo','PT',4,'#174A8B','#FFF7E6'),
('azur-logistics','Azur Logistics','BE',3,'#0066CC','#FFFFFF'),
('bablink','BabLink','DJ',5,'#102D4A','#F05C3C'),
('badweyn-kalluun','Badweyn Kalluun','SO',3,'#156A8A','#F06D55'),
('baia-nova-telecom','Baía Nova Telecom','AO',4,'#07596A','#FF5A47'),
('bajan-basket','Bajan Basket','BB',1,'#145A6A','#F46D5E'),
('bajan-cane-works','Bajan Cane Works','BB',2,'#2F5A36','#CDA23D'),
('bajja-bitter','Bajja Bitter','MT',3,'#174C70','#E4543F'),
('bakir','Bakir','TR',4,'#20262A','#20B8B0'),
('balkan-atomika','Balkan Atomika','BG',3,'#183B5B','#E45B4F'),
('balkan-star-air','Balkan Star Air','RS',4,'#102F66','#2AB4EA'),
('bamako-batiment','Bamako Bâtiment','ML',3,'#D4632D','#243B7B'),
('banaadir-link','Banaadir Link','SO',3,'#092A57','#DFC07B'),
('banco-kantu','Banco Kantu','BO',3,'#A62A69','#138A87'),
('baobab-bonbons','Baobab Bonbons','MG',2,'#C94C32','#F2C14E'),
('barada-aman','Barada Aman','SY',2,'#536B3D','#3D91A6'),
('barid-bahar','Barid Bahar','OM',3,'#13627A','#D89B3A'),
('bayt-dijla','Bayt Dijla','IQ',3,'#176B68','#B86332'),
('bayt-el-aman','Bayt El Aman','LB',2,'#2E6B4C','#C96648'),
('bengal-monsoon-air','Bengal Monsoon Air','BD',3,'#087A45','#E72536'),
('bergkrone-seilbahnen','Bergkrone Seilbahnen','AT',5,'#173E35','#E36C32'),
('biely-sad','Biely Sad','BY',2,'#9D2945','#376B4B'),
('bijagos-caju','Bijagós Caju','GW',1,'#176432','#1673B9'),
('binaa-al-najd','Binaa Al Najd','SA',5,'#315A55','#A85C35'),
('bishkek-emal','Bishkek Emal','KG',2,'#154C63','#D54235'),
('bissau-borracha','Bissau Borracha','GW',1,'#202C2A','#D6523A'),
('biyo-djibouti','Biyo Djibouti','DJ',2,'#1265A8','#EF6A4B'),
('bjeshke-bulmet','Bjeshkë Bulmet','AL',3,'#176B69','#C8453D'),
('bluecrest-mutual','Bluecrest Mutual','US',5,'#173A63','#52A7D8'),
('boardwalk-taffy','Boardwalk Taffy','US',4,'#E63946','#43C6AC'),
('bodega-alto-zonda','Bodega Alto Zonda','AR',4,'#5A1835','#B86A3E'),
('bohemia-velocity-project','Bohemia Velocity Project','CZ',3,'#5C1F3D','#E3B54A'),
('boka-adriatic-yards','Boka Adriatic Yards','ME',3,'#0B2B4B','#B96C3D'),
('boke-alumina','Boké Alumina','GN',3,'#173F7A','#B84728'),
('boreal-mutual','Boreal Mutual','CA',3,'#164A41','#A7D86E'),
('borneo-helix','Borneo Helix','BN',5,'#0D4636','#D3A84B'),
('bosphore-ember','Bosphore Ember','TR',4,'#17324D','#F2A900'),
('brassel-foods','Brassel Foods','BE',2,'#D7263D','#FFFFFF'),
('brisa-quisqueya','Brisa Quisqueya','DO',4,'#1379B8','#F05A4F'),
('brujula-miskita','Brújula Miskita','NI',2,'#124E73','#E35E45'),
('bucharest-square-properties','Bucharest Square Properties','RO',4,'#28324B','#9D344B'),
('caano-doux','Caano Doux','DJ',3,'#185D8A','#D98436'),
('cabo-graphite','Cabo Graphite','MZ',4,'#2B3037','#E85D4B'),
('cachupa-di-terra','Cachupa di Terra','CV',2,'#173F64','#E0664B'),
('cafe-des-plateaux','Café des Plateaux','TG',2,'#244736','#C86F35'),
('calder-wren-motorworks','Calder & Wren Motorworks','GB',3,'#1E2A2F','#C6A153'),
('calypso-acoustics','Calypso Acoustics','TT',3,'#16151B','#F04C98'),
('calypso-carnival-group','Calypso Carnival Group','TT',4,'#53217A','#D8A326'),
('cambrian-slateworks','Cambrian Slateworks','GB',3,'#30383C','#536B5B'),
('cantieri-tirreno','Cantieri Tirreno','IT',5,'#123B54','#64B7C4'),
('canyon-volt','Canyon Volt','US',3,'#C4513B','#F2B632'),
('cape-fynbos','Cape Fynbos','ZA',3,'#2F6B4F','#D97A88'),
('caramels-de-keravel','Caramels de Keravel','FR',1,'#102A43','#FFF1D2'),
('caroni','Caroní','VE',5,'#391B3F','#D0F04A'),
('carpathia-rail-dynamics','Carpathia Rail Dynamics','RO',4,'#75131F','#E5A125'),
('carthage-mosaic-house','Carthage Mosaic House','TN',3,'#174B91','#DFC49A'),
('casa-copan','Casa Copán','HN',5,'#5A1F2A','#EFE1C2'),
('casa-nopal','Casa Nopal','MX',3,'#1E6B46','#D93F76'),
('caseificio-delle-murge','Caseificio delle Murge','IT',2,'#668249','#91C8DD'),
('caspian-kite-airways','Caspian Kite Airways','AZ',4,'#082F5B','#C77B3F'),
('caspian-turbine','Caspian Turbine','IR',5,'#064F4E','#F2A900'),
('caye-signal','Caye Signal','BZ',3,'#062D45','#39C5D8'),
('caye-squeeze','Caye Squeeze','BZ',3,'#087F8C','#F26455'),
('cayewave','CayeWave','BZ',2,'#063D5B','#FF7A45'),
('cebela-mobility','Čebela Mobility','SI',2,'#273C49','#E7AF34'),
('cedar-mezze','Cedar Mezze','LB',3,'#1E6B4E','#F1D8A8'),
('cedar-moon','Cedar Moon','LB',2,'#2E2B5F','#E0B84F'),
('ceiba-subsea','Ceiba Subsea','GQ',4,'#082D62','#F2665A'),
('ceylon-refit','Ceylon Refit','LK',2,'#8D5AA9','#E8B56B'),
('chamarel-horizon','Chamarel Horizon','MU',4,'#0B4F58','#C66A42'),
('chari-gum-arabic','Chari Gum Arabic','TD',1,'#4C2616','#7A7D48'),
('charkh-kavir','Charkh Kavir','IR',4,'#285B55','#B84432'),
('chinguetti-lait','Chinguetti Lait','MR',2,'#1C5DAA','#23A6A6'),
('cibao-medtech','Cibao MedTech','DO',3,'#087F8C','#F15A42'),
('cidrerie-aulne','Cidrerie de l’Aulne','FR',3,'#2F6B4F','#D9A441'),
('clave','Clave','CU',1,'#6B1839','#19B7A5'),
('clyde-marine-pumps','Clyde Marine Pumps','GB',4,'#0D3F78','#F47721'),
('cobre-agave','Cobre Agave','MX',5,'#247B6B','#E9C46A'),
('codru-cellars','Codru Cellars','MD',2,'#681B35','#F0E6D3'),
('comal','Comal','GT',2,'#24211F','#00A878'),
('congo-volt-systems','Congo Volt Systems','CD',4,'#174EA6','#C6723B'),
('cook-strait-fry','Cook Strait Fry','NZ',2,'#123B5D','#F2C94C'),
('copperbelt-cola-company','Copperbelt Cola Company','ZM',4,'#7A0D21','#B96732'),
('coral-bird-airways','Coral Bird Airways','PG',3,'#F04B32','#FFC928'),
('cortes-frio','Cortés Frío','HN',3,'#123A7A','#F1C419'),
('cortica-nova','Cortiça Nova','PT',3,'#8A4F2D','#F8E7C8'),
('cotonou-weave','Cotonou Weave','BJ',2,'#173A5E','#D06632'),
('county-line-wholesale','County Line Wholesale','US',3,'#215B49','#E56B2F'),
('covoare-basarabene','Covoare Basarabene','MD',3,'#A63D3A','#E5C07B'),
('cuenca-cobre-cocina','Cuenca Cobre Cocina','EC',2,'#8B4A2B','#E1B565'),
('cumbre-coca-rush','Cumbre Coca Rush','CO',4,'#123F31','#C8F044'),
('cyrene-solar-glass','Cyrene Solar Glass','LY',3,'#126EAA','#E6792C'),
('dahin-depot','Dahin Depot','MN',2,'#5B316F','#B86B3F'),
('dalmatia-superyacht-works','Dalmatia Superyacht Works','HR',5,'#082B45','#C59454'),
('damascene-glassworks','Damascene Glassworks','SY',2,'#1147B5','#B51425'),
('danube-test-team','Danube Test Team','AT',5,'#171B21','#E8E8E3'),
('dar-al-ilm','Dar Al-Ilm','JO',4,'#493B78','#1C9A91'),
('darb-studio','Darb Studio','PS',2,'#244F45','#D95746'),
('darussalam-metrology','Darussalam Metrology','BN',4,'#0B4A3A','#9CCB3B'),
('daugava-transit','Daugava Transit','LV',4,'#8C2332','#D0A94B'),
('dawwir','Dawwir','JO',5,'#C56A4B','#3CB8A7'),
('delphi-dynamics','Delphi Dynamics','GR',4,'#2E2A72','#F2B134'),
('delta-flare-energy','Delta Flare Energy','NG',4,'#164A3A','#B7C7C4'),
('delta-looms','Delta Looms','EG',3,'#183A6B','#C7653F'),
('deltaflow-engineering','DeltaFlow Engineering','NL',5,'#0057B8','#FFFFFF'),
('demerara-geomarine','Demerara GeoMarine','GY',5,'#082C5B','#D5AD4C'),
('demerara-golden-cane','Demerara Golden Cane','GY',3,'#C58A20','#1E593B'),
('dhoni-reef','Dhoni Reef','MV',4,'#082B45','#E76F51'),
('dili-rhythm-house','Dili Rhythm House','TL',1,'#11234E','#A54330'),
('diwan-majlis','Diwan Majlis','QA',5,'#5B1838','#C9A44C'),
('diwaniya-coffee','Diwaniya Coffee','KW',3,'#00A6C7','#E83E8C'),
('djoliba-mobile','Djoliba Mobile','ML',2,'#142A6D','#E9D8B4'),
('doce-brisa','Doce Brisa','BR',4,'#178C5B','#F4C542'),
('dodo-blue-finance','Dodo Blue Finance','MU',3,'#0B4F6C','#F4B942'),
('doha-canopy-engineering','Doha Canopy Engineering','QA',5,'#171B3A','#E86145'),
('dolci-bellini','Dolci Bellini','IT',3,'#D23B5A','#FFFFFF'),
('dolomiti-arredo','Dolomiti Arredo','IT',3,'#294637','#D99B49'),
('donau-resonanz','Donau Resonanz','AT',4,'#12263A','#43B9C6'),
('dong-duong-phanh','Đông Dương Phanh','VN',2,'#20282D','#C9D1D4'),
('droichead','Droichead','IE',3,'#075744','#F4A900'),
('druk-horizon-air','Druk Horizon Air','BT',4,'#8B1538','#F5C24B'),
('druk-loop','Druk Loop','BT',1,'#D76B9A','#76C7E8'),
('druklink-mobile','DrukLink Mobile','BT',2,'#3E2B71','#D94A3A'),
('duna-atom','Duna Atom','HU',4,'#1557B0','#A6D33B'),
('dunaj-telekom','Dunaj Telekom','SK',3,'#2447A5','#66D4E8'),
('dunav-kovac','Dunav Kovač','RS',3,'#27373E','#D37735'),
('durrat-fizz','Durrat Fizz','KW',4,'#14694F','#C7A544'),
('dzintara-optika','Dzintara Optika','LV',5,'#5A224C','#37A7A1'),
('eichenrad-automobil','Eichenrad Automobil','DE',5,'#173A34','#E66A2C'),
('eislek-orbital','Éislek Orbital','LU',5,'#111B3B','#AEB8C8'),
('eldur-moss','Eldur & Moss','IS',3,'#26343B','#F06B4F'),
('emilia-automazione','Emilia Automazione','IT',4,'#28364A','#48B4B0'),
('enlace-bata','Enlace Bata','GQ',2,'#183B63','#F05C3F'),
('ennedi-relais','Ennedi Relais','TD',1,'#A44931','#253B68'),
('ennstal-praezision','Ennstal Präzision','AT',3,'#272B2F','#BBD436'),
('equateur-assurances','Équateur Assurances','GA',4,'#087A67','#173B52'),
('erebuni-grand-instruments','Erebuni Grand Instruments','AM',5,'#651D32','#D6AE62'),
('esclusa','Esclusa','PA',4,'#082B4C','#FF7A2F'),
('esmeraldas-cacao','Esmeraldas Cacao','EC',2,'#173F2D','#D5A743'),
('exuma-blue-resorts','Exuma Blue Resorts','BS',3,'#073F6B','#FF7866'),
('falaj-water-systems','Falaj Water Systems','AE',5,'#0B2A55','#D8E0E5'),
('fale-malosi','Fale Malosi','WS',4,'#123E46','#E45745'),
('farmacias-izalco','Farmacias Izalco','SV',2,'#1487A5','#E75A4C'),
('faso-yiriwa','Faso Yiriwa','BF',2,'#7A263A','#2E6E68'),
('faya-peper','Faya Peper','SR',1,'#1A1A1A','#16A596'),
('fenland-maltings','Fenland Maltings','GB',3,'#113F31','#C6A04B'),
('ferrovia-nova','Ferrovia Nova','IT',4,'#30475E','#F6F7F9'),
('forja-de-maputo','Forja de Maputo','MZ',3,'#30383D','#D8B36B'),
('frankincense-air','Frankincense Air','OM',5,'#07575B','#F0D2A4'),
('freeport-drydock-alliance','Freeport Drydock Alliance','BS',4,'#102C44','#F27A2D'),
('freetown-marine-cable','Freetown Marine Cable','SL',2,'#092B55','#C8753B'),
('frio-copan','Frío Copán','HN',3,'#176D91','#F28B38'),
('frio-kwanza','Frio Kwanza','AO',1,'#113F77','#F2FBFC'),
('fugazza-sprint','Fugazza Sprint','AR',3,'#D94B3D','#FFF1D0'),
('fuinneamh-feirme','Fuinneamh Feirme','IE',3,'#28623D','#A7C957'),
('fulmine-rosso-automobili','Fulmine Rosso Automobili','IT',5,'#821E2A','#E4B84A'),
('futs-de-bangui','Fûts de Bangui','CF',1,'#B85A2B','#173D4D'),
('gaborone-diamond-exchange','Gaborone Diamond Exchange','BW',4,'#111A20','#52C7C4'),
('ganvie-marine','Ganvié Marine','BJ',2,'#075B7A','#E65A2F'),
('garis-performance','Garis Performance','MY',5,'#142E57','#2CC4A2'),
('garuda-test-team','Garuda Test Team','ID',4,'#9F2635','#E2B653'),
('gateflow-sg','Gateflow SG','SG',3,'#172F4F','#F45B4E'),
('gdansk-amber-exchange','Gdańsk Amber Exchange','PL',4,'#C77A22','#E9B949'),
('gezira-cotton-works','Gezira Cotton Works','SD',2,'#0B2854','#A35434'),
('glen-durnach','Glen Durnach','GB',5,'#1E2321','#B87333'),
('gom-lam-viet','Gốm Lam Việt','VN',1,'#174A7E','#C85A3E'),
('grand-harbour-robotics','Grand Harbour Robotics','MT',4,'#20272D','#C9342D'),
('granito-ceramiche','Granito Ceramiche','IT',3,'#B65C3A','#F2E9DF'),
('great-lakes-foundry','Great Lakes Foundry','US',4,'#335C81','#C85A35'),
('gryning-havre','Gryning Havre','SE',5,'#1D4F79','#C54255'),
('guarani-mate-cooperative','Guaraní Mate Cooperative','PY',2,'#075238','#B65C28'),
('guatemala-volcano-routes','Guatemala Volcano Routes','GT',3,'#087F5B','#F3B61F'),
('habana-biolab','Habana BioLab','CU',4,'#102A56','#F0644B'),
('hai-au-dong-tau','Hải Âu Đóng Tàu','VN',3,'#0C3559','#D48A3A'),
('han-river-credit','Han River Credit','KR',4,'#14213D','#29B58F'),
('hanbyeol-care','Hanbyeol Care','KR',5,'#5B4FC4','#4AC6C8'),
('hanul-vector-motors','Hanul Vector Motors','KR',4,'#17264A','#C8E34D'),
('harare-vault-auction','Harare Vault & Auction','ZW',3,'#07543C','#C49A42'),
('harborline-logistics','Harborline Logistics','US',5,'#102A43','#D4A94F'),
('havpuls-energi','Havpuls Energi','DK',4,'#103A5A','#F26B5B'),
('hephaistos-forge','Hephaistos Forge','GR',4,'#20242A','#F26B2E'),
('herat-loom-house','Herat Loom House','AF',3,'#273653','#D8B76A'),
('hexa-batiment','Hexa Bâtiment','FR',1,'#234E52','#F4A261'),
('hidri-works','Hidri Works','ER',1,'#C64E35','#E3B341'),
('high-desert-aerospace','High Desert Aerospace','US',4,'#14233C','#F26B38'),
('himal-hydro','Himal Hydro','NP',2,'#133C8C','#C62035'),
('himalayan-mountains','Himalayan Mountains','NP',4,'#0B356B','#E9A72E'),
('hinode-transit','Hinode Transit','JP',5,'#102A43','#E0B44C'),
('honiara-ferries','Honiara Ferries','SB',2,'#007F86','#F06B5B'),
('ilamatepec-coffee-lab','Ilamatepec Coffee Lab','SV',2,'#3F1D12','#A91F1B'),
('indus-mithai','Indus Mithai','PK',3,'#0B6B3A','#E6B84A'),
('iplik-motion','İplik Motion','TR',5,'#982F3B','#E9DDC7'),
('island-ember','Island Ember','JM',5,'#242424','#F05A28'),
('ivoire-cacao','Ivoire Cacao','CI',4,'#5A3524','#009E60'),
('izalco-ceramica','Izalco Cerámica','SV',3,'#17191D','#D84932'),
('jacmel-vetiver','Jacmel Vetiver','HT',2,'#142C66','#E6B222'),
('jade-kiln','Jade Kiln','CN',5,'#1B7F6B','#C9A44C'),
('jade-lantern-candy','Jade Lantern Candy','CN',5,'#C92A2A','#F2C14E'),
('jade-meridian-motors','Jade Meridian Motors','CN',5,'#0D5C4D','#A72E35'),
('jadranska-solana','Jadranska Solana','HR',3,'#126C78','#E86543'),
('jericho-medjool-cooperative','Jericho Medjool Cooperative','PS',2,'#285A29','#63321F'),
('jirani-bank','Jirani Bank','KE',3,'#184D3A','#E39A2D'),
('juba-cold-chain','Juba Cold Chain','SS',1,'#14678C','#74C7D4'),
('juba-span','Juba Span','SS',1,'#1D5D74','#E8D7B5'),
('junkanoo-brass-feather','Junkanoo Brass & Feather','BS',2,'#161826','#F0B429'),
('kaffa-origins','Kaffa Origins','ET',4,'#7A263A','#E0A526'),
('kaieteur-carbon-works','Kaieteur Carbon Works','GY',3,'#172528','#F2C94C'),
('kairaba-homes','Kairaba Homes','GM',2,'#4B3F91','#E56B5D'),
('kakao-bilong-sepik','Kakao Bilong Sepik','PG',2,'#4A251C','#D85A35'),
('kakheti-botanica','Kakheti Botanica','GE',2,'#5D315F','#D7A84A'),
('kalahari-helio','Kalahari Helio','NA',5,'#006D6F','#F5C542'),
('kalahari-mart','Kalahari Mart','BW',2,'#138A8A','#C85B32'),
('kamba-fibre','Kamba Fibre','TZ',2,'#C99428','#2C78A0'),
('kapuluan-post','Kapuluan Post','PH',3,'#155A75','#F4C84D'),
('karkade-nile-energy','Karkadé Nile Energy','EG',3,'#8D174F','#E4B94B'),
('karkhana-tools','Karkhana Tools','NP',2,'#253C52','#E75B43'),
('kartli-grid','Kartli Grid','GE',3,'#0F5B4E','#D8A83E'),
('kartli-marketi','Kartli Marketi','GE',2,'#6D2438','#487A4B'),
('kassa-banque','Kassa Banque','GN',5,'#173F6B','#B62E3E'),
('kastom-rescue','Kastom Rescue','SB',1,'#164F59','#E8503F'),
('kavango-form','Kavango Form','NA',3,'#262A2B','#2768C7'),
('kawsay-movil','Kawsay Móvil','BO',3,'#4B2B78','#E45B43'),
('kensington-willow','Kensington Willow','BB',5,'#51204D','#D4A83E'),
('kentepay','KentePay','GH',5,'#0D2A57','#C43A35'),
('keshet-snacks','Keshet Snacks','IL',4,'#5B21B6','#FF4D00'),
('khaima-services','Khaïma Services','MR',1,'#6A4C2F','#27877A'),
('khao-sen-vientiane','Khao Sen Vientiane','LA',1,'#B53C2E','#28705B'),
('khazaf-zliten','Khazaf Zliten','LY',4,'#123F57','#E06B45'),
('khokh-govi-copper','Khökh Govi Copper','MN',3,'#247F78','#E8C37A'),
('khotso-lichelete','Khotso Lichelete','LS',2,'#163B63','#4EA4B7'),
('kigali-convention-seating','Kigali Convention Seating','RW',3,'#193B58','#E5B84A'),
('kigali-saferide','Kigali SafeRide','RW',2,'#17242B','#25A9C7'),
('kilimanjaro-skylink','Kilimanjaro SkyLink','TZ',3,'#1597D5','#E9B32B'),
('kingston-sound-foundry','Kingston Sound Foundry','JM',4,'#161A1D','#00A7A5'),
('kiruna-grid-storage','Kiruna Grid Storage','SE',5,'#242B31','#C87340'),
('koh-e-noor-amanat','Koh-e Noor Amanat','AF',2,'#254B87','#E18B2D'),
('koit-systems','Koit Systems','EE',5,'#121820','#55C7D9'),
('kola-lome-impact','Kola Lomé Impact','TG',3,'#5B1F2D','#F4C744'),
('kopi-selat','Kopi Selat','MY',3,'#184B42','#C35D32'),
('kora-dispatch','Kora Dispatch','GM',2,'#245AA8','#D9453F'),
('korona','Korona','HU',2,'#17499B','#8F1830'),
('koru-racing-collective','Koru Racing Collective','NZ',3,'#12372D','#8FD5B8'),
('kotor-adriatic-insurance','Kotor Adriatic Insurance','ME',4,'#153B50','#C79A4A'),
('kovac-mostar','Kovač Mostar','BA',3,'#2C3137','#B7E629'),
('koval','Koval','UA',4,'#153653','#AEB6BC'),
('kraftlinje-sport','Kraftlinje Sport','NO',4,'#101C33','#E84A45'),
('krakow-vitrail-works','Kraków Vitrail Works','PL',3,'#22262B','#B6364A'),
('krama-serey-bank','Krama Serey Bank','KH',4,'#263E78','#C94A4A'),
('kreyol-krok','Kreyòl Krok','HT',2,'#5A3025','#159A9C'),
('kriti-gea','Kriti Gea','GR',3,'#557A32','#1F5AA6'),
('kwanza-petroleo','Kwanza Petróleo','AO',5,'#172A3A','#F2C14E'),
('kyiv-broadcast-union','Kyiv Broadcast Union','UA',5,'#1455C6','#FFD126'),
('kyklos-ferries','Kyklos Ferries','GR',5,'#0B2A4A','#E76F51'),
('kyrgyz-highlands','Kyrgyz Highlands','KG',3,'#C8102E','#F1B434'),
('la-paz-cable-media','La Paz Cable Media','BO',4,'#C72232','#F4C542'),
('lafaek-calcados','Lafaek Calçados','TL',2,'#17908B','#D95D39'),
('lagune-marche','Lagune Marché','CI',3,'#176A45','#F07B28'),
('lakbay-credit','Lakbay Credit','PH',2,'#12355B','#F6AE2D'),
('lakdiva-mediglove','Lakdiva Mediglove','LK',4,'#118C91','#8AC43F'),
('lakou-mobile','Lakou Mobile','HT',2,'#3657C8','#F2C14E'),
('lan-xang-fit-lab','Lan Xang Fit Lab','LA',2,'#294B88','#E4614B'),
('lana-sibiului','Lâna Sibiului','RO',2,'#214C3A','#C89A3D'),
('lapacho-modular','Lapacho Modular','PY',3,'#5D3B28','#3E8E78'),
('laurentide','Laurentide','CA',5,'#102E58','#E32B32'),
('leman-chronometrie','Léman Chronométrie','CH',5,'#101C2C','#6CB6D9'),
('ligne-equateur','Ligne Équateur','CG',2,'#126E61','#E4573D'),
('lilangeni-ingilazi','Lilangeni Ingilazi','SZ',2,'#16535A','#E09A42'),
('lima-maki','Lima Maki','PE',4,'#163A5F','#E85D5D'),
('limani-lines','Limani Lines','CY',4,'#173A59','#C8783A'),
('linje-nio-athletics','Linje Nio Athletics','SE',4,'#27313B','#E6F249'),
('lintas-laut','Lintas Laut','ID',4,'#121D56','#F5007B'),
('lion-coast-insurance','Lion Coast Insurance','SL',3,'#8A1F3D','#51606B'),
('litoral-cacao','Litoral Cacao','GQ',2,'#542B25','#22A89A'),
('ljubljana-colorworks','Ljubljana Colorworks','SI',3,'#2D2A5A','#E95C45'),
('lobaye-timber-cooperative','Lobaye Timber Cooperative','CF',1,'#211811','#17482E'),
('lodz-stagecraft','Łódź Stagecraft','PL',2,'#451D2B','#C89A45'),
('lome-frame-studios','Lomé Frame Studios','TG',2,'#141414','#F36922'),
('lorosae-cacao','Lorosa’e Cacao','TL',2,'#4B2724','#6BBF8A'),
('ludica-del-plata','Lúdica del Plata','UY',2,'#3A2449','#31A6A0'),
('lumen-energy','Lumen Energy','BE',5,'#00B86B','#FFFFFF'),
('lusutfu-cane','Lusutfu Cane','SZ',2,'#12613D','#E6D7B2'),
('mabele','Mabele','BW',1,'#245C78','#9C4A32'),
('madar','Madar','SA',5,'#35166B','#D4AD55'),
('maison-lannic','Maison Lannic','FR',2,'#151515','#9A4F22'),
('maiz-rapido','Maíz Rápido','MX',4,'#1F7A5B','#F4B942'),
('makola-superstores','Makola Superstores','GH',4,'#123B2A','#D94B33'),
('maloti-melt','Maloti Melt','LS',1,'#4F3D7C','#4B89A8'),
('maloti-mohair','Maloti Mohair','LS',1,'#1C5B92','#399052'),
('manama-linenworks','Manama Linenworks','BH',3,'#12304A','#D96C52'),
('mandio-pyahu','Mandi’o Pyahu','PY',2,'#512E70','#F1B84A'),
('manta-tuna-exchange','Manta Tuna Exchange','EC',4,'#0B3454','#E95D4F'),
('mapiko-congelados','Mapiko Congelados','MZ',3,'#126B8A','#D94735'),
('marmite-de-bangui','Marmite de Bangui','CF',1,'#476A3A','#C66332'),
('marovo-sunline','Marovo Sunline','SB',2,'#0B2D5A','#F26B50'),
('marsa-water-tank-studios','Marsa Water Tank Studios','MT',5,'#092B46','#E33D4F'),
('masaya-cacao','Masaya Cacao','NI',1,'#3B1E16','#0CA6A6'),
('mascareignes-textile','Mascareignes Textile','MU',3,'#243B6B','#E59A32'),
('masline','Masline','TT',2,'#1B1646','#00D4C7'),
('massawa-saltworks','Massawa Saltworks','ER',1,'#30343A','#B94A32'),
('matoke-composite','Matoke Composite','UG',3,'#73A82E','#5A2E63'),
('matonge-pressage','Matonge Pressage','CD',3,'#241A2E','#E84D8A'),
('mbira-audio','Mbira Audio','ZW',3,'#FF2D7A','#FFD400'),
('mboa-ciments','Mboa Ciments','CM',2,'#C94B32','#17745B'),
('mboa-horizon','Mboa Horizon','CM',3,'#007A5E','#FCD116'),
('mecanica-balti','Mecanica Bălți','MD',4,'#183247','#AAB3B7'),
('medecins-des-lagunes','Médecins des Lagunes','BJ',5,'#087F7A','#E76555'),
('mekong-discovery-laos','Mekong Discovery Laos','LA',2,'#075985','#D92F82'),
('meri-pank','Meri Pank','EE',4,'#152F4A','#8FD14F'),
('mesa-forge-automotive','Mesa Forge Automotive','US',4,'#7A3426','#2C3035'),
('mesila-timing','Mesila Timing','IL',5,'#143C75','#28B8A8'),
('mesurado-rubber','Mesurado Rubber','LR',2,'#175F3A','#A64E32'),
('milepost-diner','Milepost Diner','US',2,'#C83E3A','#2AA9A1'),
('mille-collines-tech','Mille Collines Tech','RW',4,'#16324F','#F5D547'),
('miraflores-canal-systems','Miraflores Canal Systems','PA',4,'#074E57','#E9DDC8'),
('miras-haly','Miras Haly','TM',5,'#0C5A4A','#8E2638'),
('mistralys-automobiles','Mistralys Automobiles','FR',3,'#18538A','#EC6D58'),
('moka-cane-works','Moka Cane Works','MU',2,'#315E3B','#D9813D'),
('mokka-cardamom-drive','Mokka Cardamom Drive','YE',3,'#4A291C','#C9783D'),
('mongolian-steppes','Mongolian Steppes','MN',3,'#0758A8','#F2B632'),
('monrovia-market','Monrovia Market','LR',1,'#15915A','#D9473F'),
('monrovia-shield','Monrovia Shield','LR',3,'#183B67','#C83D45'),
('montbrun-private','Montbrun Private','CH',5,'#102A43','#C9A44C'),
('montecristi-toquilla-house','Montecristi Toquilla House','EC',3,'#D7B46A','#B85C38'),
('montevideo-leatherworks','Montevideo Leatherworks','UY',3,'#5A2F22','#C68B4A'),
('moranbong-ceramics','Moranbong Ceramics','KP',2,'#3B223F','#8EB8A0'),
('moris-apex','Moris Apex','MU',3,'#073B4C','#F2645A'),
('morna-atlantic','Morna Atlantic','CV',2,'#073F5C','#EF6F61'),
('mosa-athletic-works','Mosa Athletic Works','LU',4,'#123A3A','#B66A45'),
('mosi-emeralds','Mosi Emeralds','ZM',4,'#08774F','#D9B75D'),
('mosi-hardware','Mosi Hardware','ZM',3,'#1269B0','#A7CF3A'),
('mtis-matsoni','Mtis Matsoni','GE',3,'#244F3D','#9E3542'),
('musanze-lava-stoneworks','Musanze Lava Stoneworks','RW',2,'#242424','#B64A30'),
('musel-waibau','Musel Wäibau','LU',3,'#244F3B','#C9A74F'),
('mwamba-cobalt','Mwamba Cobalt','CD',4,'#1856A3','#D27643'),
('mwezi-pumps','Mwezi Pumps','MW',1,'#146A8A','#E84A3C'),
('myohyang-ginseng','Myohyang Ginseng','KP',2,'#21543D','#B33A32'),
('mzansi-mutual','Mzansi Mutual','ZA',4,'#20362F','#D95B72'),
('naija-pulse','Naija Pulse','NG',5,'#008751','#F0B429'),
('najd-hydrogen','Najd Hydrogen','SA',5,'#075C47','#D6A94B'),
('nakamal-kava','Nakamal Kava','VU',2,'#5B168A','#FF7A1A'),
('nakhla-pop','Nakhla Pop','BH',4,'#6E2140','#29A7A0'),
('nalu-noni','Nalu Noni','WS',1,'#087F78','#F06A7B'),
('nambawan-kava','Nambawan Kava','VU',3,'#522967','#B6D647'),
('naranj-lab','Naranj Lab','SY',2,'#174E3A','#185F91'),
('nawat-al-noor','Nawat Al Noor','AE',5,'#16324A','#D8A42B'),
('nedjma-verre','Nedjma Verre','DZ',2,'#064D49','#FF6B35'),
('neem-nadi','Neem Nadi','IN',4,'#236A3A','#E4C84B'),
('negev-drip-systems','Negev Drip Systems','IL',4,'#0B5660','#DDA54A'),
('neman-optics','Neman Optics','BY',3,'#173A73','#6B315E'),
('nemunas-photonics','Nemunas Photonics','LT',5,'#142B42','#F1B82D'),
('neretva-cableworks','Neretva Cableworks','BA',2,'#0E6B58','#B66A3C'),
('neretva-dom','Neretva Dom','BA',1,'#22564B','#B8663C'),
('nerofilo','Nerofilo','IT',3,'#171616','#E8D8B9'),
('nervia','Nervia','CR',3,'#07565A','#FF5B57'),
('nile-dairy','Nile Dairy','UG',1,'#1E77B7','#64B653'),
('nilestone','NileStone','EG',5,'#1B4A5A','#C65D32'),
('nisos-energia','Nisos Energeia','GR',2,'#1557A6','#F4C542'),
('nistru-crystal-works','Nistru Crystal Works','MD',4,'#283744','#9BC9D1'),
('niumi-groundnut','Niumi Groundnut','GM',1,'#D08A20','#2076A3'),
('nizwa-ceramics','Nizwa Ceramics','OM',4,'#0E5ED7','#FF5A44'),
('no-energia','Nô Energia','GW',3,'#087E6A','#F28A2B'),
('nodi-jaal','Nodi Jaal','BD',3,'#0D664E','#D53F63'),
('nomad-dome-acoustics','Nomad Dome Acoustics','KG',3,'#172F4D','#C64B32'),
('nomad-vault','Nomad Vault','KZ',4,'#145DA0','#E0A526'),
('nordhavn-post','Nordhavn Post','DK',4,'#B32634','#F2C94C'),
('nordika-glass','Nordika Glass','BE',3,'#00A7C4','#FFFFFF'),
('nordlys-lakrids','Nordlys Lakrids','DK',3,'#1A1B1E','#8CC9D6'),
('nordlys-varsel','Nordlys Varsel','NO',4,'#182F52','#57D0B0'),
('nordur-skyr','Norður Skyr','IS',5,'#1A6285','#734E9E'),
('nova-assurances','Nova Assurances','FR',4,'#312E81','#F59E0B'),
('nubia-masaha','Nubia Masaha','SD',2,'#65442D','#258779'),
('nusa-nikel','Nusa Nikel','ID',3,'#263847','#E7553C'),
('nyanza-imigongo-works','Nyanza Imigongo Works','RW',3,'#3A201D','#B56A32'),
('odlar-emal','Odlar Emal','AZ',2,'#0C6E78','#E94B35'),
('odlar-sigorta','Odlar Sığorta','AZ',3,'#0B6B72','#E66A31'),
('ogooue-manganese','Ogooué Manganese','GA',4,'#282D33','#1559A5'),
('okavango-stack','Okavango Stack','BW',2,'#1F5A48','#F2D49B'),
('oliva-verde','Oliva Verde','IT',2,'#567D2B','#FFFBEA'),
('onda-habana','Onda Habana','CU',3,'#144B6A','#E14F4B'),
('one-yard-forward','One Yard Forward','JM',3,'#202621','#2E8A58'),
('orange-freight','Orange Freight','NL',4,'#F58220','#FFFFFF'),
('orbital-austral','Orbital Austral','AR',5,'#101E3A','#29B7C8'),
('orinoco-escena','Orinoco Escena','VE',3,'#382A8E','#E85549'),
('orion-cycling-lab','Orion Cycling Lab','CY',4,'#29234F','#E8B44F'),
('orloj','Orloj','CZ',2,'#102C49','#F2E8D3'),
('oryx-kaartwerk','Oryx Kaartwerk','NA',3,'#7A3D26','#28A49A'),
('ottica-bellagio','Ottica Bellagio','IT',4,'#10213F','#4FD4E2'),
('padma-home-appliances','Padma Home Appliances','BD',5,'#7A1832','#23384C'),
('paektu-spring','Paektu Spring','KP',3,'#163A5F','#C94B42'),
('pahad-chiya','Pahad Chiya','NP',3,'#1E5A43','#253E78'),
('palessie-mash','Palessie Mash','BY',3,'#E1A51D','#2778B7'),
('palma-dulce','Palma Dulce','CU',2,'#137C8B','#E9554D'),
('pamir-hydro-control','Pamir Hydro Control','TJ',3,'#082A53','#EBA222'),
('pamir-zafaran','Pamir Zafaran','AF',2,'#173A73','#E5A11A'),
('pampa-mate-fuego','Pampa Maté Fuego','AR',3,'#245A3B','#F06432'),
('pannon-thermal','Pannon Thermal','HU',4,'#8D1233','#F06B20'),
('paramaribo-bioresins','Paramaribo BioResins','SR',3,'#07563B','#D88A13'),
('paramaribo-river-screens','Paramaribo River Screens','SR',2,'#24113F','#F2B134'),
('paso-istmo','Paso Istmo','PA',3,'#1B4770','#E05248'),
('paywand-mobile','Paywand Mobile','AF',1,'#243A73','#D64D58'),
('pearl-gate-fintech','Pearl Gate Fintech','BH',4,'#0C1B35','#A86E3D'),
('pearl-of-africa-trails','Pearl of Africa Trails','UG',3,'#116530','#F2C230'),
('pelletteria-arno','Pelletteria Arno','IT',5,'#3A2722','#83916D'),
('penn-kreiz-crepes','Penn Kreiz Crêpes','FR',2,'#175E8C','#C84832'),
('pennine-loom-co','Pennine Loom Co.','GB',3,'#102A4C','#B54B32'),
('petrolove','Petrolove','VE',5,'#7A102F','#F2B84B'),
('pietra-energia','Pietra Energia','IT',4,'#B33A2B','#FFFFFF'),
('pietraluna','Pietraluna','IT',4,'#303336','#8D9A89'),
('pomodoro-vesuvio','Pomodoro Vesuvio','IT',2,'#C72C2C','#F0B343'),
('ponovo-alat','Ponovo Alat','BA',1,'#4B234F','#FFB38A'),
('port-vila-ferry-lines','Port Vila Ferry Lines','VU',2,'#0A2A5C','#F45B49'),
('portelan-de-alba','Porțelan de Alba','RO',3,'#1E4D8F','#C75B39'),
('prairie-biofoods','Prairie Biofoods','US',2,'#4D733D','#5DA9D6'),
('prakai','Prakai','TH',1,'#292A2D','#7638F4'),
('prespa-zimnica','Prespa Zimnica','MK',2,'#9A2F3E','#44724A'),
('prisma-sranan','Prisma Sranan','SR',2,'#40204F','#1CCAD8'),
('prix-fute','Prix Futé','BJ',2,'#C65A8E','#F1B44C'),
('puentes-de-aula','Puentes de Aula','GT',3,'#C85A34','#264F76'),
('pulpe-equateur','Pulpe Équateur','GA',2,'#24633F','#E2673C'),
('pura-cadencia-test-team','Pura Cadencia Test Team','CO',4,'#123B3A','#F5C84C'),
('pura-vida-wings','Pura Vida Wings','CR',3,'#087A4B','#F15B4A'),
('qartaj-optics','Qartaj Optics','TN',4,'#0E5265','#6D3BC0'),
('qhapaq-mail','Qhapaq Mail','PE',2,'#7E2F3E','#F0C95A'),
('quebec-nord-racing','Québec Nord Racing','CA',3,'#164C7B','#B9E4EA'),
('quipu-nube','Quipu Nube','PE',5,'#372A6A','#F09A3E'),
('quisqueya-bate','Quisqueya Bate','DO',3,'#0D315D','#F24A42'),
('quito-cable-transit','Quito Cable Transit','EC',2,'#183A5A','#F2C230'),
('raftar-brakes','Raftar Brakes','PK',4,'#1F2D31','#E34B3F'),
('rangsetu-telecom','RangSetu Telecom','IN',5,'#4D2D83','#D9447B'),
('ras-laffan-cryogenics','Ras Laffan Cryogenics','QA',5,'#4A0C38','#00B8EA'),
('recompra-tica','ReCompra Tica','CR',3,'#5A86E8','#CDE95A'),
('red-gum-renewables','Red Gum Renewables','AU',5,'#234E32','#D6A33A'),
('redterra-iron','Redterra Iron','AU',5,'#A8442D','#E6A34A'),
('redwood-circuits','Redwood Circuits','US',5,'#245C3A','#D9A441'),
('reef-cacao-belize','Reef & Cacao Belize','BZ',1,'#5A321E','#F16E45'),
('revontuli-kromi','Revontuli Kromi','FI',1,'#24272D','#62C7A0'),
('rheinwerk-messtechnik','Rheinwerk Messtechnik','DE',4,'#183042','#E28132'),
('rift-motion','Rift Motion','KE',4,'#161616','#D9A441'),
('rio-sur-credito','Río Sur Crédito','UY',2,'#16324F','#F2C84B'),
('riso-del-po','Riso del Po','IT',1,'#375D45','#9ED2E6'),
('riviera-viva','Riviera Viva','IT',2,'#008C95','#FFF4D6'),
('robusta-saigon-boost','Robusta Saigon Boost','VN',4,'#A42121','#65E6BA'),
('rose-valley-botanics','Rose Valley Botanics','BG',3,'#7A284D','#718A68'),
('saare-windworks','Saare Windworks','EE',3,'#17324D','#D7B56D'),
('saboun-nablus','Saboun Nablus','PS',3,'#708438','#2C6473'),
('sahel-colis','Sahel Colis','SN',2,'#176B55','#F2D05C'),
('sahm','Sahm','AE',5,'#40145F','#25D7D0'),
('saigon-street-kitchens','Saigon Street Kitchens','VN',5,'#B11226','#151515'),
('sainte-croix-automata','Sainte-Croix Automata','CH',2,'#543522','#267B78'),
('salar-rojo-litio','Salar Rojo Litio','CL',5,'#B54132','#27A8B0'),
('salinas-da-morabeza','Salinas da Morabeza','CV',2,'#168FA0','#E98A91'),
('salone-rutile','Salone Rutile','SL',2,'#7D4634','#2B8A7D'),
('samarqand-bearings','Samarqand Bearings','UZ',4,'#1B4E9B','#B96A3D'),
('sangha-timber-lab','Sangha Timber Lab','CG',2,'#174D36','#A95A35'),
('sangolink','SangoLink','CF',2,'#223A6A','#CE3E4E'),
('sardines-du-raz','Sardines du Raz','FR',3,'#0D3552','#E45C3A'),
('saryarqa-uran','Saryarqa Uran','KZ',5,'#183C45','#B9D93D'),
('sauna-sisu','Sauna Sisu','FI',3,'#123F56','#D75437'),
('savana-karite','Savana Karité','BF',2,'#6B4326','#79A64A'),
('savana-racing-project','Savana Racing Project','KE',2,'#284B35','#EACB70'),
('savonnerie-calanque','Savonnerie Calanque','FR',4,'#006D9C','#FF7657'),
('selat-microtech','Selat Microtech','MY',3,'#102E52','#F06F63'),
('serendib-bearings','Serendib Bearings','LK',4,'#4B276D','#27A998'),
('serendib-tea-spice','Serendib Tea & Spice','LK',4,'#073F2B','#A94E25'),
('seri-murni-foods','Seri Murni Foods','BN',3,'#155746','#D8A428'),
('serra-de-fogo','Serra de Fogo','BR',4,'#2D6A4F','#E9C46A'),
('serra-dourada-foods','Serra Dourada Foods','PT',2,'#3F6B3A','#FFF3D6'),
('seta-lario','Seta Lario','IT',4,'#173E49','#8EC8B8'),
('setouchi-marine','Setouchi Marine','JP',4,'#123A63','#E76F51'),
('sever-data','Sever Data','RU',5,'#152D4A','#49BCD0'),
('shannon-aeroworks','Shannon Aeroworks','IE',4,'#075B49','#B56B38'),
('shikkhar-alo','Shikkhar Alo','BD',4,'#2454A4','#F29A2E'),
('shire-tea','Shire Tea Cooperative','MW',1,'#145B3A','#D65D2F'),
('shqiponja-siguri','Shqiponja Siguri','AL',3,'#C72D38','#F4E9D6'),
('sialkot-apex-sports','Sialkot Apex Sports','PK',5,'#063C32','#D6FF3F'),
('siam-piezo','Siam Piezo','TH',1,'#7A1FA2','#FFD23F'),
('siam-wokline','Siam Wokline','TH',5,'#3A2145','#E84C3D'),
('sibaya-athletics','Sibaya Athletics','SZ',3,'#241C2A','#F1B62C'),
('sidr-al-wadi','Sidr Al-Wadi','YE',5,'#18203A','#8A3F2A'),
('sika-ahenfie','Sika Ahenfie','GH',4,'#1D553B','#D9AB35'),
('silesia-mine-rescue','Silesia Mine Rescue','PL',3,'#272A2D','#38AFC7'),
('silk-road-tea-volt','Silk Road Tea Volt','UZ',4,'#123B88','#F29A24'),
('simurgh-mehr-bank','Simurgh Mehr Bank','IR',5,'#6B2337','#159A9C'),
('sira-conseil','Sira Conseil','GN',3,'#3A276D','#2C9A85'),
('sodade-seguros','Sodade Seguros','CV',1,'#243B6B','#E66B52'),
('sokha-tuk','Sokha Tuk','KH',2,'#32255F','#20B7A7'),
('sol-del-sur','Sol del Sur','ES',3,'#D97706','#DC2626'),
('somon-altitude','Somon Altitude','TJ',2,'#4E2D68','#F05A45'),
('soramei-motors','Soramei Motors','JP',4,'#122A46','#E64A3B'),
('sorvolo','Sorvolo','IT',5,'#0D2D5B','#E52B32'),
('stella-caffe','Stella Caffè','IT',3,'#4B2E24','#FFF2D5'),
('steppe-current','Steppe Current','MN',4,'#152238','#D98A3A'),
('stoke-kilnware','Stoke Kilnware','GB',2,'#15418B','#BD5B38'),
('straits-ledger','Straits Ledger','SG',5,'#053B44','#F26B4A'),
('stupina-rautului','Stupina Răutului','MD',2,'#4A2438','#F4E3B1'),
('sudd-solar-water','Sudd Solar Water','SS',1,'#0755B5','#F1AA14'),
('sukkar-al-nil','Sukkar Al-Nil','SD',3,'#7B2748','#E2A62B'),
('suryavaan-motors','Suryavaan Motors','IN',2,'#6E243D','#187A78'),
('suva-hyperbaric-systems','Suva Hyperbaric Systems','FJ',3,'#082B45','#F28C28'),
('swapsika','SwapSika','GH',3,'#F04E98','#2D2A3C'),
('tadjoura-transit','Tadjoura Transit','DJ',3,'#0B3B68','#F0644B'),
('taedong-optical-works','Taedong Optical Works','KP',3,'#123F45','#D89D39'),
('taiga-photonics','Taiga Photonics','RU',4,'#075145','#7B2EF2'),
('takarda-sahel','Takarda Sahel','NE',1,'#395A48','#C75B3A'),
('talas','Talas','RS',2,'#4B174D','#CBB2F6'),
('talleres-pampeanos','Talleres Pampeanos','AR',3,'#183B5B','#E6A23C'),
('tanganyika-ember','Tanganyika Ember','BI',1,'#4A2B20','#26778A'),
('tassili-gaz','Tassili Gaz','DZ',5,'#31245C','#2EC4B6'),
('tatra-precision-bearings','Tatra Precision Bearings','SK',3,'#252C33','#A8D600'),
('tatran-akustika','Tatran Akustika','SK',3,'#16243B','#E8534F'),
('tejo-telecom','Tejo Telecom','PT',4,'#5B2C83','#35C5C8'),
('tena-lehulun','Tena Lehulun','ET',5,'#8C3045','#54B89A'),
('tenere-transports','Ténéré Transports','NE',2,'#E07832','#273F7A'),
('teranga-ocean','Teranga Océan','SN',4,'#00853F','#FDEF42'),
('terroirs-unis','Terroirs Unis','FR',1,'#496B3A','#D99A32'),
('thimphu-talking-stamps','Thimphu Talking Stamps','BT',2,'#7B1533','#4A2476'),
('thiri-motors','Thiri Motors','MM',3,'#9E2439','#F0A62B'),
('tico-hogar','Tico Hogar','CR',3,'#087E8B','#73A942'),
('tigris-ceramics','Tigris Ceramics','IQ',3,'#C15C32','#F2E7CE'),
('tirana-vertikal','Tirana Vertikal','AL',4,'#26343B','#176B87'),
('tiris-ore-logistics','Tiris Ore Logistics','MR',4,'#292827','#D4682D'),
('to-koura','Tô Koura','ML',2,'#3D3A72','#B95432'),
('tonle-loom','Tonlé Loom','KH',2,'#26356F','#B43E58'),
('toumai-pneus','Toumaï Pneus','TD',2,'#252A2E','#D9443F'),
('trazo-sport','Trazo Sport','ES',4,'#361A42','#ED513B'),
('triglav-parcel','Triglav Parcel','SI',3,'#174F63','#E6B94B'),
('tsubame-precision','Tsubame Precision','JP',5,'#202A33','#2F7F78'),
('tuas-gantry','Tuas Gantry','SG',5,'#0D2748','#F0442C'),
('tuff-kapital','Tuff Kapital','AM',4,'#C87554','#273B63'),
('tulipa-flora','Tulipa Flora','NL',3,'#E83F6F','#FFFFFF'),
('tulpar','Tulpar','KZ',3,'#123C46','#49C2E8'),
('tunis-panorama-cinemas','Tunis Panorama Cinemas','TN',3,'#151B3A','#A92E3A'),
('ubumba','Ubumba','BI',1,'#A6472D','#316B5B'),
('ubuntu-rail','Ubuntu Rail','ZA',5,'#007A78','#FFB81C'),
('uhuru-baobab-charge','Uhuru Baobab Charge','TZ',3,'#232C29','#22C8C5'),
('uji-midori','Uji Midori','JP',2,'#426B3A','#C99A3D'),
('umuhuza','Umuhuza','BI',1,'#155A78','#F06B45'),
('urbanride-mobility','UrbanRide Mobility','NL',3,'#1B998B','#FFFFFF'),
('uusring','UusRing','EE',4,'#7B70D6','#343743'),
('valais-avalanche-control','Valais Avalanche Control','CH',3,'#15344B','#F07A31'),
('vardar-copperworks','Vardar Copperworks','MK',2,'#641D32','#393B40'),
('vardar-fire-systems','Vardar Fire Systems','MK',3,'#B5242E','#15283A'),
('veivuke-viti','Veivuke Viti','FJ',4,'#086F79','#F16E5B'),
('vektor-balkan-sport','Vektor Balkan Sport','BG',3,'#17223A','#D93248'),
('vektoras-ratai','Vektoras Ratai','LT',4,'#173E52','#E6AD32'),
('veloce-motori','Veloce Motori','IT',5,'#C91432','#F6C453'),
('veloria-bank','Veloria Bank','BE',4,'#0D2B5C','#FFFFFF'),
('veloria-mobilites','Veloria Mobilités','FR',2,'#173F5F','#F2C94C'),
('vereda-nova-automoveis','Vereda Nova Automóveis','BR',3,'#14533B','#F2C84B'),
('vesterfjord-hydrogen','Vesterfjord Hydrogen','NO',5,'#071A3D','#F3F6F8'),
('vetro-laguna','Vetro Laguna','IT',3,'#006C78','#72D5CF'),
('via-brava','Vía Brava','ES',4,'#33383E','#B6222B'),
('visit-albanian-riviera','Visit Albanian Riviera','AL',2,'#D71920','#44C7C7'),
('visit-icelandic-highlands','Visit Icelandic Highlands','IS',4,'#172126','#47D17A'),
('visit-samarkand','Visit Samarkand','UZ',4,'#009EAD','#E8B33F'),
('vistula-no9','Vistula No.9','PL',4,'#173F5F','#C72C41'),
('viter-robotics','Viter Robotics','UA',5,'#135BC5','#1E222B'),
('viti-tideworks','Viti Tideworks','FJ',3,'#062E4F','#F06A5B'),
('volcan-energia','Volcán Energía','NI',3,'#24292C','#F4C542'),
('volna-strakhovanie','Volna Strakhovanie','RU',4,'#153B63','#4FA7C9'),
('volta-certa','Volta Certa','AO',3,'#6C4C9C','#FF906E'),
('vrh-recovery','Vrh Recovery','ME',3,'#244064','#60B7A2'),
('wadi-rum-horizons','Wadi Rum Horizons','JO',3,'#A4492F','#D9944D'),
('waha-event-power','Waha Event Power','LY',3,'#164F57','#E46A37'),
('wara-klin','Wara Klin','PG',1,'#116A78','#F0A642'),
('wend-moto','Wend Moto','BF',1,'#C73732','#17489A'),
('wend-panga-assurances','Wend-Panga Assurances','BF',1,'#327046','#B94C37'),
('werkspur-athletics','Werkspur Athletics','DE',5,'#17191D','#E2382F'),
('westlight-studios','Westlight Studios','US',4,'#2A1838','#E94F64'),
('windmill-foods','WindMill Foods','NL',2,'#204E5F','#FFFFFF'),
('woro-woro-mobilite','Wôrô-Wôrô Mobilité','CI',3,'#158247','#F4F1E8'),
('wouri-telecom','Wouri Télécom','CM',4,'#114B5F','#D94B3D'),
('xazar-dalga','Xəzər Dalğa','AZ',4,'#123E6A','#FF5A54'),
('xidig-badda','Xidig Badda','SO',1,'#087F88','#263238'),
('yukikaze-outdoor','Yukikaze Outdoor','JP',3,'#193B5A','#E84A3C'),
('yuzu-sento','Yuzu Sentō','JP',4,'#173B6C','#F2E85C'),
('zarafshon-air','Zarafshon Air','TJ',4,'#162C5B','#36B8D4'),
('zebu-routes','Zebu Routes','MG',2,'#2A7B45','#D42B2B'),
('zigni-asmara','Zigni Asmara','ER',1,'#8D3928','#16736E'),
('zlate-klasy','Zlaté Klasy','CZ',5,'#173B5C','#C6423B'),
('zomba-hydration','Zomba Hydration','MW',3,'#075D78','#E7A92F'),
('zviyo','Zviyo','ZW',2,'#7A3026','#244D45');
-- END REVIEWED LIBRARY SNAPSHOT

do $$
begin
  if exists(select 1 from secondary_library_snapshot snapshot
    join public.sponsors source on source.catalog_key=snapshot.catalog_key
    join public.countries country on country.id=source.country_id
    where source.name is distinct from snapshot.name or country.iso_alpha2 is distinct from snapshot.country_code) then
    raise exception 'La bibliothèque des sponsors a changé depuis la préparation de cette migration.';
  end if;
end;
$$;
insert into public.secondary_sponsor_catalog(
  country_id,slot_number,catalog_key,name,prestige,primary_color,accent_color,logo_variant,source_sponsor_id,available_for_offers
)
select source.country_id,null,'library-'||source.catalog_key,source.name,snapshot.prestige,
  snapshot.primary_color,snapshot.accent_color,'wordmark',source.id,source.status='active'
from secondary_library_snapshot snapshot join public.sponsors source using(catalog_key)
on conflict(source_sponsor_id) do update set name=excluded.name,catalog_key=excluded.catalog_key,
  prestige=excluded.prestige,primary_color=excluded.primary_color,accent_color=excluded.accent_color,
  available_for_offers=excluded.available_for_offers
where (secondary_sponsor_catalog.name,secondary_sponsor_catalog.catalog_key,secondary_sponsor_catalog.prestige,
  secondary_sponsor_catalog.primary_color,secondary_sponsor_catalog.accent_color,secondary_sponsor_catalog.available_for_offers)
  is distinct from (excluded.name,excluded.catalog_key,excluded.prestige,excluded.primary_color,excluded.accent_color,excluded.available_for_offers);

-- Retire only unsigned future clones. Their objectives stay attached for audit;
-- no active/planned signed agreement, reward, quota, result or payment changes.
update public.secondary_sponsor_offers offer set status='withdrawn'
from public.secondary_sponsor_catalog sponsor,public.seasons season
where offer.secondary_sponsor_id=sponsor.id and offer.target_season_id=season.id
  and offer.status='open' and season.status='planned' and sponsor.source_sponsor_id is null
  and not exists(select 1 from public.secondary_sponsor_contracts contract
    where contract.offer_id=offer.id or (contract.team_id=offer.team_id and contract.season_id=offer.target_season_id));

create function private.secondary_sponsor_primary_source(p_team_id uuid,p_season_id uuid)
returns uuid language sql stable security definer set search_path='' as $$
  select contract.sponsor_id from public.team_sponsor_contracts contract
  join public.seasons first_season on first_season.id=contract.start_season_id
  left join public.seasons last_season on last_season.id=contract.end_season_id
  join public.seasons target on target.id=p_season_id
  where contract.team_id=p_team_id and contract.role='principal' and contract.status in('planned','active')
    and target.game_year between first_season.game_year
      and coalesce(last_season.game_year,first_season.game_year+contract.contract_duration_seasons-1)
  order by first_season.game_year desc,(contract.status='planned') desc,contract.id limit 1;
$$;

create or replace function public.get_secondary_sponsor_offer_context(p_team_id uuid,p_target_season_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  with counts as (
    select rider.country_id,count(distinct rider.id)::integer as rider_count
    from public.rider_contracts contract
    join public.riders rider on rider.id=contract.rider_id and rider.status='active'
    join public.seasons first_season on first_season.id=contract.start_season_id
    join public.seasons last_season on last_season.id=contract.end_season_id
    join public.seasons active_season on active_season.status='active'
    where contract.team_id=p_team_id and contract.status='active'
      and active_season.game_year between first_season.game_year and last_season.game_year
    group by rider.country_id
  )
  select jsonb_build_object(
    'roster_size',coalesce(sum(rider_count),0)::integer,
    'roster_country_counts',coalesce(jsonb_object_agg(country_id::text,rider_count),'{}'::jsonb),
    'principal_country_id',private.secondary_sponsor_primary_country(p_team_id,p_target_season_id),
    'principal_sponsor_id',private.secondary_sponsor_primary_source(p_team_id,p_target_season_id),
    'principal_budget_per_season',private.secondary_sponsor_primary_budget(p_team_id,p_target_season_id)
  ) from counts;
$$;

-- Only the completeness/no-op check of the private V2 validator changes. All
-- locks, ownership, quota, race and reward validation remain byte-identical.
-- BEGIN REVIEWED LIBRARY COMPLETENESS GUARD
create or replace function private.replace_secondary_sponsor_offers_uncapped(
  p_director_id uuid, p_team_id uuid, p_target_season_id uuid, p_offers jsonb,
  p_generation_version integer default 2
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_director public.sporting_directors%rowtype;
  v_active public.seasons%rowtype;
  v_target public.seasons%rowtype;
  v_offer jsonb; v_goal jsonb; v_offer_id uuid; v_sponsor_country uuid; v_primary_country uuid;
  v_total integer; v_order integer;
begin
  select * into v_director from public.sporting_directors where id=p_director_id for update;
  if v_director is null or v_director.status <> 'active' or v_director.reputation_points<1500 then
    raise exception 'Directeur Sportif non éligible au sponsor secondaire.';
  end if;
  if not exists(select 1 from public.team_manager_assignments where team_id=p_team_id
    and sporting_director_id=p_director_id and role='general_manager' and status='active') then
    raise exception 'Cette équipe ne dépend pas de ce Directeur Sportif.';
  end if;
  select * into v_active from public.seasons where status='active' limit 1;
  select * into v_target from public.seasons where id=p_target_season_id;
  if v_target is null or v_target.status<>'planned' or v_target.game_year<>v_active.game_year+1
    or v_target.game_year<4 or coalesce(v_active.current_day_number,0)<21 then
    raise exception 'La saison des propositions secondaires est indisponible.';
  end if;
  if exists(select 1 from public.secondary_sponsor_contracts where team_id=p_team_id and season_id=p_target_season_id)
    or exists(select 1 from public.secondary_sponsor_offers where sporting_director_id=p_director_id
      and team_id=p_team_id and target_season_id=p_target_season_id and status='accepted') then return false; end if;
  if (select count(*) from public.secondary_sponsor_offers offer
    join public.secondary_sponsor_catalog sponsor on sponsor.id=offer.secondary_sponsor_id
    join public.sponsors source on source.id=sponsor.source_sponsor_id
    where offer.sporting_director_id=p_director_id and offer.team_id=p_team_id
      and offer.target_season_id=p_target_season_id and offer.status='open' and offer.generation_version>=3
      and sponsor.available_for_offers and source.status='active' and sponsor.country_id=source.country_id
      and source.id is distinct from private.secondary_sponsor_primary_source(p_team_id,p_target_season_id)
      and (select count(*) from public.secondary_sponsor_objectives objective where objective.offer_id=offer.id)
        >=case when sponsor.prestige>=5 then 5 when sponsor.prestige>=3 then 4 else 3 end)=3 then return false; end if;
  if coalesce(p_generation_version,0)<>2 or p_offers is null or jsonb_typeof(p_offers)<>'array' or jsonb_array_length(p_offers)<>3 then
    raise exception 'Trois propositions secondaires de version 2 sont requises.';
  end if;
  if (select count(distinct value->>'secondary_sponsor_id') from jsonb_array_elements(p_offers))<>3 then
    raise exception 'Les propositions doivent présenter trois partenaires distincts.';
  end if;
  v_primary_country:=private.secondary_sponsor_primary_country(p_team_id,p_target_season_id);
  select total_count into v_total from private.secondary_sponsor_roster_counts(p_team_id,v_active.id,null);
  delete from public.secondary_sponsor_offers where sporting_director_id=p_director_id and team_id=p_team_id
    and target_season_id=p_target_season_id and status='open';
  for v_offer in select value from jsonb_array_elements(p_offers) loop
    select country_id into v_sponsor_country from public.secondary_sponsor_catalog where id=(v_offer->>'secondary_sponsor_id')::uuid;
    if v_sponsor_country is null or (v_offer->'objectives') is null or jsonb_typeof(v_offer->'objectives')<>'array'
      or jsonb_array_length(v_offer->'objectives') not between 3 and 6 then
      raise exception 'La proposition secondaire est incomplète.';
    end if;
    if (select count(*) from jsonb_array_elements(v_offer->'objectives') goal
      where goal->>'objective_kind'='roster_nationality')>1 then
      raise exception 'Un seul objectif de contingent est autorisé par partenaire.';
    end if;
    insert into public.secondary_sponsor_offers(sporting_director_id,team_id,target_season_id,secondary_sponsor_id,generation_version,principal_country_id)
      values(p_director_id,p_team_id,p_target_season_id,(v_offer->>'secondary_sponsor_id')::uuid,2,v_primary_country) returning id into v_offer_id;
    v_order:=0;
    for v_goal in select value from jsonb_array_elements(v_offer->'objectives') loop
      v_order:=v_order+1;
      if coalesce((v_goal->>'cash_reward')::numeric,0)<=0 or (v_goal->>'cash_reward')::numeric>5000000
        or coalesce((v_goal->>'reputation_penalty')::numeric,0) not between 0 and 1000 then
        raise exception 'La prime ou le risque secondaire est invalide.';
      end if;
      if coalesce(v_goal->>'objective_kind','race_result')='roster_nationality' then
        if (v_goal->>'target_country_id')::uuid is distinct from v_sponsor_country
          or v_primary_country is null or v_primary_country=v_sponsor_country
          or coalesce((v_goal->>'required_rider_count')::integer,0) not between 1 and floor(v_total*0.10)::integer then
          raise exception 'L’objectif de nationalité doit différer du sponsor principal et rester dans 10 %% de l’effectif professionnel.';
        end if;
        insert into public.secondary_sponsor_objectives(offer_id,display_order,objective_kind,target_country_id,required_rider_count,current_rider_count,cash_reward,reputation_penalty)
          values(v_offer_id,v_order,'roster_nationality',v_sponsor_country,(v_goal->>'required_rider_count')::smallint,
            (select country_count from private.secondary_sponsor_roster_counts(p_team_id,v_active.id,v_sponsor_country)),
            (v_goal->>'cash_reward')::numeric,coalesce((v_goal->>'reputation_penalty')::numeric,0));
      elsif coalesce(v_goal->>'objective_kind','race_result')='race_result' then
        if not exists(select 1 from public.race_editions where id=(v_goal->>'race_edition_id')::uuid
          and season_id=p_target_season_id and status<>'cancelled') then
          raise exception 'La course proposée ne correspond pas à la saison du contrat.';
        end if;
        insert into public.secondary_sponsor_objectives(offer_id,display_order,race_edition_id,race_slug,race_label,race_category_code,target_rank,cash_reward,reputation_penalty)
          values(v_offer_id,v_order,(v_goal->>'race_edition_id')::uuid,v_goal->>'race_slug',v_goal->>'race_label',
            v_goal->>'race_category_code',(v_goal->>'target_rank')::smallint,(v_goal->>'cash_reward')::numeric,
            coalesce((v_goal->>'reputation_penalty')::numeric,0));
      else raise exception 'Ce type d’objectif secondaire n’est pas pris en charge.';
      end if;
    end loop;
  end loop;
  return true;
end;
$$;
-- END REVIEWED LIBRARY COMPLETENESS GUARD

create function private.guard_secondary_sponsor_offer_library()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status in('open','accepted') and not exists(
    select 1 from public.secondary_sponsor_catalog sponsor
    join public.sponsors source on source.id=sponsor.source_sponsor_id
    where sponsor.id=new.secondary_sponsor_id and sponsor.available_for_offers and source.status='active'
      and sponsor.country_id=source.country_id and sponsor.source_sponsor_id is distinct from
        private.secondary_sponsor_primary_source(new.team_id,new.target_season_id)
  ) then raise exception 'Cette proposition ne correspond plus à une marque disponible. Actualisez les offres.'; end if;
  return new;
end;
$$;
create trigger guard_secondary_sponsor_offer_library before insert or update of status,secondary_sponsor_id
  on public.secondary_sponsor_offers for each row execute function private.guard_secondary_sponsor_offer_library();

-- Delegate unchanged economic and quota validation to the already reviewed V2
-- implementation. All three identities and the final generation are checked
-- inside this same transaction and the existing director/budget locks.
alter function public.replace_secondary_sponsor_offers(uuid,uuid,uuid,jsonb,integer) set schema private;
alter function private.replace_secondary_sponsor_offers(uuid,uuid,uuid,jsonb,integer) rename to replace_secondary_sponsor_offers_budgeted;
revoke all on function private.replace_secondary_sponsor_offers_budgeted(uuid,uuid,uuid,jsonb,integer) from public,anon,authenticated,service_role;
create function public.replace_secondary_sponsor_offers(
  p_director_id uuid,p_team_id uuid,p_target_season_id uuid,p_offers jsonb,p_generation_version integer default 3
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_changed boolean;
begin
  if coalesce(p_generation_version,0)<>3 or p_offers is null or jsonb_typeof(p_offers)<>'array'
    or jsonb_array_length(p_offers)<>3 then
    raise exception 'Trois propositions secondaires de la bibliothèque sont requises.';
  end if;
  if (select count(distinct sponsor.source_sponsor_id)
    from jsonb_array_elements(p_offers) proposal
    join public.secondary_sponsor_catalog sponsor on sponsor.id=(proposal->>'secondary_sponsor_id')::uuid
    join public.sponsors source on source.id=sponsor.source_sponsor_id
    where sponsor.available_for_offers and source.status='active' and sponsor.country_id=source.country_id
      and source.id is distinct from private.secondary_sponsor_primary_source(p_team_id,p_target_season_id))<>3 then
    raise exception 'Les propositions doivent présenter trois marques distinctes de la bibliothèque, différentes du sponsor principal.';
  end if;
  v_changed:=private.replace_secondary_sponsor_offers_budgeted(p_director_id,p_team_id,p_target_season_id,p_offers,2);
  if v_changed then
    update public.secondary_sponsor_offers set generation_version=3
    where sporting_director_id=p_director_id and team_id=p_team_id and target_season_id=p_target_season_id
      and status='open' and generation_version<>3;
  end if;
  return v_changed;
end;
$$;
revoke all on function public.replace_secondary_sponsor_offers(uuid,uuid,uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.replace_secondary_sponsor_offers(uuid,uuid,uuid,jsonb,integer) to service_role;

alter function public.sign_secondary_sponsor_offer(uuid) set schema private;
alter function private.sign_secondary_sponsor_offer(uuid) rename to sign_secondary_sponsor_offer_budgeted;
revoke all on function private.sign_secondary_sponsor_offer_budgeted(uuid) from public,anon,authenticated,service_role;
create function public.sign_secondary_sponsor_offer(p_offer_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.secondary_sponsor_offers offer
    join public.sporting_directors director on director.id=offer.sporting_director_id
    join public.secondary_sponsor_catalog sponsor on sponsor.id=offer.secondary_sponsor_id
    join public.sponsors source on source.id=sponsor.source_sponsor_id
    where offer.id=p_offer_id and offer.status='open' and offer.generation_version>=3
      and director.auth_user_id=auth.uid() and director.status='active'
      and sponsor.available_for_offers and source.status='active'
      and source.id is distinct from private.secondary_sponsor_primary_source(offer.team_id,offer.target_season_id)) then
    raise exception 'Cette proposition ne correspond plus à une marque disponible. Actualisez les offres.';
  end if;
  return private.sign_secondary_sponsor_offer_budgeted(p_offer_id);
end;
$$;
revoke all on function public.sign_secondary_sponsor_offer(uuid) from public,anon;
grant execute on function public.sign_secondary_sponsor_offer(uuid) to authenticated;

revoke all on function private.guard_secondary_sponsor_library_identity() from public,anon,authenticated,service_role;
revoke all on function private.guard_sponsor_library_country() from public,anon,authenticated,service_role;
revoke all on function private.sync_secondary_sponsor_library_identity() from public,anon,authenticated,service_role;
revoke all on function private.secondary_sponsor_primary_source(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.guard_secondary_sponsor_offer_library() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
