begin;
set local lock_timeout='500ms';
set local statement_timeout='5s';

-- Approved private pilot catalogue; no gifts or wallet changes at installation.
insert into public.christmas_catalog(id,name,category,slot,price,max_obtained,source,effect) values
('lueurs-velodrome','Lueurs du vélodrome','portrait','fond',70,1,null,'{"id":"lueurs-velodrome","name":"Lueurs du vélodrome","category":"portrait","slot":"fond","price":70,"description":"Une piste enneigée, éclairée par les guirlandes du dernier virage.","effect":"Fond de portrait à équiper dans la garde-robe.","limit":1,"art":"lueurs-velodrome","delivery":{"kind":"cosmetic"}}'::jsonb),
('bonnet-relais','Bonnet du dernier relais','portrait','chapeau',55,1,null,'{"id":"bonnet-relais","name":"Bonnet du dernier relais","category":"portrait","slot":"chapeau","price":55,"description":"Un bonnet rouge à pompon blanc, posé sur le portrait du DS.","effect":"Chapeau à équiper dans la garde-robe.","limit":1,"art":"bonnet-relais","delivery":{"kind":"cosmetic"}}'::jsonb),
('tenue-facteur','Maillot du facteur des neiges','portrait','tenue',140,1,null,'{"id":"tenue-facteur","name":"Maillot du facteur des neiges","category":"portrait","slot":"tenue","price":140,"description":"Le maillot bordeaux du renne livreur, avec ses poches à cadeaux et son col en laine.","effect":"Tenue à équiper dans la garde-robe.","limit":1,"art":"tenue-facteur","delivery":{"kind":"cosmetic"}}'::jsonb),
('cache-cou-renne','Cache-cou nez rouge','portrait','masque',60,1,null,'{"id":"cache-cou-renne","name":"Cache-cou nez rouge","category":"portrait","slot":"masque","price":60,"description":"Un tour de cou de rouleur, avec un petit nez de renne brodé.","effect":"Masque à équiper dans la garde-robe.","limit":1,"art":"cache-cou-renne","delivery":{"kind":"cosmetic"}}'::jsonb),
('lunettes-givre','Lunettes de descente givrées','portrait','lunettes',80,1,null,'{"id":"lunettes-givre","name":"Lunettes de descente givrées","category":"portrait","slot":"lunettes","price":80,"description":"Verres dorés et une frange de givre sur la monture.","effect":"Lunettes à équiper dans la garde-robe.","limit":1,"art":"lunettes-givre","delivery":{"kind":"cosmetic"}}'::jsonb),
('couronne-rayons','Couronne de rayons','portrait','cadre',100,1,null,'{"id":"couronne-rayons","name":"Couronne de rayons","category":"portrait","slot":"cadre","price":100,"description":"Une couronne de sapin tressée sur une roue de vélo, avec un nœud rouge.","effect":"Cadre à équiper dans la garde-robe.","limit":1,"art":"couronne-rayons","delivery":{"kind":"cosmetic"}}'::jsonb),
('fond-neige','La vallée sous la neige','portrait','fond',85,1,null,'{"id":"fond-neige","name":"La vallée sous la neige","category":"portrait","slot":"fond","price":85,"description":"Des sapins enneigés, un ciel de décembre et les lumières du village.","effect":"Fond de portrait à équiper dans la garde-robe.","limit":1,"art":"fond-neige","delivery":{"kind":"cosmetic"}}'::jsonb),
('couronne-noel','Couronne de Noël','portrait','chapeau',75,1,null,'{"id":"couronne-noel","name":"Couronne de Noël","category":"portrait","slot":"chapeau","price":75,"description":"Une couronne de branches fraîches, de houx et de petites baies rouges.","effect":"Couronne à porter sur la tête du DS.","limit":1,"art":"couronne-noel","delivery":{"kind":"cosmetic"}}'::jsonb),
('barbe-pere-noel','Barbe du Père Noël','portrait','masque',65,1,null,'{"id":"barbe-pere-noel","name":"Barbe du Père Noël","category":"portrait","slot":"masque","price":65,"description":"Une longue barbe blanche et sa moustache, pour assurer la tournée.","effect":"Barbe à équiper sur le portrait du DS.","limit":1,"art":"barbe-pere-noel","delivery":{"kind":"cosmetic"}}'::jsonb),
('tenue-pere-noel','Manteau du Père Noël','portrait','tenue',130,1,null,'{"id":"tenue-pere-noel","name":"Manteau du Père Noël","category":"portrait","slot":"tenue","price":130,"description":"Le manteau rouge, ses revers de fourrure et sa boucle dorée.","effect":"Tenue à équiper dans la garde-robe.","limit":1,"art":"tenue-pere-noel","delivery":{"kind":"cosmetic"}}'::jsonb),
('tenue-lutin','Veste du chef des lutins','portrait','tenue',105,1,null,'{"id":"tenue-lutin","name":"Veste du chef des lutins","category":"portrait","slot":"tenue","price":105,"description":"Une veste vert sapin, un col à pointes et des boutons dorés.","effect":"Tenue à équiper dans la garde-robe.","limit":1,"art":"tenue-lutin","delivery":{"kind":"cosmetic"}}'::jsonb),
('bois-renne','Bois du renne de tête','portrait','chapeau',70,1,null,'{"id":"bois-renne","name":"Bois du renne de tête","category":"portrait","slot":"chapeau","price":70,"description":"Un serre-tête à bois de renne, avec ses grelots de cuivre.","effect":"Accessoire de tête à équiper dans la garde-robe.","limit":1,"art":"bois-renne","delivery":{"kind":"cosmetic"}}'::jsonb),
('halo-etoiles','Guirlande des étoiles','portrait','cadre',95,1,null,'{"id":"halo-etoiles","name":"Guirlande des étoiles","category":"portrait","slot":"cadre","price":95,"description":"Un cercle de petites lumières chaudes autour du portrait.","effect":"Cadre lumineux à équiper dans la garde-robe.","limit":1,"art":"halo-etoiles","delivery":{"kind":"cosmetic"}}'::jsonb),
('avent-bonnet-constellation','Bonnet de la nuit étoilée','portrait','chapeau',null,1,'avent','{"id":"avent-bonnet-constellation","name":"Bonnet de la nuit étoilée","category":"portrait","slot":"chapeau","source":"avent","description":"Exclusivité de l’Avent · Un bonnet bleu nuit brodé d’étoiles dorées, avec son revers argenté.","effect":"Cosmétique exclusif du calendrier de l’Avent. Chapeau à équiper sur ton portrait.","limit":1,"art":"avent-bonnet-constellation","delivery":{"kind":"cosmetic"}}'::jsonb),
('avent-nuit-lanternes','La nuit des lanternes','portrait','fond',null,1,'avent','{"id":"avent-nuit-lanternes","name":"La nuit des lanternes","category":"portrait","slot":"fond","source":"avent","description":"Exclusivité de l’Avent · Des lanternes ambrées éclairent les chalets dans une neige rose et mauve.","effect":"Cosmétique exclusif du calendrier de l’Avent. Fond à équiper sur ton portrait.","limit":1,"art":"avent-nuit-lanternes","delivery":{"kind":"cosmetic"}}'::jsonb),
('avent-echarpe-pain-epices','Écharpe de pain d’épices','portrait','masque',null,1,'avent','{"id":"avent-echarpe-pain-epices","name":"Écharpe de pain d’épices","category":"portrait","slot":"masque","source":"avent","description":"Exclusivité de l’Avent · Une écharpe cannelle à broderies crème et un petit bonhomme en pain d’épices.","effect":"Cosmétique exclusif du calendrier de l’Avent. Écharpe à équiper à l’emplacement Masque.","limit":1,"art":"avent-echarpe-pain-epices","delivery":{"kind":"cosmetic"}}'::jsonb),
('avent-manteau-casse-noisette','Manteau du Casse-Noisette','portrait','tenue',null,1,'avent','{"id":"avent-manteau-casse-noisette","name":"Manteau du Casse-Noisette","category":"portrait","slot":"tenue","source":"avent","description":"Exclusivité de l’Avent · Une veste bleu paon à brandebourgs dorés et épaulettes bordeaux.","effect":"Cosmétique exclusif du calendrier de l’Avent. Tenue à équiper sur ton portrait.","limit":1,"art":"avent-manteau-casse-noisette","delivery":{"kind":"cosmetic"}}'::jsonb),
('avent-cadre-givre','Dentelle de givre','portrait','cadre',null,1,'avent','{"id":"avent-cadre-givre","name":"Dentelle de givre","category":"portrait","slot":"cadre","source":"avent","description":"Exclusivité de l’Avent · Des cristaux argentés et des flocons ciselés dessinent une couronne de glace.","effect":"Cosmétique exclusif du calendrier de l’Avent. Cadre à équiper autour de ton portrait.","limit":1,"art":"avent-cadre-givre","delivery":{"kind":"cosmetic"}}'::jsonb),
('cadre-grand-sapin','Couronne du Grand Sapin','portrait','cadre',null,1,'sapin','{"id":"cadre-grand-sapin","name":"Couronne du Grand Sapin","category":"portrait","slot":"cadre","source":"sapin","description":"Des branches givrées, un grand nœud rouge et l’étoile du sapin collectif.","effect":"Cadre exclusif obtenu en illuminant le Grand Sapin.","limit":1,"art":"cadre-grand-sapin","delivery":{"kind":"cosmetic"}}'::jsonb),
('tenue-aurore','Tenue de l’aurore boréale','portrait','tenue',null,1,'sapin','{"id":"tenue-aurore","name":"Tenue de l’aurore boréale","category":"portrait","slot":"tenue","source":"sapin","description":"Une veste bleu nuit brodée de lumières vertes et violettes.","effect":"Tenue exclusive obtenue en illuminant le Grand Sapin.","limit":1,"art":"tenue-aurore","delivery":{"kind":"cosmetic"}}'::jsonb),
('boussole-polaire','Boussole de l’étoile polaire','gestion',null,135,null,null,'{"id":"boussole-polaire","name":"Boussole de l’étoile polaire","category":"gestion","price":135,"description":"Pendant une semaine, les scouts de l’équipe disposent d’un réseau prioritaire.","effect":"+20 % de qualité de scouting pendant 7 jours. Une nouvelle utilisation ajoute 7 jours à la durée restante ; le bonus reste à +20 %.","useKind":"scouting","backendRewardKey":"scouting-week-20","art":"boussole-polaire","delivery":{"kind":"daily_reward","key":"scouting-week-20"}}'::jsonb),
('carnet-eclaireur','Carnet de l’éclaireur','gestion',null,110,null,null,'{"id":"carnet-eclaireur","name":"Carnet de l’éclaireur","category":"gestion","price":110,"description":"Le préparateur rassemble deux étapes d’un même tour dans la même mission.","effect":"Une reconnaissance prépare deux étapes choisies du même tour, pour les mêmes coureurs inscrits. Les deux étapes sont choisies avant la réservation.","useKind":"reconnaissance","art":"carnet-eclaireur","delivery":{"kind":"wallet_item"}}'::jsonb),
('lunette-sniper-cadeaux','Lunette de sniper de cadeaux','gestion',null,10,null,null,'{"id":"lunette-sniper-cadeaux","name":"Lunette de sniper de cadeaux","category":"gestion","price":10,"description":"Rudolphe peut garder les yeux sur sa tournée : les cadeaux partent quand le viseur est aligné, pendant une seule tournée.","effect":"Débloque le lancer automatique pour une tournée, sur PC comme sur téléphone. Un exemplaire est consommé au décollage uniquement si l’option est activée. Le vent et la trajectoire restent inchangés. Une tournée abandonnée utilise aussi sa lunette.","useKind":"sniper","art":"lunette-sniper-cadeaux","delivery":{"kind":"wallet_item"}}'::jsonb),
('grelot-repechage','Second tour du traîneau','gestion',null,65,null,null,'{"id":"grelot-repechage","name":"Second tour du traîneau","category":"gestion","price":65,"description":"Un grelot de secours pour ajouter une nouvelle tournée à ta journée.","effect":"Autorise une tournée récompensée supplémentaire le même jour. Son score, tous ses Grelots et toutes ses lumières s’ajoutent aux tournées précédentes, même si le résultat est moins bon. Un objet par tournée supplémentaire.","useKind":"retry","art":"grelot-repechage","delivery":{"kind":"wallet_item"}}'::jsonb),
('personality-reroll','Nouveau chapitre','gestion',null,150,null,null,'{"id":"personality-reroll","name":"Nouveau chapitre","category":"gestion","price":150,"description":"Un moment pour se réinventer, loin des habitudes du peloton.","effect":"Remplace définitivement le caractère d’un coureur de ton choix par un autre caractère aléatoire. Le caractère actuel est exclu du tirage ; les autres ont tous la même chance. Les notes, le moral et les talents restent inchangés.","useKind":"personality","backendItemKey":"personality-reroll","art":"personality-reroll","delivery":{"kind":"inventory_item","key":"personality-reroll"}}'::jsonb),
('talent-revealed','Talent révélé','gestion',null,null,null,'sapin','{"id":"talent-revealed","name":"Talent révélé","category":"gestion","source":"sapin","description":"Un talent se révèle à mi-chemin de l’étoile du Peloton.","effect":"Débloque un talent permanent au choix pour un coureur de ton équipe. Un talent déjà acquis ne peut pas être choisi à nouveau. L’objet est conservé si aucun nouveau talent ne peut être attribué.","useKind":"special-ability","backendItemKey":"talent-revealed","art":"talent-revealed","delivery":{"kind":"daily_reward","key":"talent-revealed"}}'::jsonb),
('hotte-doublons','Hotte à double fond','collection',null,95,null,null,'{"id":"hotte-doublons","name":"Hotte à double fond","category":"collection","price":95,"description":"Échange trois exemplaires Argent en double contre une carte Argent S4 que tu n’as pas.","effect":"Échange 3 doublons Argent de l’album S4 contre 1 carte Argent que tu n’as pas. Tu gardes au moins un exemplaire de chaque carte donnée. La hotte est conservée si les trois doublons ou une carte Argent manquante ne sont pas disponibles.","useKind":"silver-trade","art":"hotte-doublons","delivery":{"kind":"wallet_item"}}'::jsonb),
('booster-noel','Booster du réveillon','collection',null,90,null,null,'{"id":"booster-noel","name":"Booster du réveillon","category":"collection","price":90,"description":"Deux cartes Cyclo-Stickers S4, avec les probabilités habituelles de l’album.","effect":"Un booster de 2 cartes de l’album S4. Pour chaque carte, probabilités habituelles : 80 % Bronze, 16,9 % Argent, 3 % Or et 0,1 % Hors Série. Des doublons sont possibles.","useKind":"booster","albumEditionId":"cyclo-stickers-s5-s4-final-v1","art":"booster-noel","delivery":{"kind":"collector_booster","editionId":"cyclo-stickers-s5-s4-final-v1"}}'::jsonb),
('vignette-renne','Vignette surprise du réveillon','collection',null,115,null,null,'{"id":"vignette-renne","name":"Vignette surprise du réveillon","category":"collection","price":115,"description":"Une vignette rare S4 au hasard : 10 % Hors Série, 20 % Or et 70 % Argent. Doublon possible.","effect":"Une vignette rare au hasard dans l’album S4 : 10 % Hors Série, 20 % Or et 70 % Argent. Le tirage peut donner une carte déjà possédée.","useKind":"sticker","rarityOdds":{"holographic":10,"gold":20,"silver":70},"albumEditionId":"cyclo-stickers-s5-s4-final-v1","art":"vignette-renne","delivery":{"kind":"wallet_item"}}'::jsonb),
('bonnet-course-noel','Bonnet de course de Noël','equipment',null,null,null,'contribution','{"id":"bonnet-course-noel","name":"Bonnet de course de Noël","category":"equipment","source":"contribution","equipmentSlot":"helmet","description":"Un casque de course rouge habillé d’un revers de laine et d’un pompon de Noël. Le cadeau des contributeurs classés 4e à 6e.","effect":"Équipement de coureur · Casque · +2 en montagne et +2 en résistance. Conservé après l’événement. Il remplace le casque du coureur équipé, sans se cumuler avec lui.","bonuses":{"mountain":2,"resistance":2},"useKind":"equipment","art":"bonnet-course-noel","delivery":{"kind":"equipment","key":"christmas-2026-bonnet-course-noel"}}'::jsonb),
('potential-notebook','Carnet de progression','gestion',null,null,null,'sapin','{"id":"potential-notebook","name":"Carnet de progression","category":"gestion","source":"sapin","description":"Le consommable existant qui ouvre une nouvelle marge de progression à un coureur.","effect":"Ajoute définitivement 1 étoile de potentiel à un coureur de 3 étoiles ou moins, sans dépasser 4 étoiles. Aucun objet n’est consommé si l’étoile entière ne peut pas être appliquée.","useKind":"potential","backendItemKey":"potential-notebook","effectPayload":{"potentialBonus":1},"art":"potential-notebook","delivery":{"kind":"inventory_item","key":"potential-notebook"}}'::jsonb),
('cuissard-quatre-saisons','Cuissard Quatre Saisons','equipment',null,null,null,'contribution','{"id":"cuissard-quatre-saisons","name":"Cuissard Quatre Saisons","category":"equipment","source":"contribution","equipmentSlot":"bib_shorts","description":"Ignore les malus de notes liés à la météo","effect":"Ignore les malus de notes liés à la météo","bonuses":{},"effects":{"ignoreWeatherPenalties":true},"useKind":"equipment","art":"cuissard-quatre-saisons","delivery":{"kind":"equipment","key":"christmas-2026-cuissard-quatre-saisons"}}'::jsonb),
('cadre-traineau-renne','Traîneau du renne en danseuse','equipment',null,null,null,'contribution','{"id":"cadre-traineau-renne","name":"Traîneau du renne en danseuse","category":"equipment","source":"contribution","equipmentSlot":"frame","description":"+3 END / RES / REC · +2 MON","effect":"+3 END / RES / REC · +2 MON","bonuses":{"endurance":3,"resistance":3,"recovery":3,"mountain":2},"effects":{},"useKind":"equipment","art":"cadre-traineau-renne","delivery":{"kind":"equipment","key":"christmas-2026-cadre-traineau-renne"}}'::jsonb),
('gants-dernier-relais','Gants du dernier relais','equipment',null,null,null,'contribution','{"id":"gants-dernier-relais","name":"Gants du dernier relais","category":"equipment","source":"contribution","equipmentSlot":"gloves","description":"+1 END · +1 REC","effect":"+1 END · +1 REC","bonuses":{"endurance":1,"recovery":1},"effects":{},"useKind":"equipment","art":"gants-dernier-relais","delivery":{"kind":"equipment","key":"christmas-2026-gants-dernier-relais"}}'::jsonb);
insert into public.christmas_advent(day,title,description,coins,item_id) values
(1,'Départ du vélodrome','Le premier cadeau attend sous la ligne de départ.',35,null),
(2,'Le petit braquet','De quoi prendre son élan vers la boutique.',15,null),
(3,'Le bonnet des étoiles','Ton premier cosmétique exclusif de l’Avent : le Bonnet de la nuit étoilée.',0,'avent-bonnet-constellation'),
(4,'La roue de secours','Une poche de grelots était restée dans la sacoche.',15,null),
(5,'Les éclaireurs polaires','Une boussole pour renforcer la qualité de scouting pendant sept jours.',0,'boussole-polaire'),
(6,'La table de fartage','Un petit lot caché sous les chiffons de l’atelier.',15,null),
(7,'La nuit des lanternes','Un fond de portrait exclusif de l’Avent, entre lanternes ambrées et neige mauve.',0,'avent-nuit-lanternes'),
(8,'Le virage des sapins','Les bénévoles vous ont gardé quelques grelots.',20,null),
(9,'Le grelot de secours','Un Second tour du traîneau : une nouvelle tournée dont tous les gains s’ajoutent à ceux du jour.',0,'grelot-repechage'),
(10,'Au pied du col','Le ravitaillement est arrivé avant la neige.',20,null),
(11,'L’odeur du pain d’épices','Une écharpe brodée, exclusive de l’Avent, pour ton portrait.',0,'avent-echarpe-pain-epices'),
(12,'La pause à l’atelier','Le mécanicien a trouvé un grelot sous l’établi. Et vingt-quatre autres derrière.',25,null),
(13,'Le sachet du facteur','Un booster de deux cartes de l’album Cyclo-Stickers S4.',0,'booster-noel'),
(14,'Un tour de piste','Le petit bonus du dernier passage sous les lampes.',20,null),
(15,'Deux étapes à reconnaître','Le préparateur a laissé son carnet dans votre sacoche.',0,'carnet-eclaireur'),
(16,'Le col dégagé','Le chasse-neige a libéré la route et la caisse du ravitaillement.',20,null),
(17,'La hotte des doublons','Une Hotte à double fond pour échanger trois doublons Argent contre une Argent manquante.',0,'hotte-doublons'),
(18,'La parade du Casse-Noisette','Une veste de fête à brandebourgs dorés, exclusive de l’Avent.',0,'avent-manteau-casse-noisette'),
(19,'Sur les pavés gelés','Les grelots du vélo ont laissé quelques pièces en chemin.',20,null),
(20,'La carte du retour','Une vignette rare S4 au hasard : 10 % Hors Série, 20 % Or et 70 % Argent. Doublon possible.',0,'vignette-renne'),
(21,'Les cartes sous le sapin','Un sachet de Noël à ouvrir pour l’album Cyclo-Stickers.',0,'booster-noel'),
(22,'Le dernier faux plat','Les lutins ont préparé un ravitaillement avant la dernière tournée.',25,null),
(23,'La veillée des DS','Des grelots pour choisir un dernier objet à la boutique.',35,null),
(24,'La dentelle du réveillon','Le dernier cosmétique exclusif de l’Avent : un cadre de cristaux et de flocons argentés.',0,'avent-cadre-givre');
insert into public.christmas_milestones(goal,title,coins,items) values
(500,'La première lueur',25,'[]'::jsonb),
(1500,'Le village s’éveille',40,'[]'::jsonb),
(3500,'Le relais des bonnets',0,'["bonnet-relais"]'::jsonb),
(6500,'Des cartes sous le sapin',60,'["booster-noel"]'::jsonb),
(10000,'La couronne du Peloton',0,'["cadre-grand-sapin","talent-revealed"]'::jsonb),
(14000,'Les éclaireurs polaires',0,'["boussole-polaire","carnet-eclaireur","personality-reroll"]'::jsonb),
(19000,'L’aurore des champions',0,'["tenue-aurore"]'::jsonb),
(23500,'La hotte précieuse',0,'["booster-noel","booster-noel","vignette-renne","vignette-renne"]'::jsonb),
(28000,'L’étoile du Peloton',0,'["potential-notebook"]'::jsonb);
insert into public.christmas_contributor_prizes(rank_from,rank_to,item_id) values
(1,1,'cuissard-quatre-saisons'),
(2,3,'cadre-traineau-renne'),
(4,6,'bonnet-course-noel'),
(7,10,'gants-dernier-relais');
insert into public.equipment_catalog_items(catalog_key,name,slot_type,supplier_key,supplier_name,description,price,rarity,status,image_path,effect_summary,effect_payload,acquisition_channel) values
('christmas-2026-cuissard-quatre-saisons','Cuissard Quatre Saisons','bib_shorts','christmas-2026','Le Peloton de Noël','Ignore les malus de notes liés à la météo',0,'premium','active','/images/equipment/christmas/bib-shorts.svg','Ignore les malus de notes liés à la météo','{"ignoreWeatherPenalties":true,"ratingBonuses":{}}'::jsonb,'event_reward'),
('christmas-2026-cadre-traineau-renne','Traîneau du renne en danseuse','frame','christmas-2026','Le Peloton de Noël','+3 END / RES / REC · +2 MON',0,'premium','active','/images/equipment/christmas/frame.svg','+3 END / RES / REC · +2 MON','{"ratingBonuses":{"endurance":3,"resistance":3,"recovery":3,"mountain":2}}'::jsonb,'event_reward'),
('christmas-2026-bonnet-course-noel','Bonnet de course de Noël','helmet','christmas-2026','Le Peloton de Noël','+2 MON · +2 RES',0,'premium','active','/images/equipment/christmas/helmet.svg','+2 MON · +2 RES','{"ratingBonuses":{"mountain":2,"resistance":2}}'::jsonb,'event_reward'),
('christmas-2026-gants-dernier-relais','Gants du dernier relais','gloves','christmas-2026','Le Peloton de Noël','+1 END · +1 REC',0,'premium','active','/images/equipment/christmas/gloves.svg','+1 END · +1 REC','{"ratingBonuses":{"endurance":1,"recovery":1}}'::jsonb,'event_reward') on conflict(catalog_key) do nothing;

-- Gifts use their own provenance, preserving every pre-existing inventory source.
alter table public.daily_reward_inventory add column source_christmas_grant_id uuid;
alter table public.daily_reward_inventory add constraint daily_reward_inventory_christmas_source_fk
 foreign key(source_christmas_grant_id) references public.christmas_grants(id) on delete restrict not valid;
create index daily_reward_christmas_grant_idx on public.daily_reward_inventory(source_christmas_grant_id) where source_christmas_grant_id is not null;
alter table public.daily_reward_inventory drop constraint daily_reward_inventory_exactly_one_source;
alter table public.daily_reward_inventory add constraint daily_reward_inventory_exactly_one_source check (
 num_nonnulls(source_claim_id,source_referral_reward_id,source_auction_compensation_id,
 source_longevity_trophy_reward_id,source_international_selection_compensation_id,
 source_race_incident_compensation_id,source_season_gala_reward_id,source_christmas_grant_id)=1
) not valid;

create function private.christmas_deliver_reward(p_user uuid,p_source text,p_item text,p_quantity integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_item public.christmas_catalog%rowtype;v_grant uuid;v_kind text;v_key text;
 v_director uuid;v_team_season uuid;v_native uuid;v_collection uuid;v_i integer;
begin
 select * into strict v_item from public.christmas_catalog where id=p_item;
 if p_quantity not between 1 and 100 then raise exception 'Quantité invalide.'; end if;
 select id into strict v_grant from public.christmas_grants where edition_id='christmas-2026' and user_id=p_user and source=p_source and item_id=p_item and quantity=p_quantity and delivered_at is null;
 v_kind:=v_item.effect->'delivery'->>'kind';v_key:=v_item.effect->'delivery'->>'key';
 if v_kind in ('cosmetic','wallet_item') then
   update public.christmas_wallets set inventory=jsonb_set(inventory,array[p_item],to_jsonb(coalesce((inventory->>p_item)::integer,0)+p_quantity)) where edition_id='christmas-2026' and user_id=p_user;
   if not found then raise exception 'Inventaire de Noël introuvable.'; end if;
   return;
 end if;
 select d.id,ts.id into v_director,v_team_season from public.sporting_directors d
 join public.team_manager_assignments a on a.sporting_director_id=d.id and a.role='general_manager' and a.status='active'
 join public.seasons s on s.status='active' join public.team_seasons ts on ts.team_id=a.team_id and ts.season_id=s.id
 where d.auth_user_id=p_user and d.status='active' limit 1;
 if v_director is null then raise exception 'Une équipe active est nécessaire pour recevoir cet objet.'; end if;
 if v_kind='daily_reward' then
   for v_i in 1..p_quantity loop
     insert into public.daily_reward_inventory(sporting_director_id,team_season_id,reward_key,status,expires_after_game_year,source_christmas_grant_id)
     values(v_director,v_team_season,v_key,'available',2147483647,v_grant);
   end loop;
 elsif v_kind='inventory_item' then
   select id into strict v_native from public.inventory_catalog_items where item_key=v_key and status='active';
   insert into public.team_item_inventory(team_season_id,inventory_item_id,quantity,acquisition_source)
   values(v_team_season,v_native,p_quantity,'christmas-2026')
   on conflict(team_season_id,inventory_item_id)do update set quantity=public.team_item_inventory.quantity+excluded.quantity,updated_at=now();
 elsif v_kind='collector_booster' then
   select collection_season_id into strict v_collection from public.cyclo_stickers_editions where edition_id='cyclo-stickers-s5-s4-final-v1';
   for v_i in 1..p_quantity loop
     insert into public.cyclo_stickers_boosters(sporting_director_id,collection_season_id,acquisition_source,source_reference,awarded_on)
     values(v_director,v_collection,'christmas-2026',p_source||':'||v_i,(now() at time zone 'Europe/Paris')::date);
   end loop;
 elsif v_kind='equipment' then
   select id into strict v_native from public.equipment_catalog_items where catalog_key=v_key;
   insert into public.team_equipment_inventory(team_season_id,equipment_item_id,quantity,last_purchase_price)
   values(v_team_season,v_native,p_quantity,0) on conflict(team_season_id,equipment_item_id)
   do update set quantity=public.team_equipment_inventory.quantity+excluded.quantity,updated_at=now();
 else raise exception 'Attribution de Noël non configurée.';
 end if;
end;$$;
revoke all on function private.christmas_deliver_reward(uuid,text,text,integer) from public,anon,authenticated;

-- A second target shares the native mission, its staff, its price and its one
-- unavailability block. Cancellation and settlement remain entirely native.
create table public.christmas_reconnaissance_targets(
 reconnaissance_id uuid primary key references public.stage_reconnaissances(id) on delete cascade,
 stage_id uuid not null references public.stages(id) on delete restrict,
 user_id uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create index christmas_recon_target_stage_idx on public.christmas_reconnaissance_targets(stage_id,reconnaissance_id);
alter table public.christmas_reconnaissance_targets enable row level security;
revoke all on public.christmas_reconnaissance_targets from public,anon,authenticated;
grant select on public.christmas_reconnaissance_targets to service_role;
create view public.stage_reconnaissance_targets with(security_invoker=true) as
 select id,target_stage_id,bonus_points,status,team_season_id from public.stage_reconnaissances
 union all
 select r.id,t.stage_id,r.bonus_points,r.status,r.team_season_id from public.christmas_reconnaissance_targets t join public.stage_reconnaissances r on r.id=t.reconnaissance_id;
revoke all on public.stage_reconnaissance_targets from public,anon,authenticated;
grant select on public.stage_reconnaissance_targets to service_role;

create function private.guard_christmas_reconnaissance_duplicate()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.stage_reconnaissances requested
   join public.christmas_reconnaissance_targets extra on extra.stage_id=requested.target_stage_id
   join public.stage_reconnaissances prior on prior.id=extra.reconnaissance_id and prior.team_season_id=requested.team_season_id and prior.status<>'cancelled'
   join public.stage_reconnaissance_riders participant on participant.reconnaissance_id=prior.id and participant.rider_id=new.rider_id
   where requested.id=new.reconnaissance_id and requested.id<>prior.id) then
   raise exception 'Ce coureur connaît déjà cette étape grâce au Carnet des éclaireurs.';
 end if;
 return new;
end;$$;
create trigger guard_christmas_reconnaissance_duplicate before insert on public.stage_reconnaissance_riders for each row execute function private.guard_christmas_reconnaissance_duplicate();

create function private.christmas_use_item(p_user uuid,p_item text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_wallet public.christmas_wallets%rowtype;v_director uuid;v_card integer;v_rarity text;v_roll numeric;v_left integer:=3;v_take integer;v_row record;
 v_stages uuid[];v_riders uuid[];v_first public.stages%rowtype;v_second public.stages%rowtype;v_mission uuid;v_native public.stage_reconnaissances%rowtype;
 v_previous_sub text;v_result jsonb;
begin
 select * into strict v_wallet from public.christmas_wallets where edition_id='christmas-2026' and user_id=p_user for update;
 if coalesce((v_wallet.inventory->>p_item)::integer,0)<1 then raise exception 'Cet objet n’est pas disponible.'; end if;
 select id into strict v_director from public.sporting_directors where auth_user_id=p_user and status='active';
 if p_item in ('vignette-renne','hotte-doublons') then
   perform private.lock_cyclo_stickers_collections('cyclo-stickers-s5-s4-final-v1',array[v_director]);
   if not exists(select 1 from public.cyclo_stickers_cards where edition_id='cyclo-stickers-s5-s4-final-v1') then raise exception 'L’album S4 n’est pas disponible.'; end if;
   if p_item='vignette-renne' then
     v_roll:=(('x'||substr(replace(gen_random_uuid()::text,'-',''),1,12))::bit(48)::bigint)::numeric/281474976710656;
     v_rarity:=case when v_roll<.1 then 'holographic' when v_roll<.3 then 'gold' else 'silver' end;
     select card_number into v_card from public.cyclo_stickers_cards where edition_id='cyclo-stickers-s5-s4-final-v1' and rarity=v_rarity order by gen_random_uuid() limit 1;
     if v_card is null then raise exception 'Cette rareté n’est pas disponible dans l’album S4.'; end if;
   else
     select c.card_number into v_card from public.cyclo_stickers_cards c where c.edition_id='cyclo-stickers-s5-s4-final-v1' and c.rarity='silver'
       and not exists(select 1 from public.cyclo_stickers_card_inventory i where i.edition_id=c.edition_id and i.card_number=c.card_number and i.sporting_director_id=v_director and (i.quantity>0 or i.pasted))
       order by gen_random_uuid() limit 1;
     if v_card is null then raise exception 'Vous possédez déjà toutes les cartes Argent : l’objet est conservé.'; end if;
     if (select coalesce(sum(greatest(i.quantity-i.reserved-1,0)),0) from public.cyclo_stickers_card_inventory i join public.cyclo_stickers_cards c using(edition_id,card_number)
         where i.edition_id='cyclo-stickers-s5-s4-final-v1' and i.sporting_director_id=v_director and c.rarity='silver')<3 then
       raise exception 'Trois doublons Argent libres sont nécessaires. Les cartes collées, réservées et la dernière copie sont conservées.';
     end if;
     for v_row in select i.card_number,greatest(i.quantity-i.reserved-1,0) available from public.cyclo_stickers_card_inventory i join public.cyclo_stickers_cards c using(edition_id,card_number)
       where i.edition_id='cyclo-stickers-s5-s4-final-v1' and i.sporting_director_id=v_director and c.rarity='silver' and i.quantity-i.reserved>1 order by i.card_number for update of i loop
       v_take:=least(v_left,v_row.available);
       update public.cyclo_stickers_card_inventory set quantity=quantity-v_take where edition_id='cyclo-stickers-s5-s4-final-v1' and sporting_director_id=v_director and card_number=v_row.card_number;
       v_left:=v_left-v_take;exit when v_left=0;
     end loop;
     if v_left<>0 then raise exception 'Les doublons ont changé : l’objet est conservé.'; end if;
     v_rarity:='silver';
   end if;
   insert into public.cyclo_stickers_card_inventory(edition_id,sporting_director_id,card_number,quantity) values('cyclo-stickers-s5-s4-final-v1',v_director,v_card,1)
   on conflict(edition_id,sporting_director_id,card_number)do update set quantity=public.cyclo_stickers_card_inventory.quantity+1;
   v_result:=jsonb_build_object('cardNumber',v_card,'rarity',v_rarity,'editionId','cyclo-stickers-s5-s4-final-v1');
 elsif p_item='carnet-eclaireur' then
   if jsonb_typeof(p_payload->'stageIds')<>'array' or jsonb_array_length(p_payload->'stageIds')<>2 or jsonb_typeof(p_payload->'riderIds')<>'array' then raise exception 'Sélectionnez deux étapes et les coureurs inscrits.'; end if;
   select array_agg(value::uuid) into v_stages from jsonb_array_elements_text(p_payload->'stageIds');
   select array_agg(distinct value::uuid) into v_riders from jsonb_array_elements_text(p_payload->'riderIds');
   if v_stages[1]=v_stages[2] or cardinality(v_riders)<1 or cardinality(v_riders)>30 then raise exception 'Sélection de reconnaissance invalide.'; end if;
   select * into strict v_first from public.stages where id=v_stages[1];
   select * into strict v_second from public.stages where id=v_stages[2];
   if v_first.race_edition_id<>v_second.race_edition_id or v_first.status<>'planned' or v_second.status<>'planned'
     or not exists(select 1 from public.race_editions e join public.races r on r.id=e.race_id where e.id=v_first.race_edition_id and r.race_format='stage_race') then raise exception 'Les deux étapes doivent appartenir au même tour à venir.'; end if;
   v_previous_sub:=current_setting('request.jwt.claim.sub',true);
   perform set_config('request.jwt.claim.sub',p_user::text,true);
   v_mission:=public.book_current_team_stage_reconnaissance(v_stages[1],v_riders,(p_payload->>'startDayNumber')::integer,nullif(p_payload->>'preparerContractId','')::uuid);
   perform set_config('request.jwt.claim.sub',coalesce(v_previous_sub,''),true);
   select * into strict v_native from public.stage_reconnaissances where id=v_mission;
   if not exists(select 1 from public.season_days where id=v_second.season_day_id and day_number>v_native.end_day_number) then raise exception 'La reconnaissance doit se terminer avant les deux étapes.'; end if;
   if exists(select 1 from public.stage_reconnaissance_targets t join public.stage_reconnaissance_riders r on r.reconnaissance_id=t.id
     where t.team_season_id=v_native.team_season_id and t.target_stage_id=v_stages[2] and t.status<>'cancelled' and r.rider_id=any(v_riders)) then raise exception 'Un coureur connaît déjà la seconde étape : l’objet est conservé.'; end if;
   insert into public.christmas_reconnaissance_targets(reconnaissance_id,stage_id,user_id)values(v_mission,v_stages[2],p_user);
   v_result:=jsonb_build_object('reconnaissanceId',v_mission,'stageIds',to_jsonb(v_stages),'price',v_native.total_price);
 else raise exception 'Utilisez cet objet depuis sa rubrique habituelle.';
 end if;
 update public.christmas_wallets set inventory=jsonb_set(inventory,array[p_item],to_jsonb((inventory->>p_item)::integer-1))where edition_id='christmas-2026' and user_id=p_user;
 return v_result;
end;$$;
revoke all on function private.christmas_use_item(uuid,text,jsonb) from public,anon,authenticated;

-- Lazy selector: scoped to the authenticated owner's registered tours. It is
-- never requested by the regular event-state polling or by race simulation.
create function public.get_current_christmas_reconnaissance_context()
returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='5s' as $$
declare v_team uuid;v_season uuid;v_team_season uuid;v_day integer;v_races jsonb;v_riders jsonb;v_preparers jsonb;
begin
 if not exists(select 1 from public.christmas_wallets where edition_id='christmas-2026' and user_id=auth.uid() and coalesce((inventory->>'carnet-eclaireur')::integer,0)>0) then raise exception 'Vous ne possédez pas de Carnet des éclaireurs.'; end if;
 select a.team_id,s.id,ts.id,coalesce(s.current_day_number,1) into v_team,v_season,v_team_season,v_day
 from public.sporting_directors d join public.team_manager_assignments a on a.sporting_director_id=d.id and a.role='general_manager' and a.status='active'
 join public.seasons s on s.status='active' join public.team_seasons ts on ts.team_id=a.team_id and ts.season_id=s.id
 where d.auth_user_id=auth.uid() and d.status='active' limit 1;
 if v_team is null then raise exception 'Votre équipe active est introuvable.'; end if;
 with eligible as materialized (
  select e.id edition_id,e.display_name,registration.id registration_id,category.code category_code,r.race_format,
   stage.id stage_id,stage.stage_number,stage.name stage_name,day.day_number
  from public.race_registrations registration join public.race_editions e on e.id=registration.race_edition_id and e.season_id=v_season
  join public.races r on r.id=e.race_id and r.race_format='stage_race' join public.race_categories category on category.id=e.race_category_id
  join public.stages stage on stage.race_edition_id=e.id and stage.status='planned'
  join public.season_days day on day.id=stage.season_day_id and day.day_number>v_day+1
  where registration.team_season_id=v_team_season and public.is_race_registration_preparable(registration.id)
  order by day.day_number,e.id,stage.stage_number limit 200
 ), grouped as (
  select edition_id,display_name,registration_id,category_code,race_format,min(day_number) first_day,
   jsonb_agg(jsonb_build_object('id',stage_id,'label','Étape '||stage_number||' · '||stage_name,'dayNumber',day_number)order by stage_number) stages
  from eligible group by edition_id,display_name,registration_id,category_code,race_format
  order by min(day_number),edition_id limit 100
 )select coalesce(jsonb_agg(jsonb_build_object('id',g.edition_id,'name',g.display_name,
  'price',public.calculate_stage_reconnaissance_cost(g.category_code,g.race_format),'stages',g.stages,
  'riderIds',(select coalesce(jsonb_agg(roster.rider_id),'[]')from public.race_rosters roster where roster.race_registration_id=g.registration_id and roster.status in('selected','confirmed'))
 )order by g.first_day,g.edition_id),'[]')into v_races from grouped g;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name)order by x.name),'[]')into v_riders from(
  select distinct rider.id,rider.first_name||' '||rider.last_name name from public.riders rider
  join public.race_rosters roster on roster.rider_id=rider.id and roster.status in('selected','confirmed')
  join public.race_registrations registration on registration.id=roster.race_registration_id and registration.team_season_id=v_team_season
  join public.race_editions e on e.id=registration.race_edition_id and e.season_id=v_season
  where public.is_race_registration_preparable(registration.id)
 )x;
 select coalesce(jsonb_agg(jsonb_build_object('id',contract.id,'name',member.first_name||' '||member.last_name,'level',member.level,'capacity',public.get_race_preparer_rider_capacity(contract.id))order by member.level desc),'[]')into v_preparers
 from public.staff_contracts contract join public.staff_members member on member.id=contract.staff_member_id and member.role='race_preparer'
 where contract.team_id=v_team and contract.status='active';
 return jsonb_build_object('riders',v_riders,'preparers',v_preparers,'races',v_races,'currentDayNumber',v_day);
end;$$;
revoke all on function public.get_current_christmas_reconnaissance_context()from public,anon;
grant execute on function public.get_current_christmas_reconnaissance_context()to authenticated;

-- Keep the existing suffix protocol: all historical avatars, flags and Halloween
-- selections continue to decode. The database reconstructs Christmas selections
-- from owned inventory, ignoring any client-supplied Christmas art IDs.
create function private.apply_christmas_avatar()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_prefix text;v_arts text;v_christmas text;
begin
 v_prefix:=split_part(coalesce(new.avatar_key,'director_m_01'),'~halloween~',1);
 select string_agg(art,',' order by position) into v_arts from unnest(string_to_array(split_part(coalesce(new.avatar_key,''),'~halloween~',2),','))with ordinality as supplied(art,position)
 where art<>'' and art not like 'christmas:%';
 select string_agg('christmas:'||c.id,',' order by c.slot)into v_christmas
 from public.christmas_wallets w cross join lateral jsonb_each_text(w.cosmetics)selection(slot,id)
 join public.christmas_catalog c on c.id=selection.id and c.slot=selection.slot and c.category='portrait'
 where w.edition_id='christmas-2026' and w.user_id=new.auth_user_id and coalesce((w.inventory->>c.id)::integer,0)>0;
 v_arts:=concat_ws(',',nullif(v_arts,''),nullif(v_christmas,''));
 new.avatar_key:=v_prefix||case when v_arts<>'' then '~halloween~'||v_arts else '' end;
 return new;
end;$$;
create trigger zz_apply_christmas_avatar_before_update before insert or update of avatar_key on public.sporting_directors for each row execute function private.apply_christmas_avatar();
create function private.sync_christmas_avatar()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.cosmetics is distinct from old.cosmetics then update public.sporting_directors set avatar_key=avatar_key where auth_user_id=new.user_id;end if;
 return new;
end;$$;
create trigger sync_christmas_avatar after update of cosmetics on public.christmas_wallets for each row execute function private.sync_christmas_avatar();

create function public.save_sporting_director_seasonal_cosmetics(
 p_user uuid,p_display_name text,p_country uuid,p_avatar text,p_frame text,p_email_visible boolean,p_halloween_items text[],p_christmas_items text[]
)returns void language plpgsql security definer set search_path='' set lock_timeout='3s' as $$
declare v_wallet public.christmas_wallets%rowtype;v_id text;v_slot text;v_cosmetics jsonb:='{}';v_halloween text[];
begin
 if p_user is null or p_christmas_items is null or cardinality(p_christmas_items)>6 then raise exception 'Sélection d’accessoires invalide.';end if;
 -- Same wallet-before-profile ordering as event equip avoids crossed locks.
 select * into v_wallet from public.christmas_wallets where edition_id='christmas-2026' and user_id=p_user for update;
 foreach v_id in array p_christmas_items loop
  select slot into v_slot from public.christmas_catalog where id=v_id and category='portrait';
  if v_slot is null or coalesce((v_wallet.inventory->>v_id)::integer,0)<1 then raise exception 'Vous ne possédez pas ce cosmétique de Noël.';end if;
  if v_cosmetics?v_slot then raise exception 'Choisissez un seul élément par emplacement.';end if;
  v_cosmetics:=v_cosmetics||jsonb_build_object(v_slot,v_id);
 end loop;
 v_halloween:=p_halloween_items;
 if v_halloween is null then
  select coalesce(array_agg(selection.id),'{}')into v_halloween from public.halloween_wallets w cross join lateral jsonb_each_text(w.cosmetics)selection(slot,id)where w.user_id=p_user and w.edition_id='halloween-2026';
 end if;
 perform public.save_sporting_director_avatar_cosmetics(p_user,p_display_name,p_country,p_avatar,p_frame,p_email_visible,v_halloween);
 update public.christmas_wallets set cosmetics=v_cosmetics where edition_id='christmas-2026' and user_id=p_user;
end;$$;
revoke all on function public.save_sporting_director_seasonal_cosmetics(uuid,text,uuid,text,text,boolean,text[],text[])from public,anon,authenticated;
grant execute on function public.save_sporting_director_seasonal_cosmetics(uuid,text,uuid,text,text,boolean,text[],text[])to service_role;
revoke all on function private.apply_christmas_avatar(),private.sync_christmas_avatar(),private.guard_christmas_reconnaissance_duplicate()from public,anon,authenticated;

commit;
